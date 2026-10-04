import { getConnectionId } from '@/lib/connection-context'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { getRuntimeGitBranchCompare } from '@/runtime/runtime-git-client'
import { getRuntimeRepoBaseRefDefault } from '@/runtime/runtime-repo-client'
import { useAppStore } from '@/store'
import { createLoadingBranchCompareSummary } from '@/store/slices/editor/git/branch-compare-state'
import type {
  GitBranchChangeEntry,
  GitBranchCompareSummary
} from '../../../../shared/git-diff-compare-types'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

export type AttachedWorktreeDiffStats = {
  changedFiles: number
  added: number
  removed: number
  commitsAhead: number
}

// Why: a stacked child's baseRef is its parent's branch, so it diffs against the parent.
export function resolveAttachedWorktreePinnedBaseRef(
  worktree: Pick<Worktree, 'baseRef'>,
  repo: Pick<Repo, 'worktreeBaseRef'>
): string | null {
  return worktree.baseRef?.trim() || repo.worktreeBaseRef?.trim() || null
}

export function getAttachedWorktreeDiffStats(
  summary: GitBranchCompareSummary | null | undefined,
  entries: readonly GitBranchChangeEntry[] | undefined
): AttachedWorktreeDiffStats | null {
  if (summary?.status !== 'ready') {
    return null
  }
  let added = 0
  let removed = 0
  for (const entry of entries ?? []) {
    added += entry.added ?? 0
    removed += entry.removed ?? 0
  }
  return {
    changedFiles: summary.changedFiles,
    added,
    removed,
    commitsAhead: summary.commitsAhead ?? 0
  }
}

/** Fills the worktree's shared compare slots, the ones the Source Control panel reads. */
export async function loadAttachedWorktreeBranchCompare(
  worktree: Worktree,
  repo: Repo
): Promise<GitBranchCompareSummary | null> {
  if (isFolderRepo(repo)) {
    return null
  }
  const store = useAppStore.getState()
  // Why: git reads route by the repo OWNER host, not the focused runtime.
  const settings = getRepoOwnerRoutedSettings(store.settings, repo)
  const baseRef =
    resolveAttachedWorktreePinnedBaseRef(worktree, repo) ??
    (
      await getRuntimeRepoBaseRefDefault(
        {
          activeRuntimeEnvironmentId: settings?.activeRuntimeEnvironmentId ?? null
        },
        repo.id,
        repo.executionHostId ?? undefined
      )
    ).defaultBaseRef
  if (!baseRef) {
    return null
  }
  const requestKey = `${worktree.id}:${baseRef}:${Date.now()}:attached-worktree`
  store.beginGitBranchCompareRequest(worktree.id, requestKey, baseRef)
  try {
    const result = await getRuntimeGitBranchCompare(
      {
        settings,
        worktreeId: worktree.id,
        worktreePath: worktree.path,
        connectionId: getConnectionId(worktree.id) ?? undefined
      },
      baseRef,
      'background'
    )
    useAppStore.getState().setGitBranchCompareResult(worktree.id, requestKey, result)
    return result.summary
  } catch (error) {
    const summary: GitBranchCompareSummary = {
      ...createLoadingBranchCompareSummary(baseRef),
      compareRef: worktree.branch,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Branch compare failed'
    }
    useAppStore.getState().setGitBranchCompareResult(worktree.id, requestKey, {
      summary,
      entries: []
    })
    return summary
  }
}

/** Activates the worktree and opens its combined branch diff, loading the compare first if needed. */
export async function reviewAttachedWorktreeChanges(worktree: Worktree, repo: Repo): Promise<void> {
  await activateWorktreeFromSidebar(worktree.id, worktree.hostId ?? getRepoExecutionHostId(repo))
  const stored = useAppStore.getState().gitBranchCompareSummaryByWorktree[worktree.id]
  const summary =
    stored?.status === 'ready' ? stored : await loadAttachedWorktreeBranchCompare(worktree, repo)
  if (summary?.status === 'ready') {
    useAppStore.getState().openBranchAllDiffs(worktree.id, worktree.path, summary)
  }
}
