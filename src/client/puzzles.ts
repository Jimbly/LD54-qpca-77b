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
      ..and more! (explained in later exercises)
    Example: MOV ACC INPUT
  INC - increment the contents of the ACC register

Start typing in the AW0903 node to write some code, then press the Start arrow at the top to see how it goes!`,
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
    tutorial_text: `Nice job on that last one.

You can probably complete this exercise using only what you already know, but we'll introduce a couple new things:

The NIL register is a special register, which can be used for either operand of MOV, which when written to does nothing, and when read from always reads a 0.

Important to note: all instructions are ran continuously in a loop, so after the last instruction execution returns to the first instruction.  This is how one program can process all input data.

Press the ? icon in the upper right to toggle between the GOAL statement and a QUICK REFERENCE guide at any time.  Don't worry if you don't understand everything there just yet.

Get to it!`
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
    tutorial_text: `Now you're ready for the advanced stuff!

To solve this exercise, you'll need to use RADIO CHANNELS.  A node can start broadcasting to a channel with MOV, for example:
  MOV CH1 INPUT
Or, later, in another node, read from a channel:
  MOV ACC CH1

Note: a node CANNOT read from a channel to which it is broadcasting.

LABELS: Prefix any line of code with text and a colon to define a label to use for conditional jumping.  For example:
  mylabel: MOV CH1 INPUT
  JMP mylabel

CONDITIONAL JUMPING: The conditional jump instructions all compare a value read from a channel against zero, and jump if the condition is met.
  JLZ CH1 mylabel - Jump if CH1 is less than 0
  JGZ CH1 mylabel - Jump if CH1 is greater than 0
  JEZ CH1 mylabel - Jump if CH1 is equal to 0
  JNZ CH1 mylabel - Jump if CH1 is not equal to 0
Also useful in this exercise: the NOP instruction will simply idle for one cycle.
`
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
    fixed_nodes: ['9x3', '9x3', '4x1'],
    tutorial_text: `Congratulations on getting this far!

This is the final introductory exercise, they get harder after this, but you will have the freedom to start with whichever nodes you wish.

To complete this exercise, you will need to take advantage of the fact that when two or more nodes are broadcasting on the same channel, any receiver will read the combined (summed) value.

The only instructions we did not yet cover are:
  NEG - negates the value in ACC (multiplies it by -1)
  DEC - decrements the value in ACC (subtracts 1)
However, they are probably not useful for this exercise.

Hint: the JUMP instructions can also take a numerical offset instead of a label for a relative jump.
  JGZ CH3 -1 - this jumps to the previous line

Remember, to keep the Reference Manual always close at hand, and good luck on the remaining exercises!
`
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
    goal: `Read a list of numbers from INPUT terminated by a ZERO
Write the largest number from the list to OUTPUT`,
    sets,
  };
}())];

if (engine.DEBUG) {
  puzzles.push({
    id: 'debug2',
    title: 'Debug',
    desc: 'Trivial',
    goal: 'Line 1\nLine 2\nLine 3',
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
