import {Vector2, Vector3} from "three";
import  {type NurbsObject} from "nurbs";
import nurbs from "nurbs";
import {linspace, numberListToVec2List, vec2ListTonumberList} from "../utils/common.ts";
import {isArray} from "mathjs";

export class NurbsCurve {
    points: Vector2[]
    degree:number
    knot:number[]
    curve:NurbsObject
    domain:number[]

    constructor(points: Vector2[] | number[][], degree:number, knot:number[]) {
        if(isArray(points)){
            this.points = numberListToVec2List(points as number[][])
        }else{
            this.points = points;
        }
        this.degree = degree;
        this.knot = knot;
        this.curve = nurbs(
            {
                points: isArray(points)? points as number[][] : vec2ListTonumberList(points),
                degree: degree,
                knots: [knot],
            }
        )
        this.domain = this.curve.domain[0]
    }

    sample(t:number) {
        if(this.domain[0] > t || this.domain[1] < t){
            throw new Error("Out of Domain");
        }
        let out:number[] = []
        this.curve.evaluate(out, t)
        return new Vector2(out[0], out[1])
    }

    sampleN(N:number=100, callback:((xy :Vector2) => any) |null = null) {
        let ts = linspace(this.curve.domain[0][0], this.curve.domain[0][1], N)
        for (let t of ts) {
            let xy = this.sample(t)
            if(callback) {
                callback(xy)
            }
        }
    }
}