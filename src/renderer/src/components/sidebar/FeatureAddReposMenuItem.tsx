import React from 'react'
import { GitBranchPlus } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'

/** Opens the feature dialog in add mode for one folder workspace. */
export function FeatureAddReposMenuItem({
  folderWorkspaceId,
  disabled
}: {
  folderWorkspaceId: string
  disabled: boolean
}): React.JSX.Element {
  return (
    <DropdownMenuItem
      onSelect={() => useAppStore.getState().openModal('feature-workspace', { folderWorkspaceId })}
      disabled={disabled}
    >
      <GitBranchPlus className="size-3.5" />
      {translate('auto.components.sidebar.WorktreeContextMenu.addRepos', 'Add repos…')}
    </DropdownMenuItem>
  )
}
