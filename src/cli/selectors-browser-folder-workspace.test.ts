import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserCommandTarget, getBrowserWorktreeSelector } from './selectors'
import type { RuntimeClient } from './runtime-client'

function client(isRemote = false): { call: ReturnType<typeof vi.fn>; runtime: RuntimeClient } {
  const call = vi.fn(async () => ({
    id: 'req',
    ok: true,
    result: {
      worktrees: [{ id: 'repo::/w/feature', path: '/w/feature' }],
      totalCount: 1,
      truncated: false
    },
    _meta: { runtimeId: 'runtime-1' }
  }))
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the selectors use only call and isRemote.
  return { call, runtime: { call, isRemote } as unknown as RuntimeClient }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('browser current/active in a folder workspace terminal', () => {
  it.each(['current', 'active'])('%s names the terminal folder workspace', async (value) => {
    vi.stubEnv('ORCA_WORKSPACE_ID', '')
    vi.stubEnv('ORCA_WORKTREE_ID', 'folder:fw-1')
    const rpc = client()

    await expect(
      getBrowserWorktreeSelector(new Map([['worktree', value]]), '/f/checkout', rpc.runtime)
    ).resolves.toBe('id:folder:fw-1')
    await expect(
      getBrowserCommandTarget(
        new Map([
          ['worktree', value],
          ['page', 'page-1']
        ]),
        '/f/checkout',
        rpc.runtime
      )
    ).resolves.toEqual({ page: 'page-1', worktree: 'id:folder:fw-1' })
    expect(rpc.call).not.toHaveBeenCalled()
  })

  it('keeps resolving a git worktree terminal from its cwd', async () => {
    vi.stubEnv('ORCA_WORKSPACE_ID', '')
    vi.stubEnv('ORCA_WORKTREE_ID', 'repo::/w/feature')
    const rpc = client()

    await expect(
      getBrowserWorktreeSelector(new Map([['worktree', 'current']]), '/w/feature/src', rpc.runtime)
    ).resolves.toBe('id:repo::/w/feature')
  })

  it('refuses current against a remote runtime even in a folder terminal', async () => {
    vi.stubEnv('ORCA_WORKTREE_ID', 'folder:fw-1')

    await expect(
      getBrowserWorktreeSelector(
        new Map([['worktree', 'current']]),
        '/f/checkout',
        client(true).runtime
      )
    ).rejects.toMatchObject({ code: 'invalid_argument' })
  })
})
