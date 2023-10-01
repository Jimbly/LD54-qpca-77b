export const MININT = -7*70;
export const MAXINT = 7*70;

import assert from 'assert';
import { randFastCreate } from 'glov/client/rand_fast';

let rand = randFastCreate(1);

export type PuzzleIOSet = {
  input: number[];
  output: number[];
};

export type Puzzle = {
  title: string;
  desc: string;
  goal: string;
  id: string;
  sets: PuzzleIOSet[];
};

export const puzzles: Puzzle[] = [(function () {
  rand.reseed(1234);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function push(a: number, b: number): void {
    input.push(a, b);
    output.push(a + b);
  }
  push(3, 2);
  push(7, 3);
  for (let ii = 0; ii < 10; ++ii) {
    push(1 + rand.range(30), 1 + rand.range(30));
  }
  push(1, MAXINT-1);
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 13; ++ii) {
    push(1 + rand.range(30), 1 + rand.range(30));
  }
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 13; ++ii) {
    push(1 + rand.range(30), 1 + rand.range(30));
  }
  sets.push({ input, output });

  return {
    id: 'add2',
    title: 'Add',
    desc: 'Add two numbers, how hard could it be?',
    goal: `Read two numbers from INPUT
Write their sum to OUTPUT`,
    sets,
  };
}()), (function () {
  rand.reseed(2345);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function push(a: number, b: number): void {
    input.push(a, b);
    output.push(a * b);
  }
  push(3, 2);
  push(7, 3);
  for (let ii = 0; ii < 10; ++ii) {
    push(1 + rand.range(23), 1 + rand.range(29));
  }
  push(1, MAXINT);
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 13; ++ii) {
    push(1 + rand.range(23), 1 + rand.range(23));
  }
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 13; ++ii) {
    push(1 + rand.range(34), 1 + rand.range(23));
  }
  sets.push({ input, output });

  return {
    id: 'mult2',
    title: 'Multiply',
    desc: 'Multiply two numbers, you can do this.',
    goal: `Read two numbers from INPUT
Write their product to OUTPUT`,
    sets,
  };
}())];

puzzles.forEach(function (puzzle) {
  puzzle.sets.forEach(function (set) {
    set.input.forEach(function (v) {
      assert(v >= MININT && v <= MAXINT);
    });
    set.output.forEach(function (v) {
      assert(v >= MININT && v <= MAXINT);
    });
  });
});

export const puzzle_ids = puzzles.map((a) => a.id);
