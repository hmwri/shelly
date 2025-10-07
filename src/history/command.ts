// commands.ts


import type {NurbsSurfaceObject} from "../object/NurbsSurfaceObject.ts";
import type {NurbsSurface} from "../curve";
import type {CornerKey} from "../model/NurbsSurfaceModel.ts";



export class SetControlPointsCommand {
    private target: NurbsSurfaceObject;
    private oldSurface: NurbsSurface;
    private surface: NurbsSurface;

    constructor(opts: {
        target: NurbsSurfaceObject;
        oldSurface: NurbsSurface;
        surface: NurbsSurface;
    }) {
        this.target = opts.target;
        this.oldSurface = opts.oldSurface.clone();
        this.surface = opts.surface.clone();
    }

    private apply(surface: NurbsSurface) {
        // surface -> geometry を再生成（LineHelperも貼り直し）
        this.target.updateGeometry(
            surface.clone()
        );

    }

    do()   { this.apply(this.surface); }
    undo() { this.apply(this.oldSurface); this.target.view.clearSuggestions();}


}

export class SetThicknessCommand {
    private target: NurbsSurfaceObject;
    private corner: CornerKey;
    private oldThickness: number;
    private thickness: number;

    constructor(opts: {
        target: NurbsSurfaceObject;
        corner: CornerKey;
        oldThickness: number;
        thickness: number;
    }) {
        this.target = opts.target;
        this.corner = opts.corner;
        this.oldThickness = opts.oldThickness;
        this.thickness = opts.thickness;
    }

    private apply(thickness: number) {
        // cornerごとの厚みを設定する関数がある前提
        this.target.model.setCornerThickness(this.corner, thickness);
        this.target.updateGeometry();
    }

    do() {
        this.apply(this.thickness);
    }

    undo() {
        this.apply(this.oldThickness);
    }



}


// 補間用のユーティリティ（必要なら別ファイル utils へ）
export function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

// ガンマ/スムースステップ等で u,v の進行を調整したい場合に使う
export type Easing = "linear" | "smoothstep" | { gammaU?: number; gammaV?: number };
export function ease01(t: number, easing: Easing, axis: "u" | "v"): number {
    if (easing === "linear") return t;
    if (easing === "smoothstep") return t * t * (3 - 2 * t);
    const g = axis === "u" ? (easing.gammaU ?? 1) : (easing.gammaV ?? 1);
    return g === 1 ? t : Math.pow(t, g);
}

// 4隅の厚みから (u,v) 位置の厚みを双一次補間
export function weightedCenterIndex(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) return NaN; // 全要素が0なら中心は定義できない
    const weightedSum = weights.reduce((sum, w, i) => sum + i * w, 0);
    return weightedSum / total;
}


export function linearWeights(length: number, center: number): number[] {
    const arr = new Array(length);
    const leftDist = center;                // 左端までの距離
    const rightDist = length - 1 - center;  // 右端までの距離
    const maxDist = Math.max(leftDist, rightDist); // 正規化用

    for (let i = 0; i < length; i++) {
        const dist = Math.abs(i - center);
        // 線形に 1→0 へ
        const w = Math.max(0, 1 - dist / maxDist);
        arr[i] = w;
    }

    return arr;
}


/**
 * 交互の 0/1 ランを作るマスクを生成する。
 * 1 で始まり、必ず 0 で終わる。
 *
 * L       : 配列長（>=2 推奨）
 * zStart  : 0ラン長の開始値（>=1）
 * zEnd    : 0ラン長の終了値（>=1）
 * oStart  : 1ラン長の開始値（>=1）
 * oEnd    : 1ラン長の終了値（>=1）
 */
export function generateMask(
    L: number,
    zStart: number, zEnd: number,
    oStart: number, oEnd: number
): number[] {
    if (L <= 0) return [];
    if (L === 1) return [0]; // 「最後が0」を満たす最小ケース

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const toLen = (x: number) => Math.max(1, Math.round(x));

    const out: number[] = [];
    let cur = 1; // ← 1から開始に変更！

    while (out.length < L) {
        const p = out.length / (L - 1); // 0→1 へ進行
        const runLen = cur === 0
            ? toLen(lerp(zStart, zEnd, p))
            : toLen(lerp(oStart, oEnd, p));

        let n = Math.min(runLen, L - out.length);

        // 最後の1枠は必ず0にしたい
        if (cur === 1 && (L - out.length) === 1) {
            n = 0;
        }

        for (let i = 0; i < n; i++) out.push(cur);

        cur = 1 - cur as 0 | 1;

        if (out.length >= L) break;
    }

    // 終端保証：最後は0
    if (out[out.length - 1] !== 0) {
        out[out.length - 1] = 0;
    }

    return out;
}