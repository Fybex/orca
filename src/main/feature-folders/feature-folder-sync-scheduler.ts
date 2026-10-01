import { registerWorktreeChangeInvalidator } from '../ipc/worktree-change-invalidators'
import { syncAllFeatureFolders, type FeatureFolderSyncStore } from './feature-folder-links'

const SYNC_DEBOUNCE_MS = 150

let unregisterInvalidator: (() => void) | null = null
let pendingSync: ReturnType<typeof setTimeout> | null = null
let syncStore: FeatureFolderSyncStore | null = null

export function scheduleFeatureFolderSync(): void {
  const store = syncStore
  if (!store) {
    return
  }
  if (pendingSync) {
    clearTimeout(pendingSync)
  }
  pendingSync = setTimeout(() => {
    pendingSync = null
    syncAllFeatureFolders(store).catch((error: unknown) => {
      console.warn('[feature-folders] link sync failed:', error)
    })
  }, SYNC_DEBOUNCE_MS)
}

/** Every lineage write is followed by a worktree-change notification, so syncing there keeps
 *  feature links current for create, attach, detach and removal alike. */
export function startFeatureFolderSync(store: FeatureFolderSyncStore): void {
  unregisterInvalidator?.()
  syncStore = store
  unregisterInvalidator = registerWorktreeChangeInvalidator(scheduleFeatureFolderSync)
  scheduleFeatureFolderSync()
}
