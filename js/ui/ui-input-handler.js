// --- START OF FILE js/ui/ui-input-handler.js ---
import { getCachedElements } from './ui-elements.js';
// Assuming parseTableData is globally available from input-parser.js
// In a full ES module system, you'd import it:
// import { parseTableData } from '../core/input-parser.js';

export function getRawInputs() {
    const elements = getCachedElements();
    return {
        tableDataInput: elements.tableData?.value.trim() || '',
        maxSlotsInput: elements.maxSlots?.value.trim() || '',
        combinationSizeInput: elements.combinationSize?.value.trim() || ''
    };
}

export function validateAndParseCoreInputs(rawInputs) {
    const elements = getCachedElements(); // For displaying errors

    if (!rawInputs.tableDataInput) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = '<span class="error">Erro: Dados da tabela vazios.</span>';
        return null;
    }
    if (!rawInputs.maxSlotsInput) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = '<span class="error">Erro: "Imagens no Plano" é obrigatório.</span>';
        return null;
    }
    if (!rawInputs.combinationSizeInput) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = '<span class="error">Erro: "Quantidade de Planos" é obrigatório.</span>';
        return null;
    }

    let maxSlotsPerInstance, combinationSizeNum;
    try {
        maxSlotsPerInstance = parseInt(rawInputs.maxSlotsInput);
        if (isNaN(maxSlotsPerInstance) || maxSlotsPerInstance < 1) throw new Error('"Imagens no Plano" deve ser >= 1.');
    } catch (e) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<span class="error">Erro de Entrada: ${e.message}</span>`;
        return null;
    }
    try {
        combinationSizeNum = parseInt(rawInputs.combinationSizeInput);
        if (isNaN(combinationSizeNum) || combinationSizeNum < 1) throw new Error('"Quantidade de Planos" deve ser >= 1.');
    } catch (e) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<span class="error">Erro de Entrada: ${e.message}</span>`;
        return null;
    }

    // Assuming parseTableData is global
    const parseResult = parseTableData(rawInputs.tableDataInput);
    if (parseResult.errors.length > 0) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<span class="error">Erros ao Processar Entradas. Verifique o Log Detalhado.</span>`;
        if (elements.finderResultsLog) {
            elements.finderResultsLog.innerHTML = `<span class="error">Erros ao Processar Entradas:</span>\n${parseResult.errors.join('\n')}`;
            elements.finderResultsLog.classList.remove('log-hidden');
        }
        if (elements.toggleLogBtn) elements.toggleLogBtn.style.display = 'inline-flex';
        return null;
    }
    if (parseResult.count === 0) {
        if (elements.finderStatusDisplay) elements.finderStatusDisplay.innerHTML = `<span class="error">Erro: Nenhuma Especificação válida processada.</span>`;
        return null;
    }

    return {
        parsedItems: parseResult.items,
        itemCount: parseResult.count,
        maxSlotsPerInstance,
        combinationSize: combinationSizeNum // Renamed for clarity
    };
}

export function updateItemCountDisplay() {
    const elements = getCachedElements();
    if (!elements.tableData || !elements.itemCountDisplay) return 0;

    const parseResult = parseTableData(elements.tableData.value); // Assuming global
    elements.itemCountDisplay.textContent = `Total de Imagens: ${parseResult.count}`;
    return parseResult.count;
}

export function checkCombinationSizeWarning() {
    const elements = getCachedElements();
    if (!elements.maxSlots || !elements.combinationSize || !elements.combinationSizeContainer || !elements.tableData) return;

    const icon = elements.combinationSizeContainer.querySelector('.warning-icon');
    if (!icon) return;

    const maxSlotsValue = parseInt(elements.maxSlots.value, 10);
    const combinationSizeValue = parseInt(elements.combinationSize.value, 10);
    const parseResult = parseTableData(elements.tableData.value); // Assuming global
    const itemCount = parseResult.count;
    let showWarning = false;

    if (!isNaN(maxSlotsValue) && maxSlotsValue >= 1 &&
        !isNaN(combinationSizeValue) && combinationSizeValue >= 1 &&
        itemCount > 0) {
        if ((maxSlotsValue * combinationSizeValue) < itemCount) {
            showWarning = true;
        }
    }
    elements.combinationSizeContainer.classList.toggle('input-warning', showWarning);
}

export function setupInputEventListeners() {
    const elements = getCachedElements();
    if (elements.tableData) {
        elements.tableData.addEventListener('input', () => {
            updateItemCountDisplay();
            checkCombinationSizeWarning();
        });
    }
    if (elements.maxSlots) {
        elements.maxSlots.addEventListener('input', checkCombinationSizeWarning);
    }
    if (elements.combinationSize) {
        elements.combinationSize.addEventListener('input', checkCombinationSizeWarning);
    }
    // Initial calls
    updateItemCountDisplay();
    checkCombinationSizeWarning();
}
// --- END OF FILE js/ui/ui-input-handler.js ---