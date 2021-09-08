import { Stats } from "fs";

export abstract class FuseOps {
    readdir(
        path: string,
        cb: (e: Error | null, dirs?: string[], stats?: Stats[]) => any
    ) {}
}
