import { expect, test } from 'claude-code/testing'

import type { FactoryState } from '../types'
import { freshProgress, initialFactoryState, nextDeadline, PHASE_MS, reduce, RINGS, settle, type FactoryEvent } from '../hooks/factory-state-machine'

/** Runs events in order, each at its own time, settling timed phases between them. */
function run(start: FactoryState, steps: Array<[number, FactoryEvent]>): FactoryState {
  return steps.reduce((s, [at, ev]) => reduce(settle(s, at), ev, at), start)
}
const started = () => reduce(initialFactoryState(), { type: 'RESTORE', stored: null, mode: 'on' }, 1000)
const answer = { type: 'TURN_END', reason: 'answer', stored: null } as const

test('a session starts from the stored ship, or a fresh one', async () => {
  expect(started().progress.ship).toBe(1)
  expect(started().sessionStartedAt).toBe(1000)
  const stored = { ...freshProgress(0, 3, 4), ring: 5 }
  const s = reduce(initialFactoryState(), { type: 'RESTORE', stored, mode: 'calm' }, 1000)
  expect(s.progress.ring).toBe(5)
  expect(s.mode).toBe('calm')
})

test('an answered turn stacks one ring; welds count only successful edits', async () => {
  const s = run(started(), [
    [2000, { type: 'TURN_START' }],
    [2100, { type: 'TOOL_START', tool: 'Edit' }],
    [2200, { type: 'TOOL_END', tool: 'Edit', outcome: 'ok' }],
    [2300, { type: 'TOOL_START', tool: 'Edit' }],
    [2400, { type: 'TOOL_END', tool: 'Edit', outcome: 'error' }],
    [3000, answer],
  ])
  expect(s.progress.ring).toBe(1)
  expect(s.progress.welds).toBe(1)
  expect(s.progress.rejects).toBe(1)
  expect(s.phase).toBe('STACK')
  expect(settle(s, 3000 + PHASE_MS.STACK).phase).toBe('IDLE')
})

test('Esc and refusals add no ring', async () => {
  const aborted = run(started(), [[2000, { type: 'TURN_START' }], [2500, { type: 'TURN_END', reason: 'aborted', stored: null }]])
  expect(aborted.phase).toBe('PAUSE')
  expect(aborted.progress.ring).toBe(0)
  const refused = run(started(), [[2000, { type: 'TURN_START' }], [2500, { type: 'TURN_END', reason: 'refusal', stored: null }]])
  expect(refused.trouble?.kind).toBe('scrub')
  expect(refused.progress.ring).toBe(0)
})

test('parallel calls keep a station lit until the last one ends', async () => {
  const s = run(started(), [
    [2000, { type: 'TURN_START' }],
    [2100, { type: 'TOOL_START', tool: 'Read' }],
    [2100, { type: 'TOOL_START', tool: 'Read' }],
    [2200, { type: 'TOOL_END', tool: 'Read', outcome: 'ok' }],
  ])
  expect(s.active.survey).toBe(1)
  expect(reduce(s, { type: 'TOOL_END', tool: 'Read', outcome: 'ok' }, 2300).active.survey).toBe(undefined)
})

test('permission gate, deny and interrupt', async () => {
  const gated = run(started(), [[2000, { type: 'TURN_START' }], [2050, { type: 'GATE_OPEN', tool: 'Bash' }]])
  expect(gated.gate?.tool).toBe('Bash')
  const denied = reduce(gated, { type: 'TOOL_END', tool: 'Bash', outcome: 'deny' }, 2100)
  expect(denied.gate).toBe(null)
  expect(denied.failing?.label).toBe('DENIED')
  expect(denied.progress.rejects).toBe(1)
  const stopped = reduce(gated, { type: 'TOOL_END', tool: 'Bash', outcome: 'interrupt' }, 2100)
  expect(stopped.progress.rejects).toBe(0)
})

test('subagents work as crew and never stack rings', async () => {
  const s = run(started(), [[2000, { type: 'TURN_START' }], [2100, { type: 'TOOL_START', tool: 'Agent' }]])
  expect(s.crew).toBe(1)
  expect(reduce(s, { type: 'TOOL_END', tool: 'Agent', outcome: 'ok' }, 2200).crew).toBe(0)
})

test('ring 8 runs ready → static fire → roll-out → a new ship joins', async () => {
  const at7 = { ...started(), progress: { ...freshProgress(0, 2, 1), ring: RINGS - 1, welds: 9 } }
  let s = run(at7, [[2000, { type: 'TURN_START' }], [3000, answer]])
  expect(s.progress.ring).toBe(RINGS)
  let t = 3000 + PHASE_MS.STACK
  s = settle(s, t)
  expect(s.phase).toBe('READY')
  t += PHASE_MS.READY
  expect(settle(s, t).phase).toBe('FIRE')
  // A turn during the show keeps the show going and adds no ring.
  s = reduce(settle(s, t), { type: 'TURN_START' }, t)
  s = reduce(s, answer, t + 10)
  expect(s.phase).toBe('FIRE')
  t += PHASE_MS.FIRE + PHASE_MS.ROLLOUT
  s = settle(s, t)
  expect(s.progress.ship).toBe(2)
  expect(s.progress.fleet).toBe(3)
  expect(s.progress.ring).toBe(0)
  expect(s.phase).toBe('IDLE')
})

test('a reload long after the static fire catches up in one settle', async () => {
  const armed = { ...started(), phase: 'READY' as const, phaseStartedAt: 5000, progress: { ...freshProgress(0), ring: RINGS } }
  const s = reduce(armed, { type: 'RESTORE', stored: null, mode: 'on' }, 60_000)
  expect(s.progress.ship).toBe(2)
  expect(s.phase).toBe('IDLE')
})

test('compact, /clear and API errors', async () => {
  const s = run(started(), [[2000, { type: 'TURN_START' }], [2100, { type: 'COMPACT_START' }]])
  expect(s.phase).toBe('SERVICE')
  expect(reduce(s, { type: 'COMPACT_END' }, 2200).phase).toBe('SHIFT')
  const cleared = reduce({ ...s, progress: { ...s.progress, ring: 4 } }, { type: 'CLEARED', stored: null }, 9000)
  expect(cleared.phase).toBe('HANDOVER')
  expect(cleared.progress.ring).toBe(4)
  expect(cleared.sessionStartedAt).toBe(9000)
  const lost = reduce(s, { type: 'API_ERROR', code: 'overloaded' }, 3000)
  expect(lost.trouble?.kind).toBe('signal')
  expect(settle(lost, 3000 + 6001).trouble).toBe(null)
})

test('another session further along wins the ring count', async () => {
  const s = run(started(), [[2000, { type: 'TURN_START' }]])
  const stored = { ...s.progress, ring: 5 }
  expect(reduce(s, { type: 'TURN_END', reason: 'answer', stored }, 3000).progress.ring).toBe(6)
})

test('the next deadline is the earliest timed change', async () => {
  const s = reduce(started(), { type: 'API_ERROR', code: 'rate_limit' }, 2000)
  expect(nextDeadline(s)).toBe(6000)
  expect(nextDeadline(started())).toBe(null)
})
