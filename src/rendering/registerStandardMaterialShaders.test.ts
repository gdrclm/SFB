import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { describe, expect, it } from "vitest";
import "./registerStandardMaterialShaders";

describe("standard material shader registration", () => {
  it("registers GLSL source before the first material compilation", () => {
    expect(ShaderStore.ShadersStore.defaultVertexShader).toContain("attribute vec3 position");
    expect(ShaderStore.ShadersStore.defaultPixelShader).toContain("gl_FragColor");
  });
});
