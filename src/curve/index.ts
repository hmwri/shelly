import {BufferAttribute, BufferGeometry, Vector2, Vector3} from "three";
import  {type NurbsObject} from "nurbs";
import nurbs from "nurbs";
import {
    concatTypedArray, GeometryBuilder,
    isNumber2D, isNumber3D,
    isVector2Array, isVector3Matrix,
    linspace,
    numberListToVec2List,
    numberListToVec3List,
    vecListTonumberList, Vertex
} from "../utils/common.ts";




export class NurbsCurve  {
    points: Vector2[]
    degree:number
    knot:number[]
    curve:NurbsObject
    domain:number[]

    constructor(points: Vector2[] | number[][], degree:number, knot:number[]) {
        if(isNumber2D(points)){
            this.points = numberListToVec2List(points)
        }else{
            this.points = points;
        }
        this.degree = degree;
        this.knot = knot;
        this.curve = nurbs(
            {
                points: isVector2Array(points) ? vecListTonumberList(points) : points,
                degree: degree,
                knots: [knot],
            }
        )
        this.domain = this.curve.domain[0]
    }

    sample(t:number) {
        if(this.domain[0] > t || this.domain[1] < t){
            throw new Error("Out of Domain");
        }
        let out:number[] = []
        this.curve.evaluate(out, t)
        return new Vector2(out[0], out[1])
    }

    sampleN(N:number=100, callback:((xy :Vector2) => any) |null = null) {
        let ts = linspace(this.curve.domain[0][0], this.curve.domain[0][1], N)
        for (let t of ts) {
            let xy = this.sample(t)
            if(callback) {
                callback(xy)
            }
        }
    }
}



export class NurbsSurface {
    points: Vector3[][]
    degree:[number, number]
    knot:number[][]
    surface:NurbsObject
    domain_u:[number, number]
    domain_v:[number, number]

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
    getControlPointVector(axis: "u" | "v", i: number): Vector3[] {
        const vCount = this.points.length;           // 行数 (= v の本数)
        const uCount = this.points[0]?.length ?? 0;  // 列数 (= u の本数)

        if (axis === "u") {
            // 固定 u=i → 各 v について列 i を拾う
            if (i < 0 || i >= uCount) {
                throw new Error(`Invalid index i=${i} for u-axis`);
            }
            return this.points.map(row => row[i]);
        } else {
            // 固定 v=i → 行 i をそのまま返す
            if (i < 0 || i >= vCount) {
                throw new Error(`Invalid index i=${i} for v-axis`);
            }
            return this.points[i];
        }
    }

    setControlPointVector(axis: "u" | "v", i: number, newVec: Vector3[]): void {
        const vCount = this.points.length;
        const uCount = this.points[0]?.length ?? 0;

        if (axis === "u") {
            // 固定 u=i → 各 v の row[i] を更新
            if (i < 0 || i >= uCount) {
                throw new Error(`Invalid index i=${i} for u-axis`);
            }
            if (newVec.length !== vCount) {
                throw new Error(`Length mismatch: expected ${vCount}, got ${newVec.length}`);
            }
            for (let v = 0; v < vCount; v++) {
                this.points[v][i] = newVec[v];
            }
        } else {
            // 固定 v=i → 行丸ごと置換
            if (i < 0 || i >= vCount) {
                throw new Error(`Invalid index i=${i} for v-axis`);
            }
            if (newVec.length !== uCount) {
                throw new Error(`Length mismatch: expected ${uCount}, got ${newVec.length}`);
            }
            this.points[i] = newVec;
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

    sampleLineAlongU(
        v: number,
        Nu: number = 50,
        callback: ((p: Vector3, u: number, v: number) => void) | null = null
    ): Vector3[] {
        // Check if the given v is within the valid domain
        const [vmin, vmax] = this.domain_v;
        if (v < vmin || v > vmax) {
            throw new Error(`v=${v} is out of domain [${vmin}, ${vmax}]`);
        }

        const [umin, umax] = this.domain_u;
        const us = linspace(umin, umax, Nu); // Generate Nu linearly spaced points for u

        const line: Vector3[] = new Array(Nu);
        for (let i = 0; i < Nu; i++) {
            const u = us[i];
            const p = this.sample(u, v); // Sample the point on the surface
            if (callback) {
                callback(p, u, v); // Execute callback if provided
            }
            line[i] = p;
        }

        return line;
    }

    sampleLineAlongV(
        u: number,
        Nv: number = 50,
        callback: ((p: Vector3, u: number, v: number) => void) | null = null
    ): Vector3[] {
        // Check if the given u is within the valid domain
        const [umin, umax] = this.domain_u;
        if (u < umin || u > umax) {
            throw new Error(`u=${u} is out of domain [${umin}, ${umax}]`);
        }

        const [vmin, vmax] = this.domain_v;
        const vs = linspace(vmin, vmax, Nv); // Generate Nv linearly spaced points for v

        const line: Vector3[] = new Array(Nv);
        for (let i = 0; i < Nv; i++) {
            const v = vs[i];
            const p = this.sample(u, v); // Sample the point on the surface
            if (callback) {
                callback(p, u, v); // Execute callback if provided
            }
            line[i] = p;
        }

        return line;
    }


    buildNurbsSurfaceGeometry(
        Nu = 100,
        Nv = 100,
        opts?: {
            /** 法線反転（NURBS 実装や u/v 方向の取り方次第で裏表が逆になる場合に） */
            flipNormal?: boolean;
            /** 退化（三点がほぼ一直線）三角形をスキップする閾値 */
            epsArea?: number;
        }
    ): BufferGeometry {
        const {flipNormal = false, epsArea = 1e-12} = opts ?? {};

        // 1) サンプル点（Nu x Nv）
        const grid = this.sampleN(Nu, Nv);

        const gb = new GeometryBuilder()

        const uAt = (i: number) => (Nu === 1 ? 0.5 : i / (Nu - 1));
        const vAt = (j: number) => (Nv === 1 ? 0.5 : j / (Nv - 1));


        // 3) 頂点列化（行優先：i が u、j が v）
        const vertexGrid: Vertex[][] = Array.from({ length: Nu }, (_, i) =>
            Array.from({ length: Nv }, (_, j) => {
                const p = grid[i][j];
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                gb.addVertex(v);
                return v;
            })
        );

        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                gb.addRect(vertexGrid[i][j], vertexGrid[i+1][j],vertexGrid[i][j+1],vertexGrid[i+1][j+1], flipNormal)
            }
        }


        // 5) Geometry 組み立て

        return gb.toBufferGeometry();
    }


    buildNurbsSolidGeometry(
        Nu = 100,
        Nv = 100,
        opts?: {
            /** 法線反転（NURBS 実装や u/v 方向の取り方次第で裏表が逆になる場合に） */
            flipNormal?: boolean;
            /** 退化（三点がほぼ一直線）三角形をスキップする閾値 */
            epsArea?: number;
        }
    ): BufferGeometry {
        const {flipNormal = false, epsArea = 1e-12} = opts ?? {};

        // 1) サンプル点（Nu x Nv）
        const grid = this.sampleN(Nu, Nv);

        const _gb = new GeometryBuilder();

        const uAt = (i: number) => (Nu === 1 ? 0.5 : i / (Nu - 1));
        const vAt = (j: number) => (Nv === 1 ? 0.5 : j / (Nv - 1));




        const vertexGrid: Vertex[][] = Array.from({ length: Nu }, (_, i) =>
            Array.from({ length: Nv }, (_, j) => {
                const p = grid[i][j];
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                _gb.addVertex(v);
                return v;
            })
        );

        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                _gb.addRect(vertexGrid[i][j], vertexGrid[i+1][j],vertexGrid[i][j+1],vertexGrid[i+1][j+1], !flipNormal)
            }
        }


        _gb.toBufferGeometry();

        const normals = _gb.getNormals();
        const gb = new GeometryBuilder();

        const thickness = 0.2;
        const offsetVertexGrid: Vertex[][] = Array.from({ length: Nu }, (_, i) =>
            Array.from({ length: Nv }, (_, j) => {
                const idx = i * Nv + j; // ← ここがポイント（もともと i*Nu+j になってる）
                const nx = normals![3 * idx];
                const ny = normals![3 * idx + 1];
                const nz = normals![3 * idx + 2];

                const p = grid[i][j].clone().add(new Vector3(nx, ny, nz).multiplyScalar(-thickness));
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                gb.addVertex(v);
                return v;
            })
        );




        const offsetVertexGrid2: Vertex[][] = Array.from({ length: Nu }, (_, i) =>
            Array.from({ length: Nv }, (_, j) => {
                const idx = i * Nv + j; // ← ここがポイント（もともと i*Nu+j になってる）
                const nx = normals![3 * idx];
                const ny = normals![3 * idx + 1];
                const nz = normals![3 * idx + 2];

                const p = grid[i][j].clone().add(new Vector3(nx, ny, nz).multiplyScalar(thickness));
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                gb.addVertex(v);
                return v;
            })
        );

        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                gb.addRect(
                    offsetVertexGrid2[i][j],
                    offsetVertexGrid2[i + 1][j],
                    offsetVertexGrid2[i][j + 1],
                    offsetVertexGrid2[i + 1][j + 1],
                    !flipNormal
                );
            }
        }

// オフセット面（裏面）は既に作っている前提
        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                gb.addRect(
                    offsetVertexGrid[i][j],
                    offsetVertexGrid[i + 1][j],
                    offsetVertexGrid[i][j + 1],
                    offsetVertexGrid[i + 1][j + 1],
                    flipNormal
                );
            }
        }

// --- 追加: 4 辺の「側面」を結ぶ ---
// v = 0 辺（下辺）
        for (let i = 0; i < Nu - 1; i++) {
            const a0 = offsetVertexGrid2[i][0];
            const a1 = offsetVertexGrid2[i + 1][0];
            const b0 = offsetVertexGrid[i][0];
            const b1 = offsetVertexGrid[i + 1][0];
            gb.addRect(a0, a1, b0, b1, flipNormal);
        }

// v = Nv-1 辺（上辺）
        for (let i = 0; i < Nu - 1; i++) {
            const a0 = offsetVertexGrid2[i][Nv - 1];
            const a1 = offsetVertexGrid2[i + 1][Nv - 1];
            const b0 = offsetVertexGrid[i][Nv - 1];
            const b1 = offsetVertexGrid[i + 1][Nv - 1];
            // 反時計回りを保つために左右を反転
            gb.addRect(a1, a0, b1, b0, flipNormal);
        }

// u = 0 辺（左辺）
        for (let j = 0; j < Nv - 1; j++) {
            const a0 = offsetVertexGrid2[0][j];
            const a1 = offsetVertexGrid2[0][j + 1];
            const b0 = offsetVertexGrid[0][j];
            const b1 = offsetVertexGrid[0][j + 1];
            // 反時計回りを保つために上下を反転
            gb.addRect(a1, a0, b1, b0, flipNormal);
        }

// u = Nu-1 辺（右辺）
        for (let j = 0; j < Nv - 1; j++) {
            const a0 = offsetVertexGrid2[Nu - 1][j];
            const a1 = offsetVertexGrid2[Nu - 1][j + 1];
            const b0 = offsetVertexGrid[Nu - 1][j];
            const b1 = offsetVertexGrid[Nu - 1][j + 1];
            gb.addRect(a0, a1, b0, b1, flipNormal);
        }


        return  gb.toBufferGeometry();
    }


}