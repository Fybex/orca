/** One slug for a feature's folder and the branch its repo worktrees share. */
export function toFeatureFolderName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 60)
  return slug || 'feature'
}
