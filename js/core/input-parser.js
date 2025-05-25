/**
 * Parses the raw text data from the textarea.
 * @param {string} textData - The raw string input from the textarea.
 * @returns {{items: Array, count: number, errors: Array, minAmount: number|Infinity, maxAmount: number|Infinity, sumAmount: number}}
 */
function parseTableData(textData) {
    let parsedItems = [];
    let parseErrors = [];
    let validItemCount = 0;
    let minRawAmount = Infinity;
    let maxRawAmount = -Infinity;
    let sumRawAmount = 0;

    if (!textData) {
        return { items: [], count: 0, errors: [], minAmount: Infinity, maxAmount: -Infinity, sumAmount: 0 };
    }

    const lines = textData.split('\n');

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return; // Skip empty lines

        let details = '';
        let amountStrRaw = '';
        let parts = line.split('\t'); // Try tab separation first

        if (parts.length >= 2) {
            amountStrRaw = parts[parts.length - 1];
            details = parts.slice(0, -1).join('\t');
        } else {
            // Fallback to space separation if tab fails
            const lastSpaceIndex = line.lastIndexOf(' ');
            if (lastSpaceIndex === -1 || lastSpaceIndex === 0) {
                // Handle cases with only one "word" or leading space incorrectly
                parts = line.split(/\s+/); // Split by any whitespace
                 if (parts.length >= 2) {
                    amountStrRaw = parts[parts.length - 1];
                    details = parts.slice(0, -1).join(' ');
                 } else {
                    parseErrors.push(`L${index + 1}: Formato inválido (separador?): "${line}"`);
                    return; // Skip this line
                 }
            } else {
                amountStrRaw = line.substring(lastSpaceIndex + 1);
                details = line.substring(0, lastSpaceIndex);
            }
        }

        // Clean and parse the amount
        let amountStrClean = amountStrRaw.replace(/[R$€]/g, '').trim(); // Remove currency symbols
        let amountStrParsed = amountStrClean.replace(/\./g, '').replace(/,/g, '.'); // Normalize decimal separator
        const amount = parseFloat(amountStrParsed);

        if (isNaN(amount)) {
            parseErrors.push(`L${index + 1}: Quantidade inválida ('${amountStrRaw}') para "${details}"`);
            return; // Skip this line
        }
        if (amount < 0) {
            parseErrors.push(`L${index + 1}: Quantidade negativa (${amount}) para "${details}"`);
            return; // Skip this line
        }

        const roundedAmount = Math.round(amount);
        parsedItems.push({ details: details, amount: roundedAmount, originalIndex: index });

        // Update counts and stats only for valid items
        validItemCount++;
        sumRawAmount += roundedAmount;
        if (roundedAmount < minRawAmount) minRawAmount = roundedAmount;
        if (roundedAmount > maxRawAmount) maxRawAmount = roundedAmount;
    });

    return {
        items: parsedItems,
        count: validItemCount,
        errors: parseErrors,
        minAmount: minRawAmount,
        maxAmount: maxRawAmount,
        sumAmount: sumRawAmount
    };
}