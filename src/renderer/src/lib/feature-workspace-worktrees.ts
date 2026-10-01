import { useAppStore } from '@/store'
import type { FolderWorkspace } from '../../../shared/folder-workspace-types'
import type { Repo } from '../../../shared/repo-types'
import type { WorkspaceLineage } from '../../../shared/worktree/lineage-types'
import { splitWorktreeId } from '../../../shared/worktree/id'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../../shared/workspace-scope'
import { toFeatureFolderName } from '../../../shared/feature-folder-name'

/** Repos that already have a worktree attached to the folder workspace. */
export function getFeatureRepoIds(
  folderWorkspaceId: string,
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>>
): Set<string> {
  const parentKey = folderWorkspaceKey(folderWorkspaceId)
  const repoIds = new Set<string>()
  for (const lineage of Object.values(workspaceLineageByChildKey)) {
    const child = parseWorkspaceKey(lineage.childWorkspaceKey)
    const parsed = child?.type === 'worktree' ? splitWorktreeId(child.worktreeId) : null
    if (lineage.parentWorkspaceKey === parentKey && parsed) {
      repoIds.add(parsed.repoId)
    }
  }
  return repoIds
}

export type FeatureRepoFailure = { repo: Repo; message: string }

/** One worktree per repo on the feature's branch, attached to the feature and named after its repo.
 *  Sequential so each repo's setup script starts in turn instead of all at once. */
export async function addReposToFeature(
  folderWorkspace: Pick<FolderWorkspace, 'id' | 'name'>,
  repos: readonly Repo[]
): Promise<FeatureRepoFailure[]> {
  const branchName = toFeatureFolderName(folderWorkspace.name)
  const failures: FeatureRepoFailure[] = []
  for (const repo of repos) {
    try {
      await useAppStore
        .getState()
        .createWorktree(
          repo.id,
          branchName,
          undefined,
          'inherit',
          undefined,
          undefined,
          repo.displayName,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            displayNameKind: 'user',
            parentWorktreeId: folderWorkspaceKey(folderWorkspace.id)
          }
        )
    } catch (error) {
      failures.push({ repo, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return failures
}
