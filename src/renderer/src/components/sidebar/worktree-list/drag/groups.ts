import { ALL_GROUP_KEY, PINNED_GROUP_KEY } from '../grouping/group-keys'
import { getNaturalWorktreeIds } from '../../natural-worktree-ids'
import type { HostSectionRow } from '../../host-section-rows'
import type { WorktreeDragGroup } from '../../worktree-manual-order'
import { getFolderWorkspaceDragGroupKey } from '../../folder-workspace-drag-order'
import { folderWorkspaceKey } from '../../../../../../shared/workspace-scope'

/** Folder rows form their own drag groups, keyed by section and project group. */
function getFolderWorkspaceDragGroupKeyForRow(
  row: Extract<HostSectionRow, { type: 'folder-workspace' }>,
  sectionKey: string | undefined
): string {
  return getFolderWorkspaceDragGroupKey(
    sectionKey ?? ALL_GROUP_KEY,
    row.folderWorkspace.projectGroupId
  )
}

export function getWorktreeDragGroups(rows: HostSectionRow[]): WorktreeDragGroup[] {
  const groups: WorktreeDragGroup[] = []
  let current: { key: string; ids: string[] } | null = null
  const naturalWorktreeIds = getNaturalWorktreeIds(rows)

  for (const row of rows) {
    if (row.type === 'header') {
      current = { key: row.key, ids: [] }
      groups.push({ key: current.key, worktreeIds: current.ids })
      continue
    }
    if (
      row.type === 'host-header' ||
      row.type === 'imported-worktrees-card' ||
      row.type === 'new-external-worktrees-inbox' ||
      row.type === 'pending-creation' ||
      row.type === 'folder-workspace'
    ) {
      continue
    }
    if (row.sectionKey === PINNED_GROUP_KEY && naturalWorktreeIds.has(row.worktree.id)) {
      continue
    }
    if (!current) {
      current = { key: ALL_GROUP_KEY, ids: [] }
      groups.push({ key: current.key, worktreeIds: current.ids })
    }
    current.ids.push(row.worktree.id)
  }

  return groups.filter((group) => group.worktreeIds.length > 0)
}

/** Folder rows by drag group, in display order. Kept apart from the worktree groups so a
 *  folder key never reaches a worktree manual-order write. */
export function getFolderWorkspaceDragGroups(rows: readonly HostSectionRow[]): WorktreeDragGroup[] {
  const idsByKey = new Map<string, string[]>()
  let sectionKey: string | undefined
  for (const row of rows) {
    if (row.type === 'header') {
      sectionKey = row.key
      continue
    }
    if (row.type !== 'folder-workspace') {
      continue
    }
    const key = getFolderWorkspaceDragGroupKeyForRow(row, sectionKey)
    const ids = idsByKey.get(key) ?? []
    ids.push(folderWorkspaceKey(row.folderWorkspace.id))
    idsByKey.set(key, ids)
  }
  return [...idsByKey].map(([key, worktreeIds]) => ({ key, worktreeIds }))
}

export function getWorktreeDragIndexes(rows: readonly HostSectionRow[]): {
  groupKeyByRowKey: Map<string, string>
  groupIndexByRowKey: Map<string, number>
} {
  const groupKeyByRowKey = new Map<string, string>()
  const groupIndexByRowKey = new Map<string, number>()
  const groupIndexes = new Map<string, number>()
  const naturalWorktreeIds = getNaturalWorktreeIds(rows)
  let currentSectionKey: string | undefined
  for (const row of rows) {
    if (row.type === 'header') {
      currentSectionKey = row.key
      groupIndexes.set(row.key, 0)
      continue
    }
    if (row.type === 'folder-workspace') {
      // Why: folder rows pass their folder key as the row key on pointer down.
      const rowKey = folderWorkspaceKey(row.folderWorkspace.id)
      const groupKey = getFolderWorkspaceDragGroupKeyForRow(row, currentSectionKey)
      const index = groupIndexes.get(groupKey) ?? 0
      groupKeyByRowKey.set(rowKey, groupKey)
      groupIndexByRowKey.set(rowKey, index)
      groupIndexes.set(groupKey, index + 1)
      continue
    }
    if (row.type !== 'item') {
      continue
    }
    if (row.sectionKey === PINNED_GROUP_KEY && naturalWorktreeIds.has(row.worktree.id)) {
      continue
    }
    const index = groupIndexes.get(row.sectionKey) ?? 0
    groupKeyByRowKey.set(row.rowKey, row.sectionKey)
    groupIndexByRowKey.set(row.rowKey, index)
    groupIndexes.set(row.sectionKey, index + 1)
  }
  return { groupKeyByRowKey, groupIndexByRowKey }
}
