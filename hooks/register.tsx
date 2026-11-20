import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mode } from '../types'
import { dispatch, readFactory } from './factory-dispatch'
import { loadMode, loadProgress, rememberProject, saveMode } from './factory-progress-store'
import { LOOK, unpaintedLine } from './factory-palette'
import { buildSafeScene, buildScene } from './factory-scene-svg'
import { initialFactoryState } from './factory-state-machine'
import { outcomeOf } from './failure-classifier'
import { guarded } from './safe-hook-wrapper'
import { HELP, statusLine } from './factory-display-copy'

/** Wiring only: each hook turns an engine event into a factory event and always hands the event on. */
const PLUGIN = 'rocket-factory'
// The scan reads state refs per file, so this file names the same two values factory-dispatch.ts writes.
const factory = atom({ plugin: 'rocket-factory', key: 'factory' } as const, initialFactoryState())
/** 'session' once the theme is set for the current session id; null after /clear or before the first set. */
const themedFor = atom({ plugin: 'rocket-factory', key: 'themedFor' } as const, null as string | null)
const MODE_ARGS: Record<string, Mode> = { on: 'on', calm: 'calm', off: 'off' }

// Tool calls the classic hook reported as interrupted (Esc), so their end is not counted as scrap.
const interrupted = new Set<string>()

/** Sets the theme unless the person turned it off; true when a surface draws it now. */
async function applyTheme($: EngineInterface): Promise<boolean> {
  const s = await readFactory($)
  if (s.mode === 'off') return false
  const set = await $.theme.set(LOOK)
  return set.isDrawn
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await guarded($, 'session.start', async () => {
      if (!e.isInteractive) return
      await rememberProject($, e.cwd)
      await dispatch($, { type: 'RESTORE', stored: await loadProgress($), mode: await loadMode($) })
      await $.command.register({ name: 'rocket-factory', description: 'Rocket Factory: on · calm · off · status', argumentHint: 'on|calm|off|status' })
      if (await applyTheme($)) await update($, themedFor, () => 'session')
      if (unpaintedLine) $.ui.toast(`Rocket Factory: ${unpaintedLine}`)
    })
    return next(e)
  })

  // After /clear no session.start comes; the next prompt finds the theme not yet set for this session.
  on('prompt.submit', async ($, e, next) => {
    await guarded($, 'prompt.submit', async () => {
      if ((await read($, themedFor)) === 'session') return
      const stored = await loadProgress($)
      const wasRunning = (await readFactory($)).sessionStartedAt !== 0
      if (wasRunning) await dispatch($, { type: 'CLEARED', stored })
      else await dispatch($, { type: 'RESTORE', stored, mode: await loadMode($) })
      if (await applyTheme($)) await update($, themedFor, () => 'session')
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // The theme of the old id is gone after /clear: mark it so the next prompt sets it again.
    if (e.reason === 'clear') await guarded($, 'session.end', () => update($, themedFor, () => null))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId) await guarded($, 'turn.start', () => dispatch($, { type: 'TURN_START' }))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) {
      await guarded($, 'turn.complete', async () => dispatch($, { type: 'TURN_END', reason: e.reason, stored: await loadProgress($) }))
    }
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask') await guarded($, 'tool.check', () => dispatch($, { type: 'GATE_OPEN', tool: e.tool }))
    return verdict
  })

  on('tool.call', async ($, e, next) => {
    await guarded($, 'tool.call', () => dispatch($, { type: 'TOOL_START', tool: e.tool }))
    let result: { deny?: string; isError?: boolean } = { isError: true }
    try {
      const r = await next(e)
      result = r
      return r
    } finally {
      const id = e.tool_use_id ?? ''
      const outcome = outcomeOf(result, interrupted.delete(id))
      await guarded($, 'tool.call', () => dispatch($, { type: 'TOOL_END', tool: e.tool, outcome }))
    }
  })

  on('classic.PostToolUseFailure', async ($, e, next) => {
    if (e.is_interrupt) interrupted.add(e.tool_use_id)
    return next(e)
  })

  on('classic.StopFailure', async ($, e, next) => {
    await guarded($, 'StopFailure', () => dispatch($, { type: 'API_ERROR', code: e.error }))
    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const counts = !e.agentId && (e.trigger === 'manual' || e.trigger === 'auto')
    if (counts) await guarded($, 'session.compact', () => dispatch($, { type: 'COMPACT_START' }))
    try {
      return await next(e)
    } finally {
      if (counts) await guarded($, 'session.compact', () => dispatch($, { type: 'COMPACT_END' }))
    }
  })

  on('command.run', { command: 'rocket-factory' }, async ($, e) => {
    try {
      const arg = e.args.trim().toLowerCase()
      const mode = MODE_ARGS[arg]
      if (mode) {
        await saveMode($, mode)
        await dispatch($, { type: 'MODE', mode })
        if (mode === 'off') {
          await $.theme.clear()
          await update($, themedFor, () => null)
          return { text: 'Theme off. The factory keeps counting; type /rocket-factory on to turn it back on.' }
        }
        const drawn = await applyTheme($)
        if (drawn) await update($, themedFor, () => 'session')
        return { text: mode === 'calm' ? 'Calm mode: no sparks, smoke or rolling CRT bar.' : `The factory lights are on. Looks best in dark mode.${drawn ? '' : ' (This surface does not draw backdrops.)'}` }
      }
      if (arg === 'status') return { text: statusLine(await readFactory($), await $.clock.now()) }
      return { text: HELP }
    } catch (err) {
      return { text: `Rocket Factory hit a problem: ${String(err).slice(0, 160)}` }
    }
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    // Svg exists on the desktop and mobile element tables only; another mod's backdrop is left alone.
    if (e.props.plugin !== PLUGIN || (e.surface !== 'desktop' && e.surface !== 'mobile')) return next(e)
    const { Svg } = $.ui.resolve(e)
    const s = await read($, factory)
    try {
      const source = buildScene(s, await $.clock.now())
      return <Svg source={source} alt={`Rocket Factory: ${statusLine(s, 0)}`} isInteractive />
    } catch {
      try {
        return <Svg source={buildSafeScene(s)} alt="Rocket Factory, safe mode" />
      } catch {
        return next(e)
      }
    }
  })
}
