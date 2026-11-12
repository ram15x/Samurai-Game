import { RULES } from '../game/config'
import type { Game, Winner } from '../game/game'

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing element #${id}`)
  return node as T
}

export interface Labels {
  names: [string, string]
  /** Text shown when a side wins a round or the match. */
  winText: (winner: Winner) => string
}

/** The DOM layer on top of the canvas: health bars, clock, round pips and announcements. */
export class Hud {
  private readonly root = el('hud')
  private readonly timer = el('timer')
  private readonly message = el('message')
  private readonly fills = [el('p1-health'), el('p2-health')] as const
  private readonly ghosts = [el('p1-ghost'), el('p2-ghost')] as const
  private readonly pips = [el('p1-pips'), el('p2-pips')] as const
  private readonly names = [el('p1-name'), el('p2-name')] as const

  private labels: Labels = { names: ['', ''], winText: () => '' }
  private shown = { health: [-1, -1], seconds: -1, wins: '', message: '' }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible
  }

  setLabels(labels: Labels): void {
    this.labels = labels
    this.names.forEach((n, i) => (n.textContent = labels.names[i]!))
    this.shown = { health: [-1, -1], seconds: -1, wins: '', message: '' }
  }

  /** Only touches the DOM when a value actually changed. */
  update(game: Game): void {
    game.fighters.forEach((f, i) => {
      if (this.shown.health[i] === f.health) return
      this.shown.health[i] = f.health
      const width = `${(f.health / RULES.maxHealth) * 100}%`
      this.fills[i]!.style.width = width
      this.ghosts[i]!.style.width = width
      this.fills[i]!.classList.toggle('low', f.health <= RULES.maxHealth * 0.25)
    })

    const seconds = game.secondsLeft
    if (seconds !== this.shown.seconds) {
      this.shown.seconds = seconds
      this.timer.textContent = String(seconds)
      this.timer.classList.toggle('low', seconds <= 10)
    }

    const wins = game.wins.join('-')
    if (wins !== this.shown.wins) {
      this.shown.wins = wins
      this.pips.forEach((p, i) => {
        p.replaceChildren(
          ...Array.from({ length: RULES.roundsToWin }, (_, n) => {
            const pip = document.createElement('i')
            if (n < game.wins[i]!) pip.className = 'won'
            return pip
          }),
        )
      })
    }

    this.setMessage(this.messageFor(game))
  }

  private messageFor(game: Game): string {
    switch (game.phase) {
      case 'intro':
        if (game.phaseTick < 15) return ''
        return game.phaseTick < RULES.introTicks - 5 ? `ROUND ${game.round}` : ''
      case 'fight':
        return game.phaseTick < 45 ? 'FIGHT!' : ''
      case 'roundEnd':
        if (game.phaseTick < 70) return game.roundEndReason === 'ko' ? 'K.O.' : 'TIME UP'
        return this.labels.winText(game.roundWinner)
      case 'matchEnd':
        return ''
    }
  }

  private setMessage(text: string): void {
    if (text === this.shown.message) return
    this.shown.message = text
    this.message.textContent = text
    // Restart the pop-in animation.
    this.message.classList.remove('pop')
    if (text) {
      void this.message.offsetWidth
      this.message.classList.add('pop')
    }
  }
}
