import { describe, expect, it } from 'vitest'
import { buildRuntimeWorktreePsSummaries } from './runtime-worktree-ps-summaries'
import type { ResolvedWorktree } from './runtime-worktree-path-identity'
import type { RuntimeStore } from './runtime-store-contract'

describe('buildRuntimeWorktreePsSummaries', () => {
  it('preserves persisted host ownership over the resolved row fallback', () => {
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      hostId: 'ssh:resolved-host',
      path: '/workspace/app',
      branch: 'feature',
      isArchived: false,
      isMainWorktree: false,
      parentWorktreeId: null,
      childWorktreeIds: [],
      lineage: null,
      lastActivityAt: 0
    } as unknown as ResolvedWorktree
    const store = {
      getRepos: () => [],
      getWorktreeMeta: () => ({ hostId: 'ssh:persisted-host' }),
      getAllWorktreeMeta: () => ({}),
      getFolderWorkspaces: () => [],
      getProjectGroups: () => []
    } as unknown as RuntimeStore

    const summary = buildRuntimeWorktreePsSummaries({
      store,
      resolvedWorktrees: [worktree],
      platformByRepoId: new Map()
    }).get(worktree.id)

    expect(summary?.hostId).toBe('ssh:persisted-host')
  })

  it('links attached worktrees and their folder workspace through workspace lineage', () => {
    const attached = (id: string, instanceId: string) => ({
      id,
      instanceId,
      repoId: 'repo-1',
      path: id.split('::')[1],
      branch: 'checkout-flow',
      isArchived: false,
      isMainWorktree: false,
      parentWorktreeId: null,
      childWorktreeIds: [],
      lineage: null,
      lastActivityAt: 0
    })
    const lineage = (worktreeId: string, childInstanceId: string) => ({
      childWorkspaceKey: `worktree:${worktreeId}`,
      childInstanceId,
      parentWorkspaceKey: 'folder:fw-1',
      parentInstanceId: null,
      origin: 'manual',
      capture: { source: 'manual-action', confidence: 'explicit' },
      createdAt: 1
    })
    const store = {
      getRepos: () => [],
      getWorktreeMeta: () => undefined,
      getAllWorktreeMeta: () => ({}),
      getAllWorkspaceLineage: () => ({
        'worktree:repo-1::/w/api': lineage('repo-1::/w/api', 'api-1'),
        'worktree:repo-1::/w/stale': lineage('repo-1::/w/stale', 'old-instance')
      }),
      getFolderWorkspaces: () => [
        { id: 'fw-1', projectGroupId: 'g-1', name: 'Checkout', folderPath: '/f/checkout', comment: '' }
      ],
      getProjectGroups: () => [{ id: 'g-1', name: 'Group', parentPath: '/g' }]
    }

    const rows = [attached('repo-1::/w/api', 'api-1'), attached('repo-1::/w/stale', 'new-instance')]

    const summaries = buildRuntimeWorktreePsSummaries({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the builder reads only the stubbed store methods.
      store: store as unknown as RuntimeStore,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: rows carry every field the builder reads.
      resolvedWorktrees: rows as unknown as ResolvedWorktree[],
      platformByRepoId: new Map()
    })

    expect(summaries.get('repo-1::/w/api')?.parentWorkspaceKey).toBe('folder:fw-1')
    expect(summaries.get('repo-1::/w/stale')?.parentWorkspaceKey).toBeNull()
    expect(summaries.get('folder:fw-1')?.childWorkspaceKeys).toEqual(['worktree:repo-1::/w/api'])
  })
})
