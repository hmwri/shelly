// history.ts
export interface Command {
    /** 初回実行（Redo でも使う） */
    do(): void;
    /** 取り消し */
    undo(): void;
    /** ドラッグ中の連続操作を1つにまとめたい場合 */
    tryMerge?(other: Command): boolean;
}

export class HistoryManager {
    private undoStack: Command[] = [];
    private redoStack: Command[] = [];

    constructor() {}

    execute(cmd: Command) {
        cmd.do();
        this.undoStack.push(cmd);
        this.redoStack.length = 0; // 新規実行したら Redo は消す
    }

    undo() {
        const cmd = this.undoStack.pop();
        if (!cmd) return;
        cmd.undo();
        this.redoStack.push(cmd);
    }

    redo() {
        const cmd = this.redoStack.pop();
        if (!cmd) return;
        cmd.do();
        this.undoStack.push(cmd);
    }

    clear() {
        this.undoStack.length = 0;
        this.redoStack.length = 0;
    }
}