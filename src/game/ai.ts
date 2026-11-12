import type { Fighter, Controls } from './fighter'
import { NEUTRAL } from './fighter'

export type Difficulty = 'easy' | 'normal' | 'hard'

interface Profile {
  /** Ticks between decisions. Lower means faster reactions. */
  reaction: number
  /** Chance to attack when the opponent is in range. */
  aggression: number
  /** Chance to block when it sees an attack coming. */
  guard: number
  /** Chance to choose the slower, stronger attack. */
  heavyRate: number
}

const PROFILES: Record<Difficulty, Profile> = {
  easy: { reaction: 26, aggression: 0.4, guard: 0.15, heavyRate: 0.2 },
  normal: { reaction: 14, aggression: 0.65, guard: 0.5, heavyRate: 0.3 },
  hard: { reaction: 6, aggression: 0.9, guard: 0.85, heavyRate: 0.35 },
}

/**
 * CPU opponent. It presses the same buttons a human would (it returns `Controls`),
 * so it follows exactly the same rules and cannot cheat. It only "looks" at the fight
 * every few ticks, which is what makes its reaction time feel human.
 */
export class CpuController {
  private readonly profile: Profile
  private wait = 0
  private held: Controls = { ...NEUTRAL }

  constructor(
    difficulty: Difficulty,
    private readonly random: () => number = Math.random,
  ) {
    this.profile = PROFILES[difficulty]
  }

  update(self: Fighter, opponent: Fighter): Controls {
    // Attack and jump buttons are taps: release them the tick after pressing.
    const out: Controls = { ...this.held, light: false, heavy: false }
    if (--this.wait > 0) {
      this.held = out
      return out
    }

    const p = this.profile
    const rnd = this.random
    this.wait = p.reaction + Math.floor(rnd() * p.reaction * 0.5)

    const next: Controls = { ...NEUTRAL }
    if (self.dead || opponent.dead) {
      this.held = next
      return next
    }

    const dx = opponent.centerX - self.centerX
    const toward = dx >= 0 ? 'right' : 'left'
    const away = dx >= 0 ? 'left' : 'right'
    const distance = Math.abs(dx) - opponent.width / 2
    const lightReach = self.spec.light.box.reach
    const heavyReach = self.spec.heavy.box.reach
    const threatened =
      opponent.attack !== null &&
      !opponent.attackConnected &&
      distance < opponent.attack.box.reach + 20

    if (threatened && rnd() < p.guard) {
      // See it coming: guard, and hold the guard long enough to actually absorb the hit.
      next.block = true
      this.wait = Math.max(this.wait, 18)
    } else if (threatened && rnd() < 0.3) {
      next[away] = true
    } else if (distance > lightReach - 15) {
      // Too far to hit: close the gap, sometimes with a jump-in.
      next[toward] = true
      if (distance > 260 && rnd() < 0.12) next.jump = true
    } else if (rnd() < p.aggression) {
      const heavy = distance < heavyReach - 15 && rnd() < p.heavyRate
      if (heavy) next.heavy = true
      else next.light = true
      // Wait for the swing to finish before deciding again.
      const attack = heavy ? self.spec.heavy : self.spec.light
      this.wait = Math.max(this.wait, attack.frameTicks.reduce((s, t) => s + t, 0))
    } else if (rnd() < 0.35) {
      next[away] = true
    } else if (rnd() < 0.3) {
      next.block = true
    }

    this.held = next
    return next
  }
}
