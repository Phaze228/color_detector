const std = @import("std");
pub const SAT_THRESH: u32 = 40;
pub const HUE_THRESH: u32 = 30;
pub const Color = packed struct {
    const Self = @This();
    r: u8,
    b: u8,
    g: u8,
    a: u8,

    pub fn nearColor(self: *Self, color: *Color, value_threshold: f32) bool {
        const pixel_hue, const pixel_sat, const pixel_val = self.toHSV();
        const color_hue, const color_sat, const color_val = color.toHSV();
        const threshold = value_threshold / 2.0;

        // zig fmt: off
        const hue_min = if (color_hue - HUE_THRESH < 0  ) 0   else @mod((color_hue - HUE_THRESH  ), 360);
        const hue_max = if (color_hue + HUE_THRESH > 360) 360 else @mod((color_hue + HUE_THRESH), 360);
        const sat_min = if (color_sat - SAT_THRESH < 0  ) 0   else color_sat - SAT_THRESH;
        const sat_max = if (color_sat + SAT_THRESH > 100) 100 else color_sat + SAT_THRESH;
        const val_min = if (color_val - threshold < 0   ) 0   else color_val - threshold;
        const val_max = if (color_val + threshold > 100 ) 100 else color_val + threshold;
        // zig fmt: on
        // std.debug.print(
        //     \\COLOR RANGE
        //     \\Hue: {d} - {d}
        //     \\Sat: {d} - {d}
        //     \\Val: {d} - {d}
        //     \\
        // , .{ hue_min, hue_max, sat_min, sat_max, val_min, val_max });
        //
        // std.debug.print(
        //     \\ COLOR DETECT
        //     \\Hue: {d}
        //     \\Sat: {d}
        //     \\Val: {d}
        //     \\
        // , .{ color_hue, color_sat, color_val });
        // std.debug.print(
        //     \\ PIXEL
        //     \\Hue: {d}
        //     \\Sat: {d}
        //     \\Val: {d}
        //     \\
        // , .{ pixel_hue, pixel_sat, pixel_val });
        if (pixel_hue >= hue_min and pixel_hue <= hue_max and
            pixel_sat >= sat_min and pixel_sat <= sat_max and
            pixel_val >= val_min and pixel_val <= val_max) return true;
        return false;
    }

    pub fn toHSV(self: *Self) [3]f32 {
        const r: f32 = @as(f32, @floatFromInt(self.r)) / 255.0;
        const g: f32 = @as(f32, @floatFromInt(self.g)) / 255.0;
        const b: f32 = @as(f32, @floatFromInt(self.b)) / 255.0;
        const v: f32 = std.mem.max(f32, &.{ r, g, b });
        const cmin: f32 = std.mem.min(f32, &.{ r, g, b });
        const delta = v - cmin;
        if (cmin == v) return .{ 0, 0, v };
        var h: f32 = 0;
        if (v == r) h = ((g - b) / delta) + 0;
        if (v == g) h = ((b - r) / delta) + 2.0;
        if (v == b) h = ((r - g) / delta) + 4.0;
        h = @mod(60 * h, 360);

        const s = if (v == 0) v else delta / v;

        return .{ @floor(h), @floor(s * 100), @ceil(v * 100) };
    }

    pub fn parseArr(data: []u8) Color {
        return Color{
            .r = data[0],
            .g = data[1],
            .b = data[2],
            .a = data[3],
        };
    }

    pub fn parseBits(num: u32) Color {
        return Color{
            .r = @truncate(num >> 16 & 0xFF),
            .g = @truncate(num >> 8 & 0xFF),
            .b = @truncate(num & 0xFF),
            .a = (0xFF),
        };
    }
};

test "Hsv-test" {
    var red = Color{
        .r = 255,
        .g = 0,
        .b = 0,
        .a = 255,
    };

    var blue = Color{
        .r = 0,
        .g = 0,
        .b = 255,
        .a = 255,
    };
    var green = Color{
        .r = 0,
        .g = 255,
        .b = 0,
        .a = 255,
    };
    try std.testing.expectEqualSlices(f32, &.{ 0, 100, 100 }, &red.toHSV());
    try std.testing.expectEqualSlices(f32, &.{ 120, 100, 100 }, &green.toHSV());
    try std.testing.expectEqualSlices(f32, &.{ 240, 100, 100 }, &blue.toHSV());
}

test "Near-Color" {
    var red = Color{
        .r = 255,
        .g = 0,
        .b = 0,
        .a = 255,
    };

    var red_adjacent = Color{ .r = 188, .g = 75, .b = 75, .a = 255 };
    // const h, const s, const v = red_adjacent.toHSV();

    try std.testing.expect(red.nearColor(&red_adjacent, 52));
}
