import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentBrowserBridge } from '../browser/agent-browser-bridge'
import type { RuntimeBrowserCommandHost } from './orca-runtime-browser'
import { RuntimeBrowserPageRegistry } from './runtime-browser-page-registry'

const { ipcMainOnMock, webContentsFromIdMock, waitForTabRegistrationMock } = vi.hoisted(() => ({
  ipcMainOnMock: vi.fn(),
  webContentsFromIdMock: vi.fn(),
  waitForTabRegistrationMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { on: ipcMainOnMock, removeListener: vi.fn() },
  webContents: { fromId: webContentsFromIdMock }
}))
vi.mock('../ipc/browser-tab-registration-wait', () => ({
  waitForTabRegistration: waitForTabRegistrationMock,
  waitForWorktreeTabRegistration: vi.fn(async () => undefined)
}))
vi.mock('../browser/browser-session-registry', () => ({
  browserSessionRegistry: {
    resolveKnownPartition: () => 'persist:orca-browser',
    getDefaultProfile: () => ({ id: 'default' })
  }
}))

const FOLDER_KEY = 'folder:fw-1'

function createHost(bridge: AgentBrowserBridge, send = vi.fn()) {
  const resolveBrowserWorkspace = vi.fn(async () => ({ id: FOLDER_KEY }))
  const webContents = { send }
  const host = {
    resolveBrowserWorkspace,
    getRuntimeBrowserPageRegistry: () => new RuntimeBrowserPageRegistry(),
    getAgentBrowserBridge: () => bridge,
    getAuthoritativeWindow: () => ({ webContents }),
    getAvailableAuthoritativeWindow: () => ({ webContents }),
    getOffscreenBrowserBackend: () => null
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: these commands read only the stubbed host members.
  const runtimeHost = host as unknown as RuntimeBrowserCommandHost
  return { host: runtimeHost, resolveBrowserWorkspace, webContents }
}

describe('browser commands scoped to a folder workspace', () => {
  beforeEach(() => {
    ipcMainOnMock.mockReset()
    webContentsFromIdMock.mockReset()
    webContentsFromIdMock.mockReturnValue({ isDestroyed: () => false })
    waitForTabRegistrationMock.mockReset()
    waitForTabRegistrationMock.mockResolvedValue(undefined)
  })

  it('lists the tabs of the folder workspace a selector names', async () => {
    const { RuntimeBrowserCommands } = await import('./orca-runtime-browser')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: tab list reads only these bridge members.
    const bridge = {
      getRegisteredTabs: vi.fn(() => new Map([['page-1', 100]])),
      tabList: vi.fn(() => ({ tabs: [] }))
    } as unknown as AgentBrowserBridge
    const { host, resolveBrowserWorkspace } = createHost(bridge)

    await new RuntimeBrowserCommands(host).browserTabList({ worktree: `id:${FOLDER_KEY}` })

    expect(resolveBrowserWorkspace).toHaveBeenCalledWith(`id:${FOLDER_KEY}`)
    expect(bridge.getRegisteredTabs).toHaveBeenCalledWith(FOLDER_KEY)
    expect(bridge.tabList).toHaveBeenCalledWith(FOLDER_KEY)
  })

  it('creates a tab in the folder workspace', async () => {
    const { RuntimeBrowserCommands } = await import('./orca-runtime-browser')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: tab create reads only these bridge members.
    const bridge = {
      getRegisteredTabs: vi.fn(() => new Map([['page-new', 101]])),
      setActiveTab: vi.fn()
    } as unknown as AgentBrowserBridge
    const send = vi.fn((_channel: string, data: { requestId: string }) => {
      const reply = ipcMainOnMock.mock.calls.find(
        ([eventName]) => eventName === 'browser:tabCreateReply'
      )?.[1]
      reply?.({ sender: webContents }, { requestId: data.requestId, browserPageId: 'page-new' })
    })
    const { host, webContents } = createHost(bridge, send)

    await expect(
      new RuntimeBrowserCommands(host).browserTabCreate({ worktree: FOLDER_KEY })
    ).resolves.toEqual({ browserPageId: 'page-new' })

    expect(send).toHaveBeenCalledWith(
      'browser:requestTabCreate',
      expect.objectContaining({ worktreeId: FOLDER_KEY })
    )
  })

  it('scopes a page-targeted command to the folder workspace', async () => {
    const { RuntimeBrowserCommands } = await import('./orca-runtime-browser')
    const snapshot = vi.fn(() => ({ origin: 'about:blank', refs: {}, snapshot: '' }))
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: snapshot reads only these bridge members.
    const bridge = {
      getRegisteredTabs: vi.fn(() => new Map([['page-1', 100]])),
      snapshot
    } as unknown as AgentBrowserBridge
    const { host } = createHost(bridge)

    await new RuntimeBrowserCommands(host).browserSnapshot({
      worktree: `id:${FOLDER_KEY}`,
      page: 'page-1'
    })

    expect(snapshot).toHaveBeenCalledWith(FOLDER_KEY, 'page-1')
  })
})
