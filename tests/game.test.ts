import { describe, expect, it } from 'vitest'
import { CpuController } from '../src/game/ai'
import { RULES, TICK_RATE } from '../src/game/config'
import { NEUTRAL, intersects, type Controls } from '../src/game/fighter'
import { Game } from '../src/game/game'
import { press, seeded } from './helpers'

const idle: [Controls, Controls] = [NEUTRAL, NEUTRAL]

function skipIntro(game: Game) {
  while (game.phase === 'intro') game.step(idle)
}

describe('rounds', () => {
  it('ignores input during the intro', () => {
    const game = new Game()
    const startX = game.fighters[0].x
    game.step([press('right'), NEUTRAL])
    expect(game.fighters[0].x).toBe(startX)
  })

  it('ends the round as a draw when time runs out on equal health', () => {
    const game = new Game()
    skipIntro(game)
    for (let i = 0; i < RULES.roundSeconds * TICK_RATE; i++) game.step(idle)
    expect(game.phase).toBe('roundEnd')
    expect(game.roundWinner).toBeNull()
    expect(game.wins).toEqual([0, 0])
  })

  it('gives a timed-out round to the fighter with more health', () => {
    const game = new Game()
    skipIntro(game)
    game.fighters[1].health = 40
    game.timeTicks = 1
    game.step(idle)
    expect(game.roundWinner).toBe(0)
    expect(game.wins).toEqual([1, 0])
  })
})

describe('hits', () => {
  it('a swing in range hits exactly once', () => {
    const game = new Game()
    skipIntro(game)
    const [a, b] = game.fighters
    b.x = a.x + 120
    game.step([press('light'), NEUTRAL])
    for (let i = 0; i < 80; i++) game.step(idle)
    expect(b.health).toBe(RULES.maxHealth - a.spec.light.damage)
  })

  it('a swing out of range misses', () => {
    const game = new Game()
    skipIntro(game)
    game.step([press('light'), NEUTRAL])
    for (let i = 0; i < 80; i++) game.step(idle)
    expect(game.fighters[1].health).toBe(RULES.maxHealth)
  })

  it('fighters cannot walk through each other', () => {
    const game = new Game()
    skipIntro(game)
    for (let i = 0; i < 300; i++) game.step([press('right'), press('left')])
    const [a, b] = game.fighters
    expect(intersects(a.hurtBox(), b.hurtBox())).toBe(false)
    expect(a.centerX).toBeLessThan(b.centerX)
  })
})

describe('cpu', () => {
  it('two CPUs always finish a match', () => {
    const game = new Game()
    const cpus = [
      new CpuController('hard', seeded(1)),
      new CpuController('normal', seeded(2)),
    ] as const
    const limit = RULES.maxRounds * (RULES.roundSeconds + 10) * TICK_RATE
    let ticks = 0
    while (game.phase !== 'matchEnd' && ticks++ < limit) {
      const [a, b] = game.fighters
      game.step([cpus[0].update(a, b), cpus[1].update(b, a)])
    }
    expect(game.phase).toBe('matchEnd')
    expect(game.wins[0] + game.wins[1]).toBeGreaterThan(0)
  })

  it('harder CPUs beat easier ones more often than not', () => {
    let hardWins = 0
    const matches = 20
    for (let seed = 0; seed < matches; seed++) {
      const game = new Game()
      // Alternate sides so the character match-up does not decide the result.
      const hardSide = seed % 2
      const hard = new CpuController('hard', seeded(seed * 2 + 1))
      const easy = new CpuController('easy', seeded(seed * 2 + 2))
      let ticks = 0
      while (game.phase !== 'matchEnd' && ticks++ < 100_000) {
        const [a, b] = game.fighters
        const inputs: [Controls, Controls] =
          hardSide === 0
            ? [hard.update(a, b), easy.update(b, a)]
            : [easy.update(a, b), hard.update(b, a)]
        game.step(inputs)
      }
      if (game.matchWinner === hardSide) hardWins++
    }
    expect(hardWins).toBeGreaterThan(matches / 2)
  })
})
