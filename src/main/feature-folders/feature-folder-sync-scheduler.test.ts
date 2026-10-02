import { mkdir, mkdtemp, readlink, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { WorkspaceLineage } from '../../shared/worktree/lineage-types'
import { runWorktreeChangeInvalidators } from '../ipc/worktree-change-invalidators'
import { startFeatureFolderSync } from './feature-folder-sync-scheduler'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'orca-feature-sync-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('startFeatureFolderSync', () => {
  it('links a worktree attached after start once a worktree change is reported', async () => {
    const worktree = join(dir, 'workspaces', 'api', 'checkout-flow')
    const featureFolder = join(dir, 'features', 'checkout-flow')
    await mkdir(worktree, { recursive: true })
    const lineage: Record<string, WorkspaceLineage> = {}
    const folder: FolderWorkspace = {
      id: 'fw-1',
      projectGroupId: 'g-1',
      name: 'Checkout flow',
      folderPath: featureFolder,
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
    startFeatureFolderSync({
      getSettings: () => ({ workspaceDir: join(dir, 'workspaces') }),
      getFolderWorkspaces: () => [folder],
      getRepos: () => [],
      getAllWorkspaceLineage: () => lineage
    })

    lineage[`worktree:api::${worktree}`] = {
      childWorkspaceKey: `worktree:api::${worktree}`,
      parentWorkspaceKey: 'folder:fw-1',
      origin: 'cli',
      capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
      createdAt: 1
    }
    runWorktreeChangeInvalidators('api')

    await expect
      .poll(() => readlink(join(featureFolder, 'api')).catch(() => null), { timeout: 5000 })
      .toBe(worktree)
  })

  it.each(['startup/main-process-runtime-service.ts', 'orcad/orcad-entry.ts'])(
    'is started by the runtime host in %s, not only by the desktop window',
    (relativePath) => {
      const source = readFileSync(join(import.meta.dirname, '..', relativePath), 'utf8')
      expect(source).toMatch(/^\s*startFeatureFolderSync\(/m)
    }
  )
})
