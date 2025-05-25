// --- START OF FILE js/packer-component/packer-dimension-drawer.js ---
import {
    DIM_TICK_SIZE,
    TEXT_BG_INTERNAL_PADDING_X,
    TEXT_BG_INTERNAL_PADDING_Y,
    DIM_LINE_FROM_OBJECT_PADDING,
    DIM_INTER_LINE_SPACING
} from './packer-config.js'; // Use local config

export function drawSingleDimensionLineComponent(painter, p1_tuple, p2_tuple, text, orientation) {
    const p1_x = p1_tuple[0]; const p1_y = p1_tuple[1];
    const p2_x = p2_tuple[0]; const p2_y = p2_tuple[1];

    painter.beginPath();
    painter.moveTo(Math.floor(p1_x), Math.floor(p1_y));
    painter.lineTo(Math.floor(p2_x), Math.floor(p2_y));
    painter.stroke();

    if (orientation === "horizontal") {
        const tick_y_offset = DIM_TICK_SIZE / 2;
        painter.beginPath();
        painter.moveTo(Math.floor(p1_x), Math.floor(p1_y - tick_y_offset));
        painter.lineTo(Math.floor(p1_x), Math.floor(p1_y + tick_y_offset));
        painter.moveTo(Math.floor(p2_x), Math.floor(p2_y - tick_y_offset));
        painter.lineTo(Math.floor(p2_x), Math.floor(p2_y + tick_y_offset));
        painter.stroke();
    } else if (orientation === "vertical") {
        const tick_x_offset = DIM_TICK_SIZE / 2;
        painter.beginPath();
        painter.moveTo(Math.floor(p1_x - tick_x_offset), Math.floor(p1_y));
        painter.lineTo(Math.floor(p1_x + tick_x_offset), Math.floor(p1_y));
        painter.moveTo(Math.floor(p2_x - tick_x_offset), Math.floor(p2_y));
        painter.lineTo(Math.floor(p2_x + tick_x_offset), Math.floor(p2_y));
        painter.stroke();
    }

    const textMetrics = painter.measureText(text);
    const text_w = textMetrics.width;
    const fontMatch = painter.font.match(/(\d+)px/);
    const fontSize = fontMatch ? parseFloat(fontMatch[1]) : 10;
    const text_h = fontSize;

    const text_bg_w = text_w + 2 * TEXT_BG_INTERNAL_PADDING_X;
    const text_bg_h = text_h + 2 * TEXT_BG_INTERNAL_PADDING_Y;
    const oldFillStyle = painter.fillStyle;

    if (orientation === "horizontal") {
        const line_center_x = (p1_x + p2_x) / 2;
        const line_y = p1_y;
        const bg_rect_draw_x = line_center_x - text_bg_w / 2;
        const bg_rect_draw_y = line_y - text_bg_h / 2;

        painter.fillStyle = "white";
        painter.fillRect(Math.floor(bg_rect_draw_x), Math.floor(bg_rect_draw_y), Math.ceil(text_bg_w), Math.ceil(text_bg_h));

        painter.fillStyle = oldFillStyle;
        painter.textAlign = "center";
        painter.textBaseline = "middle";
        painter.fillText(text, Math.floor(line_center_x), Math.floor(line_y));
    } else if (orientation === "vertical") {
        const line_x = p1_x;
        const line_center_y = (p1_y + p2_y) / 2;
        const on_screen_bg_w = text_bg_h;
        const on_screen_bg_h = text_bg_w;
        const bg_rect_draw_x = line_x - on_screen_bg_w / 2;
        const bg_rect_draw_y = line_center_y - on_screen_bg_h / 2;

        painter.fillStyle = "white";
        painter.fillRect(Math.floor(bg_rect_draw_x), Math.floor(bg_rect_draw_y), Math.ceil(on_screen_bg_w), Math.ceil(on_screen_bg_h));

        painter.save();
        painter.translate(Math.floor(line_x), Math.floor(line_center_y));
        painter.rotate(-Math.PI / 2);
        painter.fillStyle = oldFillStyle;
        painter.textAlign = "center";
        painter.textBaseline = "middle";
        painter.fillText(text, 0, 0);
        painter.restore();
    }
    painter.textAlign = "left";
    painter.textBaseline = "alphabetic";
}

export function drawContainerDimensions(painter, container_width_orig, container_height_orig, offset_x_widget, offset_y_widget, scaled_container_w_pixels, scaled_container_h_pixels, epsilon, item_dims_drawn_horizontally, item_dims_drawn_vertically) {
    if (container_width_orig > epsilon) {
        const val_str = container_width_orig.toFixed(1);
        let line_y_pos = offset_y_widget - DIM_LINE_FROM_OBJECT_PADDING;
        if (item_dims_drawn_horizontally) line_y_pos -= DIM_INTER_LINE_SPACING;
        drawSingleDimensionLineComponent(painter, [offset_x_widget, line_y_pos], [offset_x_widget + scaled_container_w_pixels, line_y_pos], val_str, "horizontal");
    }
    if (container_height_orig > epsilon) {
        const val_str = container_height_orig.toFixed(1);
        let line_x_pos = offset_x_widget + scaled_container_w_pixels + DIM_LINE_FROM_OBJECT_PADDING;
        if (item_dims_drawn_vertically) line_x_pos += DIM_INTER_LINE_SPACING;
        drawSingleDimensionLineComponent(painter, [line_x_pos, offset_y_widget], [line_x_pos, offset_y_widget + scaled_container_h_pixels], val_str, "vertical");
    }
}

export function drawItemBlockDimensions(painter, item_block_width_orig, item_block_height_orig, item_block_start_x_canvas, item_block_end_x_canvas, item_block_start_y_canvas, item_block_end_y_canvas, container_top_y_canvas, container_right_x_canvas, epsilon) {
    if (item_block_width_orig > epsilon) {
        const val_str = item_block_width_orig.toFixed(1);
        const line_y_pos = container_top_y_canvas - DIM_LINE_FROM_OBJECT_PADDING; // Relative to container top
        drawSingleDimensionLineComponent(painter, [item_block_start_x_canvas, line_y_pos], [item_block_end_x_canvas, line_y_pos], val_str, "horizontal");
    }
    if (item_block_height_orig > epsilon) {
        const val_str = item_block_height_orig.toFixed(1);
        const line_x_pos = container_right_x_canvas + DIM_LINE_FROM_OBJECT_PADDING; // Relative to container right
        drawSingleDimensionLineComponent(painter, [line_x_pos, item_block_start_y_canvas], [line_x_pos, item_block_end_y_canvas], val_str, "vertical");
    }
}
// --- END OF FILE js/packer-component/packer-dimension-drawer.js ---