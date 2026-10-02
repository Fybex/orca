import { spawnSync } from 'node:child_process'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

const cliEntry = path.join(process.cwd(), 'out', 'cli', 'index.js')

type TabListResult = {
  result: { tabs: { browserPageId: string; worktreeId?: string | null; active: boolean }[] }
}

test('browser tab commands from a folder workspace terminal scope to that folder', async ({
  orcaPage,
  electronApp,
  registerPostElectronShutdownCleanup
}) => {
  await waitForSessionReady(orcaPage)
  const folderPath = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'orca-folder-tabs-')))
  registerPostElectronShutdownCleanup(async () => {
    rmSync(folderPath, { recursive: true, force: true })
  })
  const folderId = await orcaPage.evaluate(async (parentPath) => {
    const group = await window.api.projectGroups.create({ name: 'Tabs group', parentPath })
    const workspace = await window.api.folderWorkspaces.create({
      projectGroupId: group.id,
      name: 'Tabs folder',
      folderPath: parentPath
    })
    return workspace.id
  }, folderPath)
  const userDataDir = await electronApp.evaluate(({ app }) => app.getPath('userData'))
  const folderKey = `folder:${folderId}`
  // The environment a terminal of this folder workspace exports.
  const cli = (args: string[]) => {
    const result = spawnSync(process.execPath, [cliEntry, ...args, '--json'], {
      cwd: folderPath,
      env: {
        ...process.env,
        ORCA_USER_DATA_PATH: userDataDir,
        ORCA_DEV_CLI_INVOCATION: '1',
        ORCA_WORKTREE_ID: folderKey,
        ORCA_WORKSPACE_ID: folderKey
      },
      encoding: 'utf8'
    })
    expect(result.status, result.stderr || result.stdout).toBe(0)
    return JSON.parse(result.stdout)
  }

  // Why data: a file:// navigation outlives the RPC deadline in a hidden test window for git
  // worktrees too, so it would test the test host rather than folder scoping.
  const created: { result: { browserPageId: string } } = cli([
    'tab',
    'create',
    '--url',
    'data:text/html,<title>Folder report</title>',
    '--worktree',
    'current'
  ])
  const pageId = created.result.browserPageId

  for (const worktree of ['current', `id:${folderKey}`, folderKey]) {
    const listed: TabListResult = cli(['tab', 'list', '--worktree', worktree])
    expect(listed.result.tabs).toEqual([
      expect.objectContaining({ browserPageId: pageId, worktreeId: folderKey, active: true })
    ])
  }
  const current: { result: { tab: { browserPageId: string } } } = cli([
    'tab',
    'current',
    '--worktree',
    'current'
  ])
  expect(current.result.tab.browserPageId).toBe(pageId)
})
