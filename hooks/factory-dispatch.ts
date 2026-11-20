import { atom, read, update } from 'claude-code'
import type { EngineInterface, Timer } from 'claude-code'

import type { FactoryState } from '../types'
import { saveProgress } from './factory-progress-store'
import { initialFactoryState, nextDeadline, reduce, type FactoryEvent } from './factory-state-machine'

export const factory = atom({ plugin: 'rocket-factory', key: 'factory' } as const, initialFactoryState())

// One pending timer at a time: the next moment the factory changes on its own. A hot reload cancels it;
// session.start then dispatches RESTORE, which settles what came due and schedules again.
let timer: Timer | null = null

/** Applies one event: reduce → $.state (redraws the backdrop) → persist progress → reschedule the timer. */
export async function dispatch($: EngineInterface, ev: FactoryEvent): Promise<FactoryState> {
  const now = await $.clock.now()
  const next = await update($, factory, s => reduce(s, ev, now))
  await saveProgress($, next.progress)
  schedule($, next, now)
  return next
}

function schedule($: EngineInterface, s: FactoryState, now: number): void {
  timer?.cancel()
  timer = null
  const at = earliest(nextDeadline(s), nextMinute(s, now))
  if (at === null) return
  timer = $.clock.after(Math.max(0, at - now) + 20, () => {
    dispatch($, { type: 'TICK' }).catch(() => {})
  })
}

/** The mission clock shows minutes: redraw on the next minute boundary while the theme is on. */
function nextMinute(s: FactoryState, now: number): number | null {
  if (s.sessionStartedAt === 0 || s.mode === 'off') return null
  return s.sessionStartedAt + (Math.floor((now - s.sessionStartedAt) / 60000) + 1) * 60000
}

const earliest = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b))

export async function readFactory($: EngineInterface): Promise<FactoryState> {
  return read($, factory)
}
