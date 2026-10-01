import { mkdir, mkdtemp, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { WorkspaceLineage } from '../../shared/worktree/lineage-types'
import {
  getFeatureFoldersRoot,
  planFeatureFolderLinks,
  removeFeatureFolder,
  reserveFeatureFolder,
  syncAllFeatureFolders,
  syncFeatureFolder
} from './feature-folder-links'
import { toFeatureFolderName } from '../../shared/feature-folder-name'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'orca-feature-folder-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function attach(worktreeId: string, folderId: string, createdAt: number): WorkspaceLineage {
  return {
    childWorkspaceKey: `worktree:${worktreeId}`,
    childInstanceId: `${worktreeId}-instance`,
    parentWorkspaceKey: `folder:${folderId}`,
    parentInstanceId: null,
    origin: 'cli',
    capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
    createdAt
  }
}

function byChildKey(lineages: WorkspaceLineage[]): Record<string, WorkspaceLineage> {
  return Object.fromEntries(lineages.map((lineage) => [lineage.childWorkspaceKey, lineage]))
}

describe('planFeatureFolderLinks', () => {
  it('names links after repos and disambiguates a second worktree of the same repo', () => {
    const links = planFeatureFolderLinks({
      folderWorkspaceId: 'fw-1',
      repoNameById: new Map([
        ['repo-api', 'api'],
        ['repo-web', 'web app']
      ]),
      workspaceLineageByChildKey: byChildKey([
        attach('repo-api::/wt/api/feat-a', 'fw-1', 1),
        attach('repo-web::/wt/web/feat-a', 'fw-1', 2),
        attach('repo-api::/wt/api/feat-a-tests', 'fw-1', 3),
        attach('repo-api::/wt/api/other', 'fw-2', 4)
      ])
    })

    expect([...links]).toEqual([
      ['api', '/wt/api/feat-a'],
      ['web-app', '/wt/web/feat-a'],
      ['api-feat-a-tests', '/wt/api/feat-a-tests']
    ])
  })
})

describe('syncFeatureFolder', () => {
  it('adds missing links, drops stale ones and leaves real files alone', async () => {
    const featureDir = join(dir, 'feature')
    const apiWorktree = join(dir, 'api-wt')
    const webWorktree = join(dir, 'web-wt')
    await mkdir(apiWorktree)
    await mkdir(webWorktree)
    await syncFeatureFolder(featureDir, new Map([['api', apiWorktree]]))
    await writeFile(join(featureDir, 'NOTES.md'), 'mine')

    await syncFeatureFolder(featureDir, new Map([['web', webWorktree]]))

    expect((await readdir(featureDir)).sort()).toEqual(['NOTES.md', 'web'])
    expect(await readlink(join(featureDir, 'web'))).toBe(webWorktree)
  })

  it('skips a worktree whose directory no longer exists', async () => {
    const featureDir = join(dir, 'feature')
    await syncFeatureFolder(featureDir, new Map([['api', join(dir, 'gone')]]))
    expect(await readdir(featureDir)).toEqual([])
  })
})

describe('removeFeatureFolder', () => {
  it('removes the folder only when nothing but links was in it', async () => {
    const target = join(dir, 'wt')
    await mkdir(target)
    const linksOnly = join(dir, 'links-only')
    const withNotes = join(dir, 'with-notes')
    await syncFeatureFolder(linksOnly, new Map([['api', target]]))
    await syncFeatureFolder(withNotes, new Map([['api', target]]))
    await writeFile(join(withNotes, 'NOTES.md'), 'keep')

    await removeFeatureFolder(linksOnly)
    await removeFeatureFolder(withNotes)

    expect((await readdir(dir)).sort()).toEqual(['with-notes', 'wt'])
    expect(await readdir(withNotes)).toEqual(['NOTES.md'])
  })
})

describe('reserveFeatureFolder', () => {
  it('slugs the name and never reuses an existing folder', async () => {
    const first = await reserveFeatureFolder(dir, 'DEV-1234 Risk score!')
    const second = await reserveFeatureFolder(dir, 'DEV-1234 Risk score!')
    expect(first).toBe(join(dir, 'dev-1234-risk-score'))
    expect(second).toBe(join(dir, 'dev-1234-risk-score-2'))
    expect(toFeatureFolderName('  ')).toBe('feature')
  })
})

describe('syncAllFeatureFolders', () => {
  it('links only local folder workspaces that live in the features root', async () => {
    const workspaceDir = join(dir, 'workspaces')
    const root = getFeatureFoldersRoot(workspaceDir)
    const worktreePath = join(workspaceDir, 'api', 'feat')
    await mkdir(worktreePath, { recursive: true })
    const featurePath = join(root, 'feat')
    const groupRootPath = join(dir, 'group-root')
    await mkdir(groupRootPath)
    const workspace = (id: string, folderPath: string, connectionId: string | null = null) => ({
      id,
      projectGroupId: 'g',
      name: id,
      folderPath,
      connectionId,
      linkedTask: null,
      comment: '',
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0,
      createdAt: 0,
      updatedAt: 0
    })

    await syncAllFeatureFolders({
      getSettings: () => ({ workspaceDir }),
      getRepos: () => [
        { id: 'repo-api', path: '/r', displayName: 'api', badgeColor: '', addedAt: 0 }
      ],
      getFolderWorkspaces: () => [
        workspace('feature', featurePath),
        workspace('general', groupRootPath),
        workspace('remote', join(root, 'remote'), 'ssh-box')
      ],
      getAllWorkspaceLineage: () =>
        byChildKey([
          attach(`repo-api::${worktreePath}`, 'feature', 1),
          attach(`repo-api::${join(workspaceDir, 'api', 'other')}`, 'general', 2)
        ])
    })

    expect(await readlink(join(featurePath, 'api'))).toBe(worktreePath)
    expect(await readdir(groupRootPath)).toEqual([])
    expect(await readdir(root)).toEqual(['feat'])
  })
})
