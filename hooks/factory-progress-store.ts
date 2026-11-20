import type { EngineInterface } from 'claude-code'

import type { Mode, Progress } from '../types'

/**
 * Progress lives in $.store per project so a ship keeps building across /clear, restarts and sibling sessions.
 * The project is the git root when there is one (worktrees of one repo may report their own root), else the cwd.
 */
let projectKey: string | null = null

export async function rememberProject($: EngineInterface, cwd: string): Promise<void> {
  try {
    const repo = await $.session.repo()
    projectKey = `progress:${repo?.root ?? cwd}`
  } catch {
    projectKey = `progress:${cwd}`
  }
}

function isProgress(v: unknown): v is Progress {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return ['ship', 'ring', 'welds', 'rejects', 'fleet', 'shipStartedAt'].every(k => typeof p[k] === 'number')
}

/** A value an older version stored in another shape reads as nothing, never as a broken ship. */
export async function loadProgress($: EngineInterface): Promise<Progress | null> {
  if (!projectKey) return null
  try {
    const v = await $.store.get(projectKey)
    return isProgress(v) ? v : null
  } catch {
    return null
  }
}

let lastSaved = ''

export async function saveProgress($: EngineInterface, p: Progress): Promise<void> {
  const json = JSON.stringify(p)
  if (!projectKey || json === lastSaved) return
  lastSaved = json
  await $.store.set(projectKey, p)
}

export async function loadMode($: EngineInterface): Promise<Mode> {
  try {
    const v = await $.store.get('mode')
    return v === 'calm' || v === 'off' ? v : 'on'
  } catch {
    return 'on'
  }
}

export async function saveMode($: EngineInterface, mode: Mode): Promise<void> {
  await $.store.set('mode', mode)
}
