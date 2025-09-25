import {multiOutputLeastSquares} from "./src/utils/optim";

const X = [
    [1, 1], // x1, バイアス項
    [2, 1],
    [3, 1],
    [4, 1]
];
const Y = [
    [2*1 + 1, -1*1 + 3], // (y1, y2)
    [2*2 + 1, -2 + 3],
    [2*3 + 1, -3 + 3],
    [2*4 + 1, -4 + 3]
];

console.log(multiOutputLeastSquares(X, Y));