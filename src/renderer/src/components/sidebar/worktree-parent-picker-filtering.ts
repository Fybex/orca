import { defaultFilter } from 'cmdk'
import { branchDisplayName } from './WorktreeCardHelpers'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Worktree } from '../../../../shared/worktree/types'

export type WorktreeParentPickerCandidate =
  | { kind: 'folder'; id: string; folder: FolderWorkspace }
  | { kind: 'worktree'; id: string; worktree: Worktree }

export function getWorktreeParentPickerItemValue(candidate: Worktree): string {
  return `${candidate.displayName} ${branchDisplayName(candidate.branch)} ${candidate.path}`
}

// Why: a repo with hundreds of workspaces makes every eligible sibling a
// candidate, so the list is scored here rather than handed to cmdk — cmdk
// mounts, scores and DOM-reorders every registered item on each keystroke.
export function filterWorktreeParentCandidates(
  candidates: readonly Worktree[],
  search: string
): Worktree[] {
  return scoreAndSort(candidates, search, getWorktreeParentPickerItemValue)
}

function scoreAndSort<T>(items: readonly T[], search: string, getValue: (item: T) => string): T[] {
  const query = search.trim()
  if (!query) {
    return [...items]
  }
  return items
    .map((item) => ({ item, score: defaultFilter(getValue(item), query, []) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.item)
}

/** Folders lead the list: grouping under a folder is the common pick for stacked branches. */
export function filterParentPickerCandidates(
  folders: readonly FolderWorkspace[],
  worktrees: readonly Worktree[],
  search: string
): WorktreeParentPickerCandidate[] {
  return [
    ...scoreAndSort(folders, search, (folder) => `${folder.name} ${folder.folderPath}`).map(
      (folder): WorktreeParentPickerCandidate => ({
        kind: 'folder',
        id: folderWorkspaceKey(folder.id),
        folder
      })
    ),
    ...filterWorktreeParentCandidates(worktrees, search).map(
      (worktree): WorktreeParentPickerCandidate => ({
        kind: 'worktree',
        id: worktree.id,
        worktree
      })
    )
  ]
}

export function clampWorktreeParentPickerIndex(index: number, count: number): number {
  if (count <= 0) {
    return 0
  }
  return Math.min(Math.max(index, 0), count - 1)
}
