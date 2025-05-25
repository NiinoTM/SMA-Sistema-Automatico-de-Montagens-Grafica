// --- START OF FILE ui-state.js ---

// --- START OF FILE js/ui/ui-state.js ---

const initialState = {
    // From original utils.js globals that are stateful
    strategyResults: [], // Will hold results for the currently selected COMBINATION
    originalItems: [],
    uniqueLpdValues: [],
    userLpdCombinationWithDuplicates: [], // The specific LPD combination being processed/displayed
    lpdInstanceCounts: {},
    initialTotalSlotsPerValue: {},
    maxSlotsPerInstance: Infinity,
    maxSlotsDisplay: "Ilimitado",
    currentlyDisplayedStrategyName: null,

    // New state for combination summary display
    fullCombinationPerformanceData: [], // Holds all processed combination results
    displayedCombinationCount: 7,       // Initial number of combinations to display

    // Other state if needed
    // e.g., isLoading: false,
};

let appState = { ...initialState };
let combinationStrategyResultsCache = {}; // Key: JSON string of combo, Value: full sorted strategy results array

export function getAppState() {
    return { ...appState }; // Return a copy to prevent direct mutation
}

export function updateAppState(partialState) {
    appState = { ...appState, ...partialState };
}

export function resetAppState() {
    appState = { ...initialState };
    // Ensure new state properties are also reset
    appState.fullCombinationPerformanceData = [];
    appState.displayedCombinationCount = 7;
    combinationStrategyResultsCache = {};
    console.log("App state reset.");
}

export function getCachedStrategyResultsForCombination(comboString) {
    return combinationStrategyResultsCache[comboString];
}

export function cacheStrategyResultsForCombination(comboString, results) {
    combinationStrategyResultsCache[comboString] = results;
}

export function clearCombinationStrategyCache() {
    combinationStrategyResultsCache = {};
}
// --- END OF FILE js/ui/ui-state.js ---