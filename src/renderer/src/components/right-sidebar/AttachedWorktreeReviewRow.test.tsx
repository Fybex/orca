// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'

const mocks = vi.hoisted(() => {
  const state: {
    gitBranchCompareSummaryByWorktree: Record<string, { status: string }>
    gitBranchChangesByWorktree: Record<string, unknown[]>
  } = {
    gitBranchCompareSummaryByWorktree: {},
    gitBranchChangesByWorktree: {}
  }
  const observers: { callback: (entries: { isIntersecting: boolean }[]) => void }[] = []
  return {
    state,
    observers,
    loadAttachedWorktreeBranchCompare: vi.fn(async () => null)
  }
})

vi.mock('@/store', () => {
  const useAppStore = <T,>(selector: (state: typeof mocks.state) => T): T => selector(mocks.state)
  useAppStore.getState = () => mocks.state
  return { useAppStore }
})

vi.mock('@/i18n/i18n', () => ({
  getIntlLocale: () => 'en',
  translate: (_key: string, fallback: string) => fallback
}))

vi.mock('@/lib/sidebar-worktree-activation', () => ({
  activateWorktreeFromSidebar: vi.fn()
}))

vi.mock('./attached-worktree-branch-compare', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadAttachedWorktreeBranchCompare: mocks.loadAttachedWorktreeBranchCompare,
  reviewAttachedWorktreeChanges: vi.fn()
}))

import { AttachedWorktreeDiffStatsLine } from './AttachedWorktreeReviewRow'
import { ATTACHED_WORKTREE_REFRESH_INTERVAL_MS } from './attached-worktree-branch-compare'

class FakeIntersectionObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    mocks.observers.push({ callback })
  }
  observe(): void {}
  disconnect(): void {}
}

const repo: Repo = {
  id: 'repo-1',
  path: '/repo',
  displayName: 'Repo',
  badgeColor: '#fff',
  addedAt: 1
}

let root: Root | null = null
let container: HTMLDivElement | null = null
let now = 0
let worktreeCounter = 0

function makeWorktree(): Worktree {
  worktreeCounter += 1
  return {
    id: `repo-1::/worktrees/child-${worktreeCounter}`,
    path: `/worktrees/child-${worktreeCounter}`,
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
    lastActivityAt: 0
  }
}

function renderRow(worktree: Worktree): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root?.render(<AttachedWorktreeDiffStatsLine worktree={worktree} repo={repo} />)
  })
}

function setRowVisible(isIntersecting: boolean): void {
  act(() => {
    mocks.observers.at(-1)?.callback([{ isIntersecting }])
  })
}

function focusWindow(): void {
  act(() => {
    window.dispatchEvent(new Event('focus'))
  })
}

beforeEach(() => {
  mocks.observers.length = 0
  mocks.state.gitBranchCompareSummaryByWorktree = {}
  mocks.loadAttachedWorktreeBranchCompare.mockClear()
  now = 1_000_000 * (worktreeCounter + 1)
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
})

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('AttachedWorktreeDiffStatsLine refresh', () => {
  it('loads the compare when the row first becomes visible', () => {
    renderRow(makeWorktree())

    setRowVisible(true)

    expect(mocks.loadAttachedWorktreeBranchCompare).toHaveBeenCalledTimes(1)
  })

  it('recomputes on window focus once the interval has passed', () => {
    renderRow(makeWorktree())
    setRowVisible(true)

    now += ATTACHED_WORKTREE_REFRESH_INTERVAL_MS - 1
    focusWindow()
    expect(mocks.loadAttachedWorktreeBranchCompare).toHaveBeenCalledTimes(1)

    now += 1
    focusWindow()
    expect(mocks.loadAttachedWorktreeBranchCompare).toHaveBeenCalledTimes(2)
  })

  it('recomputes when the panel shows the row again', () => {
    renderRow(makeWorktree())
    setRowVisible(true)
    setRowVisible(false)

    now += ATTACHED_WORKTREE_REFRESH_INTERVAL_MS
    setRowVisible(true)

    expect(mocks.loadAttachedWorktreeBranchCompare).toHaveBeenCalledTimes(2)
  })

  it('skips rows that are out of view or already loading', () => {
    const worktree = makeWorktree()
    renderRow(worktree)
    focusWindow()
    expect(mocks.loadAttachedWorktreeBranchCompare).not.toHaveBeenCalled()

    mocks.state.gitBranchCompareSummaryByWorktree[worktree.id] = { status: 'loading' }
    setRowVisible(true)
    expect(mocks.loadAttachedWorktreeBranchCompare).not.toHaveBeenCalled()
  })
})
