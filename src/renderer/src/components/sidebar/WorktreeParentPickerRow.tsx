import React from 'react'
import { Folder, GitBranch, Server } from 'lucide-react'
import { RepoBadgeMark } from '@/components/repo/RepoBadgeLabel'
import { getWorktreeStatusLabel, type WorktreeStatus } from '@/lib/worktree-status'
import { translate } from '@/i18n/i18n'
import { branchDisplayName } from './WorktreeCardHelpers'
import StatusIndicator from './StatusIndicator'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

// Why: presentational and memoized — the picker resolves every row's status
// from one batched store read so the rows themselves hold no subscriptions.
export const WorktreeParentPickerRow = React.memo(function WorktreeParentPickerRow({
  candidate,
  repo,
  status,
  isCurrent
}: {
  candidate: Worktree
  repo: Pick<Repo, 'badgeColor' | 'connectionId' | 'displayName'> | undefined
  status: WorktreeStatus
  isCurrent: boolean
}): React.JSX.Element {
  const branch = branchDisplayName(candidate.branch)

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <StatusIndicator status={status} aria-hidden="true" className="mt-0.5" />
      <span className="sr-only">{getWorktreeStatusLabel(status)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-medium">{candidate.displayName}</span>
          {isCurrent ? (
            <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-px text-[9px] font-medium leading-none text-muted-foreground">
              {translate('auto.components.sidebar.WorktreeParentPickerPopover.current', 'Current')}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
          {repo ? (
            <span className="inline-flex min-w-0 max-w-[8rem] shrink-0 items-center gap-1 rounded border border-border bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              <RepoBadgeMark color={repo.badgeColor} />
              <span className="truncate lowercase">{repo.displayName}</span>
            </span>
          ) : null}
          {repo?.connectionId ? <Server className="size-3 shrink-0" /> : null}
          <GitBranch className="size-3 shrink-0" />
          <span className="truncate">{branch}</span>
        </div>
      </div>
    </div>
  )
})

export const FolderParentPickerRow = React.memo(function FolderParentPickerRow({
  folder
}: {
  folder: Pick<FolderWorkspace, 'name' | 'folderPath'>
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <Folder className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-medium">{folder.name}</span>
          <span className="shrink-0 rounded border border-border bg-muted px-1.5 py-px text-[9px] font-medium leading-none text-muted-foreground">
            {translate('auto.components.sidebar.WorktreeParentPickerPopover.folder', 'Folder')}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] leading-none text-muted-foreground">
          {folder.folderPath}
        </div>
      </div>
    </div>
  )
})
