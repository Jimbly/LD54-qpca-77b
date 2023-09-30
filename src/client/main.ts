/*eslint global-require:off*/
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage.js');
local_storage.setStoragePrefix('glovjs-playground'); // Before requiring anything else that might load from this

import assert from 'assert';
import * as engine from 'glov/client/engine';
import {
  ALIGN,
  Font,
  intColorFromVec4Color,
} from 'glov/client/font';
import * as net from 'glov/client/net';
import { spriteSetGet } from 'glov/client/sprite_sets';
import { Sprite } from 'glov/client/sprites';
import * as ui from 'glov/client/ui';
import {
  drawLine,
  drawRect,
  loadUISprite,
  panel,
} from 'glov/client/ui';
import { TSMap } from 'glov/common/types';
import { arrayToSet } from 'glov/common/util';
import {
  Vec4,
  vec4,
} from 'glov/common/vmath';

import { puzzles } from './puzzles';

const { floor } = Math;

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
  '8x3': new NodeType(8, 3),
  '15x5': new NodeType(15, 5),
};

type Op = {
  instr: string;
  p1: string | number | null;
  p2: string | number | null;
  source_line: number;
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
  slp: { params: ['number'] },
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
  node_type: NodeType;
  constructor(public type: string) {
    this.node_type = node_types[type];
    this.resetSim();
  }
  resetSim(): void {
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
    // map labels to their next valid line, or loop to start
    for (let key in labels) {
      let line: number = labels[key]!;
      let found = false;
      for (let ii = 0; ii < op_lines.length; ++ii) {
        if (op_lines[ii].source_line >= line) {
          labels[key] = op_lines[ii].source_line;
          found = true;
          break;
        }
      }
      if (!found && op_lines.length) {
        labels[key] = op_lines[0].source_line;
      }
    }
  }
}

class GameState {
  nodes: Node[] = [];
  puzzle_idx = 0;
  output: number[] = [];
  input_idx = 0;
  resetSim(): void {
    this.output = [];
    this.input_idx = 0;
  }
}

let game_state: GameState;

// let sprites: Record<string, Sprite> = {};
function init(): void {
  // sprites.test = spriteCreate({
  //   name: 'test',
  // });
  loadUISprite('node_panel_bg', [16, 16, 16], [16, 16, 16]);
  loadUISprite('node_panel', [16, 16, 16], [32, 16, 16]);
  loadUISprite('node_panel_info', [16, 16, 16], [32, 16, 16]);
  game_state = new GameState();
  let node1 = new Node('8x3');
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
SLP 3
JEZ ch1 end
MOV ch3 acc
MOV ch2 1
MOV acc ch4
MOV ch2 0
JMP loop
end: MOV ch2 -1
MOV ch2 0
MOV output ACC`);
  game_state.nodes.push(node2);

  let node3 = new Node('8x3');
  node3.setCode('MOV ch4 ch3');
  node3.pos[0] = 2;
  game_state.nodes.push(node3);

}

function statePlay(dt: number): void {
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
      if (ii === input_idx) {
        drawRect(INPUT_X+1, y, INPUT_X + INPUT_W - 1, y + CHH - 1, Z.UI + 1, palette[3]);
      }
      font.draw({
        color: palette_font[5],
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
    let { active_radios, radio_state, error_idx, error_str } = node;
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
    // draw radio states
    let radio_h = floor((y1 - y) / node_type.radios);
    for (let jj = 0; jj < node_type.radios; ++jj) {
      let yy = y + radio_h * jj;
      let radio_idx = active_radios[jj];
      let yy1 = (jj === node_type.radios - 1) ? y1 - 1 : yy + radio_h - 2;
      drawRect(x, yy - 1, x + RADIO_W, yy1, Z.NODES+1, palette[1]);
      if (radio_idx) {
        let text = `ch${radio_idx}\n${radio_state[radio_idx]}`;
        font.draw({
          color: palette_font[5],
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
    ui_sprites,
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

  init();

  engine.setState(statePlay);
}
