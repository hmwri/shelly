import * as THREE from "three";
import {PerspectiveCamera, Vector3} from "three";
import {CanvasBase} from "../canvas/canvasBase.ts";
import type {ArchObject} from "../object/NurbsSurfaceObject.ts";

export class Scene extends CanvasBase {
    THREEscene : THREE.Scene
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera
    dir : THREE.DirectionalLight
    renderer: THREE.WebGLRenderer
    //objects: ArchObject[] = [];
    raycaster : THREE.Raycaster;

    constructor(canvas : HTMLCanvasElement) {
        super(canvas);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f1a2a);
        this.THREEscene = scene

        const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
        camera.position.set(2.5, 2, 3);
        camera.lookAt(0, 0, 0);
        camera.layers.enable(1)

        this.camera = camera

        scene.add(new THREE.AmbientLight(0xffffff, 0.3));
        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(2, 3, 4);
        scene.add(dir);
        this.dir = dir

        const r = new THREE.WebGLRenderer({ canvas, antialias: true });
        r.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.renderer = r


        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line2 = { threshold: 2 };


        // グリッドヘルパーを作成
// 引数: サイズ, 分割数, 中心線の色, グリッド線の色
        const size = 10;         // 全体の幅
        const divisions = 10;    // 分割数
        const gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x888888);

// シーンに追加
        scene.add(gridHelper);
    }

    add(object:THREE.Object3D) {
        this.THREEscene.add(object)
    }




    intersectPlane(xy:THREE.Vector2, plane:THREE.Plane, normalize:boolean = false){

        if(normalize){
            xy = this.canvasPosToNDC(xy)
        }
        this.raycaster.setFromCamera(xy, this.camera);
        return  this.raycaster.ray.intersectPlane(plane, new Vector3());
    }

    intersectObjects<T extends THREE.Object3D>(xy:THREE.Vector2, objects:T[],normalize:boolean = false,recursive:boolean=false)
    :THREE.Intersection<T>[]{
        if(normalize){
            xy = this.canvasPosToNDC(xy)
        }
        this.raycaster.setFromCamera(xy, this.camera);
        return  this.raycaster.intersectObjects(objects,recursive);
    }

    isIntersect(xy:THREE.Vector2, object:THREE.Object3D): boolean {
        this.raycaster.setFromCamera(xy, this.camera);
        return this.raycaster.intersectObjects([object], true).length >= 1;
    }

    // switchWireframeVisibility(visible = false){
    //     this.THREEscene.traverse((obj3d) => {
    //         if(obj3d.material){
    //             obj3d.material.wireframe = visible;
    //         }
    //         if(Array.isArray(obj3d.material)){
    //             obj3d.material.forEach(function(mat, idx){
    //                 mat.wireframe = visible;
    //             });
    //         }
    //     });
    // }

    render() {
        this.renderer.render(this.THREEscene, this.camera)
    }


    onResize() {
        super.onResize();
        if(this.camera instanceof PerspectiveCamera) {
            this.camera.aspect = this.w / this.h;
        }


        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.w, this.h, false);
    }

    dispose() {
        this.renderer.dispose()
    }
}

