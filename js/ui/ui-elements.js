// --- START OF FILE js/ui/ui-elements.js ---
function getElements() {
    return {
        // Inputs
        tableData: document.getElementById('tableData'),
        maxSlots: document.getElementById('maxSlots'),
        combinationSize: document.getElementById('combinationSize'),
        combinationSizeContainer: document.getElementById('combinationSizeContainer'),
        itemCountDisplay: document.getElementById('itemCountDisplay'),

        // Buttons
        toggleLogBtn: document.getElementById('toggleLogBtn'),

        // Output Sections - Titles
        finderTitle: document.getElementById('finderTitle'),
        combinationSummaryTitle: document.getElementById('combinationSummaryTitle'),
        allocatorTitle: document.getElementById('allocatorTitle'),
        detailsTitle: document.getElementById('detailsTitle'),
        detailsSeparator: document.getElementById('detailsSeparator'),

        // Output Sections - Content Divs
        finderStatusDisplay: document.getElementById('finderStatusDisplay'),
        finderResultsLog: document.getElementById('finderResultsLog'),
        combinationSummaryTableDiv: document.getElementById('combinationSummaryTableDiv'),
        statusArea: document.getElementById('statusArea'),
        strategyComparison: document.getElementById('strategyComparison'),
        allocationResults: document.getElementById('allocationResults'),
        adjustmentLog: document.getElementById('adjustmentLog'),
        variationLog: document.getElementById('variationLog'),
        cumulativeUsage: document.getElementById('cumulativeUsage'),
        refinementLog: document.getElementById('refinementLog'),
        lpdBreakdown: document.getElementById('lpdBreakdown'),
        finalSummaryTableDiv: document.getElementById('finalSummaryTableDiv'),

        // Dynamically updated table references
        combinationSummaryTable: null,
        comparisonTable: null,
        comparisonTableContainer: null,

        // Calculator Dialog Elements
        openCalculatorDialogBtn: document.getElementById('openCalculatorDialogBtn'),
        calculatorDialog: document.getElementById('calculatorDialog'),
        closeCalculatorDialogBtn: document.getElementById('closeCalculatorDialogBtn'),
        materialWidthInput: document.getElementById('materialWidth'), // Likely unused by packer component
        materialHeightInput: document.getElementById('materialHeight'), // Likely unused
        itemWidthInput: document.getElementById('itemWidth'), // Likely unused
        itemHeightInput: document.getElementById('itemHeight'), // Likely unused
        calculateImagesBtn: document.getElementById('calculateImagesBtn'), // Likely unused
        calculatorResultDiv: document.getElementById('calculatorResult'), // Likely unused
        applyCalculatorResultBtn: document.getElementById('applyPackerResultBtn'),
        packerHostContainer: document.getElementById('packerHostContainer'), // Added this line
    };
}

// Cache elements on load
const DOMElements = getElements();

export function getCachedElements() {
    // Re-fetch table elements if they might have been re-rendered
    if (!DOMElements.combinationSummaryTable || !DOMElements.combinationSummaryTable.isConnected) {
        DOMElements.combinationSummaryTable = document.getElementById('combinationSummaryTable');
    }
    if (!DOMElements.comparisonTable || !DOMElements.comparisonTable.isConnected) {
        DOMElements.comparisonTable = document.getElementById('comparisonTable');
    }
    if (!DOMElements.comparisonTableContainer || !DOMElements.comparisonTableContainer.isConnected) {
        DOMElements.comparisonTableContainer = document.getElementById('comparisonTableContainer');
    }
    return DOMElements;
}

export function clearUIOutputs() {
    const elements = getCachedElements(); // Use getCachedElements to ensure fresh refs if needed
    if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `Processando Entradas...`;
    if (elements.finderResultsLog) {
        elements.finderResultsLog.innerHTML = '';
        elements.finderResultsLog.classList.add('log-hidden');
    }
    if (elements.toggleLogBtn) {
        elements.toggleLogBtn.textContent = 'Mostrar Log Detalhado';
        elements.toggleLogBtn.style.display = 'none';
    }

    const outputDivs = [
        elements.combinationSummaryTableDiv, elements.statusArea, elements.strategyComparison,
        elements.allocationResults, elements.adjustmentLog, elements.variationLog,
        elements.cumulativeUsage, elements.refinementLog, elements.lpdBreakdown, elements.finalSummaryTableDiv
    ];
    outputDivs.forEach(div => { if (div) div.innerHTML = ''; });

    const titlesAndSeparators = [
        elements.combinationSummaryTitle, elements.allocatorTitle, elements.detailsTitle, elements.detailsSeparator,
        elements.statusArea, elements.strategyComparison, elements.allocationResults, elements.adjustmentLog,
        elements.variationLog, elements.cumulativeUsage, elements.refinementLog, elements.lpdBreakdown,
        elements.finalSummaryTableDiv
    ];
    titlesAndSeparators.forEach(el => { if (el) el.style.display = 'none'; });

    if (elements.detailsTitle) elements.detailsTitle.innerHTML = 'Resultados Detalhados da Alocação';
}
// --- END OF FILE js/ui/ui-elements.js ---