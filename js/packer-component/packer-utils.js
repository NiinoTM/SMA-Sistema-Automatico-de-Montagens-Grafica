// --- START OF FILE js/packer-component/packer-utils.js ---
import { DOMElements } from './packer-config.js'; // Uses the local DOMElements
import { EPSILON } from './packer-config.js';    // Uses the local EPSILON

// Parses float from an input element specific to this component instance
export function parseFloatFromPackerInput(inputElement, defaultVal = 0.0) {
    if (!inputElement) {
        console.warn(`Packer Component: Input element is null in parseFloatFromPackerInput.`);
        return defaultVal;
    }
    const text = inputElement.value.trim();
    inputElement.classList.remove('error'); // Assuming 'error' class is defined in packer-styles.css
    if (!text) {
        return defaultVal;
    }
    let processedText = text.replace(',', '.');
    const val = parseFloat(processedText);
    if (isNaN(val)) {
        inputElement.classList.add('error');
        throw new Error(`Packer Component: Could not parse '${text}' from ${inputElement.id} as float.`);
    }
    return val;
}

// Handles container dimension changes to suggest margin orientation, specific to packer inputs
export function onPackerContainerDimensionChanged() {
    if (!DOMElements.containerWidthInput || !DOMElements.containerHeightInput || !DOMElements.marginOrientationCombo) {
        // This can happen if component is not fully mounted yet
        // console.warn("Packer Component: Required DOMElements for onPackerContainerDimensionChanged not ready.");
        return;
    }
    try {
        const width = parseFloatFromPackerInput(DOMElements.containerWidthInput, 0.0);
        const height = parseFloatFromPackerInput(DOMElements.containerHeightInput, 0.0);

        if (width < EPSILON && height < EPSILON) { /* No change */ }
        else if (height > width + EPSILON) { DOMElements.marginOrientationCombo.value = "2"; }
        else { DOMElements.marginOrientationCombo.value = "1"; }
    } catch (e) {
        // Error class is added by parseFloatFromPackerInput.
    }
}
// --- END OF FILE js/packer-component/packer-utils.js ---