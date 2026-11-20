import type { Station } from '../types'

/**
 * Every built-in tool of Claude Code 2.1.325 placed in a workshop station.
 * `mcp__<server>__<tool>` always goes to the supply gate; anything unknown (a tool of a later build) to `misc`,
 * so the factory never stands still while Claude works.
 */
export const STATION_TOOLS: Record<Exclude<Station, 'supply' | 'misc'>, readonly string[]> = {
  survey: ['Read', 'LSP', 'ReadMcpResourceTool', 'ReadMcpResourceDirTool', 'ListMcpResourcesTool', 'ReadWidgetContext', 'memory_read', 'memory_list'],
  stock: ['ToolSearch', 'ListSkills', 'SearchSkills', 'ListPlugins', 'SearchPlugins', 'SearchMcpRegistry', 'ListConnectors', 'ListAgents', 'GetTask', 'TaskGet', 'TaskList', 'CronList', 'Projects', 'FetchInboxMessage', 'ReadNotifications'],
  weld: ['Edit', 'NotebookEdit', 'memory_write'],
  cut: ['Write'],
  crane: ['Bash', 'Monitor', 'TaskStop'],
  radio: ['WebSearch', 'WebFetch', 'RemoteTrigger', 'request_computer', 'OfferChromeSetup', 'WaitForMcpServers'],
  crew: ['Agent', 'Workflow', 'SendMessage', 'Yield', 'TaskCreate', 'TaskUpdate'],
  plan: ['EnterPlanMode', 'ExitPlanMode', 'TodoWrite', 'ProposeGoal', 'Skill', 'propose_skills'],
  ask: ['AskUserQuestion', 'ShowOnboardingRolePicker'],
  ship: ['SendUserFile', 'SendFile', 'SendUserMessage', 'SendToProject', 'SendToProjectContext', 'Artifact', 'ArtifactCheck', 'ArtifactComments', 'ArtifactData', 'AppifactRepl', 'ClaudeDesign', 'DesignSync', 'PublishPlugin', 'ReportFindings', 'SendFeedback', 'ShareOnboardingGuide', 'WrapUp', 'SuggestSkills', 'SuggestPluginInstall', 'SuggestConnectors'],
  siren: ['PushNotification'],
  clock: ['CronCreate', 'CronDelete', 'ScheduleWakeup', 'Poll'],
  bay: ['EnterWorktree', 'ExitWorktree'],
  lights: ['EndConversation'],
}

const BY_TOOL = new Map<string, Station>()
for (const [station, tools] of Object.entries(STATION_TOOLS)) for (const tool of tools) BY_TOOL.set(tool, station as Station)

export function stationOf(tool: string): Station {
  if (tool.startsWith('mcp__')) return 'supply'
  return BY_TOOL.get(tool) ?? 'misc'
}

/** The MCP server's name as painted on the supply truck: `mcp__github__create_pr` → `GITHUB`. */
export function truckLabel(tool: string): string {
  const server = tool.split('__')[1]
  return (server && server.length > 0 ? server : 'MCP').toUpperCase().slice(0, 14)
}
