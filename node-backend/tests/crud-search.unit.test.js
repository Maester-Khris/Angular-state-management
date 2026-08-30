import { describe, it, expect, vi, beforeEach } from 'vitest';

const Post = require('../database/models/post');
const dbCrudOperator = require('../database/crud');

function mockFindChain(result) {
    return {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue(result),
    };
}

describe('crud.searchPostsByKeyword', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('returns $text results directly and never calls the Atlas Search fallback', async () => {
        vi.spyOn(Post, 'find').mockReturnValue(mockFindChain([{ uuid: '1', title: 'Redis Caching' }]));
        const aggregateSpy = vi.spyOn(Post, 'aggregate');

        const results = await dbCrudOperator.searchPostsByKeyword('redis caching');

        expect(results).toEqual([{ uuid: '1', title: 'Redis Caching' }]);
        expect(aggregateSpy).not.toHaveBeenCalled();
    });

    it('falls back to Atlas Search fuzzy when $text returns zero results', async () => {
        vi.spyOn(Post, 'find').mockReturnValue(mockFindChain([]));
        vi.spyOn(Post, 'aggregate').mockResolvedValue([{ uuid: '2', title: 'Nest.js Caching With Redis' }]);

        const results = await dbCrudOperator.searchPostsByKeyword('redis cachign strategies');

        expect(results).toEqual([{ uuid: '2', title: 'Nest.js Caching With Redis' }]);
        expect(Post.aggregate).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({
                $search: expect.objectContaining({
                    index: 'posts_lexical_search',
                    text: expect.objectContaining({
                        query: 'redis cachign strategies',
                        fuzzy: { maxEdits: 2, prefixLength: 0 },
                    }),
                }),
            }),
        ]));
    });

    it('degrades gracefully to an empty array if the fallback itself errors (e.g. index not ready)', async () => {
        vi.spyOn(Post, 'find').mockReturnValue(mockFindChain([]));
        vi.spyOn(Post, 'aggregate').mockRejectedValue(new Error('index not found'));

        const results = await dbCrudOperator.searchPostsByKeyword('redis cachign strategies');

        expect(results).toEqual([]);
    });
});
