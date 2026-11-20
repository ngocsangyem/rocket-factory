import { expect, test } from 'claude-code/testing'

import { outcomeOf, troubleKindOf } from '../hooks/failure-classifier'

test('every StopFailure code has a picture', async () => {
  const cases: Record<string, string> = {
    overloaded: 'signal', server_error: 'signal', rate_limit: 'fuel',
    authentication_failed: 'gate', oauth_org_not_allowed: 'gate', account_on_hold: 'gate',
    verification_required: 'gate', billing_error: 'gate', cloud_credential_error: 'gate',
    max_output_tokens: 'jam', invalid_request: 'scrub', model_not_found: 'scrub', unknown: 'scrub',
    a_code_from_a_later_build: 'scrub',
  }
  for (const [code, kind] of Object.entries(cases)) expect(troubleKindOf(code)).toBe(kind)
})

test('a tool result reads as ok, error, deny or interrupt', async () => {
  expect(outcomeOf({}, false)).toBe('ok')
  expect(outcomeOf({ isError: true }, false)).toBe('error')
  expect(outcomeOf({ deny: 'no' }, false)).toBe('deny')
  expect(outcomeOf({ isError: true }, true)).toBe('interrupt')
})
