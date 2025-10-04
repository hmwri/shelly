// commands.ts

import type { Vector3 } from "three";
import type {NurbsSurfaceObject} from "../object/NurbsSurfaceObject.ts";
import type {NurbsSurface} from "../curve";

type Axis = "u" | "v";

export class SetControlPointsCommand {
    private target: NurbsSurfaceObject;
    private oldSurface: NurbsSurface;
    private surface: NurbsSurface;

    constructor(opts: {
        target: NurbsSurfaceObject;
        oldSurface: NurbsSurface;
        surface: NurbsSurface;
    }) {
        this.target = opts.target;
        this.oldSurface = opts.oldSurface.clone();
        this.surface = opts.surface.clone();
    }

    private apply(surface: NurbsSurface) {
        this.target.surface = surface.clone();
        // surface -> geometry を再生成（LineHelperも貼り直し）
        this.target.updateGeometry(
            this.target.surface
        );

    }

    do()   { this.apply(this.surface); }
    undo() { this.apply(this.oldSurface); this.target.removeSuggestions();}


}