/**
 * B-spline basis functions in TypeScript
 * Implements:
 *  - clamped uniform knot vector generator
 *  - findSpan (binary search per The NURBS Book, Alg. A2.1)
 *  - basisFunctions (Alg. A2.2) : nonzero N_{i-p...i,p}(u)
 *  - dersBasisFuns (Alg. A2.3)  : derivatives up to nDers
 *
 * Notation:
 *  n = number of control points - 1
 *  p = degree
 *  U = knot vector of length m+1, where m = n + p + 1
 */

export type KnotVector = number[];

/** Generate a clamped uniform knot vector on [0,1]. */
export function makeClampedUniformKnots(nCtrl: number, degree: number): KnotVector {
    if (degree < 0) throw new Error("degree must be >= 0");
    if (nCtrl < degree + 1) throw new Error("nCtrl must be >= degree+1");
    const n = nCtrl - 1;
    const m = n + degree + 1;
    const U = new Array<number>(m + 1);

    // Clamp at both ends:
    for (let j = 0; j <= degree; j++) U[j] = 0;
    for (let j = m - degree; j <= m; j++) U[j] = 1;

    // Internal uniform knots (if any):
    const interior = m - 2 * degree - 1; // number of interior knots
    for (let j = 1; j <= interior; j++) {
        U[degree + j] = j / (interior + 1);
    }
    return U;
}


export function getParameterRange(U: KnotVector, degree: number): [number, number] {
    const m = U.length - 1; // last index of knot vector
    if (degree < 0) {
        throw new Error("Degree must be non-negative.");
    }
    if (U.length < 2 * degree + 2) {
        throw new Error("Knot vector too short for given degree.");
    }
    const tMin = U[degree];
    const tMax = U[m - degree];
    return [tMin, tMax];
}


/**
 * Find the span index i such that u in [U[i], U[i+1]).
 * If u == U[n+1] (the right end), returns i = n (last span).
 */
export function findClampedSpan(n: number, degree: number, u: number, U: KnotVector): number {
    if (u <= U[degree]) return degree;          // left clamp
    if (u >= U[n + 1]) return n;                // right clamp

    let low = degree;
    let high = n + 1;
    let mid = Math.floor((low + high) / 2);

    while (u < U[mid] || u >= U[mid + 1]) {
        if (u < U[mid]) high = mid;
        else low = mid;
        mid = Math.floor((low + high) / 2);
    }
    return mid;
}

/**
 * Nonzero basis functions at u.
 * Returns an array N[0..p] corresponding to N_{i-p,p}(u) ... N_{i,p}(u)
 * where i = span.
 */
export function basisFunctions(span: number, u: number, degree: number, U: KnotVector): number[] {
    const N = new Array<number>(degree + 1).fill(0);
    const left = new Array<number>(degree + 1).fill(0);
    const right = new Array<number>(degree + 1).fill(0);

    N[0] = 1.0;
    for (let j = 1; j <= degree; j++) {
        left[j] = u - U[span + 1 - j];
        right[j] = U[span + j] - u;
        let saved = 0.0;
        for (let r = 0; r < j; r++) {
            const denom = right[r + 1] + left[j - r];
            const temp = denom !== 0 ? N[r] / denom : 0;
            N[r] = saved + right[r + 1] * temp;
            saved = left[j - r] * temp;
        }
        N[j] = saved;
    }
    return N;
}

/**
 * Derivatives of nonzero basis functions up to order nDers at u.
 * Returns ders[k][j] = d^k/du^k N_{i-j, p}(u) for k=0..nDers, j=0..p
 */
export function dersBasisFuns(
    span: number,
    u: number,
    degree: number,
    nDers: number,
    U: KnotVector
): number[][] {
    const p = degree;
    const ders: number[][] = Array.from({ length: nDers + 1 }, () => new Array<number>(p + 1).fill(0));
    const ndu: number[][] = Array.from({ length: p + 1 }, () => new Array<number>(p + 1).fill(0));
    const left = new Array<number>(p + 1).fill(0);
    const right = new Array<number>(p + 1).fill(0);

    ndu[0][0] = 1.0;

    for (let j = 1; j <= p; j++) {
        left[j] = u - U[span + 1 - j];
        right[j] = U[span + j] - u;
        let saved = 0.0;
        for (let r = 0; r < j; r++) {
            const denom = right[r + 1] + left[j - r];
            const temp = denom !== 0 ? ndu[r][j - 1] / denom : 0;
            ndu[j][r] = right[r + 1] * temp;
            const val = saved + left[j - r] * temp;
            ndu[r][j] = val;
            saved = val - ndu[j][r];
        }
        ndu[j][j] = saved;
    }

    // Load the basis functions (k=0)
    for (let j = 0; j <= p; j++) ders[0][j] = ndu[j][p];

    // Compute derivatives (k>=1)
    const a: number[][] = [new Array<number>(p + 1).fill(0), new Array<number>(p + 1).fill(0)];

    for (let r = 0; r <= p; r++) {
        let s1 = 0, s2 = 1;
        a[0][0] = 1.0;

        for (let k = 1; k <= nDers; k++) {
            let d = 0.0;
            const rk = r - k;
            const pk = p - k;

            let j1 = 0;
            let j2 = 0;
            if (r >= k) {
                a[s2][0] = a[s1][0] / (right[r + 1] + left[k]);
                d = a[s2][0] * ndu[pk + 1][rk];
            } else a[s2][0] = 0.0;

            if (rk >= -1) j1 = 1; else j1 = -rk;
            if (r - 1 <= pk) j2 = k - 1; else j2 = p - r;

            for (let j = j1; j <= j2; j++) {
                a[s2][j] =
                    (a[s1][j] - a[s1][j - 1]) / (right[r + 1 - j] + left[k - j]);
                d += a[s2][j] * ndu[pk + 1][rk + j];
            }

            if (r <= pk) {
                a[s2][k] = -a[s1][k - 1] / (right[r + 1 - k] + left[0]);
                d += a[s2][k] * ndu[pk + 1][r];
            } else {
                a[s2][k] = 0.0;
            }

            ders[k][r] = d * factorial(p) / factorial(p - k);
            // switch rows
            const tmp = s1; s1 = s2; s2 = tmp;
        }
    }
    return ders;
}

function factorial(n: number): number {
    let v = 1;
    for (let i = 2; i <= n; i++) v *= i;
    return v;
}

/** Convenience: full set {N_{0,p},...,N_{n,p}} at u (mostly zeros). */
export function fullBasisAt(u: number, degree: number, U: KnotVector, nCtrl: number): number[] {
    const n = nCtrl - 1;
    const span = findClampedSpan(n, degree, u, U);
    const local = basisFunctions(span, u, degree, U);
    const N = new Array<number>(nCtrl).fill(0);
    for (let j = 0; j <= degree; j++) {
        N[span - degree + j] = local[j];
    }
    return N;
}
