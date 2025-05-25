// --- START OF FILE js/packer-component/packer-state.js ---
// This will be instantiated per component instance
export function createPackerState() {
    return {
        containerWidth: 0.0, // Default values
        containerHeight: 0.0,
        itemWidthRaw: 0.0,
        itemHeightRaw: 0.0,
        interItemHMarginRaw: 2,
        interItemVMarginRaw: 2,
        marginLeftRaw: 5.0,
        marginTopRaw: 10.0,
        marginRightRaw: 5.0,
        marginBottomRaw: 13.0,
        marginOrientation: 2, // Default to match original 'yy fiber' for container assuming it means H > W
        containerFiber: 2,    // Added this based on UI
        itemFiber: 0,         // Added this
        itemsPositions: [],
    };
}
// --- END OF FILE js/packer-component/packer-state.js ---