import React, { useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealFolderWorkspace } from '@/lib/worktree-activation'
import {
  addReposToFeature,
  getFeatureRepoIds,
  type FeatureRepoFailure
} from '@/lib/feature-workspace-worktrees'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'

function getModalString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function reportFailures(failures: readonly FeatureRepoFailure[]): void {
  if (failures.length === 0) {
    return
  }
  toast.error(
    translate(
      'auto.components.sidebar.FeatureWorkspaceDialog.reposFailed',
      'Some repos were not added: {{value0}}',
      { value0: failures.map((failure) => failure.repo.displayName).join(', ') }
    ),
    { description: failures.map((failure) => failure.message).join('\n') }
  )
}

/** "New feature" from a group header, or "Add repos" from a folder workspace's menu. */
export default function FeatureWorkspaceDialog(): React.JSX.Element | null {
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const createFolderWorkspace = useAppStore((s) => s.createFolderWorkspace)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const projectGroups = useAppStore((s) => s.projectGroups)
  const repos = useAppStore((s) => s.repos)
  const workspaceLineageByChildKey = useAppStore((s) => s.workspaceLineageByChildKey)
  const folderWorkspace = folderWorkspaces.find(
    (workspace) => workspace.id === getModalString(modalData, 'folderWorkspaceId')
  )
  const projectGroupId =
    folderWorkspace?.projectGroupId ?? getModalString(modalData, 'projectGroupId')
  const projectGroup = projectGroups.find((group) => group.id === projectGroupId)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [selectedRepoIds, setSelectedRepoIds] = useState<ReadonlySet<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const trimmedName = name.trim()
  const attachedRepoIds = useMemo(
    () =>
      folderWorkspace
        ? getFeatureRepoIds(folderWorkspace.id, workspaceLineageByChildKey)
        : new Set<string>(),
    [folderWorkspace, workspaceLineageByChildKey]
  )
  // Why local git repos only: a worktree needs git, and SSH repos live on another host's disk.
  const groupRepos = useMemo(
    () =>
      repos.filter(
        (repo) =>
          repo.projectGroupId === projectGroupId && isGitRepoKind(repo) && !repo.connectionId
      ),
    [projectGroupId, repos]
  )

  if (!projectGroup) {
    return null
  }

  const isAddMode = folderWorkspace !== undefined
  const selectedRepos = groupRepos.filter((repo) => selectedRepoIds.has(repo.id))
  const canSubmit = !submitting && (isAddMode ? selectedRepos.length > 0 : trimmedName.length > 0)

  const toggleRepo = (repo: Repo, checked: boolean): void => {
    setSelectedRepoIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(repo.id)
      } else {
        next.delete(repo.id)
      }
      return next
    })
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }
    setSubmitting(true)
    try {
      const target =
        folderWorkspace ??
        (await createFolderWorkspace({
          projectGroupId: projectGroup.id,
          name: trimmedName,
          featureFolder: true
        }))
      if (!target) {
        setSubmitting(false)
        return
      }
      closeModal()
      if (!isAddMode) {
        activateAndRevealFolderWorkspace(target.id)
      }
      reportFailures(await addReposToFeature(target, selectedRepos))
    } catch (error) {
      toast.error(
        translate(
          'auto.components.sidebar.FeatureWorkspaceDialog.createFailed',
          'Could not create the feature'
        ),
        { description: error instanceof Error ? error.message : String(error) }
      )
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : closeModal())}>
      <DialogContent
        className="max-w-sm sm:max-w-sm"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isAddMode
              ? translate(
                  'auto.components.sidebar.FeatureWorkspaceDialog.addTitle',
                  'Add repos to {{value0}}',
                  { value0: folderWorkspace.name }
                )
              : translate('auto.components.sidebar.FeatureWorkspaceDialog.title', 'New feature')}
          </DialogTitle>
          <DialogDescription>
            {isAddMode
              ? translate(
                  'auto.components.sidebar.FeatureWorkspaceDialog.addDescription',
                  'Each repo gets a worktree on the feature branch, nested under it.'
                )
              : translate(
                  'auto.components.sidebar.FeatureWorkspaceDialog.description',
                  'Its terminal opens in a folder of its own, with a link to each repo worktree. Pick repos now or add them later.'
                )}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {isAddMode ? null : (
            <div className="space-y-1">
              <Label htmlFor={inputId}>
                {translate('auto.components.sidebar.FeatureWorkspaceDialog.name', 'Feature name')}
              </Label>
              <Input
                id={inputId}
                ref={inputRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <fieldset className="space-y-1.5">
            <legend className="mb-1.5 text-xs text-muted-foreground">
              {translate('auto.components.sidebar.FeatureWorkspaceDialog.repos', 'Repos')}
            </legend>
            <div className="scrollbar-sleek max-h-56 space-y-1.5 overflow-y-auto">
              {groupRepos.map((repo) => {
                const attached = attachedRepoIds.has(repo.id)
                const checkboxId = `${inputId}-${repo.id}`
                return (
                  <div key={repo.id} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={attached || selectedRepoIds.has(repo.id)}
                      disabled={attached || submitting}
                      onCheckedChange={(checked) => toggleRepo(repo, checked === true)}
                    />
                    <Label htmlFor={checkboxId}>{repo.displayName}</Label>
                    {attached ? (
                      <span className="text-xs text-muted-foreground">
                        {translate(
                          'auto.components.sidebar.FeatureWorkspaceDialog.alreadyAdded',
                          'already added'
                        )}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={closeModal}>
              {translate('auto.components.sidebar.FeatureWorkspaceDialog.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {submitting
                ? translate(
                    'auto.components.sidebar.FeatureWorkspaceDialog.creating',
                    'Creating...'
                  )
                : isAddMode
                  ? translate('auto.components.sidebar.FeatureWorkspaceDialog.add', 'Add')
                  : translate('auto.components.sidebar.FeatureWorkspaceDialog.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
