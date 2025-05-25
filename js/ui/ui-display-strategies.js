// --- START OF FILE js/ui/ui-display-strategies.js ---
import { getCachedElements } from './ui-elements.js';
import { findBestResultFromStrategyList, updateComparisonTableHighlight, toggleErrorStrategies, toggleDuplicateStrategies } from './ui-utils.js';

// Assuming formatNumberPtBR, REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 are globally available.
// If they were in a module (e.g., ../utils/utils.js), you would import them:
// import { formatNumberPtBR, REPROCESS_VARIATION_LIMIT, VARIATION_LIMIT_PASS_3 } from '../utils/utils.js';

export function displayStrategyComparisonTable(strategyResults, onStrategyClickCallback) {
    const elements = getCachedElements();
    if (!elements.strategyComparison) {
        console.error("displayStrategyComparisonTable: strategyComparison DOMElements missing.");
        return;
    }

    // Default content in case strategyResults is empty or null
    let comparisonHTML = `<div class="comparison-title">--- Resumo da Comparação de Estratégias (Combinação: [<span id="currentComboDisplayInStratComparison">N/A</span>]) ---</div>`;
    comparisonHTML += `<div id="comparisonTableContainer" class="comparison-table-container hide-errors hide-duplicates">`;
    comparisonHTML += `<table id="comparisonTable"><thead><tr><th>Estratégia</th><th>Var Máx (%)</th><th>Var Média (%)</th><th>Resultado</th></tr></thead><tbody>`;

    let errorCount = 0;
    let finalDuplicateCount = 0;

    if (strategyResults && strategyResults.length > 0) {
        const defaultStrategyToShow = findBestResultFromStrategyList(strategyResults); // Now correctly imported

        strategyResults.forEach((res) => {
            const maxVarStr = res.displayMaxVarStr || '?';
            const avgVarStr = res.displayAvgVarStr || '?';
            let outcomeStr = res.displayOutcomeStr || '';
            if (!outcomeStr) { // Recalculate if needed (should be pre-calculated though)
                if (res.hasAllocationError) { outcomeStr = `<span class="error">Erro</span>`; }
                else if (res.meetsLimit) { outcomeStr = `<span class="success">Sucesso</span>`; }
                else { outcomeStr = `<span class="warning">Var Alta</span>`; }
            }

            let rowClass = '';
            if (res.hasAllocationError) { rowClass = 'strategy-error-row'; errorCount++; }
            if (res.isDuplicateResult) { rowClass += ' strategy-duplicate-row'; finalDuplicateCount++; }

            const isSelectedStrategy = defaultStrategyToShow && res.strategyName === defaultStrategyToShow.strategyName;
            if (isSelectedStrategy) rowClass += ' best-effort';

            comparisonHTML += `<tr class="${rowClass.trim()}"><td class="strategy-name" data-strategy-name='${encodeURIComponent(res.strategyName)}'>${res.strategyName} ${isSelectedStrategy ? '(Padrão)' : ''}</td><td>${maxVarStr}</td><td>${avgVarStr}</td><td>${outcomeStr}</td></tr>`;
        });
    } else {
        comparisonHTML += '<tr><td colspan="4">Nenhum resultado de estratégia para exibir para esta combinação.</td></tr>';
    }
    comparisonHTML += `</tbody></table></div>`; // Close table and container

    comparisonHTML += `<div class="toggle-buttons-container" style="margin-top: 0.5rem;">`;
    if (errorCount > 0) { comparisonHTML += `<button id="toggleErrorsBtn">Mostrar ${errorCount} Estrat. c/ Erro...</button>`; }
    if (finalDuplicateCount > 0) { comparisonHTML += `<button id="toggleDuplicatesBtn" class="secondary">Mostrar ${finalDuplicateCount} Estrat. c/ Resultados Idênticos...</button>`; }
    comparisonHTML += `</div>`;

    elements.strategyComparison.innerHTML = comparisonHTML;

    // Add event listeners AFTER the table is in the DOM
    const table = getCachedElements().comparisonTable; // Re-fetch table reference
    if (table) {
        const nameCells = table.querySelectorAll('td.strategy-name');
        nameCells.forEach(cell => {
            cell.addEventListener('click', function() {
                onStrategyClickCallback(this.dataset.strategyName);
            });
        });
    } else {
        console.warn("displayStrategyComparisonTable: comparisonTable not found after rendering for event listeners.");
    }

    const toggleErrorsBtnElement = document.getElementById('toggleErrorsBtn');
    if (toggleErrorsBtnElement) {
        toggleErrorsBtnElement.addEventListener('click', () => toggleErrorStrategies()); // toggleErrorStrategies is imported from ui-utils
    }

    const toggleDuplicatesBtnElement = document.getElementById('toggleDuplicatesBtn');
    if (toggleDuplicatesBtnElement) {
        toggleDuplicatesBtnElement.addEventListener('click', () => toggleDuplicateStrategies()); // toggleDuplicateStrategies is imported from ui-utils
    }
}

export function displayStrategyDetails(selectedResultData, appState) {
    const elements = getCachedElements();
    const {
        originalItems, userLpdCombinationWithDuplicates, uniqueLpdValues,
        lpdInstanceCounts, initialTotalSlotsPerValue, maxSlotsDisplay, maxSlotsPerInstance
    } = appState;

    const strategyName = selectedResultData.strategyName;

    // Clear previous details for relevant sections
    const detailDivsToClear = [
        elements.allocationResults, elements.adjustmentLog, elements.variationLog,
        elements.cumulativeUsage, elements.refinementLog, elements.lpdBreakdown, elements.finalSummaryTableDiv
    ];
    detailDivsToClear.forEach(div => { if (div) div.innerHTML = 'Carregando detalhes...'; });


    if (!selectedResultData) {
        if(elements.statusArea) elements.statusArea.innerHTML = `<span class="error">Erro: Dados não encontrados para a estratégia "${strategyName}".</span>`;
        if(elements.detailsTitle) elements.detailsTitle.innerHTML = 'Resultados Detalhados';
        if(elements.allocationResults) elements.allocationResults.innerHTML = '<span class="error">Resultado da estratégia não encontrado.</span>';
        return;
    }

    if (!selectedResultData.resultData || !selectedResultData.resultData.itemAllocations) {
        if(elements.statusArea) elements.statusArea.innerHTML = `<span class="error">Erro: Dados de alocação incompletos ou ausentes para "${strategyName}".</span>`;
        if(elements.detailsTitle) elements.detailsTitle.innerHTML = `Resultados Detalhados (Erro de Dados - ${strategyName})`;
        if(elements.allocationResults) elements.allocationResults.innerHTML = `<span class="error">Dados de alocação principal ausentes. A estratégia pode ter falhado. ${selectedResultData.resultData?.error || ''}</span>`;
        // Try to display logs even if main data is missing
        if(elements.adjustmentLog) elements.adjustmentLog.innerHTML = (selectedResultData.resultData?.logs?.adjustment) || "Nenhum registro de ajuste.";
        if(elements.variationLog) elements.variationLog.innerHTML = (selectedResultData.resultData?.logs?.variation) || "Nenhum registro de variação.";
        if(elements.refinementLog) elements.refinementLog.innerHTML = selectedResultData.refinementLog || "Nenhum registro de refinamento disponível.";
        updateComparisonTableHighlight(strategyName); // Still try to highlight
        return;
    }

    console.log(`[displayStrategyDetails] Displaying details for ${strategyName}.`);
    if(elements.detailsTitle) elements.detailsTitle.innerHTML = `Resultados Detalhados da Alocação (Estratégia: ${strategyName})`;

    const finalItems = selectedResultData.itemsUsed;
    const finalAllocations = selectedResultData.resultData.itemAllocations;
    const finalLogs = selectedResultData.resultData.logs || { adjustment: '', variation: ''};

    if(elements.adjustmentLog) elements.adjustmentLog.innerHTML = finalLogs.adjustment || "Nenhum registro de ajuste.";
    if(elements.variationLog) elements.variationLog.innerHTML = finalLogs.variation || "Nenhum registro de variação.";
    if(elements.refinementLog) elements.refinementLog.innerHTML = selectedResultData.refinementLog || "Nenhum registro de refinamento aplicado ou disponível.";

    // --- 1. Generate HTML for Final Item Allocations ---
    let finalAllocationHTML = `--- Alocações Finais por Especificação (Estratégia: ${selectedResultData.strategyName}) ---`;
    if (finalItems && finalAllocations && finalItems.length === finalAllocations.length) {
        finalItems.forEach((item, i) => {
            finalAllocationHTML += `<div class="item-allocation">`;
            finalAllocationHTML += `<b>${i + 1}. ${item?.details || 'Item Inválido'}</b> (Linha Orig: ${item?.originalIndex + 1 || 'N/A'}, Alvo: ${formatNumberPtBR(item?.amount || 0)})\n`;
            const finalAlloc = finalAllocations[i];
            if (!finalAlloc) { finalAllocationHTML += `<span class="error">Dados de aloc. ausentes para este item.</span>\n`; }
            else if (finalAlloc.error) { finalAllocationHTML += `<span class="error">Erro Aloc: ${finalAlloc.error}</span>\n`; }
            else if (finalAlloc.sum !== undefined) {
                const itemAmount = item?.amount || 0;
                const finalPercDiff = itemAmount > 0 ? (finalAlloc.difference / itemAmount) : (finalAlloc.sum === 0 ? 0 : Infinity);
                let diffClass = finalAlloc.difference === 0 ? 'zero-diff' : (finalAlloc.difference > 0 ? 'positive-diff' : 'negative-diff');
                let diffSign = finalAlloc.difference > 0 ? '+' : (finalAlloc.difference < 0 ? '' : '');
                finalAllocationHTML += `<span class="highlight">Soma: ${formatNumberPtBR(finalAlloc.sum)}</span> (Dif: <span class="${diffClass}">${diffSign}${formatNumberPtBR(finalAlloc.difference)}</span>`;
                if (itemAmount > 0 && isFinite(finalPercDiff)) {
                    let percStr = (finalPercDiff * 100).toFixed(1) + '%';
                    let percClass = '';
                     // Ensure global constants are accessible
                    if (typeof REPROCESS_VARIATION_LIMIT !== 'undefined' && Math.abs(finalPercDiff) > REPROCESS_VARIATION_LIMIT) { percClass = 'violation'; }
                    else if (typeof VARIATION_LIMIT_PASS_3 !== 'undefined' && Math.abs(finalPercDiff) > VARIATION_LIMIT_PASS_3) { percClass = 'warning'; }
                    finalAllocationHTML += ` / <span class="${percClass}">${percStr}</span>`;
                } else if (itemAmount <= 0 && finalAlloc.sum !== 0) { finalAllocationHTML += ` / <span class="violation">N/A (Alvo 0)</span>`; }
                else if (itemAmount > 0 && !isFinite(finalPercDiff)) { finalAllocationHTML += ` / <span class="violation">Inf%</span>`; }
                finalAllocationHTML += `)\n`;
                if (finalAlloc.combination && finalAlloc.combination.length > 0) {
                    finalAllocationHTML += `   Combo (${finalAlloc.combination.length}): [${finalAlloc.combination.map(formatNumberPtBR).join(', ')}]`;
                    if (finalAlloc.finalUsageCounts && Object.keys(finalAlloc.finalUsageCounts).length > 0) {
                         finalAllocationHTML += `\n   Uso Específico: { ${Object.entries(finalAlloc.finalUsageCounts).map(([lpd, count]) => `"${formatNumberPtBR(lpd)}": ${formatNumberPtBR(count)}`).join(', ')} }`;
                    } else { finalAllocationHTML += `\n   Uso Específico: {}`; }
                } else { finalAllocationHTML += `   (Nenhum Plano alocado)`; }
            } else { finalAllocationHTML += "<span class='error'>Estrutura Aloc Inválida</span>"; }
            finalAllocationHTML += `</div>`;
        });
    } else { finalAllocationHTML += '<span class="error">Incompatibilidade Especificação/Aloc. ou dados ausentes.</span>'; }
    if(elements.allocationResults) elements.allocationResults.innerHTML = finalAllocationHTML;

    // --- 2. Generate HTML for Cumulative Usage ---
    const finalCumulativeUsage = selectedResultData.resultData.cumulativeUsage || {};
    const finalRemainingSlots = selectedResultData.resultData.remainingSlots || {};
    let usageSummaryHTML = `<div class="usage-summary">--- Uso Acumulado de Planos (Estrat: ${selectedResultData.strategyName}, Imagens Máx/Inst: ${maxSlotsDisplay}) ---<ul>`;
    if (uniqueLpdValues && uniqueLpdValues.length > 0) {
         uniqueLpdValues.forEach(lpd => {
             const initialTotalForLpd = initialTotalSlotsPerValue[lpd] ?? 0; // From appState
             const usedTotalForLpd = finalCumulativeUsage[lpd] || 0;
             let remainingTotalForLpd = Infinity;
             if(maxSlotsPerInstance !== Infinity) { // From appState
                 remainingTotalForLpd = finalRemainingSlots.hasOwnProperty(lpd)
                                       ? finalRemainingSlots[lpd]
                                       : (initialTotalForLpd - usedTotalForLpd);
             }
             const numInstancesForLpd = lpdInstanceCounts[lpd] || 0; // From appState
             usageSummaryHTML += `<li>Plano <b>${formatNumberPtBR(lpd)}</b> (${formatNumberPtBR(numInstancesForLpd)} inst): Usado <b>${formatNumberPtBR(usedTotalForLpd)}</b>`;
             if (maxSlotsPerInstance !== Infinity) {
                 usageSummaryHTML += ` (Inicial: ${formatNumberPtBR(initialTotalForLpd)}, Rem: ${formatNumberPtBR(remainingTotalForLpd)})`;
                 if (remainingTotalForLpd < 0) { usageSummaryHTML += ` <span class="error">(Erro de Imagem!)</span>`; }
             }
             usageSummaryHTML += `</li>`;
         });
    } else { usageSummaryHTML += "<li>Nenhum Plano para rastrear (Combinação vazia?).</li>"; }
    usageSummaryHTML += "</ul></div>";
    if(elements.cumulativeUsage) elements.cumulativeUsage.innerHTML = usageSummaryHTML;

    // --- 3. Generate HTML for Plan Assembly (Montagem dos Planos) ---
    const planAssemblyDataForExport = selectedResultData.planAssemblyDataForExport;
    let lpdBreakdownHTML = `<div class="lpd-section-title" style="text-align: center; font-size: 1.1em; margin-bottom: 1rem;">--- Montagem dos Planos (Estratégia: ${selectedResultData.strategyName}) ---</div>`;
    let totalGlobalSheets = 0;
    if (planAssemblyDataForExport && planAssemblyDataForExport.length > 0) {
        let overallPlanIndex = 0;
        planAssemblyDataForExport.forEach(instance => {
            if (instance.items && instance.items.length > 0 || instance.totalUsed > 0) {
                overallPlanIndex++;
                lpdBreakdownHTML += `<div class="plan-container">`;
                lpdBreakdownHTML += `<h1>Plano ${overallPlanIndex} - ${formatNumberPtBR(instance.planValue)} Folhas (#${instance.instanceNum})</h1>`;
                lpdBreakdownHTML += `<table><thead><tr><th>Item</th><th>Img</th><th>Qtd</th></tr></thead><tbody>`;
                let totalInstanceQtd = 0;
                if (instance.items && instance.items.length > 0) {
                    instance.items.forEach(item => {
                        const itemQtd = (item.count || 0) * (instance.planValue || 0);
                        totalInstanceQtd += itemQtd;
                        lpdBreakdownHTML += `<tr><td>${item.details || 'N/A'}</td><td>${formatNumberPtBR(item.count || 0)}</td><td>${formatNumberPtBR(itemQtd)}</td></tr>`;
                    });
                } else { lpdBreakdownHTML += `<tr><td colspan="3">(Nenhum item para este plano)</td></tr>`; }
                lpdBreakdownHTML += `<tr class="total-row"><td><strong>TOTAL</strong></td><td><strong>${formatNumberPtBR(instance.totalUsed || 0)}</strong></td><td><strong>${formatNumberPtBR(totalInstanceQtd)}</strong></td></tr>`;
                lpdBreakdownHTML += `</tbody></table></div>`;
                if (typeof instance.planValue === 'number' && instance.planValue > 0) {
                    totalGlobalSheets += instance.planValue;
                }
            }
        });
        if (overallPlanIndex === 0) {
            lpdBreakdownHTML += "<p style='text-align: center; color: var(--text-muted);'>Nenhuma instância de plano com itens alocados para exibir.</p>";
        }
        lpdBreakdownHTML += `<div class="total-sheets-summary">Total Geral (Todas os Planos Exibidos): ${formatNumberPtBR(totalGlobalSheets)} Folhas</div>`;
    } else {
         lpdBreakdownHTML += "<p style='text-align: center; color: var(--text-muted);'>Dados da montagem dos planos não disponíveis ou vazios.</p>";
         if(selectedResultData.hasAllocationError) {
             lpdBreakdownHTML += `<p style='text-align: center; color: var(--warning);'>(Nota: A alocação para esta estratégia encontrou erros.)</p>`;
         }
    }
    if(elements.lpdBreakdown) elements.lpdBreakdown.innerHTML = lpdBreakdownHTML;

    // --- 4. Generate HTML for Final Summary Table ---
    let summaryTableHTML = `<div class="lpd-section-title">--- Tabela Comparativa (Estrat: ${selectedResultData.strategyName}) ---</div><table id="finalSummaryTable"><thead><tr><th>Especificação</th><th>Quantidade</th><th>Empenho</th><th>Dif</th><th>Var (%)</th></tr></thead><tbody>`;
    const allocationMap = new Map();
    finalItems.forEach((item, i) => {
         if(item && typeof item.originalIndex !== 'undefined') {
            allocationMap.set(item.originalIndex, { itemData: item, allocationData: finalAllocations[i] });
         }
    });

    let totalOriginal = 0; let totalEmpenhado = 0;
    if (originalItems && originalItems.length > 0) { // originalItems from appState
        originalItems.forEach(originalItem => {
            if (!originalItem || typeof originalItem.originalIndex === 'undefined') return;
            totalOriginal += originalItem.amount;
            const resultEntry = allocationMap.get(originalItem.originalIndex);
            let Especificacao = originalItem.details || 'N/A';
            let quantidadeNum = originalItem.amount;
            let quantidadeFmt = formatNumberPtBR(quantidadeNum);
            let empenhoHtml = '<span class="warning">N/A</span>';
            let difHtml = '<span class="warning">N/A</span>';
            let varHtml = '<span class="warning">N/A</span>';

            if (resultEntry && resultEntry.allocationData) {
                const currentFinalAlloc = resultEntry.allocationData; // Renamed to avoid conflict
                if (!currentFinalAlloc.error && currentFinalAlloc.sum !== undefined) {
                    const empenhoNum = currentFinalAlloc.sum;
                    empenhoHtml = formatNumberPtBR(empenhoNum);
                    totalEmpenhado += empenhoNum;
                    const difNum = currentFinalAlloc.difference;
                    let difClass = difNum === 0 ? 'zero-diff' : (difNum > 0 ? 'positive-diff' : 'negative-diff');
                    let difSign = difNum > 0 ? '+' : (difNum < 0 ? '' : '');
                    difHtml = `<span class="${difClass}">${difSign}${formatNumberPtBR(difNum)}</span>`;
                    if (quantidadeNum > 0) {
                        const percentage = (difNum / quantidadeNum);
                        if (isFinite(percentage)){
                            const percentageFmt = (percentage * 100).toFixed(1) + '%';
                            let varClassInner = difClass;
                            // Ensure global constants are accessible
                            if (typeof REPROCESS_VARIATION_LIMIT !== 'undefined' && Math.abs(percentage) > REPROCESS_VARIATION_LIMIT) { varClassInner = 'violation'; }
                            else if (typeof VARIATION_LIMIT_PASS_3 !== 'undefined' && Math.abs(percentage) > VARIATION_LIMIT_PASS_3) { varClassInner = 'warning'; }
                            varHtml = `<span class="${varClassInner}">${percentageFmt}</span>`;
                        } else { varHtml = `<span class="violation">Inf%</span>`; }
                    } else if (empenhoNum !== 0) { varHtml = `<span class="violation">N/A</span>`; }
                    else { varHtml = '<span class="zero-diff">0.0%</span>'; }
                } else if (currentFinalAlloc.error) {
                    empenhoHtml = `<span class="error">Erro</span>`;
                    let shortError = currentFinalAlloc.error.length > 50 ? currentFinalAlloc.error.substring(0, 47) + '...' : currentFinalAlloc.error;
                    difHtml = `<span class="error" title="${currentFinalAlloc.error}">${shortError}</span>`;
                    varHtml = `<span class="error">Erro</span>`;
                }
            } else {
                empenhoHtml = '<span class="error">Faltando</span>'; difHtml = '<span class="error">Faltando</span>'; varHtml = '<span class="error">Faltando</span>';
            }
            summaryTableHTML += `<tr><td>${Especificacao}</td><td>${quantidadeFmt}</td><td>${empenhoHtml}</td><td>${difHtml}</td><td>${varHtml}</td></tr>`;
        });
    } else { summaryTableHTML += '<tr><td colspan="5">Nenhum item original encontrado para exibir.</td></tr>'; }
    summaryTableHTML += `</tbody>`;
    const totalDiferenca = totalEmpenhado - totalOriginal;
    let totalDifClass = totalDiferenca === 0 ? 'zero-diff' : (totalDiferenca > 0 ? 'positive-diff' : 'negative-diff');
    let totalDifSign = totalDiferenca > 0 ? '+' : (totalDiferenca < 0 ? '' : '');
    let totalVarHtml = '';
    if (totalOriginal > 0) {
        const totalPercentage = (totalDiferenca / totalOriginal) * 100;
        totalVarHtml = isFinite(totalPercentage) ? `<span class="${totalDifClass}">${totalPercentage.toFixed(1)}%</span>` : `<span class="violation">Inf%</span>`;
    } else { totalVarHtml = totalEmpenhado === 0 ? `<span class="zero-diff">0.0%</span>` : `<span class="positive-diff">N/A</span>`; }
    summaryTableHTML += `<tfoot><tr><th>TOTAL</th><td>${formatNumberPtBR(totalOriginal)}</td><td>${formatNumberPtBR(totalEmpenhado)}</td><td><span class="${totalDifClass}">${totalDifSign}${formatNumberPtBR(totalDiferenca)}</span></td><td>${totalVarHtml}</td></tr></tfoot></table>`;
    if(elements.finalSummaryTableDiv) elements.finalSummaryTableDiv.innerHTML = summaryTableHTML;

    // --- 5. Update Strategy Comparison Highlight ---
    updateComparisonTableHighlight(strategyName); // from ui-utils.js
}
// --- END OF FILE js/ui/ui-display-strategies.js ---