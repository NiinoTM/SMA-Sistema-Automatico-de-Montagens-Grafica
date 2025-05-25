// --- START OF FILE js/packer-component/packer-canvas-manager.js ---
import { DOMElements as PackerDOMElements, DIM_OUTER_PADDING, EPSILON } from './packer-config.js'; // Local config
import { getEffectiveMargins as getPackerEffectiveMargins } from './packer-algorithm.js'; // Local algorithm
import { drawContainerDimensions, drawItemBlockDimensions } from './packer-dimension-drawer.js'; // Local drawer

// paintPackingVisualization now takes the component's current state and its DOMElements
function paintPackingVisualization(currentPackingState, currentPackerDOMElements, logicalWidth, logicalHeight) {
    const ctx = currentPackerDOMElements.ctx;
    if (!ctx) {
        console.error("Packer Component: Canvas context not available for painting.");
        return;
    }

    ctx.fillStyle = "white"; // Canvas default background is white (set in CSS too)
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    // Optional: border around the canvas drawing area itself
    // ctx.strokeStyle = "#e2e8f0";
    // ctx.lineWidth = 1; // Use 1 for fine line
    // ctx.strokeRect(0.5, 0.5, logicalWidth - 1, logicalHeight - 1);


    if (currentPackingState.containerWidth < EPSILON || currentPackingState.containerHeight < EPSILON) {
         ctx.fillStyle = '#64748b';
         ctx.font = '14px sans-serif'; // Adjusted font size for dialog
         ctx.textAlign = 'center';
         ctx.fillText('Packer: Container dimensions not set.', logicalWidth/2, logicalHeight/2);
        return;
    }
    // If logicalWidth/Height is too small, drawing might be pointless or error-prone
    if (logicalWidth < 2 * DIM_OUTER_PADDING || logicalHeight < 2 * DIM_OUTER_PADDING) {
        // Optional: Draw a message if canvas is too small for detailed visualization
        // ctx.fillStyle = '#64748b';
        // ctx.font = '12px sans-serif';
        // ctx.textAlign = 'center';
        // ctx.fillText('Canvas too small for full viz.', logicalWidth / 2, logicalHeight / 2);
        // return; // Or try to draw a very simplified version
    }


    const widget_w_pixels = Math.max(1.0, logicalWidth - 2 * DIM_OUTER_PADDING);
    const widget_h_pixels = Math.max(1.0, logicalHeight - 2 * DIM_OUTER_PADDING);

    const scale_x = (currentPackingState.containerWidth > EPSILON) ? widget_w_pixels / currentPackingState.containerWidth : 1.0;
    const scale_y = (currentPackingState.containerHeight > EPSILON) ? widget_h_pixels / currentPackingState.containerHeight : 1.0;
    let scale = Math.min(scale_x, scale_y);

    if (scale < EPSILON || !isFinite(scale)) {
        scale = Math.min(0.1, widget_w_pixels, widget_h_pixels); // Fallback scale
        if (scale < EPSILON) scale = 0.01;
    }

    const scaled_container_w_pixels = currentPackingState.containerWidth * scale;
    const scaled_container_h_pixels = currentPackingState.containerHeight * scale;
    const offset_x_widget = (logicalWidth - scaled_container_w_pixels) / 2.0;
    const offset_y_widget = (logicalHeight - scaled_container_h_pixels) / 2.0;

    ctx.strokeStyle = "black"; ctx.lineWidth = 2;
    ctx.fillStyle = "rgb(240, 240, 240)";
    const crx = Math.floor(offset_x_widget); const cry = Math.floor(offset_y_widget);
    const crw = Math.ceil(scaled_container_w_pixels); const crh = Math.ceil(scaled_container_h_pixels);
    ctx.fillRect(crx, cry, crw, crh);
    ctx.strokeRect(crx, cry, crw, crh);

    if (scale > EPSILON) {
        const [eff_ml, eff_mt, eff_mr, eff_mb] = getPackerEffectiveMargins(currentPackingState);
        const usable_area_x_orig = eff_ml;
        const usable_area_y_orig = eff_mt;
        const usable_area_w_orig = currentPackingState.containerWidth - eff_ml - eff_mr;
        const usable_area_h_orig = currentPackingState.containerHeight - eff_mt - eff_mb;

        if (usable_area_w_orig > EPSILON && usable_area_h_orig > EPSILON) {
            ctx.strokeStyle = "rgb(180, 180, 180)"; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
            const usable_area_x_on_canvas = offset_x_widget + usable_area_x_orig * scale;
            const usable_area_y_on_canvas = offset_y_widget + usable_area_y_orig * scale;
            const usable_area_w_on_canvas = usable_area_w_orig * scale;
            const usable_area_h_on_canvas = usable_area_h_orig * scale;
            ctx.strokeRect(
                Math.floor(usable_area_x_on_canvas), Math.floor(usable_area_y_on_canvas),
                Math.ceil(usable_area_w_on_canvas), Math.ceil(usable_area_h_on_canvas)
            );
            ctx.setLineDash([]);
        }
    }

    if (currentPackingState.itemsPositions && currentPackingState.itemsPositions.length > 0 && scale > EPSILON) {
        ctx.strokeStyle = "rgb(50, 50, 200)"; ctx.fillStyle = "rgba(79, 70, 229, 0.5)"; ctx.lineWidth = 1;
        for (const item of currentPackingState.itemsPositions) {
            const [x_item, y_item, w_item, h_item] = item;
            const rect_x_on_canvas = offset_x_widget + x_item * scale;
            const rect_y_on_canvas = offset_y_widget + y_item * scale;
            const rect_w_on_canvas = w_item * scale;
            const rect_h_on_canvas = h_item * scale;
            ctx.fillRect(
                Math.floor(rect_x_on_canvas), Math.floor(rect_y_on_canvas),
                Math.ceil(rect_w_on_canvas), Math.ceil(rect_h_on_canvas)
            );
            ctx.strokeRect(
                Math.floor(rect_x_on_canvas), Math.floor(rect_y_on_canvas),
                Math.ceil(rect_w_on_canvas), Math.ceil(rect_h_on_canvas)
            );
        }
    }

    let item_block_width_orig = 0.0, item_block_height_orig = 0.0;
    let item_block_start_x_canvas = 0.0, item_block_end_x_canvas = 0.0;
    let item_block_start_y_canvas = 0.0, item_block_end_y_canvas = 0.0;
    const has_items_to_dimension = currentPackingState.itemsPositions && currentPackingState.itemsPositions.length > 0 && scale > EPSILON;

    if (has_items_to_dimension) {
        const min_x_item_orig = Math.min(...currentPackingState.itemsPositions.map(it => it[0]));
        const max_x_item_plus_w_orig = Math.max(...currentPackingState.itemsPositions.map(it => it[0] + it[2]));
        const min_y_item_orig = Math.min(...currentPackingState.itemsPositions.map(it => it[1]));
        const max_y_item_plus_h_orig = Math.max(...currentPackingState.itemsPositions.map(it => it[1] + it[3]));
        item_block_width_orig = max_x_item_plus_w_orig - min_x_item_orig;
        item_block_height_orig = max_y_item_plus_h_orig - min_y_item_orig;
        item_block_start_x_canvas = offset_x_widget + min_x_item_orig * scale;
        item_block_end_x_canvas = offset_x_widget + max_x_item_plus_w_orig * scale;
        item_block_start_y_canvas = offset_y_widget + min_y_item_orig * scale;
        item_block_end_y_canvas = offset_y_widget + max_y_item_plus_h_orig * scale;
    }

    ctx.strokeStyle = "rgb(70, 70, 70)"; ctx.fillStyle = "rgb(70, 70, 70)";
    ctx.lineWidth = 1; ctx.font = "10px sans-serif";

    const item_dim_h_will_be_drawn = has_items_to_dimension && item_block_width_orig > EPSILON;
    const item_dim_v_will_be_drawn = has_items_to_dimension && item_block_height_orig > EPSILON;

    drawContainerDimensions(ctx, currentPackingState.containerWidth, currentPackingState.containerHeight, offset_x_widget, offset_y_widget, scaled_container_w_pixels, scaled_container_h_pixels, EPSILON, item_dim_h_will_be_drawn, item_dim_v_will_be_drawn);
    if (has_items_to_dimension) {
        drawItemBlockDimensions(ctx, item_block_width_orig, item_block_height_orig, item_block_start_x_canvas, item_block_end_x_canvas, item_block_start_y_canvas, item_block_end_y_canvas, offset_y_widget, offset_x_widget + scaled_container_w_pixels, EPSILON);
    }
}

// resizeAndDrawCanvas now takes the component's current state and its DOMElements
export function resizeAndDrawPackerCanvas(currentPackingState, currentPackerDOMElements) {
    const canvas = currentPackerDOMElements.canvas;
    const ctx = currentPackerDOMElements.ctx;
    
    // The canvas container is the direct parent of the canvas element.
    // Its size is determined by the flex layout of .packer-visualization.
    const canvasContainer = canvas.parentElement; 

    if (!canvasContainer || !canvas || !ctx) {
        console.error("Packer Component: Canvas container, canvas, or context not initialized for resizeAndDrawPackerCanvas.");
        return;
    }

    // Get the content-box dimensions of the canvasContainer.
    // This container should already have its size determined by the flex layout.
    const containerStyle = window.getComputedStyle(canvasContainer);
    const containerPaddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
    const containerPaddingRight = parseFloat(containerStyle.paddingRight) || 0;
    const containerPaddingTop = parseFloat(containerStyle.paddingTop) || 0;
    const containerPaddingBottom = parseFloat(containerStyle.paddingBottom) || 0;

    const availableWidth = Math.max(0, canvasContainer.clientWidth - containerPaddingLeft - containerPaddingRight);
    const availableHeight = Math.max(0, canvasContainer.clientHeight - containerPaddingTop - containerPaddingBottom);

    // If the container has no real dimensions, don't try to size the canvas.
    if (availableWidth <= 0 || availableHeight <= 0) {
        // console.warn("Packer Component: Canvas container has zero or negative dimensions. Canvas not resized.", availableWidth, availableHeight);
        canvas.style.width = "0px";
        canvas.style.height = "0px";
        canvas.width = 0;
        canvas.height = 0;
        return; 
    }
    
    // Set the canvas's display size (CSS pixels)
    canvas.style.width = availableWidth + "px";
    canvas.style.height = availableHeight + "px";

    // Set the canvas's backing store size (actual pixels)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(availableWidth * dpr); // Use Math.round to avoid sub-pixel issues
    canvas.height = Math.round(availableHeight * dpr);
    
    // Reset transform and scale for the new size
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Clears previous scales/transforms and applies new dpr scale

    paintPackingVisualization(currentPackingState, currentPackerDOMElements, availableWidth, availableHeight);
}
// --- END OF FILE js/packer-component/packer-canvas-manager.js ---