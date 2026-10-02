import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUpdaterModule, warmUpdaterModule } from './updater-test-module-loader'
import { isLocalBuildVersion } from './updater/local-build-version'

const {
  appMock,
  autoUpdaterMock,
  powerMonitorOnMock,
  fetchNudgeMock,
  moduleFactories,
  resetUpdaterMocks
} = await vi.hoisted(async () => (await import('./updater-test-harness')).createUpdaterMocks())

vi.mock('electron', () => moduleFactories.electron())
vi.mock('electron-updater', () => moduleFactories.electronUpdater())
vi.mock('./electron-updater-loader', () => moduleFactories.electronUpdaterLoader())
vi.mock('@electron-toolkit/utils', () => moduleFactories.electronToolkitUtils())
vi.mock('./ipc/pty', () => moduleFactories.ipcPty())
vi.mock('./linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./updater-nudge', () => moduleFactories.updaterNudge())
vi.mock('./update-install-exit-watchdog', () => moduleFactories.updateInstallExitWatchdog())
vi.mock('./updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('./local-builds/local-build-switch', () => moduleFactories.localBuildSwitch())
vi.mock('./local-builds/local-build-feed-server', () => moduleFactories.localBuildFeedServer())

warmUpdaterModule()

const DAY_MS = 24 * 60 * 60 * 1000

describe('isLocalBuildVersion', () => {
  it.each([
    ['1.4.214-local.1759400000000.f4fa7dedba12', true],
    ['1.5.0-rc.1.local.1759400000000.abc123', true],
    ['1.4.214', false],
    ['1.5.0-rc.1', false],
    ['1.4.214-locale.1.abc', false]
  ])('%s -> %s', (version, expected) => {
    expect(isLocalBuildVersion(version)).toBe(expected)
  })
})

describe('updater on a local build', () => {
  beforeEach(() => {
    resetUpdaterMocks()
    appMock.getVersion.mockReturnValue('1.4.214-local.1759400000000.f4fa7dedba12')
    vi.useFakeTimers()
  })

  it('skips startup, timer, wake, focus and nudge checks but keeps the menu check', async () => {
    let lastUpdateCheckAt = Date.now() - 2 * DAY_MS
    const { setupAutoUpdater, checkForUpdatesFromMenu } = await loadUpdaterModule()

    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the updater only sends status through webContents.
    setupAutoUpdater({ webContents: { send: vi.fn() } } as never, {
      getLastUpdateCheckAt: () => lastUpdateCheckAt
    })
    await vi.advanceTimersByTimeAsync(2 * DAY_MS)
    lastUpdateCheckAt = Date.now() - 2 * DAY_MS
    appMock.emit('browser-window-focus')
    const resume = powerMonitorOnMock.mock.calls.find(([event]) => event === 'resume')?.[1]
    expect(resume).toBeTypeOf('function')
    if (typeof resume === 'function') {
      resume()
    }
    await vi.advanceTimersByTimeAsync(0)

    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(fetchNudgeMock).not.toHaveBeenCalled()

    checkForUpdatesFromMenu()
    await vi.waitFor(() => {
      expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1)
    })
  })
})
