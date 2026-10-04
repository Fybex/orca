import type { RuntimeWorktreeCreateResult } from '../../shared/runtime-types'
import type { CommandHandler } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { RuntimeClientError } from '../runtime-client'

type CreateNameFlags = {
  name: string
  displayName: string
  agentTitle: string | undefined
}

/** `--name` is the branch; `--display-name` pins a different sidebar name; `--agent-title` names the agent tab. */
export function getCreateNameFlags(flags: Map<string, string | boolean>): CreateNameFlags {
  const name = getRequiredStringFlag(flags, 'name')
  const displayName = getOptionalStringFlag(flags, 'display-name')?.trim()
  if (flags.has('display-name') && !displayName) {
    throw new RuntimeClientError('invalid_argument', '--display-name cannot be blank.')
  }
  const agentTitle = getOptionalStringFlag(flags, 'agent-title')?.trim()
  if (flags.has('agent-title') && !agentTitle) {
    throw new RuntimeClientError('invalid_argument', '--agent-title cannot be blank.')
  }
  if (agentTitle && !flags.has('agent')) {
    throw new RuntimeClientError('invalid_argument', '--agent-title requires --agent.')
  }
  return { name, displayName: displayName ?? name, agentTitle }
}

// Why: renaming after create reuses terminal.rename, so older hosts need no new create param.
export async function applyAgentTerminalTitle(
  client: Parameters<CommandHandler>[0]['client'],
  result: RuntimeWorktreeCreateResult,
  title: string | undefined
): Promise<void> {
  if (!title) {
    return
  }
  const handle = result.agentTerminalHandle ?? result.startupTerminal?.handle
  if (!handle) {
    console.error('warning: --agent-title was not applied because no agent terminal was returned.')
    return
  }
  try {
    await client.call('terminal.rename', { terminal: handle, title })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`warning: --agent-title was not applied: ${reason}`)
  }
}
