import { describe, expect, it, vi } from 'vitest'
import type { Worktree } from '../../shared/worktree/types'
import { updateRuntimeManagedWorktreeMetadata } from './runtime-managed-worktree-metadata'
import type { ResolvedWorktree } from './runtime-worktree-path-identity'
import type { RuntimeStore } from './runtime-store-contract'

describe('updateRuntimeManagedWorktreeMetadata', () => {
  it('writes metadata through the resolved worktree execution host', async () => {
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      hostId: 'ssh:build-box',
      path: '/workspace/app',
      instanceId: 'instance-1'
    } as unknown as ResolvedWorktree
    const setWorktreeMeta = vi.fn()
    const setWorktreeMetaForHost = vi.fn()
    const store = { setWorktreeMeta, setWorktreeMetaForHost } as unknown as RuntimeStore
    const ports = {
      resolveWorktree: vi.fn(async () => worktree),
      validateParent: vi.fn(),
      invalidateResolved: vi.fn(),
      invalidateScan: vi.fn(),
      notifyChanged: vi.fn(),
      showWorktree: vi.fn(async () => worktree as unknown as Worktree)
    }

    await updateRuntimeManagedWorktreeMetadata({
      selector: `id:${worktree.id}`,
      updates: { comment: 'remote row only' },
      store,
      ports
    })

    expect(setWorktreeMetaForHost).toHaveBeenCalledWith(worktree.id, 'ssh:build-box', {
      comment: 'remote row only'
    })
    expect(setWorktreeMeta).not.toHaveBeenCalled()
  })

  function makeFolderParentFixture(folderIds: string[]) {
    const worktree = {
      id: 'repo-1::/workspace/app',
      repoId: 'repo-1',
      path: '/workspace/app',
      instanceId: 'instance-1'
    } as unknown as ResolvedWorktree
    const store = {
      setWorktreeMeta: vi.fn(),
      getFolderWorkspaces: vi.fn(() => folderIds.map((id) => ({ id }))),
      removeWorktreeLineage: vi.fn(),
      setWorkspaceLineage: vi.fn()
    }
    const ports = {
      resolveWorktree: vi.fn(async () => worktree),
      validateParent: vi.fn(),
      invalidateResolved: vi.fn(),
      invalidateScan: vi.fn(),
      notifyChanged: vi.fn(),
      showWorktree: vi.fn(async () => worktree as unknown as Worktree)
    }
    return { worktree, store, ports }
  }

  it('attaches a worktree to a folder workspace parent', async () => {
    const { worktree, store, ports } = makeFolderParentFixture(['folder-1'])

    await updateRuntimeManagedWorktreeMetadata({
      selector: `id:${worktree.id}`,
      updates: { lineage: { parentWorktree: 'folder:folder-1' } },
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the updater only calls the folder and lineage methods this fixture stubs.
      store: store as unknown as RuntimeStore,
      ports
    })

    expect(ports.resolveWorktree).toHaveBeenCalledTimes(1)
    expect(store.removeWorktreeLineage).toHaveBeenCalledWith(worktree.id)
    expect(store.setWorkspaceLineage).toHaveBeenCalledWith(
      expect.objectContaining({
        childWorkspaceKey: `worktree:${worktree.id}`,
        childInstanceId: 'instance-1',
        parentWorkspaceKey: 'folder:folder-1',
        parentInstanceId: null,
        origin: 'manual'
      })
    )
  })

  it('rejects an unknown folder workspace parent', async () => {
    const { worktree, store, ports } = makeFolderParentFixture([])

    await expect(
      updateRuntimeManagedWorktreeMetadata({
        selector: `id:${worktree.id}`,
        updates: { lineage: { parentWorktree: 'id:folder:missing' } },
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the updater only calls the folder and lineage methods this fixture stubs.
        store: store as unknown as RuntimeStore,
        ports
      })
    ).rejects.toMatchObject({ code: 'LINEAGE_PARENT_NOT_FOUND' })
    expect(store.setWorkspaceLineage).not.toHaveBeenCalled()
  })
})
