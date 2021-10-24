declare module "fuse-native" {
    import { Stats } from "fs";

    export interface FuseOps {
        readdir(
            path: string,
            cb: (
                errno: number,
                dirs?: string[],
                stats?: Partial<Stats>[]
            ) => void
        ): void;

        getattr(
            path: string,
            cb: (errno: number, stats?: Partial<Stats>) => void
        ): void;

        read(
            path: string,
            fd: number,
            buffer: Buffer,
            length: number,
            position: number,
            cb: (bytesRead: number) => void
        );
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
