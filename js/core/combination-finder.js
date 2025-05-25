// --- FUNÇÃO FINDER DE COMBINAÇÃO (findBestLpdCombination) ---
// Modified to return multiple combinations
function findBestLpdCombination(parsedItemsData, maxSlotsForTargetCalc, requestedCombinationSize) {
    const functionLog = [];
    let foundCombinations = []; // Changed from single value to array
    let finderStatus = "OK";
    const uniqueCombinationStrings = new Set(); // To track uniqueness

    // --- Validation and LPD Frequency Calculation ---
    if (!parsedItemsData || parsedItemsData.length === 0) { return { combinations: [], log: '<span class="error">Erro do Finder: Nenhum dado de Especificação processado.</span>', status: "Error" }; } // Return empty array
    if (isNaN(maxSlotsForTargetCalc) || maxSlotsForTargetCalc <= 0) { return { combinations: [], log: '<span class="error">Erro do Finder: Imagens Máx. Inválidas.</span>', status: "Error" }; }
    if (isNaN(requestedCombinationSize) || requestedCombinationSize < 1) { return { combinations: [], log: `<span class="error">Erro do Finder: Tamanho Combo Inválido (>= 1).</span>`, status: "Error" }; }
    const lpdFrequencies = {}; const validRawAmounts = []; let minAmountFound = Infinity; let sumAmounts = 0;
    parsedItemsData.forEach(item => { const amount = item.amount; validRawAmounts.push(amount); sumAmounts += amount; if (amount < minAmountFound) minAmountFound = amount; const lpd = Math.round(amount / 2); if (lpd >= MIN_LPD_VALUE) { lpdFrequencies[lpd] = (lpdFrequencies[lpd] || 0) + 1; } });
    if (validRawAmounts.length === 0) { return { combinations: [], log: `<span class="error">Erro do Finder: Nenhuma quantidade válida.</span>`, status: "Error"}; } // Return empty array
    if (sumAmounts === 0 && validRawAmounts.some(a => a !== 0)) { functionLog.push(`<span class="warning">Aviso do Finder: Soma 0 apesar de itens não-zero.</span>`); }
    else if (sumAmounts === 0) { functionLog.push(`Info do Finder: Soma total 0.`); }
    const uniqueValidLpdListWithFreq = Object.entries(lpdFrequencies).map(([lpd, freq]) => ({ value: parseInt(lpd), frequency: freq })).sort((a, b) => b.frequency - a.frequency || b.value - a.value);

    // --- Logging ---
    functionLog.push(`--- Registro do Finder de Combinação (Método 'Melhor') ---`);
    functionLog.push(`Qtd Mín Bruta: ${minAmountFound === Infinity ? 'N/A' : minAmountFound}, Soma Total: ${sumAmounts}`);
    functionLog.push(`Imagens Máx (Alvo): ${maxSlotsForTargetCalc}, Tam. Combo Req.: ${requestedCombinationSize}`);
    functionLog.push(`Planos Válidos Únicos (>=${MIN_LPD_VALUE}): ${uniqueValidLpdListWithFreq.length}`);
    functionLog.push(`Planos (Freq/Valor Ord.): ${uniqueValidLpdListWithFreq.map(l => `${l.value}(${l.frequency})`).join(', ')}`);
    let minLpdValueFound = Infinity; uniqueValidLpdListWithFreq.forEach(lpdObj => { if (lpdObj.value < minLpdValueFound) minLpdValueFound = lpdObj.value; });
    functionLog.push(`Plano Mín Válido: ${minLpdValueFound === Infinity ? 'Nenhum' : minLpdValueFound}`);
    // Uses global OBLIGATORY_RANGE from utils.js
    const obligatoryCandidates = minLpdValueFound === Infinity ? [] : uniqueValidLpdListWithFreq.filter(lpdObj => Math.abs(lpdObj.value - minLpdValueFound) <= OBLIGATORY_RANGE).sort((a, b) => a.value - b.value);
    functionLog.push(`Candidatos Próximos ao Mín (+/- ${OBLIGATORY_RANGE}): ${obligatoryCandidates.length} [${obligatoryCandidates.map(c=>c.value).join(', ')}]`);

    // --- Logic based on Obligatory Candidates ---
    if (obligatoryCandidates.length === 0 && requestedCombinationSize > 1) {
        /* --- FALLBACK MDC --- */
        functionLog.push(`<span class="fallback-gcd">ALERTA: Nenhum Plano próximo ao mín. Usando Fallback MDC.</span>`);
        let fallbackLog = [`<div class="fallback-section">--- Cálculo Fallback MDC ---`];
        // Uses global function arrayGcd from utils.js
        const baseTargetAmount = sumAmounts / maxSlotsForTargetCalc; fallbackLog.push(`Quantidade Alvo Base: ${baseTargetAmount.toFixed(2)}`);
        if (validRawAmounts.length < 1) { fallbackLog.push(`<span class="error">Erro: Nenhuma quantidade válida para MDC.</span>`); finderStatus = "Error"; }
        else {
            const gcdAmounts = arrayGcd(validRawAmounts);
            fallbackLog.push(`MDC das quantidades: ${gcdAmounts}`);
            if (gcdAmounts <= 0) { fallbackLog.push(`<span class="error">Erro: MDC <= 0 (${gcdAmounts}).</span>`); finderStatus = "Error"; }
            else {
                // Uses global function roundToNearest from utils.js
                const fallbackTarget = baseTargetAmount === 0 ? 0 : roundToNearest(baseTargetAmount, gcdAmounts);
                fallbackLog.push(`Alvo Fallback (múltiplo MDC): ${fallbackTarget}`);
                if (fallbackTarget < 0) { fallbackLog.push(`<span class="error">Erro: Alvo Fallback < 0.</span>`); finderStatus = "Error"; }
                else {
                    let fallbackK = fallbackTarget === 0 ? 0 : Math.round(fallbackTarget / gcdAmounts);
                    // FIX: Handle K=0 when GCD is valid
                    if (fallbackK === 0 && gcdAmounts > 0 && sumAmounts > 0 && requestedCombinationSize >= 1) {
                         fallbackLog.push(`   -> Alvo arredondado para 0, mas GCD (${gcdAmounts}) é válido. Forçando K=1.`);
                         fallbackK = 1;
                     }
                    if (fallbackK < 0) { fallbackLog.push(`<span class="error">Erro: Unidades MDC < 0.</span>`); finderStatus = "Error"; }
                    else {
                        fallbackLog.push(`Unidades MDC necessárias: ${fallbackK}`);
                        const singleFallbackCombo = fallbackK > 0 ? Array(fallbackK).fill(gcdAmounts) : [];
                        if (singleFallbackCombo.length > 0) {
                             // Check uniqueness just in case (though unlikely for fallback)
                             const comboString = JSON.stringify(singleFallbackCombo);
                             if (!uniqueCombinationStrings.has(comboString)){
                                 uniqueCombinationStrings.add(comboString);
                                 foundCombinations.push(singleFallbackCombo); // Add the single fallback result
                             }
                             fallbackLog.push(`<span class="highlight fallback-gcd">Resultado Fallback MDC: [${singleFallbackCombo.join(', ')}]</span> (Tamanho: ${fallbackK})`);
                        } else {
                             fallbackLog.push(`<span class="warning fallback-gcd">Resultado Fallback MDC: Vazio</span>`);
                        }
                    }
                }
            }
        }
        functionLog.push(fallbackLog.join('\n') + `</div>`);

    } else {
        /* --- PADRÃO (STANDARD SEARCH) / FALLBACK PROPORCIONAL --- */
        let standardSearchAttempted = false;
        // Remove overallBestCombination, overallBestFrequencyScore, overallBestTargetSum variables

        if (obligatoryCandidates.length > 0) {
            standardSearchAttempted = true; functionLog.push(`<span class="info">Estratégia padrão selecionada.</span>`);
            // Uses globals TARGET_RANGE_BELOW, TARGET_RANGE_ABOVE, TARGET_STEP from utils.js
            const baseTargetLPD = sumAmounts / maxSlotsForTargetCalc; const lowerBound = baseTargetLPD - TARGET_RANGE_BELOW; const upperBound = baseTargetLPD + TARGET_RANGE_ABOVE; const targetsToTest = []; const firstMultiple = Math.ceil(lowerBound / TARGET_STEP) * TARGET_STEP; const lastMultiple = Math.floor(upperBound / TARGET_STEP) * TARGET_STEP; for (let target = firstMultiple; target <= lastMultiple; target += TARGET_STEP) { if (target > 0 || (target === 0 && baseTargetLPD === 0)) targetsToTest.push(target); }
            functionLog.push(`Plano Alvo Base: ${baseTargetLPD.toFixed(2)}, Intervalo [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`);

            if (targetsToTest.length === 0) { functionLog.push(`<span class="warning">Aviso: Nenhum múltiplo alvo no intervalo.</span>`); }
            else {
                functionLog.push(`Somas Alvo para Testar: [${targetsToTest.join(', ')}]`); const neededOtherLpds = requestedCombinationSize - 1; functionLog.push(`--- Busca de Combinação (Método Padrão, Precisa de ${neededOtherLpds} outros) ---`);
                for (const currentTargetSum of targetsToTest) {
                    functionLog.push(`<div class="target-section">--- Testando Soma Alvo: ${currentTargetSum} ---`); let foundCombinationForThisTarget = false; // Track if *any* new combo was found for this target
                    for (const currentObligatoryCandidate of obligatoryCandidates) {
                        const currentObligatoryLpdValue = currentObligatoryCandidate.value; functionLog.push(`<div class="candidate-section">=== Tentando Plano Obrigatório: ${currentObligatoryLpdValue} ===`); const searchLpdList = uniqueValidLpdListWithFreq.filter(lpdObj => lpdObj.value !== currentObligatoryLpdValue);
                        // Uses global MIN_LPD_VALUE from utils.js
                        if (neededOtherLpds > 0 && searchLpdList.length < neededOtherLpds) { functionLog.push(`   Pulando: Não há outros suficientes (${searchLpdList.length}) para tamanho ${requestedCombinationSize}.`); functionLog.push(`</div>`); continue; }
                        const targetForRecursion = currentTargetSum - currentObligatoryLpdValue; functionLog.push(`   Alvo para os ${neededOtherLpds} restantes: ${targetForRecursion.toFixed(2)}`);

                        if (neededOtherLpds === 0) { // Case: Combination size is 1
                            if (Math.abs(targetForRecursion) < 0.01 && currentObligatoryLpdValue >= MIN_LPD_VALUE) { // Check if the single LPD is valid
                                const currentFullCombination = [currentObligatoryLpdValue]; // Already sorted
                                const comboString = JSON.stringify(currentFullCombination);
                                if (!uniqueCombinationStrings.has(comboString)) {
                                    uniqueCombinationStrings.add(comboString);
                                    foundCombinations.push(currentFullCombination);
                                    functionLog.push(`   <span class="success">Combinação Única Encontrada (Tam 1): [${currentFullCombination.join(', ')}]</span>`);
                                    foundCombinationForThisTarget = true;
                                } else {
                                    // Log that this combo was already found if needed
                                    // functionLog.push(`   -> Combinação [${currentFullCombination.join(', ')}] já encontrada.`);
                                }
                            } else {
                                if(Math.abs(targetForRecursion) >= 0.01) functionLog.push(`   -> Alvo (${currentTargetSum}) != Plano (${currentObligatoryLpdValue}).`);
                                if(currentObligatoryLpdValue < MIN_LPD_VALUE) functionLog.push(`   -> Plano (${currentObligatoryLpdValue}) < Mín (${MIN_LPD_VALUE}).`);
                            }
                        } else if (targetForRecursion >= -0.01) { // Case: Need more LPDs
                            const adjustedTargetForRecursion = Math.max(0, targetForRecursion);
                            // Uses global function findSumCombinationRecursive from utils.js
                            let foundKMinus1Combination = findSumCombinationRecursive(searchLpdList, adjustedTargetForRecursion, neededOtherLpds, 0, []);
                            if (foundKMinus1Combination !== null) {
                                const currentFullCombination = [...foundKMinus1Combination, currentObligatoryLpdValue].sort((a, b) => a - b);
                                const comboString = JSON.stringify(currentFullCombination);
                                if (!uniqueCombinationStrings.has(comboString)) {
                                    uniqueCombinationStrings.add(comboString);
                                    foundCombinations.push(currentFullCombination);
                                    functionLog.push(`   <span class="success">Combinação Única Encontrada: [${currentFullCombination.join(', ')}]</span>`);
                                    foundCombinationForThisTarget = true;
                                } else {
                                    // functionLog.push(`   -> Combinação [${currentFullCombination.join(', ')}] já encontrada.`);
                                }
                            } else {
                                functionLog.push(`   -> Nenhuma combo de ${neededOtherLpds} encontrada para ${adjustedTargetForRecursion.toFixed(2)}.`);
                            }
                        } else {
                             functionLog.push(`   -> Alvo restante (${targetForRecursion.toFixed(2)}) negativo.`);
                        }
                        functionLog.push(`</div>`); // Close candidate-section
                    }
                     if (!foundCombinationForThisTarget) {
                         functionLog.push(`   <span class="info">Nenhuma combinação nova/única encontrada para o alvo ${currentTargetSum}.</span>`);
                     }
                     functionLog.push(`</div>`); // Close target-section
                }
            }
        }

        // Check if standard search yielded results, if not, consider proportional fallback
        if (foundCombinations.length === 0) {
            if (standardSearchAttempted) { functionLog.push(`<span class="error">Método Padrão Falhou em encontrar combinações. Tentando Proporcional.</span>`); }
            else if (requestedCombinationSize > 1) { functionLog.push(`<span class="info">Padrão Pulado (Sem candidatos próx. ao min). Tentando Proporcional.</span>`); }

            /* --- FALLBACK PROPORCIONAL --- */
            // Uses global PROPORTIONAL_ROUNDING_STEP from utils.js
            functionLog.push(`<span class="fallback-prop">ALERTA: Usando Fallback Proporcional (Arredondar para ${PROPORTIONAL_ROUNDING_STEP}).</span>`);
            let propFallbackLog = [`<div class="proportional-fallback-section">--- Cálculo Fallback Proporcional ---`];
            const averageValuePerSlot = (maxSlotsForTargetCalc > 0 && sumAmounts > 0) ? (sumAmounts / maxSlotsForTargetCalc) : 0; propFallbackLog.push(`Valor Médio por Imagem: ${averageValuePerSlot.toFixed(2)}`);
            let singlePropCombo = null;

             if (requestedCombinationSize === 1) {
                  // Uses global function roundToNearest from utils.js
                  const roundedAverage = roundToNearest(averageValuePerSlot, PROPORTIONAL_ROUNDING_STEP);
                  if (roundedAverage <= 0 && averageValuePerSlot > 0) { propFallbackLog.push(`<span class="error">Erro: Média arredondada <= 0.</span>`); finderStatus = "Error"; }
                  else if (roundedAverage <= 0) { propFallbackLog.push(`Info: Média arredondada <= 0. Usando combo vazia.`); singlePropCombo = []; }
                  else { singlePropCombo = [roundedAverage]; }
                  if (singlePropCombo !== null) propFallbackLog.push(`Combo Calculada (Tam 1): [${singlePropCombo.join(', ')}]`);
             } else {
                 if (uniqueValidLpdListWithFreq.length < requestedCombinationSize) { propFallbackLog.push(`<span class="error">Erro: Planos únicos insuficientes (${uniqueValidLpdListWithFreq.length}) para tamanho ${requestedCombinationSize}.</span>`); finderStatus = "Error"; }
                 else {
                     const selectedTopLpds = uniqueValidLpdListWithFreq.slice(0, requestedCombinationSize);
                     const selectedLpdValues = selectedTopLpds.map(lpd => lpd.value); propFallbackLog.push(`Top ${requestedCombinationSize} Planos: [${selectedLpdValues.join(', ')}]`);
                     const totalLpdValueMass = selectedLpdValues.reduce((sum, val) => sum + val, 0); propFallbackLog.push(`Soma dos Planos (Base): ${totalLpdValueMass}`);
                      if (totalLpdValueMass <= 0) { propFallbackLog.push(`<span class="error">Erro: Soma dos Planos <= 0.</span>`); finderStatus = "Error"; }
                      else if (averageValuePerSlot <= 0) { propFallbackLog.push(`Info: Valor médio <= 0. Resultado vazio.`); singlePropCombo = []; }
                      else {
                          propFallbackLog.push(`Distribuindo Valor Médio (${averageValuePerSlot.toFixed(2)})...`);
                          // Uses global function roundToNearest from utils.js (inside map)
                          const proportionalCombination = selectedLpdValues.map(lpdVal => roundToNearest(averageValuePerSlot * (lpdVal / totalLpdValueMass), PROPORTIONAL_ROUNDING_STEP));
                          const finalProportionalCombination = proportionalCombination.filter(v => v > 0);
                          if (finalProportionalCombination.length === 0) { propFallbackLog.push(`<span class="warning">Aviso: Proporcional resultou em nenhum Plano positivo. Usando vazio.</span>`); singlePropCombo = []; }
                          else if (finalProportionalCombination.length < requestedCombinationSize) { propFallbackLog.push(`<span class="warning">Aviso: Proporcional resultou em apenas ${finalProportionalCombination.length} Planos positivos (req ${requestedCombinationSize}). Usando valores positivos.</span>`); singlePropCombo = finalProportionalCombination.sort((a,b) => a - b); }
                          else { singlePropCombo = finalProportionalCombination.sort((a,b) => a - b).slice(0, requestedCombinationSize); }
                          if (singlePropCombo !== null) { const sumOfProp = singlePropCombo.reduce((sum, val) => sum + val, 0); propFallbackLog.push(`Combo Proporcional Calculada (Arred., >0): [${singlePropCombo.join(', ')}]`); propFallbackLog.push(`Soma: ${sumOfProp} (vs Média Imagem: ${averageValuePerSlot.toFixed(2)})`); }
                     }
                 }
             }

             if (singlePropCombo !== null && singlePropCombo.length > 0) {
                 const comboString = JSON.stringify(singlePropCombo); // Check uniqueness again
                 if (!uniqueCombinationStrings.has(comboString)) {
                     uniqueCombinationStrings.add(comboString);
                     foundCombinations.push(singlePropCombo);
                 } else {
                      propFallbackLog.push(`Combo Proporcional [${singlePropCombo.join(', ')}] já encontrada anteriormente.`);
                 }
             } else if (singlePropCombo === null) {
                 propFallbackLog.push(`<span class='error'>Falha no cálculo proporcional.</span>`);
             }

            functionLog.push(propFallbackLog.join('\n') + `</div>`);
        }
    }

    // Return the list of unique combinations found
    return { combinations: foundCombinations, log: functionLog.join('\n'), status: finderStatus };
}


// --- FUNÇÃO DE COMBINAÇÃO PROPORCIONAL DIRETA ---
// (Remains largely the same, but ensure it returns the correct structure if needed later)
function calculateDirectProportionalCombination(parsedItemsData, maxSlotsForTargetCalc, requestedCombinationSize) {
    const functionLog = [];
    let foundCombination = null; // Still finds only one
    let finderStatus = "OK";
     // --- Validation and LPD Frequency Calculation ---
     // Uses global MIN_LPD_VALUE, OBLIGATORY_RANGE from utils.js
    if (!parsedItemsData || parsedItemsData.length === 0) { return { combination: null, log: '<span class="error">Erro Calc Prop: Nenhum dado de Especificação processado.</span>', status: "Error" }; }
    if (isNaN(maxSlotsForTargetCalc) || maxSlotsForTargetCalc <= 0) { return { combination: null, log: '<span class="error">Erro Calc Prop: Imagens Máx. Inválidas.</span>', status: "Error" }; }
    if (isNaN(requestedCombinationSize) || requestedCombinationSize < 1) { return { combination: null, log: `<span class="error">Erro Calc Prop: Tamanho Combo Inválido (>= 1).</span>`, status: "Error" }; }
    const lpdFrequencies = {}; const validRawAmounts = []; const allValidLpds = [];
    let sumAmounts = 0; let minAmountFound = Infinity;
    parsedItemsData.forEach(item => { const amount = item.amount; validRawAmounts.push(amount); sumAmounts += amount; if (amount < minAmountFound) minAmountFound = amount; const lpd = Math.round(amount / 2); if (lpd >= MIN_LPD_VALUE) { lpdFrequencies[lpd] = (lpdFrequencies[lpd] || 0) + 1; allValidLpds.push(lpd); } });
    if (validRawAmounts.length === 0) { return { combination: null, log: `<span class="error">Erro Calc Prop: Nenhuma quantidade válida.</span>`, status: "Error"}; }
     if (sumAmounts === 0 && validRawAmounts.some(a => a !== 0)) { functionLog.push(`<span class="warning">Aviso Calc Prop: Soma 0 apesar de itens não-zero.</span>`); }
     else if (sumAmounts === 0) { functionLog.push(`Info Calc Prop: Soma total 0.`); }
    const uniqueValidLpdListWithFreq = Object.entries(lpdFrequencies).map(([lpd, freq]) => ({ value: parseInt(lpd), frequency: freq })).sort((a, b) => b.frequency - a.frequency || b.value - a.value);
    let minLpdValueFound = Infinity; if (allValidLpds.length > 0) { minLpdValueFound = Math.min(...allValidLpds); }
    const nearMinLpds = minLpdValueFound === Infinity ? [] : uniqueValidLpdListWithFreq.filter(lpdObj => Math.abs(lpdObj.value - minLpdValueFound) <= OBLIGATORY_RANGE).sort((a, b) => b.frequency - a.frequency || a.value - b.value);

    // --- Logging ---
    functionLog.push(`--- Registro de Cálculo Proporcional Direto ---`);
    functionLog.push(`Qtd Mín Bruta: ${minAmountFound === Infinity ? 'N/A' : minAmountFound}, Soma Total: ${sumAmounts}`);
    functionLog.push(`Imagens Máx (Alvo): ${maxSlotsForTargetCalc}, Tam. Combo Req.: ${requestedCombinationSize}`);
    functionLog.push(`Planos Válidos Únicos (>=${MIN_LPD_VALUE}): ${uniqueValidLpdListWithFreq.length}`);
    functionLog.push(`Planos (Freq/Valor Ord.): ${uniqueValidLpdListWithFreq.map(l => `${l.value}(${l.frequency})`).join(', ')}`);
    functionLog.push(`Plano Mín Válido: ${minLpdValueFound === Infinity ? 'Nenhum' : minLpdValueFound}`);
    functionLog.push(`Candidatos Próximos ao Mín (+/- ${OBLIGATORY_RANGE}): ${nearMinLpds.length} [${nearMinLpds.map(c=>c.value + '(' + c.frequency + ')').join(', ')}]`);

    // --- Error Check ---
    if (uniqueValidLpdListWithFreq.length < requestedCombinationSize && requestedCombinationSize > 0) {
         functionLog.push(`<span class="error">Erro: Planos válidos únicos insuficientes (${uniqueValidLpdListWithFreq.length}) disponíveis para o tamanho solicitado ${requestedCombinationSize}.</span>`);
         return { combination: null, log: functionLog.join('\n'), status: "Error" };
     }

    // --- Selection Logic (with Min LPD Rule) ---
    functionLog.push(`--- Selecionando Planos para Cálculo Proporcional ---`);
    let selectionLog = [];
    let finalSelectedLpdsForProportion = [];
    if (requestedCombinationSize === 1) {
        selectionLog.push(`Tam. combo 1: Ajuste da regra do Plano Mín não aplicado à seleção.`);
        if (uniqueValidLpdListWithFreq.length > 0) { finalSelectedLpdsForProportion = [uniqueValidLpdListWithFreq[0]]; selectionLog.push(`(Usando valor médio; Plano Top para referência: ${finalSelectedLpdsForProportion[0].value})`); }
        else { selectionLog.push(`(Nenhum Plano único encontrado).`); }
    } else if (requestedCombinationSize > 1) {
        const initialTopLpds = uniqueValidLpdListWithFreq.slice(0, requestedCombinationSize);
        selectionLog.push(`Top ${requestedCombinationSize} Planos Iniciais (por Freq/Valor): [${initialTopLpds.map(l => `${l.value}(${l.frequency})`).join(', ')}]`);
        const initialSelectionValues = initialTopLpds.map(lpd => lpd.value);
        const meetsMinLpdRule = nearMinLpds.length === 0 || initialSelectionValues.some(val => nearMinLpds.some(nearLpd => nearLpd.value === val));

        if (meetsMinLpdRule) {
            selectionLog.push(`<span class="info">Regra do Plano Mín Atendida: Seleção inicial inclui Plano próximo ao mín (ou nenhum existe).</span>`);
            finalSelectedLpdsForProportion = initialTopLpds;
        } else {
            selectionLog.push(`<span class="warning">Regra do Plano Mín NÃO Atendida: Tentando substituição.</span>`);
            if (nearMinLpds.length > 0) {
                const bestNearMinLpd = nearMinLpds[0];
                selectionLog.push(`   - Melhor Candidato Próximo ao Mín: ${bestNearMinLpd.value}(${bestNearMinLpd.frequency})`);
                let indexToReplace = -1; let minFreq = Infinity; let minValueAtMinFreq = Infinity;
                for(let i = 0; i < initialTopLpds.length; i++) { const lpd = initialTopLpds[i]; if (nearMinLpds.some(near => near.value === lpd.value)) continue; if (lpd.frequency < minFreq) { minFreq = lpd.frequency; minValueAtMinFreq = lpd.value; indexToReplace = i; } else if (lpd.frequency === minFreq && lpd.value < minValueAtMinFreq) { minValueAtMinFreq = lpd.value; indexToReplace = i; } }
                if (indexToReplace !== -1) {
                    const lpdToReplace = initialTopLpds[indexToReplace];
                    selectionLog.push(`   - Plano a Substituir (Menor Freq): ${lpdToReplace.value}(${lpdToReplace.frequency})`);
                    let adjustedSelectedTopLpds = [...initialTopLpds]; adjustedSelectedTopLpds[indexToReplace] = bestNearMinLpd;
                    adjustedSelectedTopLpds.sort((a, b) => b.frequency - a.frequency || a.value - b.value);
                    finalSelectedLpdsForProportion = adjustedSelectedTopLpds;
                    selectionLog.push(`<span class="info">   => Planos Finais para Cálculo: [${finalSelectedLpdsForProportion.map(l => `${l.value}(${l.frequency})`).join(', ')}]</span>`);
                } else {
                     selectionLog.push(`<span class="warning">   - Não foi possível encontrar Plano adequado para substituir. Usando seleção inicial.</span>`);
                     finalSelectedLpdsForProportion = initialTopLpds;
                }
            } else {
                selectionLog.push(`<span class="warning">   - Nenhum candidato próximo ao mínimo disponível para substituição. Usando seleção inicial.</span>`);
                finalSelectedLpdsForProportion = initialTopLpds;
            }
        }
    } else {
         selectionLog.push(`Tamanho de combinação solicitado é 0. O resultado será vazio.`);
         finalSelectedLpdsForProportion = [];
    }
    functionLog.push(selectionLog.join('\n'));

    // --- Proportional Calculation ---
    // Uses global PROPORTIONAL_ROUNDING_STEP from utils.js
    functionLog.push(`<div class="proportional-direct-section">--- Cálculo Proporcional ---`);
    let propCalcLog = [];
    const averageValuePerSlot = (maxSlotsForTargetCalc > 0 && sumAmounts > 0) ? (sumAmounts / maxSlotsForTargetCalc) : 0;
    propCalcLog.push(`Valor Médio por Imagem: ${averageValuePerSlot.toFixed(2)}`);

    if (requestedCombinationSize === 1) {
        propCalcLog.push(`Tam. combo 1: Usando média arredondada.`);
        // Uses global function roundToNearest from utils.js
        const roundedAverage = roundToNearest(averageValuePerSlot, PROPORTIONAL_ROUNDING_STEP);
         if (roundedAverage <= 0 && averageValuePerSlot > 0) { propCalcLog.push(`<span class="error">Erro: Média arredondada <= 0.</span>`); finderStatus = "Error"; }
         else if (roundedAverage <= 0) { propCalcLog.push(`Info: Média arredondada <= 0. Usando combo vazia.`); foundCombination = []; }
         else { foundCombination = [roundedAverage]; }
         if (foundCombination !== null) propCalcLog.push(`Combo Calculada (Tam 1): [${foundCombination.join(', ')}]`);
    } else if (requestedCombinationSize > 1) {
        const selectedLpdValues = finalSelectedLpdsForProportion.map(lpd => lpd.value);
        propCalcLog.push(`Usando Valores de Planos para Proporções: [${selectedLpdValues.join(', ')}] (Da etapa de seleção)`);
        const totalLpdValueMass = selectedLpdValues.reduce((sum, val) => sum + val, 0);
        propCalcLog.push(`Soma dos Planos (Base): ${totalLpdValueMass}`);
        if (totalLpdValueMass <= 0) { propCalcLog.push(`<span class="error">Erro: Soma dos Planos selecionados <= 0.</span>`); finderStatus = "Error"; }
        else if (averageValuePerSlot <= 0) { propCalcLog.push(`Info: Valor médio <= 0. Resultado vazio.`); foundCombination = []; }
        else {
            propCalcLog.push(`Distribuindo Valor Médio (${averageValuePerSlot.toFixed(2)})...`);
            // Uses global function roundToNearest from utils.js (inside map)
            const proportionalCombination = selectedLpdValues.map(lpdVal => roundToNearest(averageValuePerSlot * (lpdVal / totalLpdValueMass), PROPORTIONAL_ROUNDING_STEP));
            const finalProportionalCombination = proportionalCombination.filter(v => v > 0);
            if (finalProportionalCombination.length === 0) { propCalcLog.push(`<span class="warning">Aviso: Proporcional resultou em nenhum Plano positivo. Usando vazio.</span>`); foundCombination = []; }
            else if (finalProportionalCombination.length < requestedCombinationSize) { propCalcLog.push(`<span class="warning">Aviso: Apenas ${finalProportionalCombination.length} Planos positivos resultaram (req ${requestedCombinationSize}). Usando valores positivos.</span>`); foundCombination = finalProportionalCombination.sort((a,b) => a - b); }
            else { foundCombination = finalProportionalCombination.sort((a,b) => a - b).slice(0, requestedCombinationSize); }
            if (foundCombination !== null) { const sumOfProp = foundCombination.reduce((sum, val) => sum + val, 0); propCalcLog.push(`Combo Proporcional Calculada (Arred., >0): [${foundCombination.join(', ')}]`); propCalcLog.push(`Soma: ${sumOfProp} (vs Média Imagem: ${averageValuePerSlot.toFixed(2)})`); }
        }
    } else {
         propCalcLog.push(`Tam. combo 0 solicitado. Resultado vazio.`);
         foundCombination = [];
    }
    functionLog.push(propCalcLog.join('\n') + `</div>`);

    // Return structure might need adjustment if this mode is used in the multi-combo flow
    // For now, it returns a single combination object
    return { combination: foundCombination, log: functionLog.join('\n'), status: finderStatus };
}