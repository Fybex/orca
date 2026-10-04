import type { AgentDashboardMode } from './ui-chrome-types'

/** Where Orca surfaces agent attention; split out because global-settings-types is at the max-lines ceiling. */
export type AttentionDisplaySettings = {
  /** Experimental: pop-out Kanban dashboard for monitoring and opening agent terminals across worktrees. */
  experimentalAgentDashboardPopout?: boolean
  /** How the Agent Dashboard opens: an in-window companion board or a separate pop-out window. Defaults to in-window. */
  experimentalAgentDashboardMode?: AgentDashboardMode
  /** Includes stale quiet agents as a fourth Agent Dashboard column. */
  experimentalAgentDashboardShowIdle?: boolean
  /** Focusing or typing in an agent's terminal marks it read without the idle check. */
  agentReadOnTerminalFocus?: boolean
  /** Show the bell (activity view) button in the left sidebar header. */
  showActivityButton?: boolean
  /** Poll inactive managed Claude accounts with the active one and show each account's usage in the status bar. */
  showAllClaudeAccountsInStatusBar?: boolean
  /** Show branch diff stats and a Review changes action on rows of the right sidebar's Attached worktrees tab. */
  attachedWorktreeReview?: boolean
}
