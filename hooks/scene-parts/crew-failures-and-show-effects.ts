import { AMB, cls, isOn, RED, times, txt, type SceneCtx } from './scene-context-and-text-helpers'

/** People and trouble on the floor: pill crew and carts, reject pile, failure smoke, barrier, fuel gauge, maintenance scan, static fire. */

function pill(c: SceneCtx, x: number, y: number, name: string, delay: number, hat = '#d6d6d6'): string {
  // Walkers take their start from the stylesheet (kept in step across redraws), so a zero delay adds no inline style.
  const style = delay ? ` style="animation-delay:${delay}s"` : ''
  return `<g class="${cls(c, name)}"${style}><rect x="${x - 7}" y="${y - 30}" width="14" height="30" rx="7" fill="#8a8a8a"/><rect x="${x - 7}" y="${y - 30}" width="14" height="8" rx="4" fill="${hat}"/></g>`
}

function crew(c: SceneCtx): string {
  let o = ''
  // Two workers always walk the floor; they go home when the lights go out.
  if (!c.dark) o += pill(c, 760, 760, 'walkA', 0) + pill(c, 980, 720, 'walkB', 0)
  if (isOn(c, 'misc')) o += `<g class="${cls(c, 'walkA')}">${pill(c, 900, 880, '', 0)}<rect x="906" y="862" width="16" height="10" fill="#6a6a6a"/></g>`
  // One amber-hatted robot per running subagent, five at most.
  o += times(Math.min(c.s.crew, 5), i => pill(c, 640 + i * 40, 962, 'bob', i * 0.3, AMB))
  if (!c.dark) o += `<g class="${cls(c, 'cart')}"><rect x="820" y="900" width="60" height="22" fill="#2a2a2a"/><circle cx="830" cy="926" r="5" fill="#050505"/><circle cx="870" cy="926" r="5" fill="#050505"/></g>`
  return o
}

function rejectPile(c: SceneCtx): string {
  const n = c.s.progress.rejects
  const crates = times(Math.min(n, 8), i => {
    const x = 250 + (i % 4) * 12
    const y = 950 - Math.floor(i / 4) * 10 - (i % 2) * 3
    return `<rect x="${x}" y="${y}" width="12" height="9" fill="#2a1c1a" stroke="${RED}" stroke-width=".8" transform="rotate(${((i * 23) % 30) - 15} ${x + 6} 954)"/>`
  })
  return `<g>${crates}${txt(250, 982, `SCRAP ${n}`, 11, '#6a4a46')}</g>`
}

/** Where a failing station shows its smoke and red cross. */
function failSpot(c: SceneCtx): [number, number] {
  switch (c.s.failing?.station) {
    case 'supply': return [1405, 590]
    case 'crane': return [1040, 880]
    case 'weld': return [1110, 748]
    case 'radio': case 'plan': case 'ask': return [1420, 630]
    case 'cut': return [650, 850]
    default: return [c.cx, c.topY]
  }
}

function failure(c: SceneCtx): string {
  if (!c.s.failing) return ''
  const [fx, fy] = failSpot(c)
  const sparks = c.anim ? times(8, i => `<circle class="spark" style="animation-delay:${(i * 0.08).toFixed(2)}s" cx="${(i % 3) * 4}" r="2.4" fill="${RED}"/>`) : ''
  return `<g transform="translate(${fx} ${fy})">${sparks}<circle class="${cls(c, 'smoke')}" cy="-20" r="22" fill="#2a2a2a" opacity=".8"/><path d="M-12 -12 l24 24 M12 -12 l-24 24" stroke="${RED}" stroke-width="4"/></g>`
}

function barrierAndGauges(c: SceneCtx): string {
  let o = ''
  const gate = c.s.gate
  if (gate) {
    const tool = gate.tool.length > 16 ? `${gate.tool.slice(0, 15)}…` : gate.tool
    o += `<g><rect x="${c.cx + 70}" y="800" width="8" height="70" fill="#333"/><rect x="${c.cx + 70}" y="796" width="170" height="12" fill="url(#hazard)"/><circle cx="${c.cx + 74}" cy="790" r="7" fill="${AMB}" class="${cls(c, 'blink')}" filter="url(#glow)"/>${txt(c.cx + 156, 786, tool, 12, AMB, 'middle')}</g>`
  }
  if (c.tr === 'fuel') o += `<g transform="translate(1200 780)"><rect width="56" height="86" rx="6" fill="#161616" stroke="#333"/><rect x="8" y="74" width="40" height="4" fill="${AMB}"/>${txt(28, 104, '0%', 12, AMB, 'middle')}</g>`
  if (c.P === 'SERVICE') o += `<rect class="${cls(c, 'scan')}" x="${c.cx - c.rw / 2 - 16}" y="${c.topY}" width="${c.rw + 32}" height="3" fill="${AMB}" opacity=".7" filter="url(#glow)"/>`
  return o
}

function staticFire(c: SceneCtx): string {
  if (c.P !== 'FIRE') return ''
  const { cx, baseY } = c
  const flame = `<path class="${cls(c, 'flame')}" d="M${cx - 34} ${baseY + 20} Q${cx} ${baseY + 200} ${cx + 34} ${baseY + 20} Z" fill="url(#flame)"/>`
  const steam = c.anim
    ? times(9, i => `<circle class="steam" style="animation-delay:${(i * 0.3).toFixed(2)}s" cx="${cx + (i % 2 ? 1 : -1) * (50 + i * 24)}" cy="${baseY + 80}" r="${44 + i * 6}" fill="#e6e6e6" opacity=".2"/>`)
    : `<ellipse cx="${cx}" cy="${baseY + 90}" rx="240" ry="46" fill="#e6e6e6" opacity=".16"/>`
  return flame + steam
}

export function floorLife(c: SceneCtx): string {
  return crew(c) + rejectPile(c) + failure(c) + barrierAndGauges(c) + staticFire(c)
}
