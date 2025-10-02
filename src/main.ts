// src/main.ts
import { BackgroundScene, WorldScene } from "./scene";
import { SketchCanvas } from "./canvas";

type Axis = "xy" | "xz" | "yz"; // 必要なら拡張

const getCanvas = (id: string) => {
    const el = document.getElementById(id);
    if (!el || !(el instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas not found or not a canvas: #${id}`);
    }
    return el;
};

/* ========= 右上（単体 WorldScene） ========= */
const worldCanvasTR = getCanvas("glRIghtTopCanvas");
const worldSceneTR = new WorldScene(worldCanvasTR);

/* ========= 他3面（GL + Sketch の重ね） ========= */
const overlayPanels: { glId: string; sketchId: string; axis: Axis }[] = [
    { glId: "glCanvasTL", sketchId: "sketchCanvasTL", axis: "xy" }, // 左上
    { glId: "glCanvasBL", sketchId: "sketchCanvasBL", axis: "xz" }, // 左下
    { glId: "glCanvasBR", sketchId: "sketchCanvasBR", axis: "yz" }, // 右下
];

const bgScenes: BackgroundScene[] = [];
const sketchLayers: SketchCanvas[] = [];

for (const p of overlayPanels) {
    const gl = getCanvas(p.glId);
    const sk = getCanvas(p.sketchId);
    const bg = new BackgroundScene(gl, worldSceneTR, p.axis);
    const sketch = new SketchCanvas(sk, bg);
    bgScenes.push(bg);
    sketchLayers.push(sketch);
}

/* ========= Resize ========= */
const onResize = () => {
    worldSceneTR.onResize();
    for (const bg of bgScenes) bg.onResize();
    for (const sk of sketchLayers) sk.onResize();
};
window.addEventListener("resize", onResize);
onResize();

/* ========= Render Loop ========= */
let raf = 0;
let last = performance.now();
const FPS = 60;

const tick = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;

    if (dt >= 1 / FPS) {
        // 右上 World
        worldSceneTR.render();

        // 他3面（GL→Sketch）
        for (const bg of bgScenes) bg.render();
        for (const sk of sketchLayers) sk.update(dt);

        last = now;
    }

    raf = requestAnimationFrame(tick);
};
tick();

/* ========= HMR Cleanup ========= */
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);

        // 明示解放
        try { worldSceneTR.dispose?.(); } catch {}
        for (const bg of bgScenes) { try { bg.dispose?.(); } catch {} }
        for (const sk of sketchLayers) { try { (sk as any).dispose?.(); } catch {} }
    });
}