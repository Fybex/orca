import { describe, expect, it } from 'vitest'
import { formatWorktreeList, formatWorktreePs } from './workspace-format'
import type { RuntimeWorktreePsSummary, RuntimeWorktreeRecord } from '../shared/runtime-types'

function listRow(overrides: Partial<RuntimeWorktreeRecord>): RuntimeWorktreeRecord {
  return {
    id: 'api::/w/api',
    repoId: 'api',
    path: '/w/api',
    head: 'abc123',
    branch: 'checkout-flow',
    isBare: false,
    isMainWorktree: false,
    parentWorktreeId: null,
    childWorktreeIds: [],
    lineage: null,
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    git: {
      path: '/w/api',
      head: 'abc123',
      branch: 'checkout-flow',
      isBare: false,
      isMainWorktree: false
    },
    displayName: '',
    comment: '',
    ...overrides
  }
}

function psRow(overrides: Partial<RuntimeWorktreePsSummary>): RuntimeWorktreePsSummary {
  return {
    worktreeId: 'api::/w/api',
    repoId: 'api',
    repo: 'api',
    path: '/w/api',
    branch: 'checkout-flow',
    isArchived: false,
    isMainWorktree: false,
    hasHostSidebarActivity: false,
    parentWorktreeId: null,
    childWorktreeIds: [],
    displayName: '',
    workspaceStatus: 'todo',
    sortOrder: 0,
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    linkedGitLabMR: null,
    linkedGitLabIssue: null,
    comment: '',
    isPinned: false,
    isActive: false,
    unread: false,
    liveTerminalCount: 0,
    hasAttachedPty: false,
    lastOutputAt: null,
    preview: '',
    status: 'inactive',
    agents: [],
    ...overrides
  }
}

describe('folder workspace lineage in worktree text output', () => {
  it('prints the folder a listed worktree is attached to only when it has one', () => {
    const output = formatWorktreeList({
      worktrees: [listRow({ parentWorkspaceKey: 'folder:fw-1' }), listRow({ id: 'api::/w/b' })],
      totalCount: 2,
      truncated: false
    })

    expect(output.match(/parentWorkspaceKey: .*/g)).toEqual(['parentWorkspaceKey: folder:fw-1'])
  })

  it('prints attached rows and folder rows in ps', () => {
    const output = formatWorktreePs({
      worktrees: [
        psRow({ parentWorkspaceKey: 'folder:fw-1' }),
        psRow({ path: '/f/checkout', childWorkspaceKeys: ['worktree:api::/w/api'] }),
        psRow({ path: '/w/other', parentWorkspaceKey: null, childWorkspaceKeys: [] })
      ],
      totalCount: 3,
      truncated: false
    })

    expect(output).toContain('/w/api\nparentWorkspaceKey: folder:fw-1')
    expect(output).toContain('/f/checkout\nchildWorkspaceKeys: worktree:api::/w/api')
    expect(output).not.toMatch(/\/w\/other\n\S/)
  })
})
