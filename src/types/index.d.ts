declare module "fuse-native" {
    import { Stats } from "fs";

    export abstract class FuseOps {
        readdir(
            path: string,
            cb: (e: Error | null, dirs?: string[], stats?: Stats[]) => any
        ) {}
    }

    export interface Opts {}

    class Fuse {
        constructor(mnt: string, ops: FuseOps, opts?: Opts);

        mount(cb: (err: Error | null) => void): void;
    }

    export default Fuse;
}
