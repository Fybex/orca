import { Archive } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import type { AppState } from '../../../../store/types'
import { appendOrderedGroups } from './group-sections'
import type { SectionAppendContext } from './group-sections'
import type { OrderedGroupEntry } from './project-grouping'
import { withRepoSectionDisplayLabels } from './section-order'

/** On unless turned off (the default settings carry `true`); no settings yet means stock rows. */
export function isQuietProjectGroupsEnabled(settings: AppState['settings'] | undefined): boolean {
  return settings != null && settings.quietProjectGroups !== false
}

/** Presence in collapsedGroups means expanded, so the catalog starts folded. */
export function getProjectGroupCatalogKey(groupId: string): string {
  return `project-group-catalog:${groupId}`
}

function getEntryRepoIds([key, group]: OrderedGroupEntry): string[] {
  if (group.repoIds.size > 0) {
    return [...group.repoIds]
  }
  if (group.repo) {
    return [group.repo.id]
  }
  return key.startsWith('repo:') ? [key.slice('repo:'.length)] : []
}

/**
 * A group's repos, quietly: repos with real work keep their section without the
 * primary checkout row or the hidden-worktrees notice, and idle repos fold into
 * one "N more projects" header that expands to the stock sections.
 */
export function appendQuietProjectGroupRepos(
  ctx: SectionAppendContext,
  groupId: string,
  entries: OrderedGroupEntry[],
  depth: number
): void {
  const active: OrderedGroupEntry[] = []
  const idle: OrderedGroupEntry[] = []
  for (const entry of entries) {
    const [key, group] = entry
    const items = group.items.filter((worktree) => !worktree.isMainWorktree)
    const repoIds = getEntryRepoIds(entry)
    const hasPendingWork = repoIds.some(
      (repoId) =>
        (ctx.pendingByRepo.get(repoId)?.length ?? 0) > 0 ||
        ctx.newExternalWorktreesInboxByRepo.has(repoId)
    )
    if (items.length > 0 || hasPendingWork) {
      active.push([key, { ...group, items }])
    } else {
      idle.push(entry)
    }
  }

  const activeRepoIds = new Set(active.flatMap(getEntryRepoIds))
  const importedWorktreesByRepo = new Map(
    [...ctx.importedWorktreesByRepo].filter(([repoId]) => !activeRepoIds.has(repoId))
  )
  appendOrderedGroups(
    { ...ctx, importedWorktreesByRepo },
    withRepoSectionDisplayLabels(active),
    depth
  )
  if (idle.length === 0) {
    return
  }
  const key = getProjectGroupCatalogKey(groupId)
  const expanded = ctx.collapsedGroups.has(key)
  ctx.result.push({
    type: 'header',
    key,
    label: translate(
      'auto.components.sidebar.worktree.list.groups.quietCatalog',
      '{{value0}} more projects',
      { value0: idle.length }
    ),
    // Why 0: host badges sum header counts as workspaces, and these are repos, not workspaces.
    count: 0,
    tone: 'text-muted-foreground',
    icon: Archive,
    projectGroupDepth: depth,
    catalog: { expanded }
  })
  if (expanded) {
    appendOrderedGroups(ctx, withRepoSectionDisplayLabels(idle), depth)
  }
}
