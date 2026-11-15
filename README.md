# Samurai Duel

A 2D fighting game for one or two players, written in TypeScript on the plain Canvas API. No game engine.

**[Play it in your browser](https://ram15x.github.io/Samurai-Game/)**

![Gameplay: Samurai Mack lands a slash on Kenji](docs/gameplay.png)

## Features

- **Single player** against a CPU opponent with three difficulty levels
- **Local two player** on one keyboard
- Light and heavy attacks, blocking with chip damage, knockback and hitstun
- Best-of-three rounds with a 60 second clock
- Sound effects synthesised at runtime with the Web Audio API (no audio files)
- Scales to any window size

![Main menu](docs/menu.png)

## Controls

|             | Player 1 | Player 2 |
| ----------- | -------- | -------- |
| Move        | `A` `D`  | `←` `→`  |
| Jump        | `W`      | `↑`      |
| Block       | `S`      | `↓`      |
| Light attack | `F`     | `K`      |
| Heavy attack | `G`     | `L`      |

`Esc` pauses, `M` mutes, and `` ` `` (backtick) shows the hitboxes.

Hold jump for a full jump or tap it for a short hop. Blocking only works on the ground.

## Run it locally

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/ram15x/Samurai-Game.git
cd Samurai-Game
npm install
npm run dev
```

| Command           | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload      |
| `npm test`        | Run the unit tests                        |
| `npm run build`   | Type-check and build to `dist/`           |
| `npm run preview` | Serve the production build locally        |

## How it works

```
src/
  game/          Pure game logic. No DOM, no canvas, fully unit tested.
    config.ts      Physics constants and match rules
    characters.ts  Per-character animation and attack data
    fighter.ts     Movement, jumping, attacks, blocking, taking hits
    game.ts        Rounds, clock, hit detection, body collision
    ai.ts          CPU opponent
  ui/            Everything the player sees and hears.
    renderer.ts    Canvas drawing, sparks, screen shake
    hud.ts         Health bars, timer, announcements
    input.ts       Keyboard
    audio.ts       Sound effects
  main.ts        Game loop and screen flow
tests/           Vitest specs for the game logic
```
