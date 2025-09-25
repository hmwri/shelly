
import {BackgroundScene, WorldScene} from "./scene";
import {SketchCanvas} from "./canvas";
const worldCanvas = document.getElementById("glRightCanvas") as HTMLCanvasElement
const sketchCV = document.getElementById("sketchCanvas") as HTMLCanvasElement
const backgroundCanvas = document.getElementById("glLeftCanvas") as HTMLCanvasElement


const worldScene = new WorldScene(worldCanvas);
const sketchBGScene = new BackgroundScene(backgroundCanvas, worldScene);
const sketchCanvas = new SketchCanvas(sketchCV, sketchBGScene)



const onResize = () => {
    worldScene.onResize()
    sketchBGScene.onResize()
    sketchCanvas.onResize()
};

onResize();

let raf = 0;
let last = performance.now();
const FPS = 60.0;
function tick() {
    const now = performance.now();
    const dt = (now - last) / 1000;
    if(dt >= 1/ FPS) {
        worldScene.render();
        sketchBGScene.render();
        sketchCanvas.update(dt)

        last = now;

    }
    raf = requestAnimationFrame(tick);



    // cube.rotation.x += 0.7 * dt;
    // cube.rotation.y += 1.0 * dt;



}
tick();
window.addEventListener("resize", () => {
    onResize()

})

// Hot Module Replacement時の破棄（型付き）
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        worldScene.dispose()
        // cube.geometry.dispose();
        // cube.material.dispose();
    });
}