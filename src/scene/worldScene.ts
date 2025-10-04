import {Scene} from "./type.ts";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {TransformControls} from "three/examples/jsm/controls/TransformControls.js";
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {NurbsSurfaceObject} from "../object/NurbsSurfaceObject.ts";
import * as THREE from "three";
import {STLExporter} from 'three/examples/jsm/exporters/STLExporter.js';
import type {ModeType} from "../types/nurbs";
import {LineHelper} from "../object/helpers/LineHelper.ts";
import { ArchObject } from "../object/base/ArchObject";

export type EventCode = "RedButton" | "GreenButton" | "BlueButton" | "YellowButton" ;
export class WorldScene extends Scene {


    selectingObject: ArchObject | null = null;
    objects: ArchObject[] = [];
    helpers: LineHelper[] = [];
    mode: ModeType = "NORMAL";


    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
        const orbit = new OrbitControls(this.camera, this.renderer.domElement);
        const transformControls = new TransformControls(this.camera, this.renderer.domElement);
        // const cube = createCube();
        //
        // this.add(cube)

        // transformControls.attach(cube); // ← グリッドを操作対象にする
        // // OrbitとTransformの競合を防ぐ
        // transformControls.addEventListener('dragging-changed', (event) => {
        //     orbit.enabled = !event.value;
        // });
        //
        // transformControls.getHelper().traverse(obj => obj.layers.set(1));
        // transformControls.getRaycaster().layers.set(1)
        //
        // this.add(transformControls.getHelper());

        const loader = new GLTFLoader();

        loader.load(
            'human.glb',  // public/models/human.glb に置く
            (gltf) => {
                const model = gltf.scene;
                this.add(model);

                // サイズや位置を調整
                model.scale.set(1, 1, 1);
                model.position.set(1, 0.2, 0)
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
            },
            (error) => {
                console.error('An error happened', error);
            }

        );

        window.addEventListener("DOMContentLoaded", () => {
            const greenBtn = document.getElementById("GreenButton");
            const redBtn = document.getElementById("RedButton");
            const yellowBtn = document.getElementById("YellowButton");
            greenBtn?.addEventListener("click", () => {
                console.log("green");
                this.sendEvent("GreenButton");
            });

            redBtn?.addEventListener("click", () => {
                console.log("red");
                this.sendEvent("RedButton");
            });

            yellowBtn?.addEventListener("click", () => {
                console.log("yellow");
                this.sendEvent("YellowButton");
            });
        });


        window.addEventListener('keydown', (e) => {
            if (e.key == "d") {
                if (this.selectingObject)
                    this.deleteObject(this.selectingObject)
                this.setMode("NORMAL")
            }
            if (e.key == "n") {
                this.setMode("NORMAL");
            }
            if(e.key == "v") {
                this.setMode("EDITING");
            }
            // const ctrl = e.ctrlKey || e.metaKey;
            // if (!ctrl) return;

            if (e.key.toLowerCase() === "z" && !e.shiftKey) {
                // Undo
                console.log("aa")
                if (this.selectingObject) this.selectingObject.undo();
                 // シーン全体で持つ場合
                e.preventDefault();
            } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
                // Redo
                if (this.selectingObject) this.selectingObject.redo();
                 // シーン全体で持つ場合
                e.preventDefault();
            }
            if(e.key == "Enter") {
                this.setMode("NORMAL");
            }
            if (e.key == "e") {
                let binary = true;
                const exporter = new STLExporter();
                const group = new THREE.Group();
                this.THREEscene.traverse(obj => {
                    const m = obj as THREE.Mesh;
                    if (m.isMesh && m instanceof ArchObject && m.visible && m.geometry) {
                        const clone = new THREE.Mesh(m.geometry, m.material);
                        // ワールド変換をジオメトリに焼き込む
                        const g = m.geometry.clone();
                        clone.updateWorldMatrix(true, false);
                        g.applyMatrix4(m.matrixWorld);
                        // 法線が無い/壊れている場合は再計算（任意）
                        if (!g.getAttribute('normal')) {
                            g.computeVertexNormals();
                        }
                        clone.geometry = g;
                        group.add(clone);
                    }
                });


                // STL 書き出し（binary: ArrayBuffer / text: string）
                const data = exporter.parse(group, { binary });
                const blob = new Blob([data as unknown as ArrayBuffer], {
                    type: binary ? 'application/octet-stream' : 'text/plain'
                });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${group.name || 'mesh'}.stl`;
                a.click();
                URL.revokeObjectURL(a.href);
            }
        })

    }

    onPointerDown(event: PointerEvent) {

    }

    sendEvent(code:EventCode) {
        for(const obj of this.objects) {
            obj.onEvent(code)
        }
    }

    setMode(mode: ModeType) {
        this.mode = mode;
        for(const object of this.objects) {
            object.changeMode(mode);
        }
        if(this.mode === "NORMAL") {
            this.selectObject(null);
        }
    }


    selectObject(object: ArchObject | null) {
        if (this.selectingObject) {
            this.selectingObject.selected = false;
        }
        if(object) {
            this.selectingObject = object;
            object.selected = true;
        }
    }

    deleteObject(object: ArchObject) {
        if (this.selectingObject == object) {
            this.selectingObject = null;
        }
        this.objects.splice(this.objects.indexOf(object), 1);
        this.THREEscene.remove(object);
    }

    onPointerMove(event: PointerEvent) {
        if(this.mode == "EDITING") {
            if(this.selectingObject) {
                const intersects = this.intersectObjects(
                    this.eventPosToNDC(event),
                    this.selectingObject.lineHelpers,
                    false,
                    true,
                )
                let selectingD = 1000000;
                for(const h of this.selectingObject.lineHelpers) {
                    h.hovering = false;
                }
                for (const intersect of intersects) {
                    const obj = intersect.object

                    if (obj instanceof LineHelper && selectingD > intersect.distance) {
                        selectingD = intersect.distance;
                        obj.hovering = true;
                    }
                }
            }

        }

    }

    showDoubleSide(doubleSide:boolean) {
        for(const obj of this.objects) {
            if(obj instanceof NurbsSurfaceObject) {
                obj.material.side = doubleSide ? THREE.DoubleSide : THREE.FrontSide;
            }
        }
    }


    onPointerClicked(event: PointerEvent) {
        if(this.mode == "EDITING" && this.selectingObject) {
            const intersects = this.intersectObjects(
                this.eventPosToNDC(event),
                this.selectingObject.lineHelpers,
                false,
                true,
            )
            let selectingD = 1000000;
            let selected : LineHelper | null = null;
            for (const intersect of intersects) {
                const obj = intersect.object

                if (obj instanceof LineHelper && selectingD > intersect.distance) {
                    selectingD = intersect.distance;
                    selected = intersect.object;
                }
            }

            this.selectingObject.onHelperClicked(selected);


        }
        if(this.mode == "NORMAL") {
            const intersects = this.intersectObjects(
                this.eventPosToNDC(event),
                this.objects,
                false,
                true,
            )
            let selectingD = 1000000;
            let isClicked = false;
            for (const intersect of intersects) {
                const obj = intersect.object

                if (obj instanceof ArchObject && selectingD > intersect.distance) {
                    selectingD = intersect.distance;
                    this.selectObject(obj)
                    isClicked = true;
                }

            }
            if(isClicked) {
                this.setMode("EDITING");
            }
        }

    }

    addObject(object: ArchObject) {
        this.objects.push(object);
        object.mode = this.mode;
        this.add(object);
        return object;
    }

    registHelper(helper: LineHelper) {
        this.helpers.push(helper);
        this.add(helper);
        return helper
    }

    render() {
        super.render();
        for (let obj of this.objects) {
            obj.update();
        }
    }


}