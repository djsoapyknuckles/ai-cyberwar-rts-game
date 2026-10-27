import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// .env.example is committed; real keys belong only in the gitignored .env. A Voxta key once slipped in here.
describe('.env.example', () => {
  it('names the variables but holds no values', () => {
    const filled = readFileSync('.env.example', 'utf8').split('\n')
      .filter((line) => /^[A-Z_]+=\S/.test(line.trim()))
      .map((line) => line.split('=')[0]);
    expect(filled).toEqual([]);
  });
});
