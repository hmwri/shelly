import type {NurbsSurface} from "../curve";
import * as THREE from "three";
import {linspace} from "../utils/common.ts";
import {LineGeometry} from "three/examples/jsm/lines/LineGeometry.js";
import {LineMaterial} from "three/examples/jsm/lines/LineMaterial.js";
import {Line2} from "three/examples/jsm/lines/Line2.js";

import {WorldScene} from "../scene";
import type {Vector3} from "three";


export class ArchObject extends THREE.Mesh {
    selected:boolean = false;
    lineHelpers:LineHelper[] = []
    lineHelperGroup: THREE.Group;

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
        super(geometry, material);
        this.lineHelperGroup = new THREE.Group();
        if(!this.getObjectByName("LineHelperGroup")){
            this.lineHelperGroup.name = "LineHelperGroup";
            this.add(this.lineHelperGroup);
        }


    }
    onClick() {
        console.log("here")
    }

    update() {

    }


}


export class LineHelper extends  Line2 {
    points:Vector3[] = [];
    color:number;
    lineWidth:number;
    hovering:boolean = false;
    constructor(points:Vector3[], color:number, lineWidth:number) {
        const geometry = new LineGeometry().setFromPoints(points);

        const material = new LineMaterial({
            color: color,      // 色
            linewidth: lineWidth,         // 線の太さ (ピクセル単位)
            // resolutionはレンダラーのサイズに設定する必要がある
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            depthTest: false,
        });
        super(geometry, material);
        this.points = points;
        this.color = color;
        this.lineWidth = lineWidth;

    }


    update() {
        if(this.hovering){
            this.material.color = new THREE.Color().setHex(0xffff00)
        }else{
            this.material.color = new THREE.Color().setHex(this.color);
        }
    }




    override clone(recursive = true): this {
        // surface を再利用して新インスタンスを作成
        const cloned = new (this.constructor as any)(this.points, this.color, this.lineWidth) as this;
        cloned.copy(this, recursive);
        return cloned;
    }

}

export class NurbsSurfaceObject extends ArchObject {
    surface:NurbsSurface;
    declare material: THREE.MeshStandardMaterial

    worldScene:WorldScene;


    constructor(surface:NurbsSurface, worldScene:WorldScene) {
        const geometry = surface.buildNurbsSolidGeometry();
        const material = new THREE.MeshStandardMaterial({
            side: THREE.DoubleSide
        }
        )

        super(geometry, material);
        this.worldScene = worldScene;
        this.surface = surface;

        const [vmin, vmax] =surface.domain_v;
        const vs = linspace(vmin, vmax, 10);

        for(const v of vs){
            this.addLineHelper(surface.sampleLineAlongU(v));
        }


        const [umin, umax] =surface.domain_u;
        const us = linspace(umin, umax, 10);
        for(const u of us){
            this.addLineHelper(surface.sampleLineAlongV(u));
        }
    }

    addLineHelper(points:THREE.Vector3[]) {
        const lineObject = new LineHelper(points, 0xff0000, 7);
        this.lineHelpers.push(lineObject);
        this.lineHelperGroup.add(lineObject);
    }

    removeLineHelper(line:LineHelper) {
        this.lineHelperGroup.remove(line);
        this.lineHelpers.splice(this.lineHelpers.indexOf(line), 1);
    }


    override clone(recursive = true): this {
        // surface を再利用して新インスタンスを作成
        const cloned = new (this.constructor as any)(this.surface, this.worldScene) as this;
        cloned.copy(this, recursive);
        return cloned;
    }


    update() {
        super.update();
        for(const line of this.lineHelpers) {
            line.update();
        }

        if(this.selected) {
            this.material.color = new THREE.Color().setHex(0xffff88);
            this.material.wireframe = false;
            for(const line of this.lineHelpers) {
                line.visible = true;
            }
        }else{
            this.material.color = new THREE.Color().setHex(0xffffff);
            this.material.wireframe = true;
            for(const line of this.lineHelpers) {
                line.visible = false;
            }
        }


    }


}


