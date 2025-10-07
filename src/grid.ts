export type GridParams = {
    vLine: number; // 縦線太さ（右方向に増える）
    hLine: number; // 横線太さ（下方向に増える）
    cellW: number; // 四角の幅（右方向）
    cellH: number; // 四角の高さ（下方向）
};

type Drag =
    | { kind: "vArrow"; sx: number; start: number }
    | { kind: "hArrow"; sy: number; start: number }
    | { kind: "corner"; sx: number; sy: number; startW: number; startH: number };

type GridMode = "both" | "verticalOnly" | "horizontalOnly";

export class MiniGridController {
    private svg: SVGSVGElement;
    private vLine!: SVGRectElement;
    private hLine!: SVGRectElement;
    private vArrow!: SVGGElement;
    private hArrow!: SVGGElement;
    private cell!: SVGRectElement;
    private corner!: SVGCircleElement;
    private fVL!: SVGRectElement;
    private fVR!: SVGRectElement;
    private fHT!: SVGRectElement;
    private fHB!: SVGRectElement;
    private info?: HTMLElement | null;

    private onSend?: (params: GridParams) => void;

    // フレーム
    private readonly fX = 6;
    private readonly fY = 6;
    private readonly fW = 138;
    private readonly fH = 98;

    // 交点（左上寄り・比率指定）
    private cornerX: number;
    private cornerY: number;

    // 値と制約
    private p: GridParams = { vLine: 10, hLine: 10, cellW: 60, cellH: 40 };
    private readonly lim = { vMin: 1, vMax: 64, hMin: 1, hMax: 64 };
    private readonly fineT = 0.6; // 太さ感度
    private readonly fineC = 1.0; // セル感度

    private drag: Drag | null = null;

    // ★追加: モード（both / verticalOnly / horizontalOnly）
    private mode: GridMode = "both";

    private moveHandler = (e: PointerEvent) => this.onPointerMove(e);
    private upHandler = (e: PointerEvent) => this.onPointerUp(e);

    constructor(svg: SVGSVGElement, onSend?: (params: GridParams) => void, cornerRatio = 0.25) {
        this.svg = svg;
        this.onSend = onSend;
        this.cornerX = Math.round(this.fX + this.fW * cornerRatio);
        this.cornerY = Math.round(this.fY + this.fH * cornerRatio);

        // 要素取得
        this.vLine  = this.reqEl<SVGRectElement>("#vLineTR");
        this.hLine  = this.reqEl<SVGRectElement>("#hLineTR");
        this.vArrow = this.reqEl<SVGGElement>("#vArrowTR");
        this.hArrow = this.reqEl<SVGGElement>("#hArrowTR");
        this.cell   = this.reqEl<SVGRectElement>("#cellTR");
        this.corner = this.reqEl<SVGCircleElement>("#cornerKnobTR");
        this.fVL    = this.reqEl<SVGRectElement>("#frameVLeftTR");
        this.fVR    = this.reqEl<SVGRectElement>("#frameVRightTR");
        this.fHT    = this.reqEl<SVGRectElement>("#frameHTopTR");
        this.fHB    = this.reqEl<SVGRectElement>("#frameHBotTR");
        this.info   = document.getElementById("miniGridInfoTR");

        // 初期はチラつき防止（CSSで [data-mini-grid]{visibility:hidden} にしておく）
        this.svg.setAttribute("data-mini-grid", "");

        // イベント
        this.vArrow.addEventListener("pointerdown", (e) => this.onVArrowDown(e));
        this.hArrow.addEventListener("pointerdown", (e) => this.onHArrowDown(e));
        this.corner.addEventListener("pointerdown", (e) => this.onCornerDown(e));
        this.svg.addEventListener("pointermove", this.moveHandler);
        this.svg.addEventListener("pointerup", this.upHandler);
        this.svg.addEventListener("pointercancel", this.upHandler);

        this.render(true);
    }

    // ===== 公開API =====
    getParams(): GridParams { return { ...this.p }; }
    setParams(next: Partial<GridParams>) {
        this.p = { ...this.p, ...next };
        this.render();
        // if (notify) this.emit();
    }

    /** 交点の寄せ具合（0.05〜0.9） */
    setCornerRatio(r: number) {
        const ratio = Math.min(0.9, Math.max(0.05, r));
        this.cornerX = Math.round(this.fX + this.fW * ratio);
        this.cornerY = Math.round(this.fY + this.fH * ratio);
        this.render();
    }

    /** ★追加：モード切替（"both" | "verticalOnly" | "horizontalOnly"） */
    setMode(mode: GridMode) {
        if(this.mode !== mode) {
            this.mode = mode;
            this.render()
        }

    }
    getMode(): GridMode { return this.mode; }

    destroy() {
        this.svg.removeEventListener("pointermove", this.moveHandler);
        this.svg.removeEventListener("pointerup", this.upHandler);
        this.svg.removeEventListener("pointercancel", this.upHandler);
    }

    // ===== 内部処理 =====
    private reqEl<T extends Element>(sel: string): T {
        const el = this.svg.querySelector(sel) as T | null;
        if (!el) throw new Error(`MiniGridController: missing element ${sel}`);
        return el;
    }
    private clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }
    private setAttr(el: Element, k: string, v: number | string) { el.setAttribute(k, String(v)); }
    private show(el: Element, on: boolean) { (el as any).style.display = on ? "" : "none"; }

    private render(first = false) {
        // 主線
        const vX = this.cornerX, vY = this.fY + 8, vH = this.fH - 16;
        this.setAttr(this.vLine, "x", vX);
        this.setAttr(this.vLine, "y", vY);
        this.setAttr(this.vLine, "width",  this.p.vLine);
        this.setAttr(this.vLine, "height", vH);

        const hX = this.fX + 8, hW = this.fW - 16, hY = this.cornerY;
        this.setAttr(this.hLine, "x", hX);
        this.setAttr(this.hLine, "y", hY);
        this.setAttr(this.hLine, "width",  hW);
        this.setAttr(this.hLine, "height", this.p.hLine);

        // 矢印は主線の中心線に（サブピクセル抑制）
        const vCenterX = Math.round(vX + this.p.vLine / 2);
        const vCenterY = Math.round(vY + vH / 2);
        this.setAttr(this.vArrow, "transform", `translate(${vCenterX}, ${vCenterY})`);

        const hCenterX = Math.round(hX + hW / 2);
        const hCenterY = Math.round(hY + this.p.hLine / 2);
        this.setAttr(this.hArrow, "transform", `translate(${hCenterX}, ${hCenterY})`);

        // 最前面へ
        this.svg.appendChild(this.vArrow);
        this.svg.appendChild(this.hArrow);

        // セルと囲い線（常に内部基準から）
        const cellX0 = this.cornerX + this.p.vLine;
        const cellY0 = this.cornerY + this.p.hLine;
        const cellWMax = (this.fX + this.fW - 6) - cellX0;
        const cellHMax = (this.fY + this.fH - 6) - cellY0;

        // モードに応じて更新/抑制
        if (this.mode !== "horizontalOnly") {
            this.p.cellW = this.clamp(this.p.cellW, 8, Math.max(8, cellWMax));
        }
        if (this.mode !== "verticalOnly") {
            this.p.cellH = this.clamp(this.p.cellH, 8, Math.max(8, cellHMax));
        }

        // 角ノブの可視/不可視（横Onlyでは縦方向のみ効くが、UIは見せたままにする）
        this.setAttr(this.cell, "x", cellX0);
        this.setAttr(this.cell, "y", cellY0);
        this.setAttr(this.cell, "width",  this.p.cellW);
        this.setAttr(this.cell, "height", this.p.cellH);
        this.setAttr(this.corner, "cx", Math.round(cellX0 + this.p.cellW));
        this.setAttr(this.corner, "cy", Math.round(cellY0 + this.p.cellH));

        // 囲い線（主線と同太さ）
        const vT = this.p.vLine, hT = this.p.hLine;
        this.setAttr(this.fVL, "x", cellX0 - vT);
        this.setAttr(this.fVL, "y", cellY0);
        this.setAttr(this.fVL, "width", vT);
        this.setAttr(this.fVL, "height", this.p.cellH);

        this.setAttr(this.fVR, "x", cellX0 + this.p.cellW);
        this.setAttr(this.fVR, "y", cellY0);
        this.setAttr(this.fVR, "width", vT);
        this.setAttr(this.fVR, "height", this.p.cellH);

        this.setAttr(this.fHT, "x", cellX0 - vT);
        this.setAttr(this.fHT, "y", cellY0 - hT);
        this.setAttr(this.fHT, "width", this.p.cellW + vT * 2);
        this.setAttr(this.fHT, "height", hT);

        this.setAttr(this.fHB, "x", cellX0 - vT);
        this.setAttr(this.fHB, "y", cellY0 + this.p.cellH);
        this.setAttr(this.fHB, "width", this.p.cellW + vT * 2);
        this.setAttr(this.fHB, "height", hT);

// === 線と矢印・囲い線の表示切替 ===
        if (this.mode === "verticalOnly") {
            // 縦方向のみ
            this.show(this.vLine, true);
            this.show(this.vArrow, true);
            this.show(this.hLine, false);
            this.show(this.hArrow, false);

            this.show(this.fVL, true);
            this.show(this.fVR, true);
            this.show(this.fHT, false);
            this.show(this.fHB, false);
        } else if (this.mode === "horizontalOnly") {
            // 横方向のみ
            this.show(this.vLine, false);
            this.show(this.vArrow, false);
            this.show(this.hLine, true);
            this.show(this.hArrow, true);

            this.show(this.fVL, false);
            this.show(this.fVR, false);
            this.show(this.fHT, true);
            this.show(this.fHB, true);
        } else {
            // 両方
            this.show(this.vLine, true);
            this.show(this.vArrow, true);
            this.show(this.hLine, true);
            this.show(this.hArrow, true);

            this.show(this.fVL, true);
            this.show(this.fVR, true);
            this.show(this.fHT, true);
            this.show(this.fHB, true);
        }

        // 情報テキスト
        if (this.info) {
            const base = `V:${this.p.vLine} H:${this.p.hLine}`;
            const box  = ` W:${this.p.cellW} H:${this.p.cellH}`;
            this.info.textContent = base + (this.mode === "both" ? box
                : this.mode === "verticalOnly" ? ` W:${this.p.cellW}`
                    : ` H:${this.p.cellH}`);
        }

        if (first) (this.svg as any).style.visibility = "visible";

    }

    private emit() {
        this.onSend?.({ ...this.p });
    }

    private getMouse(evt: PointerEvent) {
        const pt = this.svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
        const m = this.svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
        const p = pt.matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
    }

    private onVArrowDown(e: PointerEvent) {
        if (this.mode === "horizontalOnly") return; // 横専用時は無効
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        this.drag = { kind: "vArrow", sx: this.getMouse(e).x, start: this.p.vLine };
    }

    private onHArrowDown(e: PointerEvent) {
        if (this.mode === "verticalOnly") return; // 縦専用時は無効
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        this.drag = { kind: "hArrow", sy: this.getMouse(e).y, start: this.p.hLine };
    }

    private onCornerDown(e: PointerEvent) {
        // 角ノブは常に表示だが、モードにより移動方向を制限
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        const { x, y } = this.getMouse(e);
        this.drag = { kind: "corner", sx: x, sy: y, startW: this.p.cellW, startH: this.p.cellH };
    }

    setVisible(on: boolean) {
        // SVG そのものを隠す（親が .mini-grid-ui の div の場合はどちらでもOK）
        const host = (this.svg.parentElement as HTMLElement) ?? (this.svg as unknown as HTMLElement);
        host.style.display = on ? "" : "none";
    }


    private onPointerMove(e: PointerEvent) {
        if (!this.drag) return;
        if (this.drag.kind === "vArrow") {
            const dx = this.getMouse(e).x - this.drag.sx;
            this.p.vLine = this.clamp(Math.round(this.drag.start + dx * this.fineT), this.lim.vMin, this.lim.vMax);
            this.render();
        } else if (this.drag.kind === "hArrow") {
            const dy = this.getMouse(e).y - this.drag.sy;
            this.p.hLine = this.clamp(Math.round(this.drag.start + dy * this.fineT), this.lim.hMin, this.lim.hMax);
            this.render();
        } else {
            const { x, y } = this.getMouse(e);
            const baseX = this.cornerX + this.p.vLine;
            const baseY = this.cornerY + this.p.hLine;
            const maxW = (this.fX + this.fW - 6) - baseX;
            const maxH = (this.fY + this.fH - 6) - baseY;

            if (this.mode === "verticalOnly") {
                // 横方向のみ（幅だけ）更新
                this.p.cellW = this.clamp(Math.round(this.drag.startW + (x - this.drag.sx) * this.fineC), 8, Math.max(8, maxW));
            } else if (this.mode === "horizontalOnly") {
                // 縦方向のみ（高さだけ）更新
                this.p.cellH = this.clamp(Math.round(this.drag.startH + (y - this.drag.sy) * this.fineC), 8, Math.max(8, maxH));
            } else {
                // 両方
                this.p.cellW = this.clamp(Math.round(this.drag.startW + (x - this.drag.sx) * this.fineC), 8, Math.max(8, maxW));
                this.p.cellH = this.clamp(Math.round(this.drag.startH + (y - this.drag.sy) * this.fineC), 8, Math.max(8, maxH));
            }
            this.render();

        }
    }

    private onPointerUp(e: PointerEvent) {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
        this.emit();
        this.drag = null;
    }
}