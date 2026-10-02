import { useCallback } from 'react'
import { useAppStore } from '@/store'
import { getFolderWorkspaceHostId } from '@/store/folder-workspaces/folder-workspace-catalog'
import { folderWorkspaceKey } from '../../../../../../shared/workspace-scope'
import { planFolderWorkspaceDrop } from '../../folder-workspace-drag-order'
import type { WorktreeDropCommitContext } from './drop-commit-context'

/** Persists a folder row drop as `manualOrder`, the order folder rows always sort by. */
export function useFolderWorkspaceReorder(): WorktreeDropCommitContext['onReorderFolderWorkspaces'] {
  const updateFolderWorkspace = useAppStore((s) => s.updateFolderWorkspace)
  return useCallback(
    (args) => {
      const { folderWorkspaces, projectGroups } = useAppStore.getState()
      const moved = folderWorkspaces.find(
        (workspace) => folderWorkspaceKey(workspace.id) === args.movedKey
      )
      if (!moved) {
        return
      }
      // Why: folder ids are host-local, so only the owning host's folders share one order.
      const executionHostId = getFolderWorkspaceHostId(moved, projectGroups)
      const updates = planFolderWorkspaceDrop({
        ...args,
        folderWorkspaces: folderWorkspaces.filter(
          (workspace) => getFolderWorkspaceHostId(workspace, projectGroups) === executionHostId
        ),
        now: Date.now()
      })
      for (const [folderWorkspaceId, manualOrder] of updates) {
        void updateFolderWorkspace(folderWorkspaceId, { manualOrder }, { executionHostId })
      }
    },
    [updateFolderWorkspace]
  )
}
