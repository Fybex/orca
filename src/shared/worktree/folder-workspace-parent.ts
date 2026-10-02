import type { FolderWorkspace, WorkspaceKey } from '../folder-workspace-types'
import { folderWorkspaceKey, parseWorkspaceKey, worktreeWorkspaceKey } from '../workspace-scope'
import type { WorkspaceLineage } from './lineage-types'
import type { Worktree } from './types'

/**
 * The folder workspace each worktree is attached to, keyed by worktree id. Folder parents live
 * only in workspace lineage; a record naming a deleted folder is stale.
 */
export function getFolderWorkspaceParentKeys(
  worktrees: Iterable<Pick<Worktree, 'id' | 'instanceId'>>,
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>>,
  folderWorkspaces: readonly Pick<FolderWorkspace, 'id'>[]
): Map<string, WorkspaceKey> {
  const folderWorkspaceIds = new Set(folderWorkspaces.map((folderWorkspace) => folderWorkspace.id))
  const parents = new Map<string, WorkspaceKey>()
  for (const worktree of worktrees) {
    const lineage = workspaceLineageByChildKey[worktreeWorkspaceKey(worktree.id)]
    if (!lineage) {
      continue
    }
    const parent = parseWorkspaceKey(lineage.parentWorkspaceKey)
    if (parent?.type !== 'folder' || !folderWorkspaceIds.has(parent.folderWorkspaceId)) {
      continue
    }
    // Why: a different child instance is an earlier worktree that once lived at this path.
    if (lineage.childInstanceId && lineage.childInstanceId !== worktree.instanceId) {
      continue
    }
    parents.set(worktree.id, folderWorkspaceKey(parent.folderWorkspaceId))
  }
  return parents
}

/** Inverts `getFolderWorkspaceParentKeys`: folder key -> keys of its attached worktrees. */
export function getFolderWorkspaceChildKeys(
  parentKeyByWorktreeId: ReadonlyMap<string, WorkspaceKey>
): Map<WorkspaceKey, WorkspaceKey[]> {
  const children = new Map<WorkspaceKey, WorkspaceKey[]>()
  for (const [worktreeId, parentKey] of parentKeyByWorktreeId) {
    const keys = children.get(parentKey) ?? []
    keys.push(worktreeWorkspaceKey(worktreeId))
    children.set(parentKey, keys)
  }
  return children
}
