import {Vector2} from "three";

export class CanvasBase {
    w:number = 0;
    h:number = 0;
    dpr:number = 0
    canvas:HTMLCanvasElement

    private downPos: {x: number, y: number} | null = null
    private downTime: number = 0
    private clickThreshold = 5   // px
    private timeThreshold = 300


    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.canvas.parentElement!.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        this.w = w * this.dpr;
        this.h = h * this.dpr;



        canvas.addEventListener("pointerdown", (event) => this._handlePointerDown(event));
        canvas.addEventListener("pointerup",   (event) => this._handlePointerUp(event));
        canvas.addEventListener("pointermove", (event) => this._handlePointerMove(event));
        canvas.addEventListener("wheel", (event) => this.onScroll(event));

    }

    private _handlePointerDown(event: PointerEvent) {
        this.downPos = { x: event.clientX, y: event.clientY }
        this.downTime = performance.now()
        this.onPointerDown(event)
    }

    private _handlePointerUp(event: PointerEvent) {
        if (this.downPos) {
            const dx = event.clientX - this.downPos.x
            const dy = event.clientY - this.downPos.y
            const dist = Math.sqrt(dx*dx + dy*dy)
            const dt = performance.now() - this.downTime

            if (dist < this.clickThreshold && dt < this.timeThreshold) {
                this.onPointerClicked(event)
            }
        }
        this.downPos = null
        this.onPointerUp(event)
    }

    private _handlePointerMove(event: PointerEvent) {
        this.onPointerMove(event)
    }



    // --- 子クラスで override する用の "on" 系メソッド ---
    protected onPointerDown(_: PointerEvent): void {}
    protected onPointerUp(_: PointerEvent): void {}
    protected onPointerMove(_: PointerEvent): void {}
    protected onPointerClicked(_: PointerEvent): void {}
    protected onScroll(_: WheelEvent): void {}


    onResize() {
        const rect = this.canvas.parentElement!.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const canvas = this.canvas
        canvas.width = Math.floor(w * this.dpr);
        canvas.height = Math.floor(h * this.dpr);
        (canvas.style as any).width = w + 'px';
        (canvas.style as any).height = h + 'px';
        this.w = w * this.dpr;
        this.h = h * this.dpr;
    }

    eventPosToCanvasPos(e: PointerEvent) {
        const rect = this.canvas.getBoundingClientRect()// 要素の位置とサイズ
        const x = (e.clientX - rect.left) * this.dpr; // 要素内でのX
        const y = (e.clientY - rect.top ) * this.dpr;
        return new Vector2(x, y);
    }


    canvasPosToNDC(pos: Vector2): Vector2;
    canvasPosToNDC(pos: [number, number]　| number[]): [number, number];
    canvasPosToNDC(pos: Vector2 | [number, number] |number[]) {
        const x = (Array.isArray(pos) ? pos[0] : pos.x) / this.w;
        const y = (Array.isArray(pos) ? pos[1] : pos.y) / this.h;
        const ndcX = x * 2 - 1;
        const ndcY = -(y * 2 - 1);
        return Array.isArray(pos) ? [ndcX, ndcY] : new Vector2(ndcX, ndcY);
    }

    // ---- overload signatures ----
    NDCToCanvasPos(ndc: Vector2): Vector2;
    NDCToCanvasPos(ndc: [number, number]| number[]): [number, number];
    NDCToCanvasPos(ndc: Vector2 | [number, number]|number[]) {
        const nx = Array.isArray(ndc) ? ndc[0] : ndc.x;
        const ny = Array.isArray(ndc) ? ndc[1] : ndc.y;
        const x = (nx + 1) / 2 * this.w;
        const y = (-(ny) + 1) / 2 * this.h;
        return Array.isArray(ndc) ? [x, y] : new Vector2(x, y);
    }

    eventPosToNDC(e: PointerEvent) {
        return this.canvasPosToNDC(this.eventPosToCanvasPos(e))
    }
}