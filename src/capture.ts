import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/** Live handles to the renderer, filled in by the scene once it mounts. */
export const bridge: {
  gl: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  /** when true, walls stop fading so captures show the whole room */
  solidWalls: boolean;
  /** when true, faded walls leave no outline (cleaner renders) */
  capturing: boolean;
} = { gl: null, scene: null, camera: null, solidWalls: false, capturing: false };

if (import.meta.env.DEV) (window as unknown as { __rc: typeof bridge }).__rc = bridge;

export const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
export async function frames(n: number) {
  for (let i = 0; i < n; i++) await nextFrame();
}

/** Renders the current view at about 4K and returns a JPEG data URL. */
export function renderHD(targetWidth = 3840, mime = 'image/jpeg'): string {
  const { gl, scene, camera } = bridge;
  if (!gl || !scene || !camera) throw new Error('renderer not ready');
  const prev = gl.getPixelRatio();
  const size = gl.getSize(new THREE.Vector2());
  const ratio = Math.min(4, Math.max(1, targetWidth / size.x));
  gl.setPixelRatio(ratio);
  gl.render(scene, camera);
  const url = gl.domElement.toDataURL(mime, 0.94);
  gl.setPixelRatio(prev);
  gl.render(scene, camera);
  return url;
}

const EQUIRECT_FRAG = /* glsl */ `
uniform samplerCube cube;
uniform float exposure;
varying vec2 vUv;
#define PI 3.141592653589793
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
void main() {
  float lon = (vUv.x - 0.5) * 2.0 * PI;
  float lat = (vUv.y - 0.5) * PI;
  vec3 dir = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
  vec3 c = textureCube(cube, dir).rgb;
  gl_FragColor = vec4(toSRGB(aces(c)), 1.0);
}`;

/**
 * Captures a 360° equirectangular panorama from `eye`: render a cube map,
 * then unwrap it with a full-screen shader (tone mapping and sRGB applied
 * by hand, because three.js skips both when rendering to a target).
 */
export function capturePanorama(eye: THREE.Vector3, width = 4096): string {
  const { gl, scene } = bridge;
  if (!gl || !scene) throw new Error('renderer not ready');
  const H = width / 2;
  const cubeRT = new THREE.WebGLCubeRenderTarget(Math.min(2048, width / 3), { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.03, 100, cubeRT);
  cubeCam.position.copy(eye);
  cubeCam.updateMatrixWorld(true);
  cubeCam.update(gl, scene);

  const rt = new THREE.WebGLRenderTarget(width, H, { type: THREE.UnsignedByteType });
  const mat = new THREE.ShaderMaterial({
    uniforms: { cube: { value: cubeRT.texture }, exposure: { value: gl.toneMappingExposure } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: EQUIRECT_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const qs = new THREE.Scene();
  qs.add(quad);
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prevTarget = gl.getRenderTarget();
  gl.setRenderTarget(rt);
  gl.render(qs, oc);
  const buf = new Uint8Array(width * H * 4);
  gl.readRenderTargetPixels(rt, 0, 0, width, H, buf);
  gl.setRenderTarget(prevTarget);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, H);
  const row = width * 4;
  for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * row, (H - y) * row), y * row);
  ctx.putImageData(img, 0, 0);

  cubeRT.dispose();
  rt.dispose();
  mat.dispose();
  quad.geometry.dispose();
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function exportGLB(): Promise<Blob> {
  const { scene } = bridge;
  const root = scene?.getObjectByName('design');
  if (!root) throw new Error('scene not ready');
  const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
}

export function downloadURL(url: string, name: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  downloadURL(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
