import type { RuntimeRepoList } from '../../shared/runtime-types'
import { parseWorkspaceKey } from '../../shared/workspace-scope'
import { listAttachedWorktrees } from '../folder-workspace-selectors'
import { RuntimeClientError, type RuntimeClient } from '../runtime-client'
import { resolveProjectCreateRepoSelector } from '../worktree-project-target'

type CreateRepoSelectorArgs = {
  flags: Map<string, string | boolean>
  client: RuntimeClient
  explicitRepo: string | undefined
  cwdParentWorktree: string | undefined
  parentWorkspace: string | undefined
}

function getRepoSelectorFromWorktreeSelector(selector: string | undefined): string | undefined {
  if (!selector?.startsWith('id:')) {
    return undefined
  }
  const worktreeId = selector.slice('id:'.length)
  const separatorIndex = worktreeId.indexOf('::')
  if (separatorIndex <= 0) {
    return undefined
  }
  return `id:${worktreeId.slice(0, separatorIndex)}`
}

/** Distinct repos of the worktrees attached to a `folder:<id>` parent, or none for other parents. */
async function getFolderParentRepoIds(
  client: RuntimeClient,
  parentWorkspace: string | undefined
): Promise<string[]> {
  const parent = parentWorkspace ? parseWorkspaceKey(parentWorkspace) : null
  if (parent?.type !== 'folder') {
    return []
  }
  const attached = await listAttachedWorktrees(client, { id: parent.folderWorkspaceId })
  return [...new Set(attached.map((worktree) => worktree.repoId))]
}

async function formatFolderRepoChoices(client: RuntimeClient, repoIds: string[]): Promise<string> {
  const { repos } = (await client.call<RuntimeRepoList>('repo.list')).result
  return repoIds
    .map((repoId) => {
      const name = repos.find((repo) => repo.id === repoId)?.displayName
      return name ? `${name} (id:${repoId})` : `id:${repoId}`
    })
    .join(', ')
}

export async function resolveCreateRepoSelector({
  flags,
  client,
  explicitRepo,
  cwdParentWorktree,
  parentWorkspace
}: CreateRepoSelectorArgs): Promise<string> {
  const projectRepoSelector = await resolveProjectCreateRepoSelector(flags, client)
  if (projectRepoSelector) {
    return projectRepoSelector
  }
  if (explicitRepo) {
    return explicitRepo
  }
  const inferredRepo = getRepoSelectorFromWorktreeSelector(cwdParentWorktree)
  const folderRepoIds = await getFolderParentRepoIds(client, parentWorkspace)
  if (folderRepoIds.length === 1) {
    return `id:${folderRepoIds[0]}`
  }
  if (folderRepoIds.length > 1) {
    // Why: inside one of the folder's repos, the cwd names which one the caller means.
    if (inferredRepo && folderRepoIds.includes(inferredRepo.slice('id:'.length))) {
      return inferredRepo
    }
    throw new RuntimeClientError(
      'invalid_argument',
      `The folder workspace links several repos: ${await formatFolderRepoChoices(client, folderRepoIds)}. Pass --repo to choose one.`
    )
  }
  if (inferredRepo) {
    return inferredRepo
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'Missing repo selector. Pass --repo or run from inside an Orca-managed worktree.'
  )
}
