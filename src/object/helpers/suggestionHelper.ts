
import {type BufferGeometry, Vector3} from "three";
import * as THREE from "three";
import type {EventCode} from "../../scene/worldScene.ts";

export class SuggestionHelper extends  THREE.Mesh {
    eventCallback:((event:EventCode) => void) | null

    constructor(geometry:BufferGeometry, material:THREE.MeshStandardMaterial, ) {
        super(geometry, material);
        this.eventCallback = null;
    }




    onEvent(code:EventCode) {
        if(this.eventCallback) this.eventCallback(code);
    }



}