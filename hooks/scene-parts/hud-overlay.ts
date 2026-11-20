import { hudLabel, shipCode, shipName } from '../factory-display-copy'
import { AMB, cls, pad, RED, txt, type SceneCtx } from './scene-context-and-text-helpers'
import { seg7, segCell } from './seven-segment-digits'

/** Camera HUD over the room: viewfinder corners, mission clock, ship line, status chip, REC, countdown, roll-out patch. */
const TONE = { calm: '#e6e6e6', busy: AMB, warn: AMB, fail: RED } as const

function corners(): string {
  const br = (x: number, y: number, dx: number, dy: number) => `<path d="M${x} ${y + dy * 34} V${y} H${x + dx * 34}" stroke="#6a6a6a" stroke-width="2" fill="none"/>`
  return br(30, 30, 1, 1) + br(1570, 30, -1, 1) + br(30, 970, 1, -1) + br(1570, 970, -1, -1)
}

/** Hours and minutes since the session (or the shift after /clear) began; the colon blinks for the seconds. */
function missionClock(c: SceneCtx): string {
  const mins = c.s.sessionStartedAt ? Math.max(0, Math.floor((c.now - c.s.sessionStartedAt) / 60000)) : 0
  const clock = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`
  const h = 38
  return txt(1540, 62, 'MISSION TIME · T+', 12, '#7a7a7a', 'end') + seg7(1540 - clock.length * segCell(h) + h * 0.22, 74, clock, h, AMB, cls(c, 'colon'))
}

function statusBlock(c: SceneCtx): string {
  const p = c.s.progress
  const label = hudLabel(c.s, c.now)
  const color = TONE[label.tone]
  const lw = label.text.length * 10.5 + 26
  let o = txt(1540, 142, `${shipCode(p.ship)} ${shipName(p.ship).toUpperCase()}`, 15, '#d6d6d6', 'end')
  o += txt(1540, 164, `RING ${c.shown}/8 · WELDS ${pad(Math.min(p.welds, 999))} · SCRAP ${pad(Math.min(p.rejects, 99))}`, 13, '#8a8a8a', 'end')
  o += `<rect x="${1540 - lw}" y="178" width="${lw}" height="28" fill="#0a0a0a" fill-opacity=".7" stroke="${color}" stroke-width="1.5"/>`
  o += txt(1528, 198, label.text, 15, color, 'end', 'filter="url(#glow)"')
  if (c.s.mode === 'calm') o += txt(1540, 226, 'CALM MODE', 11, '#6a6a6a', 'end')
  return o
}

function recLine(c: SceneCtx): string {
  return `<g><circle cx="1222" cy="954" r="6" fill="${RED}" class="${cls(c, 'blink')}"/>${txt(1234, 959, 'REC', 13, '#bdbdbd')}${txt(1540, 959, `FACTORY 01 · FLEET ${c.s.progress.fleet}`, 12, '#7a7a7a', 'end')}</g>`
}

/** 3 · 2 · 1 before the static fire. Each digit owns one second; a redraw resumes at the phase's age. */
function countdown(c: SceneCtx): string {
  if (c.P !== 'READY') return ''
  const label = txt(1110, 510, 'SECONDS TO STATIC FIRE', 16, '#c9a46a', 'middle')
  if (!c.anim) return `${seg7(1060, 300, String(Math.max(1, 3 - Math.floor(c.phaseAgeS))), 170)}${label}`
  const delay = `animation-delay:-${c.phaseAgeS.toFixed(2)}s`
  return ['3', '2', '1'].map((d, i) => `<g class="cd${i}" style="${delay}">${seg7(1060, 300, d, 170)}</g>`).join('') + label
}

/** Mission patch for the ship leaving the factory. */
function patch(c: SceneCtx): string {
  if (c.P !== 'ROLLOUT') return ''
  const p = c.s.progress
  const mins = Math.max(1, Math.round((c.s.phaseStartedAt - p.shipStartedAt) / 60000))
  return `<g transform="translate(1110 400)"><g class="${cls(c, 'pop')}" style="animation-delay:-${c.phaseAgeS.toFixed(2)}s"><circle r="96" fill="#111" stroke="${AMB}" stroke-width="3"/><circle r="84" fill="none" stroke="#333" stroke-dasharray="3 5"/>${txt(0, -34, 'ROLLED OUT', 12, '#c9a46a', 'middle')}${txt(0, 0, shipCode(p.ship), 26, '#ececec', 'middle', 'font-weight="700"')}${txt(0, 22, shipName(p.ship).toUpperCase(), 12, '#bdbdbd', 'middle')}${txt(0, 44, `8 rings · ${p.welds} welds`, 11, '#8a8a8a', 'middle')}${txt(0, 60, `${p.rejects} scrap · ${mins} min`, 11, '#8a8a8a', 'middle')}</g></g>`
}

/** Split by where each part lives: top-right and bottom-right follow the visible corners, the rest stays with the room. */
export function hudOverlay(c: SceneCtx): { topRight: string; bottomRight: string; inRoom: string } {
  return { topRight: missionClock(c) + statusBlock(c), bottomRight: recLine(c), inRoom: corners() + countdown(c) + patch(c) }
}
