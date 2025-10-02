import {Vector2, Vector3} from "three";
import {resampleByCount} from "../utils";
import {fitBSprain} from "../utils/fitBSprain.ts";
import {linspace, numberListToVec2List} from "../utils/common.ts";
import {CanvasBase} from "./canvasBase.ts";

import {BackgroundScene, WorldScene} from "../scene";

export class SketchCanvas extends CanvasBase{
    points:Array<Vector2> = new Array<Vector2>();
    ctx:CanvasRenderingContext2D
    isDrawing:boolean = false;
    isMoving:boolean = true;
    cursorPos: Vector2 = new Vector2();
    backScene:BackgroundScene
    worldScene:WorldScene

    constructor(canvas:HTMLCanvasElement, backScene:BackgroundScene) {
        super(canvas);
        this.ctx = this.canvas.getContext("2d")!
        this.ctx.strokeStyle = "red";
        this.backScene = backScene;

        this.worldScene = backScene.worldScene;

        this.onResize()

    }

    onPointerDown(_: PointerEvent) {
        this.points = []
        this.redraw()
        console.log("redraw")
        this.isDrawing = true;
    }

    onPointerUp(_: PointerEvent) {

        this.isDrawing = false;
        if(this.points.length < 10) {
            return
        }
        this.points = resampleByCount(this.points, 100)
        this.redraw()
        const curve= fitBSprain(this.points, 3, 8)
        let points : Vector2[] = [];

        curve.sampleN(100, (xy) => {
            points.push(xy)
        })

        this.points = points;

        this.backScene.addSketch(curve)

        this.redraw()
        for (let p of curve.points) {
            p = this.NDCToCanvasPos(p)
            this.ctx.fillStyle = "green"
            this.ctx.fillRect(p.x, p.y, 10,10)
        }
    }


    onPointerMove(e: PointerEvent) {
        this.isMoving = true;
        this.cursorPos = this.eventPosToCanvasPos(e)
    }




    redraw() {

        this.ctx.clearRect(0,0,this.w, this.h)

        if(this.points.length >= 1) {

            this.ctx.moveTo(this.points[0].x, this.points[0].y)
            this.ctx.beginPath()
            this.points.forEach(
                (p) => {
                     p = this.NDCToCanvasPos(p);
                        this.ctx.lineTo(p.x, p.y)

                }
            )
            this.ctx.stroke()

            this.points.forEach(
                (p) => {
                    p = this.NDCToCanvasPos(p)
                    this.ctx.fillStyle = "red"
                    this.ctx.fillRect(p.x, p.y, 2,2)
                }
            )
        }

    }





    onResize() {
        super.onResize();
        this.redraw()
    }

    update(dt:number) {
        if(this.isDrawing && this.isMoving) {
            this.isDrawing = true;


            let x = this.cursorPos.x;
            let y = this.cursorPos.y;

            const len = this.points.length// 要素内でのY
            if(len == 1) {
                this.ctx.beginPath()
                this.ctx.lineWidth = 40;
                this.ctx.moveTo(x, y)
            }

            if(this.points.length >= 1) {

                this.ctx.lineTo(x ,y )
                this.ctx.stroke()
            }


            this.points.push(this.canvasPosToNDC(this.cursorPos))


        }
    }
}