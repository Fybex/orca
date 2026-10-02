import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { CommandHandler, HandlerContext } from '../dispatch'
import {
  formatFolderList,
  formatFolderRepos,
  formatFolderSet,
  formatFolderShow,
  printResult
} from '../format'
import type { FolderRepoWorktrees } from '../folder-format'
import { getOptionalStringFlag, getRepeatedStringFlag, getRequiredStringFlag } from '../flags'
import {
  listAttachedWorktrees,
  listProjectGroups,
  resolveFolderWorkspace,
  resolveProjectGroup
} from '../folder-workspace-selectors'
import { RuntimeClientError, type RuntimeRpcSuccess } from '../runtime-client'
import { addReposToFolder } from './folder-repo-worktrees'

type FolderWorkspaceList = { folderWorkspaces: FolderWorkspace[] }

// Why the list response: printResult reuses its envelope for the composed result.
async function resolveFolderFlag(
  ctx: HandlerContext
): Promise<{ response: RuntimeRpcSuccess<FolderWorkspaceList>; folderWorkspace: FolderWorkspace }> {
  const response = await ctx.client.call<FolderWorkspaceList>('folderWorkspace.list')
  const folderWorkspace = await resolveFolderWorkspace(
    response.result.folderWorkspaces,
    getRequiredStringFlag(ctx.flags, 'folder'),
    ctx.cwd,
    ctx.client
  )
  return { response, folderWorkspace }
}

function getRequiredRepoSelectors(flags: Map<string, string | boolean>): string[] {
  const repos = getRepeatedStringFlag(flags, 'repo')
  if (repos.length === 0) {
    throw new RuntimeClientError('invalid_argument', 'Missing required --repo')
  }
  return repos
}

function printFolderRepos(
  response: RuntimeRpcSuccess<unknown>,
  json: boolean,
  folderWorkspace: FolderWorkspace,
  added: FolderRepoWorktrees
): void {
  printResult({ ...response, result: { folderWorkspace, ...added } }, json, formatFolderRepos)
  if (added.failures.length > 0) {
    process.exitCode = 1
  }
}

export const FOLDER_HANDLERS: Record<string, CommandHandler> = {
  'folder list': async ({ flags, client, json }) => {
    const groups = await listProjectGroups(client)
    const groupSelector = getOptionalStringFlag(flags, 'group')
    const group = groupSelector ? resolveProjectGroup(groups, groupSelector) : null
    const response = await client.call<FolderWorkspaceList>('folderWorkspace.list')
    const folderWorkspaces = response.result.folderWorkspaces.filter(
      (folderWorkspace) => !group || folderWorkspace.projectGroupId === group.id
    )
    printResult({ ...response, result: { folderWorkspaces } }, json, (value) =>
      formatFolderList(value, groups)
    )
  },
  'folder show': async (ctx) => {
    const { response, folderWorkspace } = await resolveFolderFlag(ctx)
    const worktrees = await listAttachedWorktrees(ctx.client, folderWorkspace)
    const projectGroup =
      (await listProjectGroups(ctx.client)).find(
        (group) => group.id === folderWorkspace.projectGroupId
      ) ?? null
    printResult(
      { ...response, result: { folderWorkspace, projectGroup, worktrees } },
      ctx.json,
      formatFolderShow
    )
  },
  'folder create': async ({ flags, client, json }) => {
    const groupSelector = getRequiredStringFlag(flags, 'group')
    const name = getRequiredStringFlag(flags, 'name')
    const feature = flags.get('feature') === true
    const repos = getRepeatedStringFlag(flags, 'repo')
    const group = resolveProjectGroup(await listProjectGroups(client), groupSelector)
    const response = await client.call<{ folderWorkspace: FolderWorkspace }>(
      'folderWorkspace.create',
      { projectGroupId: group.id, name, ...(feature ? { featureFolder: true } : {}) }
    )
    const { folderWorkspace } = response.result
    // Why: a host that predates featureFolder drops it and roots the workspace at the group.
    if (feature && folderWorkspace.folderPath === group.parentPath) {
      console.error(
        'warning: this Orca host does not support --feature; the folder workspace uses the project group folder. Update Orca on the host.'
      )
    }
    const added = await addReposToFolder(client, folderWorkspace, repos)
    printFolderRepos(response, json, folderWorkspace, added)
  },
  'folder add-repo': async (ctx) => {
    const repos = getRequiredRepoSelectors(ctx.flags)
    const { response, folderWorkspace } = await resolveFolderFlag(ctx)
    const added = await addReposToFolder(
      ctx.client,
      folderWorkspace,
      repos,
      await listAttachedWorktrees(ctx.client, folderWorkspace)
    )
    printFolderRepos(response, ctx.json, folderWorkspace, added)
  },
  'folder set': async (ctx) => {
    const updates = {
      name: getOptionalStringFlag(ctx.flags, 'name'),
      comment: getOptionalStringFlag(ctx.flags, 'comment'),
      workspaceStatus: getOptionalStringFlag(ctx.flags, 'workspace-status')
    }
    if (Object.values(updates).every((value) => value === undefined)) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Nothing to update. Pass --name, --comment, or --workspace-status.'
      )
    }
    const { folderWorkspace } = await resolveFolderFlag(ctx)
    const response = await ctx.client.call<{ folderWorkspace: FolderWorkspace | null }>(
      'folderWorkspace.update',
      { folderWorkspaceId: folderWorkspace.id, updates }
    )
    const updated = response.result.folderWorkspace
    if (!updated) {
      throw new RuntimeClientError(
        'selector_not_found',
        `Folder workspace folder:${folderWorkspace.id} no longer exists.`
      )
    }
    printResult({ ...response, result: { folderWorkspace: updated } }, ctx.json, formatFolderSet)
  },
  'folder rm': async (ctx) => {
    const { folderWorkspace } = await resolveFolderFlag(ctx)
    const response = await ctx.client.call<{ deleted: boolean }>('folderWorkspace.delete', {
      folderWorkspaceId: folderWorkspace.id
    })
    printResult(response, ctx.json, (value) => `removed: ${value.deleted}`)
  }
}
