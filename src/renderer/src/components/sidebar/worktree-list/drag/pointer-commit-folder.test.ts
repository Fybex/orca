// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { commitWorktreePointerDrop } from './pointer-commit'
import type { WorktreeDropCommitContext } from './drop-commit-context'
import { NO_WORKTREE_SIDEBAR_DROP_TARGET, type WorktreePointerDrag } from './row-state'

const FOLDER_GROUP_KEY = 'folder-order:group-1:project-group:group-1'

function folderDrag(): WorktreePointerDrag {
  return {
    pointerId: 1,
    sourceRow: document.createElement('div'),
    startX: 10,
    startY: 10,
    currentX: 10,
    currentY: 200,
    worktreeId: 'folder:a',
    draggedIds: ['folder:a'],
    reorderDraggedIds: ['folder:a'],
    reorderUnitDraggedIds: ['folder:a'],
    sourceGroupKey: FOLDER_GROUP_KEY,
    rects: [],
    active: true,
    preview: null,
    previewOffsetX: 0,
    previewOffsetY: 0,
    workspaceBoardDragPreviewRequested: false,
    frameId: null,
    reorderIntent: null,
    latestBoardDropTarget: null,
    latestStatusDropTarget: null
  }
}

function context(): WorktreeDropCommitContext {
  return {
    scrollRef: { current: null },
    workspaceStatuses: [],
    worktreeDragGroups: [],
    worktreeDragUnitGroups: [],
    folderWorkspaceDragGroups: [
      { key: FOLDER_GROUP_KEY, worktreeIds: ['folder:a', 'folder:b', 'folder:c'] }
    ],
    computeWorktreeDrop: () => ({
      dropIndex: 2,
      dropIndicatorY: 200,
      dropAnchorId: 'folder:c',
      previewOffsetsByWorktreeId: new Map()
    }),
    computeWorktreeStatusDrop: () => null,
    refreshWorktreeDragSession: () => true,
    getEligibleLineageDropTarget: () => ({
      ...NO_WORKTREE_SIDEBAR_DROP_TARGET,
      lineageParentId: 'repo::/wt'
    }),
    commitWorktreeLineageParentDrop: vi.fn(() => true),
    clearReorderedWorktreeParents: vi.fn(),
    clearWorktreeDrag: vi.fn(),
    onMoveWorktreesToStatus: vi.fn(),
    onMoveWorktreesToStatusAtIndex: vi.fn(),
    onReorderWorktrees: vi.fn(),
    onPinWorktrees: vi.fn(),
    onReorderFolderWorkspaces: vi.fn()
  }
}

describe('commitWorktreePointerDrop for a folder row', () => {
  it('reorders the folder among its group and touches no worktree write', () => {
    const ctx = context()
    const onDropWorktreesOnWorkspaceBoard = vi.fn()

    commitWorktreePointerDrop({
      event: new PointerEvent('pointerup', { clientX: 10, clientY: 200 }),
      drag: folderDrag(),
      ctx,
      onWorkspaceBoardDragPreviewCommit: vi.fn(),
      onDropWorktreesOnWorkspaceBoard
    })

    expect(ctx.onReorderFolderWorkspaces).toHaveBeenCalledWith({
      groupKeys: ['folder:a', 'folder:b', 'folder:c'],
      movedKey: 'folder:a',
      dropIndex: 2
    })
    expect(ctx.commitWorktreeLineageParentDrop).not.toHaveBeenCalled()
    expect(ctx.onReorderWorktrees).not.toHaveBeenCalled()
    expect(onDropWorktreesOnWorkspaceBoard).not.toHaveBeenCalled()
    expect(ctx.clearWorktreeDrag).toHaveBeenCalledOnce()
  })
})
