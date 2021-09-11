declare module "fuse-native" {
    import { Stats } from "fs";

    export interface FuseOps {
        readdir(
            path: string,
            cb: (e: number, dirs?: string[], stats?: Partial<Stats>[]) => void
        ): void;

        getattr(
            path: string,
            cb: (e: number, stats?: Partial<Stats>) => void
        ): void;
    }

    export interface Opts {}

    class Fuse {
        constructor(mnt: string, ops: FuseOps, opts?: Opts);

        mount(cb?: (err: Error | null) => void): void;
        unmount(mnt: string, cb?: (err: Error | null) => void): void;

        static ENOENT: number;
    }

    export default Fuse;
}
