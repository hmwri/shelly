import {Scene} from "./type.ts";
import type {WorldScene} from "./worldScene.ts";
import {Camera, OrthographicCamera, Vector2, Vector3} from "three";

import * as THREE from "three";

import {debugSphere, linspace} from "../utils/common.ts";
import {type NurbsCurve, NurbsSurface} from "../curve";
import {makeClampedUniformKnots} from "../utils/nurbs.ts";


export class BackgroundScene extends Scene {
    camera: OrthographicCamera;
    constructor(canvas : HTMLCanvasElement, worldScene:WorldScene, direction:"xy" | "xz") {
        super(canvas);
        this.THREEscene = worldScene.THREEscene
        this.camera =  new OrthographicCamera();
        this.onResize()
        this.camera.position.set(0,0,4);
        this.camera.lookAt(new Vector3(0,0,0))
        this.camera.layers.disable(1)
        this.onResize()
    }


    render() {
        const originalColor = this.THREEscene.background
        this.THREEscene.background = new THREE.Color(255,255,255)
        super.render();
        this.THREEscene.background = originalColor

    }

    addSketch(curve: NurbsCurve): void {


        curve.sampleN(100,
            (xy) => {
                const raycaster = new THREE.Raycaster();
                const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
                raycaster.setFromCamera(xy, this.camera);                 // Orthographic 対応済み
                const p = raycaster.ray.intersectPlane(plane, new Vector3());   // 交差が無ければ null
                // if(p) {
                //     debugSphere(this.THREEscene, p);
                // }
            })
        let points = []
        const PN = 5
        for(let i = 0; i < PN; i++){
            points.push(curve.points.map((v) => new Vector3(v.x, v.y, i)));
        }

        const uDegree = 3;

        let surface = new NurbsSurface(points, [ uDegree,curve.degree], [makeClampedUniformKnots(PN, uDegree),curve.knot]);
        // surface.sampleN(
        //     10,10,(p,u,v)=>{
        //         debugSphere(this.THREEscene, p);
        //     }
        // )

        this.add(new THREE.Mesh(surface.buildNurbsSurfaceGeometry(), new THREE.MeshStandardMaterial()))

    }

    setCamera() {

    }

    onResize() {
        super.onResize();
        const frustumSize = 2;
        const aspect = this.canvas.clientWidth/this.canvas.clientHeight;
        this.camera.left = -frustumSize * aspect / 2
        this.camera.right = frustumSize * aspect / 2
        this.camera.top = frustumSize / 2
        this.camera.bottom = -frustumSize / 2
    }
}