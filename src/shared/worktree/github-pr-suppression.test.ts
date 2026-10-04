import { describe, expect, it } from 'vitest'
import {
  NATIVE_REMOTE_RUNTIME_CLIENT_CAPABILITIES,
  RUNTIME_CAPABILITIES,
  WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY,
  WORKTREE_GITLAB_MR_SUPPRESSION_RUNTIME_CAPABILITY
} from '../protocol-version'
import { remoteRuntimeClientCapabilities } from '../remote-runtime-client-capabilities'
import {
  isGitHubPRSuppressed,
  isHostedReviewSuppressed,
  normalizeGitHubPRSuppressionUpdate,
  normalizeReviewSuppressionUpdate
} from './github-pr-suppression'

describe('GitHub PR suppression', () => {
  it('suppresses only a matching discovered PR without an explicit link', () => {
    expect(isGitHubPRSuppressed({ linkedPR: null, suppressedGitHubPR: 42 }, 42)).toBe(true)
    expect(isGitHubPRSuppressed({ linkedPR: null, suppressedGitHubPR: 42 }, 43)).toBe(false)
  })

  it('lets an explicit GitHub PR link override stale suppression metadata', () => {
    expect(isGitHubPRSuppressed({ linkedPR: 42, suppressedGitHubPR: 42 }, 42)).toBe(false)
  })

  it('clears suppression in the same update that explicitly links a PR', () => {
    expect(normalizeGitHubPRSuppressionUpdate({ linkedPR: 42, suppressedGitHubPR: 7 })).toEqual({
      linkedPR: 42,
      suppressedGitHubPR: null
    })
    const clear = { linkedPR: null, suppressedGitHubPR: 42 }
    expect(normalizeGitHubPRSuppressionUpdate(clear)).toBe(clear)
  })

  it('advertises suppression support from hosts and native remote clients', () => {
    expect(RUNTIME_CAPABILITIES).toContain(WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY)
    expect(NATIVE_REMOTE_RUNTIME_CLIENT_CAPABILITIES).toContain(
      WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY
    )
    expect(remoteRuntimeClientCapabilities()).toContain(
      WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY
    )
  })
})

describe('GitLab MR suppression', () => {
  const unlinked = {
    linkedPR: null,
    suppressedGitHubPR: 42,
    linkedGitLabMR: null,
    suppressedGitLabMR: 7
  }

  it('suppresses only the matching discovered review of each provider', () => {
    expect(isHostedReviewSuppressed(unlinked, { provider: 'gitlab', number: 7 })).toBe(true)
    expect(isHostedReviewSuppressed(unlinked, { provider: 'gitlab', number: 8 })).toBe(false)
    expect(isHostedReviewSuppressed(unlinked, { provider: 'gitlab', number: 42 })).toBe(false)
    expect(isHostedReviewSuppressed(unlinked, { provider: 'github', number: 42 })).toBe(true)
    expect(isHostedReviewSuppressed(unlinked, { provider: 'bitbucket', number: 7 })).toBe(false)
  })

  it('lets an explicit GitLab MR link override stale suppression metadata', () => {
    expect(
      isHostedReviewSuppressed(
        { ...unlinked, linkedGitLabMR: 7 },
        { provider: 'gitlab', number: 7 }
      )
    ).toBe(false)
  })

  it('clears GitLab suppression in the same update that explicitly links an MR', () => {
    expect(normalizeReviewSuppressionUpdate({ linkedGitLabMR: 9, suppressedGitLabMR: 7 })).toEqual({
      linkedGitLabMR: 9,
      suppressedGitLabMR: null
    })
    const clear = { linkedGitLabMR: null, suppressedGitLabMR: 7 }
    expect(normalizeReviewSuppressionUpdate(clear)).toBe(clear)
  })

  it('advertises GitLab suppression support from hosts and native remote clients', () => {
    expect(RUNTIME_CAPABILITIES).toContain(WORKTREE_GITLAB_MR_SUPPRESSION_RUNTIME_CAPABILITY)
    expect(NATIVE_REMOTE_RUNTIME_CLIENT_CAPABILITIES).toContain(
      WORKTREE_GITLAB_MR_SUPPRESSION_RUNTIME_CAPABILITY
    )
    expect(remoteRuntimeClientCapabilities()).toContain(
      WORKTREE_GITLAB_MR_SUPPRESSION_RUNTIME_CAPABILITY
    )
  })
})
