import type { HostedReviewInfo } from '../../shared/hosted-review'
import type { RuntimeWorktreeRecord } from '../../shared/runtime-types'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { RuntimeClientError, type RuntimeClient } from '../runtime-client'

type ReviewUnlinkUpdate = Partial<
  Pick<WorktreeMeta, 'linkedPR' | 'suppressedGitHubPR' | 'linkedGitLabMR' | 'suppressedGitLabMR'>
>

const CONFLICTING_REVIEW_FLAGS = ['pr', 'gitlab-mr'] as const

export function hasUnlinkReviewFlag(flags: Map<string, string | boolean>): boolean {
  const value = flags.get('unlink-review')
  if (typeof value === 'string') {
    throw new RuntimeClientError('invalid_argument', '--unlink-review takes no value.')
  }
  if (value !== true) {
    return false
  }
  for (const name of CONFLICTING_REVIEW_FLAGS) {
    if (flags.has(name)) {
      throw new RuntimeClientError(
        'invalid_argument',
        `Choose either --unlink-review or --${name}, not both.`
      )
    }
  }
  return true
}

/** Clears the linked review, or hides the branch-detected one, the way the sidebar's Unlink does. */
export async function resolveReviewUnlinkUpdate(
  client: RuntimeClient,
  worktree: string
): Promise<ReviewUnlinkUpdate> {
  const shown = await client.call<{ worktree: RuntimeWorktreeRecord }>('worktree.show', {
    worktree
  })
  const record = shown.result.worktree
  if (typeof record.linkedPR === 'number') {
    return { linkedPR: null, suppressedGitHubPR: record.linkedPR }
  }
  if (typeof record.linkedGitLabMR === 'number') {
    return { linkedGitLabMR: null, suppressedGitLabMR: record.linkedGitLabMR }
  }
  const branch = record.branch.replace(/^refs\/heads\//, '')
  const review = branch
    ? (
        await client.call<HostedReviewInfo | null>(
          'hostedReview.forBranch',
          { repo: `id:${record.repoId}`, branch },
          { timeoutMs: 30_000 }
        )
      ).result
    : null
  if (review?.provider === 'github') {
    return { suppressedGitHubPR: review.number }
  }
  if (review?.provider === 'gitlab') {
    return { suppressedGitLabMR: review.number }
  }
  throw new RuntimeClientError(
    'invalid_argument',
    review
      ? `Unlinking is supported for GitHub pull requests and GitLab merge requests, not ${review.provider}.`
      : 'This workspace has no linked or detected review to unlink.'
  )
}

/** An older host drops suppression it does not know, so the unlink would not stick. */
export function assertReviewUnlinkApplied(
  update: ReviewUnlinkUpdate,
  record: RuntimeWorktreeRecord
): void {
  const field =
    update.suppressedGitLabMR !== undefined ? 'suppressedGitLabMR' : 'suppressedGitHubPR'
  if (record[field] !== update[field]) {
    throw new RuntimeClientError(
      'runtime_unavailable',
      'The review link was cleared, but this Orca host is too old to keep a detected review hidden. Update Orca on the host and try again.'
    )
  }
}
