import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import {
  planFolderWorkspaceMove,
  type FolderWorkspaceMoveTarget
} from '../../../../shared/folder-workspace-order'
import { parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { moveWorktreeIdsWithinGroup } from './worktree-manual-order'

const FOLDER_WORKSPACE_DRAG_GROUP_PREFIX = 'folder-order:'

/** Folder rows reorder only among the folders of one project group inside one sidebar section. */
export function getFolderWorkspaceDragGroupKey(sectionKey: string, projectGroupId: string): string {
  return `${FOLDER_WORKSPACE_DRAG_GROUP_PREFIX}${projectGroupId}:${sectionKey}`
}

export function isFolderWorkspaceDragGroupKey(groupKey: string): boolean {
  return groupKey.startsWith(FOLDER_WORKSPACE_DRAG_GROUP_PREFIX)
}

function toFolderWorkspaceId(key: string | undefined): string | null {
  const scope = key ? parseWorkspaceKey(key) : null
  return scope?.type === 'folder' ? scope.folderWorkspaceId : null
}

/** The visible neighbour a drop at `dropIndex` places the dragged folder next to. */
export function getFolderWorkspaceDropTarget(args: {
  groupKeys: readonly string[]
  movedKey: string
  dropIndex: number
}): FolderWorkspaceMoveTarget | null {
  const next = moveWorktreeIdsWithinGroup(args.groupKeys, [args.movedKey], args.dropIndex)
  const index = next.indexOf(args.movedKey)
  const afterId = toFolderWorkspaceId(next[index + 1])
  if (afterId) {
    return { beforeId: afterId }
  }
  const beforeId = toFolderWorkspaceId(next[index - 1])
  return beforeId ? { afterId: beforeId } : null
}

/** `manualOrder` writes for dropping the folder row `movedKey` at `dropIndex` of its drag group. */
export function planFolderWorkspaceDrop(args: {
  folderWorkspaces: readonly FolderWorkspace[]
  groupKeys: readonly string[]
  movedKey: string
  dropIndex: number
  now: number
}): Map<string, number> {
  const moved = args.folderWorkspaces.find(({ id }) => id === toFolderWorkspaceId(args.movedKey))
  const target = getFolderWorkspaceDropTarget(args)
  if (!moved || !target) {
    return new Map()
  }
  return planFolderWorkspaceMove({
    scope: args.folderWorkspaces.filter(
      ({ projectGroupId }) => projectGroupId === moved.projectGroupId
    ),
    movedId: moved.id,
    target,
    now: args.now
  })
}
