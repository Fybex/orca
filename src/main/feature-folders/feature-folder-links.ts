import { lstat, mkdir, readdir, readlink, rmdir, symlink, unlink } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { Repo } from '../../shared/repo-types'
import type { WorkspaceLineage } from '../../shared/worktree/lineage-types'
import { splitWorktreeId } from '../../shared/worktree/id'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../shared/workspace-scope'

/** `~/orca/workspaces` -> `~/orca/features`: features sit beside the worktrees they link to. */
export function getFeatureFoldersRoot(workspaceDir: string): string {
  return join(dirname(resolve(workspaceDir)), 'features')
}

export function isFeatureFolderPath(root: string, folderPath: string): boolean {
  return dirname(resolve(folderPath)) === resolve(root)
}

export function toFeatureFolderName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 60)
  return slug || 'feature'
}

function toLinkName(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, '-') || 'repo'
}

export type FeatureFolderLinkInput = {
  folderWorkspaceId: string
  workspaceLineageByChildKey: Readonly<Record<string, WorkspaceLineage>>
  repoNameById: ReadonlyMap<string, string>
}

/** Link name -> worktree path for every worktree attached to the folder workspace. The first
 *  worktree of a repo gets the repo name; later ones get `<repo>-<worktree dir>`. */
export function planFeatureFolderLinks(input: FeatureFolderLinkInput): Map<string, string> {
  const parentKey = folderWorkspaceKey(input.folderWorkspaceId)
  const children = Object.values(input.workspaceLineageByChildKey)
    .filter((lineage) => lineage.parentWorkspaceKey === parentKey)
    .sort((left, right) => left.createdAt - right.createdAt)
  const links = new Map<string, string>()
  for (const lineage of children) {
    const child = parseWorkspaceKey(lineage.childWorkspaceKey)
    const parsed = child?.type === 'worktree' ? splitWorktreeId(child.worktreeId) : null
    if (!parsed) {
      continue
    }
    const repoName = toLinkName(input.repoNameById.get(parsed.repoId) ?? parsed.repoId)
    const name = links.has(repoName)
      ? `${repoName}-${toLinkName(basename(parsed.worktreePath))}`
      : repoName
    if (!links.has(name)) {
      links.set(name, parsed.worktreePath)
    }
  }
  return links
}

async function readSymlinkTarget(path: string): Promise<string | null> {
  try {
    return (await lstat(path)).isSymbolicLink() ? await readlink(path) : null
  } catch {
    return null
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch {
    return false
  }
}

/** Makes the folder's symlinks match `links`. Never touches entries that are not symlinks. */
export async function syncFeatureFolder(
  folderPath: string,
  links: ReadonlyMap<string, string>
): Promise<void> {
  await mkdir(folderPath, { recursive: true })
  for (const entry of await readdir(folderPath)) {
    const entryPath = join(folderPath, entry)
    const target = await readSymlinkTarget(entryPath)
    if (target !== null && links.get(entry) !== target) {
      await unlink(entryPath)
    }
  }
  for (const [name, target] of links) {
    const linkPath = join(folderPath, name)
    if ((await readSymlinkTarget(linkPath)) === target || (await pathExists(linkPath))) {
      continue
    }
    if (!(await pathExists(target))) {
      continue
    }
    // Why junction: Windows creates directory junctions without admin rights or Developer Mode.
    await symlink(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
  }
}

/** Removes a deleted feature's links, then the folder itself only if nothing else is in it. */
export async function removeFeatureFolder(folderPath: string): Promise<void> {
  if (!(await pathExists(folderPath))) {
    return
  }
  await syncFeatureFolder(folderPath, new Map())
  if ((await readdir(folderPath)).length === 0) {
    await rmdir(folderPath)
  }
}

export type FeatureFolderSyncStore = {
  getSettings(): { workspaceDir: string }
  getFolderWorkspaces(): FolderWorkspace[]
  getRepos(): Repo[]
  getAllWorkspaceLineage(): Record<string, WorkspaceLineage>
}

export async function syncAllFeatureFolders(store: FeatureFolderSyncStore): Promise<void> {
  const root = getFeatureFoldersRoot(store.getSettings().workspaceDir)
  const repoNameById = new Map(store.getRepos().map((repo) => [repo.id, repo.displayName]))
  const workspaceLineageByChildKey = store.getAllWorkspaceLineage()
  for (const workspace of store.getFolderWorkspaces()) {
    // Why local only: an SSH feature's worktrees live on the remote host, not this disk.
    if (workspace.connectionId || !isFeatureFolderPath(root, workspace.folderPath)) {
      continue
    }
    await syncFeatureFolder(
      workspace.folderPath,
      planFeatureFolderLinks({
        folderWorkspaceId: workspace.id,
        workspaceLineageByChildKey,
        repoNameById
      })
    )
  }
}

/** Picks `<root>/<slug>`, adding `-2`, `-3`… so a new feature never reuses an existing folder. */
export async function reserveFeatureFolder(root: string, name: string): Promise<string> {
  const base = toFeatureFolderName(name)
  for (let attempt = 1; ; attempt += 1) {
    const candidate = join(root, attempt === 1 ? base : `${base}-${attempt}`)
    if (!(await pathExists(candidate))) {
      await mkdir(candidate, { recursive: true })
      return candidate
    }
  }
}
