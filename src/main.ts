import { CpuController, type Difficulty } from './game/ai'
import { STEP } from './game/config'
import type { Controls } from './game/fighter'
import { Game, type GameEvent, type Winner } from './game/game'
import { loadAssets } from './ui/assets'
import { Sfx } from './ui/audio'
import { Hud } from './ui/hud'
import { Keyboard } from './ui/input'
import { Renderer } from './ui/renderer'

type Mode = 'cpu' | 'versus'
/** `demo` is the CPU-vs-CPU fight that plays behind the main menu. */
type Screen = 'demo' | 'playing' | 'paused' | 'result'

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing element #${id}`)
  return node as T
}

const DIFFICULTY_KEY = 'samurai-duel:difficulty'

function savedDifficulty(): Difficulty {
  try {
    const value = localStorage.getItem(DIFFICULTY_KEY)
    if (value === 'easy' || value === 'normal' || value === 'hard') return value
  } catch {
    // Storage can be unavailable (private mode, embedded frames); fall through to the default.
  }
  return 'normal'
}

async function boot(): Promise<void> {
  const canvas = el<HTMLCanvasElement>('game')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser')

  const menu = el('menu')
  const pauseScreen = el('pause')
  const resultScreen = el('result')

  const assets = await loadAssets()
  el('loading').hidden = true
  el('menu-body').hidden = false

  const renderer = new Renderer(ctx, assets)
  const hud = new Hud()
  const sfx = new Sfx()

  let game = new Game()
  let screen: Screen = 'demo'
  let mode: Mode = 'cpu'
  let difficulty = savedDifficulty()
  let cpus: [CpuController | null, CpuController | null] = [
    new CpuController('normal'),
    new CpuController('normal'),
  ]

  // ----- screens -----------------------------------------------------------------------------

  function showMenu(): void {
    game = new Game()
    cpus = [new CpuController('normal'), new CpuController('normal')]
    screen = 'demo'
    hud.setVisible(false)
    menu.hidden = false
    pauseScreen.hidden = true
    resultScreen.hidden = true
    menu.querySelector<HTMLButtonElement>('[data-mode="cpu"]')?.focus()
  }

  function startMatch(next: Mode): void {
    mode = next
    game = new Game()
    cpus = [null, mode === 'cpu' ? new CpuController(difficulty) : null]
    const [a, b] = game.fighters
    hud.setLabels({
      names:
        mode === 'cpu'
          ? [a.spec.name.toUpperCase(), `${b.spec.name.toUpperCase()} (CPU)`]
          : [`P1 ${a.spec.name.toUpperCase()}`, `P2 ${b.spec.name.toUpperCase()}`],
      winText: winnerText,
    })
    hud.setVisible(true)
    menu.hidden = true
    pauseScreen.hidden = true
    resultScreen.hidden = true
    screen = 'playing'
    accumulator = 0
  }

  function winnerText(winner: Winner): string {
    if (winner === null) return 'DRAW'
    if (mode === 'cpu') return winner === 0 ? 'YOU WIN' : 'YOU LOSE'
    return `PLAYER ${winner + 1} WINS`
  }

  function setPaused(paused: boolean): void {
    if (paused && screen === 'playing') {
      screen = 'paused'
      pauseScreen.hidden = false
      el('resume').focus()
    } else if (!paused && screen === 'paused') {
      screen = 'playing'
      pauseScreen.hidden = true
      accumulator = 0
    }
  }

  function showResult(winner: Winner): void {
    screen = 'result'
    el('result-title').textContent = winnerText(winner)
    el('result-score').textContent = `${game.wins[0]} - ${game.wins[1]}`
    resultScreen.hidden = false
    el('rematch').focus()
  }

  function setDifficulty(next: Difficulty): void {
    difficulty = next
    try {
      localStorage.setItem(DIFFICULTY_KEY, next)
    } catch {
      // Not being able to remember the choice is harmless.
    }
    for (const b of menu.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
      b.setAttribute('aria-checked', String(b.dataset.difficulty === next))
    }
  }

  // ----- input -------------------------------------------------------------------------------

  const keyboard = new Keyboard((code) => {
    sfx.unlock()
    if (code === 'KeyM') sfx.muted = !sfx.muted
    if (code === 'Backquote') renderer.debug = !renderer.debug
    if (code === 'Escape' || code === 'KeyP') {
      if (screen === 'playing') setPaused(true)
      else if (screen === 'paused') setPaused(false)
      else if (screen === 'result' && code === 'Escape') showMenu()
    }
    if (screen === 'demo') {
      if (code === 'Digit1') startMatch('cpu')
      if (code === 'Digit2') startMatch('versus')
    }
  })

  for (const b of menu.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    b.addEventListener('click', () => {
      sfx.unlock()
      sfx.play('select')
      startMatch(b.dataset.mode as Mode)
    })
  }
  for (const b of menu.querySelectorAll<HTMLButtonElement>('[data-difficulty]')) {
    b.addEventListener('click', () => {
      sfx.unlock()
      sfx.play('select')
      setDifficulty(b.dataset.difficulty as Difficulty)
    })
  }
  el('resume').addEventListener('click', () => setPaused(false))
  el('quit').addEventListener('click', showMenu)
  el('rematch').addEventListener('click', () => startMatch(mode))
  el('to-menu').addEventListener('click', showMenu)

  // Never leave a fight running in a tab nobody is looking at.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPaused(true)
  })

  // ----- simulation --------------------------------------------------------------------------

  function inputs(): [Controls, Controls] {
    const [a, b] = game.fighters
    return [
      cpus[0] ? cpus[0].update(a, b) : keyboard.playerOne(),
      cpus[1] ? cpus[1].update(b, a) : keyboard.playerTwo(),
    ]
  }

  function handle(event: GameEvent): void {
    renderer.onEvent(event)
    if (screen === 'demo') {
      // The menu demo is silent and loops forever.
      if (event.type === 'matchEnd') game.restart()
      return
    }
    switch (event.type) {
      case 'jump':
      case 'land':
      case 'swing':
      case 'block':
      case 'ko':
      case 'fight':
        sfx.play(event.type)
        break
      case 'hit':
        sfx.play(event.heavy ? 'heavyHit' : 'hit')
        break
      case 'roundStart':
        sfx.play('round')
        break
      case 'matchEnd':
        if (event.winner !== null && (mode === 'versus' || event.winner === 0)) sfx.play('win')
        showResult(event.winner)
        break
      case 'roundEnd':
        break
    }
  }

  // ----- main loop ---------------------------------------------------------------------------
  // Fixed-timestep simulation with an accumulator: the game runs at exactly 60 ticks per second
  // on any monitor, and rendering interpolates between ticks for smooth motion at 120/144 Hz.

  let accumulator = 0
  let last = performance.now()

  function frame(now: number): void {
    // Clamp long gaps (tab switch, breakpoint) so the game never tries to "catch up" in a burst.
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now

    if (screen !== 'paused') {
      accumulator += dt
      while (accumulator >= STEP) {
        game.step(inputs())
        keyboard.endTick()
        for (const event of game.drainEvents()) handle(event)
        accumulator -= STEP
      }
    }

    const alpha = screen === 'paused' || game.hitstop > 0 ? 1 : accumulator / STEP
    renderer.draw(game, alpha, screen === 'paused' ? 0 : dt)
    if (screen !== 'demo') hud.update(game)
    requestAnimationFrame(frame)
  }

  setDifficulty(difficulty)
  showMenu()
  requestAnimationFrame(frame)
}

boot().catch((error: unknown) => {
  console.error(error)
  const loading = document.getElementById('loading')
  if (loading) loading.textContent = 'FAILED TO LOAD. PLEASE REFRESH.'
})
