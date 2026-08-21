import { describe, it, expect } from 'vitest';
const { mergeResults } = require('../services/rankprocessor');

describe('rankprocessor.mergeResults', () => {
    it('defaults semanticWeight to 0.8, not 1.2', () => {
        // Doc "S" is semantic-only at rank 1. Its RRF score is (1/(60+1)) * semanticWeight.
        // With the old default (1.2) that score is higher than with the new default (0.8) --
        // use a lexical-only doc "L" at rank 1 (weight fixed at 1.0) as the yardstick.
        const keywordResults = [{ uuid: 'L' }];
        const semanticResults = [{ uuid: 'S' }];

        const fused = mergeResults(keywordResults, semanticResults);
        const lScore = fused.find(r => r.uuid === 'L').matchPercentage;
        const sScore = fused.find(r => r.uuid === 'S').matchPercentage;

        // L: (1/61)*1.0 = 0.01639.  S: (1/61)*0.8 = 0.01311.  L must now outrank S --
        // under the old 1.2 default S would have outranked L instead.
        expect(lScore).toBeGreaterThan(sScore);
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
