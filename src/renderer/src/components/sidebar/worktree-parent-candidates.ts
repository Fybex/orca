import { getWorktreeExecutionHostId } from '../../../../shared/execution-host'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { WorkspaceLineage, WorktreeLineage } from '../../../../shared/worktree/lineage-types'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../shared/workspace-scope'
import { getFolderWorkspaceHostId } from '@/store/folder-workspaces/folder-workspace-catalog'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { canAssignWorktreeParent } from './worktree-parent-eligibility'
import { getCyclicProjectedWorktreeLineageIds } from './worktree-lineage-projection'

type ParentCandidateArgs = {
  child: Worktree
  worktrees: readonly Worktree[]
  lineageById: Record<string, WorktreeLineage>
  worktreeMap: Map<string, Worktree>
  repoMap: Map<string, Pick<Repo, 'connectionId' | 'executionHostId'>>
  cyclicLineageIds?: ReadonlySet<string>
}

function getWorktreeOwnerHostId(
  worktree: Worktree,
  repoMap: Map<string, Pick<Repo, 'connectionId' | 'executionHostId'>>
): string | null {
  const repo = repoMap.get(worktree.repoId)
  return repo ? getWorktreeExecutionHostId(worktree, repo) : (worktree.hostId ?? null)
}

export function getEligibleWorktreeParents({
  child,
  worktrees,
  lineageById,
  worktreeMap,
  repoMap,
  cyclicLineageIds: precomputedCyclicLineageIds
}: ParentCandidateArgs): Worktree[] {
  const childHostId = getWorktreeOwnerHostId(child, repoMap)
  const cyclicLineageIds =
    precomputedCyclicLineageIds ?? getCyclicProjectedWorktreeLineageIds(lineageById, worktreeMap)
  return worktrees.filter((candidate) =>
    isEligibleWorktreeParent({
      child,
      candidateParent: candidate,
      lineageById,
      worktreeMap,
      repoMap,
      cyclicLineageIds,
      childHostId
    })
  )
}

export function isEligibleWorktreeParent({
  child,
  candidateParent,
  lineageById,
  worktreeMap,
  repoMap,
  cyclicLineageIds,
  childHostId = getWorktreeOwnerHostId(child, repoMap)
}: Omit<ParentCandidateArgs, 'worktrees'> & {
  candidateParent: Worktree
  childHostId?: string | null
}): boolean {
  return (
    candidateParent.repoId === child.repoId &&
    childHostId !== null &&
    getWorktreeOwnerHostId(candidateParent, repoMap) === childHostId &&
    (child.projectId === undefined ||
      candidateParent.projectId === undefined ||
      child.projectId === candidateParent.projectId) &&
    !candidateParent.isArchived &&
    canAssignWorktreeParent({
      child,
      candidateParent,
      lineageById,
      worktreeMap,
      cyclicLineageIds
    })
  )
}

type FolderParentCandidateArgs = {
  child: Worktree
  folderWorkspaces: readonly FolderWorkspace[]
  projectGroups: readonly ProjectGroup[]
  workspaceLineageByChildKey: Record<string, WorkspaceLineage>
  repoMap: Map<string, Pick<Repo, 'connectionId' | 'executionHostId'>>
}

// Why: the sidebar only nests a worktree under a folder on the same host, so
// offering any other folder would make the pick vanish from the tree.
export function getEligibleFolderParents({
  child,
  folderWorkspaces,
  projectGroups,
  workspaceLineageByChildKey,
  repoMap
}: FolderParentCandidateArgs): FolderWorkspace[] {
  const childHostId = getWorktreeOwnerHostId(child, repoMap)
  if (childHostId === null) {
    return []
  }
  const currentParentKey =
    workspaceLineageByChildKey[worktreeWorkspaceKey(child.id)]?.parentWorkspaceKey
  return folderWorkspaces.filter(
    (folder) =>
      !folder.isArchived &&
      folderWorkspaceKey(folder.id) !== currentParentKey &&
      getFolderWorkspaceHostId(folder, projectGroups) === childHostId
  )
}
