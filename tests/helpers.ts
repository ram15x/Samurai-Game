import type { Controls } from '../src/game/fighter'
import { NEUTRAL } from '../src/game/fighter'

export function press(...buttons: (keyof Controls)[]): Controls {
  const c: Controls = { ...NEUTRAL }
  for (const b of buttons) c[b] = true
  return c
}

/** Deterministic pseudo-random generator so CPU tests are repeatable. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
