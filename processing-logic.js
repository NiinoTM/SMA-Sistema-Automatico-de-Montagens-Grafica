// --- FUNÇÃO FINDER DE COMBINAÇÃO (findBestLpdCombination) ---
function findBestLpdCombination(parsedItemsData, maxSlotsForTargetCalc, requestedCombinationSize) {
    const functionLog = []; let foundCombination = null; let finderStatus = "OK";
    // Validation (using global MIN_LPD_VALUE and OBLIGATORY_RANGE from utils.js)
    if (!parsedItemsData || parsedItemsData.length === 0) { return { combination: null, log: '<span class="error">Erro do Finder: Nenhum dado de Especificação processado.</span>', status: "Error" }; }
    if (isNaN(maxSlotsForTargetCalc) || maxSlotsForTargetCalc <= 0) { return { combination: null, log: '<span class="error">Erro do Finder: Imagens Máx. Inválidas.</span>', status: "Error" }; }
    if (isNaN(requestedCombinationSize) || requestedCombinationSize < 1) { return { combination: null, log: `<span class="error">Erro do Finder: Tamanho Combo Inválido (>= 1).</span>`, status: "Error" }; }
    const lpdFrequencies = {}; const validRawAmounts = []; let minAmountFound = Infinity; let sumAmounts = 0;
    parsedItemsData.forEach(item => { const amount = item.amount; validRawAmounts.push(amount); sumAmounts += amount; if (amount < minAmountFound) minAmountFound = amount; const lpd = Math.round(amount / 2); if (lpd >= MIN_LPD_VALUE) { lpdFrequencies[lpd] = (lpdFrequencies[lpd] || 0) + 1; } });
    if (validRawAmounts.length === 0) { return { combination: null, log: `<span class="error">Erro do Finder: Nenhuma quantidade válida.</span>`, status: "Error"}; }
    if (sumAmounts === 0 && validRawAmounts.some(a => a !== 0)) { functionLog.push(`<span class="warning">Aviso do Finder: Soma 0 apesar de itens não-zero.</span>`); }
    else if (sumAmounts === 0) { functionLog.push(`Info do Finder: Soma total 0.`); }
    const uniqueValidLpdListWithFreq = Object.entries(lpdFrequencies).map(([lpd, freq]) => ({ value: parseInt(lpd), frequency: freq })).sort((a, b) => b.frequency - a.frequency || b.value - a.value);
    functionLog.push(`--- Registro do Finder de Combinação (Método 'Melhor') ---`);
    functionLog.push(`Qtd Mín Bruta: ${minAmountFound === Infinity ? 'N/A' : minAmountFound}, Soma Total: ${sumAmounts}`);
    functionLog.push(`Imagens Máx (Alvo): ${maxSlotsForTargetCalc}, Tam. Combo Req.: ${requestedCombinationSize}`);
    functionLog.push(`Planos Válidos Únicos (>=${MIN_LPD_VALUE}): ${uniqueValidLpdListWithFreq.length}`);
    functionLog.push(`Planos (Freq/Valor Ord.): ${uniqueValidLpdListWithFreq.map(l => `${l.value}(${l.frequency})`).join(', ')}`);
    let minLpdValueFound = Infinity; uniqueValidLpdListWithFreq.forEach(lpdObj => { if (lpdObj.value < minLpdValueFound) minLpdValueFound = lpdObj.value; });
    functionLog.push(`Plano Mín Válido: ${minLpdValueFound === Infinity ? 'Nenhum' : minLpdValueFound}`);
    const obligatoryCandidates = minLpdValueFound === Infinity ? [] : uniqueValidLpdListWithFreq.filter(lpdObj => Math.abs(lpdObj.value - minLpdValueFound) <= OBLIGATORY_RANGE).sort((a, b) => a.value - b.value);
    functionLog.push(`Candidatos Próximos ao Mín (+/- ${OBLIGATORY_RANGE}): ${obligatoryCandidates.length} [${obligatoryCandidates.map(c=>c.value).join(', ')}]`);

     if (obligatoryCandidates.length === 0 && requestedCombinationSize > 1) { /* --- FALLBACK MDC --- */
        functionLog.push(`<span class="fallback-gcd">ALERTA: Nenhum Plano próximo ao mín. Usando Fallback MDC.</span>`);
        let fallbackLog = [`<div class="fallback-section">--- Cálculo Fallback MDC ---`];
        const baseTargetAmount = sumAmounts / maxSlotsForTargetCalc; fallbackLog.push(`Quantidade Alvo Base: ${baseTargetAmount.toFixed(2)}`);
        if (validRawAmounts.length < 1) { fallbackLog.push(`<span class="error">Erro: Nenhuma quantidade válida para MDC.</span>`); finderStatus = "Error"; }
        else {
           // **** CALL TO utils.js ****
           const gcdAmounts = arrayGcd(validRawAmounts);
           fallbackLog.push(`MDC das quantidades: ${gcdAmounts}`);
            if (gcdAmounts <= 0) { fallbackLog.push(`<span class="error">Erro: MDC <= 0 (${gcdAmounts}).</span>`); finderStatus = "Error"; }
            else {
               // **** CALL TO utils.js ****
               const fallbackTarget = baseTargetAmount === 0 ? 0 : roundToNearest(baseTargetAmount, gcdAmounts);
               fallbackLog.push(`Alvo Fallback (múltiplo MDC): ${fallbackTarget}`);
                if (fallbackTarget < 0) { fallbackLog.push(`<span class="error">Erro: Alvo Fallback < 0.</span>`); finderStatus = "Error"; }
                else { const fallbackK = fallbackTarget === 0 ? 0 : Math.round(fallbackTarget / gcdAmounts);
                    if (fallbackK < 0) { fallbackLog.push(`<span class="error">Erro: Unidades MDC < 0.</span>`); finderStatus = "Error"; }
                    else { fallbackLog.push(`Unidades MDC necessárias: ${fallbackK}`); foundCombination = fallbackK > 0 ? Array(fallbackK).fill(gcdAmounts) : []; fallbackLog.push(`<span class="highlight fallback-gcd">Resultado Fallback MDC: [${foundCombination.join(', ')}]</span> (Tamanho: ${fallbackK})`); }
                }
            }
        }
        functionLog.push(fallbackLog.join('\n') + `</div>`);
     } else { /* --- PADRÃO / FALLBACK PROPORCIONAL --- */
        let standardSearchAttempted = false; let overallBestCombination = null; let overallBestFrequencyScore = -1; let overallBestTargetSum = null;
        if (obligatoryCandidates.length > 0) {
            standardSearchAttempted = true; functionLog.push(`<span class="info">Estratégia padrão selecionada.</span>`);
            // Using global TARGET_RANGE_BELOW, TARGET_RANGE_ABOVE, TARGET_STEP from utils.js
            const baseTargetLPD = sumAmounts / maxSlotsForTargetCalc; const lowerBound = baseTargetLPD - TARGET_RANGE_BELOW; const upperBound = baseTargetLPD + TARGET_RANGE_ABOVE; const targetsToTest = []; const firstMultiple = Math.ceil(lowerBound / TARGET_STEP) * TARGET_STEP; const lastMultiple = Math.floor(upperBound / TARGET_STEP) * TARGET_STEP; for (let target = firstMultiple; target <= lastMultiple; target += TARGET_STEP) { if (target > 0 || (target === 0 && baseTargetLPD === 0)) targetsToTest.push(target); }
            functionLog.push(`Plano Alvo Base: ${baseTargetLPD.toFixed(2)}, Intervalo [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`);
            if (targetsToTest.length === 0) { functionLog.push(`<span class="warning">Aviso: Nenhum múltiplo alvo no intervalo. Tentando Proporcional.</span>`); }
            else { functionLog.push(`Somas Alvo para Testar: [${targetsToTest.join(', ')}]`); const neededOtherLpds = requestedCombinationSize - 1; functionLog.push(`--- Busca de Combinação (Método Padrão, Precisa de ${neededOtherLpds} outros) ---`);
                for (const currentTargetSum of targetsToTest) { functionLog.push(`<div class="target-section">--- Testando Soma Alvo: ${currentTargetSum} ---`); let foundCombinationForThisTarget = false;
                    for (const currentObligatoryCandidate of obligatoryCandidates) { const currentObligatoryLpdValue = currentObligatoryCandidate.value; functionLog.push(`<div class="candidate-section">=== Tentando Plano Obrigatório: ${currentObligatoryLpdValue} ===`); const searchLpdList = uniqueValidLpdListWithFreq.filter(lpdObj => lpdObj.value !== currentObligatoryLpdValue);
                         if (neededOtherLpds > 0 && searchLpdList.length < neededOtherLpds) { functionLog.push(`   Pulando: Não há outros suficientes (${searchLpdList.length}) para tamanho ${requestedCombinationSize}.`); functionLog.push(`</div>`); continue; }
                         const targetForRecursion = currentTargetSum - currentObligatoryLpdValue; functionLog.push(`   Alvo para os ${neededOtherLpds} restantes: ${targetForRecursion.toFixed(2)}`);
                         if (neededOtherLpds === 0) {
                             if (Math.abs(targetForRecursion) < 0.01) {
                                 const currentFullCombination = [currentObligatoryLpdValue];
                                 // **** CALL TO utils.js ****
                                 const currentFrequencyScore = getFrequencyScore(currentFullCombination, lpdFrequencies);
                                 functionLog.push(`   <span class="success">Encontrada Soma Exata (Tam 1): [${currentFullCombination.join(', ')}] (Soma: ${currentTargetSum}, Freq: ${currentFrequencyScore})</span>`); foundCombinationForThisTarget = true; if (overallBestCombination === null || currentFrequencyScore > overallBestFrequencyScore || (currentFrequencyScore === overallBestFrequencyScore && currentTargetSum < overallBestTargetSum)) { functionLog.push(`   <span class="info">   ** Nova MELHOR GERAL Encontrada **</span>`); overallBestCombination = currentFullCombination; overallBestFrequencyScore = currentFrequencyScore; overallBestTargetSum = currentTargetSum; }
                              } else { functionLog.push(`   -> Alvo (${currentTargetSum}) != Plano (${currentObligatoryLpdValue}).`); }
                           } else if (targetForRecursion >= -0.01) {
                             const adjustedTargetForRecursion = Math.max(0, targetForRecursion);
                             // **** CALL TO utils.js ****
                             let foundKMinus1Combination = findSumCombinationRecursive(searchLpdList, adjustedTargetForRecursion, neededOtherLpds, 0, []);
                            if (foundKMinus1Combination !== null) {
                               const currentFullCombination = [...foundKMinus1Combination, currentObligatoryLpdValue].sort((a, b) => a - b);
                               // **** CALL TO utils.js ****
                               const currentFrequencyScore = getFrequencyScore(currentFullCombination, lpdFrequencies);
                               functionLog.push(`   <span class="success">Combo Encontrado: [${currentFullCombination.join(', ')}] (Soma: ${currentTargetSum}, Freq: ${currentFrequencyScore})</span>`); foundCombinationForThisTarget = true; if (overallBestCombination === null || currentFrequencyScore > overallBestFrequencyScore || (currentFrequencyScore === overallBestFrequencyScore && currentTargetSum < overallBestTargetSum)) { functionLog.push(`   <span class="info">   ** Nova MELHOR GERAL Encontrada **</span>`); overallBestCombination = currentFullCombination; overallBestFrequencyScore = currentFrequencyScore; overallBestTargetSum = currentTargetSum; } } else { functionLog.push(`   -> Nenhuma combo de ${neededOtherLpds} encontrada para ${adjustedTargetForRecursion.toFixed(2)}.`); }
                         } else { functionLog.push(`   -> Alvo restante (${targetForRecursion.toFixed(2)}) negativo.`); } functionLog.push(`</div>`);
                     } if (!foundCombinationForThisTarget) { functionLog.push(`   <span class="info">Nenhuma combinação encontrada para o alvo ${currentTargetSum}.</span>`); } functionLog.push(`</div>`);
                }
            }
        }
        if (overallBestCombination !== null) {
             functionLog.push(`--- Resultado do Método Padrão ---`); functionLog.push(`<span class="highlight">Melhor Encontrada: [${overallBestCombination.join(', ')}]</span>`); functionLog.push(`(Soma Alvo: ${overallBestTargetSum}, Pontuação Freq: ${overallBestFrequencyScore})`); foundCombination = overallBestCombination;
        } else { /* --- FALLBACK PROPORCIONAL --- */
            if (standardSearchAttempted) { functionLog.push(`<span class="error">Método Padrão Falhou. Tentando Proporcional.</span>`); }
            else if (requestedCombinationSize > 1) { functionLog.push(`<span class="info">Padrão Pulado (Sem candidatos próx. ao min). Tentando Proporcional.</span>`); }
            // Using global PROPORTIONAL_ROUNDING_STEP from utils.js
            functionLog.push(`<span class="fallback-prop">ALERTA: Usando Fallback Proporcional (Arredondar para ${PROPORTIONAL_ROUNDING_STEP}).</span>`);
            let propFallbackLog = [`<div class="proportional-fallback-section">--- Cálculo Fallback Proporcional ---`];
            const averageValuePerSlot = (maxSlotsForTargetCalc > 0 && sumAmounts > 0) ? (sumAmounts / maxSlotsForTargetCalc) : 0; propFallbackLog.push(`Valor Médio por Imagem: ${averageValuePerSlot.toFixed(2)}`);
            if (requestedCombinationSize === 1) {
                propFallbackLog.push(`Tam. combo 1: Usando média arredondada.`);
                // **** CALL TO utils.js ****
                const roundedAverage = roundToNearest(averageValuePerSlot, PROPORTIONAL_ROUNDING_STEP);
                if (roundedAverage <= 0 && averageValuePerSlot > 0) { propFallbackLog.push(`<span class="error">Erro: Média arredondada <= 0.</span>`); finderStatus = "Error"; }
                else if (roundedAverage <= 0) { propFallbackLog.push(`Info: Média arredondada <= 0. Usando combo vazia.`); foundCombination = []; }
                else { foundCombination = [roundedAverage]; }
                if (foundCombination !== null) propFallbackLog.push(`Combo Calculada (Tam 1): [${foundCombination.join(', ')}]`);
            } else { if (uniqueValidLpdListWithFreq.length < requestedCombinationSize) { propFallbackLog.push(`<span class="error">Erro: Planos únicos insuficientes (${uniqueValidLpdListWithFreq.length}) para tamanho ${requestedCombinationSize}.</span>`); finderStatus = "Error"; }
                else { const selectedTopLpds = uniqueValidLpdListWithFreq.slice(0, requestedCombinationSize); const selectedLpdValues = selectedTopLpds.map(lpd => lpd.value); propFallbackLog.push(`Top ${requestedCombinationSize} Planos: [${selectedLpdValues.join(', ')}]`); const totalLpdValueMass = selectedLpdValues.reduce((sum, val) => sum + val, 0); propFallbackLog.push(`Soma dos Planos (Base): ${totalLpdValueMass}`);
                    if (totalLpdValueMass <= 0) { propFallbackLog.push(`<span class="error">Erro: Soma dos Planos <= 0.</span>`); finderStatus = "Error"; }
                    else if (averageValuePerSlot <= 0) { propFallbackLog.push(`Info: Valor médio <= 0. Resultado vazio.`); foundCombination = []; }
                    else {
                        propFallbackLog.push(`Distribuindo Valor Médio (${averageValuePerSlot.toFixed(2)})...`);
                        // **** CALL TO utils.js **** (inside map)
                        const proportionalCombination = selectedLpdValues.map(lpdVal => roundToNearest(averageValuePerSlot * (lpdVal / totalLpdValueMass), PROPORTIONAL_ROUNDING_STEP));
                        const finalProportionalCombination = proportionalCombination.filter(v => v > 0);
                        if (finalProportionalCombination.length === 0) { propFallbackLog.push(`<span class="warning">Aviso: Proporcional resultou em nenhum Plano positivo. Usando vazio.</span>`); foundCombination = []; }
                        else if (finalProportionalCombination.length < requestedCombinationSize) { propFallbackLog.push(`<span class="warning">Aviso: Proporcional resultou em apenas ${finalProportionalCombination.length} Planos positivos (req ${requestedCombinationSize}). Usando valores positivos.</span>`); foundCombination = finalProportionalCombination.sort((a,b) => a - b); }
                        else { foundCombination = finalProportionalCombination.sort((a,b) => a - b).slice(0, requestedCombinationSize); }
                        if (foundCombination !== null) { const sumOfProp = foundCombination.reduce((sum, val) => sum + val, 0); propFallbackLog.push(`Combo Proporcional Calculada (Arred., >0): [${foundCombination.join(', ')}]`); propFallbackLog.push(`Soma: ${sumOfProp} (vs Média Imagem: ${averageValuePerSlot.toFixed(2)})`); }
                    }
                }
            } functionLog.push(propFallbackLog.join('\n') + `</div>`);
        }
     }
    return { combination: foundCombination, log: functionLog.join('\n'), status: finderStatus };
}

// --- FUNÇÃO DE COMBINAÇÃO PROPORCIONAL DIRETA ---
function calculateDirectProportionalCombination(parsedItemsData, maxSlotsForTargetCalc, requestedCombinationSize) {
   const functionLog = [];
   let foundCombination = null;
   let finderStatus = "OK";
    // Validation (using global MIN_LPD_VALUE and OBLIGATORY_RANGE from utils.js)
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

   functionLog.push(`--- Registro de Cálculo Proporcional Direto ---`);
   functionLog.push(`Qtd Mín Bruta: ${minAmountFound === Infinity ? 'N/A' : minAmountFound}, Soma Total: ${sumAmounts}`);
   functionLog.push(`Imagens Máx (Alvo): ${maxSlotsForTargetCalc}, Tam. Combo Req.: ${requestedCombinationSize}`);
   functionLog.push(`Planos Válidos Únicos (>=${MIN_LPD_VALUE}): ${uniqueValidLpdListWithFreq.length}`);
   functionLog.push(`Planos (Freq/Valor Ord.): ${uniqueValidLpdListWithFreq.map(l => `${l.value}(${l.frequency})`).join(', ')}`);
   functionLog.push(`Plano Mín Válido: ${minLpdValueFound === Infinity ? 'Nenhum' : minLpdValueFound}`);
   functionLog.push(`Candidatos Próximos ao Mín (+/- ${OBLIGATORY_RANGE}): ${nearMinLpds.length} [${nearMinLpds.map(c=>c.value + '(' + c.frequency + ')').join(', ')}]`);

   if (uniqueValidLpdListWithFreq.length < requestedCombinationSize && requestedCombinationSize > 0) {
        functionLog.push(`<span class="error">Erro: Planos válidos únicos insuficientes (${uniqueValidLpdListWithFreq.length}) disponíveis para o tamanho solicitado ${requestedCombinationSize}.</span>`);
        return { combination: null, log: functionLog.join('\n'), status: "Error" };
    }

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

   functionLog.push(`<div class="proportional-direct-section">--- Cálculo Proporcional ---`);
   let propCalcLog = [];
   const averageValuePerSlot = (maxSlotsForTargetCalc > 0 && sumAmounts > 0) ? (sumAmounts / maxSlotsForTargetCalc) : 0;
   propCalcLog.push(`Valor Médio por Imagem: ${averageValuePerSlot.toFixed(2)}`);

   if (requestedCombinationSize === 1) {
       propCalcLog.push(`Tam. combo 1: Usando média arredondada.`);
       // **** CALL TO utils.js ****
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
           // **** CALL TO utils.js **** (inside map)
           const proportionalCombination = selectedLpdValues.map(lpdVal => roundToNearest(averageValuePerSlot * (lpdVal / totalLpdValueMass), PROPORTIONAL_ROUNDING_STEP));
           const finalProportionalCombination = proportionalCombination.filter(v => v > 0);
           if (finalProportionalCombination.length === 0) { propCalcLog.push(`<span class="warning">Aviso: Proporcional resultou em nenhum Plano positivo. Usando vazio.</span>`); foundCombination = []; }
           else if (finalProportionalCombination.length < requestedCombinationSize) { propCalcLog.push(`<span class="warning">Aviso: Apenas ${finalProportionalCombination.length} Planos positivos resultaram (req ${requestedCombinationSize}). Usando valores positivos.</span>`); foundCombination = finalProportionalCombination.sort((a,b) => a - b); }
           else { foundCombination = finalProportionalCombination.sort((a,b) => a - b).slice(0, requestedCombinationSize); }
           if (foundCombination !== null) { const sumOfProp = foundCombination.reduce((sum, val) => sum + val, 0); propCalcLog.push(`Combo Proporcional Calculada (Arred., >0): [${foundCombination.join(', ')}]`); propCalcLog.push(`Soma: ${sumOfProp} (vs Média Imagem: ${averageValuePerSlot.toFixed(2)})`); } // Push to propCalcLog
       }
   } else {
        propCalcLog.push(`Tam. combo 0 solicitado. Resultado vazio.`);
        foundCombination = [];
   }
   functionLog.push(propCalcLog.join('\n') + `</div>`);

   return { combination: foundCombination, log: functionLog.join('\n'), status: finderStatus };
}

// --- LÓGICA CENTRAL DO ALOCADOR (runAllocationProcess) ---
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

    logs.adjustment += `--- Passo 1: Alocação DP Inicial (Imagens Máx/Instância: ${maxSlotsDisplayLocal}) ---\n`;
    let step1Failed = false;
    itemsToProcess.forEach((item, i) => {
        if (step1Failed) return;
        if (!item || typeof item.details === 'undefined' || typeof item.amount === 'undefined' || typeof item.originalIndex === 'undefined') {
            const errorMsg = `Item inválido no índice de processamento ${i}`;
            logs.adjustment += `<span class="error">Erro: ${errorMsg}</span>\n`;
            console.error(`[runAllocationProcess] Passo 1: ${errorMsg}. Item data:`, item);
            currentItemAllocations[i] = { sum: 0, difference: 0, combination: [], finalUsageCounts: {}, error: "Item inválido" };
            return; // Skip this item
        }
        logs.adjustment += `[${i+1}] Espec ${item.originalIndex + 1} ('${item.details}', Alvo: ${item.amount}): `;
        console.log(`[runAllocationProcess] Passo 1, Item ${i+1}: Alvo=${item.amount}. Calling findClosestSum...`);

        // **** CALL TO utils.js ****
        const allocation = findClosestSumWithRepetitionAndSlots(
             [...uniqueLpdValuesLocal],
             item.amount,
             currentRemainingSlots
        );
        console.log(`[runAllocationProcess] Passo 1, Item ${i+1}: findClosestSum Result:`, JSON.parse(JSON.stringify(allocation)));

        currentItemAllocations[i] = {
           sum: allocation.sum ?? 0,
           difference: allocation.difference ?? (0 - item.amount),
           combination: allocation.combination ? [...allocation.combination] : [],
           finalUsageCounts: {},
           error: allocation.error || null
        };

        if (allocation.error) {
           logs.adjustment += `<span class="error">Erro DP: ${allocation.error}</span>\n`;
            if (allocation.error.includes("Não foi possível alcançar") || allocation.error.includes("nenhum Plano tem imagens")) {
                console.warn(`[runAllocationProcess] Passo 1, Item ${i+1}: DP could not find solution for target ${item.amount}. Error: ${allocation.error}`);
            } else {
                console.error(`[runAllocationProcess] Passo 1, Item ${i+1}: CRITICAL DP Error for target ${item.amount}. Error: ${allocation.error}`);
            }
        } else if (allocation.combination && allocation.combination.length > 0) {
           logs.adjustment += `Soma Enc ${allocation.sum} (Dif: ${allocation.difference}), Combo: [${allocation.combination.join(', ')}]\n`;
           let slotUpdateError = false;
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
                       }
                   }
               } else {
                   console.error(`[runAllocationProcess] Passo 1, Item ${i+1}: LOGIC ERROR! Used LPD ${lpd} not found in remaining slots map!`);
                   logs.adjustment += `<span class="error">ERRO LÓGICA para ${lpd}!</span>\n`;
                   currentItemAllocations[i].error = (currentItemAllocations[i].error || "") + ` ERRO: LPD ${lpd} inválido!`;
                   slotUpdateError = true;
               }
           });
        } else {
             logs.adjustment += `Soma Enc ${allocation.sum} (Dif: ${allocation.difference}), Combo: []\n`;
        }
    }); // End Passo 1

    if (step1Failed) {
        console.error("[runAllocationProcess] Halting after fatal error in Passo 1.");
        return { itemAllocations: currentItemAllocations, cumulativeUsage: {}, remainingSlots: currentRemainingSlots, logs: logs, error: "Falha crítica no Passo 1." };
    }
    console.log("[runAllocationProcess] Passo 1 Complete. Final allocations:", JSON.parse(JSON.stringify(currentItemAllocations)));
    console.log("[runAllocatorProcess] Passo 1 Complete. Final remaining slots:", JSON.stringify(currentRemainingSlots));
    logs.adjustment += `Imagens Rem Após Passo 1: ${JSON.stringify(currentRemainingSlots)}\n`;

    // Passo 2: Preenchimento de Imagens
    console.log("[runAllocatorProcess] Starting Passo 2 (Slot Filling)...");
    let adjustmentLogHTML = `--- Passo 2: Preenchimento de Imagens (Imagens Máx/Instância: ${maxSlotsDisplayLocal}) ---`;
    if (maxSlotsIsFinite) {
        adjustmentLogHTML += `\nImagens Rem Iniciais Passo 2: ${JSON.stringify(currentRemainingSlots, null, 0)}`;
        let totalRemainingPass2 = Object.values(currentRemainingSlots).reduce((sum, count) => count === Infinity ? sum : sum + count, 0);
        adjustmentLogHTML += `\nTotal Imagens Finitas Rem: ${totalRemainingPass2}`;
        let adjustmentSafetyCounter = 0;
        const maxAdjustments = totalRemainingPass2 + itemsToProcess.length * uniqueLpdValuesLocal.length + 50;
        while (totalRemainingPass2 > 0 && adjustmentSafetyCounter < maxAdjustments) {
           adjustmentSafetyCounter++;
           let bestMove = { lpdToAdd: null, itemIndex: -1, minImpact: Infinity, currentAbsDiff: Infinity };
           for (const lpd of uniqueLpdValuesLocal) {
               if (currentRemainingSlots[lpd] > 0) {
                   for (let i = 0; i < currentItemAllocations.length; i++) {
                       const currentAlloc = currentItemAllocations[i];
                       if (!currentAlloc || currentAlloc.error || currentAlloc.sum === undefined) continue;
                       const item = itemsToProcess[i]; if (!item) continue;
                       const originalAmount = item.amount;
                       const currentSum = currentAlloc.sum;
                       const currentAbsDifference = Math.abs(currentAlloc.difference);
                       const newSum = currentSum + lpd;
                       const newAbsDifference = Math.abs(newSum - originalAmount);
                       const impact = newAbsDifference - currentAbsDifference;
                       if (impact < bestMove.minImpact || (impact === bestMove.minImpact && currentAbsDifference > bestMove.currentAbsDiff)) {
                           bestMove = { lpdToAdd: lpd, itemIndex: i, minImpact: impact, currentAbsDiff: currentAbsDifference };
                       }
                   }
               }
           }
           if (bestMove.lpdToAdd !== null) {
               const lpd = bestMove.lpdToAdd;
               const itemIdx = bestMove.itemIndex;
               if (itemIdx < 0 || itemIdx >= currentItemAllocations.length || !currentItemAllocations[itemIdx] || !itemsToProcess[itemIdx]) {
                   console.error(`Passo 2: Índice de item inválido (${itemIdx}) para melhor movimento.`); adjustmentLogHTML += `\n<span class="error">Erro interno no Passo 2.</span>`; break;
               }
               adjustmentLogHTML += `<div class="adjustment-step">Passo ${adjustmentSafetyCounter}: Adic Plano <span class="info">${lpd}</span> ao Especificação ${itemsToProcess[itemIdx].originalIndex + 1} ('${itemsToProcess[itemIdx].details}') (Impacto: ${bestMove.minImpact >= 0 ? '+' : ''}${bestMove.minImpact.toFixed(0)})`;
               currentItemAllocations[itemIdx].combination.push(lpd);
               currentItemAllocations[itemIdx].combination.sort((a, b) => a - b);
               currentItemAllocations[itemIdx].sum += lpd;
               currentItemAllocations[itemIdx].difference = currentItemAllocations[itemIdx].sum - itemsToProcess[itemIdx].amount;
               currentRemainingSlots[lpd]--;
               totalRemainingPass2--;
               adjustmentLogHTML += `\n   -> Nova Soma: ${currentItemAllocations[itemIdx].sum}, Dif: ${currentItemAllocations[itemIdx].difference.toFixed(0)}, Imagens Rem ${lpd}: ${currentRemainingSlots[lpd]}</div>`;
           } else { adjustmentLogHTML += `\n<span class="warning">Parado Passo 2 (Iter ${adjustmentSafetyCounter}): Nenhum movimento benéfico. ${totalRemainingPass2} imagens finitas restantes.</span>`; break; }
        }
        if (adjustmentSafetyCounter >= maxAdjustments) { adjustmentLogHTML += `\n<span class="error">Parado Passo 2: Limite de segurança (${maxAdjustments}) atingido.</span>`; }
        adjustmentLogHTML += `\nImagens Rem Após Passo 2: ${JSON.stringify(currentRemainingSlots)}`;
    } else { adjustmentLogHTML += `\n(Pulado: Imagens Máx Ilimitadas)`; }
    logs.adjustment = adjustmentLogHTML;
    console.log("[runAllocatorProcess] Passo 2 Complete.");

    // Passo 3: Correção de Variação
    // Uses global VARIATION_LIMIT_PASS_3 from utils.js
    console.log("[runAllocatorProcess] Starting Passo 3 (Variation Correction)...");
    let variationLogHTML = `--- Passo 3: Correção de Variação (Alvo: ±${(VARIATION_LIMIT_PASS_3 * 100).toFixed(0)}%) ---`;
    let madeVariationAdjustment = true; let variationLoopCounter = 0;
    const maxVariationLoops = itemsToProcess.length * uniqueLpdValuesLocal.length * 3 + 50;
    while (madeVariationAdjustment && variationLoopCounter < maxVariationLoops) {
       variationLoopCounter++; madeVariationAdjustment = false;
       let worstViolation = { index: -1, percentageDiff: 0, absDifference: 0 };
       currentItemAllocations.forEach((alloc, i) => {
            if (alloc && !alloc.error && alloc.difference !== undefined) {
               const item = itemsToProcess[i]; if (!item) return;
               const targetAmount = item.amount; let currentAbsPercentage = 0; const currentAbsDifference = Math.abs(alloc.difference);
               if (targetAmount > 0) { currentAbsPercentage = currentAbsDifference / targetAmount; } else if (alloc.sum !== 0) { currentAbsPercentage = Infinity; }
               if (currentAbsPercentage > VARIATION_LIMIT_PASS_3) { if (currentAbsPercentage > worstViolation.percentageDiff || (currentAbsPercentage === worstViolation.percentageDiff && currentAbsDifference > worstViolation.absDifference)) { worstViolation = { index: i, percentageDiff: currentAbsPercentage, absDifference: currentAbsDifference }; } }
           }
       });

       if (worstViolation.index === -1) { variationLogHTML += `\nIter ${variationLoopCounter}: Nenhum item > ±${(VARIATION_LIMIT_PASS_3 * 100).toFixed(0)}%. Passo 3 completo.`; break; }
       const itemIdx = worstViolation.index; const currentAlloc = currentItemAllocations[itemIdx];
       if (!currentAlloc || !itemsToProcess[itemIdx]) { console.error(`Passo 3: Índice inválido (${itemIdx}) ou item/alocação ausente.`); variationLogHTML += `\n<span class="error">Erro interno no Passo 3 (índice ${itemIdx}).</span>`; break; }
       const originalAmount = itemsToProcess[itemIdx].amount;
       variationLogHTML += `<div class="variation-step">Iter ${variationLoopCounter}: Corrigindo Especificação ${itemsToProcess[itemIdx].originalIndex + 1} ('${itemsToProcess[itemIdx].details}') - Dif: ${currentAlloc.difference.toFixed(0)} (${(worstViolation.percentageDiff * 100).toFixed(1)}%)`;

       let bestFix = { action: null, lpd: null, finalAbsDiff: Math.abs(currentAlloc.difference), finalPercDiff: worstViolation.percentageDiff };
       const currentCombinationCopy = Array.isArray(currentAlloc.combination) ? [...currentAlloc.combination] : [];

       // Try removing
       for (const lpdToRemove of new Set(currentCombinationCopy)) {
           if (!lpdToRemove || typeof lpdToRemove !== 'number') continue;
           const newSum = currentAlloc.sum - lpdToRemove; const newAbsDiff = Math.abs(newSum - originalAmount); let newPercentageDiff = originalAmount > 0 ? newAbsDiff / originalAmount : (newSum === 0 ? 0 : Infinity);
           if (newPercentageDiff <= VARIATION_LIMIT_PASS_3) { if (newAbsDiff < bestFix.finalAbsDiff) { bestFix = { action: 'remove', lpd: lpdToRemove, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff }; } }
           else if (bestFix.action === null && newAbsDiff < bestFix.finalAbsDiff) { bestFix = { action: 'remove', lpd: lpdToRemove, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff }; }
       }
       // Try adding
       for (const lpdToAdd of uniqueLpdValuesLocal) {
           if (maxSlotsIsFinite && currentRemainingSlots[lpdToAdd] <= 0) continue;
           const newSum = currentAlloc.sum + lpdToAdd; const newAbsDiff = Math.abs(newSum - originalAmount); let newPercentageDiff = originalAmount > 0 ? newAbsDiff / originalAmount : (newSum === 0 ? 0 : Infinity);
           if (newPercentageDiff <= VARIATION_LIMIT_PASS_3) { if (newAbsDiff < bestFix.finalAbsDiff) { bestFix = { action: 'add', lpd: lpdToAdd, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff }; } }
           else if (bestFix.action === null && newAbsDiff < bestFix.finalAbsDiff) { bestFix = { action: 'add', lpd: lpdToAdd, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff }; }
       }

       if (bestFix.action) {
            madeVariationAdjustment = true; const lpd = bestFix.lpd;
            variationLogHTML += ` -> Ação: <span class="info">${bestFix.action === 'remove' ? 'REMOVER' : 'ADICIONAR'} ${lpd}</span>`;
            if (bestFix.action === 'remove') {
               const indexToRemove = currentItemAllocations[itemIdx].combination.indexOf(lpd);
               if (indexToRemove > -1) {
                   currentItemAllocations[itemIdx].combination.splice(indexToRemove, 1); currentItemAllocations[itemIdx].sum -= lpd; currentItemAllocations[itemIdx].difference -= lpd;
                   if (maxSlotsIsFinite) { currentRemainingSlots[lpd]++; }
               } else { console.error(`Erro VFix: remover ${lpd} não encontrado em ${itemIdx}`); variationLogHTML += ` <span class="error">(Erro!)</span>`; madeVariationAdjustment = false; }
            } else { // Add
               currentItemAllocations[itemIdx].combination.push(lpd); currentItemAllocations[itemIdx].combination.sort((a, b) => a - b); currentItemAllocations[itemIdx].sum += lpd; currentItemAllocations[itemIdx].difference += lpd;
               if (maxSlotsIsFinite) { currentRemainingSlots[lpd]--; }
            }
            const finalPercDiffCheck = originalAmount > 0 ? Math.abs(currentItemAllocations[itemIdx].difference / originalAmount) : (currentItemAllocations[itemIdx].sum === 0 ? 0 : Infinity);
            variationLogHTML += ` -> Nova Dif: ${currentItemAllocations[itemIdx].difference.toFixed(0)} (${(finalPercDiffCheck * 100).toFixed(1)}%)`;
            if (finalPercDiffCheck <= VARIATION_LIMIT_PASS_3) { variationLogHTML += ` <span class="success">(OK)</span>`; } else { variationLogHTML += ` <span class="warning">(Ainda Alto)</span>`; }
            if (maxSlotsIsFinite) { variationLogHTML += `, Imagens Rem ${lpd}: ${currentRemainingSlots[lpd]}`; }
       } else { variationLogHTML += ` -> <span class="warning">Nenhuma correção encontrada. Parando Passo 3.</span>`; madeVariationAdjustment = false; }
       variationLogHTML += `</div>`;
    }
    if (variationLoopCounter >= maxVariationLoops) { variationLogHTML += `\n<span class="error">Parado Passo 3: Limite de loop (${maxVariationLoops}) atingido.</span>`; }
    logs.variation = variationLogHTML;
    console.log("[runAllocatorProcess] Passo 3 Complete.");

    // Contagem Final
    console.log("[runAllocatorProcess] Starting Final Count...");
    let finalCumulativeUsage = {}; uniqueLpdValuesLocal.forEach(lpd => { finalCumulativeUsage[lpd] = 0; });
    currentItemAllocations.forEach(alloc => {
        alloc.finalUsageCounts = {};
        if (alloc && !alloc.error && Array.isArray(alloc.combination)) {
           alloc.combination.forEach(lpd => {
               if (typeof lpd === 'number' && !isNaN(lpd)) {
                   alloc.finalUsageCounts[lpd] = (alloc.finalUsageCounts[lpd] || 0) + 1;
                   if (finalCumulativeUsage.hasOwnProperty(lpd)) { finalCumulativeUsage[lpd]++; }
                   else { console.error(`Erro Lógica Contagem Final: Plano ${lpd} usado mas não na lista única (${uniqueLpdValuesLocal.join(',')}).`); }
               } else {
                   console.warn("Skipping invalid LPD during final count:", lpd);
               }
            });
        }
    });
    console.log("[runAllocatorProcess] Final Count Complete. Cumulative Usage:", JSON.stringify(finalCumulativeUsage));

    // Return final results
    console.log("[runAllocationProcess] END. Returning results.");
    const finalItemAllocations = Array.isArray(currentItemAllocations) ? currentItemAllocations : [];
    return { itemAllocations: finalItemAllocations, cumulativeUsage: finalCumulativeUsage, remainingSlots: currentRemainingSlots, logs: logs };
}

// --- Iterative Refinement Function ---
/**
* Attempts to improve an allocation result by swapping LPDs between
* items with large positive and negative differences.
* @param {object} resultEntry - The strategy result object to refine.
* @returns {{refinedResultEntry: object, log: string}} - Object containing the potentially refined result and the log.
*/
function refineAllocationResult(resultEntry) {
   console.log(`[refineAllocationResult] START for strategy: ${resultEntry.strategyName}`);
   let refinementLog = [`--- Registro de Refinamento Iterativo (Estratégia: ${resultEntry.strategyName}) ---`];

   // --- Configuration (using global VARIATION_LIMIT_PASS_3 from utils.js) ---
   const MAX_REFINEMENT_PASSES = 5;
   const MIN_IMPROVEMENT_THRESHOLD = 1;
   const SWAP_VIOLATION_THRESHOLD = VARIATION_LIMIT_PASS_3;

   // Input Validation
   if (!resultEntry || !resultEntry.resultData || !resultEntry.resultData.itemAllocations || !resultEntry.itemsUsed) {
       refinementLog.push("<span class='error'>Erro: Dados de entrada inválidos para refinamento.</span>");
       console.error("[refineAllocationResult] Invalid input resultEntry:", resultEntry);
       return { refinedResultEntry: resultEntry, log: refinementLog.join('\n') };
   }
   if (resultEntry.hasAllocationError) {
        refinementLog.push("<span class='warning'>Aviso: Refinamento pulado pois a estratégia inicial continha erros de alocação.</span>");
        console.log(`[refineAllocationResult] Skipping refinement for ${resultEntry.strategyName} due to initial allocation errors.`);
        return { refinedResultEntry: resultEntry, log: refinementLog.join('\n') };
   }

   // Make deep copies
   let currentAllocations = JSON.parse(JSON.stringify(resultEntry.resultData.itemAllocations));
   let items = resultEntry.itemsUsed;
   let overallImprovementMade = false;

   // Refinement Loop
   for (let pass = 1; pass <= MAX_REFINEMENT_PASSES; pass++) {
       refinementLog.push(`\n--- Passe de Refinamento ${pass}/${MAX_REFINEMENT_PASSES} ---`);
       let swapsMadeInPass = 0;

       // Identify candidates
       let positiveDiffItems = [];
       let negativeDiffItems = [];
       currentAllocations.forEach((alloc, index) => {
           if (alloc && !alloc.error && alloc.difference !== undefined) {
               if (alloc.difference > MIN_IMPROVEMENT_THRESHOLD) { positiveDiffItems.push({ index, alloc }); }
               else if (alloc.difference < -MIN_IMPROVEMENT_THRESHOLD) { negativeDiffItems.push({ index, alloc }); }
           }
       });

       if (positiveDiffItems.length === 0 || negativeDiffItems.length === 0) {
           refinementLog.push("Nenhum par de itens com diferenças opostas significativas encontrado.");
           break;
       }

       // Sort candidates
       positiveDiffItems.sort((a, b) => b.alloc.difference - a.alloc.difference);
       negativeDiffItems.sort((a, b) => Math.abs(b.alloc.difference) - Math.abs(a.alloc.difference));
       refinementLog.push(`Candidatos (+): ${positiveDiffItems.length}, Candidatos (-): ${negativeDiffItems.length}`);

       // Iterate through potential swaps
       let itemSwappedFlags = new Array(currentAllocations.length).fill(false);
       for (let posItemData of positiveDiffItems) {
           if (itemSwappedFlags[posItemData.index]) continue;
           for (let negItemData of negativeDiffItems) {
               if (itemSwappedFlags[negItemData.index]) continue;
               if (posItemData.index === negItemData.index) continue;

               let bestSwapForPair = { lpdToSwap: null, improvement: -Infinity, lpdIndexInPos: -1 };
               const posIndex = posItemData.index; const negIndex = negItemData.index;
               const posAlloc = posItemData.alloc; const negAlloc = negItemData.alloc;
               const posItemTarget = items[posIndex]?.amount ?? 0;
               const negItemTarget = items[negIndex]?.amount ?? 0;
               const posCombination = Array.isArray(posAlloc.combination) ? posAlloc.combination : [];

               for (let lpdIndex = 0; lpdIndex < posCombination.length; lpdIndex++) {
                   const lpd = posCombination[lpdIndex];
                   if (!lpd || lpd <= 0) continue;

                   const newPosDiff = posAlloc.difference - lpd;
                   const newNegDiff = negAlloc.difference + lpd;
                   const currentTotalAbsDiff = Math.abs(posAlloc.difference) + Math.abs(negAlloc.difference);
                   const newTotalAbsDiff = Math.abs(newPosDiff) + Math.abs(newNegDiff);
                   const improvement = newTotalAbsDiff - currentTotalAbsDiff;

                   // Check Swap Validity
                   if (improvement > -MIN_IMPROVEMENT_THRESHOLD) continue;
                   const currentPosViolates = posItemTarget > 0 && Math.abs(posAlloc.difference / posItemTarget) > SWAP_VIOLATION_THRESHOLD;
                   const currentNegViolates = negItemTarget > 0 && Math.abs(negAlloc.difference / negItemTarget) > SWAP_VIOLATION_THRESHOLD;
                   const newPosViolates = posItemTarget > 0 && Math.abs(newPosDiff / posItemTarget) > SWAP_VIOLATION_THRESHOLD;
                   const newNegViolates = negItemTarget > 0 && Math.abs(newNegDiff / negItemTarget) > SWAP_VIOLATION_THRESHOLD;
                   let makesWorseViolation = false;
                   if ((!currentPosViolates && newPosViolates && !currentNegViolates) ||
                       (!currentNegViolates && newNegViolates && !currentPosViolates)) {
                        makesWorseViolation = true;
                   }
                   if (makesWorseViolation && !( (currentPosViolates && !newPosViolates) || (currentNegViolates && !newNegViolates) ) ) {
                        continue;
                   }

                   if (improvement < bestSwapForPair.improvement) {
                       bestSwapForPair = { lpdToSwap: lpd, improvement: improvement, lpdIndexInPos: lpdIndex };
                   }
               } // End LPD loop

               if (bestSwapForPair.lpdToSwap !== null) {
                   const lpd = bestSwapForPair.lpdToSwap; const lpdIdxToRemove = bestSwapForPair.lpdIndexInPos;
                   refinementLog.push(`<div class='adjustment-step'>Swap: Mover Plano <span class='info'>${lpd}</span> de Espec ${posIndex + 1} ('${items[posIndex]?.details}') para Espec ${negIndex + 1} ('${items[negIndex]?.details}') (Melhora: ${(-bestSwapForPair.improvement).toFixed(0)})`);

                   // Execute swap
                   posAlloc.combination.splice(lpdIdxToRemove, 1);
                   posAlloc.sum -= lpd; posAlloc.difference -= lpd;
                   posAlloc.finalUsageCounts[lpd] = (posAlloc.finalUsageCounts[lpd] || 1) - 1;
                   if (posAlloc.finalUsageCounts[lpd] <= 0) delete posAlloc.finalUsageCounts[lpd];
                   negAlloc.combination.push(lpd);
                   negAlloc.combination.sort((a, b) => a - b);
                   negAlloc.sum += lpd; negAlloc.difference += lpd;
                   negAlloc.finalUsageCounts[lpd] = (negAlloc.finalUsageCounts[lpd] || 0) + 1;

                   refinementLog.push(`   -> Espec ${posIndex + 1}: Nova Dif ${posAlloc.difference.toFixed(0)}`);
                   refinementLog.push(`   -> Espec ${negIndex + 1}: Nova Dif ${negAlloc.difference.toFixed(0)}</div>`);

                   swapsMadeInPass++; overallImprovementMade = true;
                   itemSwappedFlags[posIndex] = true; itemSwappedFlags[negIndex] = true;
                   break; // Next positive item
               }
           } // End negative item loop
       } // End positive item loop

       refinementLog.push(`Swaps realizados neste passe: ${swapsMadeInPass}`);
       if (swapsMadeInPass === 0) {
           refinementLog.push("Nenhuma melhoria adicional encontrada neste passe.");
           break;
       }
   } // End refinement pass loop

   // Final update if needed
   if (overallImprovementMade) {
       refinementLog.push("\n<span class='success'>Refinamento concluído. Aplicando melhorias.</span>");
       console.log(`[refineAllocationResult] Improvements made for ${resultEntry.strategyName}. Updating resultEntry.`);
       resultEntry.resultData.itemAllocations = currentAllocations;
       // **** CALLS TO utils.js ****
       resultEntry.maxVariation = calculateMaxVariation(items, currentAllocations);
       resultEntry.avgVariation = calculateAverageVariation(items, currentAllocations);
       // Uses global REPROCESS_VARIATION_LIMIT from utils.js
       resultEntry.meetsLimit = !resultEntry.hasAllocationError && resultEntry.maxVariation <= REPROCESS_VARIATION_LIMIT;
       console.log(`[refineAllocationResult] Recalculated metrics: MaxVar=${resultEntry.maxVariation.toFixed(4)}, AvgVar=${resultEntry.avgVariation.toFixed(4)}, MeetsLimit=${resultEntry.meetsLimit}`);
   } else {
       refinementLog.push("\nNenhuma melhoria encontrada ou aplicada durante o refinamento.");
       console.log(`[refineAllocationResult] No improvements made for ${resultEntry.strategyName}.`);
   }

   console.log(`[refineAllocationResult] END for strategy: ${resultEntry.strategyName}`);
   return { refinedResultEntry: resultEntry, log: refinementLog.join('\n') };
}
// --- END Refinement Function ---

// --- Helper Function to Generate Plan Assembly Data ---
/**
* Generates the structured data for plan assembly based on final allocations.
* @param {Array} finalItems - The items array used in the allocation (ordered by processing).
* @param {Array} finalAllocations - The corresponding allocation results.
* @param {Array} userLpdCombinationWithDuplicatesLocal - The original LPD combination used.
* @param {number|Infinity} maxSlotsNum - Max slots per instance.
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
       const allLpdUses = [];
       finalItems.forEach((item, i) => {
           const finalAlloc = finalAllocations[i];
           // Only consider successful allocations with combinations
           if (finalAlloc && !finalAlloc.error && finalAlloc.combination && finalAlloc.combination.length > 0) {
               finalAlloc.combination.forEach(lpdVal => {
                   // Ensure item details exist before pushing
                   if(item && item.details) {
                        allLpdUses.push({ itemIndex: i, itemDetails: item.details, lpdValue: lpdVal, assignedInstanceKey: null });
                   } else {
                       console.warn("generatePlanAssemblyData: Skipping LPD use due to missing item details at index", i);
                   }
               });
           }
       });

       const lpdInstanceCounters = {};
       const breakdownByInstance = {}; // Temporary map

       // Ensure userLpdCombinationWithDuplicatesLocal is iterable
        if (!Array.isArray(userLpdCombinationWithDuplicatesLocal)) {
           console.error("generatePlanAssemblyData: userLpdCombinationWithDuplicatesLocal is not an array.");
           return null; // Cannot iterate if not an array
        }

       userLpdCombinationWithDuplicatesLocal.forEach(lpdInputVal => {
           // Ensure lpdInputVal is valid before using as key
           if (lpdInputVal === null || lpdInputVal === undefined) {
               console.warn("generatePlanAssemblyData: Skipping null/undefined LPD value in user combination.");
               return;
           }
           const currentInstanceNum = (lpdInstanceCounters[lpdInputVal] || 0) + 1;
           lpdInstanceCounters[lpdInputVal] = currentInstanceNum;
           const instanceKey = `${lpdInputVal}_${currentInstanceNum}`;
           breakdownByInstance[instanceKey] = { lpdValue: lpdInputVal, instanceNum: currentInstanceNum }; // Initialize temporary structure

           let assignedToThisInstance = 0;
           for (let use of allLpdUses) {
               // Strict comparison for LPD values
               if (use.lpdValue === lpdInputVal && use.assignedInstanceKey === null) {
                   if (!maxSlotsIsFinite || assignedToThisInstance < maxSlotsNum) {
                       use.assignedInstanceKey = instanceKey;
                       assignedToThisInstance++;
                   }
                   if (maxSlotsIsFinite && assignedToThisInstance >= maxSlotsNum) break;
               }
           }
       });

       Object.keys(breakdownByInstance).forEach(instanceKey => {
           const instanceDataTemp = breakdownByInstance[instanceKey];
           const usesForThisInstance = allLpdUses.filter(use => use.assignedInstanceKey === instanceKey);
           const totalUsedInInstance = usesForThisInstance.length;

           // Only add if items were actually assigned
           if (totalUsedInInstance > 0) {
               const itemsMap = {};
               usesForThisInstance.forEach(use => {
                   // Ensure itemDetails is valid before using as key
                   if(use.itemDetails) {
                        itemsMap[use.itemDetails] = (itemsMap[use.itemDetails] || 0) + 1;
                   } else {
                       console.warn("generatePlanAssemblyData: Skipping use with null itemDetails during map creation.");
                   }
               });
               const itemsArray = Object.entries(itemsMap).map(([details, count]) => ({ details, count })).sort((a, b) => (a.details || '').localeCompare(b.details || '')); // Add safety for sort

               planAssemblyDataForExport.push({
                   planValue: instanceDataTemp.lpdValue,
                   instanceNum: instanceDataTemp.instanceNum,
                   totalUsed: totalUsedInInstance,
                   maxSlots: maxSlotsIsFinite ? maxSlotsNum : Infinity,
                   items: itemsArray
               });
           }
       });

       planAssemblyDataForExport.sort((a, b) => (a.planValue || 0) - (b.planValue || 0) || (a.instanceNum || 0) - (b.instanceNum || 0)); // Add safety for sort

       // Check for unassigned uses (optional, for debugging)
       const unassignedUses = allLpdUses.filter(use => use.assignedInstanceKey === null);
       if (unassignedUses.length > 0) {
           console.warn(`generatePlanAssemblyData: ${unassignedUses.length} LPD uses were not assigned to an instance. Details:`, unassignedUses);
       }

   } catch (error) {
       console.error("Error during generatePlanAssemblyData:", error);
       return null; // Return null on error
   }
   return planAssemblyDataForExport;
}
// --- End Helper Function ---