import type { Repo } from '../../../../../../shared/repo-types'
import type {
  WorkspaceLineage,
  WorktreeLineage
} from '../../../../../../shared/worktree/lineage-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import {
  getWorktreeExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host'
import { getWorktreeHostIdentity } from '../../../../../../shared/worktree/host-qualified-identity'
import {
  folderWorkspaceKey,
  parseWorkspaceKey,
  worktreeWorkspaceKey
} from '../../../../../../shared/workspace-scope'
import { getFolderWorkspaceHostId } from '../../folder-workspace-host-id'
import { getProjectedWorktreeLineageChildrenByParentId } from '../../worktree-lineage-projection'
import type { RenderableFolderWorkspace } from './folder-workspace-lanes'
import { getWorktreeLineageGroupKey } from './group-keys'
import type { SectionAppendContext } from './group-sections'
import { appendWorktreeRows, buildFolderWorkspaceRow } from './row-builders'
import type { Row } from './row-types'

/**
 * Worktrees attached to a rendered folder workspace (plus their same-repo
 * lineage descendants), keyed by folder workspace id, in the given order.
 *
 * Why the host check: host sections split rows by execution host, so a child
 * on another host than its folder would land in a different section.
 */
export function getFolderWorkspaceAttachedWorktrees(args: {
  folderWorkspaces: readonly RenderableFolderWorkspace[]
  worktrees: readonly Worktree[]
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>>
  lineageById: Readonly<Record<string, WorktreeLineage>>
  worktreeMap: ReadonlyMap<string, Worktree>
  repoMap: Map<string, Repo>
  defaultHostId: ExecutionHostId
}): Map<string, Worktree[]> {
  const attached = new Map<string, Worktree[]>()
  if (args.folderWorkspaces.length === 0) {
    return attached
  }
  const folderHostById = new Map(
    args.folderWorkspaces.map((pair) => [
      pair.folderWorkspace.id,
      getFolderWorkspaceHostId(pair.folderWorkspace, pair.projectGroup, args.defaultHostId)
    ])
  )
  const memberFolderIdByIdentity = new Map<string, string>()
  for (const worktree of args.worktrees) {
    const lineage = args.workspaceLineageByChildKey[worktreeWorkspaceKey(worktree.id)]
    const parent = lineage ? parseWorkspaceKey(lineage.parentWorkspaceKey) : null
    if (
      parent?.type !== 'folder' ||
      (lineage.childInstanceId && lineage.childInstanceId !== worktree.instanceId)
    ) {
      continue
    }
    const folderHostId = folderHostById.get(parent.folderWorkspaceId)
    if (
      folderHostId === undefined ||
      getWorktreeExecutionHostId(
        worktree,
        args.repoMap.get(worktree.repoId),
        args.defaultHostId
      ) !== folderHostId
    ) {
      continue
    }
    memberFolderIdByIdentity.set(getWorktreeHostIdentity(worktree), parent.folderWorkspaceId)
  }
  if (memberFolderIdByIdentity.size === 0) {
    return attached
  }

  const childrenByParentId = getProjectedWorktreeLineageChildrenByParentId(
    args.lineageById,
    args.worktreeMap
  )
  const queue = [...memberFolderIdByIdentity.keys()]
  const worktreeByIdentity = new Map(
    args.worktrees.map((worktree) => [getWorktreeHostIdentity(worktree), worktree])
  )
  for (let index = 0; index < queue.length; index += 1) {
    const folderId = memberFolderIdByIdentity.get(queue[index])
    const parent = worktreeByIdentity.get(queue[index])
    for (const child of (parent && childrenByParentId.get(parent.id)) ?? []) {
      const identity = getWorktreeHostIdentity(child)
      if (folderId && worktreeByIdentity.has(identity) && !memberFolderIdByIdentity.has(identity)) {
        memberFolderIdByIdentity.set(identity, folderId)
        queue.push(identity)
      }
    }
  }

  for (const worktree of args.worktrees) {
    const folderId = memberFolderIdByIdentity.get(getWorktreeHostIdentity(worktree))
    if (folderId) {
      const list = attached.get(folderId) ?? []
      list.push(worktree)
      attached.set(folderId, list)
    }
  }
  return attached
}

/** Emits a folder workspace row followed by its attached worktrees one lineage level deeper. */
export function appendFolderWorkspaceRows(
  ctx: SectionAppendContext,
  pair: RenderableFolderWorkspace,
  groupDepth: number
): void {
  const folderRow = buildFolderWorkspaceRow(pair, groupDepth)
  const attached = ctx.attachedWorktreesByFolderId?.get(pair.folderWorkspace.id) ?? []
  if (attached.length === 0) {
    ctx.result.push(folderRow)
    return
  }
  const childRows: Row[] = []
  appendWorktreeRows(childRows, attached, ctx.repoMap, ctx.lineageById, ctx.worktreeMap, {
    nestLineage: true,
    collapsedGroups: ctx.collapsedGroups,
    groupDepth,
    sectionKey: folderRow.key,
    hostContextLabelByWorktreeIdentity: ctx.mixedWorktreeHostContextLabels,
    cyclicLineageIds: ctx.cyclicLineageIds
  })
  const rootCount = childRows.filter((row) => row.type === 'item' && row.depth === 0).length
  const lineageGroupKey = getWorktreeLineageGroupKey({
    id: folderWorkspaceKey(pair.folderWorkspace.id)
  })
  const lineageCollapsed = ctx.collapsedGroups.has(lineageGroupKey)
  ctx.result.push({ ...folderRow, lineageChildCount: rootCount, lineageCollapsed, lineageGroupKey })
  if (lineageCollapsed) {
    return
  }
  let rootIndex = -1
  for (const row of childRows) {
    if (row.type !== 'item') {
      continue
    }
    if (row.depth === 0) {
      rootIndex += 1
    }
    const rootHasNextSibling = rootIndex < rootCount - 1
    ctx.result.push({
      ...row,
      depth: row.depth + 1,
      lineageTrail: [rootHasNextSibling, ...row.lineageTrail],
      isLastLineageChild: row.depth === 0 ? !rootHasNextSibling : row.isLastLineageChild
    })
  }
}
