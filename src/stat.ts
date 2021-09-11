import { Stats } from "fs";

interface Arg {
    mtime?: Date;
    atime?: Date;
    ctime?: Date;
    uid?: number;
    gid?: number;

    size?: number;
    mode: "dir" | "file" | "link" | number;
}

export function stat(st?: Arg) {
    return {
        mtime: st?.mtime || new Date(),
        atime: st?.atime || new Date(),
        ctime: st?.ctime || new Date(),
        size: st?.size !== undefined ? st.size : 0,
        mode:
            st?.mode === "dir"
                ? 16877
                : st?.mode === "file"
                ? 33188
                : st?.mode === "link"
                ? 41453
                : st?.mode,
        uid: st?.uid !== undefined ? st.uid : process.getuid(),
        gid: st?.gid !== undefined ? st.gid : process.getgid(),
    };
}
