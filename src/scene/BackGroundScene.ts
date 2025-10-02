import {Scene} from "./type.ts";
import type {WorldScene} from "./worldScene.ts";
import {Camera, OrthographicCamera, Vector2, Vector3} from "three";

import * as THREE from "three";

import {NurbsCurve, NurbsSurface} from "../curve";
import {makeClampedUniformKnots} from "../utils/nurbs.ts";
import {NurbsSurfaceObject} from "../object/NurbsSurfaceObject.ts";


type direction = "xy" | "xz"|"yz"
const directionToCameraVec : Record<direction, Vector3> = {
    "xy": new THREE.Vector3(0, 0, 1),
    "xz": new THREE.Vector3(0, 1, 0),
    "yz": new THREE.Vector3(1, 0, 0)
}

export class BackgroundScene extends Scene {
    camera: OrthographicCamera;
    plane:THREE.Plane;
    cameraVec : Vector3;
    worldScene: WorldScene;
    frustumSize: number = 10;
    constructor(canvas : HTMLCanvasElement, worldScene:WorldScene, direction:direction) {
        super(canvas);
        this.THREEscene = worldScene.THREEscene
        this.camera =  new OrthographicCamera();
        this.cameraVec = directionToCameraVec[direction].clone()
        this.camera.position.copy(this.cameraVec.clone().multiplyScalar(4));
        // 向きごとの位置と up を正しく設定
        if (direction === "xy") {
            this.camera.up.set(0, 1, 0);
        } else if (direction === "xz") {
            this.camera.up.set(0, 0, 1);
        } else { // "yz"
            this.camera.up.set(0, 1, 0);   // Z を上に（視線が -X なので up は Z）

        }
        this.plane = new THREE.Plane(this.cameraVec, 0);
        this.worldScene = worldScene;


        this.camera.lookAt(new Vector3(0,0,0))
        this.camera.layers.disable(1)
        this.onResize()
    }

    render() {
        const originalColor = this.THREEscene.background
        this.THREEscene.background = new THREE.Color(255,255,255)
        this.worldScene.showDoubleSide(true)
        super.render();
        this.THREEscene.background = originalColor
        this.worldScene.showDoubleSide(false)
    }

    onScroll(event:WheelEvent) {
        console.log(event)
        this.frustumSize += 0.1
        this.updateCamera()
    }

    addSketch(curve: NurbsCurve): void {

        let projectedP =             curve.points.map((xy) => {
                const p =  this.intersectPlane(xy, this.plane)
                if(p == null) throw new Error("Unknown plane")
                return p
            })


        let points = []
        const PN = 5
        for(let i = 0; i < PN; i++){
            points.push(projectedP.map((v) => v?.clone().add(this.cameraVec.clone().multiplyScalar(i - PN/2))));
        }
        console.log(points)
        const uDegree = 3;

        let surface = new NurbsSurface(points, [ uDegree,curve.degree], [makeClampedUniformKnots(PN, uDegree),curve.knot]);
        // surface.sampleN(
        //     10,10,(p,u,v)=>{
        //         debugSphere(this.THREEscene, p);
        //     }
        // )

        const obj = this.worldScene.addObject(new NurbsSurfaceObject(surface, this.worldScene))
        this.worldScene.selectObject(obj)
        this.worldScene.mode = "EDITING"


    }




    updateCamera() {
        const frustumSize = this.frustumSize;
        const aspect = this.canvas.clientWidth/this.canvas.clientHeight;
        this.camera.left = -frustumSize * aspect / 2
        this.camera.right = frustumSize * aspect / 2
        this.camera.top = frustumSize / 2
        this.camera.bottom = -frustumSize / 2
        this.camera.updateProjectionMatrix()
    }

    onResize() {
        super.onResize();
        this.updateCamera();

    }
}