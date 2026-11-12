import { FLOOR_Y, HEIGHT, WIDTH } from '../game/config'
import type { Fighter, Rect } from '../game/fighter'
import type { Game, GameEvent } from '../game/game'
import type { Assets } from './assets'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

const SHOP = { x: 600, y: 128, scale: 2.75, frames: 6, hold: 5 }

/** Draws the game state. Owns only visual extras: sparks, screen shake and the shop animation. */
export class Renderer {
  debug = false
  private sparks: Spark[] = []
  private shake = 0
  private time = 0

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly assets: Assets,
  ) {
    ctx.imageSmoothingEnabled = false
  }

  /** React to something that happened in the simulation. */
  onEvent(event: GameEvent): void {
    if (event.type === 'hit' || event.type === 'ko') {
      this.shake = Math.max(this.shake, event.type === 'ko' ? 14 : event.heavy ? 9 : 5)
      this.emit(event.x, event.y, event.heavy || event.type === 'ko' ? 16 : 9, '#ffe9a8', '#ff5a4d')
    } else if (event.type === 'block') {
      this.shake = Math.max(this.shake, 2)
      this.emit(event.x, event.y, 6, '#d6f1ff', '#7fb8ff')
    }
  }

  /** `alpha` is how far we are between the last two simulation ticks (0..1). */
  draw(game: Game, alpha: number, dt: number): void {
    const { ctx } = this
    this.time += dt
    const ticks = dt * 60

    ctx.save()
    if (this.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)
      this.shake *= Math.pow(0.85, ticks)
    } else {
      this.shake = 0
    }

    ctx.drawImage(this.assets.get('background')!, 0, 0)
    this.drawShop()
    // A light haze pushes the backdrop back so the fighters stand out.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // Draw the fighter who is attacking (or the winner) on top.
    const [a, b] = game.fighters
    const order = b.attack || a.dead ? [a, b] : [b, a]
    for (const f of order) this.drawShadow(f, alpha)
    for (const f of order) this.drawFighter(f, alpha)

    this.drawSparks(ticks)
    if (this.debug) this.drawDebug(game)
    ctx.restore()
  }

  private drawShop(): void {
    const img = this.assets.get('shop')!
    const w = img.width / SHOP.frames
    const frame = Math.floor((this.time * 60) / SHOP.hold) % SHOP.frames
    this.ctx.drawImage(
      img,
      frame * w,
      0,
      w,
      img.height,
      SHOP.x,
      SHOP.y,
      w * SHOP.scale,
      img.height * SHOP.scale,
    )
  }

  private drawShadow(f: Fighter, alpha: number): void {
    const { ctx } = this
    const x = f.prevX + (f.x - f.prevX) * alpha + f.width / 2
    const y = f.prevY + (f.y - f.prevY) * alpha
    // The shadow shrinks as the fighter leaves the ground.
    const height = Math.max(0, FLOOR_Y - (y + f.height))
    const size = Math.max(0.45, 1 - height / 320)
    ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * size})`
    ctx.beginPath()
    ctx.ellipse(x, FLOOR_Y + 2, 46 * size, 9 * size, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawFighter(f: Fighter, alpha: number): void {
    const { ctx } = this
    const spec = f.spec
    const img = this.assets.get(`${spec.id}/${f.anim}`)!
    const frames = spec.anims[f.anim].frames
    const fw = img.width / frames
    const x = Math.round(f.prevX + (f.x - f.prevX) * alpha)
    const y = Math.round(f.prevY + (f.y - f.prevY) * alpha)

    ctx.save()
    if (f.facing !== spec.nativeFacing) {
      // Mirror the sprite around the centre of the body.
      const cx = x + f.width / 2
      ctx.translate(cx, 0)
      ctx.scale(-1, 1)
      ctx.translate(-cx, 0)
    }
    ctx.drawImage(
      img,
      Math.min(f.frame, frames - 1) * fw,
      0,
      fw,
      img.height,
      x - spec.offset.x,
      y - spec.offset.y,
      fw * spec.scale,
      img.height * spec.scale,
    )
    ctx.restore()

    if (f.blocking) this.drawGuard(f, x, y)
  }

  /** There is no block sprite in the asset pack, so guarding is shown as a shimmering arc. */
  private drawGuard(f: Fighter, x: number, y: number): void {
    const { ctx } = this
    const cx = x + f.width / 2 + f.facing * 22
    const cy = y + f.height * 0.52
    const pulse = 0.65 + 0.25 * Math.sin(this.time * 18)
    ctx.save()
    ctx.lineCap = 'round'
    ctx.shadowColor = '#8fd0ff'
    ctx.shadowBlur = 14
    ctx.strokeStyle = `rgba(190, 230, 255, ${f.blockstun > 0 ? 1 : pulse})`
    ctx.lineWidth = f.blockstun > 0 ? 7 : 4
    ctx.beginPath()
    const mid = f.facing === 1 ? 0 : Math.PI
    ctx.ellipse(cx, cy, 34, 78, 0, mid - 1.15, mid + 1.15)
    ctx.stroke()
    ctx.restore()
  }

  private emit(x: number, y: number, count: number, ...colors: string[]): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 7
      const life = 14 + Math.random() * 14
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life,
        maxLife: life,
        color: colors[i % colors.length]!,
      })
    }
  }

  private drawSparks(ticks: number): void {
    const { ctx } = this
    for (const s of this.sparks) {
      s.x += s.vx * ticks
      s.y += s.vy * ticks
      s.vy += 0.35 * ticks
      s.life -= ticks
      const size = 2 + 5 * Math.max(s.life / s.maxLife, 0)
      ctx.fillStyle = s.color
      ctx.fillRect(Math.round(s.x - size / 2), Math.round(s.y - size / 2), size, size)
    }
    this.sparks = this.sparks.filter((s) => s.life > 0)
  }

  /** Hurtboxes in green, live hitboxes in red, inactive hitboxes in yellow. */
  private drawDebug(game: Game): void {
    const { ctx } = this
    const box = (r: Rect, color: string) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(r.x, r.y, r.width, r.height)
    }
    for (const f of game.fighters) {
      box(f.hurtBox(), '#3dff7a')
      const attack = f.attackBox()
      if (attack) box(attack, f.isAttackActive ? '#ff3d3d' : '#ffd23d')
    }
  }
}
