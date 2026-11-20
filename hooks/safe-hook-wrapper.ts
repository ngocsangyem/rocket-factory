import type { EngineInterface } from 'claude-code'

import { dispatch } from './factory-dispatch'

let toastShown = false

/**
 * Runs a hook's own work so that a bug in the mod never touches the engine's event:
 * the error lights the fuse box (POWER FAULT), one toast per session says so, and the caller still returns next(e).
 */
export async function guarded($: EngineInterface, where: string, work: () => Promise<unknown>): Promise<void> {
  try {
    await work()
  } catch (err) {
    try {
      await dispatch($, { type: 'FAULT' })
      if (!toastShown) {
        toastShown = true
        $.ui.toast(`Rocket Factory: power fault in ${where} (${String(err).slice(0, 120)}). The factory keeps running.`)
      }
    } catch {
      // Nothing more to do: the factory stays as it was.
    }
  }
}
