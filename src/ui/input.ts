import type { Controls } from '../game/fighter'

type Binding = Record<keyof Controls, readonly string[]>

// Bound to physical key positions (`event.code`), so Caps Lock and keyboard layout don't matter.
const PLAYER_ONE: Binding = {
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['KeyW'],
  block: ['KeyS'],
  light: ['KeyF', 'Space'],
  heavy: ['KeyG'],
}

const PLAYER_TWO: Binding = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['ArrowUp'],
  block: ['ArrowDown'],
  light: ['KeyK'],
  heavy: ['KeyL'],
}

const GAME_KEYS = new Set([...Object.values(PLAYER_ONE), ...Object.values(PLAYER_TWO)].flat())

export class Keyboard {
  private readonly down = new Set<string>()
  /** Keys pressed since the last tick, so a tap shorter than one tick is never lost. */
  private readonly tapped = new Set<string>()

  constructor(onPress: (code: string) => void) {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // Stop the arrow keys and space from scrolling the page.
      if (GAME_KEYS.has(e.code)) e.preventDefault()
      if (e.repeat) return
      this.down.add(e.code)
      this.tapped.add(e.code)
      onPress(e.code)
    })
    window.addEventListener('keyup', (e) => this.down.delete(e.code))
    // Without this a key held while alt-tabbing stays "stuck" down.
    window.addEventListener('blur', () => {
      this.down.clear()
      this.tapped.clear()
    })
  }

  /** Call once after each simulation tick has read the controls. */
  endTick(): void {
    this.tapped.clear()
  }

  playerOne(): Controls {
    return this.read(PLAYER_ONE)
  }

  playerTwo(): Controls {
    return this.read(PLAYER_TWO)
  }

  private read(binding: Binding): Controls {
    const held = (codes: readonly string[]) => codes.some((c) => this.down.has(c) || this.tapped.has(c))
    return {
      left: held(binding.left),
      right: held(binding.right),
      jump: held(binding.jump),
      block: held(binding.block),
      light: held(binding.light),
      heavy: held(binding.heavy),
    }
  }
}
