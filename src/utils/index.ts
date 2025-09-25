import { Vector2 } from "three";


/**
 * 総距離を N 分割してサンプリング
 * @param points 元の軌跡（順序付き）
 * @param n サンプリング点数（含まれる点数）
 * @returns 均等分割された新しい点群
 */
export function resampleByCount(points: Vector2[], n: number): Vector2[] {
    if (points.length < 2 || n <= 1) return points;

    // --- 総距離を計算 ---
    const distances: number[] = [0];
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        totalLength += points[i].distanceTo(points[i - 1]);
        distances.push(totalLength);
    }

    const resampled: Vector2[] = [];
    for (let i = 0; i < n; i++) {
        const targetDist = totalLength * (i + 0.5) / n

        // --- 対応する区間を探す ---
        let j = 1;
        while (j < distances.length && distances[j] < targetDist) j++;

        if (j >= distances.length) {
            resampled.push(points[points.length - 1].clone());
        } else {
            const d1 = distances[j - 1];
            const d2 = distances[j];
            const t = (targetDist - d1) / (d2 - d1);

            const p = points[j - 1].clone().lerp(points[j], t);
            resampled.push(p);
        }
    }

    return resampled;
}


