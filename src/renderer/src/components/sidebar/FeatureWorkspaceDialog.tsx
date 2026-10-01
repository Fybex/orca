import React, { useId, useRef, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealFolderWorkspace } from '@/lib/worktree-activation'

function getModalString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Creates a feature: a folder workspace in its own folder that links to the feature's worktrees. */
export default function FeatureWorkspaceDialog(): React.JSX.Element | null {
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const createFolderWorkspace = useAppStore((s) => s.createFolderWorkspace)
  const projectGroupId = getModalString(modalData, 'projectGroupId')
  const projectGroup = useAppStore((s) =>
    s.projectGroups.find((group) => group.id === projectGroupId)
  )
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const trimmedName = name.trim()

  if (!projectGroup) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!trimmedName || submitting) {
      return
    }
    setSubmitting(true)
    try {
      const workspace = await createFolderWorkspace({
        projectGroupId: projectGroup.id,
        name: trimmedName,
        featureFolder: true
      })
      if (workspace) {
        closeModal()
        activateAndRevealFolderWorkspace(workspace.id)
        return
      }
    } catch (error) {
      toast.error(
        translate(
          'auto.components.sidebar.FeatureWorkspaceDialog.createFailed',
          'Could not create the feature'
        ),
        { description: error instanceof Error ? error.message : String(error) }
      )
    }
    setSubmitting(false)
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
            {translate('auto.components.sidebar.FeatureWorkspaceDialog.title', 'New feature')}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.sidebar.FeatureWorkspaceDialog.description',
              'Its terminal opens in a folder of its own, with a link to each worktree you attach to it.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"

              onClick={closeModal}
            >
              {translate('auto.components.sidebar.FeatureWorkspaceDialog.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"

              disabled={!trimmedName || submitting}
            >
              {submitting
                ? translate(
                    'auto.components.sidebar.FeatureWorkspaceDialog.creating',
                    'Creating...'
                  )
                : translate('auto.components.sidebar.FeatureWorkspaceDialog.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
