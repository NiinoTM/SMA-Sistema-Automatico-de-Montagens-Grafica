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