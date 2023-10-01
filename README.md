LD54 - Limited Space
============================

Ludum Dare 54 Entry by Jimbly - "QPCA-77B"

* Play here: [dashingstrike.com/LudumDare/LD54/](http://www.dashingstrike.com/LudumDare/LD54/)
* Using [Javascript libGlov/GLOV.js framework](https://github.com/Jimbly/glovjs)

Acknowledgements:
* [Perfect DOS VGA](https://www.dafont.com/perfect-dos-vga-437.font) font

Start with: `npm start` (after running `npm i` once)

Plan: TIS-100-like

TODO:
* consider: a couple ops to make logic easier, but less efficient?
* lock node types until puzzle is beaten, have space for detailed tutorial text
* not really having limited space problems - add more margin to nodes to fit fewer?  make bigger problems?
* title screen, startup sequence
* tutorialize a bit, have hints for first levels

POLISH:
* volume/sound on/off toggle
* different BG color, a bit more color usage
* show your best and your previous best on run summary
* !breakpoint


Nodes: 22ch wide + 4ch output + 1ch margin + 3ch borders = 30ch
Input/output: 6ch input + 11ch output = 17ch
Padding: 1ch around node graph each side; 4 borders
total w = 30x3 + 17 + 2+4 = 113ch wide; 16:10 would be 28ch tall (8:20 characters)
Node adders: 30ch + 2
total w = 113 + 32 = 145; 16:10 would be 36ch tall

Height:
  goal: 6 lines + 1ch borders
  ~node adders: 4-5ch tall +~
  borders
  approx 8 removed
  ~leaves 32 for node bodies = 20 + 10 + 2 titlebars~
  leaves 28 for node bodies = 2 title + 20 + 6
do funny pixel aspect, chars are 9x20


```
Examples w/add/subtract

Multiply - 17LOC, 2N, 3CH
Node 1 (7x3)
MOV ch3 INPUT
MOV ACC INPUT
loop: MOV ch1 ACC
wait: JNZ ch2 wait
JLZ ch2 end
DEC ; SUB 1
JMP loop
end:

Node 2 (10x3)
wait: JEQ ch3 0 wait
MOV acc 0
add: ADD acc ch3
JLZ ch1 end
MOV ch2 1
MOV ch2 0
JMP add
end: MOV ch2 -1
MOV ch2 0
MOV OUTPUT acc


Larger of two numbers
Node 1 (6x4)
MOV ch2 input
MOV ACC INPUT
MOV ch1 acc
sub ch3
MOV ch4 acc
SLP 3

Node 2 (9x4)
SLP 1
MOV acc ch2
MOV ch3 acc
SLP 2
JLZ ch4 a
MOV output ch2
JMP end
a: MOV output ch1
JMP end
end:

```

Brainstorming
* Mining
  * limited amount of payload to return with
  * limited space to program sensors
  * program a filter and limited amount of payload, try to optimize the value within it
  * Possible loop:
    * tune filters (just set the 4 values)
    * do mining drill (radar-like minigame, just get hot/cold feedback, collect stuff along the way)
    * see what you got, fills up your payload, gives information about the possible exotics
    * repeat until payload is full
    * payload value is your score, play another level (high score compatibleish)
      * or, spend payload for upgrades, play another level (not high score compatible, maybe have some fixed-seed challenges?)
      * upgrades would be: something other than space?
        * information gain rate
        * if an overworld where you start mining from: MOVement speed
  * Goal?
    * discover all info in as few drills as possible
    * maximize value of payload
    * perfectly tune sensors for a particular exotic, in as few drills as possible?
      * then, maybe just 1 per planet?
* Programming game
  * limited space to place nodes
    * TIS100-like but communication is broadcast over channels
    * various shaped nodes have more or less broadcasters, storage, other things?
      * No, probably no other things, all nodes are same-ish, only their shape and number of broadcasts is different
    * cannot read from the same frequency you're broadcasting to
    * conditionals are all based on a read from a frequency
    * multiple people broadcasting gets their values summed (AM) or averaged (FM)?
