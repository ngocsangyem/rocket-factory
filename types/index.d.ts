/** Shapes the factory keeps in $.state (per session) and $.store (per project). */
export type Phase = 'IDLE' | 'SHIFT' | 'STACK' | 'READY' | 'FIRE' | 'ROLLOUT' | 'SERVICE' | 'HANDOVER' | 'PAUSE' | 'CLOSED'
export type Station =
  | 'survey' | 'stock' | 'weld' | 'cut' | 'crane' | 'radio' | 'supply' | 'crew'
  | 'plan' | 'ask' | 'ship' | 'siren' | 'clock' | 'bay' | 'lights' | 'misc'
export type TroubleKind = 'signal' | 'fuel' | 'gate' | 'jam' | 'scrub'
export type Mode = 'on' | 'calm' | 'off'

/** One ship's build, persisted per project so it survives /clear, restarts and other sessions. */
export type Progress = { ship: number; ring: number; welds: number; rejects: number; fleet: number; shipStartedAt: number }

export type FactoryState = {
  progress: Progress
  phase: Phase
  phaseStartedAt: number
  /** Drives the mission clock; reset on /clear. 0 means the session has not started yet. */
  sessionStartedAt: number
  inTurn: boolean
  /** Running tool calls per station (parallel calls light a station once, counted). */
  active: Partial<Record<Station, number>>
  failing: { station: Station; label: 'FAILED' | 'DENIED'; until: number } | null
  gate: { tool: string } | null
  trouble: { kind: TroubleKind; code: string; until: number } | null
  crew: number
  truck: string | null
  faults: number
  faultUntil: number
  mode: Mode
  /** Whole minutes on the mission clock at the last tick; only there to make the backdrop redraw. */
  minute?: number
}

declare module 'claude-code' {
  interface PluginState {
    'rocket-factory': { factory: FactoryState; themedFor: string | null }
  }
}
