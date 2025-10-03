import type {NurbsSurface} from "../curve";
import * as THREE from "three";
import {linspace} from "../utils/common.ts";
import {LineGeometry} from "three/examples/jsm/lines/LineGeometry.js";
import {LineMaterial} from "three/examples/jsm/lines/LineMaterial.js";
import {Line2} from "three/examples/jsm/lines/Line2.js";

import {BackgroundScene, WorldScene} from "../scene";
import {type Camera, Vector2, type Vector3} from "three";
import type {ModeType} from "../types/nurbs";
import {fitBSprain} from "../utils/fitBSprain.ts";


export class ArchObject extends THREE.Mesh {
    selected:boolean = false;
    lineHelpers:LineHelper[] = []
    lineHelperGroup: THREE.Group;
    mode:ModeType = "NORMAL";

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

    onHelperClicked(helper:LineHelper|null) {

    }

    update() {

    }

    changeMode(mode:ModeType) {
        this.mode = mode;
    }

    sketchModify(scene:BackgroundScene, samples:THREE.Vector2[]){

    }


}


export class LineHelper extends  Line2 {
    points:Vector3[] = [];
    color:number;
    lineWidth:number;
    hovering:boolean = false;
    selecting:boolean = false;
    arch:ArchObject
    axis: "u"| "v"
    t:number
    constructor(points:Vector3[], color:number, lineWidth:number, axis:"u"| "v", t:number, arch:ArchObject) {
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
        this.arch = arch;
        this.axis = axis
        this.t = t

    }


    update() {
        this.material.color = new THREE.Color().setHex(this.color);
        this.material.linewidth = this.lineWidth + 2;
        if(this.hovering){
            this.material.color = new THREE.Color().setHex(0xffff00)
        }
        if(this.selecting) {
            this.material.color = new THREE.Color().setHex(0xff0000)
            this.material.linewidth = this.lineWidth + 12;
        }


    }

    onClick() {

    }


    override clone(recursive = true): this {
        // surface を再利用して新インスタンスを作成
        const cloned = new (this.constructor as any)(this.points, this.color, this.lineWidth, this.arch) as this;
        cloned.copy(this, recursive);
        return cloned;
    }

}

export class NurbsSurfaceObject extends ArchObject {
    surface:NurbsSurface;
    declare material: THREE.MeshStandardMaterial
    selectedLine: LineHelper | null = null;

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
        this.generateLineHelper()

    }

    generateLineHelper() {
        const [vmin, vmax] =this.surface.domain_v;
        const vs = linspace(vmin, vmax, 5);
        for(const v of vs){
            this.addLineHelper(this.surface.sampleLineAlongU(v), "u", v);
        }

        const [umin, umax] =this.surface.domain_u;
        const us = linspace(umin, umax, 5);
        for(const u of us){
            this.addLineHelper(this.surface.sampleLineAlongV(u), "v", u);
        }
    }

    addLineHelper(points:THREE.Vector3[], axis:"u"|"v", t:number) {
        const lineObject = new LineHelper(points, 0x220000, 7, axis, t, this);
        this.lineHelpers.push(lineObject);
        this.lineHelperGroup.add(lineObject);
    }

    removeLineHelper(line:LineHelper) {
        this.lineHelperGroup.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        this.lineHelpers.splice(this.lineHelpers.indexOf(line), 1);

    }


    override clone(recursive = true): this {
        // surface を再利用して新インスタンスを作成
        const cloned = new (this.constructor as any)(this.surface, this.worldScene) as this;
        cloned.copy(this, recursive);
        return cloned;
    }

    onHelperClicked(helper:LineHelper|null) {
        for(let h of this.lineHelpers){
            h.selecting = false;
        }
        this.selectedLine = helper;
        if(helper){
            helper.selecting = true;

        }

    }

    activeLine(v: boolean) {
        for(const line of this.lineHelpers) {
            line.visible = v;
        }
    }


    update() {
        super.update();
        for(const line of this.lineHelpers) {
            line.update();
        }
        if(this.mode == "NORMAL"){
            this.activeLine(false)
            this.material.wireframe = false;
            if(this.selected) {
                this.material.color = new THREE.Color().setHex(0xffff88);
                this.activeLine(true)

            }else{
                this.material.color = new THREE.Color().setHex(0xffffff);

            }
        }else if(this.mode == "EDITING"){

            if(this.selected) {
                this.material.color = new THREE.Color().setHex(0xffff88);
                this.material.wireframe = false;
                this.activeLine(true)
            }else{
                this.material.color = new THREE.Color().setHex(0xffffff);
                this.material.wireframe = true;

            }
        }




    }

    sketchModify(scene:BackgroundScene, samples:THREE.Vector2[]){
        const line = this.selectedLine
        if(!line) {
            return
        }
        const dirVec = scene.cameraVec.clone()
        const axis = line.axis

        const degree = this.surface.degree[axis == "u" ? 0 : 1];
        const nP = axis == "u" ? this.surface.points.length : this.surface.points[0].length;

        const curve = fitBSprain(samples, degree, nP);
        const projectedP = curve.points.map((xy) => {
            const p = scene.intersectPlane(xy, scene.plane);
            if (p == null) throw new Error("Unknown plane");
            return p;
        });

        const index = 0
        const originalP = this.surface.getControlPointVector(axis, index)
        console.log(originalP);
        const newP= []
        for (let i = 0; i < projectedP.length; i++) {
            const sketchP = projectedP[i].clone();
            newP.push(
                sketchP.add(originalP[i].clone().multiply(dirVec))
            );
        }

        this.surface.setControlPointVector(
            axis,index,newP.reverse()
        )

        console.log(newP);
        this.updateGeometry()
    }

    updateGeometry() {
        this.geometry.dispose();
        this.geometry = this.surface.buildNurbsSolidGeometry()
        for (const line of [...this.lineHelpers]) {
            this.removeLineHelper(line);
        }
        this.generateLineHelper();
    }

    changeMode(mode:ModeType) {
        super.changeMode(mode);
        if(this.mode == "NORMAL"){
            for(const line of this.lineHelpers) {
                line.selecting = false;
            }
        }

    }




}


