/*eslint global-require:off,no-labels:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('LD54'); // Before requiring anything else that might load from this

import assert from 'assert';
import * as camera2d from 'glov/client/camera2d';
import { editBox } from 'glov/client/edit_box';
import * as engine from 'glov/client/engine';
import {
  ALIGN,
  Font,
  fontStyle,
  fontStyleColored,
  intColorFromVec4Color,
} from 'glov/client/font';
import { KEYS } from 'glov/client/input';
import { link } from 'glov/client/link';
import { localStorageGet, localStorageSet } from 'glov/client/local_storage';
import * as net from 'glov/client/net';
import {
  ScoreSystem,
  scoreAlloc,
} from 'glov/client/score';
import { scoresDraw } from 'glov/client/score_ui';
import { spotGetCurrentFocusKey } from 'glov/client/spot';
import { spriteSetGet } from 'glov/client/sprite_sets';
import {
  Sprite,
  spriteCreate,
} from 'glov/client/sprites';
import * as ui from 'glov/client/ui';
import {
  button,
  buttonText,
  buttonWasFocused,
  drawLine,
  drawRect,
  loadUISprite,
  panel,
  playUISound,
} from 'glov/client/ui';
import { getURLBase } from 'glov/client/urlhash';
import { DataObject, TSMap } from 'glov/common/types';
import {
  arrayToSet,
  clamp,
  lerp,
  mod,
  plural,
} from 'glov/common/util';
import {
  Vec4,
  v4copy,
  vec4,
} from 'glov/common/vmath';

import {
  MAXINT,
  MININT,
  puzzle_ids,
  puzzles,
} from './puzzles';

const { floor, min } = Math;

const TICK_TIME = 1000;
const TICK_TIME_FF_START = 100;
const TICK_TIME_FF_MAX = 0.1;
const RADIO_FLASH = 750;
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

type ScoreData = {
  loc: number;
  nodes: number;
  cycles: number;
};

let score_systema: ScoreSystem<ScoreData>;
let score_systemb: ScoreSystem<ScoreData>;
let score_systemc: ScoreSystem<ScoreData>;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.UI = 100;
Z.NODES = 110;
Z.OVERLAY = 200;

const BUTTON_H = 48;

const CHW = 9;
const CHH = 16;
const CODE_LINE_W = 22;

const PANEL_HPAD = 8;
const PANEL_VPAD = 4;

const GOAL_X = 4;
const GOAL_Y = 4;
const GOAL_W = CHW * 60;
const GOAL_H = CHH * 6 + PANEL_VPAD * 2;
const INPUT_X = 4;
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

const CHANNELS_X = 4;
const CHANNELS_Y = NODES_Y + NODES_H + 4;
const CHANNELS_H = BUTTON_H;
const CHANNEL_W = CHANNELS_H;
const MAX_CHANNELS = 14;
const CHANNELS_PAD = 2;
// const CHANNELS_W = CHANNEL_W * MAX_CHANNELS + CHANNELS_PAD * (MAX_CHANNELS - 1);

// Virtual viewport for our game logic
const game_width = NODES_X + NODES_W + 4;
const game_height = CHANNELS_Y + CHANNELS_H + 4;

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
  constructor(public lines: number, public radios: number, public title: string) {
    this.h = (lines + 1) * CHH;
  }
}
let node_types: Record<string, NodeType> = {
  '4x1': new NodeType(4, 1, 'AW0401'),
  '9x3': new NodeType(9, 3, 'AW0903'),
  '16x5': new NodeType(16, 5, 'AW1605'),
};
const NUM_NODE_TYPES = Object.keys(node_types).length;

type OpDef = {
  params: ('channel' | 'register' | 'number' | 'label')[];
};
const OPDEF: TSMap<OpDef> = {
  mov: { params: ['register', 'number'] },
  dec: { params: [] },
  inc: { params: [] },
  neg: { params: [] },
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
    return `"${instr.toUpperCase()}" requires ${def.params.length} ${plural(def.params.length, 'parameter')}`;
  }
  let p: (string | number | null)[] = [null, null];
  for (let ii = 0; ii < def.params.length; ++ii) {
    let v = toks[ii + 1];
    let type = def.params[ii];
    if (isFinite(Number(v))) {
      if (type === 'number' || type === 'label') {
        p[ii] = Number(v);
      } else {
        return `Operand ${ii+1} must be a ${type}`;
      }
    } else if (type === 'label') {
      p[ii] = v;
    } else if (type === 'channel') {
      if (v.match(/^ch[1-9]\d*$/)) {
        p[ii] = v;
      } else {
        return `Operand ${ii+1} must be a ${type}`;
      }
    } else { // number or register, and parameter is not a number, so must be a register
      if (OKTOK[v] || v.match(/^ch[1-9]\d*$/)) {
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

let last_node_uid = 0;
class Node {
  pos = [0,0];
  uid = ++last_node_uid;
  code: string = '';
  radio_state!: Partial<Record<number, number>>;
  node_radio_activate_time!: Partial<Record<number, number>>;
  active_radios!: number[];
  step_idx!: number;
  acc!: number;
  node_type: NodeType;
  constructor(public type: string) {
    this.node_type = node_types[type];
    this.resetSim();
  }
  toJSON(): DataObject {
    return {
      x: this.pos[0],
      type: this.type,
      code: this.code,
    };
  }
  fromJSON(obj: DataObject): void {
    this.pos[0] = obj.x as number;
    this.setCode(obj.code as string);
  }
  resetSim(): void {
    this.acc = 0;
    this.step_idx = 0;
    this.radio_state = {};
    this.node_radio_activate_time = {};
    this.active_radios = [];
  }
  error_idx = -1;
  error_str: string | null = null;
  error_is_step = false;
  resetError(): void {
    if (this.error_is_step) {
      this.error_is_step = false;
      this.error_idx = -1;
      this.error_str = null;
    }
  }
  op_lines: Op[] = [];
  labels: TSMap<number> = {};
  setCode(code: string): void {
    this.error_idx = -1;
    this.error_str = null;
    this.error_is_step = false;
    this.code = code;
    let lines = code.split(/\n|\r/g);
    let node_type = node_types[this.type];
    if (lines.length > node_type.lines) {
      this.error_str = 'Too many lines';
      this.error_idx = node_type.lines - 1;
    }
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
      let toks = line.split(/[\s,]+/g);
      let op = parseOp(toks, ii);
      if (typeof op === 'string') {
        if (!this.error_str) {
          this.error_str = op;
          this.error_idx = ii;
        }
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
    this.error_is_step = true;
  }
  step(game_state: GameState): void {
    let { op_lines, step_idx, node_type, labels, active_radios, radio_state, node_radio_activate_time } = this;
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
          node_radio_activate_time[0] = engine.frame_timestamp;
          this.acc = v;
        } else if (p1 === 'output') {
          let err = game_state.addOutput(v);
          if (err) {
            return this.stepError(err);
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
          if (v) {
            node_radio_activate_time[radio_idx] = engine.frame_timestamp;
            game_state.activateRadio(radio_idx);
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
      case 'neg':
        this.acc = clamp(-this.acc, MININT, MAXINT);
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
  elapsed_time_ff = 0;
  fast_forward = false;
  set_idx = 0;
  radios: Partial<Record<number, number>> = {};
  radio_activate_time: Partial<Record<number, number>> = {};
  last_stats: ScoreData = { loc: 0, nodes: 0, cycles: 0 };
  toJSON(): DataObject {
    let stats = this.score();
    if (stats.loc !== this.last_stats.loc || stats.nodes !== this.last_stats.nodes) {
      this.last_stats = stats;
      this.last_stats.cycles = 0;
    }
    return { nodes: this.nodes.map((a) => a.toJSON()), stats: this.last_stats };
  }
  fromJSON(puzzle_idx: number, obj: DataObject): void {
    this.puzzle_idx = puzzle_idx;
    this.state = 'edit';
    this.nodes = (obj.nodes as DataObject[]).map((nobj: DataObject) => {
      let node = new Node(nobj.type as string);
      node.fromJSON(nobj);
      return node;
    });
    this.last_stats = obj.stats as ScoreData || this.last_stats;
    this.resetSim();
  }
  resetSimSet(): void {
    this.output = [];
    this.input_idx = 0;
    this.radios = {};
    this.radio_activate_time = {};
    this.nodes.forEach((node) => node.resetSim());
    this.elapsed_time_ff = 4000;
  }
  resetSim(): void {
    this.tick_idx = 0;
    this.set_idx = 0;
    this.fast_forward = false;
    this.resetSimSet();
    this.elapsed_time_ff = 0;
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
      this.tick_counter = this.stepTime();
    } else {
      this.tick_counter = 0;
    }
    this.state = 'play';
  }
  stop(): void {
    this.state = 'edit';
    if (this.set_idx !== 0) {
      this.set_idx = 0;
      this.output = [];
    }
    let { nodes } = this;
    nodes.forEach((node) => {
      node.resetError();
    });
  }
  activateRadio(radio_idx: number): void {
    this.radio_activate_time[radio_idx] = engine.frame_timestamp;
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
  input_read_idx!: number;
  readInput(): number {
    let puzzle = puzzles[this.puzzle_idx];
    let idx = this.input_read_idx;
    if (idx === -1) {
      idx = this.input_read_idx = this.input_idx++;
    }
    if (idx >= puzzle.sets[this.set_idx].input.length) {
      return MININT;
    } else {
      return puzzle.sets[this.set_idx].input[idx];
    }
  }
  did_output!: null | number;
  addOutput(v: number): string | null {
    if (this.did_output !== null) {
      if (this.did_output === v) {
        // collision, but ok
        return null;
      }
      playUISound('outbad');
      return 'Output collision';
    }
    if (this.output.length >= MAX_OUTPUT) {
      playUISound('outbad');
      return 'Output overflow';
    }
    let puzzle = puzzles[this.puzzle_idx];
    let pout = puzzle.sets[this.set_idx].output;
    if (this.output.length >= pout.length) {
      playUISound('outbad');
    } else if (v !== pout[this.output.length]) {
      playUISound('outbad');
    } else {
      playUISound('outgood');
    }
    this.output.push(v);
    this.did_output = v;
    return null;
  }
  stepTime(): number {
    if (!this.fast_forward) {
      return TICK_TIME;
    }
    return lerp(clamp(this.elapsed_time_ff/5000, 0, 1), TICK_TIME_FF_START, TICK_TIME_FF_MAX);
  }
  step(): void {
    if (this.state === 'win') {
      return;
    }
    assert(this.isSimulating());
    this.tick_idx++;
    this.input_read_idx = -1;
    this.did_output = null;
    let { nodes, radios, puzzle_idx, output, input_idx } = this;

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
    let success = output.length === puzzle.sets[this.set_idx].output.length &&
      input_idx === puzzle.sets[this.set_idx].input.length;
    for (let ii = 0; success && ii < output.length; ++ii) {
      if (output[ii] !== puzzle.sets[this.set_idx].output[ii]) {
        success = false;
      }
    }
    if (success) {
      if (this.set_idx === puzzle.sets.length - 1) {
        this.state = 'win';
        setTimeout(function () {
          playUISound('victory');
        }, 150);
        this.submitScore();
      } else {
        this.set_idx++;
        this.resetSimSet();
      }
    }
    if (this.hasError()) {
      playUISound('error');
    }
  }
  won(): boolean {
    return this.state === 'win';
  }
  score(): ScoreData {
    let loc = 0;
    let { nodes } = this;
    nodes.forEach((node) => {
      loc += node.op_lines.length;
    });
    return {
      loc,
      nodes: nodes.length,
      cycles: this.tick_idx,
    };
  }
  submitScore(): void {
    let score_data = this.score();
    score_systema.setScore(this.puzzle_idx, score_data);
    score_systemb.setScore(this.puzzle_idx, score_data);
    score_systemc.setScore(this.puzzle_idx, score_data);
    this.last_stats = score_data;
  }

  ff(): void {
    if (!this.isSimulating() || !this.isPlaying()) {
      this.play();
      this.fast_forward = true;
    } else {
      this.fast_forward = !this.fast_forward;
    }
    this.elapsed_time_ff = 0;
    if (this.tick_counter > this.stepTime()) {
      this.tick_counter = this.stepTime();
    }
  }
  tick(dt: number): void {
    if (!this.isPlaying()) {
      return;
    }
    this.elapsed_time_ff += dt;
    let step_time = this.stepTime();
    while (dt >= this.tick_counter) {
      if (this.hasError()) {
        return;
      }
      dt -= this.tick_counter;
      this.step();
      this.tick_counter = step_time;
    }
    this.tick_counter -= dt;
  }
}

let game_state: GameState;
let mode_quick_reference = false;
let cur_level_slot = 0;

const HELP = `QUICK REFERENCE
MOV [OUTPUT|ACC|chX] [INPUT|ACC|chX|number]
INC/DEC/NEG - modifies ACC           NOP - sleeps 1 cycle
JMP label; JGZ/JLZ/JEZ/JNZ chX label - >0 / <0 / =0 / <>0
Conditional J*Z ops must test a signal from other node(s).
Two signals on the same channel will sum.`;

let last_saved: string = '';
let undo_stack: string[] = [];
let undo_idx: number = -1; // where to write the next modified state
function undoReset(): void {
  last_saved = '';
  undo_stack = [];
}
function undoPush(force_save: boolean): void {
  let puzzle_id = puzzle_ids[game_state.puzzle_idx];
  let saved = game_state.toJSON();
  let saved_text = JSON.stringify(saved);
  if (saved_text !== last_saved) {
    let storage_key = `p${puzzle_id}.${cur_level_slot}`;
    if (saved.stats && !(saved.stats as DataObject).nodes) {
      localStorageSet(storage_key, undefined);
    } else {
      localStorageSet(storage_key, saved_text);
    }
    last_saved = saved_text;
    if (undo_idx !== -1) {
      undo_stack = undo_stack.slice(0, undo_idx);
      undo_idx = -1;
    }
    undo_stack.push(saved_text);
  }
}

function canUndo(): boolean {
  return undo_idx === -1 && undo_stack.length > 1 || undo_idx > 1;
}

function undoUndo(): void {
  let puzzle_id = puzzle_ids[game_state.puzzle_idx];
  undoPush(true);
  if (undo_idx === -1) {
    undo_idx = undo_stack.length - 1;
  } else {
    undo_idx--;
  }
  last_saved = undo_stack[undo_idx-1];
  game_state.fromJSON(game_state.puzzle_idx, JSON.parse(last_saved));
  localStorageSet(`p${puzzle_id}.${cur_level_slot}`, last_saved);
}

function canRedo(): boolean {
  return undo_idx !== -1;
}

function undoRedo(): void {
  let puzzle_id = puzzle_ids[game_state.puzzle_idx];
  last_saved = undo_stack[undo_idx];
  game_state.fromJSON(game_state.puzzle_idx, JSON.parse(last_saved));
  localStorageSet(`p${puzzle_id}.${cur_level_slot}`, last_saved);
  undo_idx++;
  if (undo_idx === undo_stack.length) {
    undo_idx = -1;
  }
}


let sprites: Record<string, Sprite> = {};
function init(): void {
  ['play', 'pause', 'stop', 'menu', 'redo', 'undo', 'help', 'ff', 'step'].forEach(function (name) {
    name = `icon_${name}`;
    sprites[name] = spriteCreate({ name });
  });
  sprites.channel_bg = spriteCreate({ name: 'channel_bg' });
  sprites.channel_bg_flash = spriteCreate({ name: 'channel_bg_flash' });
  sprites.x = spriteCreate({ name: 'x' });
  sprites.x_focused = spriteCreate({ name: 'x_focused' });
  loadUISprite('node_panel_bg', [16, 16, 16], [16, 16, 16]);
  loadUISprite('node_panel', [16, 16, 16], [32, 16, 16]);
  loadUISprite('node_panel_info', [16, 16, 16], [32, 16, 16]);
}

let cur_level_idx = 0;

function setStatePlay(): void {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  engine.setState(statePlay);
  playUISound('insert');
  setTimeout(function () {
    playUISound('floppy');
  }, 200);
}

function autoStartPuzzle(new_puzzle_idx: number): void {
  let new_puzzle_id = puzzle_ids[new_puzzle_idx];
  cur_level_slot = 0;
  let storage_key = `p${new_puzzle_id}.${cur_level_slot}`;
  let saved_data = localStorageGet(storage_key);
  if (saved_data) {
    cur_level_idx = new_puzzle_idx;
    game_state = new GameState();
    game_state.fromJSON(new_puzzle_idx, JSON.parse(saved_data));
    undoReset();
    setStatePlay();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    startPuzzle(new_puzzle_id);
  }
}

let last_focus: string = '';
function statePlay(dt: number): void {
  game_state.tick(dt);

  let { nodes, puzzle_idx, input_idx, radios, radio_activate_time, set_idx } = game_state;
  let puzzle = puzzles[puzzle_idx];

  if (game_state.won()) {
    // do overlay
    let score = game_state.score();
    let w = game_width/2;
    let h = game_height/2;
    let x = (game_width - w)/2;
    let y = (game_height - h)/2;
    let y1 = y + h;
    let z = Z.OVERLAY;
    let panel_param = {
      x, y, w, h, z,
      sprite: ui.sprites.node_panel_info,
    };

    z++;
    y += PANEL_VPAD;

    font.draw({
      color: palette_font[10],
      x, y, z, w,
      align: ALIGN.HCENTERFIT,
      text: 'SUCCESS!',
    });

    y += CHH + 8;
    y += font.draw({
      color: palette_font[5],
      x, y, z, w, h,
      align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
      text: `YOUR SCORE:\n${score.loc} Lines of code\n${score.nodes} Nodes\n${score.cycles} Cycles`,
    }) + 16;

    let scoresa = score_systema.getHighScores(game_state.puzzle_idx);
    let scoresb = score_systema.getHighScores(game_state.puzzle_idx);
    let scoresc = score_systema.getHighScores(game_state.puzzle_idx);

    y += font.draw({
      color: palette_font[5],
      x, y, z, w, h,
      align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
      text: 'HIGH SCORE:\n' +
        `${scoresa && scoresa.length ? scoresa[0].score.loc : '?'} Lines of code` +
        `${scoresa && scoresa.length ? ` (${scoresa[0].name})` : ''}\n` +
        `${scoresb && scoresb.length ? scoresb[0].score.nodes : '?'} Nodes` +
        `${scoresb && scoresb.length ? ` (${scoresb[0].name})` : ''}\n` +
        `${scoresc && scoresc.length ? scoresc[0].score.cycles : '?'} Cycles` +
        `${scoresc && scoresc.length ? ` (${scoresc[0].name})` : ''}`,
    }) + 16;

    let no_next_exercise = game_state.puzzle_idx === puzzles.length - 1;
    if (no_next_exercise) {
      y += font.draw({
        color: palette_font[0],
        x, y, z, w, h,
        align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
        text: 'CONGRATULATIONS!\n' +
          'For completing the final training exercise you have earned' +
          ' yourself a QPCA-77B Professional Certification, Rev IV.',
      }) + 16;
    }

    y = y1 - BUTTON_H - PANEL_VPAD;
    x += PANEL_HPAD;
    w -= PANEL_HPAD * 2;
    let button_w = floor((w - 8*2)/3);
    if (buttonText({
      x, y, z,
      w: button_w,
      text: 'Keep playing',
    })) {
      game_state.stop();
    }
    x += button_w + 8;

    if (buttonText({
      x, y, z,
      w: button_w,
      text: 'View Scores',
      sound_button: 'eject',
    })) {
      game_state.stop();
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      engine.setState(stateLevelSelect);
    }
    x += button_w + 8;

    if (buttonText({
      x, y, z,
      w: button_w,
      text: 'Next Exercise',
      disabled: no_next_exercise,
      sound_button: null,
    })) {
      autoStartPuzzle(game_state.puzzle_idx + 1);
    }
    x += button_w + 8;

    panel(panel_param);
  }

  // draw goal
  panel({
    x: GOAL_X, y: GOAL_Y, w: GOAL_W, h: GOAL_H,
    sprite: ui.sprites.node_panel_info,
  });
  if (game_state.won() && false) {
    let score = game_state.score();
    let y = GOAL_Y + PANEL_VPAD + CHH + 4;
    font.draw({
      color: palette_font[10],
      x: GOAL_X + PANEL_HPAD, y, w: GOAL_W - PANEL_HPAD * 2, h: GOAL_H - PANEL_VPAD*2 - CHH,
      align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
      text: 'SUCCESS!',
    });
    y += CHH + 8;
    font.draw({
      color: palette_font[5],
      x: GOAL_X + PANEL_HPAD, y, w: GOAL_W - PANEL_HPAD * 2, h: GOAL_H - PANEL_VPAD*2 - CHH,
      align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
      text: `${score.cycles} Cycles\n${score.loc} Lines of code\n${score.nodes} Nodes`,
    });
  }
  font.draw({
    color: palette_font[5],
    x: GOAL_X + PANEL_HPAD, y: GOAL_Y + PANEL_VPAD, w: GOAL_W - PANEL_HPAD * 2,
    align: ALIGN.HFIT|ALIGN.HWRAP,
    text: mode_quick_reference && !game_state.won() ? HELP :
      `GOAL: ${puzzle.title}\n${puzzle.goal}`,
  });

  // draw controls
  {
    let x = CONTROLS_X;
    let y = CONTROLS_Y;
    let w = ui.button_height;

    if (game_state.isSimulating()) {
      let status = 'RUNNING';
      if (game_state.won()) {
        status = 'SUCCESS';
      } else if (game_state.hasError()) {
        status = 'ERROR';
      } else if (!game_state.isPlaying()) {
        status = 'PAUSED';
      }
      font.draw({
        color: palette_font[5],
        x, y: y + BUTTON_H + 12,
        w: 1000,
        align: ALIGN.HWRAP,
        text: `Cycles: ${game_state.tick_idx}\nStatus: ${status}`,
      });
    }

    let disabled = game_state.hasError() || game_state.won();
    if (button({
      x, y, w,
      img: game_state.isPlaying() ? sprites.icon_pause : sprites.icon_play,
      shrink: 1,
      tooltip: game_state.isPlaying() ? '[F1] Pause' : '[F1] Start',
      disabled,
      hotkey: KEYS.F1,
    })) {
      undoPush(true);
      game_state.play();
    }
    x += w + 2;
    if (button({
      x, y, w,
      img: sprites.icon_step,
      shrink: 1,
      tooltip: !game_state.isSimulating() ? '[F2] Start paused' : !game_state.isPlaying() ?
        '[F2] Step 1 instruction' :
        '[F2] Step 1 instruction then pause',
      disabled,
      hotkey: KEYS.F2,
    })) {
      if (!game_state.isSimulating()) {
        // just start playing and pause
        undoPush(true);
        game_state.play();
        game_state.play();
      } else {
        if (game_state.isPlaying()) {
          // pause first
          game_state.play();
        }
        game_state.step();
      }
    }
    x += w + 2;
    if (button({
      x, y, w,
      img: sprites.icon_ff,
      shrink: 1,
      tooltip: '[F3] Fast-forward',
      disabled,
      hotkey: KEYS.F3,
    })) {
      if (!game_state.isSimulating()) {
        undoPush(true);
      }
      game_state.ff();
    }
    x += w + 2;
    if (game_state.isSimulating()) {
      if (button({
        x, y, w,
        img: sprites.icon_stop,
        shrink: 1,
        tooltip: '[F4] Stop',
        hotkey: KEYS.F4,
      })) {
        game_state.stop();
      }
      x += w + 2;
      x += w + 2;
    } else {
      if (button({
        x, y, w,
        img: sprites.icon_undo,
        shrink: 1,
        tooltip: '[F8] Undo',
        disabled: !canUndo(),
        hotkey: KEYS.F8,
      })) {
        undoUndo();
      }
      x += w + 2;
      if (button({
        x, y, w,
        img: sprites.icon_redo,
        shrink: 1,
        tooltip: '[F9] Redo',
        disabled: !canRedo(),
        hotkey: KEYS.F9,
      })) {
        undoRedo();
      }
      x += w + 2;
    }
    if (button({
      x, y, w,
      img: sprites.icon_help,
      shrink: 1,
      tooltip: 'Toggle Quick Reference',
    })) {
      mode_quick_reference = !mode_quick_reference;
    }
    x += w + 2;
    if (button({
      x, y, w,
      img: sprites.icon_menu,
      shrink: 1,
      tooltip: game_state.isSimulating() ?
        'Stop, save, and return to exercise select' :
        'Save and return to exercise select',
      hotkey: KEYS.ESC,
      sound_button: 'eject',
    })) {
      undoPush(true);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      engine.setState(stateLevelSelect);
    }
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
    for (let ii = 0; ii < puzzle.sets[set_idx].input.length; ++ii) {
      let v = puzzle.sets[set_idx].input[ii];
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
    let poutput = puzzle.sets[set_idx].output;
    for (let ii = 0; ii < puzzle.sets[set_idx].output.length; ++ii) {
      let v = poutput[ii];
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
      let puzv = poutput[ii];
      if (ii >= poutput.length || v !== puzv) {
        drawRect(OUTPUT_X+1, y, OUTPUT_X + OUTPUT_W - 1, y + CHH - 1, Z.UI + 1, palette[7]);
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
    eat_clicks: false,
  });
  drawLine(NODE_X[1] - 3, NODES_Y, NODE_X[1] - 3, NODES_Y + NODES_H - 1, Z.UI + 1, 1, 1, palette[8]);
  drawLine(NODE_X[2] - 3, NODES_Y, NODE_X[2] - 3, NODES_Y + NODES_H - 1, Z.UI + 1, 1, 1, palette[8]);

  let node_y = [NODE_Y, NODE_Y, NODE_Y];

  let remove_nodes = [];
  for (let ii = 0; ii < nodes.length; ++ii) {
    let node = nodes[ii];
    let { acc, active_radios, radio_state, node_radio_activate_time, error_idx, error_str, step_idx } = node;
    let node_type = node_types[node.type];
    let x = NODE_X[node.pos[0]];
    let x1 = x + NODE_W - 1;
    let y = node_y[node.pos[0]];
    let y1 = y + node_type.h;
    node_y[node.pos[0]] = y1 + 2;
    if (game_state.isEditing()) {
      if (button({
        x: x + NODE_W - CHH - 5,
        y, z: Z.NODES + 1,
        w: CHH,
        h: CHH,
        img: sprites.x,
        shrink: 1,
        no_bg: true,
        // tooltip: 'Delete node', - not over DOM
      })) {
        remove_nodes.push(ii);
      }
      if (buttonWasFocused()) {
        sprites.x_focused.draw({
          x: x + NODE_W - CHH - 5,
          y, z: Z.NODES + 0.5,
          w: CHH,
          h: CHH,
        });
      }
    }
    panel({
      x, y,
      w: NODE_W,
      h: node_type.h,
      z: Z.NODES,
      sprite: ui.sprites.node_panel,
      eat_clicks: false,
    });
    y+=2;
    font.draw({
      color: palette_font[7],
      x, y, z: Z.NODES + 1,
      w: NODE_W,
      text: node_type.title,
      align: ALIGN.HCENTER,
    });
    y += CHH;
    x += 4;
    if (game_state.isEditing()) {
      let last_code = node.code;
      let ebr = editBox({
        key: `node${node.uid}`,
        x, y, z: Z.NODES+1,
        w: CODE_LINE_W * CHW,
        type: 'text',
        font_height: CHH,
        text: node.code,
        multiline: node_type.lines,
        max_len: CODE_LINE_W,
        initial_focus: true,
      }, node.code);
      if (ebr.text !== last_code) {
        node.setCode(ebr.text);
        // undoPush(false);
      }
    } else {
      font.draw({
        color: palette_font[5],
        x, y, z: Z.NODES + 1,
        w: CODE_LINE_W * CHW,
        align: ALIGN.HFIT|ALIGN.HWRAP,
        text: node.code,
      });
      drawRect(x-1, y + step_idx * CHH, x + CODE_LINE_W*CHW+2, y + (step_idx + 1) * CHH - 1, Z.NODES+0.25, palette[0]);
    }
    if (error_idx !== -1) {
      drawRect(x-1, y + error_idx * CHH - 2,
        x + CODE_LINE_W*CHW+2, y + (error_idx + 1) * CHH - 2, Z.NODES+0.5, palette[6]);
      let error_y = y1 - 1;
      let h = font.draw({
        color: palette_font[4],
        x: x - 3, y: error_y, z: Z.NODES + 3,
        w: NODE_W,
        align: ALIGN.HCENTER | ALIGN.HWRAP,
        text: error_str!,
      });
      drawRect(x - 3, error_y, x1, error_y + h - 1, Z.NODES+2.5, palette[7]);
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
      let at: number | undefined;
      if (jj === 0) {
        if (!game_state.isSimulating()) {
          text = 'ACC\n?';
        } else {
          text = `ACC\n${acc}`;
          at = node_radio_activate_time[0];
        }
      } else {
        let radio_idx = active_radios[jj - 1];
        if (radio_idx && game_state.isSimulating()) {
          text = `ch${radio_idx}\n${radio_state[radio_idx]}`;
          at = node_radio_activate_time[radio_idx];
        } else {
          color = palette_font[0];
          text = 'chX\n?';
        }
      }
      let yy1 = (jj === num_boxes - 1) ? y1 - 1 : yy + radio_h - 2;
      drawRect(x, yy - 1, x + RADIO_W, yy1, Z.NODES+1, palette[1]);
      if (at) {
        let flash_dt = engine.frame_timestamp - at;
        if (flash_dt < RADIO_FLASH) {
          let c = palette[0];
          drawRect(x, yy - 1, x + RADIO_W, yy1, Z.NODES+1.1, [c[0], c[1], c[2], 1-flash_dt/RADIO_FLASH]);
        }
      }
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
  if (remove_nodes.length) {
    for (let ii = remove_nodes.length - 1; ii >= 0; --ii) {
      nodes.splice(remove_nodes[ii], 1);
    }
    undoPush(true);
  }

  for (let column = 0; column < 3; ++column) {
    let max_y = node_y[column];
    let x = NODE_X[column];
    let x1 = x + NODE_W - 1;
    let avail_h = NODES_Y + NODES_H - max_y;
    if (avail_h >= node_types['4x1'].h) {
      let button_w = floor((x1 - x - 4 * (NUM_NODE_TYPES-1)) / NUM_NODE_TYPES);
      for (let key in node_types) {
        let node_type = node_types[key];
        if (button({
          x,
          y: node_y[column],
          // font_height: CHH * 2,
          w: button_w,
          text: `+${node_type.title}`,
          disabled: node_type.h > avail_h,
          tooltip: `Add a ${node_type.title} node\n` +
            `${node_type.lines} LOC\n${node_type.radios} ${plural(node_type.radios, 'Radio')}`,
        })) {
          let node = new Node(key);
          node.pos[0] = column;
          nodes.push(node);
          undoPush(true);
        }
        x += button_w + 4;
      }
    }
  }

  // draw channels
  {
    let x = CHANNELS_X;
    let y = CHANNELS_Y;
    for (let ii = 0; ii < MAX_CHANNELS; ++ii) {
      let radio_idx = ii + 1;
      sprites.channel_bg.draw({
        x, y, w: CHANNEL_W, h: CHANNEL_W,
      });
      let at = radio_activate_time[radio_idx];
      let color = palette_font[0];
      if (at) {
        let flashdt = engine.frame_timestamp - at;
        if (flashdt < RADIO_FLASH) {
          sprites.channel_bg_flash.draw({
            x, y, w: CHANNEL_W, h: CHANNEL_W, z: Z.UI + 1,
            color: [1,1,1,1 - flashdt/RADIO_FLASH],
          });
          color = palette_font[10];
        }
      }
      let text = `ch${radio_idx}\n0`;
      if (game_state.isSimulating()) {
        let v = radios[radio_idx] || 0;
        if (v) {
          color = palette_font[10];
          text = `ch${radio_idx}\n${v}`;
        }
      }
      font.draw({
        color,
        x, y, z: Z.UI + 2,
        w: CHANNEL_W, h: CHANNEL_W,
        align: ALIGN.HVCENTER|ALIGN.HWRAP,
        text,
      });
      x += CHANNEL_W + CHANNELS_PAD;
    }
  }

  let param = {
    x: game_width - BUTTON_H * 4 - 4,
    y: CHANNELS_Y,
    w: BUTTON_H * 4, h: BUTTON_H,
    text: 'Reference Manual',
    url: `${getURLBase()}manual.html`,
    tooltip: 'RTFM',
  };
  if (link(param)) {
    playUISound('button_click');
  }
  buttonText(param);


  let focus_key = spotGetCurrentFocusKey();
  if (focus_key !== last_focus) {
    last_focus = focus_key;
    undoPush(true);
  }
}

function startPuzzle(id: string): void {
  cur_level_idx = puzzle_ids.indexOf(id);
  mode_quick_reference = false;
  let idx = puzzle_ids.indexOf(id);
  assert(idx !== -1);
  game_state = new GameState();
  game_state.puzzle_idx = idx;

  if (engine.DEBUG && id === 'mult2') {
    let node1 = new Node('9x3');
    node1.setCode(`MOV ch3 INPUT
MOV ACC INPUT
loop: MOV ch1 ACC
wait: JEZ ch2 wait
JLZ ch2 end
DEC
JMP loop
end:`);
    game_state.nodes.push(node1);
    let node2 = new Node('16x5');
    node2.pos[0] = 0;
    node2.setCode(`MOV acc 0
loop: NOP
NOP
NOP
JEZ ch1 end
MOV ch3 acc
MOV ch2 1
MOV acc ch4
MOV ch2 0
JMP loop
end: MOV ch2 -1
NOP
MOV ch2 0
MOV output ACC
NOP`);
    game_state.nodes.push(node2);

    let node3 = new Node('4x1');
    node3.setCode('MOV ch4 ch3');
    node3.pos[0] = 2;
    game_state.nodes.push(node3);
  }

  undoReset();
  setStatePlay();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ColumnDef = any;

const SCORE_COLUMNSA: ColumnDef[] = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 12, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: '', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER }, // Name
  { name: 'LOC', width: 24 },
];
const SCORE_COLUMNSB: ColumnDef[] = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 12, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: '', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER }, // Name
  { name: 'NODES', width: 24 },
];
const SCORE_COLUMNSC: ColumnDef[] = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 12, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: '', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER }, // Name
  { name: 'CYCLES', width: 24 },
];
const style_score = fontStyleColored(null, palette_font[9]);
const style_me = fontStyleColored(null, palette_font[10]);
const style_header = fontStyleColored(null, palette_font[6]);
function myScoreToRowA(row: unknown[], score: ScoreData): void {
  row.push(score.loc);
}
function myScoreToRowB(row: unknown[], score: ScoreData): void {
  row.push(score.nodes);
}
function myScoreToRowC(row: unknown[], score: ScoreData): void {
  row.push(score.cycles);
}

const MAX_SLOTS = 3;

let choosing_new_game = false;
function stateLevelSelect(dt: number): void {
  const TITLE_H = CHH * 2;
  // const PAD = 4;
  const MAX_LEVEL = puzzle_ids.length;
  let x = 0;
  let y = 4;

  const button_h = BUTTON_H;
  let button_w = BUTTON_H * 3;
  const arrow_inset = 100;
  if (buttonText({
    x: x + arrow_inset, y,
    h: button_h, w: button_w,
    text: 'PREV',
    disabled: cur_level_idx === 0,
  })) {
    cur_level_idx--;
    choosing_new_game = false;
    score_systema.forceRefreshScores(cur_level_idx);
    score_systemb.forceRefreshScores(cur_level_idx);
    score_systemc.forceRefreshScores(cur_level_idx);
  }
  if (buttonWasFocused() && cur_level_idx > 0) {
    score_systema.prefetchScores(cur_level_idx - 1);
    score_systemb.prefetchScores(cur_level_idx - 1);
    score_systemc.prefetchScores(cur_level_idx - 1);
  }

  if (buttonText({
    x: game_width - button_w - arrow_inset, y,
    h: button_h, w: button_w,
    text: 'NEXT',
    disabled: cur_level_idx === MAX_LEVEL - 1,
  })) {
    cur_level_idx++;
    choosing_new_game = false;
    score_systema.forceRefreshScores(cur_level_idx);
    score_systemb.forceRefreshScores(cur_level_idx);
    score_systemc.forceRefreshScores(cur_level_idx);
  }
  if (buttonWasFocused() && cur_level_idx < MAX_LEVEL - 1) {
    score_systema.prefetchScores(cur_level_idx + 1);
    score_systemb.prefetchScores(cur_level_idx + 1);
    score_systemc.prefetchScores(cur_level_idx + 1);
  }

  // y += (button_h - TITLE_H) / 2;

  font.draw({
    color: palette_font[8],
    x, y, w: game_width,
    align: ALIGN.HCENTER|ALIGN.HWRAP,
    size: CHH,
    text: `QPCA-77b Training Exercise ${cur_level_idx + 1} / ${MAX_LEVEL}`,
  });
  y += CHH;
  font.draw({
    color: palette_font[10],
    x, y, w: game_width,
    align: ALIGN.HCENTER|ALIGN.HWRAP,
    size: TITLE_H,
    text: puzzles[cur_level_idx].title,
  });
  y += TITLE_H;
  y += font.draw({
    color: palette_font[8],
    x, y, w: game_width,
    align: ALIGN.HCENTER|ALIGN.HWRAP,
    size: CHH,
    text: puzzles[cur_level_idx].desc || puzzles[cur_level_idx].goal,
  });

  // let has_score = false; // score_systema.hasScore(cur_level_idx);

  const button_y = camera2d.y1() - button_h - 4;
  const H = button_y;
  let pad = 12;
  const W = game_width - pad * 2;
  const width = floor((W - pad*2)/3);
  x = pad;
  let score_common = {
    width,
    y, height: H - y,
    z: Z.UI,
    size: CHH,
    line_height: CHH+8,
    level_index: cur_level_idx,
    style_score,
    style_me,
    style_header,
    color_line: palette[0],
    color_me_background: palette[1],
    allow_rename: false,
  };
  scoresDraw({
    ...score_common,
    score_system: score_systema,
    x,
    columns: SCORE_COLUMNSA,
    scoreToRow: myScoreToRowA,
    allow_rename: true,
  });
  x += width + pad;

  scoresDraw({
    ...score_common,
    score_system: score_systemb,
    x,
    columns: SCORE_COLUMNSB,
    scoreToRow: myScoreToRowB,
  });
  x += width + pad;

  scoresDraw({
    ...score_common,
    score_system: score_systemc,
    x,
    columns: SCORE_COLUMNSC,
    scoreToRow: myScoreToRowC,
  });

  y = button_y;
  button_w = floor(BUTTON_H * 1.5);
  x = 4 + BUTTON_H;
  let puzzle_id = puzzle_ids[cur_level_idx];
  for (let ii = 0; ii < MAX_SLOTS; ++ii) {
    let storage_key = `p${puzzle_id}.${ii}`;
    let saved_data = localStorageGet(storage_key);
    let xstart = x;
    if (saved_data) {
      if (choosing_new_game) {
        if (buttonText({
          x, y,
          w: button_w * 2 + 4, h: button_h,
          text: `COPY FROM SAVE ${ii+1}`,
          sound_button: null,
        })) {
          choosing_new_game = false;
          game_state = new GameState();
          game_state.fromJSON(cur_level_idx, JSON.parse(saved_data));
          undoReset();
          setStatePlay();
        }
        x += button_w * 2 + 4 * 2;
      } else {
        let can_resume = (cur_level_slot === ii && game_state && game_state.puzzle_idx === cur_level_idx);
        if (buttonText({
          x, y,
          w: button_w, h: button_h,
          text: can_resume ? 'RESUME' : 'LOAD',
          sound_button: null,
        })) {
          if (can_resume) {
            game_state.stop();
          } else {
            cur_level_slot = ii;
            game_state = new GameState();
            game_state.fromJSON(cur_level_idx, JSON.parse(saved_data));
            undoReset();
          }
          setStatePlay();
        }
        x += button_w + 4;
        if (buttonText({
          x, y,
          w: button_w, h: button_h,
          text: 'DEL',
        })) {
          localStorageSet(storage_key, undefined);
        }
        x += button_w + 4;
      }
    } else {
      if (choosing_new_game) {
        if (cur_level_slot === ii) {
          if (buttonText({
            x, y,
            w: button_w * 2 + 4, h: button_h,
            text: 'START FRESH',
            sound_button: null,
          })) {
            choosing_new_game = false;
            startPuzzle(puzzle_id);
          }
        }
        x += button_w * 2 + 4 * 2;
      } else {
        x += button_w/2 + 2;
        let has_any_other = false;
        for (let jj = 0; jj < MAX_SLOTS; ++jj) {
          if (jj !== ii) {
            let other_key = `p${puzzle_id}.${jj}`;
            if (localStorageGet(other_key)) {
              has_any_other = true;
            }
          }
        }
        if (buttonText({
          x, y,
          w: button_w, h: button_h,
          text: 'NEW',
          sound_button: has_any_other ? undefined : null,
        })) {
          cur_level_slot = ii;
          if (has_any_other) {
            // prompt for "start fresh" or "copy from slot X"
            choosing_new_game = true;
          } else {
            startPuzzle(puzzle_id);
          }
        }
        x += button_w + 4;
        x += button_w/2 + 2;
      }
    }
    font.draw({
      color: palette_font[9],
      y: y - CHH*2,
      x: xstart, w: x - xstart,
      align: ALIGN.HCENTER,
      text: `Save ${ii+1}`,
    });
    if (saved_data) {
      let stats = JSON.parse(saved_data).stats;
      if (stats) {
        font.draw({
          color: palette_font[9],
          y: y - CHH,
          x: xstart, w: x - xstart,
          align: ALIGN.HCENTER,
          text: `${stats.loc}L/${stats.nodes}N/${stats.cycles || '?'}C`,
        });
      }
    }
    x += 8;
  }

  let param = {
    x: game_width - button_h * 4 - 4,
    y,
    w: button_h * 4, h: button_h,
    text: 'Reference Manual',
    url: `${getURLBase()}manual.html`,
  };
  if (link(param)) {
    playUISound('button_click');
  }
  buttonText(param);
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
    show_fps: false,
  })) {
    return;
  }
  font = engine.font;

  window.addEventListener('keydown',function (e) {
    if (e.keyCode === 112 || e.keyCode === 113 || e.keyCode === 114) {
      e.preventDefault();
    }
  });

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
  ui.uiBindSounds({
    button_click: ['click1', 'click2', 'click3', 'click4', 'click5', 'click6'],
    error: 'error',
    victory: 'victory',
    outgood: { file: 'outgood', volume: 0.3 },
    outbad: { file: 'outbad', volume: 0.5 },
    insert: 'insert',
    eject: 'eject',
    floppy: 'floppy',
  });

  init();

  const ENCODE_CYCLES = 100000000;
  const ENCODE_NODES = 100;
  const ENCODE_LOC = 1000;
  // min everything
  function encodeScoreLOC(score: ScoreData): number {
    let {
      loc,
      nodes,
      cycles,
    } = score;

    loc = ENCODE_LOC - 1 - min(loc, ENCODE_LOC-1);
    nodes = ENCODE_NODES - 1 - min(nodes, ENCODE_NODES-1);
    cycles = ENCODE_CYCLES - 1 - min(cycles, ENCODE_CYCLES-1);
    return loc * ENCODE_NODES * ENCODE_CYCLES + nodes * ENCODE_CYCLES + cycles;
  }
  function encodeScoreNodes(score: ScoreData): number {
    let {
      loc,
      nodes,
      cycles,
    } = score;

    loc = ENCODE_LOC - 1 - min(loc, ENCODE_LOC-1);
    nodes = ENCODE_NODES - 1 - min(nodes, ENCODE_NODES-1);
    cycles = ENCODE_CYCLES - 1 - min(cycles, ENCODE_CYCLES-1);
    return nodes * ENCODE_CYCLES * ENCODE_LOC + cycles * ENCODE_LOC + loc;
  }
  function encodeScoreCycles(score: ScoreData): number {
    let {
      loc,
      nodes,
      cycles,
    } = score;

    loc = ENCODE_LOC - 1 - min(loc, ENCODE_LOC-1);
    nodes = ENCODE_NODES - 1 - min(nodes, ENCODE_NODES-1);
    cycles = ENCODE_CYCLES - 1 - min(cycles, ENCODE_CYCLES-1);
    return cycles * ENCODE_LOC * ENCODE_NODES + loc * ENCODE_NODES + nodes;
  }

  function parseScoreLOC(value: number): ScoreData {
    let loc = floor(value / (ENCODE_NODES * ENCODE_CYCLES));
    value -= loc * ENCODE_NODES * ENCODE_CYCLES;
    let nodes = floor(value / ENCODE_CYCLES);
    value -= nodes * ENCODE_CYCLES;
    loc = ENCODE_LOC - 1 - loc;
    nodes = ENCODE_NODES - 1 - nodes;
    let cycles = ENCODE_CYCLES - 1 - value;
    return {
      loc,
      nodes,
      cycles,
    };
  }
  function parseScoreNodes(value: number): ScoreData {
    let nodes = floor(value / (ENCODE_LOC * ENCODE_CYCLES));
    value -= nodes * ENCODE_LOC * ENCODE_CYCLES;
    let cycles = floor(value / ENCODE_LOC);
    value -= cycles * ENCODE_LOC;
    let loc = ENCODE_LOC - 1 - value;
    nodes = ENCODE_NODES - 1 - nodes;
    cycles = ENCODE_CYCLES - 1 - cycles;
    return {
      loc,
      nodes,
      cycles,
    };
  }
  function parseScoreCycles(value: number): ScoreData {
    let cycles = floor(value / (ENCODE_NODES * ENCODE_LOC));
    value -= cycles * ENCODE_NODES * ENCODE_LOC;
    let loc = floor(value / ENCODE_NODES);
    value -= loc * ENCODE_NODES;
    loc = ENCODE_LOC - 1 - loc;
    let nodes = ENCODE_NODES - 1 - value;
    cycles = ENCODE_CYCLES - 1 - cycles;
    return {
      loc,
      nodes,
      cycles,
    };
  }

  let level_defs = puzzles.map((a) => ({ name: a.id }));
  score_systema = scoreAlloc({
    score_to_value: encodeScoreLOC,
    value_to_score: parseScoreLOC,
    level_defs: level_defs,
    score_key: 'LD54loc'
  });
  score_systemb = scoreAlloc({
    score_to_value: encodeScoreNodes,
    value_to_score: parseScoreNodes,
    level_defs: level_defs,
    score_key: 'LD54nod'
  });
  score_systemc = scoreAlloc({
    score_to_value: encodeScoreCycles,
    value_to_score: parseScoreCycles,
    level_defs: level_defs,
    score_key: 'LD54cyc'
  });


  if (engine.DEBUG && true) {
    autoStartPuzzle(puzzle_ids.indexOf('alt'));
    // game_state.ff();
  } else {
    engine.setState(stateLevelSelect);
  }
}
