// =============================================
// File: view/NurbsSurfaceView.ts
// =============================================
import * as THREE from "three";
import type { NurbsSurface } from "../curve";
import { linspace } from "../utils/common.ts";
import { LineHelper, ThickLineHelper, UVLineHelper } from "../object/helpers/LineHelper.ts";
import { SuggestionHelper } from "../object/helpers/suggestionHelper.ts";
import type {NurbsSurfaceModel} from "../model/NurbsSurfaceModel.ts";
import type {ArchObject} from "../object/base/ArchObject.ts";

export class NurbsSurfaceView {
    readonly lineGroup = new THREE.Group();
    readonly suggestionGroup = new THREE.Group();

    lineHelpers: LineHelper[] = [];
    suggestions: SuggestionHelper[] = [];

    /** 既存の補助線を全て破棄 */
    private clearLineHelpers() {
        for (const line of this.lineHelpers) {
            this.lineGroup.remove(line);
            line.geometry.dispose();
            (line.material as any)?.dispose?.();
        }
        this.lineHelpers = [];
    }

    /** Surface から補助線を再生成 */
    regenerateLineHelpers(model:NurbsSurfaceModel, owner: ArchObject) {
        this.clearLineHelpers();

        const [vmin, vmax] = model.surface.domain_v;
        const vs = linspace(vmin, vmax, 5);
        for (const v of vs) {
            const pts =  model.surface.sampleLine("u", v);
            const line = new UVLineHelper(pts, 0x220000, 7, "u", v, owner);
            this.lineHelpers.push(line);
            this.lineGroup.add(line);
        }

        const [umin, umax] =  model.surface.domain_u;
        const us = linspace(umin, umax, 5);
        for (const u of us) {
            const pts =  model.surface.sampleLine("v", u);
            const line = new UVLineHelper(pts, 0x220000, 7, "v", u, owner);
            this.lineHelpers.push(line);
            this.lineGroup.add(line);
        }

        for (const [key, vt] of Object.entries(model.cornerTopVertexes)) {
            const v = model.cornerVertexes[key]
            const line = new ThickLineHelper([v, vt], 0x220000, 7, owner);
            this.lineHelpers.push(line);
            this.lineGroup.add(line);

        }



    }

    /** 可視・不可視の切り替え */
    setActiveLine(visible: boolean) {
        for (const l of this.lineHelpers) l.visible = visible;
    }

    /** 選択中補助線のフラグ更新 */
    selectHelper(helper: LineHelper | null) {
        for (const h of this.lineHelpers) h.selecting = false;
        if (helper) helper.selecting = true;
    }

    update() {
        for (const l of this.lineHelpers) l.update();
    }

    // ---------- Suggestions ----------
    addSuggestion(s: SuggestionHelper) {
        this.suggestions.push(s);
        this.suggestionGroup.add(s);
    }

    clearSuggestions() {
        for (const s of this.suggestions) {
            this.suggestionGroup.remove(s);
            s.geometry.dispose();
        }
        this.suggestions = [];
    }
}