// --- START OF FILE js/ui/ui-display-combinations.js ---
import { getCachedElements } from './ui-elements.js';
import { getAppState, updateAppState } from './ui-state.js';
// Assuming REPROCESS_VARIATION_LIMIT is globally available from utils.js

export function displayCombinationSummary(onCombinationClickCallback) {
    const elements = getCachedElements();
    const appState = getAppState();
    const fullCombinationPerformance = appState.fullCombinationPerformanceData || []; // This is now pre-filtered and sorted

    if (!elements.combinationSummaryTitle || !elements.combinationSummaryTableDiv) {
        console.error("displayCombinationSummary: Critical DOMElements missing.");
        return;
    }

    if (!fullCombinationPerformance || fullCombinationPerformance.length === 0) {
        elements.combinationSummaryTitle.style.display = 'block';
        // Check if original generation might have found combinations, but all had errors and were filtered out
        // A bit indirect, but if originalItems & a userLpdCombination was set, a process was attempted.
        const initialProcessAttempted = appState.originalItems && appState.originalItems.length > 0 && appState.userLpdCombinationWithDuplicates && appState.userLpdCombinationWithDuplicates.length > 0;

        if (initialProcessAttempted) {
             elements.combinationSummaryTableDiv.innerHTML = "Nenhuma combinação válida (sem erros de alocação) para exibir. Todas as combinações testadas resultaram em erro ou foram filtradas.";
        } else {
             elements.combinationSummaryTableDiv.innerHTML = "Nenhuma combinação para exibir (processo não encontrou combinações iniciais ou não foi executado).";
        }

        // Hide other dependent sections if no combinations are shown
        const sectionsToHide = [
            elements.allocatorTitle, elements.statusArea, elements.strategyComparison,
            elements.detailsSeparator, elements.detailsTitle, elements.allocationResults,
            elements.adjustmentLog, elements.variationLog, elements.cumulativeUsage,
            elements.refinementLog, elements.lpdBreakdown, elements.finalSummaryTableDiv
        ];
        sectionsToHide.forEach(el => { if (el) el.style.display = 'none'; });
        return;
    }
    
    const itemsToShowCount = appState.displayedCombinationCount || 7;
    
    let displayData = fullCombinationPerformance;
    let moreAvailable = false;
    let remainingCount = 0;
    const totalAvailable = fullCombinationPerformance.length; // Total *valid* combinations

    if (totalAvailable > itemsToShowCount) {
        displayData = fullCombinationPerformance.slice(0, itemsToShowCount);
        moreAvailable = true;
        remainingCount = totalAvailable - itemsToShowCount;
    }

    let html = `<div class="comparison-title">--- Resumo do Desempenho por Combinação (${displayData.length} de ${totalAvailable} válidas exibidas) ---</div>`;
    html += `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; margin-bottom: 0.5rem;">Clique em uma combinação para ver a análise detalhada das estratégias. Ordenado pela Melhor Variação Média (menor primeiro).</p>`;
    html += `<table id="combinationSummaryTable"><thead><tr><th>#</th><th>Combinação de Planos</th><th>Melhor Var Máx</th><th>Melhor Var Média</th><th>Melhor Estratégia</th><th>Resultado</th></tr></thead><tbody>`;

    displayData.forEach((perf, index) => {
        const combo = perf.combination; const res = perf.bestResult;
        // Since `hasAllocationError` rows are filtered out, `res` here will always be non-error.
        const comboStr = JSON.stringify(combo);
        
        const maxVarStr = res.displayMaxVarStr || ((res.maxVariation === Infinity ? '<span class="violation">Infinita</span>' : (res.maxVariation * 100).toFixed(1) + '%'));
        const avgVarStr = res.displayAvgVarStr || ((res.avgVariation === Infinity ? '<span class="violation">Infinita</span>' : (res.avgVariation * 100).toFixed(1) + '%'));
        
        let outcomeStr = res.displayOutcomeStr || '';
        if (!outcomeStr) { // Should be pre-calculated
            if (res.meetsLimit) { outcomeStr = `<span class="success">Sucesso</span>`; }
            else { outcomeStr = `<span class="warning">Var Alta</span>`; }
        }

        let maxVarClass = '';
        if (!res.displayMaxVarStr?.includes('<span')) { // If not already styled by controller
            if (typeof REPROCESS_VARIATION_LIMIT !== 'undefined' && res.maxVariation > REPROCESS_VARIATION_LIMIT) {
                maxVarClass = res.maxVariation === Infinity ? 'violation' : 'warning';
            }
        }

        html += `<tr data-combo='${encodeURIComponent(comboStr)}'>
                    <td>${index + 1}</td>
                    <td class="combo-cell">[${combo.join(', ')}]</td>
                    <td class="${maxVarClass}">${maxVarStr}</td>
                    <td>${avgVarStr}</td>
                    <td>${res.strategyName || 'N/A'}</td>
                    <td>${outcomeStr}</td>
                 </tr>`;
    });
    html += `</tbody>`;

    if (moreAvailable) {
        html += `<tfoot><tr><td colspan="6" style="text-align:center;"><button id="showMoreCombinationsBtn" class="secondary">Mostrar Mais (${remainingCount} restantes)</button></td></tr></tfoot>`;
    }
    html += `</table>`;
    
    elements.combinationSummaryTitle.style.display = 'block';
    elements.combinationSummaryTableDiv.innerHTML = html;

    const table = getCachedElements().combinationSummaryTable;
    if (table) {
        const tBody = table.getElementsByTagName('tbody')[0];
        if (tBody) {
            Array.from(tBody.rows).forEach(row => {
                row.addEventListener('click', function() {
                    onCombinationClickCallback(this.dataset.combo, this);
                });
            });
        }
        const showMoreBtn = document.getElementById('showMoreCombinationsBtn');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', () => {
                const currentDisplayed = appState.displayedCombinationCount || 7;
                let newCount = Math.min(currentDisplayed + 10, totalAvailable);
                
                if (newCount < totalAvailable && (totalAvailable - newCount) < 10 && (totalAvailable - newCount) > 0) {
                    newCount = totalAvailable;
                }

                updateAppState({ displayedCombinationCount: newCount });
                displayCombinationSummary(onCombinationClickCallback);
            });
        }
    } else {
        console.warn("displayCombinationSummary: combinationSummaryTable not found after rendering.");
    }
}
// --- END OF FILE js/ui/ui-display-combinations.js ---