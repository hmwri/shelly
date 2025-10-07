// LineHelpers.ts
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { Vector3 } from "three";
import type {CornerKey} from "../../model/NurbsSurfaceModel.ts";
import type {ArchObject} from "../base/ArchObject.ts"; // ←型だけ使うなら type import でもOK

/** 共通のふるまいを持つ基底クラス */
export abstract class LineHelper extends Line2 {
    points: Vector3[] = [];
    color: number;
    lineWidth: number;
    hovering = false;
    selecting = false;
    arch: ArchObject;

    /** 共通のマテリアル生成 */
    protected static makeMaterial(color: number, lineWidth: number) {
        return new LineMaterial({
            color,
            linewidth: lineWidth,
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            depthTest: false,
        });
    }

    protected constructor(points: Vector3[], color: number, lineWidth: number, arch: ArchObject) {
        const geom = new LineGeometry().setFromPoints(points);
        const mat = LineHelper.makeMaterial(color, lineWidth);
        super(geom, mat);
        this.points = points;
        this.color = color;
        this.lineWidth = lineWidth;
        this.arch = arch;

        // Line2 はスクリーン解像度依存
        (this.material as LineMaterial).resolution.set(window.innerWidth, window.innerHeight);
    }

    /** 画面サイズに応じて resolution を更新 */
    setResolution(width: number, height: number) {
        (this.material as LineMaterial).resolution.set(width, height);
    }

    /** ハイライト/選択状態などの見た目更新 */
    update() {
        const mat = this.material as LineMaterial;
        mat.color = new THREE.Color().setHex(this.selecting ? 0xff0000 : this.hovering ? 0xffff00 : this.color);
        mat.linewidth = this.selecting ? this.lineWidth + 12 : this.hovering ? this.lineWidth + 2 : this.lineWidth;
        mat.needsUpdate = true;
    }

    setHovering(v: boolean) {
        this.hovering = v;
        this.update();
    }
    setSelecting(v: boolean) {
        this.selecting = v;
        this.update();
    }



    onClick(_event?: PointerEvent) {
        // 必要なら各派生クラスで override
    }

    /** 共通の破棄処理 */
    disposeAll() {
        (this.geometry as LineGeometry).dispose();
        (this.material as LineMaterial).dispose();
    }
}

/** U/V 方向の位置 t（パラメトリック）と axis 情報を持つ補助線 */
export class UVLineHelper extends LineHelper {
    axis: "u" | "v";
    t: number;

    constructor(points: Vector3[], color: number, lineWidth: number, axis: "u" | "v", t: number, arch: ArchObject) {
        super(points, color, lineWidth, arch);
        this.axis = axis;
        this.t = t;
    }

    override onClick() {
        // 例：選択トグル
        this.setSelecting(!this.selecting);
    }

    override clone(recursive = true): this {
        const cloned = new (this.constructor as new (...args: any[]) => this)(
            [...this.points], this.color, this.lineWidth, this.axis, this.t, this.arch
        );
        cloned.copy(this, recursive);
        return cloned;
    }
}


export class ThickLineHelper extends LineHelper {
    loc:CornerKey;
    constructor(points: Vector3[], color: number, lineWidth: number, loc:CornerKey, arch: ArchObject) {
        super(points, color, lineWidth, arch);
        this.loc = loc;
    }

    override clone(recursive = true): this {
        const cloned = new (this.constructor as new (...args: any[]) => this)(
            [...this.points], this.color, this.lineWidth, this.arch
        );
        cloned.copy(this, recursive);
        return cloned;
    }
}