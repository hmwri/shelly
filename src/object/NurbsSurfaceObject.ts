import type {NurbsSurface} from "../curve";
import * as THREE from "three";
import {average, calcMAE, cosineSimilarity, deepCopyVector3Matrix, linspace, weightedAverage} from "../utils/common.ts";

import {BackgroundScene, WorldScene} from "../scene";
import {type BufferGeometry, type Camera, MeshStandardMaterial, Vector2, type Vector3} from "three";
import type {ModeType} from "../types/nurbs";
import {fitBSprain} from "../utils/fitBSprain.ts";
import  {HistoryManager} from "../history";
import {SetControlPointsCommand} from "../history/command.ts";
import {LineHelper, ThickLineHelper, UVLineHelper} from "./LineHelper.ts";
import {SuggestionHelper} from "./suggestionHelper.ts";
import type {EventCode} from "../scene/worldScene.ts";


export class ArchObject extends THREE.Mesh {
    selected:boolean = false;
    lineHelpers:LineHelper[] = []
    lineHelperGroup: THREE.Group;
    suggestionGroup: THREE.Group;
    mode:ModeType = "NORMAL";
    history: HistoryManager;
    moveBeginPos: THREE.Vector3 = new THREE.Vector3();


    constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
        super(geometry, material);
        this.lineHelperGroup = new THREE.Group();
        this.suggestionGroup = new THREE.Group();
        if(!this.getObjectByName("LineHelperGroup")){
            this.lineHelperGroup.name = "LineHelperGroup";
            this.add(this.lineHelperGroup);
        }
        this.add(this.suggestionGroup);
        this.history = new HistoryManager();

    }
    onClick() {
        console.log("here")
    }

    onHelperClicked(helper:LineHelper|null) {

    }

    isHelperSelected() {
        for(const helper of this.lineHelpers){
            if(helper.selecting) {
                return true;
            }
        }
        return false;
    }

    update() {

    }

    changeMode(mode:ModeType) {
        this.mode = mode;
    }

    sketchModify(scene:BackgroundScene, samples:THREE.Vector2[]){

    }
    onMoveStart(){
        this.moveBeginPos = this.position.clone();
    }

    onMove(delta:Vector3){
        this.position.copy(this.moveBeginPos.clone().sub(delta));
    }

    onEvent(code:EventCode) {
    }


    undo() { this.history.undo(); }
    redo() { this.history.redo(); }



}


const oppAxis : {"u": "v", "v" : "u"} = {"u" : "v", "v" : "u"}



export class NurbsSurfaceObject extends ArchObject {
    surface:NurbsSurface;
    declare material: THREE.MeshStandardMaterial
    selectedLine: LineHelper | null = null;
    geometryHistory : THREE.BufferGeometry[] = []
    surfaceHistory : NurbsSurface[] = []
    worldScene:WorldScene;
    suggestions: SuggestionHelper[] = [];




    constructor(surface:NurbsSurface, worldScene:WorldScene) {
        const geometry = surface.buildNurbsSolidGeometry();
        const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
        super(geometry, material);
        this.worldScene = worldScene;
        this.surface = surface;
        this.updateGeometry(this.surface);
        // this.history.execute(new SetControlPointsCommand({
        //     target: this,
        //     surface: surface
        // }));

    }

    generateLineHelper() {
        const [vmin, vmax] =this.surface.domain_v;
        const vs = linspace(vmin, vmax, 5);
        for(const v of vs){
            this.addLineHelper(this.surface.sampleLine("u", v), "u", v);
        }

        const [umin, umax] =this.surface.domain_u;
        const us = linspace(umin, umax, 5);
        for(const u of us){
            this.addLineHelper(this.surface.sampleLine("v", u), "v", u);
        }
        if(this.surface.gb) {
            const gb = this.surface.gb
            this.addThickLineHelper(gb.getVertices())
        }




    }

    addLineHelper(points:THREE.Vector3[], axis:"u"|"v", t:number) {
        const lineObject = new UVLineHelper(points, 0x220000, 7, axis, t, this);
        this.lineHelpers.push(lineObject);
        this.lineHelperGroup.add(lineObject);
    }

    addThickLineHelper(points:THREE.Vector3[]) {
        const lineObject = new ThickLineHelper(points, 0x220000, 7, this);
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
        if(line instanceof UVLineHelper) {
            this.removeSuggestions()
            const dirVec = scene.cameraVec.clone()
            const axis = line.axis
            const oAxis = oppAxis[axis]

            const degree = this.surface.degree[axis == "u" ? 0 : 1];
            const nP = this.surface.getNP(axis);
            //奥行方向の軸
            const nP2 = this.surface.getNP(oAxis);

            const curve = fitBSprain(samples, degree, nP);
            const projectedP = curve.points.map((xy) => {
                const p = scene.intersectPlane(xy, scene.plane);
                if (p == null) throw new Error("Unknown plane");
                p.sub(this.position)
                return p;
            });

            const originalCtrlPoints = this.surface.points


            function reverseCheck(originalP : Vector3[]) {
                const reverse = projectedP.slice().reverse();
                const original_s = cosineSimilarity(
                    originalP[0].clone().sub(originalP[originalP.length-1]),
                    projectedP[0].clone().sub(projectedP[projectedP.length-1])
                )
                const reverse_s = cosineSimilarity(
                    originalP[0].clone().sub(originalP[originalP.length-1]),
                    reverse[0].clone().sub(reverse[reverse.length-1]))

                return (original_s > reverse_s) ? projectedP : reverse;

            }

            function calcNewP(originalP:THREE.Vector3[], dirVec:Vector3, weight:number=1)
            {
                const w = new THREE.Vector3().setScalar(weight);
                const iw = new THREE.Vector3().setScalar(1.0-weight)

                const pP = reverseCheck(originalP)

                const candidate = pP.map(
                    (pp, i) =>  {
                        const wpp = pp.clone().multiplyScalar(weight);
                        const iwdirVec = dirVec.clone().multiplyScalar(weight).add(iw);
                        return  wpp.add(originalP[i].clone().multiply(iwdirVec));
                    }
                );
                return candidate;
            }

            function calcNewPwithDiff(originalP:THREE.Vector3[], dirVec:Vector3, diffs:Vector3[])
            {

                const pP = reverseCheck(originalP)

                const candidate = pP.map(
                    (pp, i) =>  {
                        const dirVec2 = new THREE.Vector3().setScalar(1).sub(dirVec)
                        return dirVec2.multiply(diffs[i]).add(originalP[i])
                    }
                );
                return candidate;
            }

            const basicSurface = this.surface.clone()
            const basis = this.surface.getControlPointVector(oAxis, 0, true).getBasis(line.t)

            {
                console.log("1")
                const newSurface = basicSurface.clone();

                for (let j = 0; j < nP2; j++) {
                    if (basis[j] >= 0.3) {
                        const index = j;
                        const originalP = basicSurface.getControlPointVector(axis, index) as Vector3[];
                        console.log(index)
                        const newP = calcNewP(originalP, dirVec)
                        newSurface.setControlPointVector(axis, index, newP);
                    }
                }

                const helper = new SuggestionHelper(newSurface.buildNurbsSolidGeometry(), new THREE.MeshStandardMaterial({
                    color: 0xff0000,     // 緑色
                    transparent: true,   // 透明を有効化
                    opacity: 0.2,        // 半透明 (0:完全透明, 1:不透明)
                }))
                this.addSuggestion(helper);

                helper.eventCallback = (event) => {
                    if(event === "RedButton") {
                        this.history.execute(new SetControlPointsCommand({
                            target: this,
                            surface: newSurface,
                            oldSurface: basicSurface,
                        }));
                    }
                }

                helper.onEvent("RedButton")
            }
            {
                console.log("2")
                //Suggestion2 すべて同じ
                const newSurface = basicSurface.clone();

                for (let j = 0; j < nP2; j++) {
                    const index = j;
                    const originalP = basicSurface.getControlPointVector(axis, index) as Vector3[];
                    const newP = calcNewP(originalP, dirVec)
                    newSurface.setControlPointVector(axis, index, newP);
                }

                const helper = new SuggestionHelper(newSurface.buildNurbsSolidGeometry(), new THREE.MeshStandardMaterial({
                    color: 0x00ff00,     // 緑色
                    transparent: true,   // 透明を有効化
                    opacity: 0.2,        // 半透明 (0:完全透明, 1:不透明)
                }))
                this.addSuggestion(helper);

                helper.eventCallback = (event) => {
                    if(event === "GreenButton") {
                        this.history.execute(new SetControlPointsCommand({
                            target: this,
                            surface: newSurface,
                            oldSurface: basicSurface,
                        }));
                    }
                }
            }

            //
            // {
            //     console.log("3")
            //     const newSurface = basicSurface.clone();
            //
            //     for (let j = 0; j < nP2; j++) {
            //         const index = j;
            //         const originalP = basicSurface.getControlPointVector(axis, index) as Vector3[];
            //         const newP = calcNewP(originalP, dirVec, basis[j])
            //         newSurface.setControlPointVector(axis, index, newP);
            //
            //     }
            //
            //
            //
            //     const helper = new SuggestionHelper(newSurface.buildNurbsSolidGeometry(), new THREE.MeshStandardMaterial({
            //         color: 0xffff00,     // 緑色
            //         transparent: true,   // 透明を有効化
            //         opacity: 0.2,        // 半透明 (0:完全透明, 1:不透明)
            //     }))
            //     this.addSuggestion(helper);
            //
            //     helper.eventCallback = (event) => {
            //         if(event === "YellowButton") {
            //             this.history.execute(new SetControlPointsCommand({
            //                 target: this,
            //                 surface: newSurface,
            //                 oldSurface: basicSurface,
            //             }));
            //         }
            //     }
            // }

            {
                console.log("4")
                //Diff(投影スケッチ制御点とLineHelperの疑似制御点（平均で推定））を利用
                const newSurface = basicSurface.clone();

                const avgs : THREE.Vector3[] = [];
                for (let j = 0; j < nP; j++) {
                    const avg =  weightedAverage(basicSurface.getControlPointVector(oAxis, j), basis);
                    avgs.push(avg);
                }


                const diffs : THREE.Vector3[] = avgs.map((avg,i) => projectedP[i].clone().sub(avg));
                console.log(diffs);

                for (let j = 0; j < nP2; j++) {
                    const index = j;
                    const originalP = basicSurface.getControlPointVector(axis, index) as Vector3[];
                    const newP = calcNewPwithDiff(originalP, dirVec, diffs);
                    newSurface.setControlPointVector(axis, index, newP);

                }



                const helper = new SuggestionHelper(newSurface.buildNurbsSolidGeometry(), new THREE.MeshStandardMaterial({
                    color: 0xffff00,     // 緑色
                    transparent: true,   // 透明を有効化
                    opacity: 0.2,        // 半透明 (0:完全透明, 1:不透明)
                }))
                this.addSuggestion(helper);

                helper.eventCallback = (event) => {
                    if(event === "YellowButton") {
                        this.history.execute(new SetControlPointsCommand({
                            target: this,
                            surface: newSurface,
                            oldSurface: basicSurface,
                        }));
                    }
                }
            }
        }


        //this.updateGeometry(this.surface.buildNurbsSolidGeometry(), this.surface)
    }
    addSuggestion(suggestion:SuggestionHelper){
        this.suggestions.push(suggestion);
        this.suggestionGroup.add(suggestion);
    }
    removeSuggestions(){
        for (const s of this.suggestions) {
            this.suggestionGroup.remove(s);
            s.geometry.dispose();
        }
        this.suggestions = []
    }

    onEvent(code:EventCode) {
        for(const s of this.suggestions) {
            s.onEvent(code);
        }
    }

    updateGeometry(surface: NurbsSurface) {
        // historyUpdateは常に false 想定（履歴はCommandに集約）
        console.log(this.surface);
        this.geometry.dispose(); // リーク対策
        this.geometry = surface.buildNurbsSolidGeometry();
        this.surface = surface;

        // 既存 LineHelper を張り替え
        for (const line of [...this.lineHelpers]) this.removeLineHelper(line);
        this.generateLineHelper();
    }

    /** Ctrl+Z / Ctrl+Shift+Z 用 */

    changeMode(mode:ModeType) {
        super.changeMode(mode);
        if(this.mode == "NORMAL"){
            for(const line of this.lineHelpers) {
                line.selecting = false;
            }
            this.removeSuggestions()
        }

    }


}


