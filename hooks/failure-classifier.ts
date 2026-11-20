import type { TroubleKind } from '../types'

/** How long each kind of API trouble stays on screen, in ms. */
const SHOW_MS: Record<TroubleKind, number> = { signal: 6000, fuel: 4000, gate: 4000, jam: 4000, scrub: 4000 }

/** StopFailure error code (ModelApiError) → what the factory shows. Unknown codes scrub. */
const KIND_BY_CODE: Record<string, TroubleKind> = {
  overloaded: 'signal',
  server_error: 'signal',
  rate_limit: 'fuel',
  authentication_failed: 'gate',
  oauth_org_not_allowed: 'gate',
  account_on_hold: 'gate',
  verification_required: 'gate',
  billing_error: 'gate',
  cloud_credential_error: 'gate',
  max_output_tokens: 'jam',
  invalid_request: 'scrub',
  model_not_found: 'scrub',
  unknown: 'scrub',
}

export function troubleKindOf(code: string): TroubleKind {
  return KIND_BY_CODE[code] ?? 'scrub'
}

export function troubleShowMs(kind: TroubleKind): number {
  return SHOW_MS[kind]
}

/** A finished tool call's outcome, read from the tool.call result. */
export type ToolOutcome = 'ok' | 'error' | 'deny' | 'interrupt'

export function outcomeOf(result: { deny?: string; isError?: boolean }, wasInterrupted: boolean): ToolOutcome {
  if (wasInterrupted) return 'interrupt'
  if (typeof result.deny === 'string') return 'deny'
  return result.isError === true ? 'error' : 'ok'
}
