// --- ARMAZENAMENTO GLOBAL ---
let globalStrategyResults = [];
let globalOriginalItems = []; // Especificações Originais
let globalUniqueLpdValues = []; // Valores Únicos de Plano
let globalUserLpdCombinationWithDuplicates = []; // Combinação de Planos do Usuário com Duplicatas
let globalLpdInstanceCounts = {}; // Contagem de Instâncias de Plano
let globalInitialTotalSlotsPerValue = {}; // Total Inicial de Imagens por Valor
let globalMaxSlotsPerInstance = Infinity; // Máximo de Imagens por Instância
let globalMaxSlotsDisplay = "Ilimitado"; // Exibição Máx Imagens
let globalCurrentlyDisplayedStrategyName = null; // Track displayed strategy

// --- REGRAS DE CONFIGURAÇÃO ---
const MIN_LPD_VALUE = 2000; // Valor Mínimo do Plano
const OBLIGATORY_RANGE = 500; // Intervalo Obrigatório
const TARGET_RANGE_BELOW = 500; // Intervalo Alvo Abaixo
const TARGET_RANGE_ABOVE = 1000; // Intervalo Alvo Acima
const TARGET_STEP = 500; // Passo do Alvo
const PROPORTIONAL_ROUNDING_STEP = 50; // Passo de Arredondamento Proporcional
const MIN_LPD_VALUE_ALLOC = 0; // Valor Mínimo do Plano na Alocação
const VARIATION_LIMIT_PASS_3 = 0.25; // Limite de Variação Passo 3
const REPROCESS_VARIATION_LIMIT = 0.30; // Limite de Variação para Reprocessamento

// --- FUNÇÕES AUXILIARES ---
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); if (b === 0) return a; return gcd(b, a % b); } // mdc
function arrayGcd(numbers) { if (!numbers || numbers.length === 0) return 0; if (numbers.length === 1) return Math.abs(numbers[0]); let result = Math.abs(numbers[0]); for (let i = 1; i < numbers.length; i++) { result = gcd(result, numbers[i]); if (result === 1) return 1; } return result; } // mdcArray
function findSumCombinationRecursive(lpdValueObjectsToSearch, target, k, startIndex, currentCombinationValues) {
    if (currentCombinationValues.length === k) {
        const currentSum = currentCombinationValues.reduce((sum, item) => sum + item, 0);
        if (Math.abs(currentSum - target) < 0.01) { return [...currentCombinationValues]; }
        return null;
    }
     if (startIndex >= lpdValueObjectsToSearch.length ||
        currentCombinationValues.length > k ||
        (k > 0 && lpdValueObjectsToSearch.length - startIndex < k - currentCombinationValues.length)) { return null; }
    if (k === 0) return null;
    for (let i = startIndex; i < lpdValueObjectsToSearch.length; i++) {
        const currentLpdValue = lpdValueObjectsToSearch[i].value;
            currentCombinationValues.push(currentLpdValue);
            const result = findSumCombinationRecursive(lpdValueObjectsToSearch, target, k, i + 1, currentCombinationValues);
            if (result) { return result; }
            currentCombinationValues.pop();
    }
    return null;
 }
function getFrequencyScore(combination, lpdFrequencies) { // obterPontuacaoFrequencia
     let score = 0; for (const lpdValue of combination) { score += (lpdFrequencies[lpdValue] || 0); } return score;
}
function roundToNearest(value, multiple) { // arredondarParaMultiploMaisProximo
     if (multiple <= 0) return Math.round(value); return Math.round(value / multiple) * multiple;
}
function findClosestSumWithRepetitionAndSlots(uniqueLpdValuesAvailable, target, remainingSlotsMap) { // encontrarSomaMaisProximaComRepeticaoEImagens
    if (!uniqueLpdValuesAvailable || uniqueLpdValuesAvailable.length === 0) { return { sum: 0, difference: 0 - target, combination: [], error: "Nenhum Plano fornecido para alocação" }; }
    if (target < 0) { return { sum: 0, difference: 0 - target, combination: [], error: "Quantidade alvo não pode ser negativa" }; }
    const validLpdsWithSlots = uniqueLpdValuesAvailable.filter(lpd => lpd > 0 && remainingSlotsMap.hasOwnProperty(lpd) && remainingSlotsMap[lpd] > 0).sort((a, b) => a - b);
    if (validLpdsWithSlots.length === 0) { return { sum: 0, difference: 0 - target, combination: [], error: "Lista de Planos vazia ou nenhum Plano tem imagens restantes" }; }
    const smallestLpd = validLpdsWithSlots[0];
    const maxSum = Math.max(target, 0) + smallestLpd;
    const dp = new Array(maxSum + 1).fill(null);
    dp[0] = { count: 0, usage: {}, lastLpd: null };

    for (let i = 1; i <= maxSum; i++) {
        let bestStateForI = null;
        for (const lpd of validLpdsWithSlots) {
            const prevSum = i - lpd;
            if (prevSum >= 0 && dp[prevSum] !== null) {
                const prevState = dp[prevSum];
                const currentLpdUsageInThisPath = (prevState.usage[lpd] || 0) + 1;
                const slotsAvailable = remainingSlotsMap[lpd];

                 if (slotsAvailable === Infinity || currentLpdUsageInThisPath <= slotsAvailable) {
                    const newTotalCount = prevState.count + 1;
                    if (bestStateForI === null || newTotalCount < bestStateForI.count) {
                        const newUsage = { ...prevState.usage }; newUsage[lpd] = currentLpdUsageInThisPath;
                        bestStateForI = { count: newTotalCount, usage: newUsage, lastLpd: lpd };
                    }
                }
            }
        }
        dp[i] = bestStateForI;
    }

    let minAbsDiff = Infinity; let closestSum = -1; let bestReachableState = null;
    for (let i = target; i >= 0; i--) { if (dp[i] !== null) { const diff = Math.abs(target - i); if (diff < minAbsDiff || (diff === minAbsDiff && dp[i].count < bestReachableState.count)) { minAbsDiff = diff; closestSum = i; bestReachableState = dp[i]; } if (diff > minAbsDiff && closestSum !== -1) break; } }
    for (let i = target + 1; i <= maxSum; i++) { if (dp[i] !== null) { const diff = Math.abs(i - target); if (diff < minAbsDiff || (diff === minAbsDiff && dp[i].count < bestReachableState.count)) { minAbsDiff = diff; closestSum = i; bestReachableState = dp[i]; } if (diff >= minAbsDiff && closestSum !== -1) break; } }

     if (closestSum === -1) {
         if (target === 0 && dp[0] !== null) {
             closestSum = 0; bestReachableState = dp[0];
         } else {
             return { sum: 0, difference: 0 - target, combination: [], error: "Não foi possível alcançar a soma alvo ou valor próximo" };
         }
     }

    const combination = []; let currentSum = closestSum; let currentState = bestReachableState; let safetyCounter = 0; const maxLoops = (currentState?.count || 0) + validLpdsWithSlots.length + 100;
    while (currentSum > 0 && currentState?.lastLpd && safetyCounter < maxLoops) { const usedLpd = currentState.lastLpd; combination.push(usedLpd); const prevSum = currentSum - usedLpd; if (prevSum >= 0 && dp[prevSum] !== null) { currentState = dp[prevSum]; currentSum = prevSum; } else { console.error(`Erro de Backtracking DP: Estado faltando para soma ${prevSum}`); return { sum: closestSum, difference: closestSum - target, combination: combination.sort((a, b) => a - b), error: `Erro de backtracking: Estado faltando para soma ${prevSum}` }; } safetyCounter++; }
     if (safetyCounter >= maxLoops) { console.error("Limite de segurança de backtracking DP atingido."); return { sum: closestSum, difference: closestSum - target, combination: combination.sort((a, b) => a - b), error: "Limite de segurança de backtracking atingido" }; }
     if (currentSum !== 0 && closestSum !== 0) { console.error(`Backtracking DP incompleto (soma final ${currentSum})`); return { sum: closestSum, difference: closestSum - target, combination: combination.sort((a, b) => a - b), error: `Backtracking incompleto (soma final ${currentSum})` }; }
     const reconstructedSum = combination.reduce((a, b) => a + b, 0); if (reconstructedSum !== closestSum) { console.error(`Incompatibilidade na reconstrução DP: ${reconstructedSum} != ${closestSum}`); return { sum: closestSum, difference: closestSum - target, combination: combination.sort((a, b) => a - b), error: `Erro de reconstrução (${reconstructedSum} != ${closestSum})` }; }
     const finalUsageCheck = {}; for(const lpd of combination) { finalUsageCheck[lpd] = (finalUsageCheck[lpd] || 0) + 1; if (remainingSlotsMap[lpd] !== Infinity && finalUsageCheck[lpd] > remainingSlotsMap[lpd]) { console.error(`Limite de imagens violado para Plano ${lpd} na verificação (${finalUsageCheck[lpd]} > ${remainingSlotsMap[lpd]})`); return { sum: closestSum, difference: closestSum - target, combination: combination.sort((a, b) => a - b), error: `Limite de imagens violado para Plano ${lpd} na verificação final` }; } }

     return { sum: closestSum, difference: closestSum - target, combination: combination.sort((a, b) => a - b) };
}
function calculateMaxVariation(items, allocations) { // calcularVariacaoMaxima
    let maxAbsPercentage = 0; if (!items || !allocations || items.length === 0 || items.length !== allocations.length) return Infinity; // Handle empty/mismatch
    for (let i = 0; i < items.length; i++) { const item = items[i]; const alloc = allocations[i]; if (!alloc || alloc.error || alloc.difference === undefined) continue; const targetAmount = item.amount; const difference = alloc.difference; let currentAbsPercentage = 0; if (targetAmount > 0) { currentAbsPercentage = Math.abs(difference / targetAmount); } else if (alloc.sum !== 0) { currentAbsPercentage = Infinity; } if (currentAbsPercentage > maxAbsPercentage) { maxAbsPercentage = currentAbsPercentage; } }
    return maxAbsPercentage;
 }
function calculateAverageVariation(items, allocations) { // calcularVariacaoMedia
    let totalPercentageSum = 0; let validItemCount = 0; if (!items || !allocations || items.length === 0 || items.length !== allocations.length) return 0; // Handle empty/mismatch
    for (let i = 0; i < items.length; i++) { const item = items[i]; const alloc = allocations[i]; if (alloc && !alloc.error && alloc.difference !== undefined && item.amount > 0) { const absPercentage = Math.abs(alloc.difference / item.amount); totalPercentageSum += absPercentage; validItemCount++; } }
    return validItemCount > 0 ? totalPercentageSum / validItemCount : 0;
}
/**
 * Formats a number using the 'pt-BR' locale ('.' for thousands, ',' for decimals).
 * Rounds to the nearest integer for display in tables.
 * Gracefully handles non-numeric inputs.
 * @param {number|string} value The number to format.
 * @returns {string} The formatted number string or the original value if not a valid number.
 */
function formatNumberPtBR(value) {
    if (typeof value !== 'number' || isNaN(value)) {
        // If it's already a string (like 'N/A', 'Erro') or invalid, return it as is
        return String(value);
    }
    // Round to nearest integer and format
    try {
         // Use maximumFractionDigits: 0 to ensure integer output for these tables
         return Math.round(value).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    } catch (e) {
         console.warn("Error formatting number:", value, e);
         return String(Math.round(value)); // Fallback to unformatted rounded number
    }
}