import { CanvasBase } from "./canvasBase";
import { Vector2 } from "three";

export class SketchCanvas extends CanvasBase {
    private ctx: CanvasRenderingContext2D;
    strokeWeight = 1;

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        this.ctx = this.canvas.getContext("2d")!;
    }

    startStroke() {
        this.ctx.clearRect(0, 0, this.w, this.h);
    }

    updateStroke(points: Vector2[]) {
        this.redraw(points, "red");
    }

    finishStroke(points: Vector2[]) {
        this.redraw(points, "green", true);
    }

    private redraw(points: Vector2[], color: string, thin:boolean = false) {
        this.ctx.lineWidth = thin ? 2: this.strokeWeight
        this.ctx.clearRect(0, 0, this.w, this.h);
        if (points.length === 0) return;

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let p of points) {
            this.ctx.lineTo(p.x, p.y);
        }
        this.ctx.strokeStyle = color;
        this.ctx.stroke();

        // 点を小さく描画（デバッグ用）
        for (let p of points) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
        }
    }

    // --- イベントは CanvasBase を継承しているが、SketchCanvas では使わない ---
    protected onPointerDown(_: PointerEvent): void {}
    protected onPointerUp(_: PointerEvent): void {}
    protected onPointerMove(_: PointerEvent): void {}
    protected onScroll(_: WheelEvent): void {}
}