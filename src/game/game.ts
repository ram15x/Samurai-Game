import { KENJI, MACK } from './characters'
import { RULES, TICK_RATE, WIDTH } from './config'
import { Fighter, NEUTRAL, intersects, type Controls } from './fighter'

export type Phase = 'intro' | 'fight' | 'roundEnd' | 'matchEnd'
export type Side = 0 | 1
/** `null` means a draw. */
export type Winner = Side | null

export type GameEvent =
  | { type: 'jump' | 'land' | 'swing'; who: Side }
  | { type: 'hit' | 'block' | 'ko'; who: Side; heavy: boolean; x: number; y: number }
  | { type: 'roundStart'; round: number }
  | { type: 'fight' }
  | { type: 'roundEnd'; winner: Winner; reason: 'ko' | 'time' }
  | { type: 'matchEnd'; winner: Winner }

/**
 * The whole match: two fighters, rounds, the clock and hit resolution.
 * Advances in fixed ticks and knows nothing about rendering, audio or the keyboard.
 */
export class Game {
  readonly fighters: [Fighter, Fighter] = [
    new Fighter(MACK, 200, 1),
    new Fighter(KENJI, WIDTH - 200 - 50, -1),
  ]

  phase: Phase = 'intro'
  phaseTick = 0
  round = 1
  wins: [number, number] = [0, 0]
  timeTicks: number = RULES.roundSeconds * TICK_RATE
  /** Both fighters freeze for a few ticks when a blow lands, which gives hits their weight. */
  hitstop = 0
  roundWinner: Winner = null
  roundEndReason: 'ko' | 'time' = 'ko'
  matchWinner: Winner = null

  private events: GameEvent[] = [{ type: 'roundStart', round: 1 }]

  get secondsLeft(): number {
    return Math.ceil(this.timeTicks / TICK_RATE)
  }

  /** Start a fresh match. */
  restart(): void {
    this.round = 1
    this.wins = [0, 0]
    this.matchWinner = null
    this.startRound()
  }

  drainEvents(): GameEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  step(inputs: readonly [Readonly<Controls>, Readonly<Controls>]): void {
    const [a, b] = this.fighters

    if (this.hitstop > 0) {
      this.hitstop--
      for (const f of this.fighters) {
        f.prevX = f.x
        f.prevY = f.y
      }
      return
    }

    this.phaseTick++
    const live = this.phase === 'fight'
    const ax = a.centerX
    const bx = b.centerX
    a.step(live ? inputs[0] : NEUTRAL, bx)
    b.step(live ? inputs[1] : NEUTRAL, ax)
    this.collectFighterEvents()
    this.separate()

    switch (this.phase) {
      case 'intro':
        if (this.phaseTick >= RULES.introTicks) {
          this.setPhase('fight')
          this.events.push({ type: 'fight' })
        }
        break

      case 'fight':
        this.resolveHits()
        this.timeTicks--
        if (a.dead || b.dead) {
          this.endRound(a.dead && b.dead ? null : a.dead ? 1 : 0, 'ko')
        } else if (this.timeTicks <= 0) {
          this.endRound(a.health === b.health ? null : a.health > b.health ? 0 : 1, 'time')
        }
        break

      case 'roundEnd':
        if (this.phaseTick >= RULES.roundEndTicks) this.afterRound()
        break

      case 'matchEnd':
        break
    }
  }

  private setPhase(phase: Phase): void {
    this.phase = phase
    this.phaseTick = 0
  }

  private startRound(): void {
    for (const f of this.fighters) f.reset()
    this.timeTicks = RULES.roundSeconds * TICK_RATE
    this.hitstop = 0
    this.roundWinner = null
    this.setPhase('intro')
    this.events.push({ type: 'roundStart', round: this.round })
  }

  private endRound(winner: Winner, reason: 'ko' | 'time'): void {
    this.roundWinner = winner
    this.roundEndReason = reason
    if (winner !== null) this.wins[winner]++
    this.setPhase('roundEnd')
    this.events.push({ type: 'roundEnd', winner, reason })
  }

  private afterRound(): void {
    const [w0, w1] = this.wins
    const decided = w0 >= RULES.roundsToWin || w1 >= RULES.roundsToWin
    if (decided || this.round >= RULES.maxRounds) {
      this.matchWinner = w0 === w1 ? null : w0 > w1 ? 0 : 1
      this.setPhase('matchEnd')
      this.events.push({ type: 'matchEnd', winner: this.matchWinner })
    } else {
      this.round++
      this.startRound()
    }
  }

  private collectFighterEvents(): void {
    this.fighters.forEach((f, i) => {
      for (const type of f.events) this.events.push({ type, who: i as Side })
      f.events.length = 0
    })
  }

  /** Fighters are solid: push overlapping bodies apart so they cannot walk through each other. */
  private separate(): void {
    const [a, b] = this.fighters
    if (a.dead || b.dead) return
    if (!intersects(a.hurtBox(), b.hurtBox())) return

    const overlap = (a.width + b.width) / 2 - Math.abs(a.centerX - b.centerX)
    const dir = a.centerX === b.centerX ? -a.facing : a.centerX < b.centerX ? -1 : 1
    const maxA = WIDTH - a.width
    const maxB = WIDTH - b.width

    const ax = Math.min(Math.max(a.x + (dir * overlap) / 2, 0), maxA)
    const bx = Math.min(Math.max(b.x - (dir * overlap) / 2, 0), maxB)
    // If one of them is pinned against a wall, the other one takes the rest of the push.
    const moved = Math.abs(ax - a.x) + Math.abs(bx - b.x)
    const rest = overlap - moved
    a.x = ax
    b.x = bx
    if (rest > 0.001) {
      if (a.x <= 0 || a.x >= maxA) b.x = Math.min(Math.max(b.x - dir * rest, 0), maxB)
      else a.x = Math.min(Math.max(a.x + dir * rest, 0), maxA)
    }
  }

  private resolveHits(): void {
    // Collect first, apply after: if both blades connect on the same tick, both hits count.
    const hits: { attacker: Side; victim: Side }[] = []
    for (const i of [0, 1] as const) {
      const attacker = this.fighters[i]
      const victim = this.fighters[(1 - i) as Side]
      const box = attacker.attackBox()
      if (attacker.isAttackActive && box && !victim.dead && intersects(box, victim.hurtBox())) {
        hits.push({ attacker: i, victim: (1 - i) as Side })
      }
    }

    const pending = hits.map((h) => ({ ...h, attack: this.fighters[h.attacker].attack! }))
    for (const { attacker, victim, attack } of pending) {
      const atk = this.fighters[attacker]
      const def = this.fighters[victim]
      const result = def.receiveHit(attack, atk.facing)
      atk.attackConnected = true
      const heavy = attack.kind === 'heavy'
      this.hitstop = Math.max(this.hitstop, result === 'blocked' ? 3 : heavy ? 8 : 5)
      this.events.push({
        type: result === 'blocked' ? 'block' : result,
        who: victim,
        heavy,
        x: (atk.centerX + def.centerX) / 2,
        y: def.y + def.height * 0.4,
      })
    }
  }
}
