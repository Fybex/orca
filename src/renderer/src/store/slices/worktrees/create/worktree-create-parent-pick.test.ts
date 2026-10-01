import { describe, expect, it, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

import { resolveWorktreeCreateParent } from './worktree-create-parent-pick'
import type { AppState } from '../../../types'

function state(folderIds: string[], activeWorkspaceKey: string | null = null): AppState {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resolver reads only these three fields.
  return {
    folderWorkspaces: folderIds.map((id) => ({ id })),
    worktreesByRepo: {},
    activeWorkspaceKey
  } as unknown as AppState
}

describe('resolveWorktreeCreateParent with a folder workspace pick', () => {
  it('attaches to the picked folder workspace even when another one is active', () => {
    expect(
      resolveWorktreeCreateParent(state(['fw-1', 'fw-2'], 'folder:fw-2'), 'repo-1', 'folder:fw-1')
    ).toMatchObject({ parentWorkspace: 'folder:fw-1', staleBeforeCreate: false })
  })

  it('drops a pick whose folder workspace no longer exists', () => {
    expect(resolveWorktreeCreateParent(state([]), 'repo-1', 'folder:gone')).toEqual({
      pickedDisplayName: null,
      staleBeforeCreate: true
    })
  })
})
