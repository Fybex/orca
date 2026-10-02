function toFeatureSlug(name: string): string {
  const slug = name
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 60)
  return slug || 'feature'
}

/** A feature's folder name on disk. Lowercase, so existing feature folders keep their names. */
export function toFeatureFolderName(name: string): string {
  return toFeatureSlug(name.toLowerCase())
}

/** The branch every repo worktree of a feature shares. Keeps case, so a Jira key stays `ABC-1234`. */
export function toFeatureBranchName(name: string): string {
  return toFeatureSlug(name)
}
