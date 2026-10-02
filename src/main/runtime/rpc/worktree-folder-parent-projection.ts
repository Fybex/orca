import type { WorkspaceKey } from '../../../shared/folder-workspace-types'
import type { Worktree } from '../../../shared/worktree/types'
import { getFolderWorkspaceParentKeys } from '../../../shared/worktree/folder-workspace-parent'
import type { OrcaRuntimeService } from '../orca-runtime'

/** Stamps worktree rows with the folder workspace each is attached to (`null` when none). */
export async function projectFolderWorkspaceParents<T extends Pick<Worktree, 'id' | 'instanceId'>>(
  runtime: Pick<OrcaRuntimeService, 'listFolderWorkspaces' | 'listWorkspaceLineage'>,
  worktrees: readonly T[]
): Promise<(T & { parentWorkspaceKey: WorkspaceKey | null })[]> {
  const parentKeys = getFolderWorkspaceParentKeys(
    worktrees,
    await runtime.listWorkspaceLineage(),
    runtime.listFolderWorkspaces()
  )
  return worktrees.map((worktree) => ({
    ...worktree,
    parentWorkspaceKey: parentKeys.get(worktree.id) ?? null
  }))
}
