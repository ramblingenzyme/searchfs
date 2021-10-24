import { Stats } from "fs";
import Fuse, { FuseOps } from "fuse-native";
import { Searcher } from "./Searcher";
import { stat } from "./stat";
import { SearchParams } from "./types";

interface FuseEntry {
    name: string;
    stats?: Partial<Stats>;
}

enum PathTypeEnum {
    Search = "SEARCH",
    Result = "RESULT",
    ResultProperty = "RESULT_PROPERTY",
    Root = "ROOT",
}

type SearchDirectory = {
    entity: string | undefined;
    params: SearchParams;
    type: PathTypeEnum.Search;
};

interface ResultDirectory {
    entity: string;
    key: string;
    type: PathTypeEnum.Result;
}

interface ResultPropertyFile {
    entity: string;
    key: string;
    property: string;
    type: PathTypeEnum.ResultProperty;
}

type PathType =
    | SearchDirectory
    | ResultDirectory
    | ResultPropertyFile
    | PathTypeEnum.Root;

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

        for (const [index, entityCandidate] of splitPath.entries()) {
            const value = splitPath[index + 1];

            if (lastWasEntity || !value) {
                lastWasEntity = false;
            } else if (isEntity(entityCandidate) && !isEntity(value)) {
                const entity = entityCandidate;
                if (!params[entity]) {
                    params[entity] = [];
                }

                params[entity].push(value);

                lastWasEntity = true;
            }
        }

        return params;
    }

    private getPathType(path: string): PathType | undefined {
        const splitPath = SearchFuse.getSplitPath(path);
        const pathLength = splitPath.length;

        if (pathLength === 0) {
            return PathTypeEnum.Root;
        }

        const lastIndex = pathLength - 1;
        for (let i = lastIndex; i >= 0; i--) {
            if (this.#searcher.entities.includes(splitPath[i])) {
                if (i === lastIndex) {
                    // /*/Entity
                    return {
                        entity: splitPath[i],
                        params: this.getParams(splitPath),
                        type: PathTypeEnum.Search,
                    };
                } else if (i === lastIndex - 1) {
                    // /*/Entity/key/
                    return {
                        entity: splitPath[i],
                        key: splitPath[i + 1],
                        type: PathTypeEnum.Result,
                    };
                } else if (i === lastIndex - 2) {
                    // /*/Entity/key/property
                    return {
                        entity: splitPath[i],
                        key: splitPath[i + 1],
                        property: splitPath[i + 2],
                        type: PathTypeEnum.ResultProperty,
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

        let results: FuseEntry[] = [];
        for (const entry of entries) {
            results.push({ name: entry });
        }

        return results;
    }

    private getRootDirectory() {
        let results: FuseEntry[] = [];
        for (const entity of this.#searcher.entities) {
            results.push({ name: entity });
        }

        return results;
    }

    async readdir(
        path: string,
        cb: (e: number, dirs?: string[], stats?: Partial<Stats>[]) => any
    ) {
        try {
            let entries: FuseEntry[] = [];

            const pathType = this.getPathType(path);

            if (!pathType) {
                return cb(Fuse.ENOENT);
            } else if (pathType === PathTypeEnum.Root) {
                entries = this.getRootDirectory();
            } else if (pathType.type === PathTypeEnum.Result) {
                entries = await this.getResultDirectory(pathType);
            } else if (pathType.type === PathTypeEnum.Search) {
                entries = await this.getSearchDirectory(pathType);
            }

            let dirs: string[] = [];
            let stats: Partial<Stats>[] = [];
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

        const pathType = this.getPathType(path);

        if (pathType === PathTypeEnum.Root) {
            cb(0, stat({ mode: "dir", size: 4096 }));
        } else if (pathType?.type === PathTypeEnum.Search) {
            cb(0, stat({ mode: "dir", size: 4096 }));
        } else if (pathType?.type === PathTypeEnum.Result) {
            cb(0, stat({ mode: "dir", size: 4096 }));
        } else if (pathType?.type === PathTypeEnum.ResultProperty) {
            cb(0, stat({ mode: "file" })); // TODO: give size of property
        } else {
            cb(Fuse.ENOENT);
        }
    }

    read(
        path: string,
        fd: any,
        buffer: any,
        length: number,
        position: number,
        cb: (bytesRead: number) => void
    ) {
        cb(0);
    }
}
