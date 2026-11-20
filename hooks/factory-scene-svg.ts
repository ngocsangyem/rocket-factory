import type { FactoryState } from '../types'
import { roomShell } from './scene-parts/back-wall-floor-and-bay-door'
import { rightSideStations } from './scene-parts/control-console-and-wall-stations'
import { floorLife } from './scene-parts/crew-failures-and-show-effects'
import { hudOverlay } from './scene-parts/hud-overlay'
import { cls, esc, makeCtx, RED, times, txt, type SceneCtx } from './scene-parts/scene-context-and-text-helpers'
import { DEFS, keyframes } from './scene-parts/svg-defs-and-keyframes'
import { buildFloor } from './scene-parts/tower-crane-rocket-and-weld-bay'
import { shipCode } from './factory-display-copy'

/**
 * The backdrop: the whole factory as one SVG string, drawn from the factory state.
 * The root slices to fill any window; the HUD is pinned to the visible corners with aspect-ratio
 * media rules, which read the scene's own box.
 */
const ROOT = '<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">'

/** How far the slice crops each side at a given aspect, as [media query, dx, dy] for the HUD to follow. */
const PINS: Array<[string, number, number]> = [
  ['max-aspect-ratio:7/5', 100, 0], ['max-aspect-ratio:6/5', 200, 0], ['max-aspect-ratio:1/1', 300, 0],
  ['max-aspect-ratio:4/5', 400, 0], ['max-aspect-ratio:3/5', 500, 0],
  ['min-aspect-ratio:9/5', 0, 55], ['min-aspect-ratio:21/10', 0, 119], ['min-aspect-ratio:5/2', 0, 180],
]
const pinCss = PINS.map(([q, dx, dy]) =>
  `@media (${q}){.pinTR{transform:translate(-${dx}px,${dy}px)}.pinBR{transform:translate(-${dx}px,-${dy}px)}}`).join('')

function signalLoss(c: SceneCtx): string {
  if (c.tr !== 'signal') return ''
  const noise = c.anim
    ? '<rect width="1600" height="1000" filter="url(#noise)" class="staticFx"/>'
    : '<rect width="1600" height="1000" fill="#888" opacity=".15"/>'
  const bands = times(7, i => `<rect class="${cls(c, 'band')}" style="animation-delay:${(i * 0.17).toFixed(2)}s" y="${(i * 149) % 1000}" width="1600" height="${6 + (i % 3) * 8}" fill="#cfcfcf" opacity=".12"/>`)
  return `<g opacity=".85">${noise}${bands}<rect x="560" y="440" width="480" height="70" fill="#0a0a0a" stroke="${RED}" stroke-width="2"/>${txt(800, 486, 'SIGNAL LOST · RETRYING', 22, RED, 'middle', 'filter="url(#glow)"')}</g>`
}

function crtLayer(c: SceneCtx, grain: boolean): string {
  const roll = c.anim ? '<rect class="roll" width="1600" height="120" fill="url(#rollG)"/>' : ''
  const noise = grain ? '<rect width="1600" height="1000" filter="url(#grain)"/>' : ''
  return `${noise}<rect width="1600" height="1000" fill="url(#scan)"/>${roll}<rect width="1600" height="1000" fill="url(#vig)"/>`
}

/** The HUD split by corner so each part can follow its corner of the visible box. */
function pinnedHud(c: SceneCtx): string {
  const hud = hudOverlay(c)
  return `${hud.inRoom}<g class="pinTR">${hud.topRight}</g><g class="pinBR">${hud.bottomRight}</g>`
}

export function buildScene(s: FactoryState, now: number): string {
  const c = makeCtx(s, now, s.mode !== 'calm')
  const room = roomShell(c) + rightSideStations(c) + buildFloor(c) + floorLife(c)
  const shake = c.tr === 'signal' ? cls(c, 'jitter') : ''
  return `${ROOT}${DEFS}<style>${keyframes(c)}${pinCss}</style><rect width="1600" height="1000" fill="#0c0c0c"/><g class="${shake}">${room}</g>${pinnedHud(c)}${signalLoss(c)}${crtLayer(c, true)}</svg>`
}

/** Static fallback when buildScene throws: the room without motion or effects, and the counts. */
export function buildSafeScene(s: FactoryState): string {
  try {
    const c = makeCtx(s, s.phaseStartedAt, false)
    return `${ROOT}${DEFS}<style>${pinCss}</style><rect width="1600" height="1000" fill="#0c0c0c"/>${roomShell(c)}${buildFloor(c)}<g class="pinTR">${txt(1540, 120, `SAFE MODE · ${shipCode(s.progress.ship)} · ${Math.min(s.progress.ring, 8)}/8`, 16, '#ffb547', 'end')}</g>${crtLayer(c, false)}</svg>`
  } catch {
    return `${ROOT}<rect width="1600" height="1000" fill="#0c0c0c"/><text x="1540" y="200" text-anchor="end" font-family="ui-monospace, Menlo, monospace" font-size="16" fill="#ffb547">SAFE MODE · ${esc(shipCode(s.progress.ship))}</text></svg>`
  }
}
