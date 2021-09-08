declare module "fuse-native" {
    import { Stats } from "fs";

    interface IFuseOps {
        readdir: (
            path: string,
            cb: (e: Error | null, dirs?: string[], stats?: Stats[]) => any
        ) => void;
    }

    export interface Opts {}

    class Fuse {
        constructor(mnt: string, ops: IFuseOps, opts?: Opts);

        mount(cb?: (err: Error | null) => void): void;
        unmount(mnt: string, cb?: (err: Error | null) => void): void;
    }

    export default Fuse;
}
