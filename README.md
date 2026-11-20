# Rocket Factory

A Claude Code theme for the desktop app: a night-shift rocket factory on an old CRT monitor, drawn behind the conversation. Whatever Claude is doing, the matching station in the factory does it too. Each answered turn stacks one ring onto the rocket. At eight rings the factory counts down, test-fires the engines, rolls the ship out, and the fleet grows by one.

Inspired by @zustin-lu.

## What the factory does

Each tool call lights a station until the call ends. When several calls run in parallel, a station stays lit until the last one finishes.

| Claude is                                                   | In the factory                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Reading code (`Read`, `LSP`)                                | A survey drone flies along the hull                                |
| Looking things up (`ToolSearch`, `ListSkills`, `TaskList`…) | A scan light runs along the warehouse shelves                      |
| Editing files (`Edit`, `NotebookEdit`)                      | Two robot arms weld a steel ring; each successful edit adds a weld |
| Creating a file (`Write`)                                   | The plasma cutting table fires up                                  |
| Running commands (`Bash`, `Monitor`)                        | The roof crane moves and a forklift carries steel coils            |
| On the web (`WebSearch`, `WebFetch`)                        | The radio dish turns and sends out waves                           |
| Calling an MCP tool (`mcp__server__tool`)                   | A truck with the server's name backs into the bay door             |
| Running a subagent or workflow                              | One more robot in an amber hat joins; no ring is added             |
| Planning, todos, skills                                     | The console's CRT shows a blueprint                                |
| Asking you (`AskUserQuestion`)                              | The beacon on the console spins                                    |
| Sending files or artifacts                                  | Crates ride the outbound conveyor                                  |
| Scheduling (cron, wakeups)                                  | The wall clock's hand spins fast                                   |
| Using a worktree                                            | The windows of the far bay light up                                |
| An unknown or newer tool                                    | A worker walks past with a toolbox                                 |

The HUD in the top-right corner shows the mission clock (hours and minutes since the shift began), the ship's name, rings, welds, scrap, and a status chip saying what the factory is doing.

## When something goes wrong

- A tool fails or you deny a permission: the station smokes, a red cross appears, and one more crate lands on the scrap pile.
- You press Esc while a tool runs: the factory shows PAUSED and counts no scrap.
- Claude waits for your approval: a striped barrier drops, labelled with the tool's name.
- The API is overloaded or has a server error: the picture shakes under static and reads SIGNAL LOST.
- You hit a rate limit: half the hanging lamps go out and the fuel gauge reads 0%.
- Authentication or billing fails: the bay shutter comes down with a SUSPENDED sign.
- An answer runs past the output limit: crates jam on the conveyor.
- Any other error, or a refusal: the tower lights turn red and the chip reads SCRUBBED.

If the theme itself hits a bug, the fuse box at the foot of the tower blinks POWER FAULT and you get one small notice per session. Claude keeps working as usual.

## Progress is kept

The ship under construction is saved per project. It survives `/clear`, quitting and reopening the app, and extra sessions in the same project. When two sessions build at once, the one further along sets the ring count.

- `/clear`: the theme comes straight back, the factory shows SHIFT CHANGE, and the mission clock starts again.
- `/resume` and `/branch`: the theme comes straight back with the project's ship.
- `/compact`: the factory shows MAINTENANCE while a light bar scans down the hull.

### On a managed machine

When your organization manages Claude Code (managed settings, or a Team or Enterprise login), Claude Code's built-in guard skips some hooks of mods you install yourself. The factory still builds, but a few reactions get simpler:

- An API error shows SCRUBBED instead of its own picture (SIGNAL LOST, empty fuel, SUSPENDED, jammed crates).
- Pressing Esc counts as scrap, except for a Bash command.
- `/compact` shows no MAINTENANCE.
- After `/clear`, `/resume` or `/branch`, the theme comes back on your next message instead of right away.

An administrator can lift this by installing the mod as one of the organization's own.

## Install

The backdrop is drawn by the Claude desktop and mobile apps. In a terminal or an editor the factory still counts but draws nothing. The app colors need Claude Code 2.1.324 or later in the desktop app's Code tab. The theme is dark only and looks best with macOS in dark mode.

A session has one theme at a time. Another mod that sets a theme replaces this one, and turning this one off clears whatever theme is set.

You don't need a marketplace. Any of these loads the plugin straight from its folder.

### Copy it into your skills folder

Claude Code loads a plugin that sits in `~/.claude/skills/<name>`:

```bash
git clone <this-repo-url> ~/.claude/skills/rocket-factory
```

A copy or a symlink of this folder works the same way. Start a new session to pick it up.

### Point the desktop app at the folder

Add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`, then restart the app:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/rocket-factory"
  }
}
```

Several folders go in the same string, separated by `:`.

### One terminal session

```bash
claude --plugin-dir /path/to/rocket-factory
```

### Install through the marketplace file

The folder also holds a marketplace file, so it can be installed like any published plugin:

```bash
claude plugin install rocket-factory --marketplace /path/to/rocket-factory
```

Answer `y` when asked to add the marketplace, then pick the user scope so the theme runs in every session, including the ones the desktop app starts in its Code tab.

Use one of these methods, not several: two copies of the plugin would both set the theme.

## Commands

```text
/rocket-factory on       turn the theme on
/rocket-factory calm     calm mode: no sparks, smoke, walkers or CRT roll
/rocket-factory off      turn the theme off; the factory keeps counting
/rocket-factory status   show the ship: rings, welds, scrap, fleet
```

With reduced motion turned on in the system (`prefers-reduced-motion`), all animation stops.

## Development

```text
.claude-plugin/plugin.json        name, version, types file
.claude-plugin/marketplace.json   lets the folder be installed as a marketplace
hooks/register.tsx                wires Claude Code events into the factory
hooks/factory-state-machine.ts    the state machine, with no engine calls
hooks/factory-scene-svg.ts        assembles the SVG scene from hooks/scene-parts/
hooks/factory-palette.ts          app colors, built with make-colors.js
types/index.d.ts                  shapes kept in $.state
tests/                            tests for claude plugin test
```

Run the tests and check the plugin:

```bash
claude plugin test .
```

```bash
claude plugin validate .
```

The scene is one SVG string and must stay under 100,000 characters. The `factory-scene-size` test draws every combination of phase, ring count, trouble and mode to hold that limit. The tool table in `hooks/tool-to-workshop-station.ts` follows Claude Code 2.1.325; tools added in later versions go to the odd-jobs station until they are added to the table.

## License

MIT.
