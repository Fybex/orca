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
import { buildWorktree, okFixture, worktreeListFixture } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

describe('orca cli worktree create repo from a folder parent', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    addEnvironmentFromPairingCodeMock,
    listEnvironmentsMock,
    spawnMock
  })

  const apiChild = buildWorktree('/tmp/api/feature', 'feature', 'abc', 'repo-api')
  const webChild = buildWorktree('/tmp/web/feature', 'feature', 'abc', 'repo-web')
  const unrelated = buildWorktree('/tmp/docs/other', 'other', 'abc', 'repo-docs')

  function attachedTo(worktrees: { id: string }[]): Record<string, unknown> {
    return Object.fromEntries(
      worktrees.map((worktree) => [
        `worktree:${worktree.id}`,
        {
          childWorkspaceKey: `worktree:${worktree.id}`,
          childInstanceId: null,
          parentWorkspaceKey: 'folder:folder-1',
          parentInstanceId: null,
          origin: 'cli',
          capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
          createdAt: 1
        }
      ])
    )
  }

  function serveHost(attached: { id: string }[]): void {
    callMock.mockImplementation(async (method: string) => {
      switch (method) {
        case 'worktree.list':
          return worktreeListFixture([apiChild, webChild, unrelated])
        case 'worktree.lineageList':
          return okFixture('req_lineage', { workspaceLineage: attachedTo(attached) })
        case 'repo.list':
          return okFixture('req_repos', {
            repos: [
              { id: 'repo-api', displayName: 'api' },
              { id: 'repo-web', displayName: 'web' }
            ]
          })
        case 'worktree.create':
          return okFixture('req_create', {
            worktree: buildWorktree('/tmp/api/child', 'child', 'abc', 'repo-api'),
            lineage: null,
            warnings: []
          })
        default:
          throw new Error(`unexpected ${method}`)
      }
    })
  }

  function createParams(): unknown {
    return callMock.mock.calls.find(([method]) => method === 'worktree.create')?.[1]
  }

  async function createUnderFolder(cwd: string): Promise<string> {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await main(
      ['worktree', 'create', '--name', 'child', '--parent-worktree', 'folder:folder-1', '--json'],
      cwd
    )
    return [...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')
  }

  it("uses the folder's only repo when --repo is omitted", async () => {
    serveHost([apiChild])

    await createUnderFolder('/tmp/elsewhere')

    expect(createParams()).toMatchObject({
      repo: 'id:repo-api',
      parentWorkspace: 'folder:folder-1'
    })
  })

  it('fails and lists the repos when the folder links several', async () => {
    const priorExitCode = process.exitCode
    serveHost([apiChild, webChild])

    const output = await createUnderFolder('/tmp/elsewhere')

    expect(createParams()).toBeUndefined()
    expect(output).toContain(
      'The folder workspace links several repos: api (id:repo-api), web (id:repo-web). Pass --repo to choose one.'
    )
    expect(process.exitCode).toBe(1)
    process.exitCode = priorExitCode
  })

  it("picks the cwd's repo when it is one of the folder's several repos", async () => {
    serveHost([apiChild, webChild])

    await createUnderFolder('/tmp/web/feature/src')

    expect(createParams()).toMatchObject({ repo: 'id:repo-web' })
  })

  it('keeps an explicit --repo without reading the folder', async () => {
    serveHost([apiChild])
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'worktree',
        'create',
        '--repo',
        'id:repo-docs',
        '--name',
        'child',
        '--parent-worktree',
        'folder:folder-1',
        '--json'
      ],
      '/tmp/elsewhere'
    )

    expect(createParams()).toMatchObject({ repo: 'id:repo-docs' })
    expect(callMock.mock.calls.map(([method]) => method)).toEqual(['worktree.create'])
  })
})
