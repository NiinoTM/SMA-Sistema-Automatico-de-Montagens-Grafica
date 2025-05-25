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