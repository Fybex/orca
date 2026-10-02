import { describe, expect, it, vi } from 'vitest'

const { createWorktree } = vi.hoisted(() => ({ createWorktree: vi.fn() }))
vi.mock('@/store', () => ({ useAppStore: { getState: () => ({ createWorktree }) } }))

import { addReposToFeature, getFeatureRepoIds } from './feature-workspace-worktrees'
import { repo as repoFixture } from '../components/sidebar/worktree-list-groups-test-fixtures'
import type { WorkspaceLineage } from '../../../shared/worktree/lineage-types'
import type { WorkspaceKey } from '../../../shared/folder-workspace-types'

function lineage(child: WorkspaceKey, parent: WorkspaceKey): WorkspaceLineage {
  return {
    childWorkspaceKey: child,
    parentWorkspaceKey: parent,
    origin: 'manual',
    capture: { source: 'manual-action', confidence: 'explicit' },
    createdAt: 1
  }
}

describe('getFeatureRepoIds', () => {
  it('collects the repos of worktrees attached to the folder workspace only', () => {
    const repoIds = getFeatureRepoIds('fw-1', {
      a: lineage('worktree:repo-api::/wt/api/feat', 'folder:fw-1'),
      b: lineage('worktree:repo-web::/wt/web/feat', 'folder:fw-1'),
      c: lineage('worktree:repo-docs::/wt/docs/feat', 'folder:fw-2'),
      d: lineage('worktree:repo-ops::/wt/ops/child', 'worktree:repo-ops::/wt/ops/parent')
    })
    expect([...repoIds].sort()).toEqual(['repo-api', 'repo-web'])
  })
})

describe('addReposToFeature', () => {
  it('puts each repo worktree on the feature branch with the ticket key case kept', async () => {
    const repo = { ...repoFixture, id: 'repo-api', displayName: 'api' }

    await addReposToFeature({ id: 'fw-1', name: 'ABC-1234 checkout flow' }, [repo])

    const args = createWorktree.mock.calls[0] ?? []
    const [repoId, branchName] = args
    expect(repoId).toBe('repo-api')
    expect(branchName).toBe('ABC-1234-checkout-flow')
    // The trailing options object carries the folder attachment.
    expect(args.at(-1)).toMatchObject({ parentWorktreeId: 'folder:fw-1' })
  })
})
