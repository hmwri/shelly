import {BufferAttribute, BufferGeometry, Vector2, Vector3} from "three";
import  {type NurbsObject} from "nurbs";
import nurbs from "nurbs";
import {
    isNumber2D, isNumber3D,
    isVector2Array, isVector3Matrix,
    linspace,
    numberListToVec2List,
    numberListToVec3List,
    vecListTonumberList
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

        // 2) 位置・UV のバッファ確保
        const N = Nu * Nv;
        const positions = new Float32Array(N * 3);
        const uvs = new Float32Array(N * 2);

        const [umin, umax] = this.domain_u;
        const [vmin, vmax] = this.domain_v;

        // u,v の等間隔（domain に対して 0..1 を割り当て）
        const uAt = (i: number) => (Nu === 1 ? 0.5 : i / (Nu - 1));
        const vAt = (j: number) => (Nv === 1 ? 0.5 : j / (Nv - 1));

        // 3) 頂点列化（行優先：i が u、j が v）
        let pOff = 0, tOff = 0;
        for (let i = 0; i < Nu; i++) {
            for (let j = 0; j < Nv; j++) {
                const p = grid[i][j];
                positions[pOff++] = p.x;
                positions[pOff++] = p.y;
                positions[pOff++] = p.z;

                // UV は [0,1] に正規化（シェーダで domain に戻したければ使える）
                uvs[tOff++] = uAt(i);
                uvs[tOff++] = vAt(j);
            }
        }

        // 4) インデックス（三角形リスト）
        // セル (i,j) を [i*(Nv)+j] のインデックスで張る
        const triCount = (Nu - 1) * (Nv - 1) * 2;
        const indices = new (N > 65535 ? Uint32Array : Uint16Array)(triCount * 3);

        let k = 0;
        const area2 = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
            // |(b-a) x (c-a)|^2
            const abx = bx - ax, aby = by - ay, abz = bz - az;
            const acx = cx - ax, acy = cy - ay, acz = cz - az;
            const cxp = aby * acz - abz * acy;
            const cyp = abz * acx - abx * acz;
            const czp = abx * acy - aby * acx;
            return cxp * cxp + cyp * cyp + czp * czp;
        };

        const putTri = (a: number, b: number, c: number) => {
            // 退化三角形を（オプションで）スキップ
            if (epsArea > 0) {
                const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
                const bx = positions[b * 3], by = positions[b * 3 + 1], bz = positions[b * 3 + 2];
                const cx = positions[c * 3], cy = positions[c * 3 + 1], cz = positions[c * 3 + 2];
                if (area2(ax, ay, az, bx, by, bz, cx, cy, cz) < epsArea) return; // 面積ほぼゼロ → 捨てる
            }
            indices[k++] = a;
            indices[k++] = b;
            indices[k++] = c;
        };

        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                const a = i * Nv + j;
                const b = (i + 1) * Nv + j;
                const c = i * Nv + (j + 1);
                const d = (i + 1) * Nv + (j + 1);

                // 2 三角形で四辺形を張る
                // 反転指定に応じて頂点順序を切り替え
                if (!flipNormal) {
                    putTri(a, b, d);
                    putTri(a, d, c);
                } else {
                    putTri(a, d, b);
                    putTri(a, c, d);
                }
            }
        }
        // 5) Geometry 組み立て
        const geom = new BufferGeometry();
        geom.setAttribute('position', new BufferAttribute(positions, 3));
        geom.setAttribute('uv',       new BufferAttribute(uvs, 2));

        // 実際に入ったインデックス数に切り詰め（退化除去で減る場合がある）
        if (k < indices.length) {
            const trimmed = indices.slice(0, k);
            geom.setIndex(new BufferAttribute(trimmed, 1));
        } else {
            geom.setIndex(new BufferAttribute(indices, 1));
        }

        geom.computeVertexNormals(); // 面取りの連続性が良ければこれで十分
        geom.computeBoundingBox();
        geom.computeBoundingSphere();

        return geom;
    }

}