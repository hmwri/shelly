// =============================================
// File: model/NurbsSurfaceModel.ts
// =============================================
import type {NurbsSurface} from "../curve";
import {BufferGeometry, Vector2, Vector3} from "three";
import * as THREE from "three";
import {combineMasks, combineOrMasks, GeometryBuilder, typedEntries, Vertex} from "../utils/common.ts";
import {clamp01, ease01, type Easing, generateMask} from "../history/command.ts";
import type {EventCode} from "../scene/worldScene.ts";
import type {GridParams} from "../grid.ts";

export type CornerKey =
    "u0v0" |
    "u0vN" |
    "uNvN" |
    "uNv0"


type CornerVertexes = Record<CornerKey, Vector3>


export type buildType = "N" | "U" | "V" | "UV"
type CornerThicknesses = Record<CornerKey, number>

export class NurbsSurfaceModel {
    surface: NurbsSurface;
    cornerVertexes: CornerVertexes | null = null;
    cornerTopVertexes: CornerVertexes | null = null;
    cornerThicknesses: CornerThicknesses;
    buildType:buildType = "N";
    gridParams: GridParams

    constructor(surface: NurbsSurface, thickness: number = 0.2) {
        this.surface = surface;
        this.cornerThicknesses = {
            u0v0: thickness,
            u0vN: thickness,
            uNvN: thickness,
            uNv0: thickness,
        }
        this.gridParams = {
            vLine:12,
            hLine:12,
            cellW:20,
            cellH:20,
        }
    }

    clone(): NurbsSurfaceModel {
        return new NurbsSurfaceModel(this.surface.clone());
    }

    /**
     * 制御点列を更新
     */
    updateControlPoints(axis: "u" | "v", index: number, points: THREE.Vector3[]): void {
        this.surface.setControlPointVector(axis, index, points);
    }


    setCornerThickness(key: CornerKey, thickness: number): void {
        this.cornerThicknesses[key] = Math.max(thickness, 0.1)
    }

    /**
     * ジオメトリ生成（現状の surface を反映）
     */
    buildGeometry(): BufferGeometry {
        const type = this.buildType
        switch (type) {
            case "N":
                return this.buildNurbsSolidGeometry(200, 200);
            case "U":
                return this.buildNurbsStripedGeometryU(200, 200);
            case "V":
                return this.buildNurbsStripedGeometryV(200, 200);
            case "UV":
                return this.buildNurbsStripedGeometryUV(200, 200);
        }

    }



    buildNurbsStripedGeometryU(
        Nu = 100,
        Nv = 100,
        opts?: {
            /** 法線反転（NURBS 実装や u/v 方向の取り方次第で裏表が逆になる場合に） */
            flipNormal?: boolean;

        }
    ): BufferGeometry {
        const {flipNormal = false} = opts ?? {};

        // 1) サンプル点（Nu x Nv）
        const grid = this.surface.sampleN(Nu, Nv)


        const normals = this.calcNormals(grid)

        if (!normals) {
            throw new Error("Could not find normals for nurbs");
        }
        const gb = new GeometryBuilder();


        const [offsetVertexGrid, cornerVertexes] = this.addOffsetGrid(gb, grid, normals, true)


        this.cornerVertexes = cornerVertexes;

        const [offsetVertexGrid2, cornerVertexesTop] = this.addOffsetGrid(gb, grid, normals, false)


        this.cornerTopVertexes = cornerVertexesTop;


        const mask = combineMasks(generateMask(Nu, this.gridParams.cellH ,this.gridParams.cellH, this.gridParams.hLine, this.gridParams.hLine), new Array(Nv).fill(1))

        this.addOffsetRect(gb, offsetVertexGrid2, !flipNormal, mask)
        this.addOffsetRect(gb, offsetVertexGrid, flipNormal, mask)

        let vertexGrid: Vertex[][] = []
        let vertexGrid2: Vertex[][] = []
        for (let i = 0; i < Nu; i++) {

            if (mask[i][0] == 1) {
                const line: Vertex[] = []
                const line2: Vertex[] = []
                for (let j = 0; j < Nv; j++) {
                    line.push(offsetVertexGrid[i][j]);
                    line2.push(offsetVertexGrid2[i][j]);
                }
                vertexGrid.push(line);
                vertexGrid2.push(line2);
            } else {
                if (vertexGrid.length >= 2) {
                    this.addSideRect(gb, vertexGrid, vertexGrid2, flipNormal);
                }
                vertexGrid = []
                vertexGrid2 = [];
            }

        }
        // 最後が 1 で終わったブロックの処理
        if (vertexGrid.length >= 2) {
            this.addSideRect(gb, vertexGrid, vertexGrid2, flipNormal);
        }

        return gb.toBufferGeometry();
    }


    setGridParams(params: GridParams) {
        const scaled = Object.fromEntries(
            typedEntries(params).map(([k, v]) => [k, v * 0.8])
        );

        this.gridParams = scaled
    }
    getGridParams() {
        const scaled = Object.fromEntries(
            typedEntries( this.gridParams).map(([k, v]) => [k, v * (1/0.8)])
        );

       return  scaled
    }


    buildNurbsStripedGeometryV(
        Nu = 100,
        Nv = 100,
        opts?: {
            /** 法線反転（NURBS 実装や u/v 方向の取り方次第で裏表が逆になる場合に） */
            flipNormal?: boolean;
        }
    ): BufferGeometry {
        const {flipNormal = false} = opts ?? {};

        // 1) サンプル点（Nu x Nv）
        const grid = this.surface.sampleN(Nu, Nv);
        const normals = this.calcNormals(grid);
        if (!normals) throw new Error("Could not find normals for nurbs");

        const gb = new GeometryBuilder();

        // 2) オフセット面（下側・上側）
        const [offsetVertexGrid, cornerVertexes] = this.addOffsetGrid(gb, grid, normals, true);
        this.cornerVertexes = cornerVertexes;

        const [offsetVertexGrid2, cornerVertexesTop] = this.addOffsetGrid(gb, grid, normals, false);
        this.cornerTopVertexes = cornerVertexesTop;

        // 3) V方向のストライプ・マスク（列方向に適用）
        const mask = combineMasks(new Array(Nu).fill(1), generateMask(Nv, this.gridParams.cellW ,this.gridParams.cellW, this.gridParams.vLine, this.gridParams.vLine))

        this.addOffsetRect(gb, offsetVertexGrid2, !flipNormal, mask)
        this.addOffsetRect(gb, offsetVertexGrid, flipNormal, mask)

        // 6) サイド面（V方向のストライプ境界）
        //    連続する "1" の列ブロックごとに、開始列と終了列の側面を閉じる
        let colGrid: Vertex[][] = [];
        let colGrid2: Vertex[][] = [];

        for (let j = 0; j < Nv; j++) {
            if (mask[0][j] === 1) {
                const col: Vertex[] = [];
                const col2: Vertex[] = [];
                for (let i = 0; i < Nu; i++) {

                    col.push(offsetVertexGrid[i][j]);
                    col2.push(offsetVertexGrid2[i][j]);
                }

                colGrid.push(col);
                colGrid2.push(col2);
            } else {
                if (colGrid.length >= 2) {
                    this.addSideRect(gb, colGrid, colGrid2, !flipNormal);
                }
                colGrid = [];
                colGrid2 = [];
            }
        }
        // 最後が 1 で終わったブロックの処理
        if (colGrid.length >= 2) {
            this.addSideRect(gb, colGrid, colGrid2, !flipNormal);
        }

        return gb.toBufferGeometry();
    }


    buildNurbsStripedGeometryUV(
        Nu = 100,
        Nv = 100,
        opts?: {
            /** 法線反転（NURBS 実装や u/v 方向の取り方次第で裏表が逆になる場合に） */
            flipNormal?: boolean;
        }
    ): BufferGeometry {
        const {flipNormal = false} = opts ?? {};

        // 1) サンプル点（Nu x Nv）
        const grid = this.surface.sampleN(Nu, Nv);
        const normals = this.calcNormals(grid);
        if (!normals) throw new Error("Could not find normals for nurbs");

        const gb = new GeometryBuilder();

        // 2) オフセット面（下側・上側）
        const [offsetVertexGrid, cornerVertexes] = this.addOffsetGrid(gb, grid, normals, true);
        this.cornerVertexes = cornerVertexes;

        const [offsetVertexGrid2, cornerVertexesTop] = this.addOffsetGrid(gb, grid, normals, false);
        this.cornerTopVertexes = cornerVertexesTop;

        const maskU = generateMask(Nu, this.gridParams.cellH ,this.gridParams.cellH, this.gridParams.hLine, this.gridParams.hLine)
        const maskV = generateMask(Nv, this.gridParams.cellW ,this.gridParams.cellW, this.gridParams.vLine, this.gridParams.vLine)

        const mask = combineOrMasks(maskU, maskV);

        this.addOffsetRect(gb, offsetVertexGrid2, !flipNormal, mask)
        this.addOffsetRect(gb, offsetVertexGrid, flipNormal, mask)

        // 6) サイド面（V方向のストライプ境界）
        //    連続する "1" の列ブロックごとに、開始列と終了列の側面を閉じる
        let colGrid: Vertex[][] = [];
        let colGrid2: Vertex[][] = [];

        for (let j = 0; j < Nv; j++) {
            if (maskV[j] === 1) {
                const col: Vertex[] = [];
                const col2: Vertex[] = [];
                for (let i = 0; i < Nu; i++) {

                    col.push(offsetVertexGrid[i][j]);
                    col2.push(offsetVertexGrid2[i][j]);
                }

                colGrid.push(col);
                colGrid2.push(col2);
            } else {
                if (colGrid.length >= 2) {
                    this.addSideRect(gb, colGrid, colGrid2, !flipNormal);
                }
                colGrid = [];
                colGrid2 = [];
            }
        }
        // 最後が 1 で終わったブロックの処理
        if (colGrid.length >= 2) {
            this.addSideRect(gb, colGrid, colGrid2, !flipNormal);
        }

        let vertexGrid: Vertex[][] = []
        let vertexGrid2: Vertex[][] = []
        for (let i = 0; i < Nu; i++) {

            if (maskU[i] == 1) {
                const line: Vertex[] = []
                const line2: Vertex[] = []
                for (let j = 0; j < Nv; j++) {
                    line.push(offsetVertexGrid[i][j]);
                    line2.push(offsetVertexGrid2[i][j]);
                }
                vertexGrid.push(line);
                vertexGrid2.push(line2);
            } else {
                if (vertexGrid.length >= 2) {
                    this.addSideRect(gb, vertexGrid, vertexGrid2, flipNormal);
                }
                vertexGrid = []
                vertexGrid2 = [];
            }

        }
        // 最後が 1 で終わったブロックの処理
        if (vertexGrid.length >= 2) {
            this.addSideRect(gb, vertexGrid, vertexGrid2, flipNormal);
        }

        console.log(gb)
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
            thickness?: number;
        }
    ): BufferGeometry {
        const {flipNormal = false, epsArea = 1e-12, thickness = 0.2} = opts ?? {};

        // 1) サンプル点（Nu x Nv）
        const grid = this.surface.sampleN(Nu, Nv)


        const normals = this.calcNormals(grid)

        if (!normals) {
            throw new Error("Could not find normals for nurbs");
        }
        const gb = new GeometryBuilder();


        const [offsetVertexGrid, cornerVertexes] = this.addOffsetGrid(gb, grid, normals, true)


        this.cornerVertexes = cornerVertexes;

        const [offsetVertexGrid2, cornerVertexesTop] = this.addOffsetGrid(gb, grid, normals, false)


        this.cornerTopVertexes = cornerVertexesTop;


        this.addOffsetRect(gb, offsetVertexGrid2, !flipNormal)

        this.addOffsetRect(gb, offsetVertexGrid, flipNormal)


// --- 追加: 4 辺の「側面」を結ぶ ---
// v = 0 辺（下辺）
        this.addSideRect(gb, offsetVertexGrid, offsetVertexGrid2, flipNormal);


        return gb.toBufferGeometry();
    }

    private addOffsetRect(gb: GeometryBuilder, vertexGrid: Vertex[][], flipNormal: boolean, mask?: number[][]) {
        const Nu = vertexGrid.length
        const Nv = vertexGrid[0].length
        mask = mask ?? new Array(Nu).fill(new Array(Nv).fill(1))
        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                if ((mask[i][j] === 1 && mask[i + 1][j + 1] == 1 && mask[i][j + 1] == 1 && mask[i + 1][j] == 1)) {
                    gb.addRect(
                        vertexGrid[i][j],
                        vertexGrid[i + 1][j],
                        vertexGrid[i][j + 1],
                        vertexGrid[i + 1][j + 1],
                        flipNormal
                    );
                }
            }
        }
    }

    private calcNormals(grid: Vector3[][]) {
        const _gb = new GeometryBuilder();

        const Nu = grid.length;
        const Nv = grid[0].length;

        const uAt = (i: number) => (Nu === 1 ? 0.5 : i / (Nu - 1));
        const vAt = (j: number) => (Nv === 1 ? 0.5 : j / (Nv - 1));


        const vertexGrid: Vertex[][] = Array.from({length: Nu}, (_, i) =>
            Array.from({length: Nv}, (_, j) => {
                const p = grid[i][j];
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                _gb.addVertex(v);
                return v;
            })
        );


        for (let i = 0; i < Nu - 1; i++) {
            for (let j = 0; j < Nv - 1; j++) {
                _gb.addRect(vertexGrid[i][j], vertexGrid[i + 1][j], vertexGrid[i][j + 1], vertexGrid[i + 1][j + 1])
            }
        }

        _gb.toBufferGeometry();

        return _gb.getNormals();
    }

    private addOffsetGrid(gb: GeometryBuilder, baseGrid: Vector3[][], normals: THREE.TypedArray, minusThick: boolean): [Vertex[][], CornerVertexes] {
        const Nu = baseGrid.length
        const Nv = baseGrid[0].length;

        const uAt = (i: number) => (Nu === 1 ? 0.5 : i / (Nu - 1));
        const vAt = (j: number) => (Nv === 1 ? 0.5 : j / (Nv - 1));

        const cornerVertexes: CornerVertexes = {
            u0v0: new THREE.Vector3(),
            u0vN: new THREE.Vector3(),
            uNvN: new THREE.Vector3(),
            uNv0: new THREE.Vector3(),
        };

        const offsetVertexGrid: Vertex[][] = Array.from({length: Nu}, (_, i) =>
            Array.from({length: Nv}, (_, j) => {
                const idx = i * Nv + j; // ← ここがポイント（もともと i*Nu+j になってる）
                const nx = normals![3 * idx];
                const ny = normals![3 * idx + 1];
                const nz = normals![3 * idx + 2];

                const t_ij = (minusThick ? -1 : 1) * this.thicknessAtIndex(i, j, Nu, Nv, this.cornerThicknesses, "smoothstep");


                const p = baseGrid[i][j].clone().add(new Vector3(nx, ny, nz).multiplyScalar(t_ij / 2));
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                if (i == 0 && j == 0) cornerVertexes.u0v0 = p
                if (i == 0 && j == Nv - 1) cornerVertexes.u0vN = p
                if (i == Nu - 1 && j == Nv - 1) cornerVertexes.uNvN = p
                if (i == Nu - 1 && j == 0) cornerVertexes.uNv0 = p
                gb.addVertex(v);
                return v;
            })
        );

        return [offsetVertexGrid, cornerVertexes];
    }

    private addSideRect(gb: GeometryBuilder, vertexGrid: Vertex[][], vertexGrid2: Vertex[][], flipNormal: boolean): void {
        const Nu = vertexGrid.length;
        const Nv = vertexGrid[0].length;
        for (let i = 0; i < Nu - 1; i++) {
            const a0 = vertexGrid2[i][0];
            const a1 = vertexGrid2[i + 1][0];
            const b0 = vertexGrid[i][0];
            const b1 = vertexGrid[i + 1][0];
            gb.addRect(a0, a1, b0, b1, flipNormal);
        }

// v = Nv-1 辺（上辺）
        for (let i = 0; i < Nu - 1; i++) {
            const a0 = vertexGrid2[i][Nv - 1];
            const a1 = vertexGrid2[i + 1][Nv - 1];
            const b0 = vertexGrid[i][Nv - 1];
            const b1 = vertexGrid[i + 1][Nv - 1];
            // 反時計回りを保つために左右を反転
            gb.addRect(a1, a0, b1, b0, flipNormal);
        }

// u = 0 辺（左辺）
        for (let j = 0; j < Nv - 1; j++) {
            const a0 = vertexGrid2[0][j];
            const a1 = vertexGrid2[0][j + 1];
            const b0 = vertexGrid[0][j];
            const b1 = vertexGrid[0][j + 1];
            // 反時計回りを保つために上下を反転
            gb.addRect(a1, a0, b1, b0, flipNormal);
        }

// u = Nu-1 辺（右辺）
        for (let j = 0; j < Nv - 1; j++) {
            const a0 = vertexGrid2[Nu - 1][j];
            const a1 = vertexGrid2[Nu - 1][j + 1];
            const b0 = vertexGrid[Nu - 1][j];
            const b1 = vertexGrid[Nu - 1][j + 1];
            gb.addRect(a0, a1, b0, b1, flipNormal);
        }

    }

    private bilerpThickness(
        u: number,
        v: number,
        c: CornerThicknesses
    ): number {
        const t00 = c.u0v0; // (u=0,v=0)
        const t01 = c.u0vN; // (u=0,v=1)
        const t11 = c.uNvN; // (u=1,v=1)
        const t10 = c.uNv0; // (u=1,v=0)

        // (1-u)(1-v) t00 + (1-u)v t01 + u v t11 + u(1-v) t10
        return (1 - u) * (1 - v) * t00
            + (1 - u) * v * t01
            + u * v * t11
            + u * (1 - v) * t10;
    }

// 実際の厚み（法線倍率）を各 i,j で計算
    private thicknessAtIndex(
        i: number,
        j: number,
        Nu: number,
        Nv: number,
        corners: CornerThicknesses,
        easing: Easing = "linear"
    ): number {
        const du = Math.max(1, Nu - 1);
        const dv = Math.max(1, Nv - 1);
        // i は u 方向、j は v 方向（あなたのインデックス規約に合わせる）
        let u = clamp01(i / du);
        let v = clamp01(j / dv);

        u = ease01(u, easing, "u");
        v = ease01(v, easing, "v");

        return this.bilerpThickness(u, v, corners);
    }


}
