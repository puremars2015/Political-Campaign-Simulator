import { describe, expect, it } from 'vitest';
import { nextFloat, nextInt, seedRng } from '../../src/engine/rng.ts';

describe('rng', () => {
  it('相同種子產生相同序列', () => {
    const run = () => {
      let state = seedRng('same-seed');
      const values: number[] = [];
      for (let i = 0; i < 5; i++) {
        let value: number;
        [value, state] = nextFloat(state);
        values.push(value);
      }
      return values;
    };
    expect(run()).toEqual(run());
  });

  it('不同種子產生不同序列', () => {
    expect(nextFloat(seedRng('a'))[0]).not.toBe(nextFloat(seedRng('b'))[0]);
  });

  it('nextInt 落在閉區間內', () => {
    let state = seedRng(42);
    for (let i = 0; i < 1000; i++) {
      let value: number;
      [value, state] = nextInt(state, 1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    }
  });
});
