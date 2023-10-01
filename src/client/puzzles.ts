/* eslint max-len:off */
export const MININT = -7*70;
export const MAXINT = 7*70;

import assert from 'assert';
import * as engine from 'glov/client/engine';
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
  fixed_nodes?: string[];
  tutorial_text?: string;
};

export const puzzles: Puzzle[] = [(function () {
  rand.reseed(3746);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function fillit(): void {
    while (input.length < 26) {
      let v = rand.range(MAXINT - 1);
      input.push(v);
      output.push(v+1);
    }
    sets.push({ input, output });
    input = [];
    output = [];
  }
  input.push(3, 7);
  output.push(4, 8);
  fillit();
  fillit();
  fillit();

  return {
    id: 'inc',
    title: 'Increment',
    desc: 'Output more than the input',
    goal: `Read X from INPUT
Write X + 1 to OUTPUT`,
    sets,
    fixed_nodes: ['9x3'],
    tutorial_text: `Congratulations on qualifying for this exclusive QPCA-77B training course!

During the following exercises, you'll learn the skills you need to earn your QPCA-77B Professional Certification, Rev IV.

This tutorial text will be available until you successfully complete this puzzle.  The Reference Manual link at the bottom contains all relevant information and will be available at any time.

To get started, we've slotted an AstroWave 0903 node on the left for you, and you can solve this puzzle by adding code to that node.  Relevant commands for this puzzle are:
  MOV TARGET SOURCE
    TARGET/SOURCE is one of
      INPUT - reads from the input data
      OUTPUT - writes to the output data
      ACC - accumulator register
  INC - increment the contents of the ACC register
`,
  };
}()), (function () {
  rand.reseed(5678);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function fillit(): void {
    while (input.length < 26) {
      input.push(MININT + rand.range(MAXINT - MININT + 1));
      let v = MININT + rand.range(MAXINT - MININT + 1);
      input.push(v);
      output.push(v);
    }
    sets.push({ input, output });
    input = [];
    output = [];
  }
  input.push(1, 2, 3, 4);
  output.push(2, 4);
  fillit();
  fillit();
  fillit();

  return {
    id: 'alt',
    title: 'Alternate',
    desc: 'Output every other input',
    goal: `Read numbers from INPUT
Write every other number to OUTPUT, starting with the second one`,
    sets,
    fixed_nodes: ['4x1'],
  };
}()), (function () {
  rand.reseed(6789);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function push(v: number): void {
    if (v === 0) {
      return;
    }
    input.push(v);
    if (v > 0) {
      output.push(v);
    }
  }
  function fillit(): void {
    while (input.length < 26) {
      push(MININT + rand.range(MAXINT - MININT + 1));
    }
    sets.push({ input, output });
    input = [];
    output = [];
  }
  fillit();
  fillit();
  fillit();

  return {
    id: 'filter',
    title: 'Filter',
    desc: 'Output positive values',
    goal: `Read numbers from INPUT
Write any positive values to OUTPUT`,
    sets,
    fixed_nodes: ['9x3', '9x3'],
  };
}()), (function () {
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
  rand.reseed(3456);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function push(a: number, b: number): void {
    input.push(a, b);
    output.push(Math.max(a, b));
  }
  push(3, 2);
  push(2, 3);
  push(7, 3);
  for (let ii = 0; ii < 9; ++ii) {
    push(1 + rand.range(MAXINT-2), 1 + rand.range(MAXINT-2));
  }
  push(1, MAXINT-1);
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 13; ++ii) {
    push(1 + rand.range(MAXINT-2), 1 + rand.range(MAXINT-2));
  }
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 13; ++ii) {
    push(1 + rand.range(MAXINT-2), 1 + rand.range(MAXINT-2));
  }
  sets.push({ input, output });

  return {
    id: 'max',
    title: 'Max',
    desc: 'Find the maximum of two numbers',
    goal: `Read two numbers from INPUT
Write the larger of the two to OUTPUT`,
    sets,
  };
}()), (function () {
  rand.reseed(9583);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function push(a: number, b: number): void {
    if (output.length + b > 26) {
      return;
    }
    input.push(a, b);
    for (let ii = 0; ii < b; ++ii) {
      output.push(a);
    }
  }
  push(7, 3);
  push(-4, 1);
  for (let ii = 0; ii < 20; ++ii) {
    push(MININT + rand.range(MAXINT - MININT + 1), 1 + rand.range(5));
  }
  sets.push({ input, output });

  input = [];
  output = [];
  push(70, 7);
  for (let ii = 0; ii < 20; ++ii) {
    push(MININT + rand.range(MAXINT - MININT + 1), 1 + rand.range(7));
  }
  sets.push({ input, output });

  input = [];
  output = [];
  for (let ii = 0; ii < 20; ++ii) {
    push(MININT + rand.range(MAXINT - MININT + 1), 1 + rand.range(9));
  }
  sets.push({ input, output });

  return {
    id: 'repeat',
    title: 'Repeat',
    desc: 'Redundant repetitivity',
    goal: `Read two numbers X and N from INPUT
Write X to OUTPUT, N times`,
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
}()), (function () {
  rand.reseed(2468);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  let lastv = -1;
  function push(v: number): void {
    input.push(v);
    if (v !== lastv) {
      output.push(v);
    }
    lastv = v;
  }
  push(1);
  push(1);
  push(2);
  push(3);
  push(3);
  function fillit(): void {
    while (input.length < 26) {
      if (rand.range(2) && lastv !== -1) {
        push(lastv);
      } else {
        push(1 + rand.range(MAXINT - 1));
      }
    }
    sets.push({ input, output });
    input = [];
    output = [];
    lastv = -1;
  }
  fillit();

  fillit();

  fillit();

  return {
    id: 'rmdup',
    title: 'Remove Duplicates',
    desc: 'Remove consecutive duplicates',
    goal: `Read numbers from INPUT
Write each number to OUTPUT unless it is the same as the previously written number`,
    sets,
  };
}()), (function () {
  rand.reseed(2345);
  let sets: PuzzleIOSet[] = [];
  let input: number[] = [];
  let output: number[] = [];
  function push(list: number[]): void {
    let m = list[0];
    for (let ii = 0; ii < list.length; ++ii) {
      m = Math.max(m, list[ii]);
    }
    input = input.concat(list);
    input.push(0);
    output.push(m);
  }
  push([3, 2, 1]);
  push([1, 2, 3]);
  function fillit(): void {
    for (let ii = 0; ii < 10; ++ii) {
      let n = 2 + rand.range(4);
      if (input.length + n + 1 > 26) {
        break;
      }
      let list = [];
      for (let jj = 0; jj < n; ++jj) {
        list.push(1 + rand.range(MAXINT - 2));
      }
      push(list);
    }
    sets.push({ input, output });
    input = [];
    output = [];
  }
  fillit();

  fillit();

  fillit();

  return {
    id: 'maxn',
    title: 'Maximum Redux',
    desc: 'Find the largest of lists of numbers',
    goal: `Read a list numbers from INPUT terminated by a ZERO
Write the largest number from the list to OUTPUT`,
    sets,
  };
}())];

if (engine.DEBUG) {
  puzzles.push({
    id: 'debug2',
    title: 'Debug',
    desc: 'Trivial',
    goal: 'Line 1\nLine 2',
    sets: [{
      input: [1,2,3],
      output: [1,2,3],
    }],
  });
}

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
