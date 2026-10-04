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
import { buildWorktree, okFixture, queueFixtures, worktreeListFixture } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

describe('orca cli worktree create names', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  const agentWorktree = buildWorktree('/tmp/repo/fix-login', 'fix-login', 'abc', 'repo-1')

  function createArgs(extra: string[]): string[] {
    return ['worktree', 'create', '--repo', 'id:repo-1', '--name', 'fix-login', ...extra, '--json']
  }

  function callParams(method: string): unknown {
    return callMock.mock.calls.find(([name]) => name === method)?.[1]
  }

  it('pins --display-name apart from the branch name', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([buildWorktree('/tmp/repo', 'main', 'abc', 'repo-1')]),
      okFixture('req_create', { worktree: agentWorktree, lineage: null, warnings: [] })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(createArgs(['--display-name', 'Fix login redirect']), '/tmp/repo')

    expect(callParams('worktree.create')).toMatchObject({
      name: 'fix-login',
      displayName: 'Fix login redirect',
      displayNameKind: 'user'
    })
  })

  it('titles the agent terminal with --agent-title after create', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([buildWorktree('/tmp/repo', 'main', 'abc', 'repo-1')]),
      okFixture('req_create', {
        worktree: agentWorktree,
        lineage: null,
        warnings: [],
        startupTerminal: { spawned: true, handle: 'term_old' },
        agentTerminalHandle: 'term_agent'
      }),
      okFixture('req_rename', { rename: { handle: 'term_agent', title: 'Login fix' } })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      createArgs(['--agent', 'claude', '--prompt', 'hi', '--agent-title', 'Login fix']),
      '/tmp/repo'
    )

    expect(callParams('worktree.create')).toMatchObject({
      displayName: 'fix-login',
      startupAgent: 'claude'
    })
    expect(callParams('terminal.rename')).toEqual({ terminal: 'term_agent', title: 'Login fix' })
  })

  it('falls back to the startup terminal handle from older hosts', async () => {
    queueFixtures(
      callMock,
      worktreeListFixture([buildWorktree('/tmp/repo', 'main', 'abc', 'repo-1')]),
      okFixture('req_create', {
        worktree: agentWorktree,
        lineage: null,
        warnings: [],
        startupTerminal: { spawned: true, handle: 'term_startup' }
      }),
      okFixture('req_rename', { rename: { handle: 'term_startup', title: 'Login fix' } })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(createArgs(['--agent', 'claude', '--agent-title', 'Login fix']), '/tmp/repo')

    expect(callParams('terminal.rename')).toEqual({ terminal: 'term_startup', title: 'Login fix' })
  })

  it('keeps the created worktree and warns when no agent terminal comes back', async () => {
    const priorExitCode = process.exitCode
    queueFixtures(
      callMock,
      worktreeListFixture([buildWorktree('/tmp/repo', 'main', 'abc', 'repo-1')]),
      okFixture('req_create', { worktree: agentWorktree, lineage: null, warnings: [] })
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await main(createArgs(['--agent', 'claude', '--agent-title', 'Login fix']), '/tmp/repo')

    expect(callParams('terminal.rename')).toBeUndefined()
    expect(errSpy.mock.calls.flat().join('\n')).toContain('--agent-title was not applied')
    expect(logSpy.mock.calls.flat().join('\n')).toContain('fix-login')
    expect(process.exitCode).toBe(priorExitCode)
  })

  it('refuses --agent-title without --agent before creating anything', async () => {
    const priorExitCode = process.exitCode
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(createArgs(['--agent-title', 'Login fix']), '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect([...errSpy.mock.calls, ...logSpy.mock.calls].flat().join('\n')).toContain(
      '--agent-title requires --agent.'
    )
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  })

  it('refuses a blank --display-name', async () => {
    const priorExitCode = process.exitCode
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(createArgs(['--display-name', '   ']), '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect([...errSpy.mock.calls, ...logSpy.mock.calls].flat().join('\n')).toContain(
      '--display-name cannot be blank.'
    )
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  })
})
