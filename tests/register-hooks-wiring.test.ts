import { expect, test } from 'claude-code/testing'


/** The hooks end to end: engine events in, the factory's status line out. */
async function runCommand($: any, args: string): Promise<string> {
  return JSON.stringify(await $.command.run({ command: 'rocket-factory', args }))
}
const statusOf = ($: unknown) => runCommand($, 'status')

/** Stands for the engine beneath the plugin: a clock, a store, a theme that draws, and plain event results. */
function engineBeneath(on: any, opts: { onToast?: () => void; repo?: () => unknown } = {}): void {
  let now = 1_000_000
  const store = new Map<string, unknown>()
  on('clock.now', () => ({ value: (now += 10) }))
  on('clock.after', () => ({ value: { id: 1 } }))
  on('store.get', (_: unknown, e: { key: string }) => ({ value: store.get(e.key) }))
  on('store.set', (_: unknown, e: { key: string; value: unknown }) => { store.set(e.key, e.value); return { value: undefined } })
  on('session.repo', () => (opts.repo ? opts.repo() : { value: null }))
  on('theme.set', () => ({ value: { isDrawn: true } }))
  on('theme.clear', () => ({ value: { isDrawn: false, reason: 'cleared' } }))
  on('command.register', () => ({ value: { command: 'rocket-factory' } }))
  on('ui.toast', () => { opts.onToast?.(); return { value: undefined } })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('turn.start', (_: unknown, e: { turnId: string }) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}

test('a turn with an edit welds and stacks a ring; a failing tool is scrap', async ($, on) => {
  engineBeneath(on)
  let fail = false
  on('tool.call', () => (fail ? { result: {}, isError: true, text: 'boom' } : { result: {} }))

  await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' })
  await $.tool.call({ tool: 'Edit', file_path: '/tmp/a.ts', old_string: 'a', new_string: 'b' })
  fail = true
  await $.tool.call({ tool: 'Bash', command: 'false' })
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1' })

  const status = await statusOf($)
  expect(status).toContain('ring 1/8 · 1 weld · 1 scrap')
  // The scrap mark outranks the stacking label for its 1.8 s.
  expect(status).toContain('FAILED')
})

test('the command reports status and turns the theme off', async ($, on) => {
  engineBeneath(on)
  await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  expect(await statusOf($)).toContain('SHIP-01 Morning Star')
  expect(await runCommand($, 'off')).toContain('Theme off')
  expect(await statusOf($)).toContain('mode off')
})

test('a bug inside a hook lights the fuse box, toasts once and still hands the event on', async ($, on) => {
  let toasts = 0
  engineBeneath(on, { onToast: () => { toasts++ }, repo: () => { throw new Error('repo exploded') } })

  const first = await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  expect(JSON.stringify(first)).toContain('/tmp/demo')
  await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  expect(toasts).toBe(1)
  expect(await statusOf($)).toContain('POWER FAULT')
})

test('unknown words get the help line; arguments ignore case', async ($, on) => {
  engineBeneath(on)
  await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  expect(await runCommand($, 'gibberish')).toContain('Commands: /rocket-factory on')
  expect(await runCommand($, 'STATUS')).toContain('SHIP-01')
  // The test host refuses any backdrop scene id, so the reply here is the error text; the mode still changes.
  await runCommand($, 'calm')
  expect(await statusOf($)).toContain('mode calm')
})

test('after /clear the next prompt restores the ship the factory had', async ($, on) => {
  engineBeneath(on)
  on('session.end', (_: unknown, e: { sessionId: string }) => ({ sessionId: e.sessionId }))
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: '/tmp/a.ts', old_string: 'a', new_string: 'b' })
  await $.turn.complete({ reason: 'answer', answer: 'ok', durationMs: 10, isAborted: false, turnId: 't1' })
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: null } as never)
  await $.prompt.submit({ text: 'again' } as never)
  // The test host refuses backdrop scenes, so the chip reads POWER FAULT; the state machine test covers SHIFT CHANGE.
  expect(await statusOf($)).toContain('ring 1/8 · 1 weld')
})

test('a Bash call stopped with Esc is not scrap, even without the classic hook', async ($, on) => {
  engineBeneath(on)
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: true }, isError: true, text: 'stopped' }))
  await $.session.start({ cwd: '/tmp/demo', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'sleep 9' })
  expect(await statusOf($)).toContain('0 scrap')
})
