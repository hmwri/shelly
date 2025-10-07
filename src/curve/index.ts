import { Vector2, Vector3} from "three";
import  {type NurbsObject} from "nurbs";
import nurbs from "nurbs";
import {
     deepCopyVector3Matrix, GeometryBuilder,
    isNumber2D, isNumber3D,
     isVector3Matrix,
    linspace,
    numberListToVec2List,
    numberListToVec3List,
    vecListTonumberList,
} from "../utils/common.ts";
import {fullBasisAt} from "../utils/nurbs.ts";




export class NurbsCurve {
    points: (Vector2 | Vector3)[]
    degree: number
    knot: number[]
    curve: NurbsObject
    domain: number[]
    is3D: boolean

    constructor(points: (Vector2 | Vector3)[] | number[][], degree: number, knot: number[]) {
        if (isNumber2D(points)) {
            if(points.length > 0 && points[0].length == 2) {
                this.points = numberListToVec2List(points)
            }else{
                this.points = numberListToVec3List(points)
            }
        } else {
            this.points = points as (Vector2 | Vector3)[]
        }

        this.degree = degree
        this.knot = knot
        this.is3D = this.points[0] instanceof Vector3

        this.curve = nurbs({
            points: this.is3D
                ? vecListTonumberList(this.points as Vector3[])
                : vecListTonumberList(this.points as Vector2[]),
            degree: degree,
            knots: [knot],
        })

        this.domain = this.curve.domain[0]
    }

    getBasis(u:number): number[] {
        return fullBasisAt(u, this.degree, this.knot, this.points.length)
    }

    sample(t: number): Vector2 | Vector3 {
        if (this.domain[0] > t || this.domain[1] < t) {
            throw new Error("Out of Domain")
        }
        let out: number[] = []
        this.curve.evaluate(out, t)

        return this.is3D
            ? new Vector3(out[0], out[1], out[2])
            : new Vector2(out[0], out[1])
    }

    sampleN(N: number = 100, callback: ((p: Vector2 | Vector3) => any) | null = null) {
        let ts = linspace(this.curve.domain[0][0], this.curve.domain[0][1], N)
        let ps = []
        for (let t of ts) {
            let pt = this.sample(t)
            if (callback) {
                callback(pt)
            }
            ps.push(pt)
        }
        return ps
    }
}


export class NurbsSurface {
    points: Vector3[][]
    degree:[number, number]
    knot:number[][]
    surface:NurbsObject
    domain_u:[number, number]
    domain_v:[number, number]
    gb:GeometryBuilder | null = null

    constructor(points: Vector3[][] | number[][][], degree:[number, number], knot:number[][]) {
        if(isNumber3D(points)){
            this.points = numberListToVec3List(points)
        }else{
            this.points = points;
        }
        this.degree = degree;
        this.knot = knot;
        this.surface = nurbs(
            {
                points: isVector3Matrix(points) ? vecListTonumberList(points) : points,
                degree: degree,
                knots: knot,
            }
        )
        this.domain_u = this.surface.domain[0]
        this.domain_v = this.surface.domain[1]
    }

    reloadCurve() {
        this.surface = nurbs(
            {
                points: vecListTonumberList(this.points),
                degree: this.degree,
                knots: this.knot,
            }
        )
    }
    getControlPointVector(axis: "u" | "v", i: number, curve: true): NurbsCurve;
    getControlPointVector(axis: "u" | "v", i: number, curve?: false): Vector3[];


// --- Control net extraction aligned to NURBS semantics ---
    getControlPointVector(
        axis: "u" | "v",
        i: number,
        curve: boolean = false
    ): Vector3[] | NurbsCurve {
        const uCount = this.points.length;           // # of control pts along u
        const vCount = this.points[0]?.length ?? 0;  // # of control pts along v

        let pts: Vector3[];

        if (axis === "u") {
            // u-direction control polygon: fix v = i, vary u -> take a column
            if (i < 0 || i >= vCount) throw new Error(`Invalid index i=${i} for u-direction (v-index)`);
            pts = this.points.map(row => row[i]); // column: [ P[0][i], P[1][i], ... ]
        } else {
            // v-direction control polygon: fix u = i, vary v -> take a row
            if (i < 0 || i >= uCount) throw new Error(`Invalid index i=${i} for v-direction (u-index)`);
            pts = this.points[i]; // row: [ P[i][0], P[i][1], ... ]
        }

        if (!curve) return pts;

        // Build an isoparametric control curve in that direction
        // Use degree/knot of the varying parameter
        const deg = axis === "u" ? this.degree[0] : this.degree[1];
        const knot = axis === "u" ? this.knot[0] : this.knot[1];
        return new NurbsCurve(pts, deg, knot);
    }

    getNP(axis: "u" | "v") {
        return axis == "u" ? this.points.length : this.points[0].length;

    }

    setControlPointVector(axis: "u" | "v", i: number, newVec: Vector3[]): void {
        const uCount = this.points.length;           // # along u (rows)
        const vCount = this.points[0]?.length ?? 0;  // # along v (cols)

        if (axis === "u") {
            // u方向の制御多角形（列）: v=i を固定し、u を走査して更新
            if (i < 0 || i >= vCount) {
                throw new Error(`Invalid index i=${i} for u-direction (v-index)`);
            }
            if (newVec.length !== uCount) {
                throw new Error(`Length mismatch: expected ${uCount}, got ${newVec.length}`);
            }
            for (let u = 0; u < uCount; u++) {
                this.points[u][i] = newVec[u];
            }
        } else {
            // v方向の制御多角形（行）: u=i を固定し、v を走査して更新
            if (i < 0 || i >= uCount) {
                throw new Error(`Invalid index i=${i} for v-direction (u-index)`);
            }
            if (newVec.length !== vCount) {
                throw new Error(`Length mismatch: expected ${vCount}, got ${newVec.length}`);
            }
            // 参照保持のため、行配列を置換せず中身だけ更新（安全）
            for (let v = 0; v < vCount; v++) {
                this.points[i][v] = newVec[v];
            }
            // もし行オブジェクトごと置換して良いなら:
            // this.points[i] = newVec;
        }

        this.reloadCurve();
    }

    /** サーフェスを (u,v) で評価して Vector3 を返す */
    sample(u: number, v: number): Vector3 {
        // 範囲チェック
        const [umin, umax] = this.domain_u;
        const [vmin, vmax] = this.domain_v;
        if (u < umin || u > umax) throw new Error(`u=${u} is out of domain [${umin}, ${umax}]`);
        if (v < vmin || v > vmax) throw new Error(`v=${v} is out of domain [${vmin}, ${vmax}]`);

        const out: number[] = [];
        this.surface.evaluate(out, u, v);

        // z が無い場合は 0 を補う
        return new Vector3(out[0], out[1], out[2] ?? 0);
    }

    /**
     * (Nu × Nv) グリッドでサンプリング。
     * 返り値は Vector3[][]（u に沿って外側、v に沿って内側）を返す。
     * コールバックがあれば各点で呼ぶ。
     */
    sampleN(
        Nu: number = 50,
        Nv: number = 50,
        callback: ((p: Vector3, u: number, v: number) => void) | null = null
    ): Vector3[][] {
        const [umin, umax] = this.domain_u;
        const [vmin, vmax] = this.domain_v;

        const us = linspace(umin, umax, Nu);
        const vs = linspace(vmin, vmax, Nv);

        const grid: Vector3[][] = new Array(Nu);
        for (let i = 0; i < Nu; i++) {
            const u = us[i];
            const row: Vector3[] = new Array(Nv);
            for (let j = 0; j < Nv; j++) {
                const v = vs[j];
                const p = this.sample(u, v);
                if (callback) callback(p, u, v);
                row[j] = p;
            }
            grid[i] = row;
        }
        return grid;
    }

// --- Isoparametric sampling aligned to NURBS semantics ---
// axis="u": v=fixed で u を走査（u-direction iso-curve）
// axis="v": u=fixed で v を走査（v-direction iso-curve）
    sampleLine(
        axis: "u" | "v",
        fixed: number,
        N: number = 50,
        callback: ((p: Vector3, u: number, v: number) => void) | null = null
    ): Vector3[] {
        const Nint = Math.max(1, Math.floor(N));

        if (axis === "u") {
            // v fixed, sweep u
            const [vmin, vmax] = this.domain_v;
            if (fixed < vmin || fixed > vmax) {
                throw new Error(`v=${fixed} is out of domain [${vmin}, ${vmax}]`);
            }
            const [umin, umax] = this.domain_u;
            const us = linspace(umin, umax, Nint);

            const line: Vector3[] = new Array(Nint);
            for (let i = 0; i < Nint; i++) {
                const u = us[i];
                const p = this.sample(u, fixed);
                if (callback) callback(p, u, fixed);
                line[i] = p;
            }
            return line;
        } else {
            // u fixed, sweep v
            const [umin, umax] = this.domain_u;
            if (fixed < umin || fixed > umax) {
                throw new Error(`u=${fixed} is out of domain [${umin}, ${umax}]`);
            }
            const [vmin, vmax] = this.domain_v;
            const vs = linspace(vmin, vmax, Nint);

            const line: Vector3[] = new Array(Nint);
            for (let i = 0; i < Nint; i++) {
                const v = vs[i];
                const p = this.sample(fixed, v);
                if (callback) callback(p, fixed, v);
                line[i] = p;
            }
            return line;
        }
    }



    clone(): this {
        // surface を再利用して新インスタンスを作成
        const cloned = new (this.constructor as any)(deepCopyVector3Matrix(this.points), this.degree.slice(), this.knot.map(row => row.slice())) as this;
        return cloned;
    }


}