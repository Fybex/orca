import type { FolderWorkspace, WorkspaceKey } from '../shared/folder-workspace-types'
import type { ProjectGroup } from '../shared/project-group-types'
import type { RuntimeWorktreeListResult, RuntimeWorktreeRecord } from '../shared/runtime-types'
import type { WorkspaceLineage } from '../shared/worktree/lineage-types'
import type { Worktree } from '../shared/worktree/types'
import { getFolderWorkspaceParentKeys } from '../shared/worktree/folder-workspace-parent'
import { folderWorkspaceKey, parseWorkspaceKey } from '../shared/workspace-scope'
import { RuntimeClientError, type RuntimeClient } from './runtime-client'
import { resolveCurrentWorktreeSelector } from './selectors'

const FOLDER_SELECTOR_FORMS = 'id:<folderId>, folder:<folderId>, name:<name>, or active/current'
const FOLDER_LIST_HINT = 'Run `orca folder list` to see folder selectors.'

export async function listProjectGroups(client: RuntimeClient): Promise<ProjectGroup[]> {
  return (await client.call<{ groups: ProjectGroup[] }>('projectGroup.list')).result.groups
}

function pickOne<T extends { id: string }>(matches: readonly T[], what: string, hint: string): T {
  const [match] = matches
  if (matches.length > 1) {
    throw new RuntimeClientError(
      'selector_ambiguous',
      `${what} matches ${matches.length} entries: ${matches.map((entry) => entry.id).join(', ')}. Pass an id instead.`
    )
  }
  if (!match) {
    throw new RuntimeClientError('selector_not_found', `${what} matches nothing. ${hint}`)
  }
  return match
}

/** A project group by exact id, else by exact name. */
export function resolveProjectGroup(
  groups: readonly ProjectGroup[],
  selector: string
): ProjectGroup {
  return (
    groups.find((group) => group.id === selector) ??
    pickOne(
      groups.filter((group) => group.name === selector),
      `Project group "${selector}"`,
      `Groups: ${groups.map((group) => `${group.name} (${group.id})`).join(', ') || 'none'}.`
    )
  )
}

/** Folder parent of each worktree, read from the host's workspace lineage. */
async function getFolderParentKeys(
  client: RuntimeClient,
  worktrees: readonly Pick<Worktree, 'id' | 'instanceId'>[],
  folderWorkspaces: readonly Pick<FolderWorkspace, 'id'>[]
): Promise<Map<string, WorkspaceKey>> {
  // Why lineageList: hosts that predate `parentWorkspaceKey` on worktree rows still answer it.
  const { workspaceLineage } = (
    await client.call<{ workspaceLineage: Record<string, WorkspaceLineage> }>(
      'worktree.lineageList'
    )
  ).result
  return getFolderWorkspaceParentKeys(worktrees, workspaceLineage, folderWorkspaces)
}

export async function listAttachedWorktrees(
  client: RuntimeClient,
  folderWorkspace: FolderWorkspace
): Promise<RuntimeWorktreeRecord[]> {
  const { worktrees } = (
    await client.call<RuntimeWorktreeListResult>('worktree.list', { limit: 10_000 })
  ).result
  const parentKeys = await getFolderParentKeys(client, worktrees, [folderWorkspace])
  const key = folderWorkspaceKey(folderWorkspace.id)
  return worktrees.filter((worktree) => parentKeys.get(worktree.id) === key)
}

async function resolveCurrentWorktreeId(cwd: string, client: RuntimeClient): Promise<string> {
  try {
    // `id:<worktreeId>`, where a folder workspace's worktree id is `folder:<id>`.
    return (await resolveCurrentWorktreeSelector(cwd, client)).slice('id:'.length)
  } catch (error) {
    if (error instanceof RuntimeClientError && error.code === 'selector_not_found') {
      throw new RuntimeClientError(
        'selector_not_found',
        `No folder workspace or Orca worktree contains the current directory. ${FOLDER_LIST_HINT}`
      )
    }
    throw error
  }
}

/** This terminal's folder workspace, else the folder or attached worktree enclosing `cwd`. */
async function resolveCurrentFolderWorkspaceId(
  cwd: string,
  client: RuntimeClient,
  folderWorkspaces: readonly FolderWorkspace[]
): Promise<string> {
  if (client.isRemote) {
    throw new RuntimeClientError(
      'invalid_argument',
      'active/current is a local shortcut and cannot be resolved against a remote runtime. Pass id:<folderId> or name:<name>.'
    )
  }
  const terminalScope = parseWorkspaceKey(process.env.ORCA_WORKSPACE_ID?.trim() ?? '')
  if (terminalScope?.type === 'folder') {
    return terminalScope.folderWorkspaceId
  }
  const worktreeId = await resolveCurrentWorktreeId(cwd, client)
  const scope = parseWorkspaceKey(worktreeId)
  if (scope?.type === 'folder') {
    return scope.folderWorkspaceId
  }
  const { worktree } = (
    await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
      worktree: `id:${worktreeId}`
    })
  ).result
  const parent = parseWorkspaceKey(
    (await getFolderParentKeys(client, [worktree], folderWorkspaces)).get(worktree.id) ?? ''
  )
  if (parent?.type !== 'folder') {
    throw new RuntimeClientError(
      'selector_not_found',
      `The current directory is not in a folder workspace: ${worktree.path}`
    )
  }
  return parent.folderWorkspaceId
}

function parseFolderWorkspaceId(selector: string): string {
  // Why id:folder:<id>: worktree selectors name a folder workspace that way.
  const raw = selector.startsWith('id:') ? selector.slice('id:'.length) : selector
  const scope = parseWorkspaceKey(raw)
  if (scope?.type === 'folder') {
    return scope.folderWorkspaceId
  }
  if (selector.startsWith('id:') && raw.length > 0 && !scope) {
    return raw
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `Unknown folder selector "${selector}". Use ${FOLDER_SELECTOR_FORMS}.`
  )
}

export async function resolveFolderWorkspace(
  folderWorkspaces: readonly FolderWorkspace[],
  selector: string,
  cwd: string,
  client: RuntimeClient
): Promise<FolderWorkspace> {
  if (selector.startsWith('name:')) {
    const name = selector.slice('name:'.length)
    return pickOne(
      folderWorkspaces.filter((folderWorkspace) => folderWorkspace.name === name),
      `Folder selector ${selector}`,
      FOLDER_LIST_HINT
    )
  }
  const id =
    selector === 'active' || selector === 'current'
      ? await resolveCurrentFolderWorkspaceId(cwd, client, folderWorkspaces)
      : parseFolderWorkspaceId(selector)
  return pickOne(
    folderWorkspaces.filter((folderWorkspace) => folderWorkspace.id === id),
    `Folder selector ${selector}`,
    FOLDER_LIST_HINT
  )
}
