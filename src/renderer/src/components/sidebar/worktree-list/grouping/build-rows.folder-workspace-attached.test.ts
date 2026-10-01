import { describe, expect, it } from 'vitest'
import { buildRows } from './build-rows'
import { getWorktreeLineageGroupKey } from './group-keys'
import type { Row, WorktreeGroupBy } from './row-types'
import { repo, worktree } from '../../worktree-list-groups-test-fixtures'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import type {
  WorkspaceLineage,
  WorktreeLineage
} from '../../../../../../shared/worktree/lineage-types'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../../../shared/workspace-scope'

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'Feature group',
  parentPath: '/tmp/parent',
  parentGroupId: null,
  createdFrom: 'folder-scan',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const FOLDER: FolderWorkspace = {
  id: 'fw-1',
  projectGroupId: GROUP.id,
  name: 'Feature folder',
  folderPath: '/tmp/parent',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 1,
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1
}

const API_REPO: Repo = { ...repo, id: 'repo-api', displayName: 'api', projectGroupId: GROUP.id }
const WEB_REPO: Repo = { ...repo, id: 'repo-web', displayName: 'web', projectGroupId: GROUP.id }

function makeWorktree(id: string, repoId: string, overrides: Partial<Worktree> = {}): Worktree {
  return {
    ...worktree,
    id,
    repoId,
    path: `/tmp/${id}`,
    displayName: id,
    instanceId: `${id}-i`,
    ...overrides
  }
}

const API_MAIN = makeWorktree('api-main', API_REPO.id, { isMainWorktree: true })
const API_FEATURE = makeWorktree('api-feature', API_REPO.id)
const WEB_FEATURE = makeWorktree('web-feature', WEB_REPO.id)

function attachToFolder(child: Worktree, folderId = FOLDER.id): WorkspaceLineage {
  return {
    childWorkspaceKey: worktreeWorkspaceKey(child.id),
    childInstanceId: child.instanceId,
    parentWorkspaceKey: folderWorkspaceKey(folderId),
    parentInstanceId: null,
    origin: 'cli',
    capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
    createdAt: 1
  }
}

function buildSidebarRows(options: {
  worktrees: Worktree[]
  workspaceLineage: WorkspaceLineage[]
  lineageById?: Record<string, WorktreeLineage>
  groupBy?: WorktreeGroupBy
  collapsedGroups?: Set<string>
}): Row[] {
  return buildRows(
    options.groupBy ?? 'repo',
    options.worktrees,
    new Map([
      [API_REPO.id, API_REPO],
      [WEB_REPO.id, WEB_REPO]
    ]),
    null,
    options.collapsedGroups ?? new Set<string>(),
    undefined,
    undefined,
    'manual',
    options.lineageById ?? {},
    new Map(options.worktrees.map((entry) => [entry.id, entry])),
    true,
    undefined,
    [GROUP],
    new Set(),
    new Map(),
    new Map(),
    [],
    undefined,
    [FOLDER],
    undefined,
    undefined,
    undefined,
    Object.fromEntries(
      options.workspaceLineage.map((lineage) => [lineage.childWorkspaceKey, lineage])
    )
  )
}

function describeRows(rows: Row[]): string[] {
  return rows.flatMap((row) => {
    if (row.type === 'folder-workspace') {
      return [`folder:${row.folderWorkspace.id}:${row.lineageChildCount ?? 0}`]
    }
    if (row.type === 'item') {
      return [`${'  '.repeat(row.depth)}${row.worktree.id}`]
    }
    return row.type === 'header' ? [`# ${row.label}`] : []
  })
}

describe('worktrees attached to a folder workspace', () => {
  it('nest under the folder workspace across repos and leave their repo sections', () => {
    const rows = buildSidebarRows({
      worktrees: [API_MAIN, API_FEATURE, WEB_FEATURE],
      workspaceLineage: [attachToFolder(API_FEATURE), attachToFolder(WEB_FEATURE)]
    })

    expect(describeRows(rows)).toEqual([
      '# Feature group',
      'folder:fw-1:2',
      '  api-feature',
      '  web-feature',
      '# api',
      'api-main'
    ])
  })

  it('hides attached worktrees when the folder workspace is collapsed', () => {
    const rows = buildSidebarRows({
      worktrees: [API_MAIN, API_FEATURE],
      workspaceLineage: [attachToFolder(API_FEATURE)],
      collapsedGroups: new Set([getWorktreeLineageGroupKey({ id: folderWorkspaceKey(FOLDER.id) })])
    })

    const folderRow = rows.find((row) => row.type === 'folder-workspace')
    expect(folderRow).toMatchObject({ lineageChildCount: 1, lineageCollapsed: true })
    expect(describeRows(rows)).not.toContain('  api-feature')
    expect(describeRows(rows)).not.toContain('api-feature')
  })

  it('carries same-repo lineage children of an attached worktree along with it', () => {
    const apiChild = makeWorktree('api-child', API_REPO.id)
    const rows = buildSidebarRows({
      worktrees: [API_MAIN, API_FEATURE, apiChild],
      workspaceLineage: [attachToFolder(API_FEATURE)],
      lineageById: {
        [apiChild.id]: {
          worktreeId: apiChild.id,
          worktreeInstanceId: 'api-child-i',
          parentWorktreeId: API_FEATURE.id,
          parentWorktreeInstanceId: 'api-feature-i',
          origin: 'cli',
          capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
          createdAt: 1
        }
      }
    })

    expect(describeRows(rows)).toEqual([
      '# Feature group',
      'folder:fw-1:1',
      '  api-feature',
      '    api-child',
      '# api',
      'api-main'
    ])
  })

  it('ignores a stale link whose child instance was replaced', () => {
    const rows = buildSidebarRows({
      worktrees: [API_MAIN, API_FEATURE],
      workspaceLineage: [{ ...attachToFolder(API_FEATURE), childInstanceId: 'older-instance' }]
    })

    expect(describeRows(rows)).toEqual([
      '# Feature group',
      'folder:fw-1:0',
      '# api',
      'api-main',
      'api-feature'
    ])
  })

  it('keeps status grouping flat', () => {
    const rows = buildSidebarRows({
      groupBy: 'workspace-status',
      worktrees: [API_FEATURE],
      workspaceLineage: [attachToFolder(API_FEATURE)]
    })

    expect(
      rows.some(
        (row) => row.type === 'item' && row.worktree.id === API_FEATURE.id && row.depth === 0
      )
    ).toBe(true)
  })
})
