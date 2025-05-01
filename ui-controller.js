// --- In ui-controller.js ---

// --- Global Cache for full strategy results per combination ---
let globalCombinationStrategyResultsCache = {}; // Key: JSON string of combo, Value: full sorted strategy results array

// --- Função da Fase do Alocador (Original, now effectively unused directly by initiateProcess) ---
// Kept for reference or potential future use, but initiateProcess now uses runAllocatorPhaseInternal
function runAllocatorPhase() {
    console.warn("[runAllocatorPhase] This function is deprecated for direct use. Call initiateProcess which uses runAllocatorPhaseInternal.");
    // The logic inside this function has been moved/adapted into runAllocatorPhaseInternal
    // If you need the original functionality, call runAllocatorPhaseInternal and then display its results.
}

// --- FUNÇÃO PRINCIPAL DE CONTROLE ---
function initiateProcess(mode) {
    console.clear();
    console.log(`--- Iniciando Processo (Modo: ${mode}) ---`);
    // --- Get Inputs ---
    const tableDataInput = document.getElementById('tableData').value.trim();
    const maxSlotsInput = document.getElementById('maxSlots').value.trim();
    const combinationSizeInput = document.getElementById('combinationSize').value.trim();
    // --- Get UI Elements (Add new ones) ---
    const finderStatusDisplay = document.getElementById('finderStatusDisplay'); // NEW
    const finderResultsLogDiv = document.getElementById('finderResultsLog');
    const toggleLogBtn = document.getElementById('toggleLogBtn'); // NEW
    const combinationSummaryTitle = document.getElementById('combinationSummaryTitle');
    const combinationSummaryTableDiv = document.getElementById('combinationSummaryTableDiv');
    const statusAreaDiv = document.getElementById('statusArea');
    const strategyComparisonDiv = document.getElementById('strategyComparison');
    const allocationResultsDiv = document.getElementById('allocationResults');
    const adjustmentLogDiv = document.getElementById('adjustmentLog');
    const variationLogDiv = document.getElementById('variationLog');
    const cumulativeUsageDiv = document.getElementById('cumulativeUsage');
    const refinementLogDiv = document.getElementById('refinementLog');
    const lpdBreakdownDiv = document.getElementById('lpdBreakdown');
    const finalSummaryTableDiv = document.getElementById('finalSummaryTableDiv');
    const detailsTitleH2 = document.getElementById('detailsTitle');
    const allocatorTitleH2 = document.getElementById('allocatorTitle');
    const detailsSeparatorHr = document.getElementById('detailsSeparator');


    // --- Clear previous results (Update clearing) ---
    // Clear status display and hide log
    if (finderStatusDisplay) finderStatusDisplay.innerHTML = `Processando Entradas...`; else console.error("Element not found: finderStatusDisplay");
    if (finderResultsLogDiv) {
        finderResultsLogDiv.innerHTML = ''; // Clear content
        finderResultsLogDiv.classList.add('log-hidden'); // Ensure it's hidden
    } else console.error("Element not found: finderResultsLogDiv");
    if (toggleLogBtn) {
        toggleLogBtn.textContent = 'Mostrar Log Detalhado';
        toggleLogBtn.style.display = 'none'; // Keep hidden initially
    } else console.error("Element not found: toggleLogBtn");


    // Clear other sections (check elements exist)
    if (combinationSummaryTitle) combinationSummaryTitle.style.display = 'none'; else console.error("Element not found: combinationSummaryTitle");
    if (combinationSummaryTableDiv) combinationSummaryTableDiv.innerHTML = ''; else console.error("Element not found: combinationSummaryTableDiv");
    if (statusAreaDiv) { statusAreaDiv.innerHTML = ''; statusAreaDiv.style.display = 'none'; } else { console.error("Element not found: statusAreaDiv"); }
    if (strategyComparisonDiv) { strategyComparisonDiv.innerHTML = ''; strategyComparisonDiv.style.display = 'none'; } else { console.error("Element not found: strategyComparisonDiv"); }
    if (allocationResultsDiv) { allocationResultsDiv.innerHTML = ''; allocationResultsDiv.style.display = 'none'; } else { console.error("Element not found: allocationResultsDiv"); }
    if (adjustmentLogDiv) { adjustmentLogDiv.innerHTML = ''; adjustmentLogDiv.style.display = 'none'; } else { console.error("Element not found: adjustmentLogDiv"); }
    if (variationLogDiv) { variationLogDiv.innerHTML = ''; variationLogDiv.style.display = 'none'; } else { console.error("Element not found: variationLogDiv"); }
    if (cumulativeUsageDiv) { cumulativeUsageDiv.innerHTML = ''; cumulativeUsageDiv.style.display = 'none'; } else { console.error("Element not found: cumulativeUsageDiv"); }
    if (refinementLogDiv) { refinementLogDiv.innerHTML = ''; refinementLogDiv.style.display = 'none'; } else { console.error("Element not found: refinementLogDiv"); }
    if (lpdBreakdownDiv) { lpdBreakdownDiv.innerHTML = ''; lpdBreakdownDiv.style.display = 'none'; } else { console.error("Element not found: lpdBreakdownDiv"); }
    if (finalSummaryTableDiv) { finalSummaryTableDiv.innerHTML = ''; finalSummaryTableDiv.style.display = 'none'; } else { console.error("Element not found: finalSummaryTableDiv"); }
    if (detailsTitleH2) { detailsTitleH2.innerHTML = 'Resultados Detalhados da Alocação'; detailsTitleH2.style.display = 'none'; } else { console.error("Element not found: detailsTitleH2"); }
    if (allocatorTitleH2) { allocatorTitleH2.style.display = 'none'; } else { console.error("Element not found: allocatorTitleH2"); }
    if (detailsSeparatorHr) { detailsSeparatorHr.style.display = 'none'; } else { console.error("Element not found: detailsSeparatorHr"); }

    globalCurrentlyDisplayedStrategyName = null;
    globalCombinationStrategyResultsCache = {}; // Clear cache

    // --- Reset Globals (uses globals from utils.js) ---
    globalStrategyResults = []; globalOriginalItems = []; globalUniqueLpdValues = []; globalUserLpdCombinationWithDuplicates = []; globalLpdInstanceCounts = {}; globalInitialTotalSlotsPerValue = {}; globalMaxSlotsPerInstance = Infinity; globalMaxSlotsDisplay = "Ilimitado";

    // --- Input validation & Parsing ---
    if (!tableDataInput) { if (finderStatusDisplay) finderStatusDisplay.innerHTML = '<span class="error">Erro: Dados da tabela vazios.</span>'; return; }
    if (!maxSlotsInput) { if (finderStatusDisplay) finderStatusDisplay.innerHTML = '<span class="error">Erro: "Imagens no Plano" é obrigatório.</span>'; return; }
    if (!combinationSizeInput) { if (finderStatusDisplay) finderStatusDisplay.innerHTML = '<span class="error">Erro: "Quantidade de Planos" é obrigatório.</span>'; return; }
    let maxSlotsPerInstance; let combinationSize;
     try { maxSlotsPerInstance = parseInt(maxSlotsInput); if (isNaN(maxSlotsPerInstance) || maxSlotsPerInstance < 1) throw new Error('"Imagens no Plano" >= 1.'); globalMaxSlotsPerInstance = maxSlotsPerInstance; globalMaxSlotsDisplay = String(maxSlotsPerInstance); } catch (e) { if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="error">Erro de Entrada: ${e.message}</span>`; return; } // Set globals
     try { combinationSize = parseInt(combinationSizeInput); if (isNaN(combinationSize) || combinationSize < 1) throw new Error('"Quantidade de Planos" >= 1.'); } catch (e) { if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="error">Erro de Entrada: ${e.message}</span>`; return; }

    // **** CALL TO processing-logic.js ****
    const parseResult = parseTableData(tableDataInput);
    // Check for parsing errors and update status display
    if (parseResult.errors.length > 0) {
        if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="error">Erros ao Processar Entradas. Verifique o Log Detalhado.</span>`;
        if(finderResultsLogDiv) finderResultsLogDiv.innerHTML = `<span class="error">Erros ao Processar Entradas:</span>\n${parseResult.errors.join('\n')}`;
        // Show log and button if there are parsing errors
        if (finderResultsLogDiv) finderResultsLogDiv.classList.remove('log-hidden');
        if (toggleLogBtn) toggleLogBtn.style.display = 'inline-flex';
        return;
     }
    if (parseResult.count === 0) { if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="error">Erro: Nenhuma Especificação válida processada.</span>`; return; }
    globalOriginalItems = parseResult.items; // Set global original items ONCE
    // **** CALLS TO this file (ui-controller.js) ****
    updateItemCountDisplay(); checkCombinationSizeWarning();
    console.log(`Processados ${parseResult.count} Especificações.`);

    // --- Generate Combinations (Timeout block) ---
    if (finderStatusDisplay) finderStatusDisplay.innerHTML = `Gerando Combinações (Modo: ${mode})...`; // Update status
    setTimeout(() => {
        try {
            let combinationResult = null;
            let combinationMethodDescription = "";

            // **** CALLS TO processing-logic.js ****
            if (mode === 'findBest') {
                console.log("Chamando findBestLpdCombination (Modo Múltiplo)...");
                combinationResult = findBestLpdCombination(globalOriginalItems, maxSlotsPerInstance, combinationSize); // Uses modified version
                combinationMethodDescription = "Otimização por Frequência (Múltiplos Alvos)";
            } else if (mode === 'forceProportional') {
                console.log("Chamando calculateDirectProportionalCombination (Modo Múltiplo)...");
                combinationResult = calculateDirectProportionalCombination(globalOriginalItems, maxSlotsPerInstance, combinationSize);
                combinationMethodDescription = "Distribuição Proporcional Direta";
                // Wrap the single result in an array for consistency
                if(combinationResult.combination) {
                    combinationResult.combinations = [combinationResult.combination];
                } else {
                    combinationResult.combinations = [];
                }
            } else { throw new Error(`Modo desconhecido: ${mode}`); }

            // Write FULL log to the hidden div
            if (finderResultsLogDiv) finderResultsLogDiv.innerHTML = combinationResult.log;

             // SHOW the toggle button now that there's a log to potentially show
             if (toggleLogBtn) toggleLogBtn.style.display = 'inline-flex';

            // Handle combination generation errors/results
            if (combinationResult.status === "Error" || !combinationResult.combinations) {
                if (combinationSummaryTitle) combinationSummaryTitle.style.display = 'block';
                if (combinationSummaryTableDiv) combinationSummaryTableDiv.innerHTML = `<span class="error">Geração de Combinações falhou (Modo: ${mode}). Verifique o log detalhado.</span>`;
                if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="error">Falha na geração de combinações.</span>`; // Update status
                if (finderResultsLogDiv) finderResultsLogDiv.classList.remove('log-hidden'); // Show log on error
                return;
            }
            if (combinationResult.combinations.length === 0) {
                 if (combinationSummaryTitle) combinationSummaryTitle.style.display = 'block';
                if (combinationSummaryTableDiv) combinationSummaryTableDiv.innerHTML = `<span class="warning">Nenhuma combinação válida encontrada (Modo: ${mode}). Verifique o log detalhado e os parâmetros.</span>`;
                if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="warning">Nenhuma combinação encontrada.</span>`; // Update status
                 if (finderResultsLogDiv) finderResultsLogDiv.classList.remove('log-hidden'); // Show log if nothing found
                return;
            }

            // Initial status update before processing loop
            if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<b>${combinationResult.combinations.length} combinações únicas encontradas.</b> Iniciando processamento das estratégias...`;

            // --- Process Each Combination ---
            let combinationPerformance = [];
            let combinationsProcessed = 0;
            const totalCombinations = combinationResult.combinations.length; // Store total

            function processNextCombination() {
                if (combinationsProcessed >= totalCombinations) {
                    // All combinations processed, display summary
                    if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<b>Processamento completo.</b> ${combinationPerformance.length} combinações avaliadas.`; // Final status
                    // **** CALL TO this file (ui-controller.js) ****
                    displayCombinationSummary(combinationPerformance);
                    return;
                }

                const currentCombo = combinationResult.combinations[combinationsProcessed];
                const comboString = JSON.stringify(currentCombo);
                console.log(`\n--- Processing Combination ${combinationsProcessed + 1}/${totalCombinations}: [${currentCombo.join(', ')}] ---`);

                // Update STATUS DISPLAY before processing
                if (finderStatusDisplay) finderStatusDisplay.innerHTML = `Processando Combinação ${combinationsProcessed + 1}/${totalCombinations}: [${currentCombo.join(', ')}]...`;

                // Set globals for this combination (uses globals from utils.js)
                globalUserLpdCombinationWithDuplicates = currentCombo;
                globalUniqueLpdValues = [...new Set(currentCombo)].sort((a, b) => a - b);
                globalLpdInstanceCounts = {}; currentCombo.forEach(lpd => { if (typeof lpd === 'number' && !isNaN(lpd)) {globalLpdInstanceCounts[lpd] = (globalLpdInstanceCounts[lpd] || 0) + 1; }});
                globalInitialTotalSlotsPerValue = {}; globalUniqueLpdValues.forEach(lpd => { const instances = globalLpdInstanceCounts[lpd] || 0; globalInitialTotalSlotsPerValue[lpd] = globalMaxSlotsPerInstance !== Infinity ? (instances * globalMaxSlotsPerInstance) : Infinity; });

                // Run allocator phase internally (using setTimeout to prevent blocking)
                setTimeout(() => {
                     try {
                         // **** CALL TO this file (ui-controller.js) ****
                        const strategyResultsForCombo = runAllocatorPhaseInternal();
                        globalCombinationStrategyResultsCache[comboString] = strategyResultsForCombo; // Cache the full results
                         // **** CALL TO this file (ui-controller.js) ****
                        let bestResultForCombo = findBestResultFromStrategyList(strategyResultsForCombo);
                        combinationPerformance.push({ combination: currentCombo, bestResult: bestResultForCombo });
                     } catch (allocError) {
                         console.error(`Error running allocator for combo [${currentCombo.join(', ')}]:`, allocError);
                         combinationPerformance.push({
                             combination: currentCombo,
                             bestResult: { // Placeholder for error
                                strategyName: "Erro Alocador", maxVariation: Infinity, avgVariation: Infinity, meetsLimit: false, hasAllocationError: true,
                                displayMaxVarStr: '<span class="error">Erro</span>', displayAvgVarStr: '<span class="error">Erro</span>', displayOutcomeStr: '<span class="error">Erro</span>', isDuplicateResult: false
                             }
                          });
                     }
                    combinationsProcessed++;
                    processNextCombination(); // Process the next one recursively
                }, 5); // Small delay between processing each combination

            }

            processNextCombination(); // Start processing the first combination

        } catch (combinationError) {
            console.error(`Erro durante Geração/Processamento da Combinação (Modo: ${mode}):`, combinationError);
            if (finderStatusDisplay) finderStatusDisplay.innerHTML = `<span class="error">Ocorreu um erro inesperado durante o processamento. Verifique o console.</span>`; // Update status
            if (finderResultsLogDiv) finderResultsLogDiv.innerHTML += `\n<span class="error">Ocorreu um erro inesperado: ${combinationError.message}</span>`; // Add to log
             if (combinationSummaryTitle) combinationSummaryTitle.style.display = 'block';
            if (combinationSummaryTableDiv) combinationSummaryTableDiv.innerHTML = `<span class="error">Erro no processo (Modo: ${mode}). Verifique o console.</span>`;
             // SHOW the toggle button even on error, so the user can see the log
             if (toggleLogBtn) toggleLogBtn.style.display = 'inline-flex';
             if (finderResultsLogDiv) finderResultsLogDiv.classList.remove('log-hidden'); // Show log on error
        }
    }, 10); // End setTimeout for Combination Generation

} // Fim initiateProcess

// --- NEW: Toggle Function for Finder Log ---
function toggleFinderLog() {
    const logDiv = document.getElementById('finderResultsLog');
    const button = document.getElementById('toggleLogBtn');
    // Only toggle if the button is actually visible
    if (logDiv && button && button.style.display !== 'none') {
        const isHidden = logDiv.classList.toggle('log-hidden');
        button.textContent = isHidden ? 'Mostrar Log Detalhado' : 'Ocultar Log Detalhado';
    } else {
        console.warn("Cannot toggle finder log: elements not found or process not run yet.");
    }
}

// --- NEW: Helper to find the best result within a list of strategy results ---
// Prioritizes results: Non-error, Meets Limit, Non-duplicate -> Non-error, Non-duplicate -> Non-error -> Non-duplicate -> First result
function findBestResultFromStrategyList(strategyResults) {
    if (!strategyResults || strategyResults.length === 0) {
        // Return a default error-like structure if no results
        return { strategyName: "Nenhum Resultado", maxVariation: Infinity, avgVariation: Infinity, meetsLimit: false, hasAllocationError: true, displayMaxVarStr: 'N/A', displayAvgVarStr: 'N/A', displayOutcomeStr: '<span class="error">Erro</span>', isDuplicateResult: false };
    }

    // Candidates are already sorted by variation by runAllocatorPhaseInternal

    // Prefer non-error, meets limit, non-duplicate
    let candidates = strategyResults.filter(r => !r.hasAllocationError && r.meetsLimit && !r.isDuplicateResult);
    if (candidates.length > 0) return candidates[0];

    // Prefer non-error, non-duplicate (even if high variation)
    candidates = strategyResults.filter(r => !r.hasAllocationError && !r.isDuplicateResult);
    if (candidates.length > 0) return candidates[0];

    // Prefer non-error (even if duplicate)
    candidates = strategyResults.filter(r => !r.hasAllocationError);
     if (candidates.length > 0) return candidates[0];

     // Prefer non-duplicate (even if error)
     candidates = strategyResults.filter(r => !r.isDuplicateResult);
     if (candidates.length > 0) return candidates[0];

    // Otherwise, return the first one (which will likely be the best error or duplicate based on initial sort)
    return strategyResults[0];
}


// --- NEW: Function to display the combination summary table ---
function displayCombinationSummary(combinationPerformance) {
    const summaryTitle = document.getElementById('combinationSummaryTitle');
    const summaryTableDiv = document.getElementById('combinationSummaryTableDiv');

    if (!combinationPerformance || combinationPerformance.length === 0) {
        if (summaryTitle) summaryTitle.style.display = 'block';
        if (summaryTableDiv) summaryTableDiv.innerHTML = "Nenhuma combinação para exibir.";
        return;
    }

    // Sort combinations by best average variation, then max variation, prioritizing non-errors
    combinationPerformance.sort((a, b) => {
        const resA = a.bestResult;
        const resB = b.bestResult;
        // Prioritize non-errors first
        if (resA.hasAllocationError && !resB.hasAllocationError) return 1;
        if (!resA.hasAllocationError && resB.hasAllocationError) return -1;
        // Then by average variation (handle potential Infinity)
        const avgDiff = (resA.avgVariation ?? Infinity) - (resB.avgVariation ?? Infinity);
        if (avgDiff !== 0) return avgDiff;
        // Then by max variation (handle potential Infinity)
        const maxDiff = (resA.maxVariation ?? Infinity) - (resB.maxVariation ?? Infinity);
         if (maxDiff !== 0) return maxDiff;
         // Finally, keep stable sort or sort by strategy name? Optional.
         return 0;
    });

    let html = `<div class="comparison-title">--- Resumo do Desempenho por Combinação ---</div>`;
    html += `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: -0.5rem; margin-bottom: 0.5rem;">Clique em uma combinação para ver a análise detalhada das estratégias.</p>`;
    html += `<table id="combinationSummaryTable"><thead><tr><th>#</th><th>Combinação de Planos</th><th>Melhor Var Máx</th><th>Melhor Var Média</th><th>Melhor Estratégia</th><th>Resultado</th></tr></thead><tbody>`;

    combinationPerformance.forEach((perf, index) => {
        const combo = perf.combination;
        const res = perf.bestResult;
        const comboStr = JSON.stringify(combo); // For click handler

        // Use pre-calculated display strings if available, otherwise format them
        const maxVarStr = res.displayMaxVarStr || (res.hasAllocationError ? '<span class="error">Erro</span>' : (res.maxVariation === Infinity ? '<span class="violation">Infinita</span>' : (res.maxVariation * 100).toFixed(1) + '%'));
        const avgVarStr = res.displayAvgVarStr || (res.hasAllocationError ? '<span class="error">Erro</span>' : (res.avgVariation === Infinity ? '<span class="violation">Infinita</span>' : (res.avgVariation * 100).toFixed(1) + '%'));
        let outcomeStr = res.displayOutcomeStr || '';
        if (!outcomeStr) { // Recalculate outcome string if missing
             if (res.hasAllocationError) { outcomeStr = `<span class="error">Erro</span>`; }
             else if (res.meetsLimit) { outcomeStr = `<span class="success">Sucesso</span>`; }
             else { outcomeStr = `<span class="warning">Var Alta</span>`; }
        }
        // Add warning/violation class to variation numbers if applicable and not already in string
        let maxVarClass = '';
        if (!res.hasAllocationError && !res.displayMaxVarStr?.includes('<span')) {
             // Uses global REPROCESS_VARIATION_LIMIT from utils.js
             if (res.maxVariation > REPROCESS_VARIATION_LIMIT) {
                 maxVarClass = res.maxVariation === Infinity ? 'violation' : 'warning';
            }
        }

        // **** CALL TO this file (ui-controller.js) **** onclick
        html += `<tr onclick="displayResultsForCombination('${encodeURIComponent(comboStr)}', this)">
                    <td>${index + 1}</td>
                    <td class="combo-cell">[${combo.join(', ')}]</td>
                    <td class="${maxVarClass}">${maxVarStr}</td>
                    <td>${avgVarStr}</td>
                    <td>${res.strategyName || 'N/A'}</td>
                    <td>${outcomeStr}</td>
                 </tr>`;
    });

    html += `</tbody></table>`;
    if (summaryTitle) summaryTitle.style.display = 'block'; // Show title
    if (summaryTableDiv) summaryTableDiv.innerHTML = html;
}

// --- NEW: Click Handler for Combination Summary Table Row ---
function displayResultsForCombination(encodedComboString, clickedRow) {
    const comboString = decodeURIComponent(encodedComboString);
    console.log(`Displaying results for combination: ${comboString}`);

    // --- Highlight clicked row ---
    const table = document.getElementById('combinationSummaryTable');
    if (table) {
        const tBody = table.getElementsByTagName('tbody')[0];
        if(tBody){
             const rows = tBody.rows;
            for (let row of rows) {
                row.classList.remove('selected-combination');
            }
        }
    }
     if (clickedRow) { clickedRow.classList.add('selected-combination'); }


    // --- Retrieve cached results ---
    const cachedResults = globalCombinationStrategyResultsCache[comboString];
    const statusAreaDiv = document.getElementById('statusArea'); // Get status div early for error reporting

    if (!cachedResults) {
        console.error("Error: Cached strategy results not found for combo:", comboString);
        if (statusAreaDiv) {
             statusAreaDiv.innerHTML = `<span class="error">Erro interno: Resultados da estratégia em cache não encontrados para esta combinação.</span>`;
             statusAreaDiv.style.display = 'block';
        }
        // Clear other sections
        document.getElementById('strategyComparison').innerHTML = ''; document.getElementById('strategyComparison').style.display = 'none';
        document.getElementById('allocationResults').innerHTML = ''; document.getElementById('allocationResults').style.display = 'none';
        document.getElementById('adjustmentLog').innerHTML = ''; document.getElementById('adjustmentLog').style.display = 'none';
        document.getElementById('variationLog').innerHTML = ''; document.getElementById('variationLog').style.display = 'none';
        document.getElementById('cumulativeUsage').innerHTML = ''; document.getElementById('cumulativeUsage').style.display = 'none';
        document.getElementById('refinementLog').innerHTML = ''; document.getElementById('refinementLog').style.display = 'none';
        document.getElementById('lpdBreakdown').innerHTML = ''; document.getElementById('lpdBreakdown').style.display = 'none';
        document.getElementById('finalSummaryTableDiv').innerHTML = ''; document.getElementById('finalSummaryTableDiv').style.display = 'none';
        document.getElementById('detailsTitle').style.display = 'none';
        document.getElementById('allocatorTitle').style.display = 'none';
        document.getElementById('detailsSeparator').style.display = 'none';
        return;
    }

    // --- Set global results for display functions ---
    globalStrategyResults = cachedResults; // Use the cached full list for the selected combo
    // Set other globals based on the selected combination (uses globals from utils.js)
     try {
        const selectedCombo = JSON.parse(comboString);
        globalUserLpdCombinationWithDuplicates = selectedCombo;
        globalUniqueLpdValues = [...new Set(selectedCombo)].filter(lpd => typeof lpd === 'number' && !isNaN(lpd)).sort((a, b) => a - b);
        globalLpdInstanceCounts = {}; selectedCombo.forEach(lpd => { if (typeof lpd === 'number' && !isNaN(lpd)) { globalLpdInstanceCounts[lpd] = (globalLpdInstanceCounts[lpd] || 0) + 1; }});
        globalInitialTotalSlotsPerValue = {}; globalUniqueLpdValues.forEach(lpd => { const instances = globalLpdInstanceCounts[lpd] || 0; globalInitialTotalSlotsPerValue[lpd] = globalMaxSlotsPerInstance !== Infinity ? (instances * globalMaxSlotsPerInstance) : Infinity; });
     } catch (e) {
         console.error("Error parsing selected combination string:", comboString, e);
         // Handle error gracefully, maybe show an error message and return
         if (statusAreaDiv) {
              statusAreaDiv.innerHTML = `<span class="error">Erro interno ao processar a combinação selecionada.</span>`;
              statusAreaDiv.style.display = 'block';
         }
         return;
     }


    // --- Show and Populate Standard Result Sections ---
    const strategyComparisonDiv = document.getElementById('strategyComparison');
    const detailsTitleH2 = document.getElementById('detailsTitle');
    const allocatorTitleH2 = document.getElementById('allocatorTitle');
    const detailsSeparatorHr = document.getElementById('detailsSeparator');
    const allocationResultsDiv = document.getElementById('allocationResults');
    const adjustmentLogDiv = document.getElementById('adjustmentLog');
    const variationLogDiv = document.getElementById('variationLog');
    const cumulativeUsageDiv = document.getElementById('cumulativeUsage');
    const refinementLogDiv = document.getElementById('refinementLog');
    const lpdBreakdownDiv = document.getElementById('lpdBreakdown');
    const finalSummaryTableDiv = document.getElementById('finalSummaryTableDiv');


     // Make sections visible
     if (allocatorTitleH2) allocatorTitleH2.style.display = 'block';
     if (statusAreaDiv) statusAreaDiv.style.display = 'block'; // Ensure status is visible
     if (strategyComparisonDiv) strategyComparisonDiv.style.display = 'block';
     if (detailsSeparatorHr) detailsSeparatorHr.style.display = 'block';
     if (detailsTitleH2) detailsTitleH2.style.display = 'block';
     if (allocationResultsDiv) allocationResultsDiv.style.display = 'block';
     if (adjustmentLogDiv) adjustmentLogDiv.style.display = 'block';
     if (variationLogDiv) variationLogDiv.style.display = 'block';
     if (cumulativeUsageDiv) cumulativeUsageDiv.style.display = 'block';
     if (refinementLogDiv) refinementLogDiv.style.display = 'block';
     if (lpdBreakdownDiv) lpdBreakdownDiv.style.display = 'block';
     if (finalSummaryTableDiv) finalSummaryTableDiv.style.display = 'block';

    // --- Generate Strategy Comparison Table (like in original runAllocatorPhase) ---
    let comparisonHTML = `<div class="comparison-title">--- Resumo da Comparação de Estratégias (Combinação: [${globalUserLpdCombinationWithDuplicates.join(', ')}]) ---</div>`;
    comparisonHTML += `<div id="comparisonTableContainer" class="comparison-table-container hide-errors hide-duplicates">`; // Add container & classes
    comparisonHTML += `<table id="comparisonTable"><thead><tr><th>Estratégia</th><th>Var Máx (%)</th><th>Var Média (%)</th><th>Resultado</th></tr></thead><tbody>`;
    let errorCount = 0; let finalDuplicateCount = 0; // Renamed from duplicateCount
    if (globalStrategyResults && globalStrategyResults.length > 0) {
         // **** CALL TO this file (ui-controller.js) **** - Finds default to highlight
         const defaultStrategyToShow = findBestResultFromStrategyList(globalStrategyResults);

        globalStrategyResults.forEach((res, index) => {
             // Retrieve pre-calculated or REFINED display strings/metrics
             const maxVarStr = res.displayMaxVarStr || '?';
             const avgVarStr = res.displayAvgVarStr || '?';
             let outcomeStr = res.displayOutcomeStr || ''; // Use pre-calculated if available
             if (!outcomeStr) { // Recalculate if needed
                  if (res.hasAllocationError) { outcomeStr = `<span class="error">Erro</span>`; }
                  else if (res.meetsLimit) { outcomeStr = `<span class="success">Sucesso</span>`; }
                  else { outcomeStr = `<span class="warning">Var Alta</span>`; }
             }

            let rowClass = '';
            if (res.hasAllocationError) { rowClass = 'strategy-error-row'; errorCount++; }
            if (res.isDuplicateResult) { rowClass += ' strategy-duplicate-row'; finalDuplicateCount++; }

            // Check if this is the default strategy to highlight
            const isSelectedStrategy = defaultStrategyToShow && res.strategyName === defaultStrategyToShow.strategyName;

            if (isSelectedStrategy) rowClass += ' best-effort'; // Highlight the best one found

            // **** CALL TO this file (ui-controller.js) **** onclick
            comparisonHTML += `<tr class="${rowClass.trim()}"><td class="strategy-name" onclick="displayStrategyDetails('${encodeURIComponent(res.strategyName)}')">${res.strategyName} ${isSelectedStrategy ? '(Padrão)' : ''}</td><td>${maxVarStr}</td><td>${avgVarStr}</td><td>${outcomeStr}</td></tr>`;
        });
    } else {
        comparisonHTML += '<tr><td colspan="4">Nenhum resultado de estratégia para exibir para esta combinação.</td></tr>';
    }
    comparisonHTML += `</tbody></table></div>`; // Close table and container

    // Add toggle buttons
    comparisonHTML += `<div class="toggle-buttons-container" style="margin-top: 0.5rem;">`;
    if (errorCount > 0) { comparisonHTML += `<button id="toggleErrorsBtn" onclick="toggleErrorStrategies()">Mostrar ${errorCount} Estrat. c/ Erro...</button>`; }
    if (finalDuplicateCount > 0) { comparisonHTML += `<button id="toggleDuplicatesBtn" onclick="toggleDuplicateStrategies()" class="secondary">Mostrar ${finalDuplicateCount} Estrat. c/ Resultados Idênticos...</button>`; }
    comparisonHTML += `</div>`;

    if (strategyComparisonDiv) strategyComparisonDiv.innerHTML = comparisonHTML;

    // --- Display details of the default best strategy for this combination ---
     // **** CALL TO this file (ui-controller.js) **** - Finds default again
     const defaultStrategyToShow = findBestResultFromStrategyList(globalStrategyResults);

    if (defaultStrategyToShow) {
         // Always attempt to display details, even if there's an error, so user can see logs
        if (statusAreaDiv) statusAreaDiv.innerHTML = `Exibindo resultados para a combinação: <span class="info">[${globalUserLpdCombinationWithDuplicates.join(', ')}]</span>. Estratégia Padrão: <span class="info">${defaultStrategyToShow.strategyName}</span>${defaultStrategyToShow.hasAllocationError ? ' <span class="error">(Contém Erro)</span>': ''}.`;
        console.log(`Calling displayStrategyDetails for default: ${defaultStrategyToShow.strategyName}`);
        // **** CALL TO this file (ui-controller.js) ****
        displayStrategyDetails(encodeURIComponent(defaultStrategyToShow.strategyName)); // Display its details
    } else {
        // This case should be rare if globalStrategyResults is not empty
        if (statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Nenhum resultado de estratégia padrão encontrado para a combinação: [${globalUserLpdCombinationWithDuplicates.join(', ')}]</span>`;
        // Clear detail sections
        if(allocationResultsDiv) allocationResultsDiv.innerHTML = 'Nenhum detalhe para exibir.';
        if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = ''; if(variationLogDiv) variationLogDiv.innerHTML = '';
        if(cumulativeUsageDiv) cumulativeUsageDiv.innerHTML = ''; if(lpdBreakdownDiv) lpdBreakdownDiv.innerHTML = '';
        if(finalSummaryTableDiv) finalSummaryTableDiv.innerHTML = ''; if(refinementLogDiv) refinementLogDiv.innerHTML = '';
        if(detailsTitleH2) detailsTitleH2.innerHTML = 'Resultados Detalhados da Alocação';
    }
}


// --- REFACTOR: Internal Allocator Runner ---
// This function now assumes globals (like globalUserLpdCombinationWithDuplicates, globalOriginalItems) are SET correctly before calling it.
// It performs the strategy runs and returns the sorted results, WITHOUT displaying anything.
function runAllocatorPhaseInternal() {
    console.log("[runAllocatorPhaseInternal] START");
    // --- Uses Globals ---
    // globalOriginalItems, globalUserLpdCombinationWithDuplicates,
    // globalUniqueLpdValues, globalInitialTotalSlotsPerValue, globalMaxSlotsPerInstance
    // REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 (from utils.js)
    // ---------------------

    // Minimal Validation checks (essential ones)
    if (!globalOriginalItems || globalOriginalItems.length === 0) {
        console.error("[runAllocatorPhaseInternal] Validation failed: globalOriginalItems missing.");
        return []; // Return empty array on critical failure
    }
    if (!globalUserLpdCombinationWithDuplicates) {
        console.warn("[runAllocatorPhaseInternal] globalUserLpdCombinationWithDuplicates undefined, initializing.");
        globalUserLpdCombinationWithDuplicates = [];
    }
    // Ensure necessary globals are arrays/objects even if empty
    if (!globalUniqueLpdValues) globalUniqueLpdValues = [];
    if (!globalInitialTotalSlotsPerValue) globalInitialTotalSlotsPerValue = {};


    // --- Pre-calculate values needed for new heuristics ---
    console.log("[runAllocatorPhaseInternal] Pre-calculating heuristic values...");
    let averageLPDValue = 0;
    let smallestPositiveLPD = Infinity;
    let potentialDifferences = new Map();
    if (globalUserLpdCombinationWithDuplicates && globalUserLpdCombinationWithDuplicates.length > 0) {
        let sumLPDs = 0;
        let positiveLPDs = [];
        globalUserLpdCombinationWithDuplicates.forEach(lpd => {
             if (typeof lpd === 'number' && !isNaN(lpd)) {
                 sumLPDs += lpd;
                 if (lpd > 0) {
                     positiveLPDs.push(lpd);
                     if (lpd < smallestPositiveLPD) smallestPositiveLPD = lpd;
                 }
            } else { console.warn("[runAllocatorPhaseInternal] Non-numeric LPD found in combination:", lpd); }
        });
        if (globalUserLpdCombinationWithDuplicates.length > 0) { averageLPDValue = sumLPDs / globalUserLpdCombinationWithDuplicates.length; }
        if (smallestPositiveLPD === Infinity) smallestPositiveLPD = 0; // Handle case with no positive LPDs

        // Calculate potential differences
        console.log("[runAllocatorPhaseInternal] Calculating potential differences...");
        const initialSlotsCopy = { ...globalInitialTotalSlotsPerValue };
        if (globalOriginalItems && Array.isArray(globalOriginalItems)) {
            globalOriginalItems.forEach(item => {
                 if (!item || typeof item.originalIndex === 'undefined') { console.warn("[runAllocatorPhaseInternal] Skipping invalid item during potential difference calculation:", item); return; }
                 if (!globalUniqueLpdValues || globalUniqueLpdValues.length === 0) {
                      potentialDifferences.set(item.originalIndex, { potentialDiff: Math.abs(item.amount || 0), preliminarySum: 0, prelimError: "No LPDs" }); return;
                 }
                 // **** CALL TO utils.js ****
                 const prelimResult = findClosestSumWithRepetitionAndSlots(globalUniqueLpdValues, item.amount, initialSlotsCopy);
                 potentialDifferences.set(item.originalIndex, { potentialDiff: Math.abs(prelimResult.difference === undefined ? (item.amount || 0) : prelimResult.difference), preliminarySum: prelimResult.sum, prelimError: prelimResult.error });
             });
             console.log("[runAllocatorPhaseInternal] Potential differences calculation loop finished.");
         } else { console.error("[runAllocatorPhaseInternal] globalOriginalItems is not a valid array for potential difference calculation."); }
         // console.log("[runAllocatorPhaseInternal] Potential differences map:", potentialDifferences); // Can be verbose

    } else {
        console.warn("[runAllocatorPhaseInternal] No LPD combination available for heuristic pre-calculation.");
        smallestPositiveLPD = 0;
    }
     console.log(`[runAllocatorPhaseInternal] Pre-calculation complete. AvgLPD: ${averageLPDValue.toFixed(2)}, Smallest+LPD: ${smallestPositiveLPD}`);
    // --- End Pre-calculation ---


     // --- Strategy Definitions --- (Includes NEW Heuristics)
     // (These use the pre-calculated values: potentialDifferences, averageLPDValue, smallestPositiveLPD
     // and globals like globalUniqueLpdValues, globalInitialTotalSlotsPerValue)
     const strategies = [
         // Existing Strategies
         { name: "Ordem Original de Entrada", sortFn: (items) => [...items] },
         { name: "Quantidade Ascendente", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount) },
         { name: "Quantidade Descendente", sortFn: (items) => [...items].sort((a, b) => b.amount - a.amount) },
         { name: "Especificação Ascendente (A-Z)", sortFn: (items) => [...items].sort((a, b) => (a.details || '').localeCompare(b.details || '')) },
         { name: "Especificação Descendente (Z-A)", sortFn: (items) => [...items].sort((a, b) => (b.details || '').localeCompare(a.details || '')) },
         { name: "Quantidade Meio-para-Fora (Baixo/Cima)", sortFn: (items) => { const s = [...items].sort((a, b) => a.amount - b.amount), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (l >= 0) r.push(s[l--]); if (g < n) r.push(s[g++]); } return r; }},
         { name: "Quantidade Meio-para-Fora (Cima/Baixo)", sortFn: (items) => { const s = [...items].sort((a, b) => a.amount - b.amount), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (g < n) r.push(s[g++]); if (l >= 0) r.push(s[l--]); } return r; }},
         { name: "Especificação Meio-para-Fora (Baixo/Cima)", sortFn: (items) => { const s = [...items].sort((a,b)=>(a.details || '').localeCompare(b.details || '')), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (l >= 0) r.push(s[l--]); if (g < n) r.push(s[g++]); } return r; }},
         { name: "Especificação Meio-para-Fora (Cima/Baixo)", sortFn: (items) => { const s = [...items].sort((a,b)=>(a.details || '').localeCompare(b.details || '')), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (g < n) r.push(s[g++]); if (l >= 0) r.push(s[l--]); } return r; }},
         { name: "Quantidade Fora-para-Dentro (Intercalado)", sortFn: (items) => { const s = [...items].sort((a,b)=>a.amount - b.amount), r = []; let l = 0, g = s.length - 1; while(l <= g) { r.push(s[l++]); if (l <= g) { r.push(s[g--]); } } return r; }},
         { name: "Especificação Fora-para-Dentro (Intercalado)", sortFn: (items) => { const s = [...items].sort((a,b)=>(a.details || '').localeCompare(b.details || '')), r = []; let l = 0, g = s.length - 1; while(l <= g) { r.push(s[l++]); if (l <= g) { r.push(s[g--]); } } return r; }},
         { name: "Qtd Asc, Especificação Asc (Desempate)", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount || (a.details || '').localeCompare(b.details || '')) },
         { name: "Qtd Asc, Índice Asc (Desempate)", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount || a.originalIndex - b.originalIndex) },
         { name: "Qtd Asc, Índice Desc (Desempate)", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount || b.originalIndex - a.originalIndex) },
         { name: "Qtd Desc, Índice Asc (Desempate)", sortFn: (items) => [...items].sort((a, b) => b.amount - a.amount || a.originalIndex - b.originalIndex) },
         { name: "Qtd Desc, Índice Desc (Desempate)", sortFn: (items) => [...items].sort((a, b) => b.amount - a.amount || b.originalIndex - a.originalIndex) },
         { name: "Quantidade por Último Dígito", sortFn: (items) => [...items].sort((a, b) => (a.amount % 10) - (b.amount % 10) || a.amount - b.amount) },
         { name: "Quantidade por Primeiro Dígito", sortFn: (items) => { const fd = (n) => {n=Math.abs(n); if(n===0) return 0; while(n>=10) n=Math.floor(n/10); return n;}; return [...items].sort((a, b) => fd(a.amount) - fd(b.amount) || a.amount - b.amount); }},
         { name: "Qtd Asc (Processa Terços P->G->M)", sortFn: (items) => { const s = [...items].sort((a,b)=>a.amount-b.amount), n=s.length, t=Math.ceil(n/3); return [...s.slice(0,t), ...s.slice(n-t), ...s.slice(t,n-t)]; }},
         { name: "Qtd Desc (Processa Terços G->P->M)", sortFn: (items) => { const s = [...items].sort((a,b)=>b.amount-a.amount), n=s.length, t=Math.ceil(n/3); return [...s.slice(0,t), ...s.slice(n-t), ...s.slice(t,n-t)]; }},
         { name: "Qtd Asc (Intercala por 3: 0,3.. 1,4.. 2,5..)", sortFn: (items) => { const s=[...items].sort((a,b)=>a.amount-b.amount), r=[], n=s.length; for(let k=0;k<3;k++) for(let i=k;i<n;i+=3) r.push(s[i]); return r; }},
         { name: "Qtd Desc (Intercala por 3: 0,3.. 1,4.. 2,5..)", sortFn: (items) => { const s=[...items].sort((a,b)=>b.amount-a.amount), r=[], n=s.length; for(let k=0;k<3;k++) for(let i=k;i<n;i+=3) r.push(s[i]); return r; }},
         { name: "Desvio da Média Qtd (Mais Próximo Primeiro)", sortFn: (items) => { if(items.length===0) return []; const avg = items.reduce((sum,i)=>sum+i.amount,0)/items.length; return [...items].sort((a,b)=>Math.abs(a.amount-avg)-Math.abs(b.amount-avg)); }},
         { name: "Desvio da Média Qtd (Mais Distante Primeiro)", sortFn: (items) => { if(items.length===0) return []; const avg = items.reduce((sum,i)=>sum+i.amount,0)/items.length; return [...items].sort((a,b)=>Math.abs(b.amount-avg)-Math.abs(a.amount-avg)); }},
         // --- NEW Heuristics ---
         { name: "Maior Dificuldade Potencial Primeiro", sortFn: (items) => [...items].sort((a, b) => { const diffB = (potentialDifferences.get(b.originalIndex) || { potentialDiff: 0 }).potentialDiff; const diffA = (potentialDifferences.get(a.originalIndex) || { potentialDiff: 0 }).potentialDiff; return diffB - diffA; }) },
         { name: "Menor Dificuldade Potencial Primeiro", sortFn: (items) => [...items].sort((a, b) => { const diffA = (potentialDifferences.get(a.originalIndex) || { potentialDiff: 0 }).potentialDiff; const diffB = (potentialDifferences.get(b.originalIndex) || { potentialDiff: 0 }).potentialDiff; return diffA - diffB; }) },
         { name: "Maior Demanda Estimada Primeiro (Avg LPD)", sortFn: (items) => [...items].sort((a, b) => { const demandB = averageLPDValue > 0 ? (b.amount / averageLPDValue) : (b.amount > 0 ? Infinity : 0); const demandA = averageLPDValue > 0 ? (a.amount / averageLPDValue) : (a.amount > 0 ? Infinity : 0); return demandB - demandA; }) },
         { name: "Menor Flexibilidade Primeiro (LPDs <= Alvo)", sortFn: (items) => [...items].sort((a, b) => { const countA = globalUniqueLpdValues.filter(lpd => lpd > 0 && lpd <= a.amount).length; const countB = globalUniqueLpdValues.filter(lpd => lpd > 0 && lpd <= b.amount).length; return countA - countB || a.amount - b.amount; }) }, // Uses global
         { name: "Maior Granularidade Necessária Primeiro (Alvo/MenorLPD)", sortFn: (items) => [...items].sort((a, b) => { const ratioB = smallestPositiveLPD > 0 ? (b.amount / smallestPositiveLPD) : (b.amount > 0 ? Infinity : 0); const ratioA = smallestPositiveLPD > 0 ? (a.amount / smallestPositiveLPD) : (a.amount > 0 ? Infinity : 0); return ratioB - ratioA || b.amount - a.amount; }) }, // Swapped ratioA/B and added tiebreaker
         { name: "Dependência LPD Crítico Mais Raro Primeiro", sortFn: (items) => {
              // Uses global globalUniqueLpdValues, globalInitialTotalSlotsPerValue
              const findCriticalLPD = (itemAmount) => { let maxFound = -1; for (const lpd of globalUniqueLpdValues) { if (lpd > 0 && lpd <= itemAmount && lpd > maxFound) { maxFound = lpd; } } return maxFound > 0 ? maxFound : 0; };
              return [...items].sort((a, b) => {
                  const criticalLPD_A = findCriticalLPD(a.amount); const criticalLPD_B = findCriticalLPD(b.amount);
                  const availabilityA = (criticalLPD_A > 0 && globalInitialTotalSlotsPerValue.hasOwnProperty(criticalLPD_A)) ? globalInitialTotalSlotsPerValue[criticalLPD_A] : Infinity;
                  const availabilityB = (criticalLPD_B > 0 && globalInitialTotalSlotsPerValue.hasOwnProperty(criticalLPD_B)) ? globalInitialTotalSlotsPerValue[criticalLPD_B] : Infinity;
                   // Sort by availability ascending (rarer first)
                   if (availabilityA === Infinity && availabilityB !== Infinity) return 1;
                   if (availabilityA !== Infinity && availabilityB === Infinity) return -1;
                   if (availabilityA !== Infinity && availabilityB !== Infinity) {
                       const availabilityDiff = availabilityA - availabilityB;
                       if (availabilityDiff !== 0) return availabilityDiff;
                   }
                   // Tie-breaker: Larger amount first (potentially harder to fit)
                   const amountDiff = b.amount - a.amount; if (amountDiff !== 0) return amountDiff;
                   // Final tie-breaker: Original index
                   return a.originalIndex - b.originalIndex;
              }); }
         }
     ];
     if (!strategies || strategies.length === 0) { console.error("[runAllocatorPhaseInternal] No strategies defined!"); return []; }

    let localStrategyResults = [];
    console.log(`[runAllocatorPhaseInternal] Processing ${strategies.length} strategies for combo [${globalUserLpdCombinationWithDuplicates.join(', ')}]`);

    // --- Step 1: Run strategies ---
    for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        // console.log(`[runAllocatorPhaseInternal] Running Strategy [${i+1}/${strategies.length}] ${strategy.name}`); // Can be verbose
        let currentItemsOrdered;
        try {
             // Ensure items are deeply cloned and index added
             currentItemsOrdered = strategy.sortFn(JSON.parse(JSON.stringify(globalOriginalItems))).map((item, idx) => ({ ...item, index: idx }));
        }
        catch (sortError) {
            console.error(`[runAllocatorPhaseInternal] [${i}] ERROR during sortFn for ${strategy.name}:`, sortError);
            localStrategyResults.push({ strategyName: strategy.name, hasAllocationError: true, resultData: { error: `Sort Error: ${sortError.message}` }, maxVariation: Infinity, avgVariation: Infinity, meetsLimit: false, planAssemblyDataForExport: null, displayMaxVarStr: '', displayAvgVarStr: '', displayOutcomeStr: `<span class="error">Sort Error</span>`, isDuplicateResult: false });
            continue; // Skip to next strategy
        }

        let result;
        try {
             // **** CALL TO processing-logic.js ****
             result = runAllocationProcess(currentItemsOrdered, [...globalUserLpdCombinationWithDuplicates], globalMaxSlotsPerInstance);
             if (!result) console.warn(`[runAllocatorPhaseInternal] [${i}] runAllocationProcess returned null/undefined.`);
         } catch (allocError) {
             console.error(`[runAllocatorPhaseInternal] [${i}] ERROR during runAllocationProcess for ${strategy.name}:`, allocError);
             result = { error: `Allocation Error: ${allocError.message}`, itemAllocations: null };
         }

        // --- Error checks, Metric Calculation, Assembly Data Gen ---
        let hasAllocationError = false; let firstErrorMessage = "";
         if (!result || !result.itemAllocations) {
             hasAllocationError = true;
             firstErrorMessage = result ? (result.error || "Item allocations missing.") : "Allocation result missing.";
         } else {
            // Check individual allocations for errors or zero sum issues
            for(let itemAllocIdx = 0; itemAllocIdx < result.itemAllocations.length; itemAllocIdx++) {
                const alloc = result.itemAllocations[itemAllocIdx];
                const item = currentItemsOrdered[itemAllocIdx]; // Get corresponding item
                if (!alloc) { hasAllocationError = true; firstErrorMessage = "Objeto aloc ausente"; break; }
                if (alloc.error) { hasAllocationError = true; if (!firstErrorMessage) firstErrorMessage = alloc.error; }
                 // Check for DP failure specifically (Target > 0 but Sum = 0)
                 if (!alloc.error && item && item.amount > 0 && alloc.sum === 0 && alloc.combination && alloc.combination.length === 0) {
                    hasAllocationError = true;
                    const zeroSumError = "Soma 0 para alvo > 0 (Falha DP?)";
                    alloc.error = zeroSumError; // Add error message to the allocation object
                    if (!firstErrorMessage) firstErrorMessage = zeroSumError;
                 }
            }
         }
         // If loop finished without finding specific error, but result object had one
         if (!hasAllocationError && result && result.error && !firstErrorMessage) {
            hasAllocationError = true;
            firstErrorMessage = result.error;
         }
         if (hasAllocationError) console.warn(`[runAllocatorPhaseInternal] [${i}] Allocation error detected for ${strategy.name}. First: "${firstErrorMessage}"`);


        let maxVariation = Infinity, avgVariation = Infinity;
        // Uses global REPROCESS_VARIATION_LIMIT from utils.js
        if (!hasAllocationError && result && result.itemAllocations){
            try {
                // **** CALLS TO utils.js ****
                maxVariation = calculateMaxVariation(currentItemsOrdered, result.itemAllocations);
                avgVariation = calculateAverageVariation(currentItemsOrdered, result.itemAllocations);
            } catch (metricError){
                console.error(`[runAllocatorPhaseInternal] [${i}] Error calculating metrics for ${strategy.name}:`, metricError);
                hasAllocationError = true; if (!firstErrorMessage) firstErrorMessage = `Metric Calc Error: ${metricError.message}`;
                maxVariation = Infinity; avgVariation = Infinity;
            }
        }
        const meetsLimit = !hasAllocationError && maxVariation <= REPROCESS_VARIATION_LIMIT;

        let planAssemblyData = null;
        if (!hasAllocationError && result && result.itemAllocations) {
            try {
                // **** CALL TO processing-logic.js ****
                planAssemblyData = generatePlanAssemblyData(currentItemsOrdered, result.itemAllocations, globalUserLpdCombinationWithDuplicates, globalMaxSlotsPerInstance);
            }
            catch (assemblyError) {
                console.error(`[runAllocatorPhaseInternal] [${i}] ERROR during generatePlanAssemblyData for ${strategy.name}:`, assemblyError);
                 if (!firstErrorMessage && !hasAllocationError) firstErrorMessage = `Assembly Gen Error: ${assemblyError.message}`;
                 // Don't necessarily mark as allocation error, but assembly might be null
            }
        }

        // Store the result
         const resultEntry = {
            strategyName: strategy.name, itemsUsed: currentItemsOrdered, resultData: result,
            maxVariation: maxVariation, avgVariation: avgVariation, meetsLimit: meetsLimit,
            hasAllocationError: hasAllocationError,
            planAssemblyDataForExport: planAssemblyData,
            displayMaxVarStr: '', displayAvgVarStr: '', displayOutcomeStr: '', // Populated later
            isDuplicateResult: false // Populated later
        };
        localStrategyResults.push(resultEntry);

    } // End strategy loop

    console.log("[runAllocatorPhaseInternal] Finished running strategies. Results count:", localStrategyResults.length);
    if(localStrategyResults.length !== strategies.length) { console.error(`[runAllocatorPhaseInternal] CRITICAL: Number of results (${localStrategyResults.length}) !== strategies (${strategies.length})!`); }


    // --- Step 2: Apply Refinement to the potentially best result *within this run* ---
    // Find the preliminary best result to refine for *this* combination's run
    // **** CALL TO this file (ui-controller.js) ****
    let preliminaryBestResult = findBestResultFromStrategyList(localStrategyResults); // Use helper

    let refinementLogContent = "Nenhum refinamento aplicado."; // Default log content for this run

    if (preliminaryBestResult && !preliminaryBestResult.hasAllocationError) {
        console.log(`[runAllocatorPhaseInternal] Applying refinement to preliminary best: ${preliminaryBestResult.strategyName}`);
        try {
            // Refinement needs the full resultEntry structure
            const resultToRefineCopy = JSON.parse(JSON.stringify(preliminaryBestResult));
            // **** CALL TO processing-logic.js ****
            const refinementOutcome = refineAllocationResult(resultToRefineCopy);

             if (refinementOutcome && refinementOutcome.refinedResultEntry) {
                const indexToUpdate = localStrategyResults.findIndex(r => r.strategyName === preliminaryBestResult.strategyName);
                if (indexToUpdate !== -1) {
                    // Update the entry in localStrategyResults with the refined one
                    localStrategyResults[indexToUpdate] = refinementOutcome.refinedResultEntry;
                     // Store the refinement log with the result entry
                     localStrategyResults[indexToUpdate].refinementLog = refinementOutcome.log;
                     refinementLogContent = refinementOutcome.log; // Capture log for console
                    console.log(`[runAllocatorPhaseInternal] Updated local results with refined data for index ${indexToUpdate}.`);
                } else {
                    console.error(`[runAllocatorPhaseInternal] Could not find strategy ${preliminaryBestResult.strategyName} to update after refinement!`);
                    refinementLogContent = "<span class='error'>Erro: Falha ao atualizar estratégia pós-refinamento.</span>";
                }
            } else {
                 console.error(`[runAllocatorPhaseInternal] Refinement function returned invalid outcome.`);
                 refinementLogContent = "<span class='error'>Erro: Função de refinamento falhou.</span>";
            }
        } catch (refinementError) {
             console.error(`[runAllocatorPhaseInternal] Error during refinement call:`, refinementError);
             refinementLogContent = `<span class='error'>Erro durante refinamento: ${refinementError.message}</span>`;
        }
    } else if (preliminaryBestResult) {
         console.log(`[runAllocatorPhaseInternal] Skipping refinement for preliminary best (${preliminaryBestResult.strategyName}) due to initial error.`);
         refinementLogContent = `Refinamento não aplicado (estratégia ${preliminaryBestResult.strategyName} com erro inicial).`;
         // Attach log to the result entry anyway
         const indexToUpdate = localStrategyResults.findIndex(r => r.strategyName === preliminaryBestResult.strategyName);
         if (indexToUpdate !== -1) { localStrategyResults[indexToUpdate].refinementLog = refinementLogContent; }

    } else {
        console.log(`[runAllocatorPhaseInternal] Skipping refinement (no preliminary result found).`);
    }
    console.log(`[runAllocatorPhaseInternal] Refinement outcome log snippet: ${refinementLogContent.substring(0, 150)}...`);
    // --- End Refinement ---


    // --- Step 3: Sort results --- (Sort by avg variation, then max variation, handle Infinity)
    console.log("[runAllocatorPhaseInternal] Sorting results...");
    const successResults = [], highVarResults = [], errorResults = [];
    localStrategyResults.forEach(res => {
         if (res.hasAllocationError) errorResults.push(res);
         else if (res.meetsLimit) successResults.push(res);
         else highVarResults.push(res);
    });
    // Sort function prioritizing lower average, then lower max variation
    const sortByAvgVar = (a, b) => {
        const avgA = a.avgVariation ?? Infinity; // Treat null/undefined as Infinity
        const avgB = b.avgVariation ?? Infinity;
        if (avgA !== avgB) return avgA - avgB;
        const maxA = a.maxVariation ?? Infinity;
        const maxB = b.maxVariation ?? Infinity;
        return maxA - maxB;
    };
    successResults.sort(sortByAvgVar);
    highVarResults.sort(sortByAvgVar);
    errorResults.sort(sortByAvgVar); // Sort errors too for consistency if needed
    const sortedResults = [...successResults, ...highVarResults, ...errorResults];
    console.log("[runAllocatorPhaseInternal] Sorting complete. Sorted count:", sortedResults.length);

     // --- Step 4: Identify Duplicates & Pre-calculate Display Strings ---
     console.log("[runAllocatorPhaseInternal] Identifying duplicates and calculating display strings...");
     const encounteredAssemblies = new Set();
     const encounteredDisplaySummaries = new Set();
     let duplicateCount = 0;
     // Uses global REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 from utils.js
     sortedResults.forEach((res, index) => {
         try {
             // Pre-calculate display strings (Max/Avg/Outcome) - Ensure this runs AFTER refinement
             if (res.hasAllocationError) {
                 res.displayOutcomeStr = `<span class="error">Erro</span>`;
                 res.displayMaxVarStr = '?'; res.displayAvgVarStr = '?';
             } else {
                 if (res.maxVariation === Infinity) { res.displayMaxVarStr = '<span class="violation">Infinita</span>'; }
                 else {
                      res.displayMaxVarStr = (res.maxVariation * 100).toFixed(1) + '%';
                      // Check against limits AFTER calculating the string
                      if (!res.meetsLimit) { // meetsLimit is also calculated/updated after refinement
                           res.displayMaxVarStr = `<span class="${res.maxVariation > REPROCESS_VARIATION_LIMIT ? 'violation' : 'warning'}">${res.displayMaxVarStr}</span>`;
                      }
                 }
                 res.displayAvgVarStr = (res.avgVariation * 100).toFixed(1) + '%';
                 // Determine outcome based on meetsLimit (calculated/updated post-refinement)
                 if (res.meetsLimit) { res.displayOutcomeStr = `<span class="success">Sucesso</span>`; }
                 else { res.displayOutcomeStr = `<span class="warning">Var Alta</span>`; }
             }
             const displaySummarySignature = `${res.displayMaxVarStr}-${res.displayAvgVarStr}-${res.displayOutcomeStr}`;
             const assemblyString = res.planAssemblyDataForExport ? JSON.stringify(res.planAssemblyDataForExport) : 'null_assembly';

             // Check for duplication based on *previous* encounters
             let isAssemblyDuplicate = false;
             if (assemblyString !== 'null_assembly') { isAssemblyDuplicate = encounteredAssemblies.has(assemblyString); }
             const isDisplaySummaryDuplicate = encounteredDisplaySummaries.has(displaySummarySignature);

             // Mark as duplicate if either the assembly OR the display summary matches a previous one
             if (isAssemblyDuplicate || isDisplaySummaryDuplicate) {
                 res.isDuplicateResult = true; duplicateCount++;
                 // console.log(`[${index}] Marking ${res.strategyName} as duplicate.`);
             } else { res.isDuplicateResult = false; }

             // Add the current signatures to the sets *after* checking.
             if (assemblyString !== 'null_assembly') { encounteredAssemblies.add(assemblyString); }
             encounteredDisplaySummaries.add(displaySummarySignature);

         } catch (duplicateCheckError) {
            console.error(`Error during duplicate check for strategy ${res.strategyName} (index ${index}):`, duplicateCheckError);
            res.isDuplicateResult = false; // Default to not duplicate on error
         }
     });
     console.log(`[runAllocatorPhaseInternal] Finished duplicate checks. Found ${duplicateCount} duplicates.`);

    // --- Step 5: Return the fully processed and sorted results ---
    console.log("[runAllocatorPhaseInternal] END. Returning sorted results.");
    return sortedResults;

} // Fim runAllocatorPhaseInternal


// --- FUNÇÕES DE EXIBIÇÃO DO ALOCADOR ---
// This function now displays the details for the strategy selected from the Strategy Comparison table
// It assumes globalStrategyResults and other relevant globals have been set by displayResultsForCombination
function displayStrategyDetails(encodedStrategyName) {
     const strategyName = decodeURIComponent(encodedStrategyName);
     globalCurrentlyDisplayedStrategyName = strategyName; // Set global (from utils.js)
     console.log(`[displayStrategyDetails] START for: ${strategyName}`);

     // Get references to DOM elements
     const statusAreaDiv = document.getElementById('statusArea'); // Used for status updates
     const detailsTitle = document.getElementById('detailsTitle');
     const allocationResultsDiv = document.getElementById('allocationResults');
     const adjustmentLogDiv = document.getElementById('adjustmentLog');
     const variationLogDiv = document.getElementById('variationLog');
     const cumulativeUsageDiv = document.getElementById('cumulativeUsage');
     const refinementLogDiv = document.getElementById('refinementLog'); // Refinement log display area
     const lpdBreakdownDiv = document.getElementById('lpdBreakdown');
     const finalSummaryTableDiv = document.getElementById('finalSummaryTableDiv');

     // Find the result data for the selected strategy FROM GLOBAL RESULTS (set by displayResultsForCombination)
     // Uses global globalStrategyResults from utils.js
     const selectedResult = globalStrategyResults && globalStrategyResults.find(res => res.strategyName === strategyName);
     console.log(`[displayStrategyDetails] Found selectedResult:`, selectedResult ? 'Yes' : 'No');


     // Reset UI elements for detail view
     if(allocationResultsDiv) allocationResultsDiv.innerHTML = 'Carregando detalhes...'; else console.warn("allocationResultsDiv not found");
     if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = ''; else console.warn("adjustmentLogDiv not found");
     if(variationLogDiv) variationLogDiv.innerHTML = ''; else console.warn("variationLogDiv not found");
     if(cumulativeUsageDiv) cumulativeUsageDiv.innerHTML = ''; else console.warn("cumulativeUsageDiv not found");
     if(lpdBreakdownDiv) lpdBreakdownDiv.innerHTML = ''; else console.warn("lpdBreakdownDiv not found");
     if(finalSummaryTableDiv) finalSummaryTableDiv.innerHTML = ''; else console.warn("finalSummaryTableDiv not found");
     if(refinementLogDiv) refinementLogDiv.innerHTML = ''; else console.warn("refinementLogDiv not found"); // Clear refinement log too

     // Validate if result data exists
     if (!selectedResult) {
         // Update status area if possible
         if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro: Não foi possível encontrar resultados para "${strategyName}".</span>`;
         if(detailsTitle) detailsTitle.innerHTML = 'Resultados Detalhados';
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = '<span class="error">Resultado não encontrado.</span>';
         globalCurrentlyDisplayedStrategyName = null; // Reset global
         console.error(`[displayStrategyDetails] No selectedResult found for ${strategyName}. Aborting.`);
         return;
     }

     // Check if allocation data is present (might be missing if allocation failed critically)
      if (!selectedResult.resultData || !selectedResult.resultData.itemAllocations) {
         if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro: Dados de alocação incompletos ou ausentes para "${strategyName}".</span>`;
         if(detailsTitle) detailsTitle.innerHTML = `Resultados Detalhados (Erro de Dados - ${strategyName})`;
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = `<span class="error">Dados de alocação principal ausentes. A estratégia pode ter falhado. ${selectedResult.resultData?.error || ''}</span>`;
         globalCurrentlyDisplayedStrategyName = null; // Reset global
         // Try to display logs even if main data is missing
         if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = (selectedResult.resultData?.logs?.adjustment) || "Nenhum registro de ajuste.";
         if(variationLogDiv) variationLogDiv.innerHTML = (selectedResult.resultData?.logs?.variation) || "Nenhum registro de variação.";
         // Display refinement log if available (check if attached to selectedResult)
         if(refinementLogDiv) refinementLogDiv.innerHTML = selectedResult.refinementLog || "Nenhum registro de refinamento disponível.";
         console.error(`[displayStrategyDetails] Incomplete resultData for ${strategyName}. Displaying logs if possible.`);
         // Still try to highlight the selected row in the comparison table
         try { updateComparisonTableHighlight(strategyName); } catch(e) { console.error("Error calling updateHighlight on incomplete data:", e); }
         return;
     }

     console.log(`[displayStrategyDetails] Starting detailed display for ${strategyName}.`);
     try {
         // Update titles
         if(detailsTitle) detailsTitle.innerHTML = `Resultados Detalhados da Alocação (Estratégia: ${strategyName})`;

         // Destructure necessary data (using globals from utils.js where needed, these are set by displayResultsForCombination)
         const finalItems = selectedResult.itemsUsed; // Items in the order processed by this strategy
         const finalAllocations = selectedResult.resultData.itemAllocations;
         const finalCumulativeUsage = selectedResult.resultData.cumulativeUsage || {};
         const finalRemainingSlots = selectedResult.resultData.remainingSlots || {};
         const finalLogs = selectedResult.resultData.logs || { adjustment: '', variation: ''};
         const uniqueLpdValuesDisplay = globalUniqueLpdValues || []; // From selected combo
         const maxSlotsDisplayLocal = globalMaxSlotsDisplay; // Global setting
         const originalItemsUnsorted = globalOriginalItems || []; // The initial input items
         const initialTotalSlotsPerValueLocal = globalInitialTotalSlotsPerValue || {}; // From selected combo
         const lpdInstanceCountsLocal = globalLpdInstanceCounts || {}; // From selected combo
         const maxSlotsIsFinite = globalMaxSlotsPerInstance !== Infinity; // Global setting
         const planAssemblyDataForExport = selectedResult.planAssemblyDataForExport; // Generated during internal run

         console.log(`[displayStrategyDetails] Retrieved planAssemblyDataForExport (is null? ${planAssemblyDataForExport === null})`);


         // --- Display Logs ---
         if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = finalLogs.adjustment || "Nenhum registro de ajuste.";
         if(variationLogDiv) variationLogDiv.innerHTML = finalLogs.variation || "Nenhum registro de variação.";
         // Display refinement log if available (assuming it's attached to the result entry)
         if(refinementLogDiv) refinementLogDiv.innerHTML = selectedResult.refinementLog || "Nenhum registro de refinamento aplicado ou disponível.";


         // --- 1. Generate HTML for Final Item Allocations (Detailed Log View) ---
         let finalAllocationHTML = `--- Alocações Finais por Especificação (Estratégia: ${selectedResult.strategyName}) ---`;
         if (finalItems && finalAllocations && finalItems.length === finalAllocations.length) {
             finalItems.forEach((item, i) => { // 'i' is the processing index for this strategy
                 finalAllocationHTML += `<div class="item-allocation">`;
                 // **** CALL TO utils.js **** (inside formatNumberPtBR)
                 finalAllocationHTML += `<b>${i + 1}. ${item?.details || 'Item Inválido'}</b> (Linha Orig: ${item?.originalIndex + 1 || 'N/A'}, Alvo: ${formatNumberPtBR(item?.amount || 0)})\n`;
                 const finalAlloc = finalAllocations[i];
                 if (!finalAlloc) { finalAllocationHTML += `<span class="error">Dados de aloc. ausentes para este item.</span>\n`; }
                 else if (finalAlloc.error) { finalAllocationHTML += `<span class="error">Erro Aloc: ${finalAlloc.error}</span>\n`; }
                 else if (finalAlloc.sum !== undefined) {
                     const itemAmount = item?.amount || 0;
                     const finalPercDiff = itemAmount > 0 ? (finalAlloc.difference / itemAmount) : (finalAlloc.sum === 0 ? 0 : Infinity);
                     const absFinalPercDiff = Math.abs(finalPercDiff);
                     let diffClass = finalAlloc.difference === 0 ? 'zero-diff' : (finalAlloc.difference > 0 ? 'positive-diff' : 'negative-diff');
                     let diffSign = finalAlloc.difference > 0 ? '+' : (finalAlloc.difference < 0 ? '' : ''); // Add sign only if positive
                     // **** CALL TO utils.js **** (twice inside formatNumberPtBR)
                     finalAllocationHTML += `<span class="highlight">Soma: ${formatNumberPtBR(finalAlloc.sum)}</span> (Dif: <span class="${diffClass}">${diffSign}${formatNumberPtBR(finalAlloc.difference)}</span>`;
                     // Uses global REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 from utils.js
                     if (itemAmount > 0 && isFinite(finalPercDiff)) {
                         let percStr = (finalPercDiff * 100).toFixed(1) + '%';
                         let percClass = '';
                          if (absFinalPercDiff > REPROCESS_VARIATION_LIMIT) { percClass = 'violation'; }
                          else if (absFinalPercDiff > VARIATION_LIMIT_PASS_3) { percClass = 'warning'; }
                          finalAllocationHTML += ` / <span class="${percClass}">${percStr}</span>`;
                     } else if (itemAmount <= 0 && finalAlloc.sum !== 0) { finalAllocationHTML += ` / <span class="violation">N/A (Alvo 0)</span>`; }
                     else if (itemAmount > 0 && !isFinite(finalPercDiff)) { finalAllocationHTML += ` / <span class="violation">Inf%</span>`; }
                      else if (itemAmount <= 0 && finalAlloc.sum === 0) { /* No percentage needed for 0 target, 0 sum */ }
                     finalAllocationHTML += `)\n`;
                     if (finalAlloc.combination && finalAlloc.combination.length > 0) {
                         // **** CALL TO utils.js **** (inside map for combination)
                         finalAllocationHTML += `   Combo (${finalAlloc.combination.length}): [${finalAlloc.combination.map(formatNumberPtBR).join(', ')}]`;
                         // Display final usage counts for this item
                         // **** CALL TO utils.js **** (inside map for usage counts)
                         if (finalAlloc.finalUsageCounts && Object.keys(finalAlloc.finalUsageCounts).length > 0) {
                              finalAllocationHTML += `\n   Uso Específico: { ${Object.entries(finalAlloc.finalUsageCounts).map(([lpd, count]) => `"${formatNumberPtBR(lpd)}": ${formatNumberPtBR(count)}`).join(', ')} }`;
                         } else { finalAllocationHTML += `\n   Uso Específico: {}`; }
                     } else { finalAllocationHTML += `   (Nenhum Plano alocado)`; }
                 } else { finalAllocationHTML += "<span class='error'>Estrutura Aloc Inválida</span>"; }
                 finalAllocationHTML += `</div>`;
             });
         } else { finalAllocationHTML += '<span class="error">Incompatibilidade Especificação/Aloc. ou dados ausentes.</span>'; }
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = finalAllocationHTML;


         // --- 2. Generate HTML for Cumulative Usage (Log View) ---
         // Uses globals: uniqueLpdValuesDisplay, initialTotalSlotsPerValueLocal, finalCumulativeUsage, finalRemainingSlots, maxSlotsIsFinite, lpdInstanceCountsLocal
          let usageSummaryHTML = `<div class="usage-summary">--- Uso Acumulado de Planos (Estrat: ${selectedResult.strategyName}, Imagens Máx/Inst: ${maxSlotsDisplayLocal}) ---<ul>`;
          if (uniqueLpdValuesDisplay && uniqueLpdValuesDisplay.length > 0) {
              uniqueLpdValuesDisplay.forEach(lpd => {
                  const initialTotal = initialTotalSlotsPerValueLocal[lpd] ?? 0;
                  const usedTotal = finalCumulativeUsage[lpd] || 0;
                  let remainingTotal = Infinity;
                  // Use finalRemainingSlots if available, otherwise calculate based on initial and used
                  if(maxSlotsIsFinite) {
                      remainingTotal = finalRemainingSlots.hasOwnProperty(lpd)
                                        ? finalRemainingSlots[lpd]
                                        : (initialTotal - usedTotal);
                  }
                  const numInstances = lpdInstanceCountsLocal[lpd] || 0;
                  // **** CALL TO utils.js **** (three times inside formatNumberPtBR)
                  usageSummaryHTML += `<li>Plano <b>${formatNumberPtBR(lpd)}</b> (${formatNumberPtBR(numInstances)} inst): Usado <b>${formatNumberPtBR(usedTotal)}</b>`;
                  if (maxSlotsIsFinite) {
                      // **** CALL TO utils.js **** (twice inside formatNumberPtBR)
                      usageSummaryHTML += ` (Inicial: ${formatNumberPtBR(initialTotal)}, Rem: ${formatNumberPtBR(remainingTotal)})`;
                      if (remainingTotal < 0) { usageSummaryHTML += ` <span class="error">(Erro de Imagem!)</span>`; }
                      // Add a check for consistency if remainingSlots was provided directly
                      else if (finalRemainingSlots.hasOwnProperty(lpd) && usedTotal + remainingTotal !== initialTotal && initialTotal !== Infinity) {
                           console.warn(`Inconsistência Imagem Plano ${lpd}: Usado ${usedTotal}, Rem (Final) ${remainingTotal}, Inicial ${initialTotal}. Estrat: ${strategyName}`);
                           usageSummaryHTML += ` <span class="warning">(Inconsistência Contagem?)</span>`;
                       }
                  }
                  usageSummaryHTML += `</li>`;
              });
          } else { usageSummaryHTML += "<li>Nenhum Plano para rastrear (Combinação vazia?).</li>"; }
          usageSummaryHTML += "</ul></div>";
         if(cumulativeUsageDiv) cumulativeUsageDiv.innerHTML = usageSummaryHTML;


         // --- 3. Generate HTML for Plan Assembly (Montagem dos Planos) USING PRE-GENERATED DATA ---
         // Uses planAssemblyDataForExport from the selectedResult
         let lpdBreakdownHTML = `<div class="lpd-section-title" style="text-align: center; font-size: 1.1em; margin-bottom: 1rem;">--- Montagem dos Planos (Estratégia: ${selectedResult.strategyName}) ---</div>`;
         let totalGlobalSheets = 0;
         if (planAssemblyDataForExport && planAssemblyDataForExport.length > 0) {
             let overallPlanIndex = 0; // For display purposes (Plano 1, Plano 2, ...)
             planAssemblyDataForExport.forEach(instance => {
                 // Only display instances that actually used slots/items
                 if (instance.items && instance.items.length > 0 || instance.totalUsed > 0) {
                     overallPlanIndex++;
                     lpdBreakdownHTML += `<div class="plan-container">`;
                     // **** CALL TO utils.js **** (inside formatNumberPtBR)
                     lpdBreakdownHTML += `<h1>Plano ${overallPlanIndex} - ${formatNumberPtBR(instance.planValue)} Folhas (#${instance.instanceNum})</h1>`; // Added instance num
                     lpdBreakdownHTML += `<table><thead><tr><th>Item</th><th>Img</th><th>Qtd</th></tr></thead><tbody>`;
                     let totalInstanceQtd = 0;
                     if (instance.items && instance.items.length > 0) {
                         instance.items.forEach(item => {
                             const itemQtd = (item.count || 0) * (instance.planValue || 0);
                             totalInstanceQtd += itemQtd;
                             // **** CALL TO utils.js **** (twice inside formatNumberPtBR)
                             lpdBreakdownHTML += `<tr><td>${item.details || 'N/A'}</td><td>${formatNumberPtBR(item.count || 0)}</td><td>${formatNumberPtBR(itemQtd)}</td></tr>`;
                         });
                     } else { lpdBreakdownHTML += `<tr><td colspan="3">(Nenhum item para este plano)</td></tr>`; }
                     // **** CALL TO utils.js **** (twice inside formatNumberPtBR)
                     lpdBreakdownHTML += `<tr class="total-row"><td><strong>TOTAL</strong></td><td><strong>${formatNumberPtBR(instance.totalUsed || 0)}</strong></td><td><strong>${formatNumberPtBR(totalInstanceQtd)}</strong></td></tr>`;
                     lpdBreakdownHTML += `</tbody></table></div>`; // Close table and container

                     // Add to total sheets
                     if (typeof instance.planValue === 'number' && instance.planValue > 0) {
                         totalGlobalSheets += instance.planValue;
                     }
                 } else {
                      // Optionally log skipped instances
                      // console.log(`[displayStrategyDetails] Skipping empty plan instance: LPD ${instance.planValue}, Instance #${instance.instanceNum}`);
                 }
             });
             if (overallPlanIndex === 0) {
                 lpdBreakdownHTML += "<p style='text-align: center; color: var(--text-muted);'>Nenhuma instância de plano com itens alocados para exibir.</p>";
             }

             // Add total sheets summary after all plan containers
             // **** CALL TO utils.js **** (inside formatNumberPtBR)
             lpdBreakdownHTML += `<div class="total-sheets-summary">
                                             Total Geral (Todas os Planos Exibidos): ${formatNumberPtBR(totalGlobalSheets)} Folhas
                                          </div>`;

         } else {
              lpdBreakdownHTML += "<p style='text-align: center; color: var(--text-muted);'>Dados da montagem dos planos não disponíveis ou vazios.</p>";
              if(selectedResult.hasAllocationError) {
                  lpdBreakdownHTML += `<p style='text-align: center; color: var(--warning);'>(Nota: A alocação para esta estratégia encontrou erros, a montagem pode estar incompleta.)</p>`;
              }
         }
         if(lpdBreakdownDiv) lpdBreakdownDiv.innerHTML = lpdBreakdownHTML;


         // --- 4. Generate HTML for Final Summary Table (Tabela Comparativa Original x Alocado) ---
         console.log(`[displayStrategyDetails] Generating summary table for ${strategyName}.`);
         let summaryTableHTML = `<div class="lpd-section-title">--- Tabela Comparativa (Estrat: ${selectedResult.strategyName}) ---</div><table id="finalSummaryTable"><thead><tr><th>Especificação</th><th>Quantidade</th><th>Empenho</th><th>Dif</th><th>Var (%)</th></tr></thead><tbody>`;
         const allocationMap = new Map();
         // Map allocations by the *original* index of the item for easy lookup
         finalItems.forEach((item, i) => { // i is the processing index
              if(item && typeof item.originalIndex !== 'undefined') {
                 allocationMap.set(item.originalIndex, { itemData: item, allocationData: finalAllocations[i] });
              } else {
                  console.warn(`[displayStrategyDetails] Summary Table: Skipping item at processing index ${i} due to missing originalIndex.`);
              }
         });

         let totalOriginal = 0; let totalEmpenhado = 0;

         // Iterate through the ORIGINAL items list to ensure all items are shown in original order
         if (originalItemsUnsorted && originalItemsUnsorted.length > 0) {
             originalItemsUnsorted.forEach(originalItem => {
                 if (!originalItem || typeof originalItem.originalIndex === 'undefined') { console.warn("Skipping invalid original item in summary table gen."); return; }

                 totalOriginal += originalItem.amount;
                 const resultEntry = allocationMap.get(originalItem.originalIndex); // Find allocation using original index
                 let Especificação = originalItem.details || 'N/A';
                 let quantidadeNum = originalItem.amount;
                 // **** CALL TO utils.js **** (formatNumberPtBR)
                 let quantidadeFmt = formatNumberPtBR(quantidadeNum);
                 let empenhoHtml = '<span class="warning">N/A</span>';
                 let difHtml = '<span class="warning">N/A</span>';
                 let varHtml = '<span class="warning">N/A</span>';

                 if (resultEntry && resultEntry.allocationData) {
                     const finalAlloc = resultEntry.allocationData;
                     if (!finalAlloc.error && finalAlloc.sum !== undefined) {
                         const empenhoNum = finalAlloc.sum;
                         // **** CALL TO utils.js **** (formatNumberPtBR)
                         empenhoHtml = formatNumberPtBR(empenhoNum);
                         totalEmpenhado += empenhoNum;
                         const difNum = finalAlloc.difference;
                         let difClass = difNum === 0 ? 'zero-diff' : (difNum > 0 ? 'positive-diff' : 'negative-diff');
                         let difSign = difNum > 0 ? '+' : (difNum < 0 ? '' : '');
                         // **** CALL TO utils.js **** (formatNumberPtBR)
                         difHtml = `<span class="${difClass}">${difSign}${formatNumberPtBR(difNum)}</span>`;

                         // Uses globals REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 from utils.js
                         if (quantidadeNum > 0) {
                             const percentage = (difNum / quantidadeNum);
                             if (isFinite(percentage)){
                                 const percentageFmt = (percentage * 100).toFixed(1) + '%';
                                 let varClass = difClass; // Start with diffClass
                                  if (Math.abs(percentage) > REPROCESS_VARIATION_LIMIT) { varClass = 'violation'; }
                                  else if (Math.abs(percentage) > VARIATION_LIMIT_PASS_3) { varClass = 'warning'; }
                                 varHtml = `<span class="${varClass}">${percentageFmt}</span>`;
                             } else { varHtml = `<span class="violation">Inf%</span>`; }
                         } else if (empenhoNum !== 0) { // Target was 0, but allocation was not
                             varHtml = `<span class="violation">N/A</span>`;
                         } else { // Target 0, Allocation 0
                             varHtml = '<span class="zero-diff">0.0%</span>';
                         }
                     } else if (finalAlloc.error) {
                         empenhoHtml = `<span class="error">Erro</span>`;
                         let shortError = finalAlloc.error.length > 50 ? finalAlloc.error.substring(0, 47) + '...' : finalAlloc.error;
                         difHtml = `<span class="error" title="${finalAlloc.error}">${shortError}</span>`;
                         varHtml = `<span class="error">Erro</span>`;
                     }
                     // Handle case where allocation exists but has no sum/error (should be rare)
                 } else {
                     // Item existed in original list but no allocation data found (might happen if skipped due to error earlier?)
                     empenhoHtml = '<span class="error">Faltando</span>';
                     difHtml = '<span class="error">Faltando</span>';
                     varHtml = '<span class="error">Faltando</span>';
                 }
                 summaryTableHTML += `<tr><td>${Especificação}</td><td>${quantidadeFmt}</td><td>${empenhoHtml}</td><td>${difHtml}</td><td>${varHtml}</td></tr>`;
             });
         } else {
              summaryTableHTML += '<tr><td colspan="5">Nenhum item original encontrado para exibir.</td></tr>';
         }
         summaryTableHTML += `</tbody>`;

         // Add Total Row
         const totalDiferenca = totalEmpenhado - totalOriginal;
         let totalDifClass = totalDiferenca === 0 ? 'zero-diff' : (totalDiferenca > 0 ? 'positive-diff' : 'negative-diff');
         let totalDifSign = totalDiferenca > 0 ? '+' : (totalDiferenca < 0 ? '' : '');
         let totalVarHtml = '';
         if (totalOriginal > 0) {
             const totalPercentage = (totalDiferenca / totalOriginal) * 100;
             if (isFinite(totalPercentage)) {
                 totalVarHtml = `<span class="${totalDifClass}">${totalPercentage.toFixed(1)}%</span>`;
             } else { totalVarHtml = `<span class="violation">Inf%</span>`; }
         } else if (totalEmpenhado === 0) { // Original was 0, Empenho is 0
             totalVarHtml = `<span class="zero-diff">0.0%</span>`;
         } else { // Original was 0, Empenho is non-zero
             totalVarHtml = `<span class="positive-diff">N/A</span>`;
         }

         summaryTableHTML += `<tfoot><tr>
                                <th>TOTAL</th>
                                <!-- **** CALL TO utils.js **** -->
                                <td>${formatNumberPtBR(totalOriginal)}</td>
                                <!-- **** CALL TO utils.js **** -->
                                <td>${formatNumberPtBR(totalEmpenhado)}</td>
                                <!-- **** CALL TO utils.js **** -->
                                <td><span class="${totalDifClass}">${totalDifSign}${formatNumberPtBR(totalDiferenca)}</span></td>
                                <td>${totalVarHtml}</td>
                             </tr></tfoot>`;
         summaryTableHTML += `</table>`;
         if(finalSummaryTableDiv) finalSummaryTableDiv.innerHTML = summaryTableHTML;
         console.log(`[displayStrategyDetails] Finished generating summary table for ${strategyName}.`);

         // --- 5. Update Strategy Comparison Highlight ---
         console.log(`[displayStrategyDetails] Calling updateComparisonTableHighlight for ${strategyName}.`);
         // **** CALL TO this file (ui-controller.js) ****
         updateComparisonTableHighlight(strategyName);
         console.log(`[displayStrategyDetails] Finished updateComparisonTableHighlight for ${strategyName}.`);


     // --- Error Handling for Display ---
     } catch (e) {
         console.error(`[displayStrategyDetails] CRITICAL Error while displaying details for ${strategyName}:`, e);
         if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro CRÍTICO ao exibir detalhes para "${strategyName}". Verifique o console. Err: ${e.message}</span>`;
         // Clear potentially broken output areas
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = '<span class="error">Erro de Exibição</span>';
         if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = ''; if(variationLogDiv) variationLogDiv.innerHTML = '';
         if(cumulativeUsageDiv) cumulativeUsageDiv.innerHTML = ''; if(lpdBreakdownDiv) lpdBreakdownDiv.innerHTML = ''; if(finalSummaryTableDiv) finalSummaryTableDiv.innerHTML = '';
         if(refinementLogDiv) refinementLogDiv.innerHTML = '';
         if(detailsTitle) detailsTitle.innerHTML = `Resultados Detalhados (Erro)`;
         globalCurrentlyDisplayedStrategyName = null; // Reset global
     }
     console.log(`[displayStrategyDetails] END for: ${strategyName}`);
} // End displayStrategyDetails


// --- Function to highlight the selected strategy in the comparison table ---
function updateComparisonTableHighlight(selectedStrategyName) {
    const table = document.getElementById('comparisonTable');
    if (!table) { console.warn("updateComparisonTableHighlight: comparisonTable not found."); return; }
    const tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) { console.warn("updateComparisonTableHighlight: tbody not found in comparisonTable."); return; }
    const rows = tbody.getElementsByTagName('tr');
    // console.log(`[updateComparisonTableHighlight] Highlighting: ${selectedStrategyName}. Found ${rows.length} rows.`); // Verbose

    for (let row of rows) {
        row.classList.remove('best-effort'); // Remove from all rows first
        const firstCell = row.cells[0];
        if (firstCell && firstCell.classList.contains('strategy-name')) {
            // Get current name, removing any existing "(Padrão)" marker
            let currentStrategyName = firstCell.textContent.replace(/\s*\((Padrão|Selecionado)\)$/, '').trim();
            if (currentStrategyName === selectedStrategyName) {
                // console.log(`[updateComparisonTableHighlight] Applying highlight to row for: ${currentStrategyName}`); // Verbose
                row.classList.add('best-effort'); // Add class to the selected row
                firstCell.textContent = `${currentStrategyName} (Padrão)`; // Add marker
            } else {
                firstCell.textContent = currentStrategyName; // Ensure marker is removed if not selected
            }
        } else if (!firstCell) {
            console.warn("[updateComparisonTableHighlight] Row doesn't have a first cell:", row);
        }
    }
    // console.log(`[updateComparisonTableHighlight] Finished highlighting for: ${selectedStrategyName}`); // Verbose
}


// --- toggleErrorStrategies function ---
function toggleErrorStrategies() {
     const container = document.getElementById('comparisonTableContainer');
     const button = document.getElementById('toggleErrorsBtn');
     // Uses global globalStrategyResults from utils.js
     if (container && button && globalStrategyResults) {
         const errorRowCount = globalStrategyResults.filter(r => r.hasAllocationError).length;
         if (errorRowCount === 0) return; // No errors to toggle
         const hiding = container.classList.toggle('hide-errors');
         button.textContent = hiding ? `Mostrar ${errorRowCount} Estrat. c/ Erro...` : `Ocultar ${errorRowCount} Estrat. c/ Erro...`;
     } else {
         console.warn("Could not toggle errors: container, button, or global results missing.");
     }
 }

// --- toggleDuplicateStrategies function ---
function toggleDuplicateStrategies() {
    const container = document.getElementById('comparisonTableContainer');
    const button = document.getElementById('toggleDuplicatesBtn');
     // Uses global globalStrategyResults from utils.js
    if (container && button && globalStrategyResults) {
        const duplicateRowCount = globalStrategyResults.filter(r => r.isDuplicateResult).length;
        if (duplicateRowCount === 0) return; // No duplicates to toggle
        const hiding = container.classList.toggle('hide-duplicates');
        button.textContent = hiding ? `Mostrar ${duplicateRowCount} Estrat. c/ Resultados Idênticos...` : `Ocultar ${duplicateRowCount} Estrat. c/ Resultados Idênticos...`;
    } else {
         console.warn("Could not toggle duplicates: container, button, or global results missing.");
    }
}


// --- NEW FUNCTION TO UPDATE THE ITEM COUNT DISPLAY ---
function updateItemCountDisplay() {
    const textarea = document.getElementById('tableData');
    const displayElement = document.getElementById('itemCountDisplay');
    if (!textarea || !displayElement) {
        // console.warn("Could not find textarea or display element for item count."); // Can be noisy
        return 0; // Return 0 if elements not found
    }

    // **** CALL TO processing-logic.js ****
    const parseResult = parseTableData(textarea.value);
    const count = parseResult.count;

    displayElement.textContent = `Total de Imagens: ${count}`;
    return count; // Return the count for reuse
}

// --- NEW FUNCTION TO CHECK AND APPLY WARNING FOR COMBINATION SIZE ---
function checkCombinationSizeWarning() {
    const maxSlotsInput = document.getElementById('maxSlots');
    const combinationSizeInput = document.getElementById('combinationSize');
    const container = document.getElementById('combinationSizeContainer'); // Container div
    const icon = container ? container.querySelector('.warning-icon') : null; // Find icon within container
    const textarea = document.getElementById('tableData'); // Need this to get item count

    if (!maxSlotsInput || !combinationSizeInput || !container || !icon || !textarea) {
        // console.warn("Missing elements for combination size warning check."); // Can be noisy
        return;
    }

    const maxSlotsValue = parseInt(maxSlotsInput.value, 10);
    const combinationSizeValue = parseInt(combinationSizeInput.value, 10);

    // Get current item count by parsing again
    // **** CALL TO processing-logic.js ****
    const parseResult = parseTableData(textarea.value);
    const itemCount = parseResult.count;

    let showWarning = false;

    // Check if inputs are valid numbers >= 1 and perform the comparison
    if (!isNaN(maxSlotsValue) && maxSlotsValue >= 1 &&
        !isNaN(combinationSizeValue) && combinationSizeValue >= 1 &&
        itemCount > 0) {

        const totalCapacity = maxSlotsValue * combinationSizeValue;
        if (totalCapacity < itemCount) {
            showWarning = true;
        }
    }
    // else: if inputs are invalid or item count is 0, don't show the warning based on this logic

    // Apply or remove the warning class from the container
    if (showWarning) {
        container.classList.add('input-warning');
        // Icon visibility is handled by CSS based on this class
    } else {
        container.classList.remove('input-warning');
        // Icon visibility is handled by CSS based on this class
    }
}


// --- ADD EVENT LISTENER AND INITIAL CALL ---
// Ensure the DOM is loaded before adding listeners
document.addEventListener('DOMContentLoaded', () => {
    const tableDataTextarea = document.getElementById('tableData');
    const maxSlotsInput = document.getElementById('maxSlots');
    const combinationSizeInput = document.getElementById('combinationSize');

    if (tableDataTextarea) {
        tableDataTextarea.addEventListener('input', () => {
            // **** CALLS TO this file (ui-controller.js) ****
            updateItemCountDisplay();
            checkCombinationSizeWarning(); // Call warning check too
        });
        // Initial call on load
        // **** CALL TO this file (ui-controller.js) ****
        updateItemCountDisplay();
    } else {
        console.error("Could not find tableData textarea.");
    }

    if (maxSlotsInput) {
         // **** CALL TO this file (ui-controller.js) ****
        maxSlotsInput.addEventListener('input', checkCombinationSizeWarning);
    } else {
         console.error("Could not find maxSlots input.");
    }

     if (combinationSizeInput) {
         // **** CALL TO this file (ui-controller.js) ****
        combinationSizeInput.addEventListener('input', checkCombinationSizeWarning);
    } else {
         console.error("Could not find combinationSize input.");
    }

    // Initial check for warning on load
    // **** CALL TO this file (ui-controller.js) ****
    checkCombinationSizeWarning();
});