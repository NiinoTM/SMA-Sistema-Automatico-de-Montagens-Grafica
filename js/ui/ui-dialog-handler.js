// --- START OF FILE js/ui/ui-dialog-handler.js ---
import { getCachedElements } from './ui-elements.js';
// Import the main initializer for the packer component
import { initializePackerComponent, destroyPackerComponent } from '../packer-component/packer-main.js';

let lastPackerDialogResult = 0;

function openCalculatorDialog() {
    const elements = getCachedElements();
    if (elements.calculatorDialog && elements.packerHostContainer) {
        elements.calculatorDialog.style.display = 'flex';
        elements.packerHostContainer.innerHTML = ''; // Clear previous packer instance

        // Initialize the packer component inside the host container
        initializePackerComponent(elements.packerHostContainer, (packerResult) => {
            console.log("Packer Component calculated result:", packerResult);
            lastPackerDialogResult = packerResult;
            const applyBtn = document.getElementById('applyPackerResultBtn'); // Get fresh ref
            if (applyBtn) {
                applyBtn.disabled = (packerResult <= 0);
            }
        });

        const applyBtn = document.getElementById('applyPackerResultBtn');
        if (applyBtn) applyBtn.disabled = true; // Disable apply on open
    } else {
        console.error("Calculator dialog or packer host container not found.");
    }
}

function closeCalculatorDialog() {
    const elements = getCachedElements();
    if (elements.calculatorDialog && elements.packerHostContainer) {
        elements.calculatorDialog.style.display = 'none';
        destroyPackerComponent(elements.packerHostContainer); // Call cleanup for the packer component
        elements.packerHostContainer.innerHTML = ''; // Also clear HTML as a fallback
    }
}

function applyPackerResultToMainField() {
    const elements = getCachedElements(); // Main app's elements
    if (lastPackerDialogResult > 0 && elements.maxSlots) {
        elements.maxSlots.value = lastPackerDialogResult;
        elements.maxSlots.dispatchEvent(new Event('input', { bubbles: true }));
        closeCalculatorDialog();
    }
}

export function setupDialogEventListeners() {
    const elements = getCachedElements();

    if (elements.openCalculatorDialogBtn) {
        elements.openCalculatorDialogBtn.addEventListener('click', openCalculatorDialog);
    }
    if (elements.closeCalculatorDialogBtn) {
        elements.closeCalculatorDialogBtn.addEventListener('click', closeCalculatorDialog);
    }

    // The apply button is part of the dialog, ensure its listener is set up correctly
    // This might need to be set when the dialog is created if the button is dynamic
    // For now, assuming it's always in the dialog HTML from the start.
    const applyBtn = document.getElementById('applyPackerResultBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyPackerResultToMainField);
    } else {
        // If the button is part of dynamic HTML, this listener needs to be added
        // after the dialog content is rendered.
        console.warn("ApplyPackerResultBtn not found during initial setupDialogEventListeners.");
    }


    if (elements.calculatorDialog) {
        elements.calculatorDialog.addEventListener('click', (event) => {
            // Close if clicking on the overlay itself, not its content
            if (event.target === elements.calculatorDialog) {
                closeCalculatorDialog();
            }
        });
    }
}
// --- END OF FILE js/ui/ui-dialog-handler.js ---