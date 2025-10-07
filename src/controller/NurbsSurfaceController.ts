// =============================================
// File: controller/NurbsSurfaceController.ts
// =============================================
import * as THREE from "three";
import type { Vector2, Vector3 } from "three";
import type { BackgroundScene } from "../scene";
import { weightedAverage, cosineSimilarity } from "../utils/common.ts";
import { fitBSprain } from "../utils/fitBSprain.ts";
import { SuggestionHelper } from "../object/helpers/suggestionHelper.ts";
import {linearWeights, SetControlPointsCommand, SetThicknessCommand, weightedCenterIndex} from "../history/command.ts";
import type { NurbsSurface } from "../curve";
import type { EventCode } from "../scene/worldScene.ts";
import {LineHelper, ThickLineHelper, UVLineHelper} from "../object/helpers/LineHelper.ts";
import { NurbsSurfaceModel } from "../model/NurbsSurfaceModel";
import { NurbsSurfaceView } from "../view/NurbsSurfaceView";
import type { NurbsSurfaceObject } from "../object/NurbsSurfaceObject";


const oppAxis: { u: "v"; v: "u" } = { u: "v", v: "u" } as const;

export class NurbsSurfaceController {
    readonly model: NurbsSurfaceModel;
    readonly view: NurbsSurfaceView;
    /** コマンド適用先（HistoryManager を保持） */
    private owner: NurbsSurfaceObject;

    private selectedLine: LineHelper | null = null;

    constructor(model: NurbsSurfaceModel, view: NurbsSurfaceView, owner: NurbsSurfaceObject) {
        this.model = model;
        this.view = view;
        this.owner = owner;
    }

    handleHelperClicked(helper: LineHelper | null) {
        this.selectedLine = helper;
        this.view.selectHelper(helper);
    }

    onEvent(code: EventCode) {
        if (code == "ToolFillSolid") {
            this.model.buildType = "N"
            this.owner.updateGeometry()
            return
        }

        if (code == "ToolFillHStripe") {
            this.model.buildType = "U"
            this.owner.updateGeometry()
            return
        }
        if (code == "ToolFillVStripe") {
            this.model.buildType = "V"
            this.owner.updateGeometry()
            return
        }
        if (code == "ToolFillGrid") {
            this.model.buildType = "UV"
            this.owner.updateGeometry()
            return
        }

        for (const s of this.view.suggestions) s.onEvent(code);
    }

    /**
     * 旧 sketchModify のロジック
     */
    applySketch(scene: BackgroundScene, samples: Vector2[]) {
        const line = this.selectedLine
        if (!line) return;
        this.view.clearSuggestions();
        if(line instanceof UVLineHelper) {
            this.applyUVSketch(scene, samples, line)
        }
        if(line instanceof ThickLineHelper) {
            this.applyThichnessSketch(scene, samples, line)
        }


    }

    applyThichnessSketch(scene: BackgroundScene, samples: Vector2[], line: ThickLineHelper) {
        const projectedP: THREE.Vector3[] = samples.map((xy) => {
            const p = scene.intersectPlane(xy, scene.plane);
            if (p == null) throw new Error("Unknown plane");
            p.sub(this.owner.position); // ローカル化
            return p;
        });

        const l = projectedP[0].sub(projectedP[projectedP.length - 1]).length()
        this.owner.history.execute(
            new SetThicknessCommand(
                {
                    target:this.owner,
                    corner:line.loc,
                    oldThickness:this.model.cornerThicknesses[line.loc],
                    thickness:l
                }


            )
        )
    }

    applyUVSketch(scene: BackgroundScene, samples: Vector2[], line:UVLineHelper) {
        const axis = line.axis;
        const oAxis = oppAxis[axis];
        const dirVec = scene.cameraVec.clone();

        const degree = this.model.surface.degree[axis === "u" ? 0 : 1];
        const nP = this.model.surface.getNP(axis);
        const nP2 = this.model.surface.getNP(oAxis); // 奥行方向

        const curve = fitBSprain(samples, degree, nP);
        const projectedP: THREE.Vector3[] = curve.points.map((xy) => {
            const p = scene.intersectPlane(xy as Vector2, scene.plane);
            if (p == null) throw new Error("Unknown plane");
            p.sub(this.owner.position.clone()); // ローカル化
            return p;
        });

        const basicSurface = this.model.surface.clone();
        const basis = this.model.surface
            .getControlPointVector(oAxis, 0, true)
            .getBasis(line.t);

        // --- 内部ユーティリティ ---
        const reverseCheck = (originalP: Vector3[]) => {
            const reverse = projectedP.slice().reverse();
            const a = originalP[0].clone().sub(originalP[originalP.length - 1]);
            const b = projectedP[0].clone().sub(projectedP[projectedP.length - 1]);
            const c = reverse[0].clone().sub(reverse[reverse.length - 1]);
            const original_s = cosineSimilarity(a, b);
            const reverse_s = cosineSimilarity(a, c);
            return original_s > reverse_s ? projectedP : reverse;
        };

        const calcNewP = (originalP: Vector3[], dirVec: Vector3, weight = 1) => {
            const pP = reverseCheck(originalP);
            return pP.map((pp, i) => {
                const wpp = pp.clone().multiplyScalar(weight);
                const iwdir = dirVec.clone().multiplyScalar(weight).addScalar(1.0 - weight);
                return wpp.add(originalP[i].clone().multiply(iwdir));
            });
        };

        const calcNewPwithDiff = (originalP: Vector3[], dirVec: Vector3, diffs: Vector3[]) => {
            const dirVec2 = new THREE.Vector3(1, 1, 1).sub(dirVec);
            return diffs.map((d, i) => dirVec2.clone().multiply(d).add(originalP[i]));
        };



        // ========== Suggestion 1: 基底に閾値をかけて一部のみ更新 ==========
        {
            const newSurface: NurbsSurface = basicSurface.clone();
            for (let j = 0; j < nP2; j++) {
                if (basis[j] >= 0.3) {
                    const originalP = basicSurface.getControlPointVector(axis, j) as Vector3[];
                    const newP = calcNewP(originalP, dirVec);
                    newSurface.setControlPointVector(axis, j, newP);
                }
            }
            const helper = new SuggestionHelper(
                new NurbsSurfaceModel(newSurface).buildGeometry(),
                new THREE.MeshStandardMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 })
            );
            this.view.addSuggestion(helper);

            helper.eventCallback = (event) => {
                if (event === "YellowButton") {
                    this.view.setActiveSuggestion(true)
                    helper.visible = false
                    this.owner.history.execute(
                        new SetControlPointsCommand({
                            target: this.owner,
                            surface: newSurface,
                            oldSurface: basicSurface,
                        })
                    );
                }
            };
            // 初期プレビュー用に任意で反応させたい場合
            helper.onEvent("YellowButton");
        }

        // ========== Suggestion 2: 全断面を一律更新 ==========
        {
            const newSurface: NurbsSurface = basicSurface.clone();
            const center = weightedCenterIndex(basis)
            const w = linearWeights(basis.length, center);
            for (let j = 0; j < nP2; j++) {
                const originalP = basicSurface.getControlPointVector(axis, j) as Vector3[];
                const newP = calcNewP(originalP, dirVec, w[j]);
                newSurface.setControlPointVector(axis, j, newP);
            }
            const helper = new SuggestionHelper(
                new NurbsSurfaceModel(newSurface).buildGeometry(),
                new THREE.MeshStandardMaterial({ color: 0xff0000, transparent: true, opacity: 0.3 })
            );
            this.view.addSuggestion(helper);
            helper.eventCallback = (event) => {
                if (event === "RedButton") {
                    this.view.setActiveSuggestion(true)
                    helper.visible = false
                    this.owner.history.execute(
                        new SetControlPointsCommand({
                            target: this.owner,
                            surface: newSurface,
                            oldSurface: basicSurface,
                        })
                    );
                }
            };
        }

        // ========== Suggestion 3: Diff を用いた更新（黄色） ==========
        {
            const newSurface: NurbsSurface = basicSurface.clone();

            // 疑似制御点（奥行き方向の加重平均）
            const avgs: THREE.Vector3[] = [];
            for (let j = 0; j < nP; j++) {
                const avg = weightedAverage(basicSurface.getControlPointVector(oAxis, j), basis);
                avgs.push(avg);
            }
            const diffs: THREE.Vector3[] = avgs.map((avg, i) => projectedP[i].clone().sub(avg));

            for (let j = 0; j < nP2; j++) {
                const originalP = basicSurface.getControlPointVector(axis, j) as Vector3[];
                const newP = calcNewPwithDiff(originalP, dirVec, diffs);
                newSurface.setControlPointVector(axis, j, newP);
            }

            const helper = new SuggestionHelper(
                new NurbsSurfaceModel(newSurface).buildGeometry(),
                new THREE.MeshStandardMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3 })
            );
            this.view.addSuggestion(helper);
            helper.eventCallback = (event) => {
                if (event === "GreenButton") {
                    this.view.setActiveSuggestion(true)
                    helper.visible = false
                    this.owner.history.execute(
                        new SetControlPointsCommand({
                            target: this.owner,
                            surface: newSurface,
                            oldSurface: basicSurface,
                        })
                    );
                }
            };
        }
    }
}
