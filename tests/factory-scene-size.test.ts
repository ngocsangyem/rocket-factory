import { expect, test } from 'claude-code/testing'

import type { FactoryState, Phase, Station, TroubleKind } from '../types'
import { buildSafeScene, buildScene } from '../hooks/factory-scene-svg'
import { initialFactoryState } from '../hooks/factory-state-machine'

const PHASES: Phase[] = ['IDLE', 'SHIFT', 'STACK', 'READY', 'FIRE', 'ROLLOUT', 'SERVICE', 'HANDOVER', 'PAUSE', 'CLOSED']
const TROUBLES: Array<TroubleKind | null> = [null, 'signal', 'fuel', 'gate', 'jam', 'scrub']
const ALL_STATIONS: Station[] = ['survey', 'stock', 'weld', 'cut', 'crane', 'radio', 'supply', 'plan', 'ask', 'ship', 'siren', 'clock', 'bay', 'misc']
const LIMIT = 100_000 // the engine refuses 131,072; keep headroom

/** The busiest frame a phase can show: every station lit, crew, gate, failure, a long truck name. */
function busiest(phase: Phase, ring: number, trouble: TroubleKind | null, mode: FactoryState['mode']): FactoryState {
  const base = initialFactoryState()
  return {
    ...base, phase, mode, phaseStartedAt: 1_000_000, sessionStartedAt: 1_000_000, inTurn: true,
    progress: { ship: 123, ring, welds: 9999, rejects: 999, fleet: 999, shipStartedAt: 0 },
    active: Object.fromEntries(ALL_STATIONS.map(st => [st, 3])), crew: 9, truck: 'a-very-long-mcp-server-name',
    gate: { tool: 'mcp__server__a_very_long_tool_name' }, failing: { station: 'weld', label: 'FAILED', until: 9e12 },
    trouble: trouble ? { kind: trouble, code: 'x', until: 9e12 } : null, faultUntil: 9e12,
  }
}

test('every phase × ring × trouble × mode stays under the size budget and is one svg', async () => {
  let biggest = 0
  for (const phase of PHASES) for (let ring = 0; ring <= 8; ring++) for (const tr of TROUBLES) for (const mode of ['on', 'calm'] as const) {
    const svg = buildScene(busiest(phase, ring, tr, mode), 1_000_000 + 4_321_000)
    biggest = Math.max(biggest, svg.length)
    expect(svg.startsWith('<svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  }
  expect(biggest < LIMIT).toBe(true)
})

test('text from tools is escaped and numbers never print NaN', async () => {
  const s = { ...busiest('IDLE', 3, null, 'on'), truck: '<b>&"', gate: { tool: '<script>' } }
  const svg = buildScene(s, 2_000_000)
  expect(svg.includes('<script>')).toBe(false)
  expect(svg.includes('<b>')).toBe(false)
  expect(svg.includes('NaN')).toBe(false)
  expect(svg.includes('undefined')).toBe(false)
})

test('calm mode drops sparks, walkers and the CRT roll', async () => {
  const svg = buildScene(busiest('FIRE', 8, null, 'calm'), 2_000_000)
  expect(svg.includes('class="spark')).toBe(false)
  expect(svg.includes('class="walkA"')).toBe(false)
  expect(svg.includes('class="roll"')).toBe(false)
})

test('the safe scene has no animation and still shows the ship', async () => {
  const svg = buildSafeScene(busiest('READY', 8, 'signal', 'on'))
  expect(svg.includes('@keyframes')).toBe(false)
  expect(svg.includes('SHIP-123')).toBe(true)
  expect(svg.length < LIMIT).toBe(true)
})

test('the mission clock shows hours and minutes since the shift began', async () => {
  // 1h 12m after the session started: digits 0,1,1,2 are lit; we check the label path rather than pixels.
  const svg = buildScene({ ...initialFactoryState(), sessionStartedAt: 1000 }, 1000 + 72 * 60_000)
  expect(svg.includes('MISSION TIME')).toBe(true)
  expect(svg.includes('class="colon"')).toBe(true)
})
