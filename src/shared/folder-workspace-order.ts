import type { FolderWorkspace } from './folder-workspace-types'
import { buildSparseManualOrderUpdates } from './manual-order-ranks'

type OrderedFolderWorkspace = Pick<FolderWorkspace, 'id' | 'name' | 'manualOrder' | 'sortOrder'>

export type FolderWorkspaceMoveTarget = { beforeId: string } | { afterId: string }

/** Sidebar display order: user-authored order first, then name. Higher ranks come first. */
export function compareFolderWorkspacesForDisplay(
  left: OrderedFolderWorkspace,
  right: OrderedFolderWorkspace
): number {
  const leftOrder = left.manualOrder ?? left.sortOrder
  const rightOrder = right.manualOrder ?? right.sortOrder
  return rightOrder - leftOrder || left.name.localeCompare(right.name)
}

/**
 * New `manualOrder` by folder workspace id that moves `movedId` next to the target among `scope`,
 * one project group's folder workspaces. Usually one write; every folder in `scope` is ranked
 * once while some still sort by `sortOrder`. Empty when nothing moves.
 */
export function planFolderWorkspaceMove(args: {
  scope: readonly OrderedFolderWorkspace[]
  movedId: string
  target: FolderWorkspaceMoveTarget
  now: number
}): Map<string, number> {
  const orderedIds = [...args.scope].sort(compareFolderWorkspacesForDisplay).map(({ id }) => id)
  const { target } = args
  const before = 'beforeId' in target
  const nextIds = orderedIds.filter((id) => id !== args.movedId)
  const targetIndex = nextIds.indexOf(before ? target.beforeId : target.afterId)
  if (targetIndex === -1 || !orderedIds.includes(args.movedId)) {
    return new Map()
  }
  nextIds.splice(before ? targetIndex : targetIndex + 1, 0, args.movedId)
  if (nextIds.every((id, index) => id === orderedIds[index])) {
    return new Map()
  }
  const rankByWorktreeId = new Map<string, number>()
  for (const { id, manualOrder } of args.scope) {
    if (typeof manualOrder === 'number') {
      rankByWorktreeId.set(id, manualOrder)
    }
  }
  const updates = buildSparseManualOrderUpdates({
    orderedIds: nextIds,
    movedIds: [args.movedId],
    rankByWorktreeId,
    allWorktreeIds: orderedIds,
    now: args.now
  })
  return new Map([...updates].map(([id, { manualOrder }]) => [id, manualOrder]))
}
