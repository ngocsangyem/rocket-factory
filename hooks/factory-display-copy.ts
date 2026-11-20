import type { FactoryState, Phase, Station, TroubleKind } from '../types'

/** Every word the factory shows on screen and in command replies. */
const SHIP_NAMES = ['Morning Star', 'Evening Star', 'Polaris', 'Pleiades', 'Altair', 'Vega', 'Orion']

export function shipName(n: number): string {
  const base = SHIP_NAMES[(n - 1) % SHIP_NAMES.length] ?? 'Morning Star'
  const round = Math.floor((n - 1) / SHIP_NAMES.length)
  return round > 0 ? `${base} ${round + 1}` : base
}

export const shipCode = (n: number) => `SHIP-${String(n).padStart(2, '0')}`

export const PHASE_LABEL: Record<Phase, string> = {
  IDLE: 'STANDING BY', SHIFT: 'ON SHIFT', STACK: 'STACKING', READY: 'READY', FIRE: 'STATIC FIRE',
  ROLLOUT: 'ROLL-OUT', SERVICE: 'MAINTENANCE', HANDOVER: 'SHIFT CHANGE', PAUSE: 'PAUSED', CLOSED: 'LIGHTS OUT',
}

export const STATION_LABEL: Record<Station, string> = {
  survey: 'SURVEYING', stock: 'STOCKTAKE', weld: 'WELDING', cut: 'CUTTING', crane: 'HAULING', radio: 'RADIO LINK',
  supply: 'DELIVERY', crew: 'OVERTIME', plan: 'PLANNING', ask: 'CALLING COMMAND', ship: 'SHIPPING',
  siren: 'ANNOUNCING', clock: 'SCHEDULING', bay: 'NEW LINE', lights: 'LIGHTS OUT', misc: 'ODD JOBS',
}

export const TROUBLE_LABEL: Record<TroubleKind, string> = {
  signal: 'SIGNAL LOST', fuel: 'OUT OF FUEL', gate: 'LICENCE REVOKED', jam: 'STORES FULL', scrub: 'SCRUBBED',
}

/** What the status chip says now, and whether it is a warning (amber) or a failure (red). */
export function hudLabel(s: FactoryState, now: number): { text: string; tone: 'calm' | 'busy' | 'warn' | 'fail' } {
  if (s.trouble) return { text: TROUBLE_LABEL[s.trouble.kind], tone: s.trouble.kind === 'fuel' || s.trouble.kind === 'jam' ? 'warn' : 'fail' }
  if (s.gate) return { text: 'AWAITING APPROVAL', tone: 'warn' }
  if (s.failing) return { text: s.failing.label, tone: 'fail' }
  const running = Object.keys(s.active) as Station[]
  const last = running[running.length - 1]
  if (last) return { text: STATION_LABEL[last], tone: 'busy' }
  if (s.crew > 0) return { text: STATION_LABEL.crew, tone: 'busy' }
  if (s.faultUntil > now) return { text: 'POWER FAULT', tone: 'warn' }
  const busy = s.phase === 'STACK' || s.phase === 'READY' || s.phase === 'FIRE' || s.phase === 'ROLLOUT'
  return { text: PHASE_LABEL[s.phase], tone: busy ? 'busy' : 'calm' }
}

/** One line for `/rocket-factory status`. */
export function statusLine(s: FactoryState, now: number): string {
  const p = s.progress
  return `${shipCode(p.ship)} ${shipName(p.ship)} · ring ${p.ring}/8 · ${p.welds} weld${p.welds === 1 ? '' : 's'} · ${p.rejects} scrap · fleet ${p.fleet} · ${hudLabel(s, now).text} · mode ${s.mode}`
}

export const HELP =
  'Commands: /rocket-factory on · calm (less motion) · off (theme off, still counting) · status (show the ship). Looks best in dark mode.'
