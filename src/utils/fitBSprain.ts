import type {Vector2} from "three";
import {linspace, vecListTonumberList} from "./common.ts";

import {
    fullBasisAt,
    getParameterRange,
    makeClampedUniformKnots
} from "./nurbs.ts";
import {OLS} from "./optim.ts";
import {NurbsCurve} from "../curve";

//任意の軌跡をOpenUniformBSprainに近似
export function fitBSprain(
    points: Vector2[],
    degree:number = 3,
    n_controlPoint:number = 6,
    type:"ClampedUniform" = "ClampedUniform",
) {

    let knots :number[] = [];
    if(type == "ClampedUniform"){
        knots = makeClampedUniformKnots(n_controlPoint, degree)
    }
    const [tMin, tMax] = getParameterRange(knots, degree);
    const ts = linspace(tMin, tMax, points.length);
    let X = []
    let constants:Vector2[] = [];


    let y = vecListTonumberList(points);
    let start_P = points[0].clone()
    let end_P = points[points.length-1].clone()

    for(let i = 0; i < ts.length ; i++){
        const t = ts[i];
        const Ns = fullBasisAt(t,degree, knots, n_controlPoint);
        if(type == "ClampedUniform"){
            //始点と終点に制御点を一致させるための処理
            constants.push(start_P.clone().multiplyScalar(Ns[0]).add(end_P.clone().multiplyScalar(Ns[n_controlPoint-1])))
            X.push(Ns.slice(1, n_controlPoint-1));
        }else{
            X.push(Ns);
        }
    }

    if(type == "ClampedUniform"){
        y = y.map((vec, i) => {return [vec[0] - constants[i].x, vec[1] - constants[i].y];});
    }

    const model = new OLS(false, 0).fit(X, y);

    let P = model.weights!;

    if(type == "ClampedUniform"){
        P = [start_P.toArray(), ...P, end_P.toArray()];
    }

    return new NurbsCurve(
        P,
        degree,
        knots,
    )

}