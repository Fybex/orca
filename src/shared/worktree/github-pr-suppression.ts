import type { Worktree } from './types'
import type { WorktreeMeta } from './meta-types'

type GitHubPRSuppressionMetadata = Pick<Worktree, 'linkedPR' | 'suppressedGitHubPR'>
type GitLabMRSuppressionMetadata = Pick<Worktree, 'linkedGitLabMR' | 'suppressedGitLabMR'>

export function isGitHubPRSuppressed(
  { linkedPR, suppressedGitHubPR }: GitHubPRSuppressionMetadata,
  prNumber: number
): boolean {
  return linkedPR === null && suppressedGitHubPR === prNumber
}

export function isGitLabMRSuppressed(
  { linkedGitLabMR, suppressedGitLabMR }: GitLabMRSuppressionMetadata,
  mrNumber: number
): boolean {
  return (linkedGitLabMR ?? null) === null && suppressedGitLabMR === mrNumber
}

/** Whether an explicit unlink hides this discovered review; keyed by number so a new review on the branch shows again. */
export function isHostedReviewSuppressed(
  worktree: GitHubPRSuppressionMetadata & GitLabMRSuppressionMetadata,
  review: { provider?: string; number: number }
): boolean {
  if (review.provider === 'github') {
    return isGitHubPRSuppressed(worktree, review.number)
  }
  return review.provider === 'gitlab' && isGitLabMRSuppressed(worktree, review.number)
}

export function normalizeReviewSuppressionUpdate(
  updates: Partial<WorktreeMeta>
): Partial<WorktreeMeta> {
  const github = normalizeGitHubPRSuppressionUpdate(updates)
  return typeof github.linkedGitLabMR === 'number' && github.linkedGitLabMR > 0
    ? { ...github, suppressedGitLabMR: null }
    : github
}

export function normalizeGitHubPRSuppressionUpdate(
  updates: Partial<WorktreeMeta>
): Partial<WorktreeMeta> {
  return typeof updates.linkedPR === 'number' && updates.linkedPR > 0
    ? { ...updates, suppressedGitHubPR: null }
    : updates
}
