/*eslint global-require:off,no-labels:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('LD54'); // Before requiring anything else that might load from this

// eslint-disable-next-line import/order
import { platformRegister } from 'glov/common/platform';
platformRegister('itch', {
  devmode: 'auto',
  reload: true,
  reload_updates: true,
});


import assert from 'assert';
import {
  AnimationSequencer,
  animationSequencerCreate,
} from 'glov/client/animation';
import * as camera2d from 'glov/client/camera2d';
import { platformGetID } from 'glov/client/client_config';
import { cmd_parse } from 'glov/client/cmds';
import { editBox } from 'glov/client/edit_box';
import * as engine from 'glov/client/engine';
import {
  ALIGN,
  Font,
  fontStyle,
  fontStyleColored,
  intColorFromVec4Color,
} from 'glov/client/font';
import {
  KEYS,
  eatAllInput,
  mouseDownAnywhere,
  mouseOver,
} from 'glov/client/input';
import { localStorageGet, localStorageSet } from 'glov/client/local_storage';
import * as net from 'glov/client/net';
import {
  HighScoreList,
  ScoreSystem,
  scoreAlloc,
  scoreGetPlayerName,
  scoreUpdatePlayerName,
} from 'glov/client/score';
import { ColumnDef, scoresDraw } from 'glov/client/score_ui';
import {
  ScrollArea,
  scrollAreaCreate,
} from 'glov/client/scroll_area';
import * as settings from 'glov/client/settings';
import { spotGetCurrentFocusKey } from 'glov/client/spot';
import { spriteSetGet } from 'glov/client/sprite_sets';
import {
  Sprite,
} from 'glov/client/sprites';
import * as transition from 'glov/client/transition';
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
  uiButtonHeight,
} from 'glov/client/ui';
import { getURLBase } from 'glov/client/urlhash';
import { DataObject, Optional, TSMap } from 'glov/common/types';
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

const {
  FRAME_CHANNEL_BG,
  FRAME_CHANNEL_BG_FLASH,
  FRAME_ICON_CHECK,
  FRAME_ICON_DISCORD,
  FRAME_ICON_FF,
  FRAME_ICON_HELP,
  FRAME_ICON_MENU,
  FRAME_ICON_PAUSE,
  FRAME_ICON_PLAY,
  FRAME_ICON_REDO,
  FRAME_ICON_SOUND0,
  FRAME_ICON_SOUND1,
  FRAME_ICON_SOUND2,
  FRAME_ICON_STEP,
  FRAME_ICON_STOP,
  FRAME_ICON_UNDO,
  FRAME_X,
  FRAME_X_FOCUSED,

  sprite_icons,
} = require('./img/icons');

const { floor, max, round } = Math;

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
  'ebb8a4', 'ba8b79', 'd9c380', '232323',
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
const GOAL_H = CHH * 4 + PANEL_VPAD * 2;
const INPUT_X = 4;
const INPUT_W = CHW * 6 - 2;
const OUTPUT_X = INPUT_X + INPUT_W + 2;
const OUTPUT_W = CHW * 9;
const NODES_X = OUTPUT_X + OUTPUT_W + 2;
const NODES_Y = CHH * 5;
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
const CONTROLS_Y = 4;

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

const MANUAL_URL = platformGetID() === 'itch' ?
  'http://www.dashingstrike.com/LudumDare/LD54/manual.html' :
  `${getURLBase()}manual.html`;

declare module 'glov/client/ui' {
  interface UISprites {
    node_panel_bg: Sprite;
    node_panel: Sprite;
    node_panel_info: Sprite;
  }
}

declare module 'glov/client/settings' {
  let sfx: number;
}

settings.register({
  sfx: {
    label: 'Render Scale Full Clear',
    default_value: 2,
    type: cmd_parse.TYPE_INT,
    range: [0,2],
    on_change: function () {
      if (settings.sfx) {
        settings.set('volume', 1);
      } else {
        settings.set('volume', 0);
      }
    },
  },
});

function bestScoreForLevel(puzzle_idx: number): ScoreData | null {
  let preva = score_systema.getScore(puzzle_idx);
  let prevb = score_systemb.getScore(puzzle_idx);
  let prevc = score_systemc.getScore(puzzle_idx);
  if (preva || prevb || prevc) {
    return {
      loc: preva ? preva.loc : 0,
      nodes: prevb ? prevb.nodes : 0,
      cycles: prevc ? prevc.cycles : 0,
    };
  } else {
    return null;
  }
}

function queueTransition(): void {
  if (engine.frame_index > 1) {
    transition.queue(Z.TRANSITION_FINAL, transition.fade(100));
  }
}

class NodeType {
  h: number;
  constructor(
    public lines: number,
    public radios: number,
    public title: string,
    public cost: number,
    public encode:string
  ) {
    this.h = (lines + 1) * CHH + 2;
  }
}
let node_types: Record<string, NodeType> = {
  '4x1': new NodeType(4, 1, 'AW0401', 7, 'A'),
  '9x3': new NodeType(9, 3, 'AW0903', 21, 'B'),
  '16x5': new NodeType(16, 5, 'AW1605', 42,'C'),
};
const NODE_TYPE_DECODE = (function () {
  let ret: TSMap<string> = {};
  for (let key in node_types) {
    assert(!ret[node_types[key].encode]);
    ret[node_types[key].encode] = key;
  }
  return ret;
}());
const NUM_NODE_TYPES = Object.keys(node_types).length;

const NODESTART = 'x';
enum OP {
  MOV = 'm',
  DEC = 'd',
  INC = 'i',
  NEG = 'n',
  JMP = 'j',
  JLZ = 'l',
  JEZ = 'e',
  JGZ = 'g',
  JNZ = 'z',
  // Also relevant for encoding/decoding: NODESTART = 'x'
}
type ParamType = 'channel' | 'register' | 'number' | 'label';
type OpDef = {
  name: string;
  op: OP;
  params: ParamType[];
};
const OPDEFS1: Record<OP, Optional<OpDef, 'op'>> = {
  [OP.MOV]: { name: 'mov', params: ['register', 'number'] },
  [OP.DEC]: { name: 'dec', params: [] },
  [OP.INC]: { name: 'inc', params: [] },
  [OP.NEG]: { name: 'neg', params: [] },
  [OP.JMP]: { name: 'jmp', params: ['label'] },
  [OP.JLZ]: { name: 'jlz', params: ['channel', 'label'] },
  [OP.JEZ]: { name: 'jez', params: ['channel', 'label'] },
  [OP.JGZ]: { name: 'jgz', params: ['channel', 'label'] },
  [OP.JNZ]: { name: 'jnz', params: ['channel', 'label'] },
};
const OPDEFBYNAME: TSMap<OpDef> = {};
const OPDEFS: Record<OP, OpDef> = (function () {
  // build lookups, add op key
  let ret: Partial<Record<OP, OpDef>> = {};
  let key: keyof typeof OPDEFS1;
  for (key in OPDEFS1) {
    let opdef = OPDEFS1[key];
    let opdef2 = {
      ...opdef,
      op: key,
    };
    ret[key] = opdef2;
    OPDEFBYNAME[opdef.name] = opdef2;
  }
  return ret as Record<OP, OpDef>;
}());
type Operand = string | number | null;
const CHANNEL_REGEX = /^ch([1-9]\d*)$/;
type CodeLine = {
  instr: OP;
  p: [Operand, Operand];
  source_line: number;
};
const OPERAND_ENCODE: TSMap<string> = {
  'nil': 'Z',
  'acc': 'A',
  'input': 'I',
  'output': 'O',
  // also : C/P/N for channel/positive/negative
};
const OPERAND_DECODE = (function () {
  let ret: TSMap<string | number> = {};
  for (let key in OPERAND_ENCODE) {
    ret[OPERAND_ENCODE[key]!] = key;
  }
  return ret;
}());
function codeLineEncode(op: CodeLine): string {
  let opdef = OPDEFS[op.instr];
  let ret: string[] = [op.instr];
  for (let ii = 0; ii < opdef.params.length; ++ii) {
    let v = op.p[ii];
    assert(v !== null);
    if (typeof v === 'number') {
      if (!v) {
        ret.push('Z');
      } else if (v < 0) {
        ret.push(`N${-v}`);
      } else {
        ret.push(`P${v}`);
      }
    } else if (OPERAND_ENCODE[v]) {
      ret.push(OPERAND_ENCODE[v]!);
    } else {
      let m = v.match(CHANNEL_REGEX);
      assert(m);
      ret.push(`C${Number(m[1])}`);
    }
  }
  return ret.join('');
}
function codeLineDecodeOperand(type: ParamType, s1: string, s2?: string): string | number {
  let register = OPERAND_DECODE[s1];
  if (register !== undefined) {
    assert(!s2);
    if (register === 'nil' && type !== 'register') {
      return 0;
    }
    return register;
  }
  assert(s2);
  let n = Number(s2);
  assert(isFinite(n));
  if (s1 === 'N') {
    return -n;
  } else if (s1 === 'P') {
    return n;
  } else if (s1 === 'C') {
    return `ch${n}`;
  }
  assert(false, `Failed to decode operand "${s1}:${s2}"`);
}
type Cursor = { s: string; idx: number };
function codeLineDecode(cursor: Cursor): CodeLine {
  let instr: OP = cursor.s[cursor.idx++] as OP;
  let opdef = OPDEFS[instr];
  let p: [Operand, Operand] = [null, null];
  let m = cursor.s.slice(cursor.idx).match(/^(?:([A-Z])(\d+)?(?:([A-Z])(\d+)?)?)?/);
  assert(m);
  if (m[1]) {
    assert(opdef.params.length >= 1);
    p[0] = codeLineDecodeOperand(opdef.params[0], m[1], m[2]);
  }
  if (m[3]) {
    assert(opdef.params.length >= 2);
    p[1] = codeLineDecodeOperand(opdef.params[1], m[3], m[4]);
  }
  cursor.idx += m[0].length;
  return {
    instr,
    p,
    source_line: -1,
  };
}

const OKTOK = arrayToSet(['input', 'output', 'acc', 'nil']);
function parseOp(toks: string[], source_line: number): CodeLine | string {
  if (toks[0] === 'nop') {
    toks.splice(0, 1, 'mov', 'nil', 'nil');
  }
  let instr = toks[0];
  assert(instr);
  let def = OPDEFBYNAME[instr];
  if (!def) {
    return `Unknown instruction "${instr}"`;
  }
  if (toks.length !== def.params.length + 1) {
    return `"${instr.toUpperCase()}" requires ${def.params.length} ${plural(def.params.length, 'parameter')}`;
  }
  let p: [Operand, Operand] = [null, null];
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
      if (v.match(CHANNEL_REGEX)) {
        p[ii] = v;
      } else {
        return `Operand ${ii+1} must be a ${type}`;
      }
    } else { // number or register, and parameter is not a number, so must be a register
      if (OKTOK[v] || v.match(CHANNEL_REGEX)) {
        if (type === 'number' && v === 'nil') {
          p[ii] = 0;
        } else if (type === 'register' && v === 'input') {
          return 'Cannot write to INPUT';
        } else if (type === 'number' && v === 'output') {
          return 'Cannot read from OUTPUT';
        } else {
          p[ii] = v;
        }
      } else {
        return `Invalid operand "${v.toUpperCase()}"`;
      }
    }
  }
  return {
    instr: def.op,
    p,
    source_line,
  };
}

let last_node_uid = 0;
class Node {
  slot = 0;
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
      x: this.slot,
      type: this.type,
      code: this.code,
    };
  }
  fromJSON(obj: DataObject): void {
    this.slot = obj.x as number;
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
  op_lines: CodeLine[] = [];
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
    let labels: TSMap<number> = {};
    let op_lines: CodeLine[] = this.op_lines = [];
    for (let ii = 0; ii < lines.length; ++ii) {
      let line = lines[ii].toLowerCase();
      line = line.replace(/,/g, ' ');
      line = line.trim();
      let m = line.match(/^([^;#]*)[;#].*$/);
      if (m) {
        line = m[1].trim();
      }
      m = line.match(/^([a-z_.][\w.]*):(.*)$/);
      if (m) {
        if (labels[m[1]] !== undefined) {
          if (!this.error_str) {
            this.error_str = `Duplicate label "${m[1]}"`;
            this.error_idx = ii;
          }
        }
        labels[m[1]] = ii;
        line = m[2].trim();
      }
      if (!line) {
        continue;
      }
      let toks = line.split(/\s+/g);
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
    for (let ii = 0; ii < op_lines.length; ++ii) {
      let op = op_lines[ii];
      let opdef = OPDEFS[op.instr];
      assert(opdef);
      for (let jj = 0; jj < opdef.params.length; ++jj) {
        if (opdef.params[jj] === 'label') {
          let p = op.p[jj];
          if (p === 'nil') {
            p = 0;
          }
          if (typeof p === 'string' && !p.match(CHANNEL_REGEX)) {
            // remap all labels to offsets
            let oplinenum = labels[p];
            if (oplinenum === undefined) {
              if (!this.error_str) {
                this.error_str = `Unknown label "${p}"`;
                this.error_idx = op.source_line;
              }
              p = op.p[jj] = 0;
            } else {
              p = op.p[jj] = oplinenum - op.source_line;
            }
          }
          if (typeof p === 'number') {
            // remap all jump offsets to positive
            op.p[jj] = mod(p, op_lines.length);
          }
        }
      }
    }

    // verify encoding is sound (after all fixups)
    for (let ii = 0; ii < op_lines.length; ++ii) {
      let op = op_lines[ii];
      let str = codeLineEncode(op);
      let cursor = { s: str, idx: 0 };
      let test = codeLineDecode(cursor);
      assert.equal(cursor.idx, str.length);
      assert.equal(test.instr, op.instr);
      assert.equal(test.p[0], op.p[0]);
      assert.equal(test.p[1], op.p[1]);
    }
  }
  stepError(msg: string): void {
    this.error_str = msg;
    this.error_idx = this.op_lines[this.step_idx].source_line;
    this.error_is_step = true;
  }
  step(game_state: GameState): void {
    let { op_lines, step_idx, node_type, active_radios, radio_state, node_radio_activate_time } = this;
    if (!op_lines.length) {
      return;
    }
    let op = op_lines[step_idx];
    // unless we jump, step_idx advances/loops
    let next_step_idx = (step_idx + 1) % op_lines.length;
    let { instr, p } = op;
    let p0 = p[0];
    let p1 = p[1];
    let label_idx = 0;
    outer:
    switch (instr) {
      case OP.MOV: {
        let m;
        // Read input
        let v: number;
        assert(typeof p1 === 'number' || typeof p1 === 'string');
        if (typeof p1 === 'number') {
          v = p1;
        } else if (p1 === 'acc') {
          v = this.acc;
        } else if ((m = p1.match(CHANNEL_REGEX))) {
          let radio_idx = Number(m[1]);
          if (p0 === p1) {
            return this.stepError('Cannot read and write the same channel');
          }
          if (active_radios.includes(radio_idx)) {
            return this.stepError('Cannot read from an active channel');
          }
          v = game_state.radios[radio_idx] || 0;
        } else if (p1 === 'input') {
          v = game_state.readInput();
        } else {
          assert(false);
        }
        // Assign to output
        assert(typeof p0 === 'string');
        if (p0 === 'nil') {
          // nothing
        } else if (p0 === 'acc') {
          if (p1 !== 'acc') {
            node_radio_activate_time[0] = engine.frame_timestamp;
          }
          this.acc = v;
        } else if (p0 === 'output') {
          let err = game_state.addOutput(v);
          if (err) {
            return this.stepError(err);
          }
        } else if ((m = p0.match(CHANNEL_REGEX))) {
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
      case OP.DEC:
        this.acc = clamp(this.acc - 1, MININT, MAXINT);
        break;
      case OP.INC:
        this.acc = clamp(this.acc + 1, MININT, MAXINT);
        break;
      case OP.NEG:
        this.acc = clamp(-this.acc, MININT, MAXINT);
        break;
      case OP.JLZ:
      case OP.JEZ:
      case OP.JGZ:
      case OP.JNZ: {
        assert(typeof p0 === 'string');
        let m = p0.match(CHANNEL_REGEX);
        assert(m);
        let radio_idx = Number(m[1]);
        if (active_radios.includes(radio_idx)) {
          return this.stepError('Cannot read from an active channel');
        }
        let v = game_state.radios[radio_idx] || 0;
        switch (instr) {
          case OP.JLZ:
            if (!(v < 0)) {
              break outer;
            }
            break;
          case OP.JEZ:
            if (!(v === 0)) {
              break outer;
            }
            break;
          case OP.JGZ:
            if (!(v > 0)) {
              break outer;
            }
            break;
          case OP.JNZ:
            if (!(v !== 0)) {
              break outer;
            }
            break;
          default:
            assert(false);
        }
        label_idx = 1;
      }
      // eslint-disable-next-line no-fallthrough
      case OP.JMP: {
        let m;
        let label = p[label_idx];
        if (typeof label === 'string' && (m = label.match(CHANNEL_REGEX))) {
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
          assert(false); // shouldn't get here
          return this.stepError(`Unknown label "${label}"`);
        }
      } break;
      default:
        assert(false);
    }
    this.step_idx = next_step_idx;
  }
}

let prev_best: ScoreData | null = null;

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
      this.fast_forward = false;
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
      if (settings.sfx === 2) {
        playUISound('outbad');
      }
      return 'Output collision';
    }
    if (this.output.length >= MAX_OUTPUT) {
      if (settings.sfx === 2) {
        playUISound('outbad');
      }
      return 'Output overflow';
    }
    let puzzle = puzzles[this.puzzle_idx];
    let pout = puzzle.sets[this.set_idx].output;
    if (this.output.length >= pout.length) {
      if (settings.sfx === 2) {
        playUISound('outbad');
      }
    } else if (v !== pout[this.output.length]) {
      if (settings.sfx === 2) {
        playUISound('outbad');
      }
    } else {
      if (settings.sfx === 2) {
        playUISound('outgood');
      }
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
    let success = output.length === puzzle.sets[this.set_idx].output.length &&
      this.input_idx >= puzzle.sets[this.set_idx].input.length;
    for (let ii = 0; success && ii < output.length; ++ii) {
      if (output[ii] !== puzzle.sets[this.set_idx].output[ii]) {
        success = false;
      }
    }
    if (success) {
      if (this.set_idx === puzzle.sets.length - 1) {
        this.state = 'win';
        setTimeout(function () {
          if (settings.sfx === 2) {
            playUISound('victory');
          }
        }, 150);
        this.submitScore();
      } else {
        this.set_idx++;
        this.resetSimSet();
      }
    }
    if (this.hasError()) {
      if (settings.sfx === 2) {
        playUISound('error');
      }
    }
  }
  won(): boolean {
    return this.state === 'win';
  }
  score(): ScoreData {
    let loc = 0;
    let { nodes } = this;
    let cost = 0;
    nodes.forEach((node) => {
      cost += node.node_type.cost;
      loc += node.op_lines.length;
    });
    return {
      loc,
      nodes: cost,
      cycles: this.tick_idx,
    };
  }
  submitScore(): void {
    prev_best = bestScoreForLevel(this.puzzle_idx);
    let score_data = this.score();
    let payload = this.toEncoded(false);
    score_systema.setScore(this.puzzle_idx, score_data, payload);
    score_systemb.setScore(this.puzzle_idx, score_data, payload);
    score_systemc.setScore(this.puzzle_idx, score_data, payload);
    this.last_stats = score_data;
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

  toEncoded(pretty: boolean): string {
    let { nodes } = this;
    return nodes.map((node) => {
      let { slot, op_lines, node_type } = node;
      let ret = [NODESTART, node_type.encode, slot].join('');
      if (pretty) {
        ret +='\n  ';
      }
      ret += op_lines.map(codeLineEncode).join(pretty ? op_lines.length > 4 ? ' ' : '\n  ' : '');
      return ret;
    }).join(pretty ? '\n' : '');
  }

  fromEncoded(s: string): void {
    let cursor = {
      s,
      idx: 0,
    };
    let nodes = this.nodes = [] as Node[];
    while (cursor.idx < s.length) {
      assert.equal(s[cursor.idx++], NODESTART);
      let type = NODE_TYPE_DECODE[s[cursor.idx++]];
      assert(type);
      let node = new Node(type);
      nodes.push(node);
      let op_lines: CodeLine[] = [];
      while (s[cursor.idx] !== NODESTART && cursor.idx < s.length) {
        op_lines.push(codeLineDecode(cursor));
      }
      node.op_lines = op_lines;
    }
  }
}

let game_state: GameState;
let mode_quick_reference = false;
let cur_level_slot = 0;

function tutorialMode(): boolean {
  let puzzle = puzzles[game_state.puzzle_idx];
  if (!puzzle.fixed_nodes) {
    return false;
  }
  let best_score = bestScoreForLevel(game_state.puzzle_idx);
  return !best_score;
}

const HELP = `MOV [OUTPUT|ACC|CH#] [INPUT|ACC|CH#|number]
INC/DEC/NEG - modifies ACC           NOP - sleeps 1 cycle
JMP label; JGZ/JLZ/JEZ/JNZ CH# label - >0 / <0 / =0 / <>0
J*Z ops must test CH# from other node.  Two+ signals sum.`;

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


function init(): void {
  loadUISprite('node_panel_bg', [16, 16, 16], [16, 16, 16]);
  loadUISprite('node_panel', [16, 16, 16], [32, 16, 16]);
  loadUISprite('node_panel_info', [16, 16, 16], [32, 16, 16]);
}

let cur_level_idx = 0;

function setStatePlay(): void {
  queueTransition();
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  engine.setState(statePlay);
  playUISound('insert');
  setTimeout(function () {
    playUISound('floppy');
  }, 200);
  if (tutorialMode()) {
    let puzzle = puzzles[game_state.puzzle_idx];
    while (game_state.nodes.length < puzzle.fixed_nodes!.length) {
      let node = new Node(puzzle.fixed_nodes![game_state.nodes.length]);
      node.slot = 0;
      game_state.nodes.push(node);
    }
  }
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

function winnerName(score: ScoreData, scores: HighScoreList<ScoreData> | null, field: keyof ScoreData): string {
  let winner = scores && scores.list && scores.list.length ? scores.list[0] : null;
  if (!winner) {
    return '';
  }
  if (winner.score[field] === score[field]) {
    if (winner.count > 1 || winner.count === 1 && !winner.names.includes(scoreGetPlayerName())) {
      return ' (TIED)';
    }
  }
  return ` (${winner.names_str})`;
}

const font_style_text = fontStyleColored(null, palette_font[5]);

let last_focus: string = '';
function statePlay(dt: number): void {
  gl.clearColor(palette[11][0], palette[11][1], palette[11][2], 1);
  v4copy(engine.border_clear_color, palette[11]);
  v4copy(engine.border_color, palette[11]);
  game_state.tick(dt);

  let { nodes, puzzle_idx, input_idx, radios, radio_activate_time, set_idx } = game_state;
  let puzzle = puzzles[puzzle_idx];

  let tut = tutorialMode();

  if (game_state.won()) {
    // do overlay
    let score = game_state.score();
    let w = floor(game_width/2);
    let h = floor(game_height* 0.55);
    let x = floor((game_width - w)/2);
    let y = floor((game_height - h)/2);
    let y1 = y + h;
    let z = Z.OVERLAY;
    let panel_param = {
      x, y, w, h, z,
      sprite: ui.sprites.node_panel_info,
    };

    z++;
    y += PANEL_VPAD;

    font.draw({
      color: palette_font[8],
      x, y, z, w,
      align: ALIGN.HCENTERFIT,
      text: `GOAL COMPLETE: ${puzzle.title}`,
    });

    y += CHH + 8;
    font.draw({
      color: palette_font[5],
      x, y, z, w,
      align: ALIGN.HCENTERFIT,
      text: 'YOUR SCORE:',
    });
    y += CHH;
    let extra = prev_best && prev_best.cycles ?
      score.cycles < prev_best.cycles ? ' NEW BEST!' : ` (your best: ${prev_best.cycles})` : '';
    let text_w = font.draw({
      color: palette_font[5],
      x, y, z, w,
      align: ALIGN.HCENTERFIT,
      text: `${score.cycles} Cycles${extra}`,
    });
    if (prev_best && extra) {
      font.draw({
        color: palette_font[score.cycles < prev_best.cycles ? 0 : score.cycles === prev_best.cycles ? 10 : 6],
        x: x + Math.round((w + text_w)/2), y, z: z + 1,
        align: ALIGN.HRIGHT,
        text: extra,
      });
    }
    y += CHH;

    extra = prev_best && prev_best.loc ?
      score.loc < prev_best.loc ? ' NEW BEST!' : ` (your best: ${prev_best.loc})` : '';
    text_w = font.draw({
      color: palette_font[5],
      x, y, z, w,
      align: ALIGN.HCENTERFIT,
      text: `${score.loc} Lines of code${extra}`,
    });
    if (prev_best && extra) {
      font.draw({
        color: palette_font[score.loc < prev_best.loc ? 0 : score.loc === prev_best.loc ? 10 : 6],
        x: x + Math.round((w + text_w)/2), y, z: z + 1,
        align: ALIGN.HRIGHT,
        text: extra,
      });
    }
    y += CHH;

    extra = prev_best && prev_best.nodes ?
      score.nodes < prev_best.nodes ? ' NEW BEST!' : ` (your best: $${prev_best.nodes})` : '';
    text_w = font.draw({
      color: palette_font[5],
      x, y, z, w,
      align: ALIGN.HCENTERFIT,
      text: `$${score.nodes} Cost${extra}`,
    });
    if (prev_best && extra) {
      font.draw({
        color: palette_font[score.nodes < prev_best.nodes ? 0 : score.nodes === prev_best.nodes ? 10 : 6],
        x: x + Math.round((w + text_w)/2), y, z: z + 1,
        align: ALIGN.HRIGHT,
        text: extra,
      });
    }
    y += CHH + 16;

    let scoresa = score_systema.getHighScores(game_state.puzzle_idx);
    let scoresb = score_systemb.getHighScores(game_state.puzzle_idx);
    let scoresc = score_systemc.getHighScores(game_state.puzzle_idx);

    y += font.draw({
      color: palette_font[5],
      x, y, z, w, h,
      align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
      text: 'HIGH SCORE:\n' +
        `${scoresc && scoresc.list.length ? scoresc.list[0].score.cycles : '?'} Cycles` +
        `${winnerName(score, scoresc, 'cycles')}\n` +
        `${scoresa && scoresa.list.length ? scoresa.list[0].score.loc : '?'} Lines of code` +
        `${winnerName(score, scoresa, 'loc')}\n` +
        `$${scoresb && scoresb.list.length ? scoresb.list[0].score.nodes : '?'} Cost` +
        `${winnerName(score, scoresb, 'nodes')}`,
    }) + 16;

    let no_next_exercise = game_state.puzzle_idx === puzzles.length - 1;
    if (no_next_exercise) {
      y += font.draw({
        color: palette_font[0],
        x, y, z, w, h,
        align: ALIGN.HCENTERFIT|ALIGN.HWRAP,
        text: 'CONGRATULATIONS!\n' +
          'For completing the final training exercise, you have earned' +
          ' yourself a QPCA-77B Professional Certification, Rev IV.  Thanks for playing!',
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
      hotkey: KEYS.ESC,
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
      queueTransition();
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
    sprite: mode_quick_reference ? ui.sprites.node_panel_bg : ui.sprites.node_panel_info,
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
      text: `${score.cycles} Cycles\n${score.loc} Lines of code\n$${score.nodes} Cost`,
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
    let w = uiButtonHeight();

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
        x, y: y + BUTTON_H + 8,
        text: `Cycles: ${game_state.tick_idx}`,
      });
      font.draw({
        color: palette_font[5],
        x: x + 214, y: y + BUTTON_H + 8,
        text: `Status: ${status}`,
      });
    }

    let disabled = game_state.hasError() || game_state.won();
    if (button({
      x, y, w,
      img: sprite_icons,
      frame: game_state.isPlaying() ? FRAME_ICON_PAUSE : FRAME_ICON_PLAY,
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
      img: sprite_icons,
      frame: FRAME_ICON_STEP,
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
      img: sprite_icons,
      frame: FRAME_ICON_FF,
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
        img: sprite_icons,
        frame: FRAME_ICON_STOP,
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
        img: sprite_icons,
        frame: FRAME_ICON_UNDO,
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
        img: sprite_icons,
        frame: FRAME_ICON_REDO,
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
      img: sprite_icons,
      frame: FRAME_ICON_HELP,
      shrink: 1,
      tooltip: 'Toggle Quick Reference',
    })) {
      mode_quick_reference = !mode_quick_reference;
      queueTransition();
    }
    x += w + 2;
    if (button({
      x, y, w,
      img: sprite_icons,
      frame: FRAME_ICON_MENU,
      shrink: 1,
      tooltip: game_state.isSimulating() ?
        '[ESC] Stop, save, and return to exercise select' :
        '[ESC] Save and return to exercise select',
      hotkey: KEYS.ESC,
      sound_button: 'eject',
    })) {
      queueTransition();
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
  if (!tut) {
    drawLine(NODE_X[2] - 3, NODES_Y, NODE_X[2] - 3, NODES_Y + NODES_H - 1, Z.UI + 1, 1, 1, palette[8]);
  }

  let node_y = [NODE_Y, NODE_Y, NODE_Y];

  let remove_nodes = [];
  for (let node_idx = 0; node_idx < nodes.length; ++node_idx) {
    let node = nodes[node_idx];
    let { acc, active_radios, radio_state, node_radio_activate_time, error_idx, error_str, step_idx, slot } = node;
    let node_type = node_types[node.type];
    let x = NODE_X[slot];
    let x1 = x + NODE_W - 1;
    let y = node_y[slot];
    let y1 = y + node_type.h;
    node_y[slot] = y1 + 2;
    if (game_state.isEditing() && !tut) {
      if (button({
        x: x + NODE_W - CHH - 5,
        y, z: Z.NODES + 1,
        w: CHH,
        h: CHH,
        img: sprite_icons,
        frame: FRAME_X,
        shrink: 1,
        no_bg: true,
        // tooltip: 'Delete node', - not over DOM
      })) {
        remove_nodes.push(node_idx);
      }
      if (buttonWasFocused()) {
        sprite_icons.draw({
          frame: FRAME_X_FOCUSED,
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
      color: palette_font[4],
      x, y, z: Z.NODES + 1,
      w: NODE_W,
      text: `${node_type.title} ($${node_type.cost})`,
      align: ALIGN.HCENTER,
    });
    y += CHH - 1;
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
        esc_clears: false,
        esc_unfocuses: false,
        max_len: CODE_LINE_W,
        spellcheck: false,
        initial_focus: true,
        canvas_render: {
          char_width: CHW,
          char_height: CHH,
          color_selection: palette[0],
          color_caret: palette[5],
          style_text: font_style_text,
        },
      }, node.code);
      if (ebr.text !== last_code) {
        node.setCode(ebr.text);
        // undoPush(false);
      }
      if (ebr.edit_box.hadOverflow()) {
        playUISound('kbbeep');
      }
    } else {
      font.draw({
        color: palette_font[5],
        x, y, z: Z.NODES + 1,
        w: CODE_LINE_W * CHW,
        align: ALIGN.HFIT|ALIGN.HWRAP,
        text: node.code,
      });
    }
    if (!game_state.isEditing()) {
      let draw_idx = node.op_lines[step_idx]?.source_line || 0;
      drawRect(x-1, y + draw_idx * CHH, x + CODE_LINE_W*CHW+2, y + (draw_idx + 1) * CHH - 1, Z.NODES+0.25, palette[0]);
    }
    if (error_idx !== -1) {
      drawRect(x-1, y + error_idx * CHH,
        x + CODE_LINE_W*CHW+2, y + (error_idx + 1) * CHH, Z.NODES+0.5, palette[6]);
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

  // draw tutorial
  if (tut && puzzle.tutorial_text) {
    font.draw({
      color: palette_font[5],
      x: NODE_X[1] + 2,
      y: NODES_Y + 4,
      w: NODE_W * 2,
      align: ALIGN.HWRAP,
      text: puzzle.tutorial_text,
    });
  }

  for (let column = 0; column < 3; ++column) {
    let max_y = node_y[column];
    let x = NODE_X[column];
    let x1 = x + NODE_W - 1;
    let avail_h = NODES_Y + NODES_H - max_y;
    if (avail_h >= node_types['4x1'].h && !tut) {
      let button_w = floor((x1 - x - 4 * (NUM_NODE_TYPES-1)) / NUM_NODE_TYPES);
      for (let key in node_types) {
        let node_type = node_types[key];
        if (button({
          x,
          y: node_y[column],
          // font_height: CHH * 2,
          w: button_w,
          text: `+${node_type.title}`,
          disabled: node_type.h > avail_h || !game_state.isEditing(),
          tooltip: `Add a ${node_type.title} node\n` +
            `${node_type.lines} LOC\n${node_type.radios} ${plural(node_type.radios, 'Radio')}`,
        })) {
          let node = new Node(key);
          node.slot = column;
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
      sprite_icons.draw({
        frame: FRAME_CHANNEL_BG,
        x, y, w: CHANNEL_W, h: CHANNEL_W,
      });
      let at = radio_activate_time[radio_idx];
      let color = palette_font[0];
      if (at) {
        let flashdt = engine.frame_timestamp - at;
        if (flashdt < RADIO_FLASH) {
          sprite_icons.draw({
            frame: FRAME_CHANNEL_BG_FLASH,
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

  buttonText({
    x: game_width - BUTTON_H * 4 - 4,
    y: CHANNELS_Y,
    w: BUTTON_H * 4, h: BUTTON_H,
    text: 'Reference Manual',
    internal: false,
    url: MANUAL_URL,
    tooltip: 'RTFM',
  });

  if (engine.defines.ENCODE) {
    let encoded1 = game_state.toEncoded(true);
    let encoded2 = game_state.toEncoded(false);
    let encoded = `${encoded1}\n(${encoded2.length}b)`;
    font.draw({
      x: 0, y: 0, z: 1000,
      w: game_width,
      align: ALIGN.HWRAP,
      text: encoded,
    });
    // test
    new GameState().fromEncoded(encoded2);
  }


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
    node2.slot = 0;
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
    node3.slot = 2;
    game_state.nodes.push(node3);
  }

  undoReset();
  setStatePlay();
}

const SCORE_COLUMNSA: ColumnDef[] = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 13, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: '', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER }, // Name
  { name: 'LOC', width: 19 },
];
const SCORE_COLUMNSB: ColumnDef[] = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 13, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: '', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER }, // Name
  { name: 'COST', width: 19 },
];
const SCORE_COLUMNSC: ColumnDef[] = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 13, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: '', width: 60, align: ALIGN.HFIT | ALIGN.VCENTER }, // Name
  { name: 'CYCLES', width: 19 },
];
const style_score = fontStyleColored(null, palette_font[9]);
const style_score_tooltip = fontStyle(null, {
  color: palette_font[5],
  outline_width: 5,
  outline_color: palette_font[4],
});
const style_me = fontStyleColored(null, palette_font[10]);
const style_header = fontStyleColored(null, palette_font[6]);
function myScoreToRowA(row: unknown[], score: ScoreData): void {
  row.push(score.loc);
}
function myScoreToRowB(row: unknown[], score: ScoreData): void {
  row.push(`$${score.nodes}`);
}
function myScoreToRowC(row: unknown[], score: ScoreData): void {
  row.push(score.cycles);
}

const MAX_SLOTS = 4;
const HIGHLIGHT_MY_SCORE_BAR = false;

let show_rename = false;
let rename_text = '';
let choosing_new_game = false;
let level_select_scroll: ScrollArea;
function stateLevelSelect(dt: number): void {
  gl.clearColor(palette[4][0], palette[4][1], palette[4][2], 1);
  v4copy(engine.border_clear_color, palette[4]);
  v4copy(engine.border_color, palette[4]);
  const TITLE_H = CHH * 2;
  // const PAD = 4;
  const MAX_LEVEL = puzzle_ids.length;
  let x = 0;
  let y = 4;

  const button_h = BUTTON_H;
  let button_w = BUTTON_H * 3;

  const bottom_pad = 6;
  const bottom_button_w = floor(BUTTON_H * 3);

  const button_y = camera2d.y1() - button_h - 4;
  const hline_y = button_y - 4;

  if (button({
    x: game_width - button_h - 4,
    y,
    w: button_h, h: TITLE_H - 2,
    text: 'X',
    shrink: 1,
    tooltip: 'Return to Title Screen',
  })) {
    queueTransition();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    engine.setState(stateTitle);
  }

  const line_color = palette[1];
  const vline_x = 4 + button_h * 2 + button_h * 4 + bottom_pad * 2 + 7;
  drawLine(vline_x, 4, vline_x,
    show_rename ? hline_y : game_height - 4,
    Z.UI, 1, 1, line_color);

  x = 4;
  let need_scroll = MAX_LEVEL > 9;
  let w = vline_x - 4 - x;
  font.draw({
    color: palette_font[10],
    x, y, w,
    align: ALIGN.HCENTER|ALIGN.HWRAP,
    size: TITLE_H,
    text: 'Level Select',
  });
  y += TITLE_H;
  let left_column_hline_x1 = vline_x - 8 - (need_scroll ? 0 : 4);
  drawLine(8, y, left_column_hline_x1, y, Z.UI, 1, 1, line_color);

  // Scrollable list of levels

  let row_h = button_h;
  let button_x = x + 4;
  button_w = w - 4 - button_x;

  if (!level_select_scroll) {
    level_select_scroll = scrollAreaCreate({
      rate_scroll_click: row_h + 4,
      background_color: null,
      auto_hide: true,
    });
  }
  level_select_scroll.begin({
    x: 0, y, w: vline_x, h: hline_y - y,
  });
  y = 4;

  let has_any_score = false;
  for (let ii = 0; ii < MAX_LEVEL; ++ii) {
    let title = puzzles[ii].title;
    if (button({
      x: button_x, y,
      w: button_w, h: button_h,
      text: `${ii+1}: ${title}`,
      disabled: cur_level_idx === ii,
    })) {
      choosing_new_game = false;
      show_rename = false;
      cur_level_idx = ii;
      score_systema.forceRefreshScores(cur_level_idx);
      score_systemb.forceRefreshScores(cur_level_idx);
      score_systemc.forceRefreshScores(cur_level_idx);
    }
    if (buttonWasFocused()) {
      score_systema.prefetchScores(ii);
      score_systemb.prefetchScores(ii);
      score_systemc.prefetchScores(ii);
    }

    let cur_score = score_systema.getScore(ii);
    if (cur_score) {
      has_any_score = true;
      sprite_icons.draw({
        x: button_x, y,
        w: 48, h: 48,
        z: Z.UI + 10,
        color: palette[5],
        frame: FRAME_ICON_CHECK,
      });
    }

    y += row_h + 4;
  }
  level_select_scroll.end(y);


  // Current level info
  x = vline_x + 5;
  y = 4;
  w = game_width - 4 - x;
  font.draw({
    color: palette_font[9],
    x, y, w,
    align: ALIGN.HCENTER,
    size: CHH,
    text: `QPCA-77B Training Exercise ${cur_level_idx + 1} / ${MAX_LEVEL}`,
  });
  y += CHH;
  font.draw({
    color: palette_font[8],
    x, y, w,
    align: ALIGN.HCENTER,
    size: CHH,
    text: `${puzzles[cur_level_idx].title}: ` + (puzzles[cur_level_idx].desc || puzzles[cur_level_idx].goal),
  });
  y += CHH;
  drawLine(vline_x + 9, y, game_width - 8, y, Z.UI, 1, 1, line_color);
  y += 4;

  const score_area_y1 = hline_y - 3;
  const score_area_h = score_area_y1 - y;
  const panel_pad = 2;
  const score_section_h = floor((score_area_h - panel_pad * 2) / 3);
  const score_area_w = w;
  const histo_w = floor((score_area_w - panel_pad) / 2);
  const scores_w = histo_w;
  const histo_x = x;
  const scores_x = x + histo_w + panel_pad;
  const histo_bar_pad = 4;
  const histo_bar_h = score_section_h - 25 - histo_bar_pad;
  const section_defs = [{
    label: 'CYCLES',
    score_system: score_systemc,
    scoreToRow: myScoreToRowC,
    columns: SCORE_COLUMNSC,
    score_key: 'cycles' as const,
  }, {
    label: 'LINES OF CODE',
    score_system: score_systema,
    scoreToRow: myScoreToRowA,
    columns: SCORE_COLUMNSA,
    score_key: 'loc' as const,
  }, {
    label: 'COST',
    score_system: score_systemb,
    scoreToRow: myScoreToRowB,
    columns: SCORE_COLUMNSB,
    score_key: 'nodes' as const,
  }];
  let score_common = {
    width: scores_w,
    height: score_section_h + button_h - 5, // HACK: just add a no rename padding option instead?
    x: scores_x,
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
    no_header: true,
  };
  for (let ii = 0; ii < section_defs.length; ++ii) {
    let section_def = section_defs[ii];
    let { score_system, score_key } = section_def;
    x = histo_x;
    font.draw({
      x, y: y + PANEL_VPAD, w: score_area_w,
      text: section_def.label,
      align: ALIGN.HCENTER,
      color: palette_font[5],
    });
    let line_x = x + floor(score_area_w/2);
    const content_y0 = y + CHH + 4;
    const content_y1 = y + score_section_h - 1;

    drawLine(line_x, content_y0, line_x, content_y1, Z.UI, 1, 1, palette[9]);

    // Score histogram
    let high_scores = score_system.getHighScores(cur_level_idx);
    if (high_scores && high_scores.histogram) {
      let histo = high_scores.histogram;
      let my_value = high_scores.my_score;
      if (!my_value) { // should never happen, I think?  maybe out of sync?
        let my_score = score_system.getScore(cur_level_idx);
        if (my_score) {
          my_value = my_score[score_key];
        }
      }
      let { start, bucket_size, counts } = histo;
      let num_bars = counts.length;
      // let lastv = start + bucket_size * (num_bars-1);
      // let width = String(lastv).length;
      let maxv = max(...counts);
      const histo_bar_inner_pad = 2;
      let bar_w = (histo_w - 2 * histo_bar_pad - (num_bars - 1) * histo_bar_inner_pad) / num_bars;
      let hx = x + histo_bar_pad;
      const bar_y0 = content_y0 + histo_bar_pad;
      const bar_y1 = bar_y0 + histo_bar_h;
      const all_bar_w = (bar_w + histo_bar_inner_pad) * num_bars - histo_bar_inner_pad;
      const hx1 = hx + all_bar_w;
      const my_bar_w = 3;
      if (my_value) {
        let my_x = clamp(hx + round((my_value - start)/(bucket_size * num_bars)*
          (all_bar_w - my_bar_w + histo_bar_inner_pad)), hx, hx1 + 2);
        // drawLine(my_x, bar_y0 - 2, my_x, bar_y1 - 1, Z.UI + 1, 1, 1, palette[10]);
        drawRect(my_x, bar_y0 - 2, my_x + my_bar_w, bar_y1, Z.UI + 1, palette[10]);
      }
      for (let jj = 0; jj < num_bars; ++jj) {
        let count = counts[jj];
        let bar_height = round(count / maxv * histo_bar_h);
        if (count && !bar_height) {
          bar_height = 1;
        }
        let start_value = start + bucket_size * jj;
        let is_last_bar = (jj === num_bars - 1);
        let end_value = is_last_bar ? Infinity : start + bucket_size * (jj + 1);
        if (bar_height) {
          let is_mine = false;
          if (my_value && HIGHLIGHT_MY_SCORE_BAR) {
            if (score_system.asc) {
              is_mine = my_value >= start_value && my_value < end_value;
            } else {
              is_mine = my_value <= start_value && my_value > end_value;
            }
          }
          let mouse_over = mouseOver({
            x: hx, y: bar_y0,
            w: bar_w, h: histo_bar_h,
          });
          drawRect(hx, bar_y1 - bar_height, hx + bar_w, bar_y1, Z.UI, palette[mouse_over ? 3 : is_mine ? 10 : 2]);
          if (mouse_over) {
            font.draw({
              style: style_score_tooltip,
              x: floor(hx + bar_w/2),
              y: bar_y0,
              z: Z.TOOLTIP,
              h: histo_bar_h,
              align: ALIGN.HVCENTER,
              text: `${start_value}${is_last_bar ? '+' : `-${end_value-1}`}: ${count} ${plural(count, 'player')}`,
            });
          }
        }
        hx += bar_w + histo_bar_inner_pad;
      }

    }

    // Score list
    scoresDraw({
      ...score_common,
      score_system,
      y: content_y0,
      columns: section_def.columns,
      scoreToRow: section_def.scoreToRow,
      scroll_key: section_def.label,
    });

    panel({
      x, y, w: score_area_w, h: score_section_h,
      sprite: ui.sprites.node_panel_info,
    });
    y += score_section_h + panel_pad;
  }

  //drawLine(4, hline_y, game_width - 4, hline_y, Z.UI, 1, 1, line_color);
  drawLine(8, hline_y, left_column_hline_x1, hline_y, Z.UI, 1, 1, line_color);
  drawLine(vline_x + 8, hline_y, game_width - 8, hline_y, Z.UI, 1, 1, line_color);


  y = button_y;
  button_w = bottom_button_w;

  x = 4;
  let pad = bottom_pad;

  if (button({
    x,
    y,
    w: button_h, h: button_h,
    img: sprite_icons,
    frame: settings.sfx === 0 ? FRAME_ICON_SOUND0 : settings.sfx === 1 ? FRAME_ICON_SOUND1 : FRAME_ICON_SOUND2,
    shrink: 1,
    tooltip: settings.sfx === 0 ? 'SFX Off' : settings.sfx === 1 ? 'Mute beeps and bloops' : 'All SFX on',
    sound_button: null,
  })) {
    settings.set('sfx', settings.sfx === 0 ? 2 : settings.sfx - 1);
    playUISound('button_click');
  }
  x += button_h + pad;

  button({
    x,
    y,
    w: button_h, h: button_h,
    img: sprite_icons,
    frame: FRAME_ICON_DISCORD,
    shrink: 1,
    tooltip: 'Visit the Dashing Strike Discord',
    internal: false,
    url: 'https://discord.gg/dashingstrike',
  });
  x += button_h + pad;

  // buttonText({
  //   x,
  //   y,
  //   w: button_h * 4, h: button_h,
  //   text: 'Reference Manual',
  //   internal: false,
  //   url: MANUAL_URL,
  // });
  if (has_any_score) {
    // player rename logic
    let my_name = scoreGetPlayerName();
    if (show_rename) {
      font.draw({
        text: 'Player Name',
        size: CHH,
        x,
        y: y + 4,
        color: palette_font[9],
      });
      let ebr = editBox({
        key: 'rename',
        placeholder: 'Anonymous',
        x,
        y: y + CHH + 8,
        z: Z.UI,
        w: 200,
        type: 'text',
        text: rename_text,
        font_height: CHH,
        esc_clears: false,
        max_len: 64,
        spellcheck: false,
        initial_focus: true,
        // TODO: support non-multiline canvase_render
        // canvas_render: {
        //   char_width: CHW,
        //   char_height: CHH,
        //   color_selection: palette[0],
        //   color_caret: palette[5],
        //   style_text: font_style_text,
        // },
      }, rename_text);
      let submit = ebr.result === 'submit';
      rename_text = ebr.text;

      let button_clicked = buttonText({
        x: x + 200 + 4,
        y,
        w: button_h * 3,
        h: button_h,
        text: my_name === rename_text ? 'Cancel' : my_name ? 'Update Name' : 'Set Name',
        disabled: !rename_text,
      });

      if (button_clicked || submit) {
        scoreUpdatePlayerName(rename_text);
      }

      if (button_clicked || ebr.result) {
        show_rename = false;
      }
    } else {
      if (buttonText({
        x,
        y,
        w: button_h * 4, h: button_h,
        align: ALIGN.HWRAP|ALIGN.HVCENTERFIT,
        text: `${my_name || 'Anonymous'}\nUpdate Name...`,
      })) {
        show_rename = true;
        rename_text = my_name;
      }
    }
  }

  // Save slot loading selection
  if (!show_rename) {
    x = game_width - button_w * 4 - pad * 3 - 4;
    let puzzle_id = puzzle_ids[cur_level_idx];
    for (let ii = 0; ii < MAX_SLOTS; ++ii) {
      let storage_key = `p${puzzle_id}.${ii}`;
      let saved_data = localStorageGet(storage_key);
      // let xstart = x;
      let stats_string = '';
      if (saved_data) {
        let saved_parsed = JSON.parse(saved_data);
        let stats = saved_parsed.stats;
        if (stats) {
          stats_string = `${stats.cycles || '?'}C/${stats.loc}L/$${stats.nodes}`;
        }
        if (choosing_new_game) {
          if (buttonText({
            x, y,
            w: button_w, h: button_h,
            align: ALIGN.HWRAP | ALIGN.HCENTERFIT | ALIGN.VCENTER,
            text: `COPY FROM SAVE${stats_string ? `\n${stats_string}` : ''}`,
            sound_button: null,
          })) {
            choosing_new_game = false;
            game_state = new GameState();
            game_state.fromJSON(cur_level_idx, saved_parsed);
            undoReset();
            setStatePlay();
          }
        } else {
          let can_resume = (cur_level_slot === ii && game_state && game_state.puzzle_idx === cur_level_idx);
          if (buttonText({
            x, y,
            w: button_w, h: button_h,
            align: ALIGN.HWRAP | ALIGN.HCENTERFIT | ALIGN.VCENTER,
            text: (can_resume ? 'RESUME' : 'LOAD') + (stats_string ? `\n${stats_string}` : ''),
            sound_button: null,
          })) {
            if (can_resume) {
              game_state.stop();
            } else {
              cur_level_slot = ii;
              game_state = new GameState();
              game_state.fromJSON(cur_level_idx, saved_parsed);
              undoReset();
            }
            setStatePlay();
          }
          // if (buttonText({
          //   x, y,
          //   w: button_w, h: button_h,
          //   text: 'DEL',
          // })) {
          //   localStorageSet(storage_key, undefined);
          // }
        }
      } else {
        if (choosing_new_game) {
          if (cur_level_slot === ii) {
            if (buttonText({
              x, y,
              w: button_w, h: button_h,
              text: 'START FRESH',
              sound_button: null,
            })) {
              choosing_new_game = false;
              startPuzzle(puzzle_id);
            }
          }
        } else {
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
            align: ALIGN.HWRAP | ALIGN.HCENTERFIT | ALIGN.VCENTER,
            text: `NEW\nSLOT ${ii+1}`,
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
        }
      }
      // font.draw({
      //   color: palette_font[9],
      //   y: y - CHH,
      //   x: xstart, w: x - xstart,
      //   align: ALIGN.HCENTER,
      //   text: `Save ${ii+1}`,
      // });
      x += button_w + pad;
    }
  }
}

let title_anim: AnimationSequencer | null = null;
let title_alpha = {
  title: 0,
  desc: 0,
  sub: 0,
  button: 0,
};
function stateTitleInit(): void {
  title_anim = animationSequencerCreate();
  let t = 0;
  t = title_anim.add(t, 300, (progress) => {
    title_alpha.title = progress;
  });
  t = title_anim.add(t + 200, 1000, (progress) => {
    title_alpha.desc = progress;
  });
  t = title_anim.add(t + 300, 300, (progress) => {
    title_alpha.sub = progress;
  });
  title_anim.add(t + 500, 300, (progress) => {
    title_alpha.button = progress;
  });
}
const style_title = fontStyleColored(null, palette_font[5]);
function stateTitle(dt: number): void {
  gl.clearColor(palette[4][0], palette[4][1], palette[4][2], 1);
  v4copy(engine.border_clear_color, palette[4]);
  v4copy(engine.border_color, palette[4]);
  let W = game_width;
  let H = game_height;

  if (title_anim && (mouseDownAnywhere() || engine.DEBUG)) {
    title_anim.update(Infinity);
    title_anim = null;
  }
  if (title_anim) {
    if (!title_anim.update(dt)) {
      title_anim = null;
    } else {
      eatAllInput();
    }
  }

  let y = 120;

  font.draw({
    style: style_title,
    alpha: title_alpha.title,
    // x = 8 because for some reason not centering right?!
    x: 7, y, w: W, align: ALIGN.HCENTER,
    size: CHH * 2,
    text: 'QuantumPulse Control Assemblage 77B',
  });
  y += 36;
  font.draw({
    color: palette_font[9],
    alpha: title_alpha.sub,
    x: 0, y, w: W, align: ALIGN.HCENTER,
    text: 'By Jimb Esser in 48 hours for Ludum Dare 54',
  });
  y += CHH + 30;
  font.draw({
    color: palette_font[5],
    alpha: title_alpha.desc,
    x: W/6,
    w: W - W/6*2,
    y, align: ALIGN.HCENTER | ALIGN.HWRAP,
    text: 'Welcome to the QPCA-77B Visualization Interface',
  });


  const PROMPT_PAD = 8;
  if (title_alpha.button) {
    let button_w = BUTTON_H * 6;
    let button_x0 = floor((W - button_w * 2 - PROMPT_PAD) / 2);
    let button_h = BUTTON_H;
    let color = [1,1,1, title_alpha.button] as const;
    let y1 = H - button_h - button_h - 12 - 90;
    let y2 = y1 + BUTTON_H + PROMPT_PAD;
    let button_param = {
      color,
      w: button_w,
      h: button_h,
    };

    if (!bestScoreForLevel(0)) {
      if (button({
        ...button_param,
        x: floor((game_width - button_w) / 2), y: y1,
        text: 'Begin Training Exercise #1',
      })) {
        autoStartPuzzle(0);
      }
    }

    if (button({
      ...button_param,
      x: button_x0,
      y: y2,
      text: 'Exercise Select and Rankings',
    })) {
      queueTransition();
      engine.setState(stateLevelSelect);
    }

    buttonText({
      ...button_param,
      x: button_x0 + button_w + PROMPT_PAD,
      y: y2,
      text: 'Reference Manual',
      internal: false,
      url: MANUAL_URL,
    });
  }

  font.draw({
    color: palette_font[9],
    alpha: title_alpha.sub,
    x: 0, y: game_height - CHH - 8, w: W, align: ALIGN.HCENTER,
    text: 'Copywrite 1977 QuantumPulse Ltd, Novi Grad, Sokovia',
  });
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
  ui.setTooltipWidth(200,1);
  ui.setFontStyles(
    fontStyle(null, { color: palette_font[5] }),
    null,
    fontStyle(null, { color: palette_font[5] }),
    null);
  v4copy(engine.border_clear_color, palette[11]);
  v4copy(engine.border_color, palette[11]);
  camera2d.setDOMFontPixelScale(0.970);
  ui.uiBindSounds({
    button_click: ['click1', 'click2', 'click3', 'click4', 'click5', 'click6'],
    error: 'error',
    kbbeep: { file: 'kbbeep', volume: 0.2 },
    victory: 'victory',
    outgood: { file: 'outgood', volume: 0.3 },
    outbad: { file: 'outbad', volume: 0.5 },
    insert: 'insert',
    eject: 'eject',
    floppy: 'floppy',
  });

  init();

  function encodeScoreLOC(score: ScoreData): number {
    return score.loc;
  }
  function encodeScoreNodes(score: ScoreData): number {
    return score.nodes;
  }
  function encodeScoreCycles(score: ScoreData): number {
    return score.cycles;
  }

  function parseScoreLOC(value: number): ScoreData {
    return {
      loc: value,
      nodes: 0,
      cycles: 0,
    };
  }
  function parseScoreNodes(value: number): ScoreData {
    return {
      loc: 0,
      nodes: value,
      cycles: 0,
    };
  }
  function parseScoreCycles(value: number): ScoreData {
    return {
      loc: 0,
      nodes: 0,
      cycles: value,
    };
  }

  let level_defs = puzzles.map((a) => ({ name: a.id }));
  score_systema = scoreAlloc({
    score_to_value: encodeScoreLOC,
    value_to_score: parseScoreLOC,
    level_defs: level_defs,
    score_key: 'LD54l3',
    ls_key: 'ld54l2',
    asc: true,
    rel: 6,
    num_names: 2,
    histogram: true,
  });
  score_systemb = scoreAlloc({
    score_to_value: encodeScoreNodes,
    value_to_score: parseScoreNodes,
    level_defs: level_defs,
    score_key: 'LD54n3',
    ls_key: 'ld54n2',
    asc: true,
    rel: 6,
    num_names: 2,
    histogram: true,
  });
  score_systemc = scoreAlloc({
    score_to_value: encodeScoreCycles,
    value_to_score: parseScoreCycles,
    level_defs: level_defs,
    score_key: 'LD54c3',
    ls_key: 'ld54c2',
    asc: true,
    rel: 6,
    num_names: 2,
    histogram: true,
  });


  stateTitleInit();
  if (engine.DEBUG && true) {
    // autoStartPuzzle(puzzle_ids.length-1); // puzzle_ids.indexOf('inc'));
    // game_state.ff();
    cur_level_idx = 6;
    engine.setState(stateLevelSelect);
  } else {
    engine.setState(stateTitle);
  }
}
