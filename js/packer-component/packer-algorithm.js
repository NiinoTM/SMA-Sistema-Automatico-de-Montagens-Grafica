// --- START OF FILE js/packer-component/packer-algorithm.js ---
import { EPSILON } from './packer-config.js';

// Note: This function now takes the current packer's state as an argument
export function getEffectiveMargins(currentPackingState) {
    if (currentPackingState.marginOrientation === 1) { // xx for L/R, yy for Strip/Grip
        return [currentPackingState.marginLeftRaw, currentPackingState.marginTopRaw, currentPackingState.marginRightRaw, currentPackingState.marginBottomRaw];
    } else { // xx for Strip/Grip, yy for L/R
        return [currentPackingState.marginTopRaw, currentPackingState.marginLeftRaw, currentPackingState.marginBottomRaw, currentPackingState.marginRightRaw];
    }
}

// _fillAreaWithItems remains largely the same, using passed parameters
function _fillAreaWithItems(area_x_start_offset, area_y_start_offset, available_width, available_height, item_w, item_h, item_gutter_h, item_gutter_v, positions_list) {
    if (item_w < EPSILON || item_h < EPSILON || available_width < item_w - EPSILON || available_height < item_h - EPSILON) {
        return [0, 0.0, 0.0];
    }
    let num_added = 0;
    let current_y = area_y_start_offset;
    let max_x_coord_in_block = area_x_start_offset;
    let max_y_coord_in_block = area_y_start_offset;
    const effective_area_right_edge = area_x_start_offset + available_width;
    const effective_area_bottom_edge = area_y_start_offset + available_height;
    let first_row_processed = false;

    while (true) {
        if (current_y + item_h > effective_area_bottom_edge + EPSILON) break;
        let current_x = area_x_start_offset;
        let items_in_this_row = 0;
        while (true) {
            if (current_x + item_w > effective_area_right_edge + EPSILON) break;
            positions_list.push([current_x, current_y, item_w, item_h]);
            num_added++;
            items_in_this_row++;
            max_x_coord_in_block = Math.max(max_x_coord_in_block, current_x + item_w);
            max_y_coord_in_block = Math.max(max_y_coord_in_block, current_y + item_h);
            const next_x_start_for_item = current_x + item_w + item_gutter_h;
            if (next_x_start_for_item > effective_area_right_edge + EPSILON && Math.abs(next_x_start_for_item - (current_x + item_w)) > EPSILON) {
                 if (Math.abs(current_x + item_w - effective_area_right_edge) > EPSILON) break;
            }
            if (next_x_start_for_item + item_w > effective_area_right_edge + EPSILON) {
                 if (Math.abs(current_x + item_w - effective_area_right_edge) > EPSILON) break;
            }
            if (items_in_this_row > 0 && current_x + item_w > effective_area_right_edge - EPSILON && Math.abs(current_x + item_w - effective_area_right_edge) > EPSILON) {
                break;
            }
            current_x = next_x_start_for_item;
            if (Math.abs(current_x - (effective_area_right_edge + item_gutter_h)) < EPSILON && item_w < EPSILON && item_gutter_h < EPSILON) break;
        }
        if (items_in_this_row === 0) {
            if (first_row_processed) break;
            else return [0, 0.0, 0.0];
        }
        first_row_processed = true;
        const next_y_start_for_item = current_y + item_h + item_gutter_v;
        if (next_y_start_for_item > effective_area_bottom_edge + EPSILON && Math.abs(next_y_start_for_item - (current_y + item_h)) > EPSILON) {
             if (Math.abs(current_y + item_h - effective_area_bottom_edge) > EPSILON) break;
        }
        if (next_y_start_for_item + item_h > effective_area_bottom_edge + EPSILON) {
             if (Math.abs(current_y + item_h - effective_area_bottom_edge) > EPSILON) break;
        }
        if (items_in_this_row > 0 && current_y + item_h > effective_area_bottom_edge - EPSILON && Math.abs(current_y + item_h - effective_area_bottom_edge) > EPSILON) {
            break;
        }
        current_y = next_y_start_for_item;
         if (Math.abs(current_y - (effective_area_bottom_edge + item_gutter_v)) < EPSILON && item_h < EPSILON && item_gutter_v < EPSILON ) break;
    }
    let block_width_used = 0.0;
    let block_height_used = 0.0;
    if (num_added > 0) {
        block_width_used = max_x_coord_in_block - area_x_start_offset;
        block_height_used = max_y_coord_in_block - area_y_start_offset;
    }
    return [num_added, block_width_used, block_height_used];
}

// _packMixed remains largely the same, using passed parameters and _fillAreaWithItems
function _packMixed(container_eff_w, container_eff_h, primary_item_w, primary_item_h, primary_gutter_h, primary_gutter_v, secondary_item_w, secondary_item_h, secondary_gutter_h, secondary_gutter_v, base_offset_x, base_offset_y) {
    let current_positions = [];
    let total_count = 0;
    const [count_primary, main_block_actual_w, main_block_actual_h] = _fillAreaWithItems(
        base_offset_x, base_offset_y, container_eff_w, container_eff_h,
        primary_item_w, primary_item_h, primary_gutter_h, primary_gutter_v,
        current_positions
    );
    total_count += count_primary;
    let start_x_area_A = base_offset_x;
    let width_area_A = container_eff_w;
    if (count_primary > 0 && main_block_actual_w > EPSILON) {
        start_x_area_A = base_offset_x + main_block_actual_w + primary_gutter_h;
        width_area_A = container_eff_w - (main_block_actual_w + primary_gutter_h);
    }
    if (width_area_A >= secondary_item_w - EPSILON) {
        const [count_A] = _fillAreaWithItems(
            start_x_area_A, base_offset_y, width_area_A, container_eff_h,
            secondary_item_w, secondary_item_h, secondary_gutter_h, secondary_gutter_v,
            current_positions
        );
        total_count += count_A;
    }
    let start_y_area_B = base_offset_y;
    let height_area_B = container_eff_h;
    if (count_primary > 0 && main_block_actual_h > EPSILON) {
        start_y_area_B = base_offset_y + main_block_actual_h + primary_gutter_v;
        height_area_B = container_eff_h - (main_block_actual_h + primary_gutter_v);
    }
    let width_area_B = (count_primary > 0 && main_block_actual_w > EPSILON) ? main_block_actual_w : container_eff_w;
    if (height_area_B >= secondary_item_h - EPSILON && width_area_B > EPSILON) {
        const [count_B] = _fillAreaWithItems(
            base_offset_x, start_y_area_B, width_area_B, height_area_B,
            secondary_item_w, secondary_item_h, secondary_gutter_h, secondary_gutter_v,
            current_positions
        );
        total_count += count_B;
    }
    return [current_positions, total_count];
}


// calculatePacking now takes the current packer's state and modifies it
export function calculatePackingForComponent(currentPackingState, container_fiber_val, item_fiber_val) {
    currentPackingState.itemsPositions = []; // Reset positions on the passed state object
    const [eff_ml, eff_mt, eff_mr, eff_mb] = getEffectiveMargins(currentPackingState);
    const effective_container_w = Math.max(0.0, currentPackingState.containerWidth - eff_ml - eff_mr);
    const effective_container_h = Math.max(0.0, currentPackingState.containerHeight - eff_mt - eff_mb);

    if (currentPackingState.itemWidthRaw < EPSILON || currentPackingState.itemHeightRaw < EPSILON) {
        return;
    }

    const can_rotate_freely = (container_fiber_val === 0 || item_fiber_val === 0);
    const item_w_orig = currentPackingState.itemWidthRaw;
    const item_h_orig = currentPackingState.itemHeightRaw;
    const gutter_h_orig = currentPackingState.interItemHMarginRaw;
    const gutter_v_orig = currentPackingState.interItemVMarginRaw;

    if (!can_rotate_freely) {
        let actual_item_w = item_w_orig;
        let actual_item_h = item_h_orig;
        let actual_gutter_h = gutter_h_orig;
        let actual_gutter_v = gutter_v_orig;
        if ((container_fiber_val === 1 && item_fiber_val === 2) || (container_fiber_val === 2 && item_fiber_val === 1)) {
            actual_item_w = item_h_orig; actual_item_h = item_w_orig;
            actual_gutter_h = gutter_v_orig; actual_gutter_v = gutter_h_orig;
        }
        _fillAreaWithItems(eff_ml, eff_mt, effective_container_w, effective_container_h, actual_item_w, actual_item_h, actual_gutter_h, actual_gutter_v, currentPackingState.itemsPositions);
    } else {
        const [positions1, count1] = _packMixed(
            effective_container_w, effective_container_h,
            item_w_orig, item_h_orig, gutter_h_orig, gutter_v_orig,
            item_h_orig, item_w_orig, gutter_v_orig, gutter_h_orig,
            eff_ml, eff_mt
        );
        const [positions2, count2] = _packMixed(
            effective_container_w, effective_container_h,
            item_h_orig, item_w_orig, gutter_v_orig, gutter_h_orig,
            item_w_orig, item_h_orig, gutter_h_orig, gutter_v_orig,
            eff_ml, eff_mt
        );
        if (count1 >= count2) {
            currentPackingState.itemsPositions = positions1;
        } else {
            currentPackingState.itemsPositions = positions2;
        }
    }

    const final_positions = [];
    const usable_area_far_x_limit = eff_ml + effective_container_w;
    const usable_area_far_y_limit = eff_mt + effective_container_h;
    for (const item of currentPackingState.itemsPositions) {
        const [x,y,w,h] = item;
        if (x >= eff_ml - EPSILON && y >= eff_mt - EPSILON &&
            x + w <= usable_area_far_x_limit + EPSILON &&
            y + h <= usable_area_far_y_limit + EPSILON) {
            final_positions.push(item);
        }
    }
    currentPackingState.itemsPositions = final_positions;
}
// --- END OF FILE js/packer-component/packer-algorithm.js ---