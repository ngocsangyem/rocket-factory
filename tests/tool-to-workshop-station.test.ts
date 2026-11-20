import { expect, test } from 'claude-code/testing'

import { stationOf, truckLabel } from '../hooks/tool-to-workshop-station'

// The built-in tools of Claude Code 2.1.325; a new build's extra tools fall to `misc` until placed.
const BUILT_IN = [
  'Agent', 'AppifactRepl', 'Artifact', 'ArtifactCheck', 'ArtifactComments', 'ArtifactData', 'AskUserQuestion', 'Bash',
  'ClaudeDesign', 'CronCreate', 'CronDelete', 'CronList', 'DesignSync', 'Edit', 'EndConversation', 'EnterPlanMode',
  'EnterWorktree', 'ExitPlanMode', 'ExitWorktree', 'FetchInboxMessage', 'GetTask', 'ListAgents', 'ListConnectors',
  'ListMcpResourcesTool', 'ListPlugins', 'ListSkills', 'LSP', 'memory_list', 'memory_read', 'memory_write', 'Monitor',
  'NotebookEdit', 'OfferChromeSetup', 'Poll', 'Projects', 'propose_skills', 'ProposeGoal', 'PublishPlugin',
  'PushNotification', 'Read', 'ReadMcpResourceDirTool', 'ReadMcpResourceTool', 'ReadNotifications', 'ReadWidgetContext',
  'RemoteTrigger', 'ReportFindings', 'request_computer', 'ScheduleWakeup', 'SearchMcpRegistry', 'SearchPlugins',
  'SearchSkills', 'SendFeedback', 'SendFile', 'SendMessage', 'SendToProject', 'SendToProjectContext', 'SendUserFile',
  'SendUserMessage', 'ShareOnboardingGuide', 'ShowOnboardingRolePicker', 'Skill', 'SuggestConnectors',
  'SuggestPluginInstall', 'SuggestSkills', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskStop', 'TaskUpdate', 'TodoWrite',
  'ToolSearch', 'WaitForMcpServers', 'WebFetch', 'WebSearch', 'Workflow', 'WrapUp', 'Write', 'Yield',
]

test('every built-in tool has a real station', async () => {
  const unplaced = BUILT_IN.filter(t => stationOf(t) === 'misc')
  expect(unplaced).toEqual([])
})

test('the main tools land where the factory shows them', async () => {
  expect(stationOf('Read')).toBe('survey')
  expect(stationOf('Edit')).toBe('weld')
  expect(stationOf('Write')).toBe('cut')
  expect(stationOf('Bash')).toBe('crane')
  expect(stationOf('WebSearch')).toBe('radio')
  expect(stationOf('Agent')).toBe('crew')
  expect(stationOf('AskUserQuestion')).toBe('ask')
})

test('MCP tools drive a truck named after their server; unknown tools do odd jobs', async () => {
  expect(stationOf('mcp__github__create_pr')).toBe('supply')
  expect(truckLabel('mcp__github__create_pr')).toBe('GITHUB')
  expect(truckLabel('mcp__')).toBe('MCP')
  expect(stationOf('SomeFutureTool')).toBe('misc')
})
