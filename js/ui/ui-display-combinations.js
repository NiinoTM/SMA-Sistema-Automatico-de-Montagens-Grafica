// --- START OF FILE js/ui/ui-display-combinations.js ---
import { getCachedElements } from './ui-elements.js';
// Assuming REPROCESS_VARIATION_LIMIT is globally available from utils.js

export function displayCombinationSummary(combinationPerformance, onCombinationClickCallback) {
    const elements = getCachedElements();
    if (!elements.combinationSummaryTitle || !elements.combinationSummaryTableDiv) {
        console.error("displayCombinationSummary: Critical DOMElements missing.");
        return;
    }

    if (!combinationPerformance || combinationPerformance.length === 0) {
        elements.combinationSummaryTitle.style.display = 'block';
        elements.combinationSummaryTableDiv.innerHTML = "Nenhuma combinação para exibir.";
        return;
    }

    combinationPerformance.sort((a, b) => {
        const resA = a.bestResult; const resB = b.bestResult;
        if (resA.hasAllocationError && !resB.hasAllocationError) return 1;
        if (!resA.hasAllocationError && resB.hasAllocationError) return -1;
        const avgDiff = (resA.avgVariation ?? Infinity) - (resB.avgVariation ?? Infinity);
        if (avgDiff !== 0) return avgDiff;
        const maxDiff = (resA.maxVariation ?? Infinity) - (resB.maxVariation ?? Infinity);
        if (maxDiff !== 0) return maxDiff;
        return 0;
    });

    let html = `<div class="comparison-title">--- Resumo do Desempenho por Combinação ---</div>`;
    html += `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem; margin-bottom: 0.5rem;">Clique em uma combinação para ver a análise detalhada das estratégias.</p>`;
    html += `<table id="combinationSummaryTable"><thead><tr><th>#</th><th>Combinação de Planos</th><th>Melhor Var Máx</th><th>Melhor Var Média</th><th>Melhor Estratégia</th><th>Resultado</th></tr></thead><tbody>`;

    combinationPerformance.forEach((perf, index) => {
        const combo = perf.combination; const res = perf.bestResult;
        const comboStr = JSON.stringify(combo);
        const maxVarStr = res.displayMaxVarStr || (res.hasAllocationError ? '<span class="error">Erro</span>' : (res.maxVariation === Infinity ? '<span class="violation">Infinita</span>' : (res.maxVariation * 100).toFixed(1) + '%'));
        const avgVarStr = res.displayAvgVarStr || (res.hasAllocationError ? '<span class="error">Erro</span>' : (res.avgVariation === Infinity ? '<span class="violation">Infinita</span>' : (res.avgVariation * 100).toFixed(1) + '%'));
        let outcomeStr = res.displayOutcomeStr || '';
        if (!outcomeStr) {
            if (res.hasAllocationError) { outcomeStr = `<span class="error">Erro</span>`; }
            else if (res.meetsLimit) { outcomeStr = `<span class="success">Sucesso</span>`; }
            else { outcomeStr = `<span class="warning">Var Alta</span>`; }
        }
        let maxVarClass = '';
        if (!res.hasAllocationError && !res.displayMaxVarStr?.includes('<span')) {
            if (typeof REPROCESS_VARIATION_LIMIT !== 'undefined' && res.maxVariation > REPROCESS_VARIATION_LIMIT) { // Global
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
    html += `</tbody></table>`;
    elements.combinationSummaryTitle.style.display = 'block';
    elements.combinationSummaryTableDiv.innerHTML = html;

    // Re-fetch table and add event listeners AFTER table is in DOM
    const table = getCachedElements().combinationSummaryTable; // Ensures we get the new table
    if (table) {
        const tBody = table.getElementsByTagName('tbody')[0];
        if (tBody) {
            const rows = tBody.rows;
            for (let row of rows) {
                row.addEventListener('click', function() {
                    onCombinationClickCallback(this.dataset.combo, this);
                });
            }
        }
    } else {
        console.warn("displayCombinationSummary: combinationSummaryTable not found after rendering.");
    }
}
// --- END OF FILE js/ui/ui-display-combinations.js ---