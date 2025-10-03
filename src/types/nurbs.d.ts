// src/types/nurbs.d.ts
declare module "nurbs" {
    export type NDArrayLike = {
        data: ArrayLike<number>;
        shape: number[];
        stride?: number[];
        offset?: number;
        get?: (...idx: number[]) => number;
        set?: (...args: number[]) => void;
    };

    export type NurbsInput = {
        points?: number[][] | number[][][] | NDArrayLike;
        weights?: number[] | number[][] | NDArrayLike;
        knots?: number[][];                 // 各次元のノット
        boundary?: "open" | "clamped" | "closed" | [string, string];
        degree?: number | number[];
        size?: number[];                    // pointsが未定義ならサイズ指定も可
    };

    export interface NurbsObject {
        domain: [number, number][];
        size: number[];
        dimension: number;                  // 座標次元
        splineDimension: number;            // パラメータ次元（曲線=1, 曲面=2）
        evaluate(out: number[], ...t: number[]): number[];
        evaluator(derivativeOrders?: number | number[], isBasis?: boolean):
            (out: number[] | null, ...args: number[]) => number[] | number;
        support(out: number[], ...t: number[]): number[];
        transform(m: number[] | Float32Array): void;
        (input: NurbsInput): void;          // 既存インスタンスの再初期化
    }

    export default function nurbs(input: NurbsInput): NurbsObject;
}


export type ModeType = "NORMAL" | "EDITING"