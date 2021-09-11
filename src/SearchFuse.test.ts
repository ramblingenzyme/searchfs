import Fuse from "fuse-native";
import { isArray } from "util";
import { Searcher } from "./Searcher";
import { SearchFuse } from "./SearchFuse";
import { stat } from "./stat";
import { SearchParams } from "./types";

const search = jest.fn();
const getEntity = jest.fn();

describe("SearchFuse", () => {
    describe("DummySearcher", () => {
        beforeEach(() => {
            jest.resetAllMocks();
            jest.useRealTimers();
        });

        class TestSearcher extends Searcher {
            search(
                entity: string | undefined,
                params: SearchParams
            ): Promise<string[]> {
                return search(entity, params);
            }
            getEntity(entity: string, id: string): Promise<string[]> {
                return getEntity(entity, id);
            }
        }

        it("should list all entities at root", () => {
            jest.useFakeTimers().setSystemTime(Date.now());
            const cb = jest.fn();

            const entities = ["a", "b", "c", "d"];
            const searcher = new TestSearcher(entities);
            const searchFuse = new SearchFuse(searcher);

            searchFuse.readdir("/", cb);

            expect(cb).toBeCalled();
            expect(cb).toBeCalledWith(
                0,
                entities,
                entities.map(() => stat({ mode: "dir" }))
            );
        });

        it("should search in an entity directory", (done) => {
            const entities = ["a", "b", "c", "d"];
            const searchResults = ["1", "2", "3", "4"];

            search.mockResolvedValue(searchResults);
            const searcher = new TestSearcher(entities);
            const searchFuse = new SearchFuse(searcher);

            searchFuse.readdir("/a", (errno: any, dirs: any, stats: any) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual(searchResults);
                    expect(stats).toEqual([]);
                    expect(search).toBeCalledWith("a", {});

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it("should getEntity in a result directory", (done) => {
            const entities = ["a", "b", "c", "d"];
            const searchResults = ["1", "2", "3", "4"];

            getEntity.mockResolvedValue(searchResults);
            const searcher = new TestSearcher(entities);
            const searchFuse = new SearchFuse(searcher);

            searchFuse.readdir("/a/1", (errno: any, dirs: any, stats: any) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual(searchResults);
                    expect(stats).toEqual([]);
                    expect(getEntity).toBeCalledWith("a", "1");

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it("should return ENOENT for an entity that doens't exist", (done) => {
            const entities = ["a", "b", "c", "d"];

            const searcher = new TestSearcher(entities);
            const searchFuse = new SearchFuse(searcher);

            searchFuse.readdir("/e", (errno: any) => {
                try {
                    expect(errno).toBe(Fuse.ENOENT);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });

    describe("BookSearcher", () => {
        class BookSearcher extends Searcher {
            static books = [
                {
                    title: "The Colour of Magic",
                    author: "Terry Pratchett",
                    tags: ["Fantasy", "Discworld"],
                },
                {
                    title: "Storm Front",
                    author: "Jim Butcher",
                    tags: ["Urban Fantasy", "Fantasy", "Dresden Files"],
                },
                {
                    title: "All Systems Red",
                    author: "Martha Wells",
                    tags: ["Science Fiction", "AI", "Robots"],
                },
            ];

            constructor() {
                super(["books", "tags", "author"]);
            }

            search(
                entity: "books" | "tags" | "author",
                params: SearchParams
            ): Promise<string[]> {
                const paramsArray = Object.entries(params) as Array<
                    ["tags" | "author", string[]]
                >;

                const matchedBooks = BookSearcher.books.filter((book) => {
                    // every value of every param exists on the book
                    return paramsArray.every(([key, values]) =>
                        values.every((v) => {
                            const bookValue = book[key];
                            if (Array.isArray(bookValue)) {
                                return bookValue.includes(v);
                            } else {
                                return bookValue === v;
                            }
                        })
                    );
                });

                const returnedProperty = entity === "books" ? "title" : entity;

                return Promise.resolve(
                    matchedBooks
                        .flatMap((b) => b[returnedProperty])
                        .filter(
                            (value, index, arr) => arr.indexOf(value) === index
                        )
                );
            }

            getEntity(
                entity: "books" | "tags" | "author",
                id: string
            ): Promise<string[]> {
                const key = entity === "books" ? "title" : entity;

                return Promise.resolve(
                    BookSearcher.books
                        .filter((book) => {
                            const bookValue = book[key];
                            if (Array.isArray(bookValue)) {
                                return bookValue.includes(id);
                            } else {
                                return bookValue === id;
                            }
                        })
                        .map((b) => b.title)
                );
            }
        }

        const searcher = new BookSearcher();
        const searchFuse = new SearchFuse(searcher);

        it("should return all books at /books", (done) => {
            searchFuse.readdir("/books", (errno, dirs, stats) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual(
                        BookSearcher.books.map((b) => b.title)
                    );
                    expect(stats).toEqual([]);

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it("should return all tags at /tags", (done) => {
            searchFuse.readdir("/tags", (errno, dirs, stats) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual([
                        ...new Set(BookSearcher.books.flatMap((b) => b.tags)),
                    ]);
                    expect(stats).toEqual([]);

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it("should return all authors at /author", (done) => {
            searchFuse.readdir("/author", (errno, dirs, stats) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual(
                        BookSearcher.books.map((b) => b.author)
                    );
                    expect(stats).toEqual([]);

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it("should filter down the books at /tags/Fantasy", (done) => {
            searchFuse.readdir("/tags/Fantasy/", (errno, dirs, stats) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual(
                        BookSearcher.books
                            .filter((b) => b.tags.includes("Fantasy"))
                            .map((b) => b.title)
                    );
                    expect(stats).toEqual([]);

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it("should filter down the tags at /tags/Fantasy/tags", (done) => {
            searchFuse.readdir("/tags/Fantasy/tags", (errno, dirs, stats) => {
                try {
                    expect(errno).toBe(0);
                    expect(dirs).toEqual([
                        "a",
                        // ...new Set(
                        //     BookSearcher.books
                        //         .filter((b) => b.tags.includes("Fantasy"))
                        //         .flatMap((b) => b.tags)
                        // ),
                    ]);
                    expect(stats).toEqual([]);

                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});
