import { SearchParams } from "./types";

type Entry = {
    name: string;
    type: string;
};

export abstract class Searcher {
    entities: readonly string[];

    constructor(entities: string[]) {
        this.entities = entities;
    }

    abstract search(
        entity: string | undefined,
        params: SearchParams
    ): Promise<string[]>;
    abstract getEntity(entity: string, id: string): Promise<string[]>;
}
