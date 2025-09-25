// npm i mathjs
import { qr, transpose, multiply, usolve, identity, sqrt, zeros  } from "mathjs";

export class OLS {

    fitIntercept:boolean = true;
    ridge:number = 1e-8;
    constructor(
        fitIntercept: boolean,
        ridge: number = 1e-8
    ) {
        this.fitIntercept = fitIntercept;
        this.ridge = ridge;
    }

    // 学習後に参照できる値
    weights: number[][] | null = null;   // p × m
    intercept: number[] | null = null;   // m
    mse: number[] | null = null;         // m
    r2: number[] | null = null;          // m

    private p = 0;  // 特徴量数
    private m = 0;  // 出力次元

    fit(X: number[][], Y: number[][]): this {
        if (X.length === 0 || Y.length === 0) throw new Error("X or Y empty");
        if (X.length !== Y.length) throw new Error("row mismatch");
        this.p = X[0].length;
        this.m = Y[0].length;

        // Xa: [1, X] もしくは X
        const Xa = this.fitIntercept ? X.map(r => [1, ...r]) : X;
        const n = Xa.length;
        const pEff = Xa[0].length; // p+1 or p

        // Ridge ありなら拡張行列で安定に
        let XaUse: number[][];
        let YUse: number[][];
        if (this.ridge > 0) {
            const I = (identity(pEff) as any).toArray?.() ?? identity(pEff);
            const S = (multiply(sqrt(this.ridge), I) as any).toArray?.() ?? multiply(sqrt(this.ridge), I);
            const Z = (zeros(pEff, this.m) as any).toArray?.() ?? zeros(pEff, this.m);
            XaUse = (Xa as any).slice(); // shallow copy
            YUse  = (Y  as any).slice();
            XaUse = XaUse.concat(S as number[][]);
            YUse  = YUse.concat(Z as number[][]);
        } else {
            XaUse = Xa;
            YUse  = Y;
        }

        // QR 分解
        const { Q, R } = qr(XaUse as any) as any;
        const QtY = multiply(transpose(Q), YUse) as any;

        // 先頭 pEff×pEff の上三角 R と、先頭 pEff 行の Q^T Y を使う
        const Rarr: number[][] = R.toArray?.() ?? R;
        const QtYarr: number[][] = QtY.toArray?.() ?? QtY;
        const Rtop = Rarr.slice(0, pEff).map((row: number[]) => row.slice(0, pEff));
        const QtYtop = QtYarr.slice(0, pEff);

        // 列ごとに R * b_j = (Q^T Y)_j を後退代入
        const B: number[][] = Array.from({ length: pEff }, () => Array(this.m).fill(0));
        for (let j = 0; j < this.m; j++) {
            const rhs = QtYtop.map(r => r[j]);                 // 長さ pEff
            const bj = usolve(Rtop as any, rhs as any) as any; // 返り値は [[...]]
            const bjArr: number[] = (bj.toArray?.() ?? bj).map((v: number[]) => v[0]);
            for (let i = 0; i < pEff; i++) B[i][j] = bjArr[i];
        }

        if (this.fitIntercept) {
            this.intercept = B[0].slice();   // 1×m
            this.weights   = B.slice(1);     // p×m
        } else {
            this.intercept = new Array(this.m).fill(0);
            this.weights   = B;              // p×m
        }

        // 学習データで簡易評価（MSE, R²）
        const Yhat = this.predict(X);
        const n0 = Y.length, m0 = this.m;
        const meanY = Array(m0).fill(0);
        for (let i = 0; i < n0; i++) for (let j = 0; j < m0; j++) meanY[j] += Y[i][j];
        for (let j = 0; j < m0; j++) meanY[j] /= n0;

        const mse = Array(m0).fill(0);
        const r2  = Array(m0).fill(0);
        for (let j = 0; j < m0; j++) {
            let sse = 0, sst = 0;
            for (let i = 0; i < n0; i++) {
                const e = Y[i][j] - Yhat[i][j];
                sse += e*e;
                const d = Y[i][j] - meanY[j];
                sst += d*d;
            }
            mse[j] = sse / n0;
            r2[j]  = sst === 0 ? 1 : 1 - sse/sst;
        }
        this.mse = mse;
        this.r2  = r2;

        return this;
    }

    predict(Xnew: number[][]): number[][] {
        if (!this.weights || !this.intercept) throw new Error("not fitted");
        if (Xnew.length === 0) return [];
        if (Xnew[0].length !== this.p) throw new Error(`p=${Xnew[0].length}, expected ${this.p}`);

        const M = Xnew.length, m = this.m;
        const Yhat = Array.from({ length: M }, () => new Array(m).fill(0));
        for (let i = 0; i < M; i++) {
            for (let j = 0; j < m; j++) {
                let s = this.intercept[j];
                for (let k = 0; k < this.p; k++) s += Xnew[i][k] * this.weights[k][j];
                Yhat[i][j] = s;
            }
        }
        return Yhat;
    }
}