import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  addEnvironmentFromPairingCodeMock,
  listEnvironmentsMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  addEnvironmentFromPairingCodeMock: vi.fn(),
  listEnvironmentsMock: vi.fn(),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('./runtime/environments', () => ({
  addEnvironmentFromPairingCode: addEnvironmentFromPairingCodeMock,
  listEnvironments: listEnvironmentsMock,
  removeEnvironment: vi.fn(),
  resolveEnvironment: vi.fn()
}))

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { buildWorktree, okFixture, queueFixtures } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

describe('orca worktree set --unlink-review', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  const selector = 'id:repo::/tmp/repo/feature'
  const feature = buildWorktree('/tmp/repo/feature', 'refs/heads/feature/foo')

  async function runUnlink(extra: string[] = []): Promise<string> {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await main(
      ['worktree', 'set', '--worktree', selector, '--unlink-review', ...extra, '--json'],
      '/tmp/repo'
    )
    return [...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')
  }

  function lastSetParams(): Record<string, unknown> {
    const call = callMock.mock.calls.findLast(([method]) => method === 'worktree.set')
    return call?.[1]
  }

  it('clears an explicit GitHub link and suppresses its number', async () => {
    queueFixtures(
      callMock,
      okFixture('req_show', { worktree: { ...feature, linkedPR: 42 } }),
      okFixture('req_set', {
        worktree: { ...feature, linkedPR: null, suppressedGitHubPR: 42 }
      })
    )

    await runUnlink()

    expect(callMock).not.toHaveBeenCalledWith(
      'hostedReview.forBranch',
      expect.anything(),
      expect.anything()
    )
    expect(lastSetParams()).toMatchObject({
      worktree: selector,
      linkedPR: null,
      suppressedGitHubPR: 42
    })
  })

  it('hides a branch-detected GitLab MR by its number', async () => {
    queueFixtures(
      callMock,
      okFixture('req_show', { worktree: feature }),
      okFixture('req_review', { provider: 'gitlab', number: 7, title: 'MR', state: 'open' }),
      okFixture('req_set', { worktree: { ...feature, suppressedGitLabMR: 7 } })
    )

    const output = await runUnlink()

    expect(callMock).toHaveBeenCalledWith(
      'hostedReview.forBranch',
      { repo: 'id:repo', branch: 'feature/foo' },
      { timeoutMs: 30_000 }
    )
    expect(lastSetParams()).toMatchObject({ worktree: selector, suppressedGitLabMR: 7 })
    expect(output).toContain('"suppressedGitLabMR": 7')
  })

  it('fails when the host drops the suppression it does not know', async () => {
    const priorExitCode = process.exitCode
    queueFixtures(
      callMock,
      okFixture('req_show', { worktree: feature }),
      okFixture('req_review', { provider: 'gitlab', number: 7, title: 'MR', state: 'open' }),
      okFixture('req_set', { worktree: feature })
    )

    const output = await runUnlink()

    expect(output).toContain('too old to keep a detected review hidden')
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  })

  it('reports when there is no review to unlink', async () => {
    const priorExitCode = process.exitCode
    queueFixtures(
      callMock,
      okFixture('req_show', { worktree: feature }),
      okFixture('req_review', null)
    )

    const output = await runUnlink()

    expect(output).toContain('no linked or detected review to unlink')
    expect(lastSetParams()).toBeUndefined()
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  })

  it('refuses --unlink-review together with a review link flag', async () => {
    const priorExitCode = process.exitCode

    const output = await runUnlink(['--pr', '42'])

    expect(callMock).not.toHaveBeenCalled()
    expect(output).toContain('Choose either --unlink-review or --pr, not both.')
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  })
})
