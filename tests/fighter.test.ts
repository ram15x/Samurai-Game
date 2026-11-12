import { describe, expect, it } from 'vitest'
import { KENJI, MACK } from '../src/game/characters'
import { FLOOR_Y, RULES, WIDTH } from '../src/game/config'
import { Fighter, NEUTRAL } from '../src/game/fighter'
import { press } from './helpers'

const FAR = 900

function run(f: Fighter, input = NEUTRAL, ticks = 1, opponentX = FAR) {
  for (let i = 0; i < ticks; i++) f.step(input, opponentX)
}

describe('movement', () => {
  it('accelerates up to run speed and stops with friction', () => {
    const f = new Fighter(MACK, 200, 1)
    run(f, press('right'), 20)
    expect(f.vx).toBe(5)
    run(f, NEUTRAL, 20)
    expect(f.vx).toBe(0)
  })

  it('cannot leave the stage', () => {
    const f = new Fighter(MACK, 200, 1)
    run(f, press('left'), 200)
    expect(f.x).toBe(0)
    run(f, press('right'), 400)
    expect(f.x).toBe(WIDTH - f.width)
  })

  it('turns to face the opponent', () => {
    const f = new Fighter(MACK, 500, 1)
    run(f, NEUTRAL, 1, 100)
    expect(f.facing).toBe(-1)
  })
})

describe('jumping', () => {
  it('jumps from the ground and lands back on it', () => {
    const f = new Fighter(MACK, 200, 1)
    run(f, press('jump'))
    expect(f.onGround).toBe(false)
    run(f, press('jump'), 120)
    expect(f.onGround).toBe(true)
    expect(f.y).toBe(FLOOR_Y - f.height)
  })

  it('cannot jump again in mid-air', () => {
    const f = new Fighter(MACK, 200, 1)
    run(f, press('jump'), 10)
    const rising = f.vy
    run(f, NEUTRAL)
    run(f, press('jump'))
    // Still slowing down under gravity, not launched again.
    expect(f.vy).toBeGreaterThan(rising)
  })

  it('jumps lower when the button is released early', () => {
    const peak = (holdTicks: number) => {
      const f = new Fighter(MACK, 200, 1)
      let top = f.y
      for (let i = 0; i < 120; i++) {
        f.step(i < holdTicks ? press('jump') : NEUTRAL, FAR)
        top = Math.min(top, f.y)
      }
      return top
    }
    expect(peak(3)).toBeGreaterThan(peak(60))
  })
})

describe('combat', () => {
  it('an attack plays out and returns to neutral', () => {
    const f = new Fighter(MACK, 200, 1)
    run(f, press('light'))
    expect(f.attack).toBe(MACK.light)
    run(f, NEUTRAL, 60)
    expect(f.attack).toBeNull()
  })

  it('takes full damage and hitstun from a clean hit', () => {
    const f = new Fighter(KENJI, 500, -1)
    expect(f.receiveHit(MACK.light, 1)).toBe('hit')
    expect(f.health).toBe(RULES.maxHealth - MACK.light.damage)
    expect(f.canAct).toBe(false)
    expect(f.vx).toBeGreaterThan(0)
  })

  it('blocking reduces damage', () => {
    const f = new Fighter(KENJI, 500, -1)
    run(f, press('block'), 2, 100)
    expect(f.receiveHit(MACK.heavy, 1)).toBe('blocked')
    expect(f.health).toBeGreaterThan(RULES.maxHealth - MACK.heavy.damage)
    expect(f.health).toBeLessThan(RULES.maxHealth)
  })

  it('chip damage cannot knock out', () => {
    const f = new Fighter(KENJI, 500, -1)
    f.health = 1
    run(f, press('block'), 2, 100)
    f.receiveHit(MACK.heavy, 1)
    expect(f.dead).toBe(false)
  })

  it('dies at zero health', () => {
    const f = new Fighter(KENJI, 500, -1)
    f.health = 5
    expect(f.receiveHit(MACK.light, 1)).toBe('ko')
    expect(f.dead).toBe(true)
  })
})
