// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { HostedReviewInfo } from '../../../../../../shared/hosted-review'
import type { PRInfo } from '../../../../../../shared/github/pull-request-types'
import { useSourceControlHostedReviewState } from './use-hosted-review-state'

function makePR(number = 42): PRInfo {
  return {
    number,
    title: 'Detected pull request',
    state: 'open',
    url: `https://github.com/acme/orca/pull/${number}`,
    checksStatus: 'pending',
    updatedAt: '2026-08-27T00:00:00Z',
    mergeable: 'UNKNOWN'
  }
}

function renderState({
  pr = makePR(),
  hostedReviewEntryData = null,
  linkedPR = null,
  suppressedGitHubPR = null,
  linkedGitLabMR = null,
  suppressedGitLabMR = null
}: {
  pr?: PRInfo | null
  hostedReviewEntryData?: HostedReviewInfo | null
  linkedPR?: number | null
  suppressedGitHubPR?: number | null
  linkedGitLabMR?: number | null
  suppressedGitLabMR?: number | null
} = {}) {
  return renderHook(() =>
    useSourceControlHostedReviewState({
      activePrFromQueue: pr,
      activeRepoId: 'repo-1',
      activeWorktreeId: 'wt-1',
      branchName: 'feature',
      hostedReviewCacheKey: 'cache-key',
      hostedReviewEntryData,
      linkedPR,
      suppressedGitHubPR,
      linkedGitLabMR,
      suppressedGitLabMR
    })
  ).result.current
}

describe('useSourceControlHostedReviewState', () => {
  it('hides a matching suppressed PR and blocks duplicate creation', () => {
    const state = renderState({ suppressedGitHubPR: 42 })

    expect(state.hostedReview).toBeNull()
    expect(state.hasSuppressedGitHubPR).toBe(true)
    expect(state.hostedReviewCreation).toMatchObject({
      provider: 'github',
      canCreate: false,
      blockedReason: 'existing_review',
      review: { number: 42 }
    })
  })

  it('shows a different detected PR and lets an explicit link win', () => {
    expect(renderState({ pr: makePR(43), suppressedGitHubPR: 42 }).hostedReview?.number).toBe(43)
    expect(renderState({ linkedPR: 42, suppressedGitHubPR: 42 }).hostedReview?.number).toBe(42)
  })

  const gitLabReview: HostedReviewInfo = {
    provider: 'gitlab',
    number: 42,
    title: 'GitLab review',
    state: 'open',
    url: 'https://gitlab.com/acme/orca/-/merge_requests/42',
    status: 'pending',
    updatedAt: '2026-08-27T00:00:00Z',
    mergeable: 'UNKNOWN'
  }

  it('preserves non-GitHub reviews', () => {
    expect(
      renderState({
        pr: null,
        hostedReviewEntryData: gitLabReview,
        suppressedGitHubPR: 42
      }).hostedReview
    ).toBe(gitLabReview)
  })

  it('hides a matching suppressed GitLab MR and blocks duplicate creation', () => {
    const state = renderState({
      pr: null,
      hostedReviewEntryData: gitLabReview,
      suppressedGitLabMR: 42
    })

    expect(state.hostedReview).toBeNull()
    expect(state.hostedReviewCreation).toMatchObject({
      provider: 'gitlab',
      canCreate: false,
      review: { number: 42 }
    })
    expect(
      renderState({
        pr: null,
        hostedReviewEntryData: gitLabReview,
        linkedGitLabMR: 42,
        suppressedGitLabMR: 42
      }).hostedReview
    ).toBe(gitLabReview)
  })
})
