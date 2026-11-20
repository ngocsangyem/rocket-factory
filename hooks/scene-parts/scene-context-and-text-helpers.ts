import type { FactoryState, Phase, Station, TroubleKind } from '../../types'
import { RINGS } from '../factory-state-machine'

/** Everything a scene part needs, worked out once per drawing. */
export const AMB = '#ffb547'
export const RED = '#ff6250'
export const MONO = 'ui-monospace, Menlo, monospace'
export const HZ = 640 // horizon: where the back wall meets the floor

export type SceneCtx = {
  s: FactoryState
  now: number
  /** False in calm mode and in the safe scene: no sparks, smoke, walkers. */
  anim: boolean
  P: Phase
  tr: TroubleKind | undefined
  /** Rocket geometry: centre x, ring width and height, base line, rings shown, top of the stack. */
  cx: number
  rw: number
  ringH: number
  baseY: number
  shown: number
  topY: number
  dark: boolean
  dim: boolean
  /** Seconds into the current phase, so one-shot animations resume instead of replaying on a redraw. */
  phaseAgeS: number
}

export function makeCtx(s: FactoryState, now: number, anim: boolean): SceneCtx {
  const ringH = 54
  const baseY = 820
  const shown = Math.min(s.progress.ring, RINGS)
  return {
    s, now, anim, P: s.phase, tr: s.trouble?.kind,
    cx: 470, rw: 96, ringH, baseY, shown, topY: baseY - ringH * shown,
    dark: s.phase === 'CLOSED', dim: s.trouble?.kind === 'fuel',
    phaseAgeS: Math.max(0, (now - s.phaseStartedAt) / 1000),
  }
}

/** The class only when motion is on. */
export const cls = (c: SceneCtx, name: string) => (c.anim ? name : '')
export const isOn = (c: SceneCtx, st: Station) => (c.s.active[st] ?? 0) > 0

export const esc = (str: string) =>
  str.replace(/[<>&"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch] ?? ch)
export const pad = (n: number) => String(n).padStart(2, '0')

export function txt(x: number, y: number, str: string, size = 14, fill = '#9a9a9a', anchor = 'start', extra = ''): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${MONO}" font-size="${size}" letter-spacing="2" fill="${fill}" ${extra}>${esc(str)}</text>`
}

/** n copies of a fragment, by index. */
export const times = (n: number, f: (i: number) => string) => Array.from({ length: Math.max(0, n) }, (_, i) => f(i)).join('')
