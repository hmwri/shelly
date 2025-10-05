import { Scene } from "./type";
import type { WorldScene } from "./worldScene";
import { Camera, OrthographicCamera, Vector2, Vector3 } from "three";
import * as THREE from "three";

import { NurbsCurve, NurbsSurface } from "../curve";
import { makeClampedUniformKnots } from "../utils/nurbs";
import { NurbsSurfaceObject } from "../object/NurbsSurfaceObject";
import { fitBSprain } from "../utils/fitBSprain";
import { SketchCanvas } from "../canvas";
import {resampleByCount} from "../utils";


type direction = "xy" | "xz" | "yz";

const directionToCameraVec: Record<direction, Vector3> = {
    "xy": new THREE.Vector3(0, 0, 1),
    "xz": new THREE.Vector3(0, 1, 0),
    "yz": new THREE.Vector3(1, 0, 0),
};

export class BackgroundScene extends Scene {
    camera: OrthographicCamera;
    plane: THREE.Plane;
    cameraVec: Vector3;
    worldScene: WorldScene;
    frustumSize: number = 10;
    direction: direction;
    private isPanning = false;
    private panStartNDC: Vector2 | null = null;
    private panStartWorld: Vector3 | null = null;

    sketchCanvas: SketchCanvas;
    private isDrawing: boolean = false;
    private currentPoints: Vector2[] = [];
    isHandDragging: boolean = false;
    handDragInitialPos: Vector2 = new Vector2();

    constructor(
        canvas: HTMLCanvasElement,
        worldScene: WorldScene,
        direction: direction,
        sketchCanvas: SketchCanvas
    ) {
        super(canvas);

        this.THREEscene = worldScene.THREEscene;
        this.camera = new OrthographicCamera();
        this.cameraVec = directionToCameraVec[direction].clone();
        this.camera.position.copy(this.cameraVec.clone().multiplyScalar(20));

        this.direction = direction;
        // 向きごとのカメラ設定
        if (direction === "xy") {
            this.camera.up.set(0, 1, 0);
        } else if (direction === "xz") {
            this.camera.up.set(0, 0, -1);
        } else {
            this.camera.up.set(0, 1, 0); // "yz"
        }

        this.plane = new THREE.Plane(this.cameraVec, 0);
        this.worldScene = worldScene;
        this.sketchCanvas = sketchCanvas;

        this.camera.lookAt(new Vector3(0, 0, 0));
        this.camera.layers.disable(1);
        this.onResize();
        const testCurve = new NurbsCurve(
            [
                [-0.37266988105283194, 0.07239073023432538],
                [-0.30510814013626075, 0.1784123012410865],
                [-0.1875320369433661, 0.29546421945732676],
                [-0.08551398016300955, 0.7313507701210126],
                [0.2353314450791319, 0.7008650926044424],
                [0.3264529372982839, 0.2851606597220622],
                [0.3858515624712898, 0.1315747433540553],
                [0.5154323150224216, 0.11756760546524048]
            ],
            3,
            [0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1]
        );

        window.addEventListener("ui:setLineWidth", (ev: Event) => {
            const value = (ev as CustomEvent<{ value: number }>).detail.value;
            this.sketchCanvas.strokeWeight = value
            console.log(this.sketchCanvas.strokeWeight)
        })
        this.camera.position.y += 3

        this.updateCamera()
        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    }

    render() {
        const originalColor = this.THREEscene.background;
        this.THREEscene.background = new THREE.Color(255, 255, 255);
        this.worldScene.showDoubleSide(true);

        super.render();

        this.THREEscene.background = originalColor;
        this.worldScene.showDoubleSide(false);
    }

    // --- イベント処理 ---
    protected onPointerDown(e: PointerEvent): void {
        this.currentPoints = [];
        if(this.worldScene.mode == "NORMAL") {
            this.isDrawing = true;
            this.sketchCanvas.startStroke();
        }else if(this.worldScene.mode == "EDITING" && this.worldScene.selectingObject){
            if(this.worldScene.selectingObject.isHelperSelected()){
                this.isDrawing = true;
                this.sketchCanvas.startStroke();
            }else if(this.isIntersect(this.eventPosToNDC(e), this.worldScene.selectingObject)){
                this.isHandDragging = true;
                this.handDragInitialPos = this.eventPosToNDC(e)
                this.worldScene.selectingObject.onMoveStart()

            }


        }else{

        }

    }

    protected onPointerMove(e: PointerEvent): void {

        if(this.isDrawing) {
            const pos = this.eventPosToNDC(e);
            this.currentPoints.push(pos);
            this.sketchCanvas.updateStroke(this.currentPoints.map(p => this.NDCToCanvasPos(p)));

        }else if(this.isHandDragging) {
            const initial = this.intersectPlane(this.handDragInitialPos, this.plane)
            const now = this.intersectPlane(this.eventPosToNDC(e), this.plane)
            if(initial && now)
            this.worldScene.selectingObject?.onMove(initial.sub(now))
        }
        // 任意の音声ファイルを再生

   }



    protected onPointerUp(e: PointerEvent): void {
        this.isDrawing = false;
        this.isHandDragging = false;
        if (this.currentPoints.length < 10) return;
        const resampled = resampleByCount(this.currentPoints, 100);



        // --- Bスプライン近似 ---

        const curve = fitBSprain(resampled, 3, 7);

        if(this.worldScene.mode == "EDITING") {
            this.worldScene.selectingObject?.sketchModify(
                this,
                resampled
            )
        } else{
            this.addSketch(curve);
        }
        const sound = new Audio("anime.mp3");
        sound.play();

        // 3Dシーンに追加

        this.sketchCanvas.finishStroke(curve.points.map(p => this.NDCToCanvasPos(p)));
    }

    addTestLine(){
        const testCurve = new NurbsCurve(
            [
                [-0.37266988105283194, 0.07239073023432538],
                [-0.30510814013626075, 0.1784123012410865],
                [-0.1875320369433661, 0.29546421945732676],
                [-0.08551398016300955, 0.7313507701210126],
                [0.2353314450791319, 0.7008650926044424],
                [0.3264529372982839, 0.2851606597220622],
                [0.3858515624712898, 0.1315747433540553],
                [0.5154323150224216, 0.11756760546524048]
            ],
            3,
            [0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 1, 1, 1, 1]
        );


        if(this.direction === "xy") {
            this.addSketch(testCurve);
        }
    }

    protected onScroll(e: WheelEvent): void {
        this.frustumSize += e.deltaY * 0.01;
        this.updateCamera();
    }

    // --- NURBS Surface 生成 ---
    addSketch(curve: NurbsCurve): void {
        console.log(curve);
        const projectedP = curve.points.map((xy) => {
            const p = this.intersectPlane(xy, this.plane);
            if (p == null) throw new Error("Unknown plane");
            return p;
        });

        const PN = 7;
        let points: Vector3[][] = [];
        for (let i = 0; i < PN; i++) {
            points.push(
                projectedP.map((v) =>
                    v?.clone().add(this.cameraVec.clone().multiplyScalar(i - PN / 2))
                )
            );
        }

        const uDegree = 3;
        const surface = new NurbsSurface(
            points,
            [uDegree, curve.degree],
            [makeClampedUniformKnots(PN, uDegree), curve.knot]
        );

        const obj = this.worldScene.addObject(
            new NurbsSurfaceObject(surface, this.worldScene, this.sketchCanvas.strokeWeight * (this.camera.right - this.camera.left) / this.canvas.clientWidth)
        );

        this.worldScene.selectObject(obj);
        this.worldScene.setMode("EDITING");
    }

    protected onRightPointerDown(e: PointerEvent): void {
        this.isPanning = true;

        this.panStartNDC = this.eventPosToNDC(e);
        this.panStartWorld = this.intersectPlane(this.panStartNDC, this.plane);

        // ドラッグ中にポインタが外れても追従できるように
        this.canvas.setPointerCapture?.(e.pointerId);
    }

    // 右ドラッグ中：開始点と現在点の平面上の差分だけカメラを移動
    protected onRightPointerMove(e: PointerEvent): void {
        if (!this.isPanning) return;


        console.log("here")

        const nowNDC = this.eventPosToNDC(e);
        const nowWorld = this.intersectPlane(nowNDC, this.plane);
        if (!this.panStartWorld || !nowWorld) return;

        // 画面上で同じ点を掴んで動かす感じにするには initial - now
        const delta = this.panStartWorld.clone().sub(nowWorld);

        // オルソ視点：位置だけ平行移動。向き（回転）は固定のまま
        this.camera.position.add(delta);
        this.camera.updateMatrixWorld(); // 念のため更新
    }

    // 右クリック離し：状態リセット
    protected onRightPointerUp(e: PointerEvent): void {
        if (!this.isPanning) return;
        this.isPanning = false;
        this.panStartNDC = null;
        this.panStartWorld = null;
        this.canvas.releasePointerCapture?.(e.pointerId);
    }

    // --- カメラ操作 ---
    updateCamera() {

        const frustumSize = this.frustumSize;
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.left = (-frustumSize * aspect) / 2;
        this.camera.right = (frustumSize * aspect) / 2;
        this.camera.top = frustumSize / 2 ;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();
    }



    onResize() {
        super.onResize();
        this.updateCamera();
    }
}