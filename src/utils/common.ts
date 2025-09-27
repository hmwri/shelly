import {Mesh, MeshStandardMaterial, Scene, SphereGeometry, Vector2, Vector3} from "three";

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