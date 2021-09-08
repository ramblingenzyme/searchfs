import { Stats } from "fs";
import { FuseOps } from "./FuseOps";
import { Searcher } from "./Searcher";
import { SearchParams } from "./types";

interface FuseEntry {
    name: string;
    stats?: Stats;
}

enum DirType {
    Search,
    Result,
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

type DirectoryType = SearchDirectory | ResultDirectory;

export class SearchFuse extends FuseOps {
    #searcher: Searcher;
    #baseSearchResults: FuseEntry[] = [];

    constructor(searcher: Searcher) {
        super();
        this.#searcher = searcher;

        for (const entity of this.#searcher.entities) {
            this.#baseSearchResults.push({ name: entity });
        }
    }

    private static getSplitPath(path: string) {
        return path.split("/").filter((x) => !!x);
    }

    private static getParams(splitPath: readonly string[]): SearchParams {
        const params: SearchParams = {};

        for (const [index, entry] of splitPath.entries()) {
            if (index % 2 === 0) {
                const key = entry;
                const value = splitPath[index + 1];

                if (!params[key]) {
                    params[key] = [];
                }

                if (value) {
                    params[key].push(value);
                }
            }
        }

        return params;
    }

    private getDirectoryType(path: string): DirectoryType | undefined {
        const splitPath = SearchFuse.getSplitPath(path);
        const pathLength = splitPath.length;

        const last = splitPath[pathLength - 1];
        const secondLast = splitPath[pathLength - 2];

        if (pathLength === 0) {
            return {
                entity: undefined,
                params: SearchFuse.getParams(splitPath),
                type: DirType.Search,
            };
        } else if (this.#searcher.entities.includes(last)) {
            return {
                entity: last,
                params: SearchFuse.getParams(splitPath),
                type: DirType.Search,
            };
        } else if (this.#searcher.entities.includes(secondLast)) {
            return {
                entity: secondLast,
                key: last,
                type: DirType.Result,
            };
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

        return this.#baseSearchResults.concat(results);
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
        for (const entry of entries) {
            results.push({ name: entry });
        }

        return results;
    }

    async readdir(
        path: string,
        cb: (e: Error | null, dirs?: string[], stats?: Stats[]) => any
    ) {
        try {
            let entries: FuseEntry[] = [];
            let dirs: string[] = [];
            let stats: Stats[] = [];

            const dirType = this.getDirectoryType(path);

            if (dirType?.type === DirType.Result) {
                entries = await this.getResultDirectory(dirType);
            } else if (dirType?.type === DirType.Search) {
                entries = await this.getSearchDirectory(dirType);
            }

            for (const entry of entries) {
                dirs.push(entry.name);
                entry.stats && stats.push(entry.stats);
            }

            cb(null, dirs, stats);
        } catch (e) {
            cb(e as Error);
        }
    }
}
