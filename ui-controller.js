// --- Função da Fase do Alocador ---
function runAllocatorPhase() {
    console.log("[runAllocatorPhase] START"); // Log function start
    const statusAreaDiv = document.getElementById('statusArea');
    const strategyComparisonDiv = document.getElementById('strategyComparison');
    const allocationResultsDiv = document.getElementById('allocationResults');

    // --- Clear previous results immediately ---
     console.log("[runAllocatorPhase] Clearing previous results...");
     strategyComparisonDiv.innerHTML = ''; allocationResultsDiv.innerHTML = '';
     document.getElementById('adjustmentLog').innerHTML = ''; document.getElementById('variationLog').innerHTML = ''; document.getElementById('cumulativeUsage').innerHTML = '';
     document.getElementById('lpdBreakdown').innerHTML = ''; document.getElementById('finalSummaryTableDiv').innerHTML = '';
     // Also clear the new refinement log div
     const refinementLogDivClear = document.getElementById('refinementLog');
     if (refinementLogDivClear) refinementLogDivClear.innerHTML = '';
     document.getElementById('detailsTitle').innerHTML = 'Resultados Detalhados da Alocação'; globalCurrentlyDisplayedStrategyName = null;
     console.log("[runAllocatorPhase] Clearing complete.");
    // --- End clearing ---

    // Validation checks (uses globals from utils.js)
    console.log("[runAllocatorPhase] Performing validation checks...");
    if (!globalOriginalItems || globalOriginalItems.length === 0) { statusAreaDiv.innerHTML = `<span class="error">Erro Alocador: Especificações processados ausentes.</span>`; console.error("[runAllocatorPhase] Validation failed: globalOriginalItems missing."); return; }
    if (!globalUserLpdCombinationWithDuplicates) { console.warn("[runAllocatorPhase] globalUserLpdCombinationWithDuplicates undefined, initializing."); globalUserLpdCombinationWithDuplicates = []; }
    else if (globalUserLpdCombinationWithDuplicates.length === 0) { console.warn("[runAllocatorPhase] globalUserLpdCombinationWithDuplicates is empty."); }
    // Ensure necessary globals are arrays/objects even if empty
    if (!globalUniqueLpdValues) globalUniqueLpdValues = [];
    if (!globalInitialTotalSlotsPerValue) globalInitialTotalSlotsPerValue = {};
    console.log("[runAllocatorPhase] Validations complete.");

    // --- Pre-calculate values needed for new heuristics (uses globals from utils.js) ---
    console.log("[runAllocatorPhase] Pre-calculating heuristic values...");
    let averageLPDValue = 0;
    let smallestPositiveLPD = Infinity;
    let potentialDifferences = new Map(); // Map originalIndex -> { potentialDiff, preliminarySum }

    if (globalUserLpdCombinationWithDuplicates && globalUserLpdCombinationWithDuplicates.length > 0) {
        let sumLPDs = 0;
        let positiveLPDs = [];
        globalUserLpdCombinationWithDuplicates.forEach(lpd => {
            if (typeof lpd === 'number' && !isNaN(lpd)) {
                sumLPDs += lpd;
                if (lpd > 0) {
                    positiveLPDs.push(lpd);
                    if (lpd < smallestPositiveLPD) { smallestPositiveLPD = lpd; }
                }
            } else { console.warn("[runAllocatorPhase] Non-numeric LPD found in combination:", lpd); }
        });
        if (globalUserLpdCombinationWithDuplicates.length > 0) { averageLPDValue = sumLPDs / globalUserLpdCombinationWithDuplicates.length; }
        if (smallestPositiveLPD === Infinity) smallestPositiveLPD = 0;

        // Calculate potential differences (uses globalInitialTotalSlotsPerValue, globalOriginalItems, globalUniqueLpdValues from utils.js)
        console.log("[runAllocatorPhase] Calculating potential differences...");
        const initialSlotsCopy = { ...globalInitialTotalSlotsPerValue }; // Uses global
        if (globalOriginalItems && Array.isArray(globalOriginalItems)) { // Uses global
            globalOriginalItems.forEach(item => { // Uses global
                if (!item || typeof item.originalIndex === 'undefined') { console.warn("[runAllocatorPhase] Skipping invalid item during potential difference calculation:", item); return; }
                if (!globalUniqueLpdValues || globalUniqueLpdValues.length === 0) { // Uses global
                     potentialDifferences.set(item.originalIndex, { potentialDiff: Math.abs(item.amount || 0), preliminarySum: 0, prelimError: "No LPDs" }); return;
                }
                // **** CALL TO utils.js ****
                 const prelimResult = findClosestSumWithRepetitionAndSlots(globalUniqueLpdValues, item.amount, initialSlotsCopy);
                 potentialDifferences.set(item.originalIndex, { potentialDiff: Math.abs(prelimResult.difference === undefined ? (item.amount || 0) : prelimResult.difference), preliminarySum: prelimResult.sum, prelimError: prelimResult.error });
             });
            console.log("[runAllocatorPhase] Potential differences calculation loop finished.");
         } else { console.error("[runAllocatorPhase] globalOriginalItems is not a valid array for potential difference calculation."); }
         console.log("[runAllocatorPhase] Potential differences map:", potentialDifferences);

    } else { console.warn("[runAllocatorPhase] No LPD combination available for heuristic pre-calculation."); smallestPositiveLPD = 0; }
     console.log(`[runAllocatorPhase] Pre-calculation complete. AvgLPD: ${averageLPDValue.toFixed(2)}, Smallest+LPD: ${smallestPositiveLPD}`);
    // --- End Pre-calculation ---


     // Strategy Definitions - Including NEW Heuristics
     // (These use the pre-calculated values: potentialDifferences, averageLPDValue, smallestPositiveLPD
     // and globals like globalUniqueLpdValues, globalInitialTotalSlotsPerValue from utils.js)
     const strategies = [
         // Existing Strategies
         { name: "Ordem Original de Entrada", sortFn: (items) => [...items] },
         { name: "Quantidade Ascendente", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount) },
         { name: "Quantidade Descendente", sortFn: (items) => [...items].sort((a, b) => b.amount - a.amount) },
         { name: "Especificação Ascendente (A-Z)", sortFn: (items) => [...items].sort((a, b) => a.details.localeCompare(b.details)) },
         { name: "Especificação Descendente (Z-A)", sortFn: (items) => [...items].sort((a, b) => b.details.localeCompare(a.details)) },
         { name: "Quantidade Meio-para-Fora (Baixo/Cima)", sortFn: (items) => { const s = [...items].sort((a, b) => a.amount - b.amount), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (l >= 0) r.push(s[l--]); if (g < n) r.push(s[g++]); } return r; }},
         { name: "Quantidade Meio-para-Fora (Cima/Baixo)", sortFn: (items) => { const s = [...items].sort((a, b) => a.amount - b.amount), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (g < n) r.push(s[g++]); if (l >= 0) r.push(s[l--]); } return r; }},
         { name: "Especificação Meio-para-Fora (Baixo/Cima)", sortFn: (items) => { const s = [...items].sort((a,b)=>a.details.localeCompare(b.details)), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (l >= 0) r.push(s[l--]); if (g < n) r.push(s[g++]); } return r; }},
         { name: "Especificação Meio-para-Fora (Cima/Baixo)", sortFn: (items) => { const s = [...items].sort((a,b)=>a.details.localeCompare(b.details)), r = [], n = s.length; if (n === 0) return []; const m = Math.floor(n / 2); r.push(s[m]); let l = m - 1, g = m + 1; while (l >= 0 || g < n) { if (g < n) r.push(s[g++]); if (l >= 0) r.push(s[l--]); } return r; }},
         { name: "Quantidade Fora-para-Dentro (Intercalado)", sortFn: (items) => { const s = [...items].sort((a,b)=>a.amount - b.amount), r = []; let l = 0, g = s.length - 1; while(l <= g) { r.push(s[l++]); if (l <= g) { r.push(s[g--]); } } return r; }},
         { name: "Especificação Fora-para-Dentro (Intercalado)", sortFn: (items) => { const s = [...items].sort((a,b)=>a.details.localeCompare(b.details)), r = []; let l = 0, g = s.length - 1; while(l <= g) { r.push(s[l++]); if (l <= g) { r.push(s[g--]); } } return r; }},
         { name: "Qtd Asc, Especificação Asc (Desempate)", sortFn: (items) => [...items].sort((a, b) => a.amount - b.amount || a.details.localeCompare(b.details)) },
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
         { name: "Maior Granularidade Necessária Primeiro (Alvo/MenorLPD)", sortFn: (items) => [...items].sort((a, b) => { const ratioA = smallestPositiveLPD > 0 ? (a.amount / smallestPositiveLPD) : (a.amount > 0 ? Infinity : 0); const ratioB = smallestPositiveLPD > 0 ? (b.amount / smallestPositiveLPD) : (b.amount > 0 ? Infinity : 0); return ratioA - ratioB || a.amount - b.amount; }) },
         { name: "Dependência LPD Crítico Mais Raro Primeiro", sortFn: (items) => {
              const findCriticalLPD = (itemAmount) => { let maxFound = -1; for (const lpd of globalUniqueLpdValues) { if (lpd > 0 && lpd <= itemAmount && lpd > maxFound) { maxFound = lpd; } } return maxFound > 0 ? maxFound : 0; }; // Uses global
              return [...items].sort((a, b) => {
                  const criticalLPD_A = findCriticalLPD(a.amount); const criticalLPD_B = findCriticalLPD(b.amount);
                  const availabilityA = (criticalLPD_A > 0 && globalInitialTotalSlotsPerValue.hasOwnProperty(criticalLPD_A)) ? globalInitialTotalSlotsPerValue[criticalLPD_A] : Infinity; // Uses global
                  const availabilityB = (criticalLPD_B > 0 && globalInitialTotalSlotsPerValue.hasOwnProperty(criticalLPD_B)) ? globalInitialTotalSlotsPerValue[criticalLPD_B] : Infinity; // Uses global
                   if (availabilityA === Infinity && availabilityB !== Infinity) return 1; if (availabilityA !== Infinity && availabilityB === Infinity) return -1;
                   if (availabilityA !== Infinity && availabilityB !== Infinity) { const availabilityDiff = availabilityA - availabilityB; if (availabilityDiff !== 0) return availabilityDiff; }
                   const amountDiff = b.amount - a.amount; if (amountDiff !== 0) return amountDiff; return a.originalIndex - b.originalIndex;
              }); }
         }
     ];
     console.log("[runAllocatorPhase] Final strategies array defined, NEW count:", strategies ? strategies.length : 'undefined');
     if (!strategies || strategies.length === 0) { statusAreaDiv.innerHTML = '<span class="error">Erro interno: Nenhuma estratégia definida.</span>'; return; }

    let localStrategyResults = []; // Initialize results array here
    const comboString = globalUserLpdCombinationWithDuplicates.length > 0 ? `[${globalUserLpdCombinationWithDuplicates.join(', ')}]` : '[Vazia]'; // Uses global
    if(statusAreaDiv) statusAreaDiv.innerHTML = `Executando alocação para ${strategies.length} estratégias (${comboString})... Preparando processamento...`;
    console.log(`[runAllocatorPhase] Status updated. Setting timeout to process ${strategies.length} strategies.`);

    setTimeout(() => {
         console.log("[runAllocatorPhase] ---> setTimeout CALLBACK START <---");
         if (!strategies || strategies.length === 0) { console.error("setTimeout callback: strategies disappeared!"); return; }
         console.log("[runAllocatorPhase] Inside setTimeout: strategies count =", strategies.length);
         if(statusAreaDiv) statusAreaDiv.innerHTML = `Processando ${strategies.length} estratégias... (0%)`;

        try {
            // --- Step 1: Run strategies, generate results & assembly data ---
            for (let i = 0; i < strategies.length; i++) {
                const strategy = strategies[i];
                console.log(`[runAllocatorPhase] --- Loop Start: Strategy [${i+1}/${strategies.length}] ${strategy.name} ---`);

                let currentItemsOrdered;
                try {
                     currentItemsOrdered = strategy.sortFn([...globalOriginalItems]).map((item, idx) => ({ ...item, index: idx })); // Uses global
                } catch (sortError) {
                     console.error(`[runAllocatorPhase] [${i}] ERROR during sortFn for ${strategy.name}:`, sortError);
                     localStrategyResults.push({ strategyName: strategy.name, hasAllocationError: true, resultData: { error: `Sort Error: ${sortError.message}` }, maxVariation: Infinity, avgVariation: Infinity, meetsLimit: false, planAssemblyDataForExport: null, displayMaxVarStr: '', displayAvgVarStr: '', displayOutcomeStr: `<span class="error">Sort Error</span>`, isDuplicateResult: false });
                     continue;
                }

                let result;
                try {
                     // **** CALL TO processing-logic.js ****
                     result = runAllocationProcess(currentItemsOrdered, [...globalUserLpdCombinationWithDuplicates], globalMaxSlotsPerInstance); // Uses globals
                     if (!result) console.warn(`[runAllocatorPhase] [${i}] runAllocationProcess returned null/undefined.`);
                 } catch (allocError) {
                     console.error(`[runAllocatorPhase] [${i}] ERROR during runAllocationProcess for ${strategy.name}:`, allocError);
                     result = { error: `Allocation Error: ${allocError.message}`, itemAllocations: null };
                 }

                // Error checks...
                let hasAllocationError = false; let firstErrorMessage = "";
                if (!result || !result.itemAllocations) {
                     hasAllocationError = true;
                     firstErrorMessage = result ? (result.error || "Item allocations missing.") : "Allocation result missing.";
                } else {
                    for(let itemAllocIdx = 0; itemAllocIdx < result.itemAllocations.length; itemAllocIdx++) {
                        const alloc = result.itemAllocations[itemAllocIdx]; const item = currentItemsOrdered[itemAllocIdx];
                        if (!alloc) { hasAllocationError = true; firstErrorMessage = "Objeto aloc ausente"; break; }
                        if (alloc.error) { hasAllocationError = true; if (!firstErrorMessage) firstErrorMessage = alloc.error; }
                        if (!alloc.error && item && item.amount > 0 && alloc.sum === 0 && alloc.combination && alloc.combination.length === 0) { hasAllocationError = true; const zeroSumError = "Soma 0 para alvo > 0 (Falha DP?)"; alloc.error = zeroSumError; if (!firstErrorMessage) firstErrorMessage = zeroSumError; }
                    }
                }
                if (hasAllocationError && !firstErrorMessage && result && result.error) { firstErrorMessage = result.error; }
                if (hasAllocationError) console.warn(`[runAllocatorPhase] [${i}] Allocation error detected for ${strategy.name}. First: "${firstErrorMessage}"`);

                // Calculate Metrics
                let maxVariation = Infinity, avgVariation = Infinity;
                if (!hasAllocationError && result && result.itemAllocations){
                    try {
                        // **** CALL TO utils.js ****
                        maxVariation = calculateMaxVariation(currentItemsOrdered, result.itemAllocations);
                        // **** CALL TO utils.js ****
                        avgVariation = calculateAverageVariation(currentItemsOrdered, result.itemAllocations);
                    } catch (metricError){
                        console.error(`[runAllocatorPhase] [${i}] Error calculating metrics for ${strategy.name}:`, metricError);
                        hasAllocationError = true; if (!firstErrorMessage) firstErrorMessage = `Metric Calc Error: ${metricError.message}`;
                        maxVariation = Infinity; avgVariation = Infinity;
                    }
                }
                // Uses global REPROCESS_VARIATION_LIMIT from utils.js
                const meetsLimit = !hasAllocationError && maxVariation <= REPROCESS_VARIATION_LIMIT;

                // Generate Assembly Data using Helper
                let planAssemblyData = null;
                if (!hasAllocationError && result && result.itemAllocations) {
                    try {
                        // **** CALL TO processing-logic.js ****
                        planAssemblyData = generatePlanAssemblyData(currentItemsOrdered, result.itemAllocations, globalUserLpdCombinationWithDuplicates, globalMaxSlotsPerInstance); // Uses globals
                    } catch (assemblyError) {
                        console.error(`[runAllocatorPhase] [${i}] ERROR during generatePlanAssemblyData for ${strategy.name}:`, assemblyError);
                        if (!firstErrorMessage && !hasAllocationError) firstErrorMessage = `Assembly Gen Error: ${assemblyError.message}`;
                    }
                }

                // Store the result
                const resultEntry = {
                    strategyName: strategy.name, itemsUsed: currentItemsOrdered, resultData: result,
                    maxVariation: maxVariation, avgVariation: avgVariation, meetsLimit: meetsLimit,
                    hasAllocationError: hasAllocationError,
                    planAssemblyDataForExport: planAssemblyData,
                    displayMaxVarStr: '', displayAvgVarStr: '', displayOutcomeStr: '',
                    isDuplicateResult: false
                };
                localStrategyResults.push(resultEntry);

                // Update progress
                const progress = Math.round(((i + 1) / strategies.length) * 100);
                if(statusAreaDiv) statusAreaDiv.innerHTML = `Processando ${strategies.length} estratégias... (${progress}%)`;

            } // End for loop strategies

            console.log("[runAllocatorPhase] Finished running all strategies. Local results count:", localStrategyResults.length);
            if(localStrategyResults.length !== strategies.length) { console.error(`CRITICAL: Number of results (${localStrategyResults.length}) !== strategies (${strategies.length})!`); }

            // --- Step 2: Sort results ---
            console.log("[runAllocatorPhase] Sorting results...");
            const successResults = [], highVarResults = [], errorResults = [];
            localStrategyResults.forEach(res => {
                 if (res.hasAllocationError) errorResults.push(res);
                 else if (res.meetsLimit) successResults.push(res);
                 else highVarResults.push(res);
            });
            const sortByAvgVar = (a, b) => a.avgVariation - b.avgVariation;
            successResults.sort(sortByAvgVar); highVarResults.sort(sortByAvgVar); errorResults.sort(sortByAvgVar);
            const sortedResults = [...successResults, ...highVarResults, ...errorResults];
            console.log("[runAllocatorPhase] Sorting complete. Sorted results count:", sortedResults.length);

             // --- Step 3: Identify Duplicates & Pre-calculate Display Strings ---
             console.log("[runAllocatorPhase] Identifying duplicates and pre-calculating display strings...");
             const encounteredAssemblies = new Set(); const encounteredDisplaySummaries = new Set();
             let duplicateCount = 0;

             sortedResults.forEach((res, index) => {
                 try {
                    // Pre-calculate display strings
                    if (res.hasAllocationError) {
                        res.displayOutcomeStr = `<span class="error">Erro</span>`;
                        res.displayMaxVarStr = '?'; res.displayAvgVarStr = '?';
                    } else {
                        if (res.maxVariation === Infinity) { res.displayMaxVarStr = '<span class="violation">Infinita</span>'; }
                        // Uses global REPROCESS_VARIATION_LIMIT from utils.js
                        else { res.displayMaxVarStr = (res.maxVariation * 100).toFixed(1) + '%'; if (!res.meetsLimit) res.displayMaxVarStr = `<span class="warning">${res.displayMaxVarStr}</span>`; }
                        res.displayAvgVarStr = (res.avgVariation * 100).toFixed(1) + '%';
                        if (res.meetsLimit) { res.displayOutcomeStr = `<span class="success">Sucesso</span>`; }
                        else { res.displayOutcomeStr = `<span class="warning">Var Alta</span>`; }
                    }
                    const displaySummarySignature = `${res.displayMaxVarStr}-${res.displayAvgVarStr}-${res.displayOutcomeStr}`;

                    const assemblyString = res.planAssemblyDataForExport ? JSON.stringify(res.planAssemblyDataForExport) : 'null_assembly';

                    // Check for duplication based on *previous* encounters
                    let isAssemblyDuplicate = false;
                    if (assemblyString !== 'null_assembly') { isAssemblyDuplicate = encounteredAssemblies.has(assemblyString); }
                    const isDisplaySummaryDuplicate = encounteredDisplaySummaries.has(displaySummarySignature);

                    // Check OR condition
                    if (isAssemblyDuplicate || isDisplaySummaryDuplicate) {
                        res.isDuplicateResult = true; duplicateCount++;
                        let reason = [];
                        if (isAssemblyDuplicate) reason.push("Assembly"); if (isDisplaySummaryDuplicate) reason.push("Display Summary");
                        if (reason.length > 0) { console.log(`[${index}] Marking ${res.strategyName} as duplicate (Reason: ${reason.join(' & ')})`); }
                        else { console.warn(`[${index}] Marked ${res.strategyName} duplicate without specific reason? AssemblyNull: ${assemblyString === 'null_assembly'}, DispDup: ${isDisplaySummaryDuplicate}`); }
                    } else { res.isDuplicateResult = false; /* console.log(`[${index}] ${res.strategyName} is unique so far.`); */ }

                    // Add the current signatures to the sets *after* checking.
                    if (assemblyString !== 'null_assembly') { encounteredAssemblies.add(assemblyString); }
                    encounteredDisplaySummaries.add(displaySummarySignature);

                 } catch (duplicateCheckError) { console.error(`Error during duplicate check for strategy ${res.strategyName} (index ${index}):`, duplicateCheckError); res.isDuplicateResult = false; }
             });
             console.log(`[runAllocatorPhase] Finished duplicate checks. Found ${duplicateCount} duplicates.`);

             // --- Step 4: Set final global results and determine default view ---
             console.log("[runAllocatorPhase] Setting global results and determining default view...");
             globalStrategyResults = sortedResults; // Set global
             let finalResultToShow = null; let statusMessage = "";
             finalResultToShow = globalStrategyResults.find(r => r.meetsLimit && !r.hasAllocationError && !r.isDuplicateResult);
             if (!finalResultToShow) { finalResultToShow = globalStrategyResults.find(r => !r.hasAllocationError && !r.isDuplicateResult); }
             if (!finalResultToShow) { finalResultToShow = globalStrategyResults.find(r => !r.isDuplicateResult); }
             if (!finalResultToShow && globalStrategyResults.length > 0) { finalResultToShow = globalStrategyResults[0]; }
             console.log("[runAllocatorPhase] Default strategy to show:", finalResultToShow ? finalResultToShow.strategyName : "None");

             // Generate status message
              if (finalResultToShow) {
                const selected = globalStrategyResults.find(r => r.strategyName === finalResultToShow.strategyName);
                if (selected) {
                    if (selected.meetsLimit && !selected.hasAllocationError && !selected.isDuplicateResult) { statusMessage = `<span class="success">Visão Padrão: Primeira estratégia c/ resultado único dentro do limite: ${selected.strategyName}</span>. Clique abaixo...`; }
                    else if (!selected.hasAllocationError && !selected.isDuplicateResult) { const vStr = selected.displayMaxVarStr; const avgStr = selected.displayAvgVarStr; statusMessage = `<span class="warning">Visão Padrão: Nenhuma estratégia c/ resultado único atendeu ao limite. Mostrando primeira <span class="info">única sem erro</span>:</span> <span class="info">${selected.strategyName}</span> (Máx: ${vStr}, Média: ${avgStr}). Clique abaixo...`; }
                    else if (!selected.isDuplicateResult) { const vStr = selected.displayMaxVarStr; const avgStr = selected.displayAvgVarStr; statusMessage = `<span class="error">Visão Padrão: Nenhuma estratégia c/ resultado único sem erro. Mostrando primeira <span class="info">única (com erro)</span>:</span> <span class="info">${selected.strategyName}</span> (Máx: ${vStr}, Média: ${avgStr}). Clique abaixo...`; }
                    else { const vStr = selected.displayMaxVarStr; const avgStr = selected.displayAvgVarStr; statusMessage = `<span class="error">Visão Padrão: Todas as estratégias parecem duplicadas? Mostrando a primeira:</span> <span class="info">${selected.strategyName}</span> (Máx: ${vStr}, Média: ${avgStr}). Clique abaixo...`; }
                } else { statusMessage = `<span class="error">Erro: Falha ao encontrar detalhes da estratégia padrão selecionada.</span>`; }
             } else { statusMessage = `<span class="error">Erro: Nenhum resultado de estratégia gerado ou selecionado.</span>`; }
             if(statusAreaDiv) statusAreaDiv.innerHTML = statusMessage; // Update status with final outcome

            // --- Step 4.5: Apply Iterative Refinement to the Best Result ---
            let refinementLogContent = "Nenhum refinamento aplicado (nenhuma estratégia selecionada ou erro inicial)."; // Default log
            if (finalResultToShow && !finalResultToShow.hasAllocationError) {
                console.log(`[runAllocatorPhase] Applying refinement to selected strategy: ${finalResultToShow.strategyName}`);
                try {
                    const resultToRefineCopy = JSON.parse(JSON.stringify(finalResultToShow));
                    // **** CALL TO processing-logic.js ****
                    const refinementOutcome = refineAllocationResult(resultToRefineCopy);

                    if (refinementOutcome && refinementOutcome.refinedResultEntry) {
                        const indexToUpdate = globalStrategyResults.findIndex(r => r.strategyName === finalResultToShow.strategyName);
                        if (indexToUpdate !== -1) {
                            globalStrategyResults[indexToUpdate] = refinementOutcome.refinedResultEntry;
                            finalResultToShow = globalStrategyResults[indexToUpdate]; // Point to the refined one
                            console.log(`[runAllocatorPhase] Updated globalStrategyResults with refined data for index ${indexToUpdate}.`);
                            refinementLogContent = refinementOutcome.log;
                        } else {
                            console.error(`[runAllocatorPhase] Could not find strategy ${finalResultToShow.strategyName} in global results to update after refinement!`);
                            refinementLogContent = `<span class='error'>Erro interno: Falha ao atualizar estratégia pós-refinamento.</span>`;
                        }
                    } else {
                         console.error(`[runAllocatorPhase] Refinement function returned invalid outcome for ${finalResultToShow.strategyName}.`);
                         refinementLogContent = `<span class='error'>Erro: Função de refinamento falhou.</span>`;
                    }
                } catch (refinementError) {
                    console.error(`[runAllocatorPhase] Error during refinement call for ${finalResultToShow.strategyName}:`, refinementError);
                    refinementLogContent = `<span class='error'>Erro durante o processo de refinamento: ${refinementError.message}</span>`;
                }
            } else if (finalResultToShow && finalResultToShow.hasAllocationError) {
                refinementLogContent = `<span class='warning'>Refinamento não aplicado pois a estratégia selecionada (${finalResultToShow.strategyName}) continha erros iniciais.</span>`;
                console.warn(`[runAllocatorPhase] Skipping refinement for selected strategy ${finalResultToShow.strategyName} due to initial errors.`);
            } else {
                 console.warn("[runAllocatorPhase] No strategy selected for refinement.");
            }
            // Update the refinement log display area
            const refinementLogDiv = document.getElementById('refinementLog');
            if (refinementLogDiv) {
                refinementLogDiv.innerHTML = refinementLogContent;
                console.log("[runAllocatorPhase] Refinement log displayed.");
            } else { console.error("[runAllocatorPhase] Refinement log div not found!"); }
            // --- END REFINEMENT BLOCK ---

            // --- Step 5: Generate Comparison Table HTML ---
            console.log("[runAllocatorPhase] Generating comparison table HTML (using potentially refined metrics)...");
            let comparisonHTML = `<div class="comparison-title">--- Resumo da Comparação de Estratégias ---</div>`;
            comparisonHTML += `<div id="comparisonTableContainer" class="comparison-table-container hide-errors hide-duplicates">`;
            comparisonHTML += `<table id="comparisonTable"><thead><tr><th>Estratégia</th><th>Var Máx (%)</th><th>Var Média (%)</th><th>Resultado</th></tr></thead><tbody>`;

            let errorCount = 0; let finalDuplicateCount = 0;
            if (globalStrategyResults && globalStrategyResults.length > 0) {
                globalStrategyResults.forEach((res, index) => {
                     try {
                        // Retrieve pre-calculated or REFINED display strings/metrics
                        const maxVarStr = res.displayMaxVarStr || '?';
                        const avgVarStr = res.displayAvgVarStr || '?';
                        let outcomeStr = '';
                         if (res.hasAllocationError) { outcomeStr = `<span class="error">Erro</span>`; errorCount++; }
                         else if (res.meetsLimit) { outcomeStr = `<span class="success">Sucesso</span>`; }
                         else { outcomeStr = `<span class="warning">Var Alta</span>`; }

                        let rowClass = '';
                        if (res.hasAllocationError) { rowClass = 'strategy-error-row'; }
                        if (res.isDuplicateResult) { rowClass += ' strategy-duplicate-row'; finalDuplicateCount++; }

                        // Check against the potentially updated finalResultToShow
                        const isSelectedStrategy = (finalResultToShow && res.strategyName === finalResultToShow.strategyName);
                        if (isSelectedStrategy) rowClass += ' best-effort';

                        comparisonHTML += `<tr class="${rowClass.trim()}"><td class="strategy-name" onclick="displayStrategyDetails('${encodeURIComponent(res.strategyName)}')">${res.strategyName} ${isSelectedStrategy ? '(Selecionado)' : ''}</td><td>${maxVarStr}</td><td>${avgVarStr}</td><td>${outcomeStr}</td></tr>`;
                     } catch(tableGenError) {
                         console.error(`Error generating table row for strategy ${res ? res.strategyName : 'Unknown'} (index ${index}):`, tableGenError);
                         comparisonHTML += `<tr><td colspan="4"><span class="error">Erro ao gerar linha para estratégia ${res ? res.strategyName : 'Desconhecida'}</span></td></tr>`;
                     }
                });
            } else {
                comparisonHTML += '<tr><td colspan="4">Nenhum resultado de estratégia para exibir.</td></tr>';
            }
            comparisonHTML += `</tbody></table></div>`; // Close table and container

            comparisonHTML += `<div class="toggle-buttons-container" style="margin-top: 0.5rem;">`;
             if (errorCount > 0) { comparisonHTML += `<button id="toggleErrorsBtn" onclick="toggleErrorStrategies()">Mostrar ${errorCount} Estrat. c/ Erro...</button>`; }
             if (finalDuplicateCount > 0) { comparisonHTML += `<button id="toggleDuplicatesBtn" onclick="toggleDuplicateStrategies()" class="secondary">Mostrar ${finalDuplicateCount} Estrat. c/ Resultados Idênticos...</button>`; }
            comparisonHTML += `</div>`;

            console.log("[runAllocatorPhase] Setting strategyComparisonDiv innerHTML...");
            if(strategyComparisonDiv) strategyComparisonDiv.innerHTML = comparisonHTML;
            else console.error("strategyComparisonDiv not found!");
            console.log("[runAllocatorPhase] Finished setting strategyComparisonDiv innerHTML.");

            // --- Step 6: Display the details of the selected (and potentially refined) default strategy ---
            if (finalResultToShow) {
                 console.log(`[runAllocatorPhase] Calling displayStrategyDetails for final selected/refined strategy: ${finalResultToShow.strategyName}`);
                 try {
                    displayStrategyDetails(encodeURIComponent(finalResultToShow.strategyName)); // Function is in this file
                    console.log(`[runAllocatorPhase] Finished calling displayStrategyDetails for ${finalResultToShow.strategyName}`);
                 } catch (displayDetailsError) {
                      console.error(`Error calling displayStrategyDetails for ${finalResultToShow.strategyName}:`, displayDetailsError);
                      if(statusAreaDiv) statusAreaDiv.innerHTML += ` <span class="error">Erro ao exibir detalhes da estratégia selecionada.</span>`;
                      if(allocationResultsDiv) allocationResultsDiv.innerHTML = '<span class="error">Erro ao exibir detalhes.</span>';
                      const lpdBD = document.getElementById('lpdBreakdown'); if(lpdBD) lpdBD.innerHTML = '';
                      const finalSum = document.getElementById('finalSummaryTableDiv'); if(finalSum) finalSum.innerHTML = '';
                 }
            } else {
                 console.warn("[runAllocatorPhase] No final strategy selected to display details for.");
                 if(allocationResultsDiv) allocationResultsDiv.innerHTML = 'Nenhuma estratégia padrão disponível para exibir.';
                 const lpdBD = document.getElementById('lpdBreakdown'); if(lpdBD) lpdBD.innerHTML = '';
                 const finalSum = document.getElementById('finalSummaryTableDiv'); if(finalSum) finalSum.innerHTML = '';
            }

            console.log("[runAllocatorPhase] ---> setTimeout CALLBACK END <---");

        } catch (allocatorError) {
             console.error("[runAllocatorPhase] CRITICAL ERROR inside setTimeout callback:", allocatorError);
             if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro GERAL na fase do Alocador. Verifique o console. Err: ${allocatorError.message}</span>`;
             if (strategyComparisonDiv && !strategyComparisonDiv.innerHTML) { strategyComparisonDiv.innerHTML = '<span class="error">Falha ao gerar comparação.</span>'; }
         }
    }, 10); // End setTimeout

    console.log("[runAllocatorPhase] END (setTimeout scheduled)");

} // Fim runAllocatorPhase


// --- FUNÇÃO PRINCIPAL DE CONTROLE ---
function initiateProcess(mode) {
    console.clear();
    console.log(`--- Iniciando Processo (Modo: ${mode}) ---`);
    const tableDataInput = document.getElementById('tableData').value.trim();
    const maxSlotsInput = document.getElementById('maxSlots').value.trim();
    const combinationSizeInput = document.getElementById('combinationSize').value.trim();
    const finderResultsLogDiv = document.getElementById('finderResultsLog');
    const foundCombinationDisplayDiv = document.getElementById('foundCombinationDisplay');
    const statusAreaDiv = document.getElementById('statusArea');
    const strategyComparisonDiv = document.getElementById('strategyComparison');
    const allocationResultsDiv = document.getElementById('allocationResults');
    const adjustmentLogDiv = document.getElementById('adjustmentLog');
    const variationLogDiv = document.getElementById('variationLog');
    const cumulativeUsageDiv = document.getElementById('cumulativeUsage');
    const lpdBreakdownDiv = document.getElementById('lpdBreakdown');
    const finalSummaryTableDiv = document.getElementById('finalSummaryTableDiv');
    const detailsTitleH2 = document.getElementById('detailsTitle');

    // Clear previous results
    finderResultsLogDiv.innerHTML = `Processando Combinação (Modo: ${mode})...`;
    foundCombinationDisplayDiv.innerHTML = "";
    statusAreaDiv.innerHTML = "Aguardando Combinação...";
    strategyComparisonDiv.innerHTML = ""; allocationResultsDiv.innerHTML = ""; adjustmentLogDiv.innerHTML = ""; variationLogDiv.innerHTML = ""; cumulativeUsageDiv.innerHTML = ""; lpdBreakdownDiv.innerHTML = ""; finalSummaryTableDiv.innerHTML = ""; detailsTitleH2.innerHTML = 'Resultados Detalhados da Alocação';
     globalCurrentlyDisplayedStrategyName = null; // Reseta estratégia selecionada (global from utils.js)

    // Reset Globals (defined in utils.js - this re-initializes them)
    globalStrategyResults = []; globalOriginalItems = []; globalUniqueLpdValues = []; globalUserLpdCombinationWithDuplicates = []; globalLpdInstanceCounts = {}; globalInitialTotalSlotsPerValue = {}; globalMaxSlotsPerInstance = Infinity; globalMaxSlotsDisplay = "Ilimitado";

    // Input validation
    if (!tableDataInput) { finderResultsLogDiv.innerHTML = '<span class="error">Erro: Dados da tabela vazios.</span>'; return; }
    if (!maxSlotsInput) { finderResultsLogDiv.innerHTML = '<span class="error">Erro: "Imagens no Plano" é obrigatório.</span>'; return; }
    if (!combinationSizeInput) { finderResultsLogDiv.innerHTML = '<span class="error">Erro: "Quantidade de Planos" é obrigatório.</span>'; return; }
    let maxSlotsPerInstance; let combinationSize;
     try { maxSlotsPerInstance = parseInt(maxSlotsInput); if (isNaN(maxSlotsPerInstance) || maxSlotsPerInstance < 1) throw new Error('"Imagens no Plano" >= 1.'); globalMaxSlotsPerInstance = maxSlotsPerInstance; globalMaxSlotsDisplay = String(maxSlotsPerInstance); } catch (e) { finderResultsLogDiv.innerHTML = `<span class="error">Erro de Entrada: ${e.message}</span>`; return; } // Set globals
     try { combinationSize = parseInt(combinationSizeInput); if (isNaN(combinationSize) || combinationSize < 1) throw new Error('"Quantidade de Planos" >= 1.'); } catch (e) { finderResultsLogDiv.innerHTML = `<span class="error">Erro de Entrada: ${e.message}</span>`; return; }

    // Input Parsing (Robust version)
    let parsedItems = []; let parseErrors = []; const lines = tableDataInput.split('\n'); let minRawAmount = Infinity, maxRawAmount = -Infinity, sumRawAmount = 0, validItemCount = 0;
    lines.forEach((line, index) => {
        line = line.trim(); if (!line) return;
        let details = ''; let amountStrRaw = ''; let parts = line.split('\t');
        if (parts.length >= 2) { amountStrRaw = parts[parts.length - 1]; details = parts.slice(0, -1).join('\t'); }
        else { const lastSpaceIndex = line.lastIndexOf(' ');
            if (lastSpaceIndex === -1 || lastSpaceIndex === 0) { parts = line.split(/\s+/); if (parts.length >= 2) { amountStrRaw = parts[parts.length - 1]; details = parts.slice(0, -1).join(' '); } else { parseErrors.push(`L${index + 1}: Formato inválido: "${line}"`); return; } }
            else { amountStrRaw = line.substring(lastSpaceIndex + 1); details = line.substring(0, lastSpaceIndex); }
        }
        let amountStrClean = amountStrRaw.replace(/[R$€]/g, '').trim();
        let amountStrParsed = amountStrClean.replace(/\./g, '').replace(/,/g, '.');
        const amount = parseFloat(amountStrParsed);
        if (isNaN(amount)) { parseErrors.push(`L${index + 1}: Quantidade inválida ('${amountStrRaw}') para "${details}"`); return; }
        if (amount < 0) { parseErrors.push(`L${index + 1}: Quantidade negativa (${amount}) para "${details}"`); return; }
        const roundedAmount = Math.round(amount);
        parsedItems.push({ details: details, amount: roundedAmount, originalIndex: index });
        sumRawAmount += roundedAmount; validItemCount++;
        if (roundedAmount < minRawAmount) minRawAmount = roundedAmount;
        if (roundedAmount > maxRawAmount) maxRawAmount = roundedAmount;
    });

    if (parseErrors.length > 0) { finderResultsLogDiv.innerHTML = `<span class="error">Erros ao Processar Entradas:</span>\n${parseErrors.join('\n')}`; return; }
    if (parsedItems.length === 0) { finderResultsLogDiv.innerHTML = `<span class="error">Erro: Nenhuma Especificação válida processada. Verifique o formato da entrada.</span>`; return; }
    globalOriginalItems = parsedItems; // Set global
    console.log(`Processados ${validItemCount} Especificações. Soma: ${sumRawAmount}, Mín: ${minRawAmount === Infinity ? 'N/A' : minRawAmount}, Máx: ${maxRawAmount === -Infinity ? 'N/A' : maxRawAmount}`);

    // Generate Combination
    finderResultsLogDiv.innerHTML = `Gerando Combinação (Modo: ${mode})...`;
    setTimeout(() => {
        try {
            let combinationResult = null;
            let combinationMethodDescription = "";

            if (mode === 'findBest') {
                console.log("Chamando findBestLpdCombination...");
                // **** CALL TO processing-logic.js ****
                combinationResult = findBestLpdCombination(globalOriginalItems, maxSlotsPerInstance, combinationSize);
                combinationMethodDescription = "Otimização por Frequência de Divisores";
            } else if (mode === 'forceProportional') {
                console.log("Chamando calculateDirectProportionalCombination...");
                // **** CALL TO processing-logic.js ****
                combinationResult = calculateDirectProportionalCombination(globalOriginalItems, maxSlotsPerInstance, combinationSize);
                combinationMethodDescription = "Distribuição Proporcional Direta";
            } else { throw new Error(`Modo desconhecido: ${mode}`); }

            finderResultsLogDiv.innerHTML = combinationResult.log;

            if (combinationResult.status === "Error" || !combinationResult.combination) {
                foundCombinationDisplayDiv.innerHTML = `<span class="error">Geração da Combinação falhou (Modo: ${mode}). Verifique o log acima.</span>`;
                statusAreaDiv.innerHTML = "Alocador Abortado (Falha na Combinação).";
                return;
            } else if (combinationResult.combination.length === 0) {
                 foundCombinationDisplayDiv.innerHTML = `<span class="warning">Geração da Combinação resultou em lista vazia []. Prosseguindo para Alocador sem Planos.</span>`;
                 statusAreaDiv.innerHTML = "Combinação vazia. Executando Alocador...";
                 // Set globals from utils.js
                 globalUserLpdCombinationWithDuplicates = [];
                 globalUniqueLpdValues = [];
                 globalLpdInstanceCounts = {};
                 globalInitialTotalSlotsPerValue = {};
            } else {
                // Set globals from utils.js
                globalUserLpdCombinationWithDuplicates = combinationResult.combination;
                globalUniqueLpdValues = [...new Set(globalUserLpdCombinationWithDuplicates)].sort((a, b) => a - b);
                globalLpdInstanceCounts = {}; globalUserLpdCombinationWithDuplicates.forEach(lpd => { globalLpdInstanceCounts[lpd] = (globalLpdInstanceCounts[lpd] || 0) + 1; });
                globalInitialTotalSlotsPerValue = {}; globalUniqueLpdValues.forEach(lpd => { const instances = globalLpdInstanceCounts[lpd] || 0; globalInitialTotalSlotsPerValue[lpd] = globalMaxSlotsPerInstance !== Infinity ? (instances * globalMaxSlotsPerInstance) : Infinity; });

                console.log("Resultado Combinação (Valores):", globalUserLpdCombinationWithDuplicates);
                console.log("Resultado Combinação (Únicos):", globalUniqueLpdValues);
                console.log("Resultado Combinação (Contagens):", globalLpdInstanceCounts);
                console.log("Resultado Combinação (Imagens Iniciais):", globalInitialTotalSlotsPerValue);

                foundCombinationDisplayDiv.innerHTML = `Combinação Gerada (<span class="info">${combinationMethodDescription}</span>): <b>[${globalUserLpdCombinationWithDuplicates.join(', ')}]</b> (Tamanho: ${globalUserLpdCombinationWithDuplicates.length})`;
                statusAreaDiv.innerHTML = `Combinação completa (Modo: ${mode}). Executando Alocador...`;
            }

            // Run Allocator Phase (Function is in this file)
            runAllocatorPhase();

        } catch (combinationError) {
            console.error(`Erro durante Geração da Combinação (Modo: ${mode}):`, combinationError);
            finderResultsLogDiv.innerHTML += `\n<span class="error">Ocorreu um erro inesperado durante a geração da combinação: ${combinationError.message}</span>`;
            foundCombinationDisplayDiv.innerHTML = `<span class="error">Geração da combinação falhou (Modo: ${mode}).</span>`;
            statusAreaDiv.innerHTML = "Alocador Abortado (Falha na Combinação).";
        }
    }, 10); // End setTimeout for Combination

} // Fim initiateProcess

// --- toggleErrorStrategies function ---
function toggleErrorStrategies() {
     const container = document.getElementById('comparisonTableContainer');
     const button = document.getElementById('toggleErrorsBtn');
     if (container && button && globalStrategyResults) { // Uses global
         const errorRowCount = globalStrategyResults.filter(r => r.hasAllocationError).length;
         if (errorRowCount === 0) return;
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
    if (container && button && globalStrategyResults) { // Uses global
        const duplicateRowCount = globalStrategyResults.filter(r => r.isDuplicateResult).length;
        if (duplicateRowCount === 0) return;
        const hiding = container.classList.toggle('hide-duplicates');
        button.textContent = hiding ? `Mostrar ${duplicateRowCount} Estrat. c/ Resultados Idênticos...` : `Ocultar ${duplicateRowCount} Estrat. c/ Resultados Idênticos...`;
    } else {
         console.warn("Could not toggle duplicates: container, button, or global results missing.");
    }
}

// --- Function to highlight the selected strategy in the comparison table ---
function updateComparisonTableHighlight(selectedStrategyName) {
    const table = document.getElementById('comparisonTable');
    if (!table) { console.warn("updateComparisonTableHighlight: comparisonTable not found."); return; }
    const tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) { console.warn("updateComparisonTableHighlight: tbody not found in comparisonTable."); return; }
    const rows = tbody.getElementsByTagName('tr');
    console.log(`[updateComparisonTableHighlight] Highlighting: ${selectedStrategyName}. Found ${rows.length} rows.`);

    for (let row of rows) {
        row.classList.remove('best-effort');
        const firstCell = row.cells[0];
        if (firstCell && firstCell.classList.contains('strategy-name')) {
            let currentStrategyName = firstCell.textContent.replace(/\s*\(Selecionado\)$/, '').trim();
            if (currentStrategyName === selectedStrategyName) {
                console.log(`[updateComparisonTableHighlight] Applying highlight to row for: ${currentStrategyName}`);
                row.classList.add('best-effort');
                firstCell.textContent = `${currentStrategyName} (Selecionado)`;
            } else {
                firstCell.textContent = currentStrategyName;
            }
        } else if (!firstCell) {
            console.warn("[updateComparisonTableHighlight] Row doesn't have a first cell:", row);
        }
    }
    console.log(`[updateComparisonTableHighlight] Finished highlighting for: ${selectedStrategyName}`);
}


// --- FUNÇÕES DE EXIBIÇÃO DO ALOCADOR ---
function displayStrategyDetails(encodedStrategyName) { // exibirDetalhesEstrategia
     const strategyName = decodeURIComponent(encodedStrategyName);
     globalCurrentlyDisplayedStrategyName = strategyName; // Set global (from utils.js)
     console.log(`[displayStrategyDetails] START for: ${strategyName}`);

     // Get references to DOM elements
     const statusAreaDiv = document.getElementById('statusArea');
     const detailsTitle = document.getElementById('detailsTitle');
     const allocationResultsDiv = document.getElementById('allocationResults');
     const adjustmentLogDiv = document.getElementById('adjustmentLog');
     const variationLogDiv = document.getElementById('variationLog');
     const cumulativeUsageDiv = document.getElementById('cumulativeUsage');
     const lpdBreakdownDiv = document.getElementById('lpdBreakdown');
     const finalSummaryTableDiv = document.getElementById('finalSummaryTableDiv');

     // Find the result data for the selected strategy FROM GLOBAL RESULTS (from utils.js)
     const selectedResult = globalStrategyResults && globalStrategyResults.find(res => res.strategyName === strategyName);
     console.log(`[displayStrategyDetails] Found selectedResult:`, selectedResult ? 'Yes' : 'No');


     // Reset UI elements
     allocationResultsDiv.innerHTML = 'Carregando...';
     adjustmentLogDiv.innerHTML = ''; variationLogDiv.innerHTML = ''; cumulativeUsageDiv.innerHTML = '';
     lpdBreakdownDiv.innerHTML = ''; finalSummaryTableDiv.innerHTML = '';

     // Validate if result data exists
     if (!selectedResult) {
         if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro: Não foi possível encontrar resultados para "${strategyName}".</span>`;
         if(detailsTitle) detailsTitle.innerHTML = 'Resultados Detalhados';
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = '';
         globalCurrentlyDisplayedStrategyName = null; // Reset global
         console.error(`[displayStrategyDetails] No selectedResult found for ${strategyName}. Aborting.`);
         return;
     }
     if (!selectedResult.resultData || !selectedResult.resultData.itemAllocations) {
         if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro: Dados de alocação incompletos ou ausentes para "${strategyName}".</span>`;
         if(detailsTitle) detailsTitle.innerHTML = `Resultados Detalhados (Erro de Dados - ${strategyName})`;
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = '<span class="error">Dados de alocação principal ausentes. A estratégia pode ter falhado.</span>';
         globalCurrentlyDisplayedStrategyName = null; // Reset global
         if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = (selectedResult.resultData?.logs?.adjustment) || "Nenhum registro de ajuste."; // Optional chaining
         if(variationLogDiv) variationLogDiv.innerHTML = (selectedResult.resultData?.logs?.variation) || "Nenhum registro de variação."; // Optional chaining
         console.error(`[displayStrategyDetails] Incomplete resultData for ${strategyName}. Aborting detailed display.`);
         try { updateComparisonTableHighlight(strategyName); } catch(e) { console.error("Error calling updateHighlight on incomplete data:", e); } // Still try highlight
         return;
     }

     console.log(`[displayStrategyDetails] Starting detailed display for ${strategyName}.`);
     try {
         if(statusAreaDiv) statusAreaDiv.innerHTML = `Exibindo detalhes para estratégia: <span class="info">${strategyName}</span>`;
         if(detailsTitle) detailsTitle.innerHTML = `Resultados Detalhados da Alocação (Estratégia: ${strategyName})`;

         // Destructure necessary data (using globals from utils.js where needed)
         const finalItems = selectedResult.itemsUsed;
         const finalAllocations = selectedResult.resultData.itemAllocations;
         const finalCumulativeUsage = selectedResult.resultData.cumulativeUsage || {};
         const finalRemainingSlots = selectedResult.resultData.remainingSlots || {};
         const finalLogs = selectedResult.resultData.logs || { adjustment: '', variation: ''};
         const uniqueLpdValuesDisplay = globalUniqueLpdValues || [];
         const maxSlotsDisplayLocal = globalMaxSlotsDisplay;
         const originalItemsUnsorted = globalOriginalItems || [];
         const initialTotalSlotsPerValueLocal = globalInitialTotalSlotsPerValue || {};
         const lpdInstanceCountsLocal = globalLpdInstanceCounts || {};
         const maxSlotsNum = globalMaxSlotsPerInstance;
         const maxSlotsIsFinite = globalMaxSlotsPerInstance !== Infinity;
         const planAssemblyDataForExport = selectedResult.planAssemblyDataForExport; // Use the one stored in the result

         console.log(`[displayStrategyDetails] Retrieved planAssemblyDataForExport (is null? ${planAssemblyDataForExport === null})`);


         // Display Adjustment and Variation Logs
         if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = finalLogs.adjustment || "Nenhum registro de ajuste.";
         if(variationLogDiv) variationLogDiv.innerHTML = finalLogs.variation || "Nenhum registro de variação.";

         // --- 1. Generate HTML for Final Item Allocations (Log View) ---
         let finalAllocationHTML = `--- Alocações Finais por Especificação (Estratégia: ${selectedResult.strategyName}) ---`;
         if (finalItems && finalAllocations && finalItems.length === finalAllocations.length) {
             finalItems.forEach((item, i) => {
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
                     let diffSign = finalAlloc.difference > 0 ? '+' : '';
                     // **** CALL TO utils.js **** (twice inside formatNumberPtBR)
                     finalAllocationHTML += `<span class="highlight">Soma: ${formatNumberPtBR(finalAlloc.sum)}</span> (Dif: <span class="${diffClass}">${diffSign}${formatNumberPtBR(finalAlloc.difference)}</span>`;
                     // Uses global REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 from utils.js
                     if (itemAmount > 0 && isFinite(finalPercDiff)) {
                         finalAllocationHTML += ` / ${(finalPercDiff * 100).toFixed(1)}%`;
                         if (absFinalPercDiff > REPROCESS_VARIATION_LIMIT) { finalAllocationHTML += ` <span class="violation">>±${(REPROCESS_VARIATION_LIMIT * 100).toFixed(0)}%</span>`; }
                         else if (absFinalPercDiff > VARIATION_LIMIT_PASS_3) { finalAllocationHTML += ` <span class="warning">>±${(VARIATION_LIMIT_PASS_3 * 100).toFixed(0)}%</span>`; }
                     } else if (itemAmount <= 0 && finalAlloc.sum !== 0) { finalAllocationHTML += ` / <span class="violation">N/A (Alvo 0)</span>`; }
                     else if (itemAmount > 0 && !isFinite(finalPercDiff)) { finalAllocationHTML += ` / <span class="violation">Inf%</span>`; }
                     finalAllocationHTML += `)\n`;
                     if (finalAlloc.combination && finalAlloc.combination.length > 0) {
                         // **** CALL TO utils.js **** (inside map)
                         finalAllocationHTML += `   Combo (${finalAlloc.combination.length}): [${finalAlloc.combination.map(formatNumberPtBR).join(', ')}]`;
                         // **** CALL TO utils.js **** (inside map)
                         if (finalAlloc.finalUsageCounts && Object.keys(finalAlloc.finalUsageCounts).length > 0) { finalAllocationHTML += `\n   Uso: { ${Object.entries(finalAlloc.finalUsageCounts).map(([lpd, count]) => `"${formatNumberPtBR(lpd)}": ${formatNumberPtBR(count)}`).join(', ')} }`; }
                         else { finalAllocationHTML += `\n   Uso: {}`; }
                     } else { finalAllocationHTML += `   (Nenhum Plano alocado)`; }
                 } else { finalAllocationHTML += "<span class='error'>Estrutura Aloc Inválida</span>"; }
                 finalAllocationHTML += `</div>`;
             });
         } else { finalAllocationHTML += '<span class="error">Incompatibilidade Especificação/Aloc.</span>'; }
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = finalAllocationHTML;

         // --- 2. Generate HTML for Cumulative Usage (Log View) ---
          let usageSummaryHTML = `<div class="usage-summary">--- Uso Acumulado de Planos (Estrat: ${selectedResult.strategyName}, Imagens Máx/Inst: ${maxSlotsDisplayLocal}) ---<ul>`;
          if (uniqueLpdValuesDisplay && uniqueLpdValuesDisplay.length > 0) {
              uniqueLpdValuesDisplay.forEach(lpd => {
                  const initialTotal = initialTotalSlotsPerValueLocal[lpd] || 0;
                  const usedTotal = finalCumulativeUsage[lpd] || 0;
                  let remainingTotal = Infinity;
                  if(maxSlotsIsFinite) { remainingTotal = finalRemainingSlots.hasOwnProperty(lpd) ? finalRemainingSlots[lpd] : (initialTotal - usedTotal); }
                  const numInstances = lpdInstanceCountsLocal[lpd] || 0;
                  // **** CALL TO utils.js **** (three times inside formatNumberPtBR)
                  usageSummaryHTML += `<li>Plano <b>${formatNumberPtBR(lpd)}</b> (${formatNumberPtBR(numInstances)} inst): Usado <b>${formatNumberPtBR(usedTotal)}</b>`;
                  if (maxSlotsIsFinite) {
                      // **** CALL TO utils.js **** (twice inside formatNumberPtBR)
                      usageSummaryHTML += ` (Inicial: ${formatNumberPtBR(initialTotal)}, Rem: ${formatNumberPtBR(remainingTotal)})`;
                      if (remainingTotal < 0) { usageSummaryHTML += ` <span class="error">(Erro de Imagem!)</span>`; }
                      else if (usedTotal + remainingTotal !== initialTotal && initialTotal !== Infinity) { console.warn(`Incompatibilidade Imagem Plano ${lpd}: Usado ${usedTotal}, Rem ${remainingTotal}, Inicial ${initialTotal}. Estrat: ${strategyName}`); usageSummaryHTML += ` <span class="warning">(Incompatibilidade Contagem?)</span>`; }
                  }
                  usageSummaryHTML += `</li>`;
              });
          } else { usageSummaryHTML += "<li>Nenhum Plano para rastrear.</li>"; }
          usageSummaryHTML += "</ul></div>";
         if(cumulativeUsageDiv) cumulativeUsageDiv.innerHTML = usageSummaryHTML;


         // --- 3. Generate HTML for Plan Assembly (Montagem dos Planos) USING PRE-GENERATED DATA ---
         let lpdBreakdownHTML = `<div class="lpd-section-title" style="text-align: center; font-size: 1.1em; margin-bottom: 1rem;">--- Montagem dos Planos (Estratégia: ${selectedResult.strategyName}) ---</div>`;
         let totalGlobalSheets = 0;
         if (planAssemblyDataForExport && planAssemblyDataForExport.length > 0) {
             let overallPlanIndex = 0;
             planAssemblyDataForExport.forEach(instance => {
                 if (instance.items && instance.items.length > 0 || instance.totalUsed > 0) {
                     overallPlanIndex++;
                     lpdBreakdownHTML += `<div class="plan-container">`;
                     // **** CALL TO utils.js **** (inside formatNumberPtBR)
                     lpdBreakdownHTML += `<h1>Plano ${overallPlanIndex} - ${formatNumberPtBR(instance.planValue)} Folhas</h1>`;
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
                     lpdBreakdownHTML += `</tbody></table></div>`;

                     if (typeof instance.planValue === 'number' && instance.planValue > 0) {
                         totalGlobalSheets += instance.planValue;
                     }
                 }
             });
             if (overallPlanIndex === 0) { lpdBreakdownHTML += "<p style='text-align: center; color: var(--text-muted);'>Nenhuma instância de plano com itens alocados para exibir.</p>"; }

             // **** CALL TO utils.js **** (inside formatNumberPtBR)
             lpdBreakdownHTML += `<div class="total-sheets-summary">
                                             Total Geral (Todos os Planos): ${formatNumberPtBR(totalGlobalSheets)} Folhas
                                          </div>`;

         } else {
              lpdBreakdownHTML += "<p style='text-align: center; color: var(--text-muted);'>Dados da montagem dos planos não disponíveis ou vazios.</p>";
              if(selectedResult.hasAllocationError) { lpdBreakdownHTML += `<p style='text-align: center; color: var(--warning);'>(Nota: A alocação para esta estratégia encontrou erros.)</p>`; }
         }
         if(lpdBreakdownDiv) lpdBreakdownDiv.innerHTML = lpdBreakdownHTML;


         // --- 4. Generate HTML for Final Summary Table (Tabela Comparativa) ---
         console.log(`[displayStrategyDetails] Generating summary table for ${strategyName}.`);
         let summaryTableHTML = `<div class="lpd-section-title">--- Tabela Comparativa (Estrat: ${selectedResult.strategyName}) ---</div><table id="finalSummaryTable"><thead><tr><th>Especificação</th><th>Quantidade</th><th>Empenho</th><th>Dif</th><th>Var (%)</th></tr></thead><tbody>`;
         const allocationMap = new Map();
         finalItems.forEach((item, i) => { if(item) allocationMap.set(item.originalIndex, { itemData: item, allocationData: finalAllocations[i] }); });

         let totalOriginal = 0; let totalEmpenhado = 0;

         if (originalItemsUnsorted && originalItemsUnsorted.length > 0) {
             originalItemsUnsorted.forEach(originalItem => {
                 if (!originalItem) { console.warn("Skipping invalid original item in summary table gen."); return; }
                 totalOriginal += originalItem.amount;
                 const resultEntry = allocationMap.get(originalItem.originalIndex);
                 let Especificação = originalItem.details;
                 let quantidadeNum = originalItem.amount;
                 // **** CALL TO utils.js ****
                 let quantidadeFmt = formatNumberPtBR(quantidadeNum);
                 let empenhoHtml = '<span class="warning">N/A</span>'; let difHtml = '<span class="warning">N/A</span>'; let varHtml = '<span class="warning">N/A</span>';

                 if (resultEntry && resultEntry.allocationData) {
                     const finalAlloc = resultEntry.allocationData;
                     if (!finalAlloc.error && finalAlloc.sum !== undefined) {
                         const empenhoNum = finalAlloc.sum;
                         // **** CALL TO utils.js ****
                         empenhoHtml = formatNumberPtBR(empenhoNum); totalEmpenhado += empenhoNum;
                         const difNum = finalAlloc.difference; let difClass = difNum === 0 ? 'zero-diff' : (difNum > 0 ? 'positive-diff' : 'negative-diff'); let difSign = difNum > 0 ? '+' : '';
                         // **** CALL TO utils.js ****
                         difHtml = `<span class="${difClass}">${difSign}${formatNumberPtBR(difNum)}</span>`;
                         // Uses globals REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 from utils.js
                         if (quantidadeNum > 0) { const percentage = (difNum / quantidadeNum); if (isFinite(percentage)){ const percentageFmt = (percentage * 100).toFixed(1) + '%'; varHtml = `<span class="${difClass}">${percentageFmt}</span>`; if (Math.abs(percentage) > REPROCESS_VARIATION_LIMIT) { varHtml = `<span class="violation">${percentageFmt}</span>`; } else if (Math.abs(percentage) > VARIATION_LIMIT_PASS_3) { varHtml = `<span class="warning">${percentageFmt}</span>`; } } else { varHtml = `<span class="violation">Inf%</span>`; } }
                         else if (empenhoNum !== 0) { varHtml = `<span class="violation">N/A</span>`; }
                         else { varHtml = '<span class="zero-diff">0.0%</span>'; }
                     } else if (finalAlloc.error) { empenhoHtml = `<span class="error">Erro</span>`; let shortError = finalAlloc.error.length > 50 ? finalAlloc.error.substring(0, 47) + '...' : finalAlloc.error; difHtml = `<span class="error" title="${finalAlloc.error}">${shortError}</span>`; varHtml = `<span class="error">Erro</span>`; }
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
         let totalDifSign = totalDiferenca > 0 ? '+' : '';
         let totalVarHtml = '';
         if (totalOriginal > 0) { const totalPercentage = (totalDiferenca / totalOriginal) * 100; if (isFinite(totalPercentage)) { totalVarHtml = `<span class="${totalDifClass}">${totalPercentage.toFixed(1)}%</span>`; } else { totalVarHtml = `<span class="violation">Inf%</span>`; } }
         else if (totalEmpenhado === 0) { totalVarHtml = `<span class="zero-diff">0.0%</span>`; }
         else { totalVarHtml = `<span class="positive-diff">N/A</span>`; }

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
         updateComparisonTableHighlight(strategyName); // Function is in this file
         console.log(`[displayStrategyDetails] Finished updateComparisonTableHighlight for ${strategyName}.`);


     // --- Error Handling for Display ---
     } catch (e) {
         console.error(`[displayStrategyDetails] CRITICAL Error while displaying details for ${strategyName}:`, e);
         if(statusAreaDiv) statusAreaDiv.innerHTML = `<span class="error">Erro CRÍTICO ao exibir detalhes para "${strategyName}". Verifique o console. Err: ${e.message}</span>`;
         // Clear potentially broken output areas
         if(allocationResultsDiv) allocationResultsDiv.innerHTML = '<span class="error">Erro de Exibição</span>';
         if(adjustmentLogDiv) adjustmentLogDiv.innerHTML = ''; if(variationLogDiv) variationLogDiv.innerHTML = '';
         if(cumulativeUsageDiv) cumulativeUsageDiv.innerHTML = ''; if(lpdBreakdownDiv) lpdBreakdownDiv.innerHTML = ''; if(finalSummaryTableDiv) finalSummaryTableDiv.innerHTML = '';
         if(detailsTitle) detailsTitle.innerHTML = `Resultados Detalhados (Erro)`;
         globalCurrentlyDisplayedStrategyName = null; // Reset global
     }
     console.log(`[displayStrategyDetails] END for: ${strategyName}`);
} // End displayStrategyDetails