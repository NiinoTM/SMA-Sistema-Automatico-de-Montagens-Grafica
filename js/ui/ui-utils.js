// --- START OF FILE js/ui/ui-utils.js ---
import { getCachedElements } from './ui-elements.js';
import { getAppState } from './ui-state.js';
// Assuming REPROCESS_VARIATION_LIMIT is globally available from utils.js
// import { REPROCESS_VARIATION_LIMIT } from '../utils/utils.js';

export function toggleFinderLog() {
    const elements = getCachedElements();
    if (elements.finderResultsLog && elements.toggleLogBtn && elements.toggleLogBtn.style.display !== 'none') {
        const isHidden = elements.finderResultsLog.classList.toggle('log-hidden');
        elements.toggleLogBtn.textContent = isHidden ? 'Mostrar Log Detalhado' : 'Ocultar Log Detalhado';
    } else {
        console.warn("Cannot toggle finder log: elements not found or process not run yet.");
    }
}

export function findBestResultFromStrategyList(strategyResults) {
    if (!strategyResults || strategyResults.length === 0) {
        return { strategyName: "Nenhum Resultado", maxVariation: Infinity, avgVariation: Infinity, meetsLimit: false, hasAllocationError: true, displayMaxVarStr: 'N/A', displayAvgVarStr: 'N/A', displayOutcomeStr: '<span class="error">Erro</span>', isDuplicateResult: false };
    }
    let candidates = strategyResults.filter(r => !r.hasAllocationError && r.meetsLimit && !r.isDuplicateResult);
    if (candidates.length > 0) return candidates[0];
    candidates = strategyResults.filter(r => !r.hasAllocationError && !r.isDuplicateResult);
    if (candidates.length > 0) return candidates[0];
    candidates = strategyResults.filter(r => !r.hasAllocationError);
    if (candidates.length > 0) return candidates[0];
    candidates = strategyResults.filter(r => !r.isDuplicateResult);
    if (candidates.length > 0) return candidates[0];
    return strategyResults[0];
}

export function updateComparisonTableHighlight(selectedStrategyName) {
    const elements = getCachedElements();
    if (!elements.comparisonTable) {
        console.warn("updateComparisonTableHighlight: comparisonTable not found or not yet rendered.");
        return;
    }
    const tbody = elements.comparisonTable.getElementsByTagName('tbody')[0];
    if (!tbody) { console.warn("updateComparisonTableHighlight: tbody not found in comparisonTable."); return; }
    const rows = tbody.getElementsByTagName('tr');

    for (let row of rows) {
        row.classList.remove('best-effort');
        const firstCell = row.cells[0];
        if (firstCell && firstCell.classList.contains('strategy-name')) {
            let currentStrategyNameInCell = firstCell.textContent.replace(/\s*\((Padrão|Selecionado)\)$/, '').trim();
            if (currentStrategyNameInCell === selectedStrategyName) {
                row.classList.add('best-effort');
                // Ensure the "(Padrão)" marker is only added, not duplicated
                if (!firstCell.textContent.includes('(Padrão)')) {
                    firstCell.textContent = `${currentStrategyNameInCell} (Padrão)`;
                }
            } else {
                // Remove "(Padrão)" if it's there and this is not the selected strategy
                firstCell.textContent = currentStrategyNameInCell;
            }
        }
    }
}

export function toggleErrorStrategies() {
    const elements = getCachedElements();
    const appState = getAppState(); // Get current strategy results from state
    if (elements.comparisonTableContainer && document.getElementById('toggleErrorsBtn') && appState.strategyResults) {
        const errorRowCount = appState.strategyResults.filter(r => r.hasAllocationError).length;
        if (errorRowCount === 0 && !elements.comparisonTableContainer.classList.contains('hide-errors')) return; // No errors, ensure not trying to unhide
        const hiding = elements.comparisonTableContainer.classList.toggle('hide-errors');
        document.getElementById('toggleErrorsBtn').textContent = hiding ? `Mostrar ${errorRowCount} Estrat. c/ Erro...` : `Ocultar ${errorRowCount} Estrat. c/ Erro...`;
    }
}

export function toggleDuplicateStrategies() {
    const elements = getCachedElements();
    const appState = getAppState(); // Get current strategy results from state
    if (elements.comparisonTableContainer && document.getElementById('toggleDuplicatesBtn') && appState.strategyResults) {
        const duplicateRowCount = appState.strategyResults.filter(r => r.isDuplicateResult).length;
        if (duplicateRowCount === 0 && !elements.comparisonTableContainer.classList.contains('hide-duplicates')) return;
        const hiding = elements.comparisonTableContainer.classList.toggle('hide-duplicates');
        document.getElementById('toggleDuplicatesBtn').textContent = hiding ? `Mostrar ${duplicateRowCount} Estrat. c/ Resultados Idênticos...` : `Ocultar ${duplicateRowCount} Estrat. c/ Resultados Idênticos...`;
    }
}
// --- END OF FILE js/ui/ui-utils.js ---