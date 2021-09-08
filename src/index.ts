import Fuse from "fuse-native";
import { SearchFuse } from "./SearchFuse";
import { Searcher } from "./Searcher";
import { SearchParams } from "./types";

class HelloWorldSearcher extends Searcher {
    async search(
        entity: string | undefined,
        params: SearchParams
    ): Promise<string[]> {
        return ["Hello", "world"];
    }
    async getEntity(entity: string, id: string): Promise<string[]> {
        return ["Hello", "world"];
    }
}

const searcher = new HelloWorldSearcher([]);
const searchFuse = new SearchFuse(searcher);

const fuse = new Fuse("./test", searchFuse);

fuse.mount(console.log);

process.on("SIGINT", () => {
    fuse.unmount("./test", () => {
        process.exit(0);
    });
});
