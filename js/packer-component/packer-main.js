// --- START OF FILE js/packer-component/packer-main.js ---
import { DOMElements as PackerDOMElements, initPackerDOMElements, EPSILON } from './packer-config.js';
import { createPackerState } from './packer-state.js';
import { parseFloatFromPackerInput, onPackerContainerDimensionChanged } from './packer-utils.js';
import { calculatePackingForComponent, getEffectiveMargins as getPackerEffectiveMargins } from './packer-algorithm.js';
import { resizeAndDrawPackerCanvas } from './packer-canvas-manager.js';

let currentInstancePackingState = null;
let onResultCallbackGlobal = null;
let resizeObserver = null; // To handle resize of the dialog/host element

function calculateAndDisplayForComponent() {
    if (!PackerDOMElements.calculateButton || !PackerDOMElements.resultsLabel || !currentInstancePackingState) {
        console.error("Packer Component: Core UI elements or state not ready for calculation.");
        return;
    }
    PackerDOMElements.calculateButton.classList.add('loading'); // Assumes 'loading' class is in packer-styles.css

    // Delay slightly to allow UI to update with loading spinner
    setTimeout(() => {
        try {
            // Clear previous errors on all packer inputs
            const packerInputs = [
                PackerDOMElements.containerWidthInput, PackerDOMElements.containerHeightInput,
                PackerDOMElements.marginLeftInput, PackerDOMElements.marginRightInput,
                PackerDOMElements.marginTopInput, PackerDOMElements.marginBottomInput,
                PackerDOMElements.itemWidthInput, PackerDOMElements.itemHeightInput,
                PackerDOMElements.itemGutterHInput, PackerDOMElements.itemGutterVInput
            ];
            packerInputs.forEach(el => el && el.classList.remove('error')); // Assumes 'error' class

            // --- Read Packer Inputs and Update currentInstancePackingState ---
            currentInstancePackingState.containerWidth = parseFloatFromPackerInput(PackerDOMElements.containerWidthInput);
            currentInstancePackingState.containerHeight = parseFloatFromPackerInput(PackerDOMElements.containerHeightInput);
            currentInstancePackingState.itemWidthRaw = parseFloatFromPackerInput(PackerDOMElements.itemWidthInput);
            currentInstancePackingState.itemHeightRaw = parseFloatFromPackerInput(PackerDOMElements.itemHeightInput);
            currentInstancePackingState.marginLeftRaw = parseFloatFromPackerInput(PackerDOMElements.marginLeftInput);
            currentInstancePackingState.marginRightRaw = parseFloatFromPackerInput(PackerDOMElements.marginRightInput);
            currentInstancePackingState.marginTopRaw = parseFloatFromPackerInput(PackerDOMElements.marginTopInput);
            currentInstancePackingState.marginBottomRaw = parseFloatFromPackerInput(PackerDOMElements.marginBottomInput);
            currentInstancePackingState.interItemHMarginRaw = parseFloatFromPackerInput(PackerDOMElements.itemGutterHInput);
            currentInstancePackingState.interItemVMarginRaw = parseFloatFromPackerInput(PackerDOMElements.itemGutterVInput);

            const container_fiber_val = parseInt(PackerDOMElements.containerFiberCombo.value);
            const item_fiber_val = parseInt(PackerDOMElements.itemFiberCombo.value);
            currentInstancePackingState.marginOrientation = parseInt(PackerDOMElements.marginOrientationCombo.value);
            currentInstancePackingState.containerFiber = container_fiber_val; // Store in state
            currentInstancePackingState.itemFiber = item_fiber_val;       // Store in state


            // --- Packer's Input Validations ---
            if (currentInstancePackingState.containerWidth < EPSILON || currentInstancePackingState.containerHeight < EPSILON) {
                PackerDOMElements.resultsLabel.textContent = "Packer: Container dimensions must be positive.";
                if (currentInstancePackingState.containerWidth < EPSILON) PackerDOMElements.containerWidthInput.classList.add('error');
                if (currentInstancePackingState.containerHeight < EPSILON) PackerDOMElements.containerHeightInput.classList.add('error');
                handlePackerCalculationErrorWidgetUpdate(currentInstancePackingState.containerWidth, currentInstancePackingState.containerHeight);
                if (onResultCallbackGlobal) onResultCallbackGlobal(0); // Report 0 items
                return;
            }

            const [eff_ml_disp, eff_mt_disp, eff_mr_disp, eff_mb_disp] = getPackerEffectiveMargins(currentInstancePackingState);
            const effective_container_w_disp = Math.max(0.0, currentInstancePackingState.containerWidth - eff_ml_disp - eff_mr_disp);
            const effective_container_h_disp = Math.max(0.0, currentInstancePackingState.containerHeight - eff_mt_disp - eff_mb_disp);

            if (currentInstancePackingState.itemWidthRaw < EPSILON || currentInstancePackingState.itemHeightRaw < EPSILON) {
                 PackerDOMElements.resultsLabel.textContent = "Packer: Item dimensions must be positive.";
                 if (currentInstancePackingState.itemWidthRaw < EPSILON) PackerDOMElements.itemWidthInput.classList.add('error');
                 if (currentInstancePackingState.itemHeightRaw < EPSILON) PackerDOMElements.itemHeightInput.classList.add('error');
                 calculatePackingForComponent(currentInstancePackingState, container_fiber_val, item_fiber_val); // Run with 0 items
                 resizeAndDrawPackerCanvas(currentInstancePackingState, PackerDOMElements);
                 PackerDOMElements.calculateButton.classList.remove('loading');
                 if (onResultCallbackGlobal) onResultCallbackGlobal(0); // Report 0 items
                 return;
            }

            let item_can_fit_at_all = false;
            let item_w_chk = currentInstancePackingState.itemWidthRaw, item_h_chk = currentInstancePackingState.itemHeightRaw;
            if (effective_container_w_disp >= item_w_chk - EPSILON && effective_container_h_disp >= item_h_chk - EPSILON) item_can_fit_at_all = true;

            const can_rotate_freely_check = (container_fiber_val === 0 || item_fiber_val === 0);
            if (!item_can_fit_at_all && can_rotate_freely_check) {
                 item_w_chk = currentInstancePackingState.itemHeightRaw; item_h_chk = currentInstancePackingState.itemWidthRaw;
                 if (effective_container_w_disp >= item_w_chk - EPSILON && effective_container_h_disp >= item_h_chk - EPSILON) item_can_fit_at_all = true;
            }
            if (!item_can_fit_at_all && !can_rotate_freely_check) {
                item_w_chk = currentInstancePackingState.itemWidthRaw; item_h_chk = currentInstancePackingState.itemHeightRaw;
                if ((container_fiber_val === 1 && item_fiber_val === 2) || (container_fiber_val === 2 && item_fiber_val === 1)) {
                    item_w_chk = currentInstancePackingState.itemHeightRaw; item_h_chk = currentInstancePackingState.itemWidthRaw;
                }
                if (effective_container_w_disp >= item_w_chk - EPSILON && effective_container_h_disp >= item_h_chk - EPSILON) item_can_fit_at_all = true;
            }

            if (!item_can_fit_at_all) {
                 let msg = `Packer: Item (${currentInstancePackingState.itemWidthRaw.toFixed(1)}x${currentInstancePackingState.itemHeightRaw.toFixed(1)}) too large for Eff. Area (${effective_container_w_disp.toFixed(1)}×${effective_container_h_disp.toFixed(1)})`;
                 if (effective_container_w_disp < EPSILON || effective_container_h_disp < EPSILON) msg = `Packer: No space. Eff. Area (${effective_container_w_disp.toFixed(1)}×${effective_container_h_disp.toFixed(1)})`;
                 PackerDOMElements.resultsLabel.textContent = msg;
                 calculatePackingForComponent(currentInstancePackingState, container_fiber_val, item_fiber_val);
                 resizeAndDrawPackerCanvas(currentInstancePackingState, PackerDOMElements);
                 PackerDOMElements.calculateButton.classList.remove('loading');
                 if (onResultCallbackGlobal) onResultCallbackGlobal(0);
                 return;
            }

            // --- Perform Packer's Packing ---
            calculatePackingForComponent(currentInstancePackingState, container_fiber_val, item_fiber_val);
            resizeAndDrawPackerCanvas(currentInstancePackingState, PackerDOMElements);

            // --- Display Packer's Results & Callback ---
            const max_items = currentInstancePackingState.itemsPositions.length;
            let orientation_desc = "N/A", layout_info = "Layout: N/A", used_block_w = 0.0, used_block_h = 0.0;

            if (max_items > 0) {
                const min_x = Math.min(...currentInstancePackingState.itemsPositions.map(it => it[0]));
                const max_x_w = Math.max(...currentInstancePackingState.itemsPositions.map(it => it[0] + it[2]));
                const min_y = Math.min(...currentInstancePackingState.itemsPositions.map(it => it[1]));
                const max_y_h = Math.max(...currentInstancePackingState.itemsPositions.map(it => it[1] + it[3]));
                used_block_w = max_x_w - min_x; used_block_h = max_y_h - min_y;
            }

            if (can_rotate_freely_check) {
                orientation_desc = "Mixed/Optimal";
                layout_info = `Bound: ${used_block_w.toFixed(1)}×${used_block_h.toFixed(1)}`;
            } else {
                let item_w_disp = currentInstancePackingState.itemWidthRaw, item_h_disp = currentInstancePackingState.itemHeightRaw;
                if (container_fiber_val === 1 && item_fiber_val === 1) orientation_desc = "Align xx→xx";
                else if (container_fiber_val === 2 && item_fiber_val === 2) orientation_desc = "Align yy→yy";
                else if (container_fiber_val === 2 && item_fiber_val === 1) { item_w_disp=currentInstancePackingState.itemHeightRaw; item_h_disp=currentInstancePackingState.itemWidthRaw; orientation_desc = "Align yy→xx (R)";}
                else if (container_fiber_val === 1 && item_fiber_val === 2) { item_w_disp=currentInstancePackingState.itemHeightRaw; item_h_disp=currentInstancePackingState.itemWidthRaw; orientation_desc = "Align xx→yy (R)";}

                if (max_items > 0) {
                     let est_cols_disp = (item_w_disp > EPSILON) ? Math.round(used_block_w / item_w_disp) : 0;
                     let est_rows_disp = (item_h_disp > EPSILON) ? Math.round(used_block_h / item_h_disp) : 0;
                     if(est_cols_disp < 1 && used_block_w > EPSILON) est_cols_disp=1;
                     if(est_rows_disp < 1 && used_block_h > EPSILON) est_rows_disp=1;
                     if (est_cols_disp > 0 && est_rows_disp > 0 && Math.abs(est_cols_disp * est_rows_disp - max_items) <=1) {
                        layout_info = `Layout: ${est_cols_disp}×${est_rows_disp}`;
                     } else {
                        layout_info = `Bound: ${used_block_w.toFixed(1)}×${used_block_h.toFixed(1)}`;
                     }
                } else layout_info = "Layout: 0 items";
            }
            const efficiency = (currentInstancePackingState.containerWidth * currentInstancePackingState.containerHeight > EPSILON && max_items > 0) ?
                               (max_items * currentInstancePackingState.itemWidthRaw * currentInstancePackingState.itemHeightRaw) / (currentInstancePackingState.containerWidth * currentInstancePackingState.containerHeight) * 100 : 0;

            PackerDOMElements.resultsLabel.innerHTML =
                `<span class="packer-result-highlight">Max Items: ${max_items}</span> (${orientation_desc}) | ` +
                `<span class="packer-result-highlight">Sheet Eff: ${efficiency.toFixed(1)}%</span>`;
            
            if (onResultCallbackGlobal) {
                onResultCallbackGlobal(max_items);
            }

        } catch (e) {
            console.error("Packer Component Calculation Error:", e);
            PackerDOMElements.resultsLabel.textContent = `Packer Error: ${e.message.substring(0,100)}`;
            handlePackerCalculationErrorWidgetUpdate();
            if (onResultCallbackGlobal) onResultCallbackGlobal(0); // Report 0 on error
        } finally {
            PackerDOMElements.calculateButton.classList.remove('loading');
        }
    }, 10); // End setTimeout
}


function handlePackerCalculationErrorWidgetUpdate(c_w_err = 0.0, c_h_err = 0.0) {
    if (!currentInstancePackingState || !PackerDOMElements.canvas) return;
    try {
        currentInstancePackingState.containerWidth = parseFloatFromPackerInput(PackerDOMElements.containerWidthInput, c_w_err);
        currentInstancePackingState.containerHeight = parseFloatFromPackerInput(PackerDOMElements.containerHeightInput, c_h_err);
        // Set other state for drawing error view if necessary
        currentInstancePackingState.itemsPositions = []; // No items on error
    } catch (parseError) {
        currentInstancePackingState.containerWidth = 0; currentInstancePackingState.containerHeight = 0;
        currentInstancePackingState.itemsPositions = [];
    } finally {
         resizeAndDrawPackerCanvas(currentInstancePackingState, PackerDOMElements);
         if (PackerDOMElements.calculateButton) PackerDOMElements.calculateButton.classList.remove('loading');
    }
}


function setupPackerComponentEventListeners() {
    if (PackerDOMElements.calculateButton) {
        PackerDOMElements.calculateButton.addEventListener('click', calculateAndDisplayForComponent);
    }
    if (PackerDOMElements.containerWidthInput) {
        PackerDOMElements.containerWidthInput.addEventListener('input', onPackerContainerDimensionChanged);
    }
    if (PackerDOMElements.containerHeightInput) {
        PackerDOMElements.containerHeightInput.addEventListener('input', onPackerContainerDimensionChanged);
    }

    if (PackerDOMElements.toggleMarginsBtn && PackerDOMElements.marginSettingsDiv) {
        PackerDOMElements.toggleMarginsBtn.addEventListener('click', function() {
            const isHidden = PackerDOMElements.marginSettingsDiv.style.display === 'none';
            PackerDOMElements.marginSettingsDiv.style.display = isHidden ? 'block' : 'none';
            // PackerDOMElements.marginSettingsDiv.classList.toggle('show', isHidden); // If using animation from packer-styles.css
            this.textContent = isHidden ? 'Hide Advanced Margins' : 'Show Advanced Margins';
            this.classList.toggle('active', isHidden); // Assumes 'active' class is in packer-styles.css
        });
    }

    if (PackerDOMElements.toggleGuttersBtn && PackerDOMElements.gutterSettingsDiv) {
        PackerDOMElements.toggleGuttersBtn.addEventListener('click', function() {
            const isHidden = PackerDOMElements.gutterSettingsDiv.style.display === 'none';
            PackerDOMElements.gutterSettingsDiv.style.display = isHidden ? 'block' : 'none';
            this.textContent = isHidden ? 'Hide Gutter Settings' : 'Show Gutter Settings';
            this.classList.toggle('active', isHidden);
        });
    }

    // Resize listener for the component's canvas
    // We need to observe the host element or visualization area for size changes
    if (PackerDOMElements.visualizationArea) {
        resizeObserver = new ResizeObserver(entries => {
            // We only have one element observed with this observer
            if (entries && entries.length > 0) {
                // Potentially debounce this if it fires too rapidly
                resizeAndDrawPackerCanvas(currentInstancePackingState, PackerDOMElements);
            }
        });
        resizeObserver.observe(PackerDOMElements.visualizationArea);
    }
}

// Main initialization function for the Packer Component
export function initializePackerComponent(hostElement, onResult) {
    onResultCallbackGlobal = onResult;
    currentInstancePackingState = createPackerState(); // Create a fresh state instance

    // Inject Packer's HTML structure (You'd get this from a template string or file)
    // This HTML should use the prefixed IDs like 'packerContainerWidth'
    hostElement.innerHTML = `
        <div class="packer-instance"> <!-- Main wrapper for scoped styles -->
            <!-- ... (The FULL HTML structure from your original packer's index.html,
                        but with all IDs prefixed with 'packer' and classes with 'packer-') ... -->
            <!-- For example: -->
            <div class="packer-content">
                <div class="packer-controls">
                    <div class="packer-section">
                        <div class="packer-section-title">Container Settings</div>
                        <div class="packer-field-group">
                            <div class="packer-field"><label for="packerContainerWidth">Width (xx)</label><input type="text" id="packerContainerWidth" value="660.0"></div>
                            <div class="packer-field"><label for="packerContainerHeight">Height (yy)</label><input type="text" id="packerContainerHeight" value="960.0"></div>
                            <div class="packer-field"><label for="packerContainerFiber">Fiber</label><select id="packerContainerFiber"><option value="0">0</option><option value="1">1</option><option value="2" selected>2</option></select></div>
                        </div>
                        <button id="packerToggleMargins" class="packer-toggle-btn">Show Advanced Margins</button>
                        <div id="packerMarginSettings" class="packer-advanced-settings" style="display: none;">
                            <div class="packer-field-group">
                                <div class="packer-field"><label for="packerMarginLeft">Left</label><input type="text" id="packerMarginLeft" value="5.0"></div>
                                <div class="packer-field"><label for="packerMarginRight">Right</label><input type="text" id="packerMarginRight" value="5.0"></div>
                                <div class="packer-field"><label for="packerMarginTop">Strip</label><input type="text" id="packerMarginTop" value="10.0"></div>
                                <div class="packer-field"><label for="packerMarginBottom">Gripper</label><input type="text" id="packerMarginBottom" value="13.0"></div>
                            </div>
                             <div class="packer-field-group"><div class="packer-field"><label for="packerMarginOrientation">Margin Orient.</label><select id="packerMarginOrientation"><option value="1">1</option><option value="2" selected>2</option></select></div></div>
                        </div>
                    </div>
                    <div class="packer-section">
                        <div class="packer-section-title">Item Settings</div>
                        <div class="packer-field-group">
                            <div class="packer-field"><label for="packerItemWidth">Width</label><input type="text" id="packerItemWidth" value="100.0"></div>
                            <div class="packer-field"><label for="packerItemHeight">Height</label><input type="text" id="packerItemHeight" value="50.0"></div>
                            <div class="packer-field"><label for="packerItemFiber">Fiber</label><select id="packerItemFiber"><option value="0" selected>0</option><option value="1">1</option><option value="2">2</option></select></div>
                        </div>
                        <button id="packerToggleGutters" class="packer-toggle-btn">Show Gutter Settings</button>
                        <div id="packerGutterSettings" class="packer-advanced-settings" style="display: none;">
                             <div class="packer-field-group">
                                <div class="packer-field"><label for="packerItemGutterH">H-Gutter</label><input type="text" id="packerItemGutterH" value="2.5"></div>
                                <div class="packer-field"><label for="packerItemGutterV">V-Gutter</label><input type="text" id="packerItemGutterV" value="2.5"></div>
                            </div>
                        </div>
                    </div>
                    <button id="packerCalculateButton" class="packer-calculate-btn">Calculate Optimal Packing</button>
                    <div id="packerResultsLabel" class="packer-results">Enter dimensions and click Calculate</div>
                </div>
                <div class="packer-visualization">
                    <div class="packer-canvas-container"><canvas id="packerPackingCanvas"></canvas></div>
                </div>
            </div>
        </div>
    `; // This HTML needs to be complete and match your original packer's structure with prefixed IDs.

    initPackerDOMElements(hostElement); // Initialize PackerDOMElements relative to the host

    // Set default values from the new state (or could be hardcoded here too)
    PackerDOMElements.containerWidthInput.value = currentInstancePackingState.containerWidth;
    PackerDOMElements.containerHeightInput.value = currentInstancePackingState.containerHeight;
    PackerDOMElements.containerFiberCombo.value = currentInstancePackingState.containerFiber;
    PackerDOMElements.marginLeftInput.value = currentInstancePackingState.marginLeftRaw;
    PackerDOMElements.marginRightInput.value = currentInstancePackingState.marginRightRaw;
    PackerDOMElements.marginTopInput.value = currentInstancePackingState.marginTopRaw;
    PackerDOMElements.marginBottomInput.value = currentInstancePackingState.marginBottomRaw;
    PackerDOMElements.marginOrientationCombo.value = currentInstancePackingState.marginOrientation;
    PackerDOMElements.itemWidthInput.value = currentInstancePackingState.itemWidthRaw;
    PackerDOMElements.itemHeightInput.value = currentInstancePackingState.itemHeightRaw;
    PackerDOMElements.itemFiberCombo.value = currentInstancePackingState.itemFiber;
    PackerDOMElements.itemGutterHInput.value = currentInstancePackingState.interItemHMarginRaw;
    PackerDOMElements.itemGutterVInput.value = currentInstancePackingState.interItemVMarginRaw;

    setupPackerComponentEventListeners();
    onPackerContainerDimensionChanged(); // Set initial margin orientation
    calculateAndDisplayForComponent();   // Perform initial calculation and drawing

    // Initial draw after a slight delay to ensure layout is complete
    setTimeout(() => {
        if(currentInstancePackingState && PackerDOMElements.canvas) { // Check if component still exists
             resizeAndDrawPackerCanvas(currentInstancePackingState, PackerDOMElements);
        }
    }, 50);
}

export function destroyPackerComponent() {
    if (resizeObserver && PackerDOMElements.visualizationArea) {
        resizeObserver.unobserve(PackerDOMElements.visualizationArea);
        resizeObserver.disconnect();
        resizeObserver = null;
    }
    // Remove other listeners if they were attached to window or elements outside hostElement
    currentInstancePackingState = null;
    onResultCallbackGlobal = null;
    // PackerDOMElements are implicitly cleared when hostElement.innerHTML is changed by the caller
    console.log("Packer Component destroyed.");
}
// --- END OF FILE js/packer-component/packer-main.js ---