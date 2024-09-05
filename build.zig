const std = @import("std");

const WASM_FILE_NAME = "color_detector";
const ZIG_SOURCE = "src/index.zig";

pub fn build(b: *std.Build) void {
    // const opt = b.standardOptimizeOption(.{});
    const wasm_target = b.resolveTargetQuery(std.zig.CrossTarget.parse(
        .{ .arch_os_abi = "wasm32-freestanding" },
    ) catch unreachable);

    const exe = b.addExecutable(.{
        .name = WASM_FILE_NAME,
        .root_source_file = b.path(ZIG_SOURCE),
        .target = wasm_target,
        .optimize = .ReleaseFast,
        // .optimize = .ReleaseFast,
    });
    exe.entry = .disabled;
    exe.rdynamic = true;

    b.installArtifact(exe);
}
