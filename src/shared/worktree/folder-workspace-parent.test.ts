import { describe, expect, it } from 'vitest'
import type { WorkspaceLineage } from './lineage-types'
import {
  getFolderWorkspaceChildKeys,
  getFolderWorkspaceParentKeys
} from './folder-workspace-parent'

function lineage(
  childWorkspaceKey: WorkspaceLineage['childWorkspaceKey'],
  parentWorkspaceKey: WorkspaceLineage['parentWorkspaceKey'],
  childInstanceId: string | null
): WorkspaceLineage {
  return {
    childWorkspaceKey,
    childInstanceId,
    parentWorkspaceKey,
    parentInstanceId: null,
    origin: 'cli',
    capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
    createdAt: 1
  }
}

describe('getFolderWorkspaceParentKeys', () => {
  const lineageByChildKey = Object.fromEntries(
    [
      lineage('worktree:api::/w/api', 'folder:fw-1', 'api-1'),
      lineage('worktree:web::/w/web', 'folder:fw-1', null),
      lineage('worktree:api::/w/reused', 'folder:fw-1', 'gone'),
      lineage('worktree:api::/w/orphan', 'folder:deleted', 'orphan-1'),
      lineage('worktree:api::/w/child', 'worktree:api::/w/api', 'child-1')
    ].map((entry) => [entry.childWorkspaceKey, entry])
  )
  const worktrees = [
    { id: 'api::/w/api', instanceId: 'api-1' },
    { id: 'web::/w/web', instanceId: 'web-1' },
    { id: 'api::/w/reused', instanceId: 'reused-2' },
    { id: 'api::/w/orphan', instanceId: 'orphan-1' },
    { id: 'api::/w/child', instanceId: 'child-1' }
  ]

  it('keeps only live folder parents', () => {
    const parents = getFolderWorkspaceParentKeys(worktrees, lineageByChildKey, [{ id: 'fw-1' }])

    expect(Object.fromEntries(parents)).toEqual({
      'api::/w/api': 'folder:fw-1',
      'web::/w/web': 'folder:fw-1'
    })
    expect(Object.fromEntries(getFolderWorkspaceChildKeys(parents))).toEqual({
      'folder:fw-1': ['worktree:api::/w/api', 'worktree:web::/w/web']
    })
  })
})
