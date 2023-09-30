/*eslint global-require:off,no-labels:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('LD54'); // Before requiring anything else that might load from this

import assert from 'assert';
import * as engine from 'glov/client/engine';
import {
  ALIGN,
  Font,
  fontStyle,
  intColorFromVec4Color,
} from 'glov/client/font';
import * as net from 'glov/client/net';
import { spriteSetGet } from 'glov/client/sprite_sets';
import {
  Sprite,
  spriteCreate,
} from 'glov/client/sprites';
import * as ui from 'glov/client/ui';
import {
  button,
  drawLine,
  drawRect,
  loadUISprite,
  panel,
} from 'glov/client/ui';
import { TSMap } from 'glov/common/types';
import {
  arrayToSet,
  clamp,
  mod,
} from 'glov/common/util';
import {
  Vec4,
  v4copy,
  vec4,
} from 'glov/common/vmath';

import { puzzles } from './puzzles';

const { floor } = Math;

const MININT = -999;
const MAXINT = 999;
const TICK_TIME = 1000;
const MAX_OUTPUT = 26;

function hexToColor(hex: string): Vec4 {
  let r = parseInt(hex.slice(0,2), 16)/255;
  let g = parseInt(hex.slice(2,4), 16)/255;
  let b = parseInt(hex.slice(4), 16)/255;
  return vec4(r, g, b, 1);
}
const palette = [
  '77a6a9', '56787a', '618fad', '45657a',
  '333333', 'e1ccad', 'c24d3f', '963c31',
  'ebb8a4', 'ba8b79', 'd9c380'
].map(hexToColor);
const palette_font = palette.map(intColorFromVec4Color);

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.UI = 100;
Z.NODES = 110;

const CHW = 9;
const CHH = 16;
const CODE_LINE_W = 22;

const PANEL_HPAD = 8;
const PANEL_VPAD = 4;

const GOAL_X = 0;
const GOAL_Y = 0;
const GOAL_W = CHW * 60;
const GOAL_H = CHH * 6 + PANEL_VPAD * 2;
const INPUT_X = 0;
const INPUT_W = CHW * 6 - 2;
const OUTPUT_X = INPUT_X + INPUT_W + 2;
const OUTPUT_W = CHW * 9;
const NODES_X = OUTPUT_X + OUTPUT_W + 2;
const NODES_Y = CHH * 7;
const NODE_W = CHW * 28;
const NODES_W = NODE_W * 3 + CHW * 2 - 2;
const NODES_H = CHH * 28;
const NODE_X = [NODES_X + 3];
NODE_X.push(NODE_X[0] + NODE_W + 5);
NODE_X.push(NODE_X[1] + NODE_W + 5);
const NODE_Y = NODES_Y + 3;
const RADIO_W = CHW * 5;

const INPUT_Y = NODES_Y;
const OUTPUT_Y = INPUT_Y;
const INPUT_H = NODES_H;
const OUTPUT_H = INPUT_H;

const CONTROLS_X = GOAL_X + GOAL_W + 4;
const CONTROLS_Y = 8;

// Virtual viewport for our game logic
const game_width = 145*9;
const game_height = 36*20;

let font: Font;

declare module 'glov/client/ui' {
  interface UISprites {
    node_panel_bg: Sprite;
    node_panel: Sprite;
    node_panel_info: Sprite;
  }
}

class NodeType {
  h: number;
  constructor(public lines: number, public radios: number) {
    this.h = (lines + 1) * CHH;
  }
}
let node_types: Record<string, NodeType> = {
  '9x3': new NodeType(9, 3),
  '15x5': new NodeType(15, 5),
};

type OpDef = {
  params: ('channel' | 'register' | 'number' | 'label')[];
};
const OPDEF: TSMap<OpDef> = {
  mov: { params: ['register', 'number'] },
  dec: { params: [] },
  inc: { params: [] },
  jmp: { params: ['label'] },
  jlz: { params: ['channel', 'label'] },
  jez: { params: ['channel', 'label'] },
  jgz: { params: ['channel', 'label'] },
  jnz: { params: ['channel', 'label'] },
  //slp: { params: ['number'] },
  nop: { params: [] },
};
type Op = {
  instr: keyof typeof OPDEF;
  p1: string | number | null;
  p2: string | number | null;
  source_line: number;
};
const OKTOK = arrayToSet(['input', 'output', 'acc']);
function parseOp(toks: string[], source_line: number): Op | string {
  let instr = toks[0];
  assert(instr);
  let def = OPDEF[instr];
  if (!def) {
    return `Unknown instruction "${instr}"`;
  }
  if (toks.length !== def.params.length + 1) {
    return `"${instr}" requires ${def.params} parameter(s)`;
  }
  let p: (string | number | null)[] = [null, null];
  for (let ii = 0; ii < def.params.length; ++ii) {
    let v = toks[ii + 1];
    let type = def.params[ii];
    if (isFinite(Number(v))) {
      if (type === 'number') {
        p[ii] = Number(v);
      } else {
        return `Operand ${ii+1} must be a ${type}`;
      }
    } else if (type === 'label') {
      p[ii] = v;
    } else if (type === 'channel') {
      if (v.match(/^ch\d+$/)) {
        p[ii] = v;
      } else {
        return `Operand ${ii+1} must be a ${type}`;
      }
    } else { // number or register, and parameter is not a number, so must be a register
      if (OKTOK[v] || v.match(/^ch\d+$/)) {
        if (type === 'register' && v === 'input') {
          return 'Cannot write to INPUT';
        } else if (type === 'number' && v === 'output') {
          return 'Cannot read from OUTPUT';
        }
        p[ii] = v;
      } else {
        return `Invalid operand "${v.toUpperCase()}"`;
      }
    }
  }
  return {
    instr,
    p1: p[0],
    p2: p[1],
    source_line,
  };
}

class Node {
  pos = [0,0];
  code: string = '';
  radio_state!: Partial<Record<number, number>>;
  active_radios!: number[];
  step_idx!: number;
  acc!: number;
  node_type: NodeType;
  constructor(public type: string) {
    this.node_type = node_types[type];
    this.resetSim();
  }
  resetSim(): void {
    this.acc = 0;
    this.step_idx = 0;
    this.radio_state = {};
    this.active_radios = [];
  }
  error_idx = -1;
  error_str: string | null = null;
  op_lines: Op[] = [];
  labels: TSMap<number> = {};
  setCode(code: string): void {
    this.error_idx = -1;
    this.error_str = null;
    this.code = code;
    let lines = code.split(/\n|\r/g);
    let labels: TSMap<number> = this.labels = {};
    let op_lines: Op[] = this.op_lines = [];
    for (let ii = 0; ii < lines.length; ++ii) {
      let line = lines[ii].toLowerCase().trim();
      let m = line.match(/^([^;#]*)[;#].*$/);
      if (m) {
        line = m[1].trim();
      }
      m = line.match(/^([a-z]\w*):(.*)$/);
      if (m) {
        labels[m[1]] = ii;
        line = m[2].trim();
      }
      if (!line) {
        continue;
      }
      let toks = line.split(/\s+/g);
      let op = parseOp(toks, ii);
      if (typeof op === 'string') {
        this.error_str = op;
        this.error_idx = ii;
      } else {
        op_lines.push(op);
      }
    }
    // map labels to their next valid (op) line, or loop to start
    for (let key in labels) {
      let line: number = labels[key]!;
      let found = false;
      for (let ii = 0; ii < op_lines.length; ++ii) {
        if (op_lines[ii].source_line >= line) {
          labels[key] = ii;
          found = true;
          break;
        }
      }
      if (!found && op_lines.length) {
        labels[key] = 0;
      }
    }
  }
  stepError(msg: string): void {
    this.error_str = msg;
    this.error_idx = this.op_lines[this.step_idx].source_line;
  }
  step(game_state: GameState): void {
    let { op_lines, step_idx, node_type, labels, active_radios, radio_state } = this;
    if (!op_lines.length) {
      return;
    }
    let op = op_lines[step_idx];
    // unless we jump, step_idx advances/loops
    let next_step_idx = (step_idx + 1) % op_lines.length;
    let { instr, p1, p2 } = op;
    let label = p1;
    outer:
    switch (instr) {
      case 'nop':
        break;
      case 'mov': {
        let m;
        // Read input
        let v: number;
        assert(typeof p2 === 'number' || typeof p2 === 'string');
        if (typeof p2 === 'number') {
          v = p2;
        } else if (p2 === 'acc') {
          v = this.acc;
        } else if ((m = p2.match(/^ch(\d+)$/))) {
          let radio_idx = Number(m[1]);
          if (p1 === p2) {
            return this.stepError('Cannot read and write to the same channel');
          }
          if (active_radios.includes(radio_idx)) {
            return this.stepError('Cannot write to an active channel');
          }
          v = game_state.radios[radio_idx] || 0;
        } else if (p2 === 'input') {
          v = game_state.readInput();
        } else {
          assert(false);
        }
        // Assign to output
        assert(typeof p1 === 'string');
        if (p1 === 'acc') {
          this.acc = v;
        } else if (p1 === 'output') {
          if (!game_state.addOutput(v)) {
            return this.stepError('Output overflow');
          }
        } else if ((m = p1.match(/^ch(\d+)$/))) {
          let radio_idx = Number(m[1]);
          if (!active_radios.includes(radio_idx)) {
            if (!v) {
              // no-op
            } else {
              if (active_radios.length >= node_type.radios) {
                return this.stepError('Too many active radios');
              }
              active_radios.push(radio_idx);
              radio_state[radio_idx] = v;
            }
          } else {
            if (!v) {
              let idx = active_radios.indexOf(radio_idx);
              active_radios.splice(idx, 1);
              delete radio_state[radio_idx];
            } else {
              radio_state[radio_idx] = v;
            }
          }
        } else {
          assert(false);
        }
      } break;
      case 'dec':
        this.acc = clamp(this.acc - 1, MININT, MAXINT);
        break;
      case 'inc':
        this.acc = clamp(this.acc + 1, MININT, MAXINT);
        break;
      case 'jlz':
      case 'jez':
      case 'jgz':
      case 'jnz': {
        assert(typeof p1 === 'string');
        let m = p1.match(/^ch(\d+)$/);
        assert(m);
        let radio_idx = Number(m[1]);
        if (active_radios.includes(radio_idx)) {
          return this.stepError('Cannot read from an active channel');
        }
        let v = game_state.radios[radio_idx] || 0;
        switch (instr) {
          case 'jlz':
            if (!(v < 0)) {
              break outer;
            }
            break;
          case 'jez':
            if (!(v === 0)) {
              break outer;
            }
            break;
          case 'jgz':
            if (!(v > 0)) {
              break outer;
            }
            break;
          case 'jnz':
            if (!(v !== 0)) {
              break outer;
            }
            break;
          default:
            assert(false);
        }
        label = p2;
      }
      // eslint-disable-next-line no-fallthrough
      case 'jmp': {
        let m;
        if (label === 'acc') {
          label = this.acc;
        } else if (label === 'input') {
          label = game_state.readInput();
        } else if (typeof label === 'string' && (m = label.match(/^ch(\d+)$/))) {
          let radio_idx = Number(m[1]);
          if (active_radios.includes(radio_idx)) {
            return this.stepError('Cannot read from an active channel');
          }
          label = game_state.radios[radio_idx] || 0;
        }
        if (typeof label === 'number') {
          next_step_idx = mod(step_idx + label, op_lines.length);
        } else {
          assert(typeof label === 'string');
          let target = labels[label];
          if (target === undefined) {
            return this.stepError(`Unknown label "${label}"`);
          }
          next_step_idx = target;
        }
      } break;
      default:
        assert(false);
    }
    this.step_idx = next_step_idx;
  }
}

class GameState {
  nodes: Node[] = [];
  puzzle_idx = 0;
  output: number[] = [];
  input_idx = 0;
  state: 'play' | 'pause' | 'edit' | 'win' = 'edit';
  tick_counter = 0;
  tick_idx = 0;
  radios: Partial<Record<number, number>> = {};
  resetSim(): void {
    this.output = [];
    this.input_idx = 0;
    this.tick_idx = 0;
    this.radios = {};
    this.nodes.forEach((node) => node.resetSim());
  }
  isPlaying(): boolean {
    return this.state === 'play';
  }
  isEditing(): boolean {
    return this.state === 'edit';
  }
  isSimulating(): boolean {
    return !this.isEditing();
  }
  play(): void {
    if (this.state === 'play') {
      this.state = 'pause';
      return;
    }
    if (this.state !== 'pause') {
      this.resetSim();
    }
    this.state = 'play';
    this.tick_counter = TICK_TIME;
  }
  stop(): void {
    this.state = 'edit';
  }
  hasError(): boolean {
    let { nodes } = this;
    for (let ii = 0; ii < nodes.length; ++ii) {
      if (nodes[ii].error_idx !== -1) {
        return true;
      }
    }
    return false;
  }
  readInput(): number {
    let puzzle = puzzles[this.puzzle_idx];
    if (this.input_idx >= puzzle.input.length) {
      return MININT;
    } else {
      return puzzle.input[this.input_idx++];
    }
  }
  addOutput(v: number): boolean {
    if (this.output.length >= MAX_OUTPUT) {
      return false;
    }
    this.output.push(v);
    return true;
  }
  step(): void {
    if (this.state === 'win') {
      return;
    }
    assert(this.isSimulating());
    this.tick_idx++;
    let { nodes, radios, puzzle_idx, output } = this;

    // step nodes
    nodes.forEach((node) => {
      node.step(this);
    });

    // evaluate radios
    radios = this.radios = {};
    nodes.forEach((node) => {
      node.active_radios.forEach((radio_idx) => {
        let radio_value = node.radio_state[radio_idx]!;
        radios[radio_idx] = clamp((radios[radio_idx] || 0) + radio_value, MININT, MAXINT);
      });
    });

    // check victory condition
    let puzzle = puzzles[puzzle_idx];
    let success = output.length === puzzle.output.length;
    for (let ii = 0; success && ii < output.length; ++ii) {
      if (output[ii] !== puzzle.output[ii]) {
        success = false;
      }
    }
    if (success) {
      this.state = 'win';
    }
  }
  tick(dt: number): void {
    if (!this.isPlaying()) {
      return;
    }
    if (dt >= this.tick_counter) {
      this.step();
      this.tick_counter = TICK_TIME;
    } else {
      this.tick_counter -= dt;
    }
  }
}

let game_state: GameState;

let sprites: Record<string, Sprite> = {};
function init(): void {
  ['play', 'pause', 'stop', 'menu', 'redo', 'undo', 'help', 'ff', 'step'].forEach(function (name) {
    name = `icon_${name}`;
    sprites[name] = spriteCreate({ name });
  });
  loadUISprite('node_panel_bg', [16, 16, 16], [16, 16, 16]);
  loadUISprite('node_panel', [16, 16, 16], [32, 16, 16]);
  loadUISprite('node_panel_info', [16, 16, 16], [32, 16, 16]);
  game_state = new GameState();
  let node1 = new Node('9x3');
  node1.setCode(`MOV ch3 INPUT
MOV ACC INPUT
loop: MOV ch1 ACC
wait: JNZ ch2 wait
JLZ ch2 end
DEC
JMP loop`);
  game_state.nodes.push(node1);
  let node2 = new Node('15x5');
  node2.pos[0] = 1;
  node2.setCode(`MOV acc 0
NOP
NOP
NOP
loop: JEZ ch1 end
MOV ch3 acc
MOV ch2 1
MOV acc ch4
MOV ch2 0
JMP loop
end: MOV ch2 -1
MOV ch2 0
MOV output ACC`);
  game_state.nodes.push(node2);

  let node3 = new Node('9x3');
  node3.setCode('MOV ch4 ch3');
  node3.pos[0] = 2;
  game_state.nodes.push(node3);

}

function statePlay(dt: number): void {
  game_state.tick(dt);

  let { nodes, puzzle_idx, input_idx } = game_state;
  let puzzle = puzzles[puzzle_idx];

  // draw goal
  panel({
    x: GOAL_X, y: GOAL_Y, w: GOAL_W, h: GOAL_H,
    sprite: ui.sprites.node_panel_info,
  });
  font.draw({
    color: palette_font[5],
    x: GOAL_X + PANEL_HPAD, y: GOAL_Y + PANEL_VPAD, w: GOAL_W - PANEL_HPAD * 2,
    align: ALIGN.HFIT|ALIGN.HWRAP,
    text: `GOAL: ${puzzle.title}\n${puzzle.goal}`,
  });

  // controls
  {
    let x = CONTROLS_X;
    let y = CONTROLS_Y;
    let w = ui.button_height;
    if (button({
      x, y, w,
      img: game_state.isPlaying() ? sprites.icon_pause : sprites.icon_play,
      shrink: 1,
      tooltip: game_state.isPlaying() ? 'Pause' : 'Start',
      disabled: game_state.hasError(),
    })) {
      game_state.play();
    }
    x += w + 2;
    if (game_state.isSimulating()) {
      if (button({
        x, y, w,
        img: sprites.icon_stop,
        shrink: 1,
        tooltip: 'Stop',
      })) {
        game_state.stop();
      }
      x += w + 2;
      if (button({
        x, y, w,
        img: sprites.icon_step,
        shrink: 1,
        tooltip: 'Step 1 instruction',
      })) {
        game_state.step();
      }
      x += w + 2;
      button({
        x, y, w,
        img: sprites.icon_ff,
        shrink: 1,
        tooltip: 'Fast-forward',
      });
      x += w + 2;
    } else {
      button({
        x, y, w,
        img: sprites.icon_undo,
        shrink: 1,
        tooltip: 'Undo',
        disabled: true,
      });
      x += w + 2;
      button({
        x, y, w,
        img: sprites.icon_redo,
        shrink: 1,
        tooltip: 'Redo',
        disabled: true,
      });
      x += w + 2;
      button({
        x, y, w,
        img: sprites.icon_help,
        shrink: 1,
        tooltip: 'RTFM',
      });
      x += w + 2;
    }
    button({
      x, y, w,
      img: sprites.icon_menu,
      shrink: 1,
      tooltip: game_state.isSimulating() ?
        'Stop, save, and return to puzzle select' :
        'Save and return to puzzle select',
    });
    x += w + 2;
  }

  // draw input
  {
    let y = INPUT_Y;
    panel({
      x: INPUT_X, y, w: INPUT_W, h: INPUT_H,
      sprite: ui.sprites.node_panel_info,
    });
    font.draw({
      color: palette_font[5],
      x: INPUT_X + PANEL_HPAD, y: y + PANEL_VPAD, w: INPUT_W - PANEL_HPAD * 2,
      align: ALIGN.HCENTER,
      text: 'INPUT',
    });
    y += CHH + 6;
    for (let ii = 0; ii < puzzle.input.length; ++ii) {
      let v = puzzle.input[ii];
      // if (ii === input_idx) {
      //   drawRect(INPUT_X+1, y, INPUT_X + INPUT_W - 1, y + CHH - 1, Z.UI + 1, palette[3]);
      // }
      font.draw({
        color: palette_font[ii < input_idx && game_state.isSimulating() ? 3 : 5],
        x: INPUT_X, y, w: INPUT_W,
        align: ALIGN.HCENTER,
        text: `${v}`,
        z: Z.UI + 2,
      });
      y += CHH;
    }
  }
  // draw output
  {
    let y = OUTPUT_Y;
    let y1 = OUTPUT_Y + OUTPUT_H;
    panel({
      x: OUTPUT_X, y, w: OUTPUT_W, h: OUTPUT_H,
      sprite: ui.sprites.node_panel_info,
    });
    font.draw({
      color: palette_font[5],
      x: OUTPUT_X, y: y + PANEL_VPAD, w: OUTPUT_W,
      align: ALIGN.HCENTER,
      text: 'OUTPUT',
    });
    y += CHH + 6;
    let line_x = OUTPUT_X + OUTPUT_W/2;
    drawLine(line_x, y, line_x, y1-2, Z.UI + 1, 1, 1, palette[9]);
    let y0 = y;
    for (let ii = 0; ii < puzzle.output.length; ++ii) {
      let v = puzzle.output[ii];
      let out_v = game_state.output[ii];
      if (out_v !== undefined && out_v !== v) {
        drawRect(OUTPUT_X+1, y, OUTPUT_X + OUTPUT_W - 1, y + CHH - 1, Z.UI + 1, palette[7]);
      }
      font.draw({
        color: palette_font[5],
        x: OUTPUT_X, y, w: OUTPUT_W/2,
        align: ALIGN.HCENTER,
        text: `${v}`,
        z: Z.UI + 2,
      });
      y += CHH;
    }
    y = y0;
    for (let ii = 0; ii < game_state.output.length; ++ii) {
      let v = game_state.output[ii];
      if (ii >= puzzle.output.length) {
        drawRect(OUTPUT_X+1, y - 2, OUTPUT_X + OUTPUT_W - 1, y + CHH - 3, Z.UI + 1, palette[7]);
      }
      font.draw({
        color: palette_font[5],
        x: OUTPUT_X + OUTPUT_W/2, y, w: OUTPUT_W/2,
        align: ALIGN.HCENTER,
        text: `${v}`,
        z: Z.UI + 2,
      });
      y += CHH;
    }
  }

  // draw nodes
  panel({
    x: NODES_X,
    y: NODES_Y,
    w: NODES_W,
    h: NODES_H,
    sprite: ui.sprites.node_panel_bg,
  });
  drawLine(NODE_X[1] - 3, NODES_Y, NODE_X[1] - 3, NODES_Y + NODES_H - 1, Z.UI + 1, 1, 1, palette[8]);
  drawLine(NODE_X[2] - 3, NODES_Y, NODE_X[2] - 3, NODES_Y + NODES_H - 1, Z.UI + 1, 1, 1, palette[8]);

  for (let ii = 0; ii < nodes.length; ++ii) {
    let node = nodes[ii];
    let { acc, active_radios, radio_state, error_idx, error_str, step_idx } = node;
    let node_type = node_types[node.type];
    let x = NODE_X[node.pos[0]];
    let x1 = x + NODE_W - 1;
    let y = NODE_Y + node.pos[1] * CHH;
    let y1 = y + node_type.h;
    panel({
      x, y,
      w: NODE_W,
      h: node_type.h,
      z: Z.NODES,
      sprite: ui.sprites.node_panel,
    });
    y+=2;
    font.draw({
      color: palette_font[7],
      x, y, z: Z.NODES + 1,
      w: NODE_W,
      text: node.type,
      align: ALIGN.HCENTER,
    });
    y += CHH;
    x += 4;
    font.draw({
      color: palette_font[5],
      x, y, z: Z.NODES + 1,
      w: CODE_LINE_W * CHW,
      align: ALIGN.HFIT|ALIGN.HWRAP,
      text: node.code,
    });
    if (!game_state.isEditing()) {
      drawRect(x-1, y + step_idx * CHH, x + CODE_LINE_W*CHW+2, y + (step_idx + 1) * CHH - 1, Z.NODES+0.25, palette[0]);
    }
    if (error_idx !== -1) {
      drawRect(x-1, y + error_idx * CHH, x + CODE_LINE_W*CHW+2, y + (error_idx + 1) * CHH - 1, Z.NODES+0.5, palette[6]);
      let h = font.draw({
        color: palette_font[4],
        x: x - 3, y, z: Z.NODES + 3,
        w: NODE_W, h: node_type.lines * CHH - 2,
        align: ALIGN.HCENTER | ALIGN.HWRAP | ALIGN.VBOTTOM,
        text: error_str!,
      });
      drawRect(x - 3, y1 - h, x1, y1 - 1, Z.NODES+2.5, palette[7]);
    }
    x += CODE_LINE_W*CHW + 4;
    drawLine(x, y - 1, x, y1 - 2, Z.NODES + 1, 1, 1, palette[2]);
    // draw accumulator and radio states
    let num_boxes = node_type.radios + 1;
    let radio_h = floor((y1 - y) / num_boxes);
    for (let jj = 0; jj < num_boxes; ++jj) {
      let yy = y + radio_h * jj;
      let text: string | null = null;
      let color = palette_font[10];
      if (jj === 0) {
        if (!game_state.isSimulating()) {
          text = 'ACC\n?';
        } else {
          text = `ACC\n${acc}`;
        }
      } else {
        let radio_idx = active_radios[jj - 1];
        if (radio_idx && game_state.isSimulating()) {
          text = `ch${radio_idx}\n${radio_state[radio_idx]}`;
        } else {
          color = palette_font[0];
          text = 'chX\n?';
        }
      }
      let yy1 = (jj === num_boxes - 1) ? y1 - 1 : yy + radio_h - 2;
      drawRect(x, yy - 1, x + RADIO_W, yy1, Z.NODES+1, palette[1]);
      if (text) {
        font.draw({
          color,
          x: x + 2, y: yy, z: Z.NODES + 2,
          w: RADIO_W - 1,
          h: yy1 - yy,
          align: ALIGN.HVCENTER|ALIGN.HWRAP,
          text,
        });
      }
      if (jj !== 0) {
        let line_y = yy - 2;
        drawLine(x, line_y, x1, line_y, Z.NODES + 1, 1, 1, palette[2]);
      }
    }
  }
}

export function main(): void {
  if (engine.DEBUG) {
    // Enable auto-reload, etc
    net.init({ engine });
  }

  let pixely = 'strict';
  let ui_sprites = spriteSetGet('pixely');

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font: {
      info: require('./img/font/vga_16x1.json'),
      texture: 'font/vga_16x1',
    },
    viewport_postprocess: false,
    antialias: false,
    ui_sprites: {
      ...ui_sprites,
      button: { name: 'pixely/button', ws: [16, 16, 16], hs: [48] },
      button_rollover: { name: 'pixely/button_rollover', ws: [16, 16, 16], hs: [48] },
      button_down: { name: 'pixely/button_down', ws: [16, 16, 16], hs: [48] },
      button_disabled: { name: 'pixely/button_disabled', ws: [16, 16, 16], hs: [48] },
    },
    // pixel_aspect: (640/480) / (720 / 400),
  })) {
    return;
  }
  font = engine.font;

  // Perfect sizes for pixely modes
  ui.scaleSizes(13 / 32);
  ui.setFontHeight(16);
  ui.setPanelPixelScale(1);
  ui.uiSetPanelColor([1,1,1,1]);
  ui.setFontStyles(
    fontStyle(null, { color: palette_font[5] }),
    null,
    fontStyle(null, { color: palette_font[5] }),
    null);
  v4copy(engine.border_clear_color, palette[4]);
  v4copy(engine.border_color, palette[4]);

  init();

  engine.setState(statePlay);
}
