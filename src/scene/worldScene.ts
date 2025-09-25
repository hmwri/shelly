import {Scene} from "./type.ts";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {TransformControls} from "three/examples/jsm/controls/TransformControls.js";
import {createCube} from "../mesh";

export class WorldScene extends Scene {
    constructor(canvas : HTMLCanvasElement) {
        super(canvas);
        const orbit = new OrbitControls(this.camera, this.renderer.domElement);
        const transformControls = new TransformControls(this.camera, this.renderer.domElement);
        const cube = createCube();

        this.add(cube)

        transformControls.attach(cube); // ← グリッドを操作対象にする
        // OrbitとTransformの競合を防ぐ
        transformControls.addEventListener('dragging-changed', (event) => {
            orbit.enabled = !event.value;
        });

        transformControls.getHelper().traverse(obj => obj.layers.set(1));
        transformControls.getRaycaster().layers.set(1)

        this.add(transformControls.getHelper());
    }


}