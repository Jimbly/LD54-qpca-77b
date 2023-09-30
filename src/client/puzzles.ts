import { randFastCreate } from 'glov/client/rand_fast';

let rand = randFastCreate(1234);

export type Puzzle = {
  title: string;
  goal: string;
  id: string;
  input: number[];
  output: number[];
};

export const puzzles: Puzzle[] = [(function () {
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
  push(1, 998);
  return {
    id: 'add',
    title: 'Add',
    goal: `Read two numbers from INPUT
Write their sum to OUTPUT`,
    input,
    output,
  };
}()), (function () {
  let input: number[] = [];
  let output: number[] = [];
  function push(a: number, b: number): void {
    input.push(a, b);
    output.push(a * b);
  }
  push(3, 2);
  push(7, 3);
  for (let ii = 0; ii < 10; ++ii) {
    push(1 + rand.range(30), 1 + rand.range(30));
  }
  push(1, 999);
  return {
    id: 'multiply',
    title: 'Multiply',
    goal: `Read two numbers from INPUT
Write their product to OUTPUT`,
    input,
    output,
  };
}())];

export const puzzle_ids = puzzles.map((a) => a.id);
