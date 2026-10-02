import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'
import type { HostSectionRow } from '../../host-section-rows'
import { worktree } from '../../worktree-list-groups-test-fixtures'
import { getFolderWorkspaceDragGroupKey } from '../../folder-workspace-drag-order'
import { buildFolderWorkspaceRow } from '../grouping/row-builders'
import {
  getFolderWorkspaceDragGroups,
  getWorktreeDragGroups,
  getWorktreeDragIndexes
} from './groups'

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'Payments',
  parentPath: '/tmp/payments',
  parentGroupId: null,
  createdFrom: 'folder-scan',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

function folderRow(id: string): HostSectionRow {
  const folderWorkspace: FolderWorkspace = {
    id,
    projectGroupId: GROUP.id,
    name: id,
    folderPath: `/tmp/features/${id}`,
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
  return buildFolderWorkspaceRow({ folderWorkspace, projectGroup: GROUP }, 1)
}

function itemRow(id: string, sectionKey: string): HostSectionRow {
  return {
    type: 'item',
    rowKey: id,
    sectionKey,
    worktree: { ...worktree, id },
    repo: undefined,
    depth: 1,
    groupDepth: 1,
    lineageTrail: [],
    isLastLineageChild: true,
    lineageChildCount: 0
  }
}

const HEADER_KEY = 'project-group:group-1'
const ROWS: HostSectionRow[] = [
  { type: 'header', key: HEADER_KEY, label: 'Payments', count: 3, tone: '' },
  folderRow('checkout'),
  itemRow('api::/w/checkout', 'folder-workspace:checkout'),
  folderRow('billing'),
  { type: 'header', key: 'repo:api', label: 'api', count: 1, tone: '' },
  itemRow('api::/w/main', 'repo:api')
]

describe('folder workspace drag groups', () => {
  const folderGroupKey = getFolderWorkspaceDragGroupKey(HEADER_KEY, GROUP.id)

  it('groups folder rows by section and project group, in display order', () => {
    expect(getFolderWorkspaceDragGroups(ROWS)).toEqual([
      { key: folderGroupKey, worktreeIds: ['folder:checkout', 'folder:billing'] }
    ])
  })

  it('keeps folder keys out of the worktree groups that feed worktree manual order', () => {
    const worktreeIds = getWorktreeDragGroups(ROWS).flatMap((group) => group.worktreeIds)
    expect(worktreeIds.some((id) => id.startsWith('folder:'))).toBe(false)
  })

  it('indexes folder rows by their folder key for pointer down and drag attributes', () => {
    const { groupKeyByRowKey, groupIndexByRowKey } = getWorktreeDragIndexes(ROWS)
    expect(groupKeyByRowKey.get('folder:billing')).toBe(folderGroupKey)
    expect(groupIndexByRowKey.get('folder:checkout')).toBe(0)
    expect(groupIndexByRowKey.get('folder:billing')).toBe(1)
    expect(groupKeyByRowKey.get('api::/w/main')).toBe('repo:api')
  })
})
