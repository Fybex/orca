import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { Repo } from '../../shared/repo-types'
import type { RuntimeWorktreeCreateResult, RuntimeWorktreeRecord } from '../../shared/runtime-types'
import { toFeatureBranchName } from '../../shared/feature-folder-name'
import { folderWorkspaceKey } from '../../shared/workspace-scope'
import type { FolderRepoWorktrees } from '../folder-format'
import { RuntimeClientError, type RuntimeClient } from '../runtime-client'

/** One worktree per repo on the folder's branch, attached to it, as the app's "Add repos" does.
 *  Sequential so setup scripts start in turn; a failed repo does not stop the rest. */
export async function addReposToFolder(
  client: RuntimeClient,
  folderWorkspace: Pick<FolderWorkspace, 'id' | 'name'>,
  repoSelectors: readonly string[],
  attachedWorktrees: readonly Pick<RuntimeWorktreeRecord, 'id' | 'repoId'>[] = []
): Promise<FolderRepoWorktrees> {
  const branchName = toFeatureBranchName(folderWorkspace.name)
  const attachedByRepoId = new Map(
    attachedWorktrees.map((worktree) => [worktree.repoId, worktree.id])
  )
  const callerTerminalHandle = process.env.ORCA_TERMINAL_HANDLE || undefined
  const result: FolderRepoWorktrees = { worktrees: [], skipped: [], failures: [] }
  for (const repoSelector of repoSelectors) {
    try {
      const { repo } = (await client.call<{ repo: Repo }>('repo.show', { repo: repoSelector }))
        .result
      const attachedId = attachedByRepoId.get(repo.id)
      if (attachedId) {
        result.skipped.push({ repo: repoSelector, worktreeId: attachedId })
        continue
      }
      const created = await client.call<RuntimeWorktreeCreateResult>('worktree.create', {
        repo: repoSelector,
        name: branchName,
        displayName: repo.displayName,
        displayNameKind: 'user',
        parentWorkspace: folderWorkspaceKey(folderWorkspace.id),
        setupDecision: 'inherit',
        cliProvenanceRequest: callerTerminalHandle ? { callerTerminalHandle } : {}
      })
      result.worktrees.push(created.result.worktree)
      attachedByRepoId.set(repo.id, created.result.worktree.id)
    } catch (error) {
      result.failures.push({
        repo: repoSelector,
        code: error instanceof RuntimeClientError ? error.code : 'runtime_error',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return result
}
