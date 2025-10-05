// =============================================
// File: object/NurbsSurfaceObject.ts  （更新版）
// =============================================
import * as THREE from "three";
import type { Vector3 } from "three";
import type { NurbsSurface } from "../curve";
import type { ModeType } from "../types/nurbs";
import type { BackgroundScene, WorldScene } from "../scene";
import type { EventCode } from "../scene/worldScene.ts";
import { LineHelper } from "./helpers/LineHelper.ts";
import { NurbsSurfaceModel } from "../model/NurbsSurfaceModel";
import { NurbsSurfaceView } from "../view/NurbsSurfaceView";
import { NurbsSurfaceController } from "../controller/NurbsSurfaceController";
import { ArchObject } from "./base/ArchObject.ts";

export class NurbsSurfaceObject extends ArchObject {
    declare material: THREE.MeshStandardMaterial;

    model: NurbsSurfaceModel;
    view: NurbsSurfaceView;
    controller: NurbsSurfaceController;

    worldScene: WorldScene;


    get lineHelpers() { return this.view.lineHelpers; }

    constructor(surface: NurbsSurface, worldScene: WorldScene, thichness= 0.2) {
        const model = new NurbsSurfaceModel(surface, thichness);
        const geometry = model.buildGeometry();
        const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
        super(geometry, material);

        this.worldScene = worldScene;
        this.model = model;
        this.view = new NurbsSurfaceView();
        this.controller = new NurbsSurfaceController(this.model, this.view, this);

        // 補助グループを自身にぶら下げ
        this.view.lineGroup.name = "LineHelperGroup";
        if (!this.getObjectByName(this.view.lineGroup.name)) this.add(this.view.lineGroup);
        this.add(this.view.suggestionGroup);

        // 初期補助線生成
        this.view.regenerateLineHelpers(this.model, this);
    }

    override clone(recursive = true): this {
        const cloned = new (this.constructor as any)(this.model.surface, this.worldScene) as this;
        cloned.copy(this, recursive);
        return cloned;
    }

    // ---- ArchObject API 実装 ----
    onHelperClicked(helper: LineHelper | null) {
        this.controller.handleHelperClicked(helper);
    }

    update() {
        super.update();
        this.view.update();

        // 表示モードに応じた見た目
        if (this.mode === "NORMAL") {
            this.view.setActiveLine(false);
            this.material.wireframe = false;
            this.material.color.setHex(this.selected ? 0xffff88 : 0xffffff);
            if (this.selected) this.view.setActiveLine(true);
        } else if (this.mode === "EDITING") {
            this.material.wireframe = !this.selected;
            this.material.color.setHex(this.selected ? 0xffff88 : 0xffffff);
            this.view.setActiveLine(true);
        }
    }

    changeMode(mode: ModeType) {
        super.changeMode(mode);
        if (this.mode === "NORMAL") {
            this.view.selectHelper(null);
            this.view.clearSuggestions();
        }
    }

    sketchModify(scene: BackgroundScene, samples: THREE.Vector2[]) {
        console.log("here")
        this.controller.applySketch(scene, samples);
    }

    onEvent(code: EventCode) {
        this.controller.onEvent(code);
    }

    updateGeometry(surface: NurbsSurface |null =null) {
        // ジオメトリの差し替え
        this.geometry.dispose();
        if(surface) {
            this.model.surface = surface;
        }

        this.geometry = this.model.buildGeometry();

        // 補助線リフレッシュ
        this.view.regenerateLineHelpers(this.model, this);
    }


    onMoveStart() {
        this.moveBeginPos = this.position.clone();
    }

    onMove(delta: Vector3) {
        this.position.copy(this.moveBeginPos.clone().sub(delta));
    }
}




