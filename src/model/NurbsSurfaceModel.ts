// =============================================
// File: model/NurbsSurfaceModel.ts
// =============================================
import type { NurbsSurface } from "../curve";
import {BufferGeometry, Vector2, Vector3} from "three";
import * as THREE from "three";
import {GeometryBuilder, Vertex} from "../utils/common.ts";

type CornerVertexes = {
    "u0v0" : Vector3,
    "u0vN" : Vector3,
    "uNvN" : Vector3,
    "uNv0" : Vector3,

}

export class NurbsSurfaceModel {
    surface: NurbsSurface;
    cornerVertexes: CornerVertexes | null = null;
    cornerTopVertexes: CornerVertexes| null = null;
    thickness:number;

    constructor(surface: NurbsSurface, thickness:number=0.2) {
        this.surface = surface;
        this.thickness = thickness;
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

    /**
     * ジオメトリ生成（現状の surface を反映）
     */
    buildGeometry(): BufferGeometry {
        return this.buildNurbsSolidGeometry(100, 100, {thickness:this.thickness});
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



        const cornerVertexes: CornerVertexes = {
            u0v0: new THREE.Vector3(),
            u0vN: new THREE.Vector3(),
            uNvN: new THREE.Vector3(),
            uNv0: new THREE.Vector3(),
        };

        const offsetVertexGrid: Vertex[][] = Array.from({ length: Nu }, (_, i) =>
            Array.from({ length: Nv }, (_, j) => {
                const idx = i * Nv + j; // ← ここがポイント（もともと i*Nu+j になってる）
                const nx = normals![3 * idx];
                const ny = normals![3 * idx + 1];
                const nz = normals![3 * idx + 2];

                const p = grid[i][j].clone().add(new Vector3(nx, ny, nz).multiplyScalar(-thickness));
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                if(i == 0 && j == 0)  cornerVertexes.u0v0 = p
                if(i == 0 && j == Nv-1)  cornerVertexes.u0vN = p
                if(i == Nu-1 && j == Nv-1) cornerVertexes.uNvN = p
                if(i == Nu-1 && j == 0) cornerVertexes.uNv0 = p
                gb.addVertex(v);
                return v;
            })
        );

        this.cornerVertexes = cornerVertexes;


        const cornerVertexesTop: CornerVertexes = {
            u0v0: new THREE.Vector3(),
            u0vN: new THREE.Vector3(),
            uNvN: new THREE.Vector3(),
            uNv0: new THREE.Vector3(),
        };

        const offsetVertexGrid2: Vertex[][] = Array.from({ length: Nu }, (_, i) =>
            Array.from({ length: Nv }, (_, j) => {
                const idx = i * Nv + j; // ← ここがポイント（もともと i*Nu+j になってる）
                const nx = normals![3 * idx];
                const ny = normals![3 * idx + 1];
                const nz = normals![3 * idx + 2];

                const p = grid[i][j].clone().add(new Vector3(nx, ny, nz).multiplyScalar(thickness));
                const v = new Vertex(p, new Vector2(uAt(i), vAt(j)));
                if(i == 0 && j == 0)  cornerVertexesTop.u0v0 = p
                if(i == 0 && j == Nv-1)  cornerVertexesTop.u0vN = p
                if(i == Nu-1 && j == Nv-1) cornerVertexesTop.uNvN = p
                if(i == Nu-1 && j == 0) cornerVertexesTop.uNv0 = p
                gb.addVertex(v);
                return v;
            })
        );

        this.cornerTopVertexes = cornerVertexesTop;



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
