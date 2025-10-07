import {type BufferGeometry, Mesh, MeshStandardMaterial, Scene, SphereGeometry, Vector2, Vector3} from "three";
import * as THREE from 'three';

type Vec = Vector2 | Vector3;

export function vecListTonumberList<T extends Vec[] | Vec[][]>(
    v: T
): T extends Vector2[] | Vector3[] ? number[][] : number[][][] {
    return v.map((p: any) => {
        if (Array.isArray(p)) {
            // p は Vector3[]
            return p.map((a: Vector3) => [a.x, a.y, a.z]);
        } else {
            if ("z" in p) {
                return [p.x, p.y, p.z];
            } else {
                return [p.x, p.y];
            }
        }
    }) as any;
}


export function numberListToVec2List(list: number[][]): Vector2[];
export function numberListToVec2List(list: number[][][]): Vector2[][];
export function numberListToVec2List(list: any): any {
    if (!Array.isArray(list)) {
        throw new Error("配列が必要です");
    }

    if (list.length === 0) return [];

    if (Array.isArray(list[0][0])) {
        // number[][][] → Vector2[][]
        return (list as number[][][]).map(inner =>
            inner.map(([x, y]) => {
                if (inner.length > 0 && inner[0].length !== 2) {
                    throw new Error("2次元配列が必要です");
                }
                return new Vector2(x, y);
            })
        );
    } else {
        // number[][] → Vector2[]
        if (!(list as number[][]).every(item => item.length === 2)) {
            throw new Error("2次元配列が必要です");
        }
        return (list as number[][]).map(([x, y]) => new Vector2(x, y));
    }
}

export function numberListToVec3List(list: number[][]): Vector3[];
export function numberListToVec3List(list: number[][][]): Vector3[][];
export function numberListToVec3List(list: any): any {
    if (!Array.isArray(list)) {
        throw new Error("配列が必要です");
    }

    if (list.length === 0) return [];

    if (Array.isArray(list[0][0])) {
        // number[][][] → Vector3[][]
        return (list as number[][][]).map(inner =>
            inner.map(([x, y, z]) => {
                if (inner.length > 0 && inner[0].length !== 3) {
                    throw new Error("3次元配列が必要です");
                }
                return new Vector3(x, y, z);
            })
        );
    } else {
        // number[][] → Vector3[]
        if (!(list as number[][]).every(item => item.length === 3)) {
            throw new Error("3次元配列が必要です");
        }
        return (list as number[][]).map(([x, y, z]) => new Vector3(x, y, z));
    }
}


// 単体ベクタの判定（ダックタイピング）
const isVec2 = (v: any): v is Vector2 =>
    v && typeof v.x === "number" && typeof v.y === "number" && !("z" in v);

const isVec3 = (v: any): v is Vector3 =>
    v && typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number";

// number[][] の判定
export const isNumber2D = (a: any): a is number[][] =>
    Array.isArray(a) &&
    a.every(
        row =>
            Array.isArray(row) && row.every(n => typeof n === "number")
    );

// number[][][] の判定
export const isNumber3D = (a: any): a is number[][][] =>
    Array.isArray(a) &&
    a.every(
        mat =>
            Array.isArray(mat) &&
            mat.every(
                row =>
                    Array.isArray(row) && row.every(n => typeof n === "number")
            )
    );

// Vector2[] の判定
export const isVector2Array = (a: any): a is Vector2[] =>
    Array.isArray(a) && a.every(isVec2);

// Vector3[] の判定
export const isVector3Array = (a: any): a is Vector3[] =>
    Array.isArray(a) && a.every(isVec3);

// Vector2[][] の判定
export const isVector2Matrix = (a: any): a is Vector2[][] =>
    Array.isArray(a) &&
    a.every(arr => Array.isArray(arr) && arr.every(isVec2));

// Vector3[][] の判定
export const isVector3Matrix = (a: any): a is Vector3[][] =>
    Array.isArray(a) &&
    a.every(arr => Array.isArray(arr) && arr.every(isVec3));


/**
 * Create an array of N evenly spaced values between start and end (inclusive).
 * @param start tMin
 * @param end tMax
 * @param N number of samples (>=2 recommended)
 * @returns number[]
 */
export function linspace(start: number, end: number, N: number): number[] {
    if (N < 2) {
        return [start]; // N=1 のときは start のみ
    }
    const step = (end - start) / (N - 1);
    return Array.from({ length: N }, (_, i) => start + step * i);
}


export function  debugSphere(scene: Scene, pos:Vector3) {
    const geometry = new SphereGeometry(0.1, 32, 16);
    const material = new MeshStandardMaterial({ color: 0x0077ff });
    const sphere = new Mesh(geometry, material);
    sphere.position.copy(pos);
    scene.add(sphere);
}


type TypedArray =
    Float32Array | Float64Array |
    Int32Array   | Int16Array   | Int8Array |
    Uint32Array  | Uint16Array  | Uint8Array |
    Uint8ClampedArray;

// 2つの TypedArray を結合
export function concatTypedArray<T extends TypedArray>(a: T, b: T): T {
    if (Object.getPrototypeOf(a).constructor !== Object.getPrototypeOf(b).constructor) {
        throw new Error("型が異なる TypedArray 同士は結合できません");
    }
    const result = new (Object.getPrototypeOf(a).constructor)(a.length + b.length) as T;
    result.set(a, 0);
    result.set(b, a.length);
    return result;
}


/** 頂点：配列化前は index は未定義、bake() 時に確定させる */
export class Vertex {
    position: Vector3;
    uv: Vector2;
    /** bake() 後に付与されるインデックス */
    index: number | null = null;

    constructor(pos: Vector3, uv: Vector2 = new Vector2(0, 0)) {
        this.position = pos;
        this.uv = uv;
    }
}

/** 三角面（必要なら直接追加したい場合用） */
export class Triangle {
    a: Vertex;
    b: Vertex;
    c: Vertex;
    constructor(a: Vertex, b: Vertex, c: Vertex) {
        this.a = a; this.b = b; this.c = c;
    }
}

/** 四角面（長方形/四角形）— bake() 時に (a,b,c) (a,c,d) へ分割 */
export class Rect {
    a: Vertex;
    b: Vertex;
    c: Vertex;
    d: Vertex;
    /** 対角の張り方。デフォは (a,b,c) (a,c,d) */
    diagAC: boolean;
    constructor(a: Vertex, b: Vertex, c: Vertex, d: Vertex, diagAC: boolean = true) {
        this.a = a; this.b = b; this.c = c; this.d = d;
        this.diagAC = diagAC;
    }
}

/** もとの GeometryBuilder を「オブジェクト管理 + 最後に配列化」へ拡張 */
export class GeometryBuilder {
    /** 生データ配列（bake 後に埋まる） */
    positions: number[] = [];
    uvs: number[] = [];
    indices: number[] = [];
    g:BufferGeometry|null = null;

    /** オブジェクトとして管理する領域 */
    private vertices: Vertex[] = [];
    private rects: Rect[] = [];
    private tris: Triangle[] = [];

    addVertex(v: Vertex): Vertex {
        this.vertices.push(v);
        return v;
    }

    /** 既存の Vertex から四角面を追加（対角線の張り方も選べる） */
    addRect(a: Vertex, b: Vertex, c: Vertex, d: Vertex, diagAC: boolean = true) {
        this.rects.push(new Rect(a, b, c, d, diagAC));
    }

    /** 既存の Vertex から三角面を追加 */
    addTri(a: Vertex, b: Vertex, c: Vertex) {
        this.tris.push(new Triangle(a, b, c));
    }

    /** 頂点をまとめて追加（UV同時指定） */
    addVertices(list: Array<{ p: Vector3; uv?: Vector2 }>): Vertex[] {
        return list.map(({ p, uv }) => {
            const v = new Vertex(p.clone(), uv ? uv.clone() : new Vector2(0, 0));
            this.vertices.push(v);
            return v;
        });
    }

    /**
     * bake(): Vertex → 連番 index を振る → Rect/Tri をインデックスへ変換
     * 既存の positions/uvs/indices はクリアして再生成
     */
    bake() {
        this.positions.length = 0;
        this.uvs.length = 0;
        this.indices.length = 0;

        // 1) 頂点へ index を振りつつ、配列を作る
        for (let i = 0; i < this.vertices.length; i++) {
            const v = this.vertices[i];
            v.index = i;
            this.positions.push(v.position.x, v.position.y, v.position.z);
            this.uvs.push(v.uv.x, v.uv.y);
        }

        // 2) 面（Rect/Tri）を indices に展開
        const pushTri = (ia: number, ib: number, ic: number) => {
            this.indices.push(ia, ib, ic);
        };

        // Rect は 2 三角形へ
        for (const r of this.rects) {
            const ia = r.a.index!, ib = r.b.index!, ic = r.c.index!, id = r.d.index!;
            if (r.diagAC) {
                // (a,b,c) (a,c,d)
                pushTri(ia, ib, id);
                pushTri(ia, id, ic);
            } else {
                // (a,b,d) (b,c,d)
                pushTri(ia, id, ib);
                pushTri(ia, ic, id);
            }
        }

        // Triangles
        for (const t of this.tris) {
            pushTri(t.a.index!, t.b.index!, t.c.index!);
        }
    }

    /** three.js ジオメトリ化（必要に応じて bake してから） */
    toBufferGeometry(): THREE.BufferGeometry {
        this.bake();


        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
        g.setIndex(this.indices);
        g.computeVertexNormals();
        g.computeBoundingBox();
        g.computeBoundingSphere();
        this.g = g;
        return g;
    }

    /** 便利関数：全クリア */
    clearAll() {
        this.positions.length = 0;
        this.uvs.length = 0;
        this.indices.length = 0;
        this.vertices.length = 0;
        this.rects.length = 0;
        this.tris.length = 0;
    }

    /** 既存データへアクセスしたい場合のゲッター */
    getVertices() { return this.vertices; }
    getRects() { return this.rects; }
    getTriangles() { return this.tris; }
    getNormals() {

        return this.g?.attributes.normal.array;
    }
}





/**
 * Calculate Mean Absolute Error (MAE) between two arrays of Vector3.
 * @param arr1 First array of Vector3
 * @param arr2 Second array of Vector3
 * @returns Mean Absolute Error (number)
 */
export function calcMAE(arr1: Vector3[], arr2: Vector3[]): number {
    if (arr1.length !== arr2.length) {
        throw new Error("Arrays must have the same length");
    }

    let totalError = 0;
    const n = arr1.length;

    for (let i = 0; i < n; i++) {
        const diffX = Math.abs(arr1[i].x - arr2[i].x);
        const diffY = Math.abs(arr1[i].y - arr2[i].y);
        const diffZ = Math.abs(arr1[i].z - arr2[i].z);
        totalError += (diffX + diffY + diffZ) / 3; // 各ベクトルの平均誤差
    }

    return totalError / n; // 全体の平均誤差
}


export function deepCopyVector3Matrix(matrix: Vector3[][]): Vector3[][] {
    return matrix.map(row => row.map(v => v.clone()));
}


// a・b / (|a||b|)
export function cosineSimilarity(a: THREE.Vector3, b: THREE.Vector3): number {
    const la = a.length();
    const lb = b.length();
    if (la === 0 || lb === 0) return 0; // ゼロベクトル対策
    return a.dot(b) / (la * lb);
}


/**
 * Vector3[] の重み付き平均を計算する
 * @param vectors - ベクトル配列
 * @param ws - 重み配列（vectors と同じ長さ）
 * @returns 重み付き平均ベクトル
 */
export function weightedAverage(vectors: Vector3[], ws: number[]): Vector3 {
    if (vectors.length !== ws.length || vectors.length === 0) {
        throw new Error("vectors と ws の長さが一致しないか、空です。");
    }

    // 重みの合計
    const sumW = ws.reduce((a, b) => a + b, 0);
    if (sumW === 0) throw new Error("重みの合計が 0 です。");

    // 重み付き合計
    const result = new Vector3(0, 0, 0);
    for (let i = 0; i < vectors.length; i++) {
        result.addScaledVector(vectors[i], ws[i]);
    }

    // 平均化
    return result.multiplyScalar(1 / sumW);
}


/**
 * Vector3[] の単純平均を計算する
 * @param vectors - ベクトル配列
 * @returns 平均ベクトル
 */
export function average(vectors: Vector3[]): Vector3 {
    if (vectors.length === 0) throw new Error("空の配列です。");

    const result = new Vector3(0, 0, 0);
    for (const v of vectors) {
        result.add(v);
    }
    return result.multiplyScalar(1 / vectors.length);
}


export function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
    return Object.entries(obj) as [keyof T, T[keyof T]][];
}


/**
 * 1次元mask配列2つの論理積をとって2次元maskを生成
 * @param maskI i方向mask（行側）
 * @param maskJ j方向mask（列側）
 * @returns 二次元mask（maskI.length × maskJ.length）
 */
export function combineMasks(maskI: number[], maskJ: number[]): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < maskI.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < maskJ.length; j++) {
            row.push(maskI[i] && maskJ[j] ? 1 : 0);
        }
        out.push(row);
    }
    return out;
}

/**
 * 1次元mask配列2つの論理積をとって2次元maskを生成
 * @param maskI i方向mask（行側）
 * @param maskJ j方向mask（列側）
 * @returns 二次元mask（maskI.length × maskJ.length）
 */
export function combineOrMasks(maskI: number[], maskJ: number[]): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < maskI.length; i++) {
        const row: number[] = [];
        for (let j = 0; j < maskJ.length; j++) {
            row.push(maskI[i] || maskJ[j] ? 1 : 0);
        }
        out.push(row);
    }
    return out;
}