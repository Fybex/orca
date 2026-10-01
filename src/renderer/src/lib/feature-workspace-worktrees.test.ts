import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))

import { getFeatureRepoIds } from './feature-workspace-worktrees'
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
