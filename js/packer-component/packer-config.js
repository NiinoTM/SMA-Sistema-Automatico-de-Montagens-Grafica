// --- START OF FILE js/packer-component/packer-config.js ---
export const EPSILON = 1e-5;
export const DIM_OUTER_PADDING = 70;
export const DIM_LINE_FROM_OBJECT_PADDING = 15;
export const TEXT_BG_INTERNAL_PADDING_X = 4;
export const TEXT_BG_INTERNAL_PADDING_Y = 2;
export const DIM_TICK_SIZE = 6;
export const DIM_INTER_LINE_SPACING = 20;

// DOMElements will be populated by the component's init function
// relative to its host element.
export const DOMElements = {
    // Container for prefixed IDs
    hostElement: null, // The div where this component is mounted
    containerWidthInput: null,
    containerHeightInput: null,
    containerFiberCombo: null,
    marginLeftInput: null,
    marginRightInput: null,
    marginTopInput: null,
    marginBottomInput: null,
    marginOrientationCombo: null,
    itemWidthInput: null,
    itemHeightInput: null,
    itemFiberCombo: null,
    itemGutterHInput: null,
    itemGutterVInput: null,
    calculateButton: null,
    resultsLabel: null,
    packingCanvas: null,
    toggleMarginsBtn: null,
    marginSettingsDiv: null,
    toggleGuttersBtn: null,
    gutterSettingsDiv: null,
    visualizationArea: null,
    canvas: null,
    ctx: null,
};

// Function to initialize DOMElements relative to a host
export function initPackerDOMElements(host) {
    DOMElements.hostElement = host;
    DOMElements.containerWidthInput = host.querySelector('#packerContainerWidth');
    DOMElements.containerHeightInput = host.querySelector('#packerContainerHeight');
    DOMElements.containerFiberCombo = host.querySelector('#packerContainerFiber');
    DOMElements.marginLeftInput = host.querySelector('#packerMarginLeft');
    DOMElements.marginRightInput = host.querySelector('#packerMarginRight');
    DOMElements.marginTopInput = host.querySelector('#packerMarginTop');
    DOMElements.marginBottomInput = host.querySelector('#packerMarginBottom');
    DOMElements.marginOrientationCombo = host.querySelector('#packerMarginOrientation');
    DOMElements.itemWidthInput = host.querySelector('#packerItemWidth');
    DOMElements.itemHeightInput = host.querySelector('#packerItemHeight');
    DOMElements.itemFiberCombo = host.querySelector('#packerItemFiber');
    DOMElements.itemGutterHInput = host.querySelector('#packerItemGutterH');
    DOMElements.itemGutterVInput = host.querySelector('#packerItemGutterV');
    DOMElements.calculateButton = host.querySelector('#packerCalculateButton');
    DOMElements.resultsLabel = host.querySelector('#packerResultsLabel');
    DOMElements.packingCanvas = host.querySelector('#packerPackingCanvas');
    DOMElements.toggleMarginsBtn = host.querySelector('#packerToggleMargins');
    DOMElements.marginSettingsDiv = host.querySelector('#packerMarginSettings');
    DOMElements.toggleGuttersBtn = host.querySelector('#packerToggleGutters');
    DOMElements.gutterSettingsDiv = host.querySelector('#packerGutterSettings');
    DOMElements.visualizationArea = host.querySelector('.packer-visualization'); // Use class

    if (DOMElements.packingCanvas) {
        DOMElements.canvas = DOMElements.packingCanvas;
        DOMElements.ctx = DOMElements.canvas.getContext('2d');
        if (!DOMElements.ctx) {
            console.error("Packer Component: Failed to get 2D context for canvas.");
        }
    } else {
        console.error("Packer Component: Packing canvas not found within host element.");
    }
}
// --- END OF FILE js/packer-component/packer-config.js ---