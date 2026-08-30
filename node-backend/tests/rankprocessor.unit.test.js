import { describe, it, expect } from 'vitest';
const { mergeResults } = require('../services/rankprocessor');

describe('rankprocessor.mergeResults', () => {
    it('defaults semanticWeight to 1.2 (reverted from a regressing 0.8 trial)', () => {
        // Doc "S" is semantic-only at rank 1. Its RRF score is (1/(60+1)) * semanticWeight.
        // Use a lexical-only doc "L" at rank 1 (weight fixed at 1.0) as the yardstick.
        const keywordResults = [{ uuid: 'L' }];
        const semanticResults = [{ uuid: 'S' }];

        const fused = mergeResults(keywordResults, semanticResults);
        const lScore = fused.find(r => r.uuid === 'L').matchPercentage;
        const sScore = fused.find(r => r.uuid === 'S').matchPercentage;

        // L: (1/61)*1.0 = 0.01639.  S: (1/61)*1.2 = 0.01967. S outranks L at the default weight.
        // semanticWeight=0.8 was tried and reverted: it helped the 2-3 specific hard queries it
        // was validated against but regressed full-eval-set Precision@5 (0.4222 -> 0.3963,
        // confirmed live against the full 54-query set) -- see subgoal2 artifact, Measure 1
        // reopened. 1.2 is the last known-good full-population value.
        expect(sScore).toBeGreaterThan(lScore);
    });

    it('applies a custom lexicalWeight', () => {
        const keywordResults = [{ uuid: 'L' }];
        const semanticResults = [{ uuid: 'S' }];

        // Down-weight lexical below the new 0.8 semantic default -- S must now outrank L.
        const fused = mergeResults(keywordResults, semanticResults, 0.5, 0.8);
        const lScore = fused.find(r => r.uuid === 'L').matchPercentage;
        const sScore = fused.find(r => r.uuid === 'S').matchPercentage;

        expect(sScore).toBeGreaterThan(lScore);
    });

    it('preserves existing behavior: consensus doc still ranks first', () => {
        const keywordResults = [{ uuid: 'A', title: 'Both' }];
        const semanticResults = [{ uuid: 'A' }, { uuid: 'B' }];

        const fused = mergeResults(keywordResults, semanticResults);
        expect(fused[0].uuid).toBe('A');
    });
});
