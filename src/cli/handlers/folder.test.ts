import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseArgs, REPEATED_FLAG_SEPARATOR } from '../args'
import { specPaths } from '../command-spec'
import { COMMAND_SPECS } from '../specs'
import type { FolderWorkspace } from '../../shared/folder-workspace-types'
import type { WorkspaceLineage } from '../../shared/worktree/lineage-types'
import { FOLDER_HANDLERS } from './folder'

type Responder = (params: Record<string, unknown> | undefined) => unknown

function folderWorkspace(overrides: Partial<FolderWorkspace>): FolderWorkspace {
  return {
    id: 'fw-1',
    projectGroupId: 'g-1',
    name: 'Checkout flow',
    folderPath: '/orca/features/checkout-flow',
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  }
}

function attachedLineage(worktreeId: string, folderId: string): WorkspaceLineage {
  return {
    childWorkspaceKey: `worktree:${worktreeId}`,
    childInstanceId: `${worktreeId}#1`,
    parentWorkspaceKey: `folder:${folderId}`,
    parentInstanceId: null,
    origin: 'cli',
    capture: { source: 'explicit-cli-flag', confidence: 'explicit' },
    createdAt: 1
  }
}

function worktreeRow(id: string, extra: Record<string, unknown> = {}) {
  const [repoId, path] = id.split('::')
  return {
    id,
    instanceId: `${id}#1`,
    repoId,
    path,
    branch: 'checkout-flow',
    displayName: repoId,
    ...extra
  }
}

const groups = [
  { id: 'g-1', name: 'Platform', parentPath: '/src/platform' },
  { id: 'g-2', name: 'Docs', parentPath: '/src/docs' }
]
const folders = [
  folderWorkspace({}),
  folderWorkspace({ id: 'fw-2', projectGroupId: 'g-2', name: 'Guides', folderPath: '/src/docs' })
]

function client(overrides: Record<string, Responder> = {}, options: { isRemote?: boolean } = {}) {
  const responders: Record<string, Responder> = {
    'projectGroup.list': () => ({ groups }),
    'folderWorkspace.list': () => ({ folderWorkspaces: folders }),
    'worktree.list': () => ({
      worktrees: [worktreeRow('api::/w/api'), worktreeRow('web::/w/web')],
      totalCount: 2,
      truncated: false
    }),
    'worktree.lineageList': () => ({
      lineage: {},
      workspaceLineage: { 'worktree:api::/w/api': attachedLineage('api::/w/api', 'fw-1') }
    }),
    ...overrides
  }
  const call = vi.fn(async (method: string, params?: Record<string, unknown>) => {
    const respond = responders[method]
    if (!respond) {
      throw new Error(`unexpected call ${method}`)
    }
    return { id: method, ok: true, result: respond(params), _meta: { runtimeId: 'runtime-1' } }
  })
  return { call, isRemote: options.isRemote ?? false }
}

function run(
  command: string,
  rpc: ReturnType<typeof client>,
  flags: Record<string, string | boolean>,
  options: { cwd?: string; json?: boolean } = {}
) {
  const handler = FOLDER_HANDLERS[command]
  if (!handler) {
    throw new Error(`no handler for ${command}`)
  }
  return handler({
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: handlers use only call and isRemote.
    client: rpc as never,
    cwd: options.cwd ?? '/elsewhere',
    flags: new Map(Object.entries(flags)),
    json: options.json ?? true
  })
}

function printedJson(log: { mock: { calls: unknown[][] } }): { result: Record<string, unknown> } {
  return JSON.parse(String(log.mock.calls.at(-1)?.[0]))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  process.exitCode = undefined
})

describe('folder command parsing', () => {
  it('repeats --repo and treats --feature as a switch', () => {
    const { flags } = parseArgs(
      ['folder', 'create', '--feature', '--repo', 'name:api', '--repo', 'name:web'],
      COMMAND_SPECS.flatMap(specPaths),
      COMMAND_SPECS
    )

    expect(flags.get('feature')).toBe(true)
    expect(flags.get('repo')).toBe(['name:api', 'name:web'].join(REPEATED_FLAG_SEPARATOR))
  })
})

describe('folder list', () => {
  it('filters by group name and prints a selector per folder', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await run('folder list', client(), { group: 'Platform' }, { json: false })

    const output = String(log.mock.calls[0]?.[0])
    expect(output).toContain('folder:fw-1  Checkout flow  /orca/features/checkout-flow\ngroup: Platform')
    expect(output).not.toContain('fw-2')
  })

  it('names the ambiguity when two groups share a name', async () => {
    const rpc = client({
      'projectGroup.list': () => ({ groups: [...groups, { id: 'g-3', name: 'Platform' }] })
    })

    await expect(run('folder list', rpc, { group: 'Platform' })).rejects.toMatchObject({
      code: 'selector_ambiguous',
      message: expect.stringContaining('g-1, g-3')
    })
  })
})

describe('folder show', () => {
  it('lists the worktrees attached through workspace lineage', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await run('folder show', client(), { folder: 'name:Checkout flow' })

    const { result } = printedJson(log)
    expect(result.folderWorkspace).toMatchObject({ id: 'fw-1' })
    expect(result.projectGroup).toMatchObject({ name: 'Platform' })
    expect(result.worktrees).toEqual([expect.objectContaining({ id: 'api::/w/api' })])
  })

  it.each(['folder:fw-2', 'id:fw-2', 'id:folder:fw-2'])('accepts %s', async (selector) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await run('folder show', client(), { folder: selector })

    expect(printedJson(log).result.folderWorkspace).toMatchObject({ id: 'fw-2' })
  })

  it('resolves current from the folder terminal environment first', async () => {
    vi.stubEnv('ORCA_WORKSPACE_ID', 'folder:fw-2')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await run('folder show', client(), { folder: 'current' })

    expect(printedJson(log).result.folderWorkspace).toMatchObject({ id: 'fw-2' })
  })

  it('resolves current from an attached worktree that contains the cwd', async () => {
    vi.stubEnv('ORCA_WORKSPACE_ID', '')
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rpc = client({ 'worktree.show': () => ({ worktree: worktreeRow('api::/w/api') }) })

    await run('folder show', rpc, { folder: 'current' }, { cwd: '/w/api/src' })

    expect(rpc.call).toHaveBeenCalledWith('worktree.show', { worktree: 'id:api::/w/api' })
    expect(printedJson(log).result.folderWorkspace).toMatchObject({ id: 'fw-1' })
  })

  it('refuses current against a remote runtime and unknown selector forms', async () => {
    await expect(
      run('folder show', client({}, { isRemote: true }), { folder: 'current' })
    ).rejects.toMatchObject({ code: 'invalid_argument' })
    await expect(run('folder show', client(), { folder: 'Checkout flow' })).rejects.toMatchObject({
      code: 'invalid_argument',
      message: expect.stringContaining('name:<name>')
    })
  })
})

describe('folder create', () => {
  it('creates a feature folder and one attached worktree per repo, in order', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const created = folderWorkspace({ id: 'fw-9', name: 'Checkout flow · ABC-1/2' })
    const rpc = client({
      'folderWorkspace.create': () => ({ folderWorkspace: created }),
      'repo.show': (params) => {
        const name = String(params?.repo).slice('name:'.length)
        return { repo: { id: name, displayName: name } }
      },
      'worktree.create': (params) => {
        if (params?.repo === 'name:broken') {
          throw Object.assign(new Error('branch exists'), { code: 'git_error' })
        }
        return { worktree: worktreeRow(`${String(params?.repo).slice(5)}::/w/x`) }
      }
    })

    await run('folder create', rpc, {
      group: 'g-1',
      name: 'Checkout flow · ABC-1/2',
      feature: true,
      repo: ['name:api', 'name:broken', 'name:web'].join(REPEATED_FLAG_SEPARATOR)
    })

    expect(rpc.call).toHaveBeenCalledWith('folderWorkspace.create', {
      projectGroupId: 'g-1',
      name: 'Checkout flow · ABC-1/2',
      featureFolder: true
    })
    const creates = rpc.call.mock.calls.filter(([method]) => method === 'worktree.create')
    expect(creates.map(([, params]) => params?.repo)).toEqual([
      'name:api',
      'name:broken',
      'name:web'
    ])
    expect(creates[0]?.[1]).toMatchObject({
      name: 'checkout-flow-dev-1-2',
      displayName: 'api',
      displayNameKind: 'user',
      parentWorkspace: 'folder:fw-9',
      setupDecision: 'inherit'
    })
    const { result } = printedJson(log)
    expect(result.worktrees).toHaveLength(2)
    expect(result.failures).toEqual([
      { repo: 'name:broken', code: 'runtime_error', message: 'branch exists' }
    ])
    expect(process.exitCode).toBe(1)
  })

  it('warns when the host ignored --feature', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const rpc = client({
      'folderWorkspace.create': () => ({
        folderWorkspace: folderWorkspace({ folderPath: '/src/platform' })
      })
    })

    await run('folder create', rpc, { group: 'Platform', name: 'Checkout flow', feature: true })

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('does not support --feature'))
    expect(process.exitCode).toBeUndefined()
  })
})

describe('folder add-repo', () => {
  it('skips a repo that already has a worktree attached', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rpc = client({
      'repo.show': (params) => ({ repo: { id: String(params?.repo).slice(3), displayName: 'x' } }),
      'worktree.create': () => ({ worktree: worktreeRow('worker::/w/worker') })
    })

    await run('folder add-repo', rpc, {
      folder: 'folder:fw-1',
      repo: ['id:api', 'id:worker'].join(REPEATED_FLAG_SEPARATOR)
    })

    const creates = rpc.call.mock.calls.filter(([method]) => method === 'worktree.create')
    expect(creates.map(([, params]) => params?.repo)).toEqual(['id:worker'])
    expect(printedJson(log).result.skipped).toEqual([{ repo: 'id:api', worktreeId: 'api::/w/api' }])
  })
})

describe('folder move', () => {
  function movableClient() {
    const live = [
      folderWorkspace({ id: 'a', name: 'A', manualOrder: 30 }),
      folderWorkspace({ id: 'b', name: 'B', manualOrder: 20 }),
      folderWorkspace({ id: 'c', name: 'C', manualOrder: 10 }),
      folderWorkspace({ id: 'x', name: 'X', projectGroupId: 'g-2', manualOrder: 25 })
    ]
    return client({
      'folderWorkspace.list': () => ({ folderWorkspaces: live.map((entry) => ({ ...entry })) }),
      'folderWorkspace.update': (params) => {
        const entry = live.find(({ id }) => id === params?.folderWorkspaceId)
        const updates = params?.updates
        if (entry && typeof updates === 'object' && updates !== null && 'manualOrder' in updates) {
          entry.manualOrder = Number(updates.manualOrder)
        }
        return { folderWorkspace: entry ?? null }
      }
    })
  }

  it('moves a folder before another one and prints the new order', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rpc = movableClient()

    await run('folder move', rpc, { folder: 'folder:c', before: 'name:A' }, { json: false })

    const updates = rpc.call.mock.calls.filter(([method]) => method === 'folderWorkspace.update')
    expect(updates.map(([, params]) => params?.folderWorkspaceId)).toEqual(['c'])
    expect(log).toHaveBeenCalledWith('1. folder:c  C\n2. folder:a  A\n3. folder:b  B')
  })

  it('refuses a target in another project group, itself, or both sides at once', async () => {
    await expect(
      run('folder move', movableClient(), { folder: 'folder:a', after: 'folder:x' })
    ).rejects.toMatchObject({ code: 'invalid_argument' })
    await expect(
      run('folder move', movableClient(), { folder: 'folder:a', after: 'folder:a' })
    ).rejects.toMatchObject({ code: 'invalid_argument' })
    await expect(
      run('folder move', movableClient(), { folder: 'folder:a', before: 'b', after: 'c' })
    ).rejects.toMatchObject({
      code: 'invalid_argument',
      message: expect.stringContaining('exactly one')
    })
  })
})

describe('folder set and rm', () => {
  it('sends only the fields given', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rpc = client({
      'folderWorkspace.update': () => ({ folderWorkspace: folderWorkspace({ comment: 'done' }) })
    })

    await run('folder set', rpc, { folder: 'folder:fw-1', comment: 'done' })

    expect(rpc.call).toHaveBeenCalledWith('folderWorkspace.update', {
      folderWorkspaceId: 'fw-1',
      updates: { name: undefined, comment: 'done', workspaceStatus: undefined }
    })
    await expect(run('folder set', rpc, { folder: 'folder:fw-1' })).rejects.toMatchObject({
      code: 'invalid_argument'
    })
  })

  it('removes the resolved folder workspace', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const rpc = client({ 'folderWorkspace.delete': () => ({ deleted: true }) })

    await run('folder rm', rpc, { folder: 'name:Guides' }, { json: false })

    expect(rpc.call).toHaveBeenCalledWith('folderWorkspace.delete', { folderWorkspaceId: 'fw-2' })
    expect(log).toHaveBeenCalledWith('removed: true')
  })
})
