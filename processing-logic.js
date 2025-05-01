/**
 * Parses the raw text data from the textarea.
 * @param {string} textData - The raw string input from the textarea.
 * @returns {{items: Array, count: number, errors: Array, minAmount: number|Infinity, maxAmount: number|Infinity, sumAmount: number}}
 */
function parseTableData(textData) {
    let parsedItems = [];
    let parseErrors = [];
    let validItemCount = 0;
    let minRawAmount = Infinity;
    let maxRawAmount = -Infinity;
    let sumRawAmount = 0;

    if (!textData) {
        return { items: [], count: 0, errors: [], minAmount: Infinity, maxAmount: -Infinity, sumAmount: 0 };
    }

    const lines = textData.split('\n');

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return; // Skip empty lines

        let details = '';
        let amountStrRaw = '';
        let parts = line.split('\t'); // Try tab separation first

        if (parts.length >= 2) {
            amountStrRaw = parts[parts.length - 1];
            details = parts.slice(0, -1).join('\t');
        } else {
            // Fallback to space separation if tab fails
            const lastSpaceIndex = line.lastIndexOf(' ');
            if (lastSpaceIndex === -1 || lastSpaceIndex === 0) {
                // Handle cases with only one "word" or leading space incorrectly
                parts = line.split(/\s+/); // Split by any whitespace
                 if (parts.length >= 2) {
                    amountStrRaw = parts[parts.length - 1];
                    details = parts.slice(0, -1).join(' ');
                 } else {
                    parseErrors.push(`L${index + 1}: Formato inválido (separador?): "${line}"`);
                    return; // Skip this line
                 }
            } else {
                amountStrRaw = line.substring(lastSpaceIndex + 1);
                details = line.substring(0, lastSpaceIndex);
            }
        }

        // Clean and parse the amount
        let amountStrClean = amountStrRaw.replace(/[R$€]/g, '').trim(); // Remove currency symbols
        let amountStrParsed = amountStrClean.replace(/\./g, '').replace(/,/g, '.'); // Normalize decimal separator
        const amount = parseFloat(amountStrParsed);

        if (isNaN(amount)) {
            parseErrors.push(`L${index + 1}: Quantidade inválida ('${amountStrRaw}') para "${details}"`);
            return; // Skip this line
        }
        if (amount < 0) {
            parseErrors.push(`L${index + 1}: Quantidade negativa (${amount}) para "${details}"`);
            return; // Skip this line
        }

        const roundedAmount = Math.round(amount);
        parsedItems.push({ details: details, amount: roundedAmount, originalIndex: index });

        // Update counts and stats only for valid items
        validItemCount++;
        sumRawAmount += roundedAmount;
        if (roundedAmount < minRawAmount) minRawAmount = roundedAmount;
        if (roundedAmount > maxRawAmount) maxRawAmount = roundedAmount;
    });

    return {
        items: parsedItems,
        count: validItemCount,
        errors: parseErrors,
        minAmount: minRawAmount,
        maxAmount: maxRawAmount,
        sumAmount: sumRawAmount
    };
}


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


// --- LÓGICA CENTRAL DO ALOCADOR (runAllocationProcess) ---
// (This function remains unchanged)
function runAllocationProcess(itemsToProcess, userLpdCombinationWithDuplicates, maxSlotsPerInstance) {
     console.log(`[runAllocationProcess] START. items: ${itemsToProcess?.length}, LPDs: ${userLpdCombinationWithDuplicates?.length}, MaxSlots: ${maxSlotsPerInstance}`);

     const logs = { adjustment: '', variation: '' };
     const maxSlotsIsFinite = maxSlotsPerInstance !== Infinity;
     const maxSlotsDisplayLocal = maxSlotsIsFinite ? maxSlotsPerInstance : "Ilimitado";

     // Input validation
     if (!Array.isArray(itemsToProcess)) {
        console.error("[runAllocationProcess] FATAL: itemsToProcess is not an array!", itemsToProcess);
        return { itemAllocations: [], cumulativeUsage: {}, remainingSlots: {}, logs: { adjustment: '<span class="error">Erro interno: Dados de itens inválidos.</span>', variation: '' }, error: "Dados de itens inválidos (não é array)." };
     }
     if (!Array.isArray(userLpdCombinationWithDuplicates)) {
         console.warn("[runAllocationProcess] userLpdCombinationWithDuplicates is not an array, using [].");
         userLpdCombinationWithDuplicates = [];
     }

     const uniqueLpdValuesLocal = [...new Set(userLpdCombinationWithDuplicates)].filter(lpd => typeof lpd === 'number' && !isNaN(lpd) && lpd > 0).sort((a, b) => a - b);
     const lpdInstanceCountsLocal = {};
     userLpdCombinationWithDuplicates.forEach(lpd => { if(typeof lpd === 'number' && !isNaN(lpd)) lpdInstanceCountsLocal[lpd] = (lpdInstanceCountsLocal[lpd] || 0) + 1; });
     const initialTotalSlotsPerValueLocal = {};
     uniqueLpdValuesLocal.forEach(lpd => { const instances = lpdInstanceCountsLocal[lpd] || 0; initialTotalSlotsPerValueLocal[lpd] = maxSlotsIsFinite ? (instances * maxSlotsPerInstance) : Infinity; });

     // Initialize remaining slots
     const currentRemainingSlots = {};
      uniqueLpdValuesLocal.forEach(lpd => {
         currentRemainingSlots[lpd] = initialTotalSlotsPerValueLocal[lpd] ?? (maxSlotsIsFinite ? 0 : Infinity);
      });
     console.log("[runAllocationProcess] Initial unique LPDs:", uniqueLpdValuesLocal);
     console.log("[runAllocationProcess] Initial remaining slots:", JSON.stringify(currentRemainingSlots));

     // Initialize allocation array
     const currentItemAllocations = new Array(itemsToProcess.length).fill(null).map(() => ({ sum: 0, difference: 0, combination: [], finalUsageCounts: {}, error: null }));
     console.log("[runAllocationProcess] Initialized currentItemAllocations array, length:", currentItemAllocations.length);

     // Passo 1: Alocação DP Inicial
     logs.adjustment += `--- Passo 1: Alocação DP Inicial (Imagens Máx/Instância: ${maxSlotsDisplayLocal}) ---\n`;
     let step1Failed = false;
     itemsToProcess.forEach((item, i) => {
         if (step1Failed) return;
         if (!item || typeof item.details === 'undefined' || typeof item.amount === 'undefined' || typeof item.originalIndex === 'undefined') {
             const errorMsg = `Item inválido no índice de processamento ${i}`;
             logs.adjustment += `<span class="error">Erro: ${errorMsg}</span>\n`;
             console.error(`[runAllocationProcess] Passo 1: ${errorMsg}. Item data:`, item);
             currentItemAllocations[i] = { sum: 0, difference: (item?.amount ?? 0) * -1 , combination: [], finalUsageCounts: {}, error: "Item inválido" }; // Ensure difference is set
             return; // Skip this item
         }
         logs.adjustment += `[${i+1}] Espec ${item.originalIndex + 1} ('${item.details}', Alvo: ${item.amount}): `;
         console.log(`[runAllocationProcess] Passo 1, Item ${i+1}: Alvo=${item.amount}. Calling findClosestSum...`);

         // Uses global function findClosestSumWithRepetitionAndSlots from utils.js
         const allocation = findClosestSumWithRepetitionAndSlots(
              [...uniqueLpdValuesLocal],
              item.amount,
              currentRemainingSlots // Pass the mutable map
         );
         console.log(`[runAllocationProcess] Passo 1, Item ${i+1}: findClosestSum Result:`, JSON.parse(JSON.stringify(allocation)));

         currentItemAllocations[i] = {
            sum: allocation.sum ?? 0,
            difference: allocation.difference ?? (0 - item.amount),
            combination: allocation.combination ? [...allocation.combination] : [],
            finalUsageCounts: {}, // Will be calculated later
            error: allocation.error || null
         };

         if (allocation.error) {
            logs.adjustment += `<span class="error">Erro DP: ${allocation.error}</span>\n`;
             if (allocation.error.includes("Não foi possível alcançar") || allocation.error.includes("nenhum Plano tem imagens")) {
                 console.warn(`[runAllocationProcess] Passo 1, Item ${i+1}: DP could not find solution for target ${item.amount}. Error: ${allocation.error}`);
             } else {
                 console.error(`[runAllocationProcess] Passo 1, Item ${i+1}: CRITICAL DP Error for target ${item.amount}. Error: ${allocation.error}`);
                 // Maybe set step1Failed = true here if it's a critical logic error?
             }
         } else if (allocation.combination && allocation.combination.length > 0) {
            logs.adjustment += `Soma Enc ${allocation.sum} (Dif: ${allocation.difference}), Combo: [${allocation.combination.join(', ')}]\n`;
            let slotUpdateError = false;
            // Update remaining slots based on the combination found
            allocation.combination.forEach(lpd => {
                if (currentRemainingSlots.hasOwnProperty(lpd)) {
                    if (maxSlotsIsFinite) {
                        if (currentRemainingSlots[lpd] > 0) {
                            currentRemainingSlots[lpd]--;
                        } else {
                            console.error(`[runAllocationProcess] Passo 1, Item ${i+1}: SLOT ERROR! Tried to use LPD ${lpd} for item ${item.details} when remaining slots were 0!`);
                            logs.adjustment += `<span class="error">ERRO SLOT para ${lpd}!</span>\n`;
                            currentItemAllocations[i].error = (currentItemAllocations[i].error || "") + ` ERRO: Usou ${lpd} além dos slots!`;
                            slotUpdateError = true;
                            // Consider setting step1Failed = true here?
                        }
                    } // No need to decrement if slots are Infinity
                } else {
                    console.error(`[runAllocationProcess] Passo 1, Item ${i+1}: LOGIC ERROR! Used LPD ${lpd} not found in remaining slots map!`);
                    logs.adjustment += `<span class="error">ERRO LÓGICA para ${lpd}!</span>\n`;
                    currentItemAllocations[i].error = (currentItemAllocations[i].error || "") + ` ERRO: LPD ${lpd} inválido!`;
                    slotUpdateError = true;
                    // Consider setting step1Failed = true here?
                }
            });
            // If there was a slot error, might need to revert or handle differently
         } else {
              logs.adjustment += `Soma Enc ${allocation.sum} (Dif: ${allocation.difference}), Combo: []\n`;
              // No slots to update if combination is empty
         }
     }); // End Passo 1

     if (step1Failed) {
         console.error("[runAllocationProcess] Halting after fatal error in Passo 1.");
         return { itemAllocations: currentItemAllocations, cumulativeUsage: {}, remainingSlots: currentRemainingSlots, logs: logs, error: "Falha crítica no Passo 1." };
     }
     console.log("[runAllocationProcess] Passo 1 Complete. Final allocations:", JSON.parse(JSON.stringify(currentItemAllocations)));
     console.log("[runAllocatorProcess] Passo 1 Complete. Final remaining slots:", JSON.stringify(currentRemainingSlots));
     logs.adjustment += `Imagens Rem Após Passo 1: ${JSON.stringify(currentRemainingSlots)}\n`;

     // Passo 2: Preenchimento de Imagens (Slot Filling)
     console.log("[runAllocatorProcess] Starting Passo 2 (Slot Filling)...");
     let adjustmentLogHTML = `--- Passo 2: Preenchimento de Imagens (Imagens Máx/Instância: ${maxSlotsDisplayLocal}) ---`;
     if (maxSlotsIsFinite) {
         adjustmentLogHTML += `\nImagens Rem Iniciais Passo 2: ${JSON.stringify(currentRemainingSlots, null, 0)}`;
         let totalRemainingPass2 = Object.values(currentRemainingSlots).reduce((sum, count) => count === Infinity ? sum : sum + count, 0);
         adjustmentLogHTML += `\nTotal Imagens Finitas Rem: ${totalRemainingPass2}`;
         let adjustmentSafetyCounter = 0;
         const maxAdjustments = totalRemainingPass2 + itemsToProcess.length * uniqueLpdValuesLocal.length + 50; // Safety break

         while (totalRemainingPass2 > 0 && adjustmentSafetyCounter < maxAdjustments) {
            adjustmentSafetyCounter++;
            let bestMove = { lpdToAdd: null, itemIndex: -1, minImpact: Infinity, currentAbsDiff: Infinity };

            // Find the best LPD to add to which item
            for (const lpd of uniqueLpdValuesLocal) {
                if (currentRemainingSlots[lpd] > 0) { // Only consider LPDs with remaining slots
                    for (let i = 0; i < currentItemAllocations.length; i++) {
                        const currentAlloc = currentItemAllocations[i];
                        // Skip items with errors or incomplete data
                        if (!currentAlloc || currentAlloc.error || currentAlloc.sum === undefined) continue;
                        const item = itemsToProcess[i]; if (!item) continue;

                        const originalAmount = item.amount;
                        const currentSum = currentAlloc.sum;
                        const currentAbsDifference = Math.abs(currentAlloc.difference);
                        const newSum = currentSum + lpd;
                        const newAbsDifference = Math.abs(newSum - originalAmount);

                        // Impact is the change in absolute difference (lower is better)
                        const impact = newAbsDifference - currentAbsDifference;

                        // Find move with the most negative impact (biggest reduction in difference)
                        // Tie-break by choosing the item that currently has the larger absolute difference
                        if (impact < bestMove.minImpact || (impact === bestMove.minImpact && currentAbsDifference > bestMove.currentAbsDiff)) {
                            bestMove = { lpdToAdd: lpd, itemIndex: i, minImpact: impact, currentAbsDiff: currentAbsDifference };
                        }
                    }
                }
            }

            // Apply the best move found
            if (bestMove.lpdToAdd !== null) {
                const lpd = bestMove.lpdToAdd;
                const itemIdx = bestMove.itemIndex;
                if (itemIdx < 0 || itemIdx >= currentItemAllocations.length || !currentItemAllocations[itemIdx] || !itemsToProcess[itemIdx]) {
                    console.error(`Passo 2: Índice de item inválido (${itemIdx}) para melhor movimento.`); adjustmentLogHTML += `\n<span class="error">Erro interno no Passo 2.</span>`; break;
                }
                adjustmentLogHTML += `<div class="adjustment-step">Passo ${adjustmentSafetyCounter}: Adic Plano <span class="info">${lpd}</span> ao Especificação ${itemsToProcess[itemIdx].originalIndex + 1} ('${itemsToProcess[itemIdx].details}') (Impacto: ${bestMove.minImpact >= 0 ? '+' : ''}${bestMove.minImpact.toFixed(0)})`;

                // Update the allocation for the chosen item
                currentItemAllocations[itemIdx].combination.push(lpd);
                currentItemAllocations[itemIdx].combination.sort((a, b) => a - b); // Keep sorted
                currentItemAllocations[itemIdx].sum += lpd;
                currentItemAllocations[itemIdx].difference = currentItemAllocations[itemIdx].sum - itemsToProcess[itemIdx].amount;

                // Update remaining slots
                currentRemainingSlots[lpd]--;
                totalRemainingPass2--; // Decrement finite count

                adjustmentLogHTML += `\n   -> Nova Soma: ${currentItemAllocations[itemIdx].sum}, Dif: ${currentItemAllocations[itemIdx].difference.toFixed(0)}, Imagens Rem ${lpd}: ${currentRemainingSlots[lpd]}</div>`;
            } else {
                // No beneficial move found
                adjustmentLogHTML += `\n<span class="warning">Parado Passo 2 (Iter ${adjustmentSafetyCounter}): Nenhum movimento benéfico encontrado. ${totalRemainingPass2} imagens finitas restantes.</span>`;
                break;
            }
         }
         if (adjustmentSafetyCounter >= maxAdjustments) { adjustmentLogHTML += `\n<span class="error">Parado Passo 2: Limite de segurança (${maxAdjustments}) atingido.</span>`; }
         adjustmentLogHTML += `\nImagens Rem Após Passo 2: ${JSON.stringify(currentRemainingSlots)}`;
     } else {
         adjustmentLogHTML += `\n(Pulado: Imagens Máx Ilimitadas)`;
     }
     logs.adjustment = adjustmentLogHTML; // Assign Passo 2 log
     console.log("[runAllocatorProcess] Passo 2 Complete.");


     // Passo 3: Correção de Variação
     // Uses global VARIATION_LIMIT_PASS_3 from utils.js
     console.log("[runAllocatorProcess] Starting Passo 3 (Variation Correction)...");
     let variationLogHTML = `--- Passo 3: Correção de Variação (Alvo: ±${(VARIATION_LIMIT_PASS_3 * 100).toFixed(0)}%) ---`;
     let madeVariationAdjustment = true; let variationLoopCounter = 0;
     const maxVariationLoops = itemsToProcess.length * uniqueLpdValuesLocal.length * 3 + 50; // Safety break

     while (madeVariationAdjustment && variationLoopCounter < maxVariationLoops) {
        variationLoopCounter++; madeVariationAdjustment = false;

        // Find the item with the worst variation violation
        let worstViolation = { index: -1, percentageDiff: 0, absDifference: 0 };
        currentItemAllocations.forEach((alloc, i) => {
             if (alloc && !alloc.error && alloc.difference !== undefined) {
                const item = itemsToProcess[i]; if (!item) return;
                const targetAmount = item.amount; let currentAbsPercentage = 0; const currentAbsDifference = Math.abs(alloc.difference);
                if (targetAmount > 0) { currentAbsPercentage = currentAbsDifference / targetAmount; }
                else if (alloc.sum !== 0) { currentAbsPercentage = Infinity; } // Deviation from zero target

                if (currentAbsPercentage > VARIATION_LIMIT_PASS_3) {
                    // Find the worst violation (highest percentage, tie-break with highest absolute diff)
                    if (currentAbsPercentage > worstViolation.percentageDiff || (currentAbsPercentage === worstViolation.percentageDiff && currentAbsDifference > worstViolation.absDifference)) {
                        worstViolation = { index: i, percentageDiff: currentAbsPercentage, absDifference: currentAbsDifference };
                    }
                }
            }
        });

        if (worstViolation.index === -1) {
            variationLogHTML += `\nIter ${variationLoopCounter}: Nenhum item > ±${(VARIATION_LIMIT_PASS_3 * 100).toFixed(0)}%. Passo 3 completo.`;
            break; // No violations found, exit loop
        }

        const itemIdx = worstViolation.index;
        const currentAlloc = currentItemAllocations[itemIdx];
        if (!currentAlloc || !itemsToProcess[itemIdx]) { console.error(`Passo 3: Índice inválido (${itemIdx}) ou item/alocação ausente.`); variationLogHTML += `\n<span class="error">Erro interno no Passo 3 (índice ${itemIdx}).</span>`; break; }
        const originalAmount = itemsToProcess[itemIdx].amount;
        variationLogHTML += `<div class="variation-step">Iter ${variationLoopCounter}: Corrigindo Especificação ${itemsToProcess[itemIdx].originalIndex + 1} ('${itemsToProcess[itemIdx].details}') - Dif: ${currentAlloc.difference.toFixed(0)} (${(worstViolation.percentageDiff * 100).toFixed(1)}%)`;

        // Try to find the best single LPD adjustment (add or remove)
        let bestFix = { action: null, lpd: null, finalAbsDiff: Math.abs(currentAlloc.difference), finalPercDiff: worstViolation.percentageDiff };
        const currentCombinationCopy = Array.isArray(currentAlloc.combination) ? [...currentAlloc.combination] : [];

        // Try removing each unique LPD present in the current combination
        for (const lpdToRemove of new Set(currentCombinationCopy)) {
            if (!lpdToRemove || typeof lpdToRemove !== 'number') continue;
            const newSum = currentAlloc.sum - lpdToRemove;
            const newAbsDiff = Math.abs(newSum - originalAmount);
            let newPercentageDiff = originalAmount > 0 ? newAbsDiff / originalAmount : (newSum === 0 ? 0 : Infinity);

            // Prefer fixes that meet the target limit
            if (newPercentageDiff <= VARIATION_LIMIT_PASS_3) {
                 // If this fix meets the limit and is better than the current best fix, take it
                 if (newAbsDiff < bestFix.finalAbsDiff || (newAbsDiff === bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3)) {
                     bestFix = { action: 'remove', lpd: lpdToRemove, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                 }
            } else { // If it doesn't meet the limit, only consider it if it's better than the current best AND the current best doesn't meet the limit either
                 if (newAbsDiff < bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3) {
                     bestFix = { action: 'remove', lpd: lpdToRemove, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                 }
            }
        }

        // Try adding each available LPD type (if slots allow)
        for (const lpdToAdd of uniqueLpdValuesLocal) {
            if (maxSlotsIsFinite && currentRemainingSlots[lpdToAdd] <= 0) continue; // Skip if no slots left
            const newSum = currentAlloc.sum + lpdToAdd;
            const newAbsDiff = Math.abs(newSum - originalAmount);
            let newPercentageDiff = originalAmount > 0 ? newAbsDiff / originalAmount : (newSum === 0 ? 0 : Infinity);

            // Prefer fixes that meet the target limit
            if (newPercentageDiff <= VARIATION_LIMIT_PASS_3) {
                 if (newAbsDiff < bestFix.finalAbsDiff || (newAbsDiff === bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3)) {
                     bestFix = { action: 'add', lpd: lpdToAdd, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                 }
            } else { // If it doesn't meet the limit, only consider if better than current best (which also doesn't meet limit)
                 if (newAbsDiff < bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3) {
                     bestFix = { action: 'add', lpd: lpdToAdd, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                 }
            }
        }

        // Apply the best fix found
        if (bestFix.action) {
             madeVariationAdjustment = true; // Mark that we made a change in this loop
             const lpd = bestFix.lpd;
             variationLogHTML += ` -> Ação: <span class="info">${bestFix.action === 'remove' ? 'REMOVER' : 'ADICIONAR'} ${lpd}</span>`;

             if (bestFix.action === 'remove') {
                const indexToRemove = currentItemAllocations[itemIdx].combination.indexOf(lpd);
                if (indexToRemove > -1) {
                    currentItemAllocations[itemIdx].combination.splice(indexToRemove, 1);
                    currentItemAllocations[itemIdx].sum -= lpd;
                    currentItemAllocations[itemIdx].difference -= lpd; // Or recalculate: sum - originalAmount
                    if (maxSlotsIsFinite) { currentRemainingSlots[lpd]++; } // Return slot
                } else { console.error(`Erro VFix: remover ${lpd} não encontrado em ${itemIdx}`); variationLogHTML += ` <span class="error">(Erro ao remover!)</span>`; madeVariationAdjustment = false; /* Stop if error */ }
             } else { // Add
                currentItemAllocations[itemIdx].combination.push(lpd);
                currentItemAllocations[itemIdx].combination.sort((a, b) => a - b); // Keep sorted
                currentItemAllocations[itemIdx].sum += lpd;
                currentItemAllocations[itemIdx].difference += lpd; // Or recalculate: sum - originalAmount
                if (maxSlotsIsFinite) {
                    if (currentRemainingSlots[lpd] > 0) {
                         currentRemainingSlots[lpd]--; // Consume slot
                    } else {
                         console.error(`Erro VFix: Adicionar ${lpd} sem imagens restantes! Item ${itemIdx}`); variationLogHTML += ` <span class="error">(Erro de imagem ao adicionar!)</span>`;
                         // We might need to revert the addition here or handle the error state
                         currentItemAllocations[itemIdx].combination.pop(); // Revert addition
                         currentItemAllocations[itemIdx].sum -= lpd;
                         currentItemAllocations[itemIdx].difference -= lpd;
                         madeVariationAdjustment = false; // Stop if error
                    }
                }
             }

             // Log result of adjustment (only if no error occurred)
             if (madeVariationAdjustment) {
                 const finalPercDiffCheck = originalAmount > 0 ? Math.abs(currentItemAllocations[itemIdx].difference / originalAmount) : (currentItemAllocations[itemIdx].sum === 0 ? 0 : Infinity);
                 variationLogHTML += ` -> Nova Dif: ${currentItemAllocations[itemIdx].difference.toFixed(0)} (${(finalPercDiffCheck * 100).toFixed(1)}%)`;
                 if (finalPercDiffCheck <= VARIATION_LIMIT_PASS_3) { variationLogHTML += ` <span class="success">(OK)</span>`; }
                 else { variationLogHTML += ` <span class="warning">(Ainda Alto)</span>`; }
                 if (maxSlotsIsFinite) { variationLogHTML += `, Imagens Rem ${lpd}: ${currentRemainingSlots[lpd]}`; }
             }

        } else {
             // No beneficial adjustment found for the worst offender
             variationLogHTML += ` -> <span class="warning">Nenhuma correção encontrada para este item. Parando Passo 3.</span>`;
             madeVariationAdjustment = false; // Exit the while loop
        }
        variationLogHTML += `</div>`; // Close variation-step
     } // End while loop

     if (variationLoopCounter >= maxVariationLoops) { variationLogHTML += `\n<span class="error">Parado Passo 3: Limite de loop (${maxVariationLoops}) atingido.</span>`; }
     logs.variation = variationLogHTML;
     console.log("[runAllocatorProcess] Passo 3 Complete.");


     // Passo Final: Contagem de Uso Final por Item e Acumulado
     console.log("[runAllocatorProcess] Starting Final Count...");
     let finalCumulativeUsage = {}; uniqueLpdValuesLocal.forEach(lpd => { finalCumulativeUsage[lpd] = 0; });

     currentItemAllocations.forEach(alloc => {
         alloc.finalUsageCounts = {}; // Initialize/Reset usage count for this allocation
         if (alloc && !alloc.error && Array.isArray(alloc.combination)) {
            alloc.combination.forEach(lpd => {
                if (typeof lpd === 'number' && !isNaN(lpd)) {
                    // Count per item allocation
                    alloc.finalUsageCounts[lpd] = (alloc.finalUsageCounts[lpd] || 0) + 1;
                    // Count total usage
                    if (finalCumulativeUsage.hasOwnProperty(lpd)) {
                         finalCumulativeUsage[lpd]++;
                    } else {
                         // This case should ideally not happen if uniqueLpdValuesLocal is correct
                         console.error(`Erro Lógica Contagem Final: Plano ${lpd} usado mas não na lista única (${uniqueLpdValuesLocal.join(',')}).`);
                         finalCumulativeUsage[lpd] = 1; // Initialize count anyway
                    }
                } else {
                    console.warn("Skipping invalid LPD during final count:", lpd);
                }
             });
         }
     });
     console.log("[runAllocatorProcess] Final Count Complete. Cumulative Usage:", JSON.stringify(finalCumulativeUsage));


     // Return final results
     console.log("[runAllocationProcess] END. Returning results.");
     const finalItemAllocations = Array.isArray(currentItemAllocations) ? currentItemAllocations : []; // Ensure it's an array
     return { itemAllocations: finalItemAllocations, cumulativeUsage: finalCumulativeUsage, remainingSlots: currentRemainingSlots, logs: logs };
}


// --- Iterative Refinement Function ---
// (This function remains unchanged)
/**
 * Attempts to improve an allocation result by swapping LPDs between
 * items with large positive and negative differences.
 * @param {object} resultEntry - The strategy result object to refine. Requires resultEntry.resultData.itemAllocations and resultEntry.itemsUsed.
 * @returns {{refinedResultEntry: object, log: string}} - Object containing the potentially refined result and the log.
 */
function refineAllocationResult(resultEntry) {
    console.log(`[refineAllocationResult] START for strategy: ${resultEntry.strategyName}`);
    let refinementLog = [`--- Registro de Refinamento Iterativo (Estratégia: ${resultEntry.strategyName}) ---`];

    // --- Configuration ---
    const MAX_REFINEMENT_PASSES = 5;        // Max attempts to improve
    const MIN_IMPROVEMENT_THRESHOLD = 1;    // Only swap if total absolute diff improves by at least this much
    const SWAP_VIOLATION_THRESHOLD = VARIATION_LIMIT_PASS_3; // Use Pass 3 limit for checking if swap creates new violations

    // Input Validation
    if (!resultEntry || !resultEntry.resultData || !resultEntry.resultData.itemAllocations || !resultEntry.itemsUsed) {
        refinementLog.push("<span class='error'>Erro: Dados de entrada inválidos para refinamento.</span>");
        console.error("[refineAllocationResult] Invalid input resultEntry:", resultEntry);
        // Return original entry, indicating no refinement possible due to input error
        return { refinedResultEntry: resultEntry, log: refinementLog.join('\n') };
    }
     if (resultEntry.hasAllocationError) {
         refinementLog.push("<span class='warning'>Aviso: Refinamento pulado pois a estratégia inicial continha erros de alocação.</span>");
         console.log(`[refineAllocationResult] Skipping refinement for ${resultEntry.strategyName} due to initial allocation errors.`);
         return { refinedResultEntry: resultEntry, log: refinementLog.join('\n') };
    }


    // Make deep copies to avoid modifying the original object directly during iteration
    let currentAllocations = JSON.parse(JSON.stringify(resultEntry.resultData.itemAllocations));
    let items = resultEntry.itemsUsed; // itemsUsed should be the ordered list corresponding to allocations
    let overallImprovementMade = false;

    // Refinement Loop
    for (let pass = 1; pass <= MAX_REFINEMENT_PASSES; pass++) {
        refinementLog.push(`\n--- Passe de Refinamento ${pass}/${MAX_REFINEMENT_PASSES} ---`);
        let swapsMadeInPass = 0;

        // 1. Identify candidates for swapping
        let positiveDiffItems = []; // Items with allocation > target
        let negativeDiffItems = []; // Items with allocation < target
        currentAllocations.forEach((alloc, index) => {
            if (alloc && !alloc.error && alloc.difference !== undefined) {
                // Only consider items with a difference significant enough to potentially swap
                if (alloc.difference > MIN_IMPROVEMENT_THRESHOLD) {
                    positiveDiffItems.push({ index, alloc }); // Store index and allocation data
                } else if (alloc.difference < -MIN_IMPROVEMENT_THRESHOLD) {
                    negativeDiffItems.push({ index, alloc });
                }
            }
        });

        if (positiveDiffItems.length === 0 || negativeDiffItems.length === 0) {
            refinementLog.push("Nenhum par de itens com diferenças opostas significativas encontrado para troca.");
            break; // Exit loop if no potential swaps
        }

        // 2. Sort candidates (optional but helps process most impactful first)
        positiveDiffItems.sort((a, b) => b.alloc.difference - a.alloc.difference); // Largest positive diff first
        negativeDiffItems.sort((a, b) => Math.abs(b.alloc.difference) - Math.abs(a.alloc.difference)); // Largest negative diff (magnitude) first
        refinementLog.push(`Candidatos (+): ${positiveDiffItems.length}, Candidatos (-): ${negativeDiffItems.length}`);

        // 3. Iterate through potential swaps
        let itemSwappedFlags = new Array(currentAllocations.length).fill(false); // Track items involved in a swap this pass

        for (let posItemData of positiveDiffItems) {
            if (itemSwappedFlags[posItemData.index]) continue; // Already swapped this item in this pass

            for (let negItemData of negativeDiffItems) {
                if (itemSwappedFlags[negItemData.index]) continue; // Already swapped
                if (posItemData.index === negItemData.index) continue; // Cannot swap with itself

                let bestSwapForPair = { lpdToSwap: null, improvement: -Infinity, lpdIndexInPos: -1 };
                const posIndex = posItemData.index;
                const negIndex = negItemData.index;
                const posAlloc = posItemData.alloc; // Reference to allocation in currentAllocations copy
                const negAlloc = negItemData.alloc;
                const posItemTarget = items[posIndex]?.amount ?? 0; // Get target amount from itemsUsed list
                const negItemTarget = items[negIndex]?.amount ?? 0;
                const posCombination = Array.isArray(posAlloc.combination) ? posAlloc.combination : [];

                // Try moving each LPD from the positive-difference item to the negative-difference item
                for (let lpdIndex = 0; lpdIndex < posCombination.length; lpdIndex++) {
                    const lpd = posCombination[lpdIndex];
                    if (!lpd || typeof lpd !== 'number' || lpd <= 0) continue; // Skip invalid LPDs

                    // Calculate impact of moving this LPD
                    const newPosDiff = posAlloc.difference - lpd;
                    const newNegDiff = negAlloc.difference + lpd;
                    const currentTotalAbsDiff = Math.abs(posAlloc.difference) + Math.abs(negAlloc.difference);
                    const newTotalAbsDiff = Math.abs(newPosDiff) + Math.abs(newNegDiff);
                    const improvement = currentTotalAbsDiff - newTotalAbsDiff; // Positive improvement is good

                    // --- Swap Validity Checks ---
                    // a) Must meet minimum improvement threshold
                    if (improvement < MIN_IMPROVEMENT_THRESHOLD) continue;

                    // b) Avoid creating a worse violation if possible
                    const currentPosViolates = posItemTarget > 0 && Math.abs(posAlloc.difference / posItemTarget) > SWAP_VIOLATION_THRESHOLD;
                    const currentNegViolates = negItemTarget > 0 && Math.abs(negAlloc.difference / negItemTarget) > SWAP_VIOLATION_THRESHOLD;
                    const newPosViolates = posItemTarget > 0 && Math.abs(newPosDiff / posItemTarget) > SWAP_VIOLATION_THRESHOLD;
                    const newNegViolates = negItemTarget > 0 && Math.abs(newNegDiff / negItemTarget) > SWAP_VIOLATION_THRESHOLD;

                    // Check if the swap introduces a new violation without fixing an existing one on the other side
                    let makesWorseViolation = false;
                    if ((!currentPosViolates && newPosViolates && !newNegViolates) ||  // Pos becomes bad, Neg stays good
                        (!currentNegViolates && newNegViolates && !currentPosViolates)) { // Neg becomes bad, Pos stays good
                         makesWorseViolation = true;
                    }
                    // Allow if it makes one worse BUT fixes the other item's violation
                     if (makesWorseViolation && !( (currentPosViolates && !newPosViolates) || (currentNegViolates && !newNegViolates) ) ) {
                         // refinementLog.push(`   -> Skip LPD ${lpd}: Creates new violation without fixing other.`);
                         continue; // Skip this LPD swap if it makes things worse overall in terms of violations
                    }

                    // --- Track Best Swap ---
                    // If this swap is better than the best found *for this pair* so far
                    if (improvement > bestSwapForPair.improvement) {
                        bestSwapForPair = { lpdToSwap: lpd, improvement: improvement, lpdIndexInPos: lpdIndex };
                    }
                } // End LPD loop for the positive item

                // 4. Execute the best swap found *for this pair*
                if (bestSwapForPair.lpdToSwap !== null) {
                    const lpd = bestSwapForPair.lpdToSwap;
                    const lpdIdxToRemove = bestSwapForPair.lpdIndexInPos;
                    const posItemDetails = items[posIndex]?.details ?? 'N/A';
                    const negItemDetails = items[negIndex]?.details ?? 'N/A';
                    refinementLog.push(`<div class='adjustment-step'>Swap: Mover Plano <span class='info'>${lpd}</span> de Espec ${posIndex + 1} ('${posItemDetails}') para Espec ${negIndex + 1} ('${negItemDetails}') (Melhora Abs: ${bestSwapForPair.improvement.toFixed(0)})`);

                    // --- Perform the swap on the 'currentAllocations' copy ---
                    // Remove from positive item
                    posAlloc.combination.splice(lpdIdxToRemove, 1); // Remove LPD from array
                    posAlloc.sum -= lpd;
                    posAlloc.difference -= lpd;
                    // Update usage counts if they exist
                    if (posAlloc.finalUsageCounts && posAlloc.finalUsageCounts[lpd]) {
                         posAlloc.finalUsageCounts[lpd]--;
                         if (posAlloc.finalUsageCounts[lpd] <= 0) {
                             delete posAlloc.finalUsageCounts[lpd];
                         }
                    }

                    // Add to negative item
                    negAlloc.combination.push(lpd);
                    negAlloc.combination.sort((a, b) => a - b); // Keep sorted
                    negAlloc.sum += lpd;
                    negAlloc.difference += lpd;
                     // Update usage counts if they exist
                     if (!negAlloc.finalUsageCounts) negAlloc.finalUsageCounts = {};
                     negAlloc.finalUsageCounts[lpd] = (negAlloc.finalUsageCounts[lpd] || 0) + 1;


                    refinementLog.push(`   -> Espec ${posIndex + 1}: Nova Dif ${posAlloc.difference.toFixed(0)}`);
                    refinementLog.push(`   -> Espec ${negIndex + 1}: Nova Dif ${negAlloc.difference.toFixed(0)}</div>`);

                    swapsMadeInPass++;
                    overallImprovementMade = true;
                    itemSwappedFlags[posIndex] = true; // Mark both items as swapped for this pass
                    itemSwappedFlags[negIndex] = true;
                    break; // Move to the next positive item after finding a swap for the current one
                }
            } // End negative item loop
        } // End positive item loop

        refinementLog.push(`Swaps realizados neste passe: ${swapsMadeInPass}`);
        if (swapsMadeInPass === 0) {
            refinementLog.push("Nenhuma melhoria adicional encontrada neste passe.");
            break; // Exit refinement loop if no swaps were made
        }
    } // End refinement pass loop

    // 5. Final update if improvements were made
    if (overallImprovementMade) {
        refinementLog.push("\n<span class='success'>Refinamento concluído. Aplicando melhorias.</span>");
        console.log(`[refineAllocationResult] Improvements made for ${resultEntry.strategyName}. Updating resultEntry.`);

        // Update the original resultEntry with the refined allocations
        resultEntry.resultData.itemAllocations = currentAllocations;

        // Recalculate metrics based on the refined allocations
        // Uses global calculateMaxVariation, calculateAverageVariation, REPROCESS_VARIATION_LIMIT from utils.js
        try {
            resultEntry.maxVariation = calculateMaxVariation(items, currentAllocations);
            resultEntry.avgVariation = calculateAverageVariation(items, currentAllocations);
            resultEntry.meetsLimit = !resultEntry.hasAllocationError && resultEntry.maxVariation <= REPROCESS_VARIATION_LIMIT;

             // Recalculate display strings based on new metrics
             if (resultEntry.hasAllocationError) { /* Should not happen if refinement ran */ }
             else {
                 if (resultEntry.maxVariation === Infinity) { resultEntry.displayMaxVarStr = '<span class="violation">Infinita</span>'; }
                 else { resultEntry.displayMaxVarStr = (resultEntry.maxVariation * 100).toFixed(1) + '%'; if (!resultEntry.meetsLimit) resultEntry.displayMaxVarStr = `<span class="warning">${resultEntry.displayMaxVarStr}</span>`; }
                 resultEntry.displayAvgVarStr = (resultEntry.avgVariation * 100).toFixed(1) + '%';
                 if (resultEntry.meetsLimit) { resultEntry.displayOutcomeStr = `<span class="success">Sucesso</span>`; }
                 else { resultEntry.displayOutcomeStr = `<span class="warning">Var Alta</span>`; }
             }


            console.log(`[refineAllocationResult] Recalculated metrics: MaxVar=${resultEntry.maxVariation.toFixed(4)}, AvgVar=${resultEntry.avgVariation.toFixed(4)}, MeetsLimit=${resultEntry.meetsLimit}`);

            // Optionally, regenerate Plan Assembly Data if it depends on finalUsageCounts
            // This depends if generatePlanAssemblyData uses finalUsageCounts or just the final 'combination' array
            // Assuming it uses 'combination', we might not strictly need to regenerate it here unless counts matter for display
            // If finalUsageCounts *are* used by assembly data generation:
            try {
                 resultEntry.planAssemblyDataForExport = generatePlanAssemblyData(
                     resultEntry.itemsUsed,
                     resultEntry.resultData.itemAllocations, // Use the updated allocations
                     globalUserLpdCombinationWithDuplicates, // Need the original combo used
                     globalMaxSlotsPerInstance // Need max slots
                 );
                  console.log(`[refineAllocationResult] Regenerated plan assembly data after refinement.`);
            } catch (assemblyError) {
                 console.error(`[refineAllocationResult] Error regenerating plan assembly data after refinement:`, assemblyError);
                 resultEntry.planAssemblyDataForExport = null; // Clear potentially outdated data
            }


        } catch (metricError) {
            console.error("[refineAllocationResult] Error recalculating metrics after refinement:", metricError);
             // Keep old metrics but maybe flag an issue?
             resultEntry.meetsLimit = false; // Assume limit not met if calculation fails
        }

    } else {
        refinementLog.push("\nNenhuma melhoria encontrada ou aplicada durante o refinamento.");
        console.log(`[refineAllocationResult] No effective improvements made for ${resultEntry.strategyName}.`);
    }

    console.log(`[refineAllocationResult] END for strategy: ${resultEntry.strategyName}`);
    // Return the potentially modified resultEntry and the log
    return { refinedResultEntry: resultEntry, log: refinementLog.join('\n') };
}
// --- END Refinement Function ---


// --- Helper Function to Generate Plan Assembly Data ---
// (This function remains unchanged)
/**
 * Generates the structured data for plan assembly based on final allocations.
 * @param {Array} finalItems - The items array used in the allocation (ordered by processing).
 * @param {Array} finalAllocations - The corresponding allocation results.
 * @param {Array} userLpdCombinationWithDuplicatesLocal - The original LPD combination used for this allocation run.
 * @param {number|Infinity} maxSlotsNum - Max slots per instance for this allocation run.
 * @returns {Array|null} An array of objects representing each plan instance and its items, or null on error.
 */
function generatePlanAssemblyData(finalItems, finalAllocations, userLpdCombinationWithDuplicatesLocal, maxSlotsNum) {
    if (!finalItems || !finalAllocations || !userLpdCombinationWithDuplicatesLocal) {
        console.error("generatePlanAssemblyData: Missing input data.");
        return null;
    }
    const maxSlotsIsFinite = maxSlotsNum !== Infinity;
    let planAssemblyDataForExport = [];
    try {
        // 1. Collect all individual LPD uses from all item allocations
        const allLpdUses = [];
        finalItems.forEach((item, i) => {
            const finalAlloc = finalAllocations[i];
            // Only consider successful allocations with non-empty combinations
            if (finalAlloc && !finalAlloc.error && finalAlloc.combination && finalAlloc.combination.length > 0) {
                finalAlloc.combination.forEach(lpdVal => {
                    // Ensure item details exist before pushing
                    if(item && item.details) {
                         allLpdUses.push({
                             itemIndex: i, // Keep original processing index if needed
                             itemDetails: item.details,
                             lpdValue: lpdVal,
                             assignedInstanceKey: null // Placeholder for assignment
                            });
                    } else {
                        console.warn("generatePlanAssemblyData: Skipping LPD use due to missing item details at index", i, "Item:", item);
                    }
                });
            }
        });

        // 2. Iterate through the defined LPD instances and assign uses
        const lpdInstanceCounters = {}; // Track instance number per LPD value (e.g., {5000: 1, 7500: 1, 5000: 2})
        const breakdownByInstance = {}; // Temporary map: Key: 'LPD_InstanceNum', Value: {lpdValue, instanceNum, items:[]}

        // Ensure userLpdCombinationWithDuplicatesLocal is iterable
         if (!Array.isArray(userLpdCombinationWithDuplicatesLocal)) {
            console.error("generatePlanAssemblyData: userLpdCombinationWithDuplicatesLocal is not an array:", userLpdCombinationWithDuplicatesLocal);
            return null; // Cannot iterate if not an array
         }

        userLpdCombinationWithDuplicatesLocal.forEach(lpdInputVal => {
            // Ensure lpdInputVal is valid before using as key
            if (lpdInputVal === null || lpdInputVal === undefined || typeof lpdInputVal !== 'number' || isNaN(lpdInputVal)) {
                console.warn("generatePlanAssemblyData: Skipping invalid LPD value in user combination:", lpdInputVal);
                return; // Skip this invalid entry in the combination
            }

            // Generate a unique key for this specific instance (e.g., "5000_1", "7500_1", "5000_2")
            const currentInstanceNum = (lpdInstanceCounters[lpdInputVal] || 0) + 1;
            lpdInstanceCounters[lpdInputVal] = currentInstanceNum;
            const instanceKey = `${lpdInputVal}_${currentInstanceNum}`;

            // Initialize temporary structure for this instance
            breakdownByInstance[instanceKey] = {
                lpdValue: lpdInputVal,
                instanceNum: currentInstanceNum,
                // Initialize items array here? No, let's add uses directly
            };

            // Assign LPD uses to this instance, respecting maxSlots if finite
            let assignedToThisInstance = 0;
            for (let use of allLpdUses) {
                // Find an unassigned use matching this LPD value
                if (use.lpdValue === lpdInputVal && use.assignedInstanceKey === null) {
                    // Check slot limit only if it's finite
                    if (!maxSlotsIsFinite || assignedToThisInstance < maxSlotsNum) {
                        use.assignedInstanceKey = instanceKey; // Assign the use to this instance
                        assignedToThisInstance++;
                    }
                    // If max slots reached for this instance, stop assigning to it
                    if (maxSlotsIsFinite && assignedToThisInstance >= maxSlotsNum) {
                         break; // Exit the inner loop (for 'use' of allLpdUses)
                    }
                }
            }
            // Log if instance was created but no items assigned (might indicate issue or just unused LPD instance)
             if (assignedToThisInstance === 0) {
                 console.log(`generatePlanAssemblyData: Instance ${instanceKey} created but no items assigned.`);
             }

        }); // End loop through userLpdCombinationWithDuplicatesLocal

        // 3. Consolidate assigned uses into the final structure
        Object.keys(breakdownByInstance).forEach(instanceKey => {
            const instanceDataTemp = breakdownByInstance[instanceKey];
            const usesForThisInstance = allLpdUses.filter(use => use.assignedInstanceKey === instanceKey);
            const totalUsedInInstance = usesForThisInstance.length;

            // Only add instances that actually have items assigned
            if (totalUsedInInstance > 0) {
                const itemsMap = {}; // Group by item details to count occurrences
                usesForThisInstance.forEach(use => {
                    // Ensure itemDetails is valid before using as key
                    if(use.itemDetails) {
                         itemsMap[use.itemDetails] = (itemsMap[use.itemDetails] || 0) + 1;
                    } else {
                        // Should not happen based on earlier check, but safeguard
                        console.warn("generatePlanAssemblyData: Skipping use with null itemDetails during map creation for key", instanceKey);
                    }
                });

                // Convert map to sorted array for consistent output
                const itemsArray = Object.entries(itemsMap).map(([details, count]) => ({ details, count }))
                                     .sort((a, b) => (a.details || '').localeCompare(b.details || '')); // Sort alphabetically by details

                planAssemblyDataForExport.push({
                    planValue: instanceDataTemp.lpdValue,
                    instanceNum: instanceDataTemp.instanceNum,
                    totalUsed: totalUsedInInstance,
                    maxSlots: maxSlotsIsFinite ? maxSlotsNum : Infinity,
                    items: itemsArray
                });
            } else {
                 // Remove the entry from breakdownByInstance if no items were assigned? Optional.
                 delete breakdownByInstance[instanceKey];
            }
        });

        // 4. Sort the final array of instances
        planAssemblyDataForExport.sort((a, b) => (a.planValue || 0) - (b.planValue || 0) || (a.instanceNum || 0) - (b.instanceNum || 0)); // Sort by LPD value, then instance number

        // 5. Check for unassigned uses (optional, for debugging)
        const unassignedUses = allLpdUses.filter(use => use.assignedInstanceKey === null);
        if (unassignedUses.length > 0) {
            console.warn(`generatePlanAssemblyData: ${unassignedUses.length} LPD uses were not assigned to any instance. This might indicate an issue with slot limits or the LPD combination. Details:`, unassignedUses);
        }

    } catch (error) {
        console.error("Error during generatePlanAssemblyData:", error);
        return null; // Return null on error
    }
    return planAssemblyDataForExport;
}
// --- End Helper Function ---