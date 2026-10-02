import { mkdir, mkdtemp, readdir, rm, stat, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeProjectGroupController } from './runtime-project-group-controller'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import { FolderWorkspaceCreate } from '../../shared/rpc-contract/folder-workspace-params'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'orca-feature-runtime-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

function createController(options: { groupConnectionId?: string | null } = {}) {
  const workspaces: FolderWorkspace[] = []
  const createFolderWorkspace = vi.fn((input: { folderPath?: string | null }) => {
    const workspace: FolderWorkspace = {
      id: `fw-${workspaces.length + 1}`,
      projectGroupId: 'g-1',
      name: 'Feature',
      folderPath: input.folderPath ?? join(dir, 'group'),
      connectionId: null,
      linkedTask: null,
      comment: '',
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0,
      createdAt: 0,
      updatedAt: 0
    }
    workspaces.push(workspace)
    return workspace
  })
  const store = {
    getProjectGroups: () => [
      {
        id: 'g-1',
        name: 'Group',
        parentPath: join(dir, 'group'),
        connectionId: options.groupConnectionId ?? null
      }
    ],
    getRepos: () => [],
    getSettings: () => ({ workspaceDir: join(dir, 'workspaces') }),
    getFolderWorkspaces: () => workspaces,
    createFolderWorkspace,
    removeFolderWorkspace: (id: string) => {
      const index = workspaces.findIndex((workspace) => workspace.id === id)
      return index !== -1 && workspaces.splice(index, 1).length === 1
    }
  }
  const controller = new RuntimeProjectGroupController({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: folder create/delete read only the stubbed store methods.
    getStore: () => store as never,
    resolveRepo: async () => {
      throw new Error('unused')
    },
    notifyReposChanged: vi.fn(),
    resolveFolderConnectionId: () => null,
    teardownFolderWorkspacePtys: vi.fn(async () => undefined),
    cleanupRemovedFolderWorkspaceState: vi.fn()
  })
  return { controller, createFolderWorkspace, workspaces }
}

describe('RuntimeProjectGroupController feature folders', () => {
  it('keeps featureFolder when the RPC params are parsed', () => {
    expect(
      FolderWorkspaceCreate.parse({
        projectGroupId: 'g-1',
        featureFolder: true
      })
    ).toEqual({
      projectGroupId: 'g-1',
      featureFolder: true
    })
  })

  it('creates a feature workspace in its own folder beside the worktrees directory', async () => {
    await mkdir(join(dir, 'group'), { recursive: true })
    const { controller, createFolderWorkspace } = createController()

    await controller.createFolderWorkspace({
      projectGroupId: 'g-1',
      name: 'Checkout flow',
      featureFolder: true
    })
    await controller.createFolderWorkspace({
      projectGroupId: 'g-1',
      name: 'Checkout flow',
      featureFolder: true
    })

    const first = join(dir, 'features', 'checkout-flow')
    expect(createFolderWorkspace.mock.calls.map(([input]) => input.folderPath)).toEqual([
      first,
      `${first}-2`
    ])
    expect((await stat(first)).isDirectory()).toBe(true)
    expect(createFolderWorkspace.mock.calls[0]?.[0]).not.toHaveProperty('featureFolder')
  })

  it('refuses a feature folder for an SSH group without creating anything', async () => {
    const { controller, createFolderWorkspace } = createController({
      groupConnectionId: 'ssh-box'
    })

    await expect(
      controller.createFolderWorkspace({
        projectGroupId: 'g-1',
        name: 'Remote',
        featureFolder: true
      })
    ).rejects.toThrow('feature_folder_requires_local_group')
    expect(createFolderWorkspace).not.toHaveBeenCalled()
    expect(await exists(join(dir, 'features'))).toBe(false)
  })

  it('removes the feature folder and its links on delete, but never a plain folder', async () => {
    const worktree = join(dir, 'workspaces', 'api', 'checkout-flow')
    await mkdir(worktree, { recursive: true })
    await mkdir(join(dir, 'group'), { recursive: true })
    const { controller } = createController()
    const feature = await controller.createFolderWorkspace({
      projectGroupId: 'g-1',
      name: 'Checkout flow',
      featureFolder: true
    })
    const plain = await controller.createFolderWorkspace({
      projectGroupId: 'g-1',
      name: 'Plain'
    })
    await symlink(worktree, join(feature.folderPath, 'api'))

    await expect(controller.deleteFolderWorkspace(feature.id)).resolves.toEqual({ deleted: true })
    await expect(controller.deleteFolderWorkspace(plain.id)).resolves.toEqual({
      deleted: true
    })

    expect(await exists(feature.folderPath)).toBe(false)
    expect(await readdir(worktree)).toEqual([])
    expect(await exists(join(dir, 'group'))).toBe(true)
  })
})
