import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitBranchCompareSummary } from '../../../../shared/git-diff-compare-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

const mocks = vi.hoisted(() => {
  const gitBranchCompareSummaryByWorktree: Record<string, GitBranchCompareSummary> = {}
  return {
    state: {
      settings: null,
      gitBranchCompareSummaryByWorktree,
      beginGitBranchCompareRequest: vi.fn(),
      setGitBranchCompareResult: vi.fn(),
      openBranchAllDiffs: vi.fn()
    },
    getRuntimeGitBranchCompare: vi.fn(),
    getRuntimeRepoBaseRefDefault: vi.fn(),
    activateWorktreeFromSidebar: vi.fn()
  }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => mocks.state } }))
vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))
vi.mock('@/lib/repo-runtime-owner', () => ({ getRepoOwnerRoutedSettings: () => null }))
vi.mock('@/lib/sidebar-worktree-activation', () => ({
  activateWorktreeFromSidebar: mocks.activateWorktreeFromSidebar
}))
vi.mock('@/runtime/runtime-git-client', () => ({
  getRuntimeGitBranchCompare: mocks.getRuntimeGitBranchCompare
}))
vi.mock('@/runtime/runtime-repo-client', () => ({
  getRuntimeRepoBaseRefDefault: mocks.getRuntimeRepoBaseRefDefault
}))

import {
  getAttachedWorktreeDiffStats,
  loadAttachedWorktreeBranchCompare,
  resolveAttachedWorktreePinnedBaseRef,
  reviewAttachedWorktreeChanges
} from './attached-worktree-branch-compare'

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-1',
    path: '/repo',
    displayName: 'Repo',
    badgeColor: '#fff',
    addedAt: 1,
    ...overrides
  }
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo-1::/worktrees/child',
    path: '/worktrees/child',
    head: 'abc',
    branch: 'refs/heads/child',
    isBare: false,
    isMainWorktree: false,
    repoId: 'repo-1',
    displayName: 'child',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    linkedGitLabMR: null,
    linkedGitLabIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}

function makeSummary(overrides: Partial<GitBranchCompareSummary> = {}): GitBranchCompareSummary {
  return {
    baseRef: 'origin/main',
    baseOid: 'base',
    compareRef: 'refs/heads/child',
    headOid: 'head',
    mergeBase: 'base',
    changedFiles: 2,
    commitsAhead: 3,
    status: 'ready',
    ...overrides
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state.gitBranchCompareSummaryByWorktree = {}
})

describe('resolveAttachedWorktreePinnedBaseRef', () => {
  it('prefers the worktree base, so a stacked child diffs against its parent branch', () => {
    expect(
      resolveAttachedWorktreePinnedBaseRef({ baseRef: 'parent-branch' }, { worktreeBaseRef: 'dev' })
    ).toBe('parent-branch')
  })

  it('falls back to the repo base and then to null', () => {
    expect(resolveAttachedWorktreePinnedBaseRef({ baseRef: ' ' }, { worktreeBaseRef: 'dev' })).toBe(
      'dev'
    )
    expect(resolveAttachedWorktreePinnedBaseRef({}, {})).toBeNull()
  })
})

describe('getAttachedWorktreeDiffStats', () => {
  it('sums line counts over the changed files', () => {
    expect(
      getAttachedWorktreeDiffStats(makeSummary(), [
        { path: 'a.ts', status: 'modified', added: 4, removed: 1 },
        { path: 'b.ts', status: 'added', added: 10 }
      ])
    ).toEqual({ changedFiles: 2, added: 14, removed: 1, commitsAhead: 3 })
  })

  it('returns null until the compare is ready', () => {
    expect(getAttachedWorktreeDiffStats(makeSummary({ status: 'loading' }), [])).toBeNull()
    expect(getAttachedWorktreeDiffStats(undefined, undefined)).toBeNull()
  })
})

describe('loadAttachedWorktreeBranchCompare', () => {
  it('compares a stacked child against its parent branch in its own slot', async () => {
    const summary = makeSummary({ baseRef: 'parent-branch' })
    mocks.getRuntimeGitBranchCompare.mockResolvedValue({ summary, entries: [] })
    const worktree = makeWorktree({ baseRef: 'parent-branch' })

    await expect(loadAttachedWorktreeBranchCompare(worktree, makeRepo())).resolves.toBe(summary)

    expect(mocks.getRuntimeRepoBaseRefDefault).not.toHaveBeenCalled()
    const [slotId, requestKey, baseRef] = mocks.state.beginGitBranchCompareRequest.mock.calls[0]
    expect(slotId).toBe(worktree.id)
    expect(baseRef).toBe('parent-branch')
    expect(mocks.getRuntimeGitBranchCompare).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: worktree.id, worktreePath: worktree.path }),
      'parent-branch',
      'background'
    )
    expect(mocks.state.setGitBranchCompareResult).toHaveBeenCalledWith(worktree.id, requestKey, {
      summary,
      entries: []
    })
  })

  it('uses the repo default base when nothing is pinned', async () => {
    mocks.getRuntimeRepoBaseRefDefault.mockResolvedValue({ defaultBaseRef: 'origin/main' })
    mocks.getRuntimeGitBranchCompare.mockResolvedValue({ summary: makeSummary(), entries: [] })

    await loadAttachedWorktreeBranchCompare(makeWorktree(), makeRepo())

    expect(mocks.getRuntimeGitBranchCompare.mock.calls[0][1]).toBe('origin/main')
  })

  it('stores an error summary when the compare fails', async () => {
    mocks.getRuntimeGitBranchCompare.mockRejectedValue(new Error('git exploded'))

    const summary = await loadAttachedWorktreeBranchCompare(
      makeWorktree({ baseRef: 'origin/main' }),
      makeRepo()
    )

    expect(summary).toMatchObject({ status: 'error', errorMessage: 'git exploded' })
  })

  it('skips folder repos', async () => {
    await expect(
      loadAttachedWorktreeBranchCompare(makeWorktree(), makeRepo({ kind: 'folder' }))
    ).resolves.toBeNull()
    expect(mocks.getRuntimeGitBranchCompare).not.toHaveBeenCalled()
  })
})

describe('reviewAttachedWorktreeChanges', () => {
  it('activates the worktree and opens its combined diff from the stored compare', async () => {
    const worktree = makeWorktree()
    const summary = makeSummary()
    mocks.state.gitBranchCompareSummaryByWorktree = { [worktree.id]: summary }

    await reviewAttachedWorktreeChanges(worktree, makeRepo())

    expect(mocks.activateWorktreeFromSidebar).toHaveBeenCalledWith(worktree.id, 'local')
    expect(mocks.getRuntimeGitBranchCompare).not.toHaveBeenCalled()
    expect(mocks.state.openBranchAllDiffs).toHaveBeenCalledWith(worktree.id, worktree.path, summary)
  })
})
