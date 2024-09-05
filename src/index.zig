const std = @import("std");
const math = std.math;
const wasm = @import("wasm.zig");
const ArrayList = std.ArrayList;
const randGen = std.Random.DefaultPrng;
const wasm_allocator = std.heap.wasm_allocator;
const Hashi32usize = std.AutoHashMap(i32, usize);
const Color = @import("Color.zig").Color;

// This is a completely minimal example of zig compiling down to web assembly.
// Run a python web server in the directory. py -m http.server
// Open up index.html and inspect the page and see the result of this called external function.
//

pub extern fn getReplacementColor() u32;
pub extern fn getDetectColor() u32;
pub extern fn processCenters(items: [*]i32, length: usize) void;
pub extern fn getThresholdValue() f32;
pub extern fn getWidth() i32;
pub extern fn getHeight() i32;

pub export var global_width: i32 = 640;
pub export var global_height: i32 = 480;

pub export var global_chunk: [16384]u8 = undefined;

pub export var global_color_detect: u32 = 0x0;
pub export var global_threshold: f32 = 0.0;

pub var image_data = std.ArrayList(u8).init(wasm_allocator);

pub export fn pushData(index: usize, length: usize) void {
    if (image_data.items.len < index + length) {
        image_data.appendSlice(global_chunk[0..length]) catch unreachable;
    } else {
        image_data.replaceRangeAssumeCapacity(index, length, global_chunk[0..length]);
    }
}

pub export fn updateDetectColor() void {
    global_color_detect = getDetectColor();
}

pub export fn updateThreshold() void {
    global_threshold = getThresholdValue();
}

pub export fn updateWindowParams() void {
    global_width = @intCast(getWidth());
    global_height = @intCast(getHeight());
}

pub fn print(comptime fmt: []const u8, args: anytype) void {
    var buf: [4096]u8 = undefined;
    const slice = std.fmt.bufPrint(&buf, fmt, args) catch {
        wasm.logW(&buf, buf.len);
        return;
    };
    wasm.logW(slice.ptr, slice.len);
}

pub export fn getDistances(a: [*]i32, b: [*]i32) i32 {
    const x: f32 = @floatFromInt(a[0] - b[0]);
    const y: f32 = @floatFromInt(a[1] - b[1]);
    const hypot: i32 = @intFromFloat(math.hypot(x, y));
    return hypot;
}

pub export fn getRandomInt(min: i32, max: i32) i32 {
    var random_gen = randGen.init(0);
    const random_num = random_gen.random().intRangeAtMost(i32, min, max);
    return random_num;
}

pub const Point = packed struct {
    const Self = @This();
    x: i32,
    y: i32,

    pub fn parse(index: usize) Point {
        return Point{
            .x = @mod(index, global_width),
            .y = @divFloor(index, global_width),
        };
    }

    pub fn distanceBetween(self: *Self, point: Point) f32 {
        const x: f32 = @floatFromInt(self.x - point.x);
        const y: f32 = @floatFromInt(self.y - point.y);
        const hypot: f32 = math.hypot(x, y);
        return hypot;
    }

    pub fn distanceBetweenInt(self: *Self, pointIndex: i32) f32 {
        const x: f32 = @floatFromInt(self.x - @mod(pointIndex, global_width));
        const y: f32 = @floatFromInt(self.y - @divFloor(pointIndex, global_width));
        const hypot: f32 = math.hypot(x, y);
        return hypot;
    }
};

pub export fn detect() void {
    const points_to_render = getDetectedPoints();
    var centerMap = std.AutoHashMap(i32, usize).init(wasm_allocator);
    defer centerMap.deinit();
    kMeans(2, 10, points_to_render, &centerMap);
    var list = ArrayList(i32).init(wasm_allocator);
    for (0..2) |i| {
        var entries = centerMap.iterator();
        while (entries.next()) |entry| {
            if (entry.value_ptr.* != i) continue;
            list.append(entry.key_ptr.*) catch unreachable;
        }
        list.append(math.maxInt(i32)) catch unreachable;
    }
    defer list.deinit();
    defer wasm_allocator.free(points_to_render);
    processCenters(@ptrCast(list.items), list.items.len);
}

pub fn getDetectedPoints() []i32 {
    var good_points = ArrayList(i32).init(wasm_allocator);
    var detect_color = Color.parseBits(getDetectColor());
    var i: usize = 0;
    while (i < image_data.items.len) : (i += 4) {
        const color: *Color = @alignCast(@constCast(@ptrCast(image_data.items[i .. i + 4])));
        if (!color.nearColor(&detect_color, getThresholdValue())) continue;
        good_points.append(@intCast(i)) catch {
            print("Failed to append things", .{});
            unreachable;
        };
    }

    return good_points.toOwnedSlice() catch unreachable;
}

pub fn kMeans(
    k_centers: usize,
    iters: usize,
    points: []i32,
    map: *Hashi32usize,
) void {
    var centers: [10]Point = undefined;
    for (0..k_centers) |i| {
        centers[i] = Point{
            .x = @bitCast(getRandomInt(0, @intCast(global_width))),
            .y = @bitCast(getRandomInt(0, @intCast(global_height))),
        };
    }
    for (0..iters) |_| {
        assignCenters(centers[0..k_centers], points, map);
        updateCenters(centers[0..k_centers], map);
    }
}

pub fn assignCenters(centers: []Point, pixels: []i32, centerMap: *Hashi32usize) void {
    for (pixels) |p| {
        var closest_center: u8 = 0;
        var min_distance = math.inf(f32);
        for (centers, 0..) |_, i| {
            const distance = centers[i].distanceBetweenInt(p);
            if (distance < min_distance) {
                min_distance = distance;
                closest_center = @intCast(i);
            }
        }
        centerMap.put(p, closest_center) catch unreachable;
    }
}

pub fn updateCenters(centers: []Point, centerMap: *Hashi32usize) void {
    for (0..centers.len) |i| {
        var x_sum: usize = 0;
        var y_sum: usize = 0;
        var count: usize = 0;
        // const ctr = centers[i];
        var key_vals = centerMap.iterator();
        while (key_vals.next()) |entry| {
            if (entry.value_ptr.* != i) continue;
            const x: usize = @mod(entry.value_ptr.*, @as(usize, @intCast(global_width)));
            const y: usize = @divFloor(entry.value_ptr.*, @as(usize, @intCast(global_width)));
            x_sum +%= x;
            y_sum +%= y;
            count += 1;
        }
        x_sum /= if (count == 0) 1 else count;
        y_sum /= if (count == 0) 1 else count;
        centers[i].x = @intCast(x_sum);
        centers[i].y = @intCast(y_sum);
    }
}

pub export fn getAverageColor(x: i32, y: i32, pixel_radius: usize) u32 {
    const directions = [_]i32{
        -1, 0, 1,
    };
    // var avg_color:Color = .{.r = 0, .b = 0, .g = 0, .a = 255};
    var r: i32, var g: i32, var b: i32 = .{ 0, 0, 0 };
    var count: i32 = 0;
    for (directions) |d| {
        for (1..pixel_radius) |i| {
            const x_part = x + @as(i32, @intCast(i)) * d;
            for (1..pixel_radius) |j| {
                const y_part = y + @as(i32, @intCast(j)) * d;
                const index = ((y_part * global_width) + x_part) * 4;
                if (index < 0 or index > global_width * global_height * 4) continue;
                const idx: usize = @intCast(index);
                // print(
                //     \\PIXEL
                //     \\R: {d}
                //     \\G: {d}
                //     \\B: {d}
                //     \\A: {d}
                // , .{ image_data.items[idx], image_data.items[idx + 1], image_data.items[idx + 2], image_data.items[idx + 3] });
                r += image_data.items[idx + 0];
                b += image_data.items[idx + 1];
                g += image_data.items[idx + 2];
                count += 1;
            }
        }
    }
    if (count == 0) return 0;
    r = @divFloor(r, count);
    b = @divFloor(b, count);
    g = @divFloor(g, count);
    const color: i32 = math.shl(i32, r, 24) | math.shl(i32, g, 16) | math.shl(i32, b, 8) | 255;
    return @intCast(color);
}
