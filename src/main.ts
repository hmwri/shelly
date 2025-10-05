// src/main.ts
import { BackgroundScene, WorldScene } from "./scene";
import { SketchCanvas } from "./canvas";
import {MiniGridController} from "./grid.ts";

const range = document.getElementById("lineWidthRange") as HTMLInputElement | null;
function setupLineWidthUI() {

    if (!range) return;

    const emit = (value: number) => {
        window.dispatchEvent(
            new CustomEvent("ui:setLineWidth", { detail: { value } })
        );
    };

    // 初期値を通知
    emit(Number(range.value));

    // 入力のたびに通知（ドラッグ中も反映）
    range.addEventListener("input", () => {
        emit(Number(range.value));
    });

    // 変更確定時にもう一度通知（必要なら）
    range.addEventListener("change", () => {
        emit(Number(range.value));
    });
}

setupLineWidthUI();


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
    const sketch = new SketchCanvas(sk);
    sketch.strokeWeight = Number(range?.value);
    const bg = new BackgroundScene(gl, worldSceneTR, p.axis, sketch);

    console.log(sketch.strokeWeight)
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
        // for (const sk of sketchLayers) sk.update(dt);

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




