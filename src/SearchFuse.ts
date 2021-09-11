import { Stats } from "fs";
import Fuse, { FuseOps } from "fuse-native";
import { Searcher } from "./Searcher";
import { stat } from "./stat";
import { SearchParams } from "./types";

interface FuseEntry {
    name: string;
    stats?: Partial<Stats>;
}

enum DirType {
    Search = "SEARCH",
    Result = "RESULT",
    Root = "ROOT",
}

type SearchDirectory = {
    entity: string | undefined;
    params: SearchParams;
    type: DirType.Search;
};

interface ResultDirectory {
    entity: string;
    key: string;
    type: DirType.Result;
}

type DirectoryType = SearchDirectory | ResultDirectory | DirType.Root;

export class SearchFuse implements FuseOps {
    #searcher: Searcher;

    constructor(searcher: Searcher) {
        this.#searcher = searcher;
    }

    private static getSplitPath(path: string) {
        return path.split("/").filter((x) => !!x);
    }

    private getParams(splitPath: readonly string[]): SearchParams {
        let lastWasEntity = false;
        const params: SearchParams = {};
        const isEntity = (x: string) => this.#searcher.entities.includes(x);

        for (const [index, entry] of splitPath.entries()) {
            const nextEntry = splitPath[index + 1];

            if (
                !lastWasEntity &&
                isEntity(entry) &&
                !!nextEntry &&
                !isEntity(nextEntry)
            ) {
                lastWasEntity = true;
                const key = entry;
                if (!params[key]) {
                    params[key] = [];
                }

                params[key].push(nextEntry);
            } else {
                lastWasEntity = false;
            }
        }

        return params;
    }

    private getDirectoryType(path: string): DirectoryType | undefined {
        const splitPath = SearchFuse.getSplitPath(path);
        const pathLength = splitPath.length;

        if (pathLength === 0) {
            return DirType.Root;
        }

        const lastIndex = pathLength - 1;
        for (let i = lastIndex; i >= 0; i--) {
            if (this.#searcher.entities.includes(splitPath[i])) {
                if (i === lastIndex) {
                    return {
                        entity: splitPath[i],
                        params: this.getParams(splitPath),
                        type: DirType.Search,
                    };
                } else {
                    return {
                        entity: splitPath[i],
                        key: splitPath[i + 1],
                        type: DirType.Result,
                    };
                }
            }
        }
    }

    private async getSearchDirectory(
        searchDir: SearchDirectory
    ): Promise<FuseEntry[]> {
        const entries = await this.#searcher.search(
            searchDir.entity,
            searchDir.params
        );

        let results: FuseEntry[] = [];
        for (const entry of entries) {
            results.push({ name: entry });
        }

        return results;
    }

    private async getResultDirectory(
        resultDir: ResultDirectory
    ): Promise<FuseEntry[]> {
        const entries = await this.#searcher.getEntity(
            resultDir.entity,
            resultDir.key
        );
        const results: FuseEntry[] = [];

        // these are gonna be files? Mix of files/directories? How to agnostically differentiate?
        // everything's a directory at the moment.
        for (const entry of entries) {
            results.push({ name: entry });
        }

        return results;
    }

    private getRootDirectory() {
        return this.#searcher.entities.map((e) => ({
            name: e,
            stats: stat({ mode: "dir" }),
        }));
    }

    async readdir(
        path: string,
        cb: (e: number, dirs?: string[], stats?: Partial<Stats>[]) => any
    ) {
        try {
            let entries: FuseEntry[] = [];
            let dirs: string[] = [];
            let stats: Partial<Stats>[] = [];

            const dirType = this.getDirectoryType(path);

            if (!dirType) {
                return cb(Fuse.ENOENT);
            } else if (dirType === DirType.Root) {
                entries = this.getRootDirectory();
            } else if (dirType.type === DirType.Result) {
                entries = await this.getResultDirectory(dirType);
            } else if (dirType.type === DirType.Search) {
                entries = await this.getSearchDirectory(dirType);
            }

            for (const entry of entries) {
                dirs.push(entry.name);
                entry.stats && stats.push(entry.stats);
            }

            cb(0, dirs, stats);
        } catch (e) {
            console.error(e);
            cb(Fuse.ENOENT);
        }
    }

    getattr(
        path: string,
        cb: (e: number, stats?: Partial<Stats>) => void
    ): void {
        if (path.endsWith(".git")) {
            return cb(Fuse.ENOENT);
        }

        const dirType = this.getDirectoryType(path);

        if (dirType === DirType.Root) {
            cb(0, stat({ mode: "dir", size: 4096 }));
        } else if (dirType?.type === DirType.Search) {
            cb(0, stat({ mode: "dir", size: 4096 }));
        } else if (dirType?.type === DirType.Result) {
            cb(0, stat({ mode: "dir", size: 4096 }));
        } else {
            cb(Fuse.ENOENT);
        }
    }
}
