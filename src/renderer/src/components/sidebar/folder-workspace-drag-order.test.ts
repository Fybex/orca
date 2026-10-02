import { describe, expect, it } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import { compareFolderWorkspacesForDisplay } from '../../../../shared/folder-workspace-order'
import {
  getFolderWorkspaceDragGroupKey,
  getFolderWorkspaceDropTarget,
  isFolderWorkspaceDragGroupKey,
  planFolderWorkspaceDrop
} from './folder-workspace-drag-order'

function folder(id: string, projectGroupId: string, manualOrder: number): FolderWorkspace {
  return {
    id,
    projectGroupId,
    name: id,
    folderPath: `/f/${id}`,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    manualOrder,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0
  }
}

describe('folder workspace drag groups', () => {
  it('keys a group by project group and section, apart from worktree group keys', () => {
    const key = getFolderWorkspaceDragGroupKey('project-group:g-1', 'g-1')
    expect(isFolderWorkspaceDragGroupKey(key)).toBe(true)
    expect(isFolderWorkspaceDragGroupKey('project-group:g-1')).toBe(false)
  })
})

describe('getFolderWorkspaceDropTarget', () => {
  const groupKeys = ['folder:a', 'folder:b', 'folder:c']

  it.each([
    ['folder:a', 2, { beforeId: 'c' }],
    ['folder:a', 3, { afterId: 'c' }],
    ['folder:c', 0, { beforeId: 'a' }],
    ['folder:b', 1, { beforeId: 'c' }]
  ] as const)('%s dropped at %i lands %j', (movedKey, dropIndex, expected) => {
    expect(getFolderWorkspaceDropTarget({ groupKeys, movedKey, dropIndex })).toEqual(expected)
  })

  it('has no target when the folder is alone in its group', () => {
    expect(
      getFolderWorkspaceDropTarget({ groupKeys: ['folder:a'], movedKey: 'folder:a', dropIndex: 1 })
    ).toBeNull()
  })
})

describe('planFolderWorkspaceDrop', () => {
  it('orders the dragged folder within its own project group only', () => {
    const folderWorkspaces = [
      folder('a', 'g-1', 30_000),
      folder('b', 'g-1', 20_000),
      folder('c', 'g-1', 10_000),
      folder('other', 'g-2', 25_000)
    ]
    const updates = planFolderWorkspaceDrop({
      folderWorkspaces,
      groupKeys: ['folder:a', 'folder:b', 'folder:c'],
      movedKey: 'folder:a',
      dropIndex: 3,
      now: 1_000_000
    })

    expect([...updates.keys()]).toEqual(['a'])
    const order = folderWorkspaces
      .filter(({ projectGroupId }) => projectGroupId === 'g-1')
      .map((workspace) => ({
        ...workspace,
        manualOrder: updates.get(workspace.id) ?? workspace.manualOrder
      }))
      .sort(compareFolderWorkspacesForDisplay)
      .map(({ id }) => id)
    expect(order).toEqual(['b', 'c', 'a'])
  })
})
