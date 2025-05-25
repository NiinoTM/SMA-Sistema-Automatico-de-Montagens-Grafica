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
    let madeVariationAdjustment = true;
    let variationLoopCounter = 0;
    const maxVariationLoops = itemsToProcess.length * uniqueLpdValuesLocal.length * 3 + 50; // Safety break

    while (madeVariationAdjustment && variationLoopCounter < maxVariationLoops) {
        variationLoopCounter++;
        madeVariationAdjustment = false;

        let worstViolation = { index: -1, percentageDiff: 0, absDifference: 0 };
        currentItemAllocations.forEach((alloc, i) => {
            if (alloc && !alloc.error && alloc.difference !== undefined) {
                const item = itemsToProcess[i];
                if (!item) return;
                const targetAmount = item.amount;
                let currentAbsPercentage = 0;
                const currentAbsDifferenceValue = Math.abs(alloc.difference);
                if (targetAmount > 0) {
                    currentAbsPercentage = currentAbsDifferenceValue / targetAmount;
                } else if (alloc.sum !== 0) {
                    currentAbsPercentage = Infinity;
                }

                if (currentAbsPercentage > VARIATION_LIMIT_PASS_3) {
                    if (currentAbsPercentage > worstViolation.percentageDiff ||
                        (currentAbsPercentage === worstViolation.percentageDiff && currentAbsDifferenceValue > worstViolation.absDifference)) {
                        worstViolation = { index: i, percentageDiff: currentAbsPercentage, absDifference: currentAbsDifferenceValue };
                    }
                }
            }
        });

        if (worstViolation.index === -1) {
            variationLogHTML += `\nIter ${variationLoopCounter}: Nenhum item > ±${(VARIATION_LIMIT_PASS_3 * 100).toFixed(0)}%. Passo 3 completo.`;
            break;
        }

        const itemIdx = worstViolation.index;
        const currentAlloc = currentItemAllocations[itemIdx];
        const primaryItem = itemsToProcess[itemIdx]; // Renamed for clarity
        if (!currentAlloc || !primaryItem) {
            console.error(`Passo 3: Índice inválido (${itemIdx}) ou item/alocação ausente.`);
            variationLogHTML += `\n<span class="error">Erro interno no Passo 3 (índice ${itemIdx}).</span>`;
            break;
        }
        const originalAmountPrimary = primaryItem.amount;
        variationLogHTML += `<div class="variation-step">Iter ${variationLoopCounter}: Corrigindo Especificação ${primaryItem.originalIndex + 1} ('${primaryItem.details}') - Dif: ${currentAlloc.difference.toFixed(0)} (${(worstViolation.percentageDiff * 100).toFixed(1)}%)`;

        let bestFix = { action: null, lpd: null, finalAbsDiff: Math.abs(currentAlloc.difference), finalPercDiff: worstViolation.percentageDiff };
        const currentCombinationCopy = Array.isArray(currentAlloc.combination) ? [...currentAlloc.combination] : [];

        for (const lpdToRemove of new Set(currentCombinationCopy)) {
            if (!lpdToRemove || typeof lpdToRemove !== 'number') continue;
            const newSum = currentAlloc.sum - lpdToRemove;
            const newAbsDiff = Math.abs(newSum - originalAmountPrimary);
            let newPercentageDiff = originalAmountPrimary > 0 ? newAbsDiff / originalAmountPrimary : (newSum === 0 ? 0 : Infinity);
            if (newPercentageDiff <= VARIATION_LIMIT_PASS_3) {
                if (newAbsDiff < bestFix.finalAbsDiff || (newAbsDiff === bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3)) {
                    bestFix = { action: 'remove', lpd: lpdToRemove, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                }
            } else {
                if (newAbsDiff < bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3) {
                    bestFix = { action: 'remove', lpd: lpdToRemove, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                }
            }
        }

        for (const lpdToAdd of uniqueLpdValuesLocal) {
            if (maxSlotsIsFinite && currentRemainingSlots[lpdToAdd] <= 0) continue;
            const newSum = currentAlloc.sum + lpdToAdd;
            const newAbsDiff = Math.abs(newSum - originalAmountPrimary);
            let newPercentageDiff = originalAmountPrimary > 0 ? newAbsDiff / originalAmountPrimary : (newSum === 0 ? 0 : Infinity);
            if (newPercentageDiff <= VARIATION_LIMIT_PASS_3) {
                if (newAbsDiff < bestFix.finalAbsDiff || (newAbsDiff === bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3)) {
                    bestFix = { action: 'add', lpd: lpdToAdd, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                }
            } else {
                if (newAbsDiff < bestFix.finalAbsDiff && bestFix.finalPercDiff > VARIATION_LIMIT_PASS_3) {
                    bestFix = { action: 'add', lpd: lpdToAdd, finalAbsDiff: newAbsDiff, finalPercDiff: newPercentageDiff };
                }
            }
        }

        if (bestFix.action) {
            madeVariationAdjustment = true;
            const lpdInvolved = bestFix.lpd;
            const itemIndexPrimary = itemIdx; // Index of the item being corrected

            variationLogHTML += ` -> Ação: <span class="info">${bestFix.action === 'remove' ? 'REMOVER' : 'ADICIONAR'} ${lpdInvolved}</span>`;

            if (bestFix.action === 'remove') {
                const lpdIndexInPrimaryItem = currentItemAllocations[itemIndexPrimary].combination.indexOf(lpdInvolved);
                if (lpdIndexInPrimaryItem > -1) {
                    currentItemAllocations[itemIndexPrimary].combination.splice(lpdIndexInPrimaryItem, 1);
                    currentItemAllocations[itemIndexPrimary].sum -= lpdInvolved;
                    currentItemAllocations[itemIndexPrimary].difference = currentItemAllocations[itemIndexPrimary].sum - itemsToProcess[itemIndexPrimary].amount;
                    
                    variationLogHTML += ` (Plano ${lpdInvolved} liberado da Espec ${itemsToProcess[itemIndexPrimary].originalIndex + 1} ('${itemsToProcess[itemIndexPrimary].details}'))`;

                    let reAssignedToRecipient = false;
                    if (itemsToProcess.length > 1) { // Only attempt re-assignment if there are other items
                        let bestRecipientForMove = {
                            index: -1,
                            smallestResultingAbsPercDiff: Infinity,
                            originalAbsDiffOfRecipientForTieBreak: Infinity // Initialize to a high value for tie-breaking logic
                        };

                        for (let k = 0; k < currentItemAllocations.length; k++) {
                            if (k === itemIndexPrimary) continue;

                            const recipientAlloc = currentItemAllocations[k];
                            const recipientItem = itemsToProcess[k];
                            if (!recipientAlloc || recipientAlloc.error || !recipientItem) continue;

                            const recipientTarget = recipientItem.amount;
                            const simulatedSumForRecipient = recipientAlloc.sum + lpdInvolved;
                            const simulatedDifferenceForRecipient = simulatedSumForRecipient - recipientTarget;
                            const simulatedAbsPercDiffForRecipient = recipientTarget > 0 ? Math.abs(simulatedDifferenceForRecipient / recipientTarget) : (simulatedSumForRecipient === 0 ? 0 : Infinity);

                            if (simulatedAbsPercDiffForRecipient < bestRecipientForMove.smallestResultingAbsPercDiff) {
                                bestRecipientForMove = {
                                    index: k,
                                    smallestResultingAbsPercDiff: simulatedAbsPercDiffForRecipient,
                                    originalAbsDiffOfRecipientForTieBreak: Math.abs(recipientAlloc.difference)
                                };
                            } else if (simulatedAbsPercDiffForRecipient === bestRecipientForMove.smallestResultingAbsPercDiff) {
                                if (Math.abs(recipientAlloc.difference) > bestRecipientForMove.originalAbsDiffOfRecipientForTieBreak) {
                                     bestRecipientForMove.index = k;
                                     bestRecipientForMove.originalAbsDiffOfRecipientForTieBreak = Math.abs(recipientAlloc.difference);
                                }
                            }
                        }

                        if (bestRecipientForMove.index !== -1) {
                            const recipientIdx = bestRecipientForMove.index;
                            currentItemAllocations[recipientIdx].combination.push(lpdInvolved);
                            currentItemAllocations[recipientIdx].combination.sort((a, b) => a - b);
                            currentItemAllocations[recipientIdx].sum += lpdInvolved;
                            currentItemAllocations[recipientIdx].difference = currentItemAllocations[recipientIdx].sum - itemsToProcess[recipientIdx].amount;
                            reAssignedToRecipient = true;

                            const finalPercDiffRecipient = itemsToProcess[recipientIdx].amount > 0 ? Math.abs(currentItemAllocations[recipientIdx].difference / itemsToProcess[recipientIdx].amount) : (currentItemAllocations[recipientIdx].sum === 0 ? 0 : Infinity);
                            variationLogHTML += ` -> Plano ${lpdInvolved} MOVIMENTADO para Espec ${itemsToProcess[recipientIdx].originalIndex + 1} ('${itemsToProcess[recipientIdx].details}'). Nova Dif Recip: ${currentItemAllocations[recipientIdx].difference.toFixed(0)} (${(finalPercDiffRecipient * 100).toFixed(1)}%)`;
                            if (finalPercDiffRecipient <= VARIATION_LIMIT_PASS_3) variationLogHTML += ` <span class="success">(OK Recip)</span>`; else variationLogHTML += ` <span class="warning">(Alto Recip)</span>`;
                        }
                    }

                    if (!reAssignedToRecipient) {
                        variationLogHTML += ` -> <span class="warning">Plano ${lpdInvolved} não pôde ser movimentado. Retornado ao pool.</span>`;
                        if (maxSlotsIsFinite) {
                            currentRemainingSlots[lpdInvolved]++;
                        }
                    }
                } else {
                    variationLogHTML += ` <span class="error">(Erro ao localizar LPD ${lpdInvolved} para remover da Espec ${itemsToProcess[itemIndexPrimary].originalIndex + 1}!)</span>`;
                    madeVariationAdjustment = false;
                }
            } else if (bestFix.action === 'add') {
                currentItemAllocations[itemIndexPrimary].combination.push(lpdInvolved);
                currentItemAllocations[itemIndexPrimary].combination.sort((a, b) => a - b);
                currentItemAllocations[itemIndexPrimary].sum += lpdInvolved;
                currentItemAllocations[itemIndexPrimary].difference = currentItemAllocations[itemIndexPrimary].sum - itemsToProcess[itemIndexPrimary].amount;
                if (maxSlotsIsFinite) {
                    if (currentRemainingSlots[lpdInvolved] > 0) {
                        currentRemainingSlots[lpdInvolved]--;
                    } else {
                        const addedLpdIndex = currentItemAllocations[itemIndexPrimary].combination.lastIndexOf(lpdInvolved);
                        if (addedLpdIndex > -1) currentItemAllocations[itemIndexPrimary].combination.splice(addedLpdIndex, 1);
                        currentItemAllocations[itemIndexPrimary].sum -= lpdInvolved;
                        currentItemAllocations[itemIndexPrimary].difference = currentItemAllocations[itemIndexPrimary].sum - itemsToProcess[itemIndexPrimary].amount;
                        variationLogHTML += ` <span class="error">(Erro Crítico: Imagem ${lpdInvolved} indisponível no pool para adicionar!)</span>`;
                        madeVariationAdjustment = false;
                    }
                }
            }

            if (madeVariationAdjustment) {
                const itemActuallyAdjusted = itemsToProcess[itemIndexPrimary];
                const allocActuallyAdjusted = currentItemAllocations[itemIndexPrimary];
                const finalPercDiffOfPrimaryItem = itemActuallyAdjusted.amount > 0 ? Math.abs(allocActuallyAdjusted.difference / itemActuallyAdjusted.amount) : (allocActuallyAdjusted.sum === 0 ? 0 : Infinity);
                variationLogHTML += ` -> Nova Dif Espec ${itemActuallyAdjusted.originalIndex + 1}: ${allocActuallyAdjusted.difference.toFixed(0)} (${(finalPercDiffOfPrimaryItem * 100).toFixed(1)}%)`;
                if (finalPercDiffOfPrimaryItem <= VARIATION_LIMIT_PASS_3) variationLogHTML += ` <span class="success">(OK)</span>`; else variationLogHTML += ` <span class="warning">(Ainda Alto)</span>`;
                if (maxSlotsIsFinite && lpdInvolved) {
                    variationLogHTML += `, Imagens Rem ${lpdInvolved}: ${currentRemainingSlots[lpdInvolved] !== undefined ? currentRemainingSlots[lpdInvolved] : 'N/A'}`;
                }
            }
        } else {
            variationLogHTML += ` -> <span class="warning">Nenhuma correção encontrada para este item. Parando Passo 3.</span>`;
            madeVariationAdjustment = false;
        }
        variationLogHTML += `</div>`;
    } // End while madeVariationAdjustment

    if (variationLoopCounter >= maxVariationLoops) {
        variationLogHTML += `\n<span class="error">Parado Passo 3: Limite de loop (${maxVariationLoops}) atingido.</span>`;
    }
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