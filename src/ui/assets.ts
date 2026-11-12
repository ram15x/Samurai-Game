import { ANIM_NAMES, KENJI, MACK } from '../game/characters'

export type Assets = Map<string, HTMLImageElement>

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

/** Load every image up front so no sprite ever pops in mid-fight. */
export async function loadAssets(): Promise<Assets> {
  const base = `${import.meta.env.BASE_URL}img/`
  const keys = ['background', 'shop']
  for (const c of [MACK, KENJI]) for (const anim of ANIM_NAMES) keys.push(`${c.id}/${anim}`)
  const images = await Promise.all(keys.map((k) => load(`${base}${k}.png`)))
  return new Map(keys.map((k, i) => [k, images[i]!]))
}
