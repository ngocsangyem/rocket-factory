/**
 * Drives the theme's real factory scene from video time alone, so every frame is repeatable.
 * A fixed script of Claude Code events runs through the theme's own state machine; the scene is
 * redrawn for the seeked time and every CSS animation is pinned to that time.
 */
(function () {
  const { buildScene, initialFactoryState, reduce } = window.RocketFactory
  const T0 = 1_800_000_000_000 // a fixed wall clock; nothing reads the real one
  const SESSION_AGE_MS = 47 * 60_000

  /** [video seconds, factory seconds]: the static fire and stacking play faster than in the app. */
  const WARP = [[0, 0], [12.7, 12.7], [14.3, 15.3], [14.4, 15.4], [16, 17.95], [18.4, 20.95], [21, 26.95], [24, 30.55], [28.5, 35.05]]
  function factorySeconds(t) {
    for (let i = 1; i < WARP.length; i++) {
      const [v0, f0] = WARP[i - 1], [v1, f1] = WARP[i]
      if (t <= v1) return f0 + ((t - v0) / (v1 - v0)) * (f1 - f0)
    }
    return WARP[WARP.length - 1][1]
  }

  const tool = (name, from, to, outcome = 'ok') => [
    [from, { type: 'TOOL_START', tool: name }], [to, { type: 'TOOL_END', tool: name, outcome }],
  ]
  /** [factory seconds, event] in order. */
  const SCRIPT = [
    [2.8, { type: 'TURN_START' }],
    ...tool('Read', 2.8, 4.8), ...tool('Edit', 4.8, 6.8), ...tool('Bash', 6.8, 8.8),
    [8.8, { type: 'TOOL_START', tool: 'WebSearch' }],
    // The wide shot: every station at once.
    [10.90, { type: 'TOOL_START', tool: 'Read' }],
    [10.96, { type: 'TOOL_START', tool: 'Edit' }],
    [11.02, { type: 'TOOL_START', tool: 'Write' }],
    [11.08, { type: 'TOOL_START', tool: 'Bash' }],
    [11.14, { type: 'TOOL_START', tool: 'ToolSearch' }],
    [11.20, { type: 'TOOL_START', tool: 'TodoWrite' }],
    [11.26, { type: 'TOOL_START', tool: 'AskUserQuestion' }],
    [11.32, { type: 'TOOL_START', tool: 'SendUserFile' }],
    [11.38, { type: 'TOOL_START', tool: 'CronCreate' }],
    [11.44, { type: 'TOOL_START', tool: 'EnterWorktree' }],
    [11.50, { type: 'TOOL_START', tool: 'mcp__github__create_pr' }],
    [11.56, { type: 'TOOL_START', tool: 'Agent' }],
    [12.7, { type: 'TURN_END', reason: 'answer', stored: null }],
    [15.3, { type: 'TURN_START' }],
    [15.35, { type: 'TURN_END', reason: 'answer', stored: null }],
  ]
  const TRUCK_FROM = 11.5

  const ms = sec => T0 + Math.round(sec * 1000)
  const start = {
    ...initialFactoryState(), phaseStartedAt: T0 - 60_000, sessionStartedAt: T0 - SESSION_AGE_MS,
    progress: { ship: 1, ring: 6, welds: 23, rejects: 2, fleet: 0, shipStartedAt: T0 - SESSION_AGE_MS },
  }
  /** The state right after each scripted event, with every timed step before it already run. */
  const marks = [{ at: -1, state: start }]
  for (const [at, ev] of SCRIPT) {
    const settled = reduce(marks[marks.length - 1].state, { type: 'TICK' }, ms(at))
    marks.push({ at, state: reduce(settled, ev, ms(at)) })
  }
  function stateAt(sec) {
    let cur = marks[0]
    for (const m of marks) if (m.at <= sec) cur = m
    return reduce(cur.state, { type: 'TICK' }, ms(sec))
  }

  /** These carry their own position in a negative delay, worked out by the scene from `now`. */
  const SELF_TIMED = new Set(['tw', 'hum', 'walkA', 'walkB', 'cart', 'roll', 'drop', 'rollout', 'cd0', 'cd1', 'cd2', 'pop'])
  const host = document.getElementById('factory')

  function renderAt(t) {
    const sec = factorySeconds(Math.max(0, t))
    host.innerHTML = buildScene(stateAt(sec), ms(sec))
    for (const a of host.getAnimations({ subtree: true })) {
      a.pause()
      const name = a.animationName
      a.currentTime = SELF_TIMED.has(name) ? 0 : name === 'truck' ? Math.max(0, sec - TRUCK_FROM) * 1000 : t * 1000
    }
  }
  window.addEventListener('hf-seek', e => renderAt(e.detail.time))
  renderAt(0)
  window.__factoryRenderAt = renderAt
})()
