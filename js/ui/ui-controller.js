// --- START OF FILE js/ui/ui-controller.js ---
import { getAppState, updateAppState, resetAppState, getCachedStrategyResultsForCombination, cacheStrategyResultsForCombination, clearCombinationStrategyCache } from './ui-state.js';
import { getCachedElements, clearUIOutputs } from './ui-elements.js';
import { getRawInputs, validateAndParseCoreInputs, setupInputEventListeners } from './ui-input-handler.js';
import { toggleFinderLog, findBestResultFromStrategyList, updateComparisonTableHighlight } from './ui-utils.js';
import { displayCombinationSummary } from './ui-display-combinations.js';
import { displayStrategyComparisonTable, displayStrategyDetails } from './ui-display-strategies.js';

// Assuming core logic functions are globally available or would be imported:
// import { findBestLpdCombination, calculateDirectProportionalCombination } from '../core/combination-finder.js';
// import { runAllocationProcess } from '../core/allocator.js';
// import { refineAllocationResult } from '../core/refinement.js';
// import { generatePlanAssemblyData } from '../core/assembly-generator.js';
// import { calculateMaxVariation, calculateAverageVariation, formatNumberPtBR } from '../utils/utils.js';
// import { REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 } from '../utils/utils.js'; // Constants

// Expose functions for HTML onclick attributes
window.initiateProcess = initiateProcess;
window.toggleFinderLog = toggleFinderLog;
// Note: toggleErrorStrategies and toggleDuplicateStrategies are now called via event listeners
// set up in displayStrategyComparisonTable, so they don't need to be on window.

document.addEventListener('DOMContentLoaded', () => {
    setupInputEventListeners();
});

function initiateProcess(mode) {
    console.clear();
    console.log(`--- Iniciando Processo (Modo: ${mode}) ---`);
    const elements = getCachedElements();
    clearUIOutputs();
    resetAppState(); // Resets appState and combinationStrategyResultsCache

    const rawInputs = getRawInputs();
    const parsedCoreInputs = validateAndParseCoreInputs(rawInputs);

    if (!parsedCoreInputs) return;

    updateAppState({
        originalItems: parsedCoreInputs.parsedItems,
        maxSlotsPerInstance: parsedCoreInputs.maxSlotsPerInstance,
        maxSlotsDisplay: String(parsedCoreInputs.maxSlotsPerInstance)
    });

    if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `Gerando Combinações (Modo: ${mode})...`;

    setTimeout(() => { // Simulate async operation / prevent UI freeze
        try {
            let combinationGenerationResult;
            const currentAppState = getAppState(); // Get fresh state

            if (mode === 'findBest') {
                combinationGenerationResult = findBestLpdCombination(currentAppState.originalItems, currentAppState.maxSlotsPerInstance, parsedCoreInputs.combinationSize);
            } else { // forceProportional
                combinationGenerationResult = calculateDirectProportionalCombination(currentAppState.originalItems, currentAppState.maxSlotsPerInstance, parsedCoreInputs.combinationSize);
                if (combinationGenerationResult.combination) {
                    combinationGenerationResult.combinations = [combinationGenerationResult.combination];
                } else {
                    combinationGenerationResult.combinations = [];
                }
            }

            if (elements.finderResultsLog) elements.finderResultsLog.innerHTML = combinationGenerationResult.log;
            if (elements.toggleLogBtn) elements.toggleLogBtn.style.display = 'inline-flex';

            if (combinationGenerationResult.status === "Error" || !combinationGenerationResult.combinations || combinationGenerationResult.combinations.length === 0) {
                if (elements.combinationSummaryTitle) elements.combinationSummaryTitle.style.display = 'block';
                if (elements.combinationSummaryTableDiv) elements.combinationSummaryTableDiv.innerHTML = `<span class="warning">Nenhuma combinação válida encontrada (Modo: ${mode}). Verifique o log detalhado e os parâmetros.</span>`;
                if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<span class="warning">Nenhuma combinação encontrada.</span>`;
                if (elements.finderResultsLog && (combinationGenerationResult.status === "Error" || combinationGenerationResult.combinations.length === 0)) {
                     elements.finderResultsLog.classList.remove('log-hidden'); // Show log
                }
                return;
            }

            if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<b>${combinationGenerationResult.combinations.length} combinações únicas encontradas.</b> Iniciando processamento das estratégias...`;

            let combinationPerformanceData = [];
            let combinationsProcessedCount = 0;
            const totalCombinationsToProcess = combinationGenerationResult.combinations.length;

            function processNextCombination() {
                if (combinationsProcessedCount >= totalCombinationsToProcess) {
                    if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<b>Processamento completo.</b> ${combinationPerformanceData.length} combinações avaliadas.`;
                    displayCombinationSummary(combinationPerformanceData, handleCombinationClick);
                    return;
                }

                const currentComboArray = combinationGenerationResult.combinations[combinationsProcessedCount];
                const comboStringKey = JSON.stringify(currentComboArray);
                console.log(`\n--- Processing Combination ${combinationsProcessedCount + 1}/${totalCombinationsToProcess}: [${currentComboArray.join(', ')}] ---`);

                if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `Processando Combinação ${combinationsProcessedCount + 1}/${totalCombinationsToProcess}: [${currentComboArray.join(', ')}]...`;

                // Update app state FOR THIS COMBINATION'S PROCESSING
                updateAppState({
                    userLpdCombinationWithDuplicates: currentComboArray,
                    uniqueLpdValues: [...new Set(currentComboArray)].filter(lpd => typeof lpd === 'number' && !isNaN(lpd)).sort((a, b) => a - b),
                    lpdInstanceCounts: currentComboArray.reduce((acc, lpd) => { if(typeof lpd === 'number' && !isNaN(lpd)) acc[lpd] = (acc[lpd] || 0) + 1; return acc; }, {}),
                });
                // Recalculate initialTotalSlotsPerValue based on new lpdInstanceCounts and maxSlotsPerInstance
                const tempAppStateForSlots = getAppState();
                const newInitialTotalSlots = {};
                tempAppStateForSlots.uniqueLpdValues.forEach(lpd => {
                    const instances = tempAppStateForSlots.lpdInstanceCounts[lpd] || 0;
                    newInitialTotalSlots[lpd] = tempAppStateForSlots.maxSlotsPerInstance !== Infinity ? (instances * tempAppStateForSlots.maxSlotsPerInstance) : Infinity;
                });
                updateAppState({ initialTotalSlotsPerValue: newInitialTotalSlots });


                setTimeout(() => { // simulate async part of loop
                    try {
                        const strategyResultsForThisCombo = runAllocatorPhaseInternal_Refactored();
                        cacheStrategyResultsForCombination(comboStringKey, strategyResultsForThisCombo);
                        let bestResultForThisCombo = findBestResultFromStrategyList(strategyResultsForThisCombo);
                        combinationPerformanceData.push({ combination: currentComboArray, bestResult: bestResultForThisCombo });
                    } catch (allocError) {
                        console.error(`Error running allocator for combo [${currentComboArray.join(', ')}]:`, allocError);
                        combinationPerformanceData.push({
                            combination: currentComboArray,
                            bestResult: { strategyName: "Erro Alocador", maxVariation: Infinity, avgVariation: Infinity, meetsLimit: false, hasAllocationError: true, displayMaxVarStr: '<span class="error">Erro</span>', displayAvgVarStr: '<span class="error">Erro</span>', displayOutcomeStr: '<span class="error">Erro</span>', isDuplicateResult: false }
                        });
                    }
                    combinationsProcessedCount++;
                    processNextCombination();
                }, 5); // Small delay
            }
            processNextCombination(); // Start processing
        } catch (combinationError) {
            console.error(`Erro durante Geração/Processamento da Combinação (Modo: ${mode}):`, combinationError);
            if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<span class="error">Ocorreu um erro inesperado. Verifique o console.</span>`;
            if (elements.finderResultsLog) elements.finderResultsLog.innerHTML += `\n<span class="error">Erro inesperado: ${combinationError.message}</span>`;
            if (elements.combinationSummaryTitle) elements.combinationSummaryTitle.style.display = 'block';
            if (elements.combinationSummaryTableDiv) elements.combinationSummaryTableDiv.innerHTML = `<span class="error">Erro no processo (Modo: ${mode}). Verifique console.</span>`;
            if (elements.toggleLogBtn) elements.toggleLogBtn.style.display = 'inline-flex';
            if (elements.finderResultsLog) elements.finderResultsLog.classList.remove('log-hidden');
        }
    }, 10); // Outer setTimeout
} // End initiateProcess

function handleCombinationClick(encodedComboString, clickedRowElement) {
    const comboString = decodeURIComponent(encodedComboString);
    const elements = getCachedElements();
    console.log(`Displaying results for combination: ${comboString}`);

    // Highlight clicked row in Combination Summary Table
    const combTable = elements.combinationSummaryTable; // Re-fetch in case it was re-rendered
    if (combTable) {
        const tBody = combTable.getElementsByTagName('tbody')[0];
        if (tBody) Array.from(tBody.rows).forEach(r => r.classList.remove('selected-combination'));
    }
    if (clickedRowElement) clickedRowElement.classList.add('selected-combination');

    const cachedResults = getCachedStrategyResultsForCombination(comboString);
    if (!cachedResults) {
        console.error("Error: Cached strategy results not found for combo:", comboString);
        if (elements.statusArea) elements.statusArea.innerHTML = `<span class="error">Erro: Resultados da estratégia não encontrados.</span>`;
        // Clear other detail sections if needed
        return;
    }

    // Update appState for the selected combination
    try {
        const selectedComboArray = JSON.parse(comboString);
        updateAppState({
            strategyResults: cachedResults, // Store the full list of strategy results for this combo
            userLpdCombinationWithDuplicates: selectedComboArray,
            uniqueLpdValues: [...new Set(selectedComboArray)].filter(lpd => typeof lpd === 'number' && !isNaN(lpd)).sort((a, b) => a - b),
            lpdInstanceCounts: selectedComboArray.reduce((acc, lpd) => { if(typeof lpd === 'number' && !isNaN(lpd)) acc[lpd] = (acc[lpd] || 0) + 1; return acc; }, {}),
        });
        // Recalculate initialTotalSlotsPerValue based on new lpdInstanceCounts and maxSlotsPerInstance
        const tempAppStateForSlots = getAppState();
        const newInitialTotalSlots = {};
        tempAppStateForSlots.uniqueLpdValues.forEach(lpd => {
            const instances = tempAppStateForSlots.lpdInstanceCounts[lpd] || 0;
            newInitialTotalSlots[lpd] = tempAppStateForSlots.maxSlotsPerInstance !== Infinity ? (instances * tempAppStateForSlots.maxSlotsPerInstance) : Infinity;
        });
        updateAppState({ initialTotalSlotsPerValue: newInitialTotalSlots });
    } catch (e) {
        console.error("Error parsing selected combination string for state update:", comboString, e);
        if (elements.statusArea) elements.statusArea.innerHTML = `<span class="error">Erro ao processar combinação selecionada.</span>`;
        return;
    }

    // Show relevant UI sections
    const sectionsToDisplay = [
        elements.allocatorTitle, elements.statusArea, elements.strategyComparison,
        elements.detailsSeparator, elements.detailsTitle, elements.allocationResults,
        elements.adjustmentLog, elements.variationLog, elements.cumulativeUsage,
        elements.refinementLog, elements.lpdBreakdown, elements.finalSummaryTableDiv
    ];
    sectionsToDisplay.forEach(el => { if (el) el.style.display = 'block'; });

    const currentAppState = getAppState();
    displayStrategyComparisonTable(currentAppState.strategyResults, handleStrategyClick);

    // Update combo display in strategy comparison title
    const comboDisplaySpan = document.getElementById('currentComboDisplayInStratComparison');
    if (comboDisplaySpan) comboDisplaySpan.textContent = currentAppState.userLpdCombinationWithDuplicates.join(', ');


    const defaultStrategyToShow = findBestResultFromStrategyList(currentAppState.strategyResults);
    if (defaultStrategyToShow) {
        if (elements.statusArea) elements.statusArea.innerHTML = `Exibindo para combinação: <span class="info">[${currentAppState.userLpdCombinationWithDuplicates.join(', ')}]</span>. Estratégia Padrão: <span class="info">${defaultStrategyToShow.strategyName}</span>${defaultStrategyToShow.hasAllocationError ? ' <span class="error">(Contém Erro)</span>': ''}.`;
        handleStrategyClick(encodeURIComponent(defaultStrategyToShow.strategyName)); // Display its details
    } else {
        if (elements.statusArea) elements.statusArea.innerHTML = `<span class="error">Nenhum resultado de estratégia padrão encontrado para [${currentAppState.userLpdCombinationWithDuplicates.join(', ')}]</span>`;
        // Clear detail sections
    }
}

function handleStrategyClick(encodedStrategyName) {
    const strategyName = decodeURIComponent(encodedStrategyName);
    updateAppState({ currentlyDisplayedStrategyName: strategyName });

    const currentAppState = getAppState();
    const selectedResult = currentAppState.strategyResults.find(res => res.strategyName === strategyName);

    if (!selectedResult) {
        console.error(`Could not find strategy result for ${strategyName} in current app state.`);
        // Display error or clear details
        return;
    }
    // Pass the specific result and the whole appState (for context like originalItems)
    displayStrategyDetails(selectedResult, currentAppState);
}


function runAllocatorPhaseInternal_Refactored() {
    // This function now relies on appState for its primary inputs.
    const currentAppState = getAppState();
    console.log("[runAllocatorPhaseInternal_Refactored] START with appState:", currentAppState);

    const {
        originalItems, userLpdCombinationWithDuplicates, uniqueLpdValues,
        initialTotalSlotsPerValue, maxSlotsPerInstance
    } = currentAppState;

    if (!originalItems || originalItems.length === 0) {
        console.error("[runAllocatorPhaseInternal_Refactored] Validation failed: originalItems missing.");
        return [];
    }
    // Ensure necessary inputs are arrays/objects even if empty for safety
    const currentCombo = Array.isArray(userLpdCombinationWithDuplicates) ? userLpdCombinationWithDuplicates : [];
    const currentUniqueLpds = Array.isArray(uniqueLpdValues) ? uniqueLpdValues : [];
    const currentInitialSlots = typeof initialTotalSlotsPerValue === 'object' && initialTotalSlotsPerValue !== null ? initialTotalSlotsPerValue : {};


    // Pre-calculation for heuristics (using currentAppState values)
    let averageLPDValue = 0;
    let smallestPositiveLPD = Infinity;
    let potentialDifferences = new Map(); // To store { originalIndex: { potentialDiff, preliminarySum, prelimError } }

    if (currentCombo.length > 0) {
        let sumLPDs = 0;
        let positiveLPDs = [];
        currentCombo.forEach(lpd => {
            if (typeof lpd === 'number' && !isNaN(lpd)) {
                sumLPDs += lpd;
                if (lpd > 0) {
                    positiveLPDs.push(lpd);
                    if (lpd < smallestPositiveLPD) smallestPositiveLPD = lpd;
                }
            }
        });
        averageLPDValue = sumLPDs / currentCombo.length;
        if (smallestPositiveLPD === Infinity) smallestPositiveLPD = 0; // Handle case with no positive LPDs

        // Calculate potential differences for heuristic strategies
        const initialSlotsCopyForDP = { ...currentInitialSlots }; // Use a copy for DP's internal logic
        if (originalItems && Array.isArray(originalItems)) {
            originalItems.forEach(item => {
                if (!item || typeof item.originalIndex === 'undefined') { return; } // Skip invalid item
                if (currentUniqueLpds.length === 0) {
                    potentialDifferences.set(item.originalIndex, { potentialDiff: Math.abs(item.amount || 0), preliminarySum: 0, prelimError: "No LPDs available" });
                    return;
                }
                // findClosestSumWithRepetitionAndSlots is a global core function
                const prelimResult = findClosestSumWithRepetitionAndSlots(currentUniqueLpds, item.amount, initialSlotsCopyForDP);
                potentialDifferences.set(item.originalIndex, {
                    potentialDiff: Math.abs(prelimResult.difference === undefined ? (item.amount || 0) : prelimResult.difference),
                    preliminarySum: prelimResult.sum,
                    prelimError: prelimResult.error
                });
            });
        }
    } else {
        smallestPositiveLPD = 0; // Default if no combo
    }


    const strategies = [
        { name: "Ordem Original de Entrada", sortFn: (items) => [...items] },
        { name: "Quantidade Ascendente", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount) },
        { name: "Quantidade Descendente", sortFn: (items) => [...items].sort((a, b) => b.amount - a.amount) },
        { name: "Especificação Ascendente (A-Z)", sortFn: (items) => [...items].sort((a, b) => (a.details || '').localeCompare(b.details || '')) },
        { name: "Especificação Descendente (Z-A)", sortFn: (items) => [...items].sort((a, b) => (b.details || '').localeCompare(a.details || '')) },
        { name: "Quantidade Meio-para-Fora (Baixo/Cima)", sortFn: (items) => { const s = [...items].sort((a, b) => a.amount - b.amount), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (l >= 0) r.push(s[l--]); if (g < n) r.push(s[g++]); } return r; }},
        { name: "Quantidade Meio-para-Fora (Cima/Baixo)", sortFn: (items) => { const s = [...items].sort((a, b) => a.amount - b.amount), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (g < n) r.push(s[g++]); if (l >= 0) r.push(s[l--]); } return r; }},
        { name: "Qtd Asc, Especificação Asc (Desempate)", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount || (a.details || '').localeCompare(b.details || '')) },
        // --- NEW Heuristics using pre-calculated values ---
        { name: "Maior Dificuldade Potencial Primeiro", sortFn: (items) => [...items].sort((a, b) => { const diffB = (potentialDifferences.get(b.originalIndex) || { potentialDiff: Infinity }).potentialDiff; const diffA = (potentialDifferences.get(a.originalIndex) || { potentialDiff: Infinity }).potentialDiff; return diffB - diffA || b.amount - a.amount; }) },
        { name: "Menor Dificuldade Potencial Primeiro", sortFn: (items) => [...items].sort((a, b) => { const diffA = (potentialDifferences.get(a.originalIndex) || { potentialDiff: Infinity }).potentialDiff; const diffB = (potentialDifferences.get(b.originalIndex) || { potentialDiff: Infinity }).potentialDiff; return diffA - diffB || a.amount - b.amount; }) },
        { name: "Maior Demanda Estimada Primeiro (Avg LPD)", sortFn: (items) => [...items].sort((a, b) => { const demandB = averageLPDValue > 0 ? (b.amount / averageLPDValue) : (b.amount > 0 ? Infinity : 0); const demandA = averageLPDValue > 0 ? (a.amount / averageLPDValue) : (a.amount > 0 ? Infinity : 0); return demandB - demandA || b.amount - a.amount; }) },
        { name: "Menor Flexibilidade Primeiro (LPDs <= Alvo)", sortFn: (items) => [...items].sort((a, b) => { const countA = currentUniqueLpds.filter(lpd => lpd > 0 && lpd <= a.amount).length; const countB = currentUniqueLpds.filter(lpd => lpd > 0 && lpd <= b.amount).length; return countA - countB || a.amount - b.amount; }) },
        { name: "Maior Granularidade Necessária Primeiro (Alvo/MenorLPD)", sortFn: (items) => [...items].sort((a, b) => { const ratioB = smallestPositiveLPD > 0 ? (b.amount / smallestPositiveLPD) : (b.amount > 0 ? Infinity : 0); const ratioA = smallestPositiveLPD > 0 ? (a.amount / smallestPositiveLPD) : (a.amount > 0 ? Infinity : 0); return ratioB - ratioA || b.amount - a.amount; }) },
        { name: "Dependência LPD Crítico Mais Raro Primeiro", sortFn: (items) => {
             const findCriticalLPD = (itemAmount) => { let maxFound = -1; for (const lpd of currentUniqueLpds) { if (lpd > 0 && lpd <= itemAmount && lpd > maxFound) maxFound = lpd; } return maxFound > 0 ? maxFound : 0; };
             return [...items].sort((a, b) => {
                 const critA = findCriticalLPD(a.amount); const critB = findCriticalLPD(b.amount);
                 const availA = (critA > 0 && currentInitialSlots.hasOwnProperty(critA)) ? currentInitialSlots[critA] : Infinity;
                 const availB = (critB > 0 && currentInitialSlots.hasOwnProperty(critB)) ? currentInitialSlots[critB] : Infinity;
                 if (availA !== availB) return availA - availB; // Rarest first
                 return b.amount - a.amount; // Tie-break: larger amount first
             }); }
        }
        // Add other strategies as needed
    ];

    let localStrategyResults = [];
    for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        let itemsForThisStrategy = strategy.sortFn(JSON.parse(JSON.stringify(originalItems)))
                                     .map((item, idx) => ({ ...item, index: idx })); // Deep clone and add processing index
        // runAllocationProcess is a global core function
        let allocationOutcome = runAllocationProcess(itemsForThisStrategy, [...currentCombo], maxSlotsPerInstance);

        let hasErrorInAlloc = false;
        if (!allocationOutcome || !allocationOutcome.itemAllocations) { hasErrorInAlloc = true; }
        else {
            for(const alloc of allocationOutcome.itemAllocations) {
                if (alloc && alloc.error) { hasErrorInAlloc = true; break; }
                 const itemForAlloc = itemsForThisStrategy.find(itm => itm.originalIndex === alloc.originalIndex); // This assumes alloc has originalIndex
                 if (itemForAlloc && itemForAlloc.amount > 0 && alloc.sum === 0 && alloc.combination && alloc.combination.length === 0 && !alloc.error) {
                    alloc.error = "Soma 0 para alvo > 0 (Falha DP?)";
                    hasErrorInAlloc = true;
                 }
            }
        }
        if (!hasErrorInAlloc && allocationOutcome && allocationOutcome.error) hasErrorInAlloc = true;


        let calculatedMaxVar = Infinity, calculatedAvgVar = Infinity;
        if (!hasErrorInAlloc) {
            // calculateMaxVariation, calculateAverageVariation are global core functions
            calculatedMaxVar = calculateMaxVariation(itemsForThisStrategy, allocationOutcome.itemAllocations);
            calculatedAvgVar = calculateAverageVariation(itemsForThisStrategy, allocationOutcome.itemAllocations);
        }
        // REPROCESS_VARIATION_LIMIT is a global constant
        const meetsProcessingLimit = !hasErrorInAlloc && calculatedMaxVar <= REPROCESS_VARIATION_LIMIT;

        let assemblyData = null;
        if (!hasErrorInAlloc) {
            // generatePlanAssemblyData is a global core function
            assemblyData = generatePlanAssemblyData(itemsForThisStrategy, allocationOutcome.itemAllocations, currentCombo, maxSlotsPerInstance);
        }

        localStrategyResults.push({
            strategyName: strategy.name, itemsUsed: itemsForThisStrategy, resultData: allocationOutcome,
            maxVariation: calculatedMaxVar, avgVariation: calculatedAvgVar, meetsLimit: meetsProcessingLimit,
            hasAllocationError: hasErrorInAlloc, planAssemblyDataForExport: assemblyData,
            displayMaxVarStr: '', displayAvgVarStr: '', displayOutcomeStr: '', isDuplicateResult: false
        });
    }

    // Apply Refinement to the best preliminary result
    let preliminaryBest = findBestResultFromStrategyList(localStrategyResults);
    if (preliminaryBest && !preliminaryBest.hasAllocationError) {
        const resultToRefineCopy = JSON.parse(JSON.stringify(preliminaryBest));
        // refineAllocationResult is a global core function
        // It also uses global constants like VARIATION_LIMIT_PASS_3, REPROCESS_VARIATION_LIMIT
        // and functions like calculateMaxVariation, calculateAverageVariation, generatePlanAssemblyData
        const refinementOutcome = refineAllocationResult(resultToRefineCopy);
        if (refinementOutcome && refinementOutcome.refinedResultEntry) {
            const indexToUpdate = localStrategyResults.findIndex(r => r.strategyName === preliminaryBest.strategyName);
            if (indexToUpdate !== -1) {
                localStrategyResults[indexToUpdate] = refinementOutcome.refinedResultEntry;
                localStrategyResults[indexToUpdate].refinementLog = refinementOutcome.log;
            }
        }
    }

    // Sort results
    localStrategyResults.sort((a, b) => {
        if (a.hasAllocationError && !b.hasAllocationError) return 1;
        if (!a.hasAllocationError && b.hasAllocationError) return -1;
        const avgDiff = (a.avgVariation ?? Infinity) - (b.avgVariation ?? Infinity);
        if (avgDiff !== 0) return avgDiff;
        return (a.maxVariation ?? Infinity) - (b.maxVariation ?? Infinity);
    });

    // Identify Duplicates & Pre-calculate Display Strings
    const encounteredAssemblies = new Set();
    const encounteredDisplaySummaries = new Set();
    localStrategyResults.forEach(res => {
        if (res.hasAllocationError) {
            res.displayOutcomeStr = `<span class="error">Erro</span>`;
            res.displayMaxVarStr = '?'; res.displayAvgVarStr = '?';
        } else {
            // REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 are global constants
            if (res.maxVariation === Infinity) { res.displayMaxVarStr = '<span class="violation">Infinita</span>'; }
            else {
                res.displayMaxVarStr = (res.maxVariation * 100).toFixed(1) + '%';
                if (!res.meetsLimit) {
                    res.displayMaxVarStr = `<span class="${res.maxVariation > REPROCESS_VARIATION_LIMIT ? 'violation' : 'warning'}">${res.displayMaxVarStr}</span>`;
                }
            }
            res.displayAvgVarStr = (res.avgVariation * 100).toFixed(1) + '%';
            if (res.meetsLimit) { res.displayOutcomeStr = `<span class="success">Sucesso</span>`; }
            else { res.displayOutcomeStr = `<span class="warning">Var Alta</span>`; }
        }
        const displaySummarySignature = `${res.displayMaxVarStr}-${res.displayAvgVarStr}-${res.displayOutcomeStr}`;
        const assemblyString = res.planAssemblyDataForExport ? JSON.stringify(res.planAssemblyDataForExport) : 'null_assembly';
        res.isDuplicateResult = (assemblyString !== 'null_assembly' && encounteredAssemblies.has(assemblyString)) || encounteredDisplaySummaries.has(displaySummarySignature);
        if (assemblyString !== 'null_assembly') encounteredAssemblies.add(assemblyString);
        encounteredDisplaySummaries.add(displaySummarySignature);
    });

    console.log("[runAllocatorPhaseInternal_Refactored] END. Returning sorted results.");
    return localStrategyResults;
}
// --- END OF FILE js/ui/ui-controller.js ---