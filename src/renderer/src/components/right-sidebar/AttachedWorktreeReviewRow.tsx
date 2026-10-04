import { useEffect, useRef, type ReactNode } from 'react'
import { FileDiff, SquareArrowOutUpRight } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { getIntlLocale, translate } from '@/i18n/i18n'
import { activateWorktreeFromSidebar } from '@/lib/sidebar-worktree-activation'
import { useAppStore } from '@/store'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { isFolderRepo } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import {
  claimAttachedWorktreeCompareRefresh,
  getAttachedWorktreeDiffStats,
  loadAttachedWorktreeBranchCompare,
  reviewAttachedWorktreeChanges
} from './attached-worktree-branch-compare'

export function AttachedWorktreeReviewMenu({
  worktree,
  repo,
  children
}: {
  worktree: Worktree
  repo: Repo | undefined
  children: ReactNode
}): React.JSX.Element {
  const canReview = repo !== undefined && !isFolderRepo(repo)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() =>
            void activateWorktreeFromSidebar(
              worktree.id,
              worktree.hostId ?? (repo ? getRepoExecutionHostId(repo) : undefined)
            )
          }
        >
          <SquareArrowOutUpRight className="size-3.5" />
          {translate('auto.components.rightSidebar.AttachedWorktreeReviewRow.open', 'Open')}
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!canReview}
          onSelect={() => {
            if (repo) {
              void reviewAttachedWorktreeChanges(worktree, repo)
            }
          }}
        >
          <FileDiff className="size-3.5" />
          {translate(
            'auto.components.rightSidebar.AttachedWorktreeReviewRow.reviewChanges',
            'Review changes'
          )}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function AttachedWorktreeDiffStatsLine({
  worktree,
  repo
}: {
  worktree: Worktree
  repo: Repo | undefined
}): React.JSX.Element | null {
  const summary = useAppStore((s) => s.gitBranchCompareSummaryByWorktree[worktree.id])
  const entries = useAppStore((s) => s.gitBranchChangesByWorktree[worktree.id])
  const lineRef = useRef<HTMLButtonElement | null>(null)
  const canCompare = repo !== undefined && !isFolderRepo(repo)

  useEffect(() => {
    const node = lineRef.current
    if (!canCompare || !node || typeof IntersectionObserver === 'undefined') {
      return
    }
    let visible = false
    // Why: recompute when the row, panel or window is seen again, at most once per interval.
    const refresh = (): void => {
      if (
        visible &&
        document.visibilityState !== 'hidden' &&
        useAppStore.getState().gitBranchCompareSummaryByWorktree[worktree.id]?.status !==
          'loading' &&
        claimAttachedWorktreeCompareRefresh(worktree.id, Date.now())
      ) {
        void loadAttachedWorktreeBranchCompare(worktree, repo)
      }
    }
    const observer = new IntersectionObserver(
      (observed) => {
        visible = observed.some((entry) => entry.isIntersecting)
        refresh()
      },
      { rootMargin: '160px 0px' }
    )
    observer.observe(node)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      observer.disconnect()
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [canCompare, repo, worktree])

  if (!canCompare) {
    return null
  }
  const stats = getAttachedWorktreeDiffStats(summary, entries)
  const locale = getIntlLocale()
  return (
    <button
      ref={lineRef}
      type="button"
      data-testid="attached-worktree-diff-stats"
      className="flex min-h-4 items-center gap-2 pl-6 text-left text-[11px] text-muted-foreground tabular-nums hover:text-foreground"
      title={translate(
        'auto.components.rightSidebar.AttachedWorktreeReviewRow.reviewChanges',
        'Review changes'
      )}
      onClick={(event) => {
        event.stopPropagation()
        if (repo) {
          void reviewAttachedWorktreeChanges(worktree, repo)
        }
      }}
    >
      {stats ? (
        <>
          <span>
            {stats.changedFiles === 1
              ? translate(
                  'auto.components.rightSidebar.AttachedWorktreeReviewRow.fileOne',
                  '1 file'
                )
              : translate(
                  'auto.components.rightSidebar.AttachedWorktreeReviewRow.fileMany',
                  '{{value0}} files',
                  { value0: stats.changedFiles }
                )}
          </span>
          <span className="text-[color:var(--git-decoration-added)]">
            +{stats.added.toLocaleString(locale)}
          </span>
          <span className="text-[color:var(--git-decoration-deleted)]">
            −{stats.removed.toLocaleString(locale)}
          </span>
          {stats.commitsAhead > 0 ? <span>↑{stats.commitsAhead}</span> : null}
        </>
      ) : null}
    </button>
  )
}
