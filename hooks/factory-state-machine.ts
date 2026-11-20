import type { FactoryState, Mode, Progress, Station } from '../types'
import { troubleKindOf, troubleShowMs, type ToolOutcome } from './failure-classifier'
import { stationOf, truckLabel } from './tool-to-workshop-station'

/** Pure state machine of the factory: hooks translate engine events into these and nothing else decides. */
export const RINGS = 8
export const PHASE_MS = { STACK: 2600, READY: 3000, FIRE: 6000, ROLLOUT: 3600, PAUSE: 2000, HANDOVER: 3000 } as const
export const FAILING_MS = 1800
export const FAULT_MS = 4000
const REFUSAL_MS = 3000

export type FactoryEvent =
  | { type: 'RESTORE'; stored: Progress | null; mode: Mode }
  | { type: 'TURN_START' }
  | { type: 'TURN_END'; reason: 'answer' | 'aborted' | 'refusal' | 'error'; stored: Progress | null }
  | { type: 'TOOL_START'; tool: string }
  | { type: 'TOOL_END'; tool: string; outcome: ToolOutcome }
  | { type: 'GATE_OPEN'; tool: string }
  | { type: 'GATE_CLOSE' }
  | { type: 'API_ERROR'; code: string }
  | { type: 'COMPACT_START' }
  | { type: 'COMPACT_END' }
  | { type: 'CLEARED'; stored: Progress | null }
  | { type: 'FAULT' }
  | { type: 'MODE'; mode: Mode }
  | { type: 'TICK' }

export function freshProgress(now: number, fleet = 0, ship = 1): Progress {
  return { ship, ring: 0, welds: 0, rejects: 0, fleet, shipStartedAt: now }
}

export function initialFactoryState(): FactoryState {
  return {
    progress: freshProgress(0), phase: 'IDLE', phaseStartedAt: 0, sessionStartedAt: 0, inTurn: false,
    active: {}, failing: null, gate: null, trouble: null, crew: 0, truck: null, faults: 0, faultUntil: 0, mode: 'on',
  }
}

/** Another session of the same project may have moved on: keep whichever build is further along. */
export function freshest(mine: Progress, stored: Progress | null): Progress {
  if (!stored) return mine
  if (stored.ship !== mine.ship) return stored.ship > mine.ship ? stored : mine
  return stored.ring > mine.ring ? stored : mine
}

/** Static fire and roll-out play to the end; turns during them only count toward the next ship. */
export const isShowtime = (s: FactoryState) => s.phase === 'READY' || s.phase === 'FIRE' || s.phase === 'ROLLOUT'

const go = (s: FactoryState, phase: FactoryState['phase'], now: number): FactoryState => ({ ...s, phase, phaseStartedAt: now })
const idle = (s: FactoryState) => (s.inTurn ? 'SHIFT' : 'IDLE') as FactoryState['phase']

function bump(active: FactoryState['active'], st: Station, by: number): FactoryState['active'] {
  const n = Math.max(0, (active[st] ?? 0) + by)
  const next = { ...active }
  if (n === 0) delete next[st]
  else next[st] = n
  return next
}

export function reduce(s: FactoryState, ev: FactoryEvent, now: number): FactoryState {
  switch (ev.type) {
    case 'RESTORE': {
      // Hot reload keeps $.state: keep the session, drop calls whose end the old code can no longer report.
      const base = { ...s, active: {}, gate: null, crew: 0, truck: null, mode: ev.mode }
      if (s.sessionStartedAt === 0) {
        return settle({ ...base, progress: ev.stored ?? freshProgress(now), phase: 'IDLE', phaseStartedAt: now, sessionStartedAt: now }, now)
      }
      return settle({ ...base, progress: freshest(s.progress, ev.stored) }, now)
    }
    case 'TURN_START':
      if (isShowtime(s)) return { ...s, inTurn: true }
      return go({ ...s, inTurn: true, trouble: null }, 'SHIFT', now)
    case 'TURN_END': {
      const ended = { ...s, inTurn: false, active: {}, gate: null, truck: null }
      if (isShowtime(s)) return ended
      if (ev.reason === 'aborted') return go(ended, 'PAUSE', now)
      if (ev.reason !== 'answer') {
        return go({ ...ended, trouble: { kind: 'scrub', code: ev.reason, until: now + REFUSAL_MS } }, 'IDLE', now)
      }
      const p = freshest(s.progress, ev.stored)
      return go({ ...ended, progress: { ...p, ring: Math.min(p.ring + 1, RINGS) } }, 'STACK', now)
    }
    case 'TOOL_START': {
      const st = stationOf(ev.tool)
      if (st === 'crew') return { ...s, crew: s.crew + 1 }
      if (st === 'lights') return go(s, 'CLOSED', now)
      return { ...s, active: bump(s.active, st, 1), truck: st === 'supply' ? truckLabel(ev.tool) : s.truck }
    }
    case 'TOOL_END': {
      const st = stationOf(ev.tool)
      if (st === 'lights') return s
      let next: FactoryState = st === 'crew' ? { ...s, crew: Math.max(0, s.crew - 1) } : { ...s, active: bump(s.active, st, -1) }
      if (st === 'supply' && !next.active.supply) next = { ...next, truck: null }
      if (ev.outcome === 'ok' && st === 'weld') next = { ...next, progress: { ...next.progress, welds: next.progress.welds + 1 } }
      if (ev.outcome === 'error' || ev.outcome === 'deny') {
        next = {
          ...next,
          progress: { ...next.progress, rejects: next.progress.rejects + 1 },
          failing: { station: st, label: ev.outcome === 'deny' ? 'DENIED' : 'FAILED', until: now + FAILING_MS },
        }
      }
      return { ...next, gate: null }
    }
    case 'GATE_OPEN':
      return { ...s, gate: { tool: ev.tool } }
    case 'GATE_CLOSE':
      return { ...s, gate: null }
    case 'API_ERROR': {
      const kind = troubleKindOf(ev.code)
      return go({ ...s, inTurn: false, active: {}, gate: null, truck: null, trouble: { kind, code: ev.code, until: now + troubleShowMs(kind) } }, 'IDLE', now)
    }
    case 'COMPACT_START':
      return isShowtime(s) ? s : go(s, 'SERVICE', now)
    case 'COMPACT_END':
      return s.phase === 'SERVICE' ? go(s, idle(s), now) : s
    case 'CLEARED':
      return go({ ...s, progress: freshest(s.progress, ev.stored), inTurn: false, active: {}, gate: null, crew: 0, truck: null, trouble: null, sessionStartedAt: now }, 'HANDOVER', now)
    case 'FAULT':
      return { ...s, faults: s.faults + 1, faultUntil: now + FAULT_MS }
    case 'MODE':
      return { ...s, mode: ev.mode }
    case 'TICK':
      // The minute field changes the value even when nothing else is due, so the backdrop redraws its clock.
      return { ...settle(s, now), minute: s.sessionStartedAt ? Math.floor((now - s.sessionStartedAt) / 60000) : 0 }
  }
}

/** Runs every timed step that is due, as many as are due (a reload can find several long expired). */
export function settle(s: FactoryState, now: number): FactoryState {
  let cur = expireMarks(s, now)
  for (let guard = 0; guard < 8; guard++) {
    const step = timedStep(cur)
    if (!step || step.at > now) return cur
    cur = step.apply(cur, step.at)
  }
  return cur
}

function expireMarks(s: FactoryState, now: number): FactoryState {
  return {
    ...s,
    failing: s.failing && s.failing.until > now ? s.failing : null,
    trouble: s.trouble && s.trouble.until > now ? s.trouble : null,
    faultUntil: s.faultUntil > now ? s.faultUntil : 0,
  }
}

type TimedStep = { at: number; apply: (s: FactoryState, at: number) => FactoryState }

function timedStep(s: FactoryState): TimedStep | null {
  const t0 = s.phaseStartedAt
  switch (s.phase) {
    case 'STACK':
      return { at: t0 + PHASE_MS.STACK, apply: (x, at) => go(x, x.progress.ring >= RINGS ? 'READY' : idle(x), at) }
    case 'READY':
      return { at: t0 + PHASE_MS.READY, apply: (x, at) => go(x, 'FIRE', at) }
    case 'FIRE':
      return { at: t0 + PHASE_MS.FIRE, apply: (x, at) => go(x, 'ROLLOUT', at) }
    case 'ROLLOUT':
      return {
        at: t0 + PHASE_MS.ROLLOUT,
        apply: (x, at) => go({ ...x, progress: freshProgress(at, x.progress.fleet + 1, x.progress.ship + 1) }, idle(x), at),
      }
    case 'PAUSE':
      return { at: t0 + PHASE_MS.PAUSE, apply: (x, at) => go(x, idle(x), at) }
    case 'HANDOVER':
      return { at: t0 + PHASE_MS.HANDOVER, apply: (x, at) => go(x, idle(x), at) }
    default:
      return null
  }
}

/** The next moment the state changes by itself (a phase ends or a mark expires), or null. */
export function nextDeadline(s: FactoryState): number | null {
  const times = [timedStep(s)?.at, s.failing?.until, s.trouble?.until, s.faultUntil || undefined].filter(
    (t): t is number => typeof t === 'number',
  )
  return times.length > 0 ? Math.min(...times) : null
}
