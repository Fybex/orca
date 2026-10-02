import type { FolderWorkspace } from '../shared/folder-workspace-types'
import type { ProjectGroup } from '../shared/project-group-types'
import type { RuntimeWorktreeRecord } from '../shared/runtime-types'

export type FolderShowResult = {
  folderWorkspace: FolderWorkspace
  projectGroup: ProjectGroup | null
  worktrees: RuntimeWorktreeRecord[]
}

export type FolderRepoWorktrees = {
  worktrees: RuntimeWorktreeRecord[]
  skipped: { repo: string; worktreeId: string }[]
  failures: { repo: string; code: string; message: string }[]
}

export type FolderReposResult = FolderRepoWorktrees & { folderWorkspace: FolderWorkspace }

function formatFolderLine(folderWorkspace: FolderWorkspace): string {
  return `folder:${folderWorkspace.id}  ${folderWorkspace.name}  ${folderWorkspace.folderPath}${folderWorkspace.isArchived ? '  archived' : ''}`
}

function formatWorktreeLine(worktree: RuntimeWorktreeRecord): string {
  const branch = worktree.branch.replace(/^refs\/heads\//, '') || 'detached'
  return `  ${worktree.displayName || branch}  ${branch}  id:${worktree.id}`
}

function formatFolderMetadata(folderWorkspace: FolderWorkspace): string[] {
  return [
    `workspaceStatus: ${folderWorkspace.workspaceStatus ?? 'none'}`,
    `comment: ${folderWorkspace.comment}`
  ]
}

export function formatFolderList(
  result: { folderWorkspaces: FolderWorkspace[] },
  groups: readonly ProjectGroup[]
): string {
  if (result.folderWorkspaces.length === 0) {
    return 'No folder workspaces found.'
  }
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]))
  return result.folderWorkspaces
    .map(
      (folderWorkspace) =>
        `${formatFolderLine(folderWorkspace)}\ngroup: ${groupNameById.get(folderWorkspace.projectGroupId) ?? folderWorkspace.projectGroupId}`
    )
    .join('\n\n')
}

export function formatFolderShow(result: FolderShowResult): string {
  const { folderWorkspace } = result
  return [
    formatFolderLine(folderWorkspace),
    `group: ${result.projectGroup?.name ?? folderWorkspace.projectGroupId}`,
    ...formatFolderMetadata(folderWorkspace),
    result.worktrees.length === 0 ? 'worktrees: none' : 'worktrees:',
    ...result.worktrees.map(formatWorktreeLine)
  ].join('\n')
}

export function formatFolderSet(result: { folderWorkspace: FolderWorkspace }): string {
  return [
    formatFolderLine(result.folderWorkspace),
    ...formatFolderMetadata(result.folderWorkspace)
  ].join('\n')
}

export function formatFolderRepos(result: FolderReposResult): string {
  return [
    formatFolderLine(result.folderWorkspace),
    ...result.worktrees.map((worktree) => `created:${formatWorktreeLine(worktree)}`),
    ...result.skipped.map(
      (entry) => `skipped: ${entry.repo} already has an attached worktree, id:${entry.worktreeId}`
    ),
    ...result.failures.map((entry) => `failed: ${entry.repo}: ${entry.message}`)
  ].join('\n')
}
