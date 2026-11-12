export type AnimName =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'attack1'
  | 'attack2'
  | 'takeHit'
  | 'death'

export const ANIM_NAMES: readonly AnimName[] = [
  'idle',
  'run',
  'jump',
  'fall',
  'attack1',
  'attack2',
  'takeHit',
  'death',
]

export interface AnimSpec {
  /** Number of frames in the horizontal sprite strip. */
  frames: number
  /** Ticks each frame stays on screen. */
  hold: number
}

export interface AttackSpec {
  kind: 'light' | 'heavy'
  anim: 'attack1' | 'attack2'
  /** Duration of every animation frame in ticks: startup, active and recovery. */
  frameTicks: readonly number[]
  /** Index of the frame on which the blade can connect. */
  activeFrame: number
  damage: number
  knockbackX: number
  knockbackY: number
  /** Ticks the victim cannot act after being hit. */
  hitstun: number
  /** Hitbox, measured from the centre of the attacker's body in the facing direction. */
  box: { reach: number; yOffset: number; height: number }
}

export interface CharacterSpec {
  id: 'mack' | 'kenji'
  name: string
  scale: number
  /** Where the body box sits inside a scaled sprite frame. */
  offset: { x: number; y: number }
  /** Direction the artwork faces when drawn unflipped. */
  nativeFacing: 1 | -1
  anims: Record<AnimName, AnimSpec>
  light: AttackSpec
  heavy: AttackSpec
}

// Hitbox sizes and active frames below were measured from the slash arcs in the sprite sheets,
// so what you see is what hits.

export const MACK: CharacterSpec = {
  id: 'mack',
  name: 'Samurai Mack',
  scale: 2.5,
  offset: { x: 212, y: 157 },
  nativeFacing: 1,
  anims: {
    idle: { frames: 8, hold: 5 },
    run: { frames: 8, hold: 5 },
    jump: { frames: 2, hold: 5 },
    fall: { frames: 2, hold: 5 },
    attack1: { frames: 6, hold: 4 },
    attack2: { frames: 6, hold: 5 },
    takeHit: { frames: 4, hold: 5 },
    death: { frames: 6, hold: 7 },
  },
  // Slower to start than Kenji, but longer reach and more damage.
  light: {
    kind: 'light',
    anim: 'attack1',
    frameTicks: [3, 3, 3, 3, 6, 6],
    activeFrame: 4,
    damage: 10,
    knockbackX: 6,
    knockbackY: 0,
    hitstun: 16,
    box: { reach: 230, yOffset: -10, height: 160 },
  },
  heavy: {
    kind: 'heavy',
    anim: 'attack2',
    frameTicks: [5, 5, 5, 5, 7, 8],
    activeFrame: 4,
    damage: 18,
    knockbackX: 10,
    knockbackY: -5,
    hitstun: 26,
    box: { reach: 245, yOffset: 25, height: 125 },
  },
}

export const KENJI: CharacterSpec = {
  id: 'kenji',
  name: 'Kenji',
  scale: 2.5,
  offset: { x: 231, y: 167 },
  nativeFacing: -1,
  anims: {
    idle: { frames: 4, hold: 6 },
    run: { frames: 8, hold: 5 },
    jump: { frames: 2, hold: 5 },
    fall: { frames: 2, hold: 5 },
    attack1: { frames: 4, hold: 6 },
    attack2: { frames: 4, hold: 9 },
    takeHit: { frames: 3, hold: 6 },
    death: { frames: 7, hold: 7 },
  },
  // Quicker on the draw, slightly shorter reach and less damage.
  light: {
    kind: 'light',
    anim: 'attack1',
    frameTicks: [8, 6, 5, 5],
    activeFrame: 1,
    damage: 9,
    knockbackX: 6,
    knockbackY: 0,
    hitstun: 16,
    box: { reach: 210, yOffset: 5, height: 145 },
  },
  heavy: {
    kind: 'heavy',
    anim: 'attack2',
    frameTicks: [16, 7, 7, 8],
    activeFrame: 1,
    damage: 16,
    knockbackX: 10,
    knockbackY: -5,
    hitstun: 26,
    box: { reach: 220, yOffset: -55, height: 205 },
  },
}
