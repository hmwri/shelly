// =============================================
// File: object/ArchObject.ts  （最小変更の参照実装）
//  - 既存プロジェクトに合わせて必要な部分だけ掲載
// =============================================
import * as THREE from "three";
import type { BackgroundScene } from "../../scene";
import type { Vector3 } from "three";
import type { ModeType } from "../../types/nurbs";
import { HistoryManager } from "../../history";
import type { LineHelper } from "../helpers/LineHelper.ts";
import type { EventCode } from "../../scene/worldScene.ts";



export class ArchObject extends THREE.Mesh {
    selected = false;
    mode: ModeType = "NORMAL";
    history: HistoryManager;
    moveBeginPos: THREE.Vector3 = new THREE.Vector3();

    /** 各オブジェクトが保持する補助線（hover/selection共有のため） */
    protected _lineHelpers: LineHelper[] = [];

    get lineHelpers(): LineHelper[] { return this._lineHelpers; }
    set lineHelpers(v: LineHelper[]) { this._lineHelpers = v; }

    get lineHelpers(): LineHelper[] { return this._lineHelpers; }
    set lineHelpers(v: LineHelper[]) { this._lineHelpers = v; }

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
        super(geometry, material);
        this.history = new HistoryManager();
    }

    onClick() {}
    onHelperClicked(_helper: LineHelper | null) {}
    isHelperSelected(): boolean {
        return this.lineHelpers.some((h) => h.selecting);
    }

    onSelect(){

    }

    update() {}

    changeMode(mode: ModeType) {
        this.mode = mode;
    }

    sketchModify(_scene: BackgroundScene, _samples: THREE.Vector2[]) {}

    onMoveStart() {
        this.moveBeginPos = this.position.clone();
    }

    onMove(delta: Vector3) {
        this.position.copy(this.moveBeginPos.clone().sub(delta));
    }

    onEvent(_code: EventCode) {}

    undo() {
        this.history.undo();
    }
    redo() {
        this.history.redo();
    }
}
