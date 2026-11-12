import type { AnimName, AttackSpec, CharacterSpec } from './characters'
import { FLOOR_Y, PHYSICS, RULES, WIDTH } from './config'

/** The buttons a fighter can hold on a given tick. Fed by the keyboard or by the CPU. */
export interface Controls {
  left: boolean
  right: boolean
  jump: boolean
  block: boolean
  light: boolean
  heavy: boolean
}

export const NEUTRAL: Readonly<Controls> = Object.freeze({
  left: false,
  right: false,
  jump: false,
  block: false,
  light: false,
  heavy: false,
})

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  )
}

export type HitResult = 'hit' | 'blocked' | 'ko'
export type FighterEvent = 'jump' | 'land' | 'swing'

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(value + step, target)
  return Math.max(value - step, target)
}

/**
 * One fighter. Pure game logic with no canvas or DOM access, so it can be unit tested
 * and driven by either a human or the CPU.
 */
export class Fighter {
  readonly width = 50
  readonly height = 150

  x = 0
  y = 0
  /** Position on the previous tick, used by the renderer to interpolate between ticks. */
  prevX = 0
  prevY = 0
  vx = 0
  vy = 0
  facing: 1 | -1 = 1
  health: number = RULES.maxHealth

  anim: AnimName = 'idle'
  animTick = 0

  attack: AttackSpec | null = null
  attackTick = 0
  /** A swing can only connect once. */
  attackConnected = false

  hitstun = 0
  blockstun = 0
  blocking = false
  dead = false

  /** Things that happened this tick, drained by the Game for sound and effects. */
  events: FighterEvent[] = []

  private prev: Controls = { ...NEUTRAL }
  private jumpBuffer = 0
  private attackBuffer: { kind: 'light' | 'heavy'; ticks: number } | null = null

  constructor(
    readonly spec: CharacterSpec,
    private readonly spawnX: number,
    private readonly spawnFacing: 1 | -1,
  ) {
    this.reset()
  }

  reset(): void {
    this.x = this.prevX = this.spawnX
    this.y = this.prevY = FLOOR_Y - this.height
    this.vx = 0
    this.vy = 0
    this.facing = this.spawnFacing
    this.health = RULES.maxHealth
    this.anim = 'idle'
    this.animTick = 0
    this.attack = null
    this.attackTick = 0
    this.attackConnected = false
    this.hitstun = 0
    this.blockstun = 0
    this.blocking = false
    this.dead = false
    this.events = []
    this.prev = { ...NEUTRAL }
    this.jumpBuffer = 0
    this.attackBuffer = null
  }

  get centerX(): number {
    return this.x + this.width / 2
  }

  get onGround(): boolean {
    return this.y + this.height >= FLOOR_Y && this.vy >= 0
  }

  get canAct(): boolean {
    return !this.dead && this.hitstun === 0 && this.blockstun === 0 && this.attack === null
  }

  /** Which animation frame of the current attack we are on, or -1 when not attacking. */
  get attackFrame(): number {
    if (!this.attack) return -1
    let t = this.attackTick
    const ticks = this.attack.frameTicks
    for (let i = 0; i < ticks.length; i++) {
      t -= ticks[i]!
      if (t < 0) return i
    }
    return ticks.length - 1
  }

  get isAttackActive(): boolean {
    return (
      this.attack !== null &&
      !this.attackConnected &&
      this.attackFrame === this.attack.activeFrame
    )
  }

  hurtBox(): Rect {
    return { x: this.x, y: this.y, width: this.width, height: this.height }
  }

  /** The area the current attack covers. Also used by the debug overlay and the CPU. */
  attackBox(attack: AttackSpec | null = this.attack): Rect | null {
    if (!attack) return null
    const { reach, yOffset, height } = attack.box
    return {
      x: this.facing === 1 ? this.centerX : this.centerX - reach,
      y: this.y + yOffset,
      width: reach,
      height,
    }
  }

  /** Current frame index of the current animation, for the renderer. */
  get frame(): number {
    if (this.attack) return this.attackFrame
    const spec = this.spec.anims[this.anim]
    const index = Math.floor(this.animTick / spec.hold)
    const loops = this.anim !== 'takeHit' && this.anim !== 'death'
    return loops ? index % spec.frames : Math.min(index, spec.frames - 1)
  }

  /** Advance one tick. `opponentX` is the centre of the other fighter, used to turn around. */
  step(input: Readonly<Controls>, opponentX: number): void {
    this.prevX = this.x
    this.prevY = this.y

    const pressedJump = input.jump && !this.prev.jump
    const pressedLight = input.light && !this.prev.light
    const pressedHeavy = input.heavy && !this.prev.heavy
    this.prev = { ...input }

    if (this.dead) {
      this.integrate(0)
      this.animTick++
      return
    }

    // Input buffering: a press slightly too early is remembered instead of being dropped.
    if (pressedJump) this.jumpBuffer = PHYSICS.jumpBufferTicks
    else if (this.jumpBuffer > 0) this.jumpBuffer--

    if (pressedHeavy) this.attackBuffer = { kind: 'heavy', ticks: PHYSICS.attackBufferTicks }
    else if (pressedLight) this.attackBuffer = { kind: 'light', ticks: PHYSICS.attackBufferTicks }
    else if (this.attackBuffer && --this.attackBuffer.ticks <= 0) this.attackBuffer = null

    if (this.hitstun > 0) {
      this.hitstun--
    } else if (this.blockstun > 0) {
      this.blockstun--
    } else if (this.attack) {
      this.attackTick++
      const total = this.attack.frameTicks.reduce((sum, t) => sum + t, 0)
      if (this.attackTick >= total) this.attack = null
    }

    let moveDir = 0
    if (this.canAct) {
      if (this.onGround && opponentX !== this.centerX) {
        this.facing = opponentX > this.centerX ? 1 : -1
      }
      this.blocking = input.block && this.onGround
      if (!this.blocking) {
        if (this.attackBuffer) {
          this.startAttack(this.attackBuffer.kind)
        } else {
          moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
          if (this.jumpBuffer > 0 && this.onGround) {
            this.vy = PHYSICS.jumpVelocity
            this.jumpBuffer = 0
            this.events.push('jump')
          }
        }
      }
    } else if (this.blockstun === 0) {
      this.blocking = false
    }

    // Variable jump height: letting go of jump early cuts the rise short.
    if (!input.jump && this.hitstun === 0 && this.vy < PHYSICS.jumpCutVelocity) {
      this.vy = PHYSICS.jumpCutVelocity
    }

    this.integrate(moveDir)
    this.selectAnimation(moveDir)
  }

  /** Apply an incoming attack. `fromDir` is the direction the attacker is facing. */
  receiveHit(attack: AttackSpec, fromDir: 1 | -1): HitResult {
    if (this.blocking && this.facing === -fromDir) {
      const chip = Math.max(1, Math.round(attack.damage * RULES.blockDamageFactor))
      // Chip damage can never finish a round.
      this.health = Math.max(1, this.health - chip)
      this.vx = fromDir * attack.knockbackX * RULES.blockKnockbackFactor
      this.blockstun = RULES.blockstunTicks
      return 'blocked'
    }

    this.health = Math.max(0, this.health - attack.damage)
    this.attack = null
    this.attackBuffer = null
    this.blocking = false
    this.blockstun = 0
    this.vx = fromDir * attack.knockbackX
    if (attack.knockbackY !== 0) this.vy = attack.knockbackY

    if (this.health === 0) {
      this.dead = true
      this.hitstun = 0
      this.vy = Math.min(this.vy, -6)
      this.anim = 'death'
      this.animTick = 0
      return 'ko'
    }

    this.hitstun = attack.hitstun
    this.anim = 'takeHit'
    this.animTick = 0
    return 'hit'
  }

  private startAttack(kind: 'light' | 'heavy'): void {
    this.attack = kind === 'light' ? this.spec.light : this.spec.heavy
    this.attackTick = 0
    this.attackConnected = false
    this.attackBuffer = null
    this.events.push('swing')
  }

  private integrate(moveDir: number): void {
    const grounded = this.onGround

    if (moveDir !== 0) {
      const accel = grounded ? PHYSICS.groundAccel : PHYSICS.airAccel
      this.vx = approach(this.vx, moveDir * PHYSICS.runSpeed, accel)
    } else {
      this.vx = approach(this.vx, 0, grounded ? PHYSICS.groundFriction : PHYSICS.airFriction)
    }

    if (!grounded) this.vy = Math.min(this.vy + PHYSICS.gravity, PHYSICS.maxFallSpeed)

    this.x += this.vx
    this.y += this.vy

    const floor = FLOOR_Y - this.height
    if (this.y >= floor) {
      this.y = floor
      if (this.vy > 0) {
        if (!grounded) this.events.push('land')
        this.vy = 0
      }
    }

    // Stage walls.
    const maxX = WIDTH - this.width
    if (this.x < 0) {
      this.x = 0
      if (this.vx < 0) this.vx = 0
    } else if (this.x > maxX) {
      this.x = maxX
      if (this.vx > 0) this.vx = 0
    }
  }

  private selectAnimation(moveDir: number): void {
    let next: AnimName
    if (this.hitstun > 0) next = 'takeHit'
    else if (this.attack) next = this.attack.anim
    else if (!this.onGround) next = this.vy < 0 ? 'jump' : 'fall'
    else if (moveDir !== 0 && !this.blocking) next = 'run'
    else next = 'idle'

    if (next === this.anim) {
      this.animTick++
    } else {
      this.anim = next
      this.animTick = 0
    }
  }
}
