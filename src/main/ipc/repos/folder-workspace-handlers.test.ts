import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, args: unknown) => unknown>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, args: unknown) => unknown) => {
      handlers.set(channel, handler)
    }
  }
}))
vi.mock('./repos-changed-notification', () => ({ notifyReposChanged: vi.fn() }))
vi.mock('../../feature-folders/feature-folder-sync-scheduler', () => ({
  scheduleFeatureFolderSync: vi.fn(),
  startFeatureFolderSync: vi.fn()
}))

import { registerFolderWorkspaceHandlers } from './folder-workspace-handlers'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'orca-feature-handler-'))
  handlers.clear()
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function register(group: { connectionId?: string | null }) {
  const createFolderWorkspace = vi.fn((input: { folderPath?: string | null }) => ({
    id: 'fw-1',
    folderPath: input.folderPath
  }))
  const store = {
    getProjectGroups: () => [
      { id: 'g-1', name: 'Group', parentPath: join(dir, 'group'), connectionId: null, ...group }
    ],
    getRepos: () => [],
    getSettings: () => ({ workspaceDir: join(dir, 'workspaces') }),
    getFolderWorkspaces: () => [],
    createFolderWorkspace
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: create only reads the stubbed store methods; window and runtime are unused there.
  registerFolderWorkspaceHandlers({} as never, store as never, {} as never)
  const create = handlers.get('folderWorkspaces:create')
  if (!create) {
    throw new Error('folderWorkspaces:create was not registered')
  }
  return { createFolderWorkspace, create }
}

describe('folderWorkspaces:create with featureFolder', () => {
  it('creates the workspace in its own folder beside the worktrees directory', async () => {
    const { create, createFolderWorkspace } = register({})

    await create({}, { projectGroupId: 'g-1', name: 'Risk score', featureFolder: true })

    const expected = join(dir, 'features', 'risk-score')
    expect((await stat(expected)).isDirectory()).toBe(true)
    expect(createFolderWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ folderPath: expected })
    )
    expect(createFolderWorkspace.mock.calls[0]?.[0]).not.toHaveProperty('featureFolder')
  })

  it('refuses a feature folder for an SSH group', async () => {
    const { create, createFolderWorkspace } = register({ connectionId: 'ssh-box' })

    await expect(
      create({}, { projectGroupId: 'g-1', name: 'Remote', featureFolder: true })
    ).rejects.toThrow('feature_folder_requires_local_group')
    expect(createFolderWorkspace).not.toHaveBeenCalled()
  })
})
