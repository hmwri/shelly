import {Mesh, MeshStandardMaterial, Scene, SphereGeometry, Vector2, type Vector3} from "three";

export function vec2ListTonumberList(v: Vector2[]) {
    return v.map(v =>  [v.x, v.y])
}

export function numberListToVec2List(list: number[][]): Vector2[] {
    return list.map(([x, y]) => new Vector2(x, y));
}

/**
 * Create an array of N evenly spaced values between start and end (inclusive).
 * @param start tMin
 * @param end tMax
 * @param N number of samples (>=2 recommended)
 * @returns number[]
 */
export function linspace(start: number, end: number, N: number): number[] {
    if (N < 2) {
        return [start]; // N=1 のときは start のみ
    }
    const step = (end - start) / (N - 1);
    return Array.from({ length: N }, (_, i) => start + step * i);
}


export function  debugSphere(scene: Scene, pos:Vector3) {
    const geometry = new SphereGeometry(0.1, 32, 16);
    const material = new MeshStandardMaterial({ color: 0x0077ff });
    const sphere = new Mesh(geometry, material);
    sphere.position.copy(pos);
    scene.add(sphere);
}