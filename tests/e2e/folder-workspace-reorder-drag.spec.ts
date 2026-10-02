import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

const FOLDER_NAMES = ['Alpha', 'Bravo', 'Charlie']

async function createFolderWorkspaces(page: Page, parentPath: string): Promise<string[]> {
  return page.evaluate(
    async ({ parentPath, names }) => {
      const store = window.__store!
      const group = await window.api.projectGroups.create({ name: 'Reorder group', parentPath })
      const ids: string[] = []
      for (const name of names) {
        const workspace = await window.api.folderWorkspaces.create({
          projectGroupId: group.id,
          name,
          folderPath: parentPath
        })
        ids.push(workspace.id)
      }
      await store.getState().fetchProjectGroups()
      await store.getState().fetchFolderWorkspaces()
      store.getState().setGroupBy('repo')
      return ids
    },
    { parentPath, names: FOLDER_NAMES }
  )
}

/** Attaches the seeded secondary worktree to a folder in the renderer only; the sidebar reads
 *  attachment from this lineage map, and the folder order is what the drop persists. */
async function attachSecondaryWorktree(page: Page, folderId: string): Promise<string> {
  return page.evaluate((folderId) => {
    const store = window.__store!
    const state = store.getState()
    const secondary = Object.values(state.worktreesByRepo)
      .flat()
      .find((worktree) => !worktree.isMainWorktree)
    if (!secondary) {
      throw new Error('Expected the seeded secondary worktree')
    }
    const childWorkspaceKey = `worktree:${secondary.id}` as const
    store.setState({
      workspaceLineageByChildKey: {
        ...state.workspaceLineageByChildKey,
        [childWorkspaceKey]: {
          childWorkspaceKey,
          childInstanceId: secondary.instanceId ?? null,
          parentWorkspaceKey: `folder:${folderId}`,
          parentInstanceId: null,
          origin: 'manual',
          capture: { source: 'manual-action', confidence: 'explicit' },
          createdAt: Date.now()
        }
      }
    })
    return secondary.id
  }, folderId)
}

function optionTop(page: Page, worktreeId: string): Promise<number> {
  return page
    .locator(`[data-worktree-sidebar] [role="option"][data-worktree-id="${worktreeId}"]`)
    .first()
    .evaluate((element) => element.getBoundingClientRect().top)
}

/** Folder rows top to bottom as the sidebar renders them. */
function renderedFolderOrder(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-worktree-sidebar] [role="option"]')]
      .map((option) => ({
        id: option.dataset.worktreeId ?? '',
        top: option.getBoundingClientRect().top
      }))
      .filter(({ id }) => id.startsWith('folder:'))
      .sort((left, right) => left.top - right.top)
      .map(({ id }) => id.slice('folder:'.length))
  )
}

/** Folder ids in persisted order, read back from the main process. */
function persistedFolderOrder(page: Page, ids: readonly string[]): Promise<string[]> {
  return page.evaluate(async (ids) => {
    const workspaces = (await window.api.folderWorkspaces.list()).filter(({ id }) =>
      ids.includes(id)
    )
    return workspaces
      .sort(
        (left, right) =>
          (right.manualOrder ?? right.sortOrder) - (left.manualOrder ?? left.sortOrder) ||
          left.name.localeCompare(right.name)
      )
      .map(({ id }) => id)
  }, ids)
}

test('dragging a folder workspace row reorders it among its project group folders', async ({
  orcaPage,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await orcaPage.setViewportSize({ width: 1_000, height: 700 })
  const parentPath = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'orca-folder-reorder-')))
  registerPostElectronShutdownCleanup(async () => {
    rmSync(parentPath, { recursive: true, force: true })
  })
  const [alpha, bravo, charlie] = await createFolderWorkspaces(orcaPage, parentPath)

  // Newest first until the user orders them.
  await expect.poll(() => renderedFolderOrder(orcaPage)).toEqual([charlie, bravo, alpha])

  const box = async (id: string) =>
    orcaPage
      .locator(`[data-worktree-sidebar] [role="option"][data-worktree-id="folder:${id}"]`)
      .evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom }
      })
  const source = await box(charlie)
  const last = await box(alpha)

  await orcaPage.mouse.move(source.x, (source.top + source.bottom) / 2)
  await orcaPage.mouse.down()
  try {
    await orcaPage.mouse.move(source.x, last.bottom + 4, { steps: 12 })
    // The insertion line waits for the pointer to settle on a slot.
    await orcaPage.waitForTimeout(400)
    await expect(orcaPage.locator('[data-worktree-sidebar-drag-preview="true"]')).toHaveCount(1)
    await orcaPage.screenshot({ path: testInfo.outputPath('folder-reorder-mid-drag.png') })
  } finally {
    await orcaPage.mouse.up()
  }

  await expect(orcaPage.locator('[data-worktree-sidebar-drag-preview="true"]')).toHaveCount(0)
  await expect.poll(() => renderedFolderOrder(orcaPage)).toEqual([bravo, alpha, charlie])
  await expect
    .poll(() => persistedFolderOrder(orcaPage, [alpha, bravo, charlie]))
    .toEqual([bravo, alpha, charlie])
  await orcaPage.screenshot({ path: testInfo.outputPath('folder-reorder-after-drop.png') })
})

test('a folder row carries its attached worktrees when it moves', async ({
  orcaPage,
  registerPostElectronShutdownCleanup
}, testInfo) => {
  await waitForSessionReady(orcaPage)
  await orcaPage.setViewportSize({ width: 1_000, height: 700 })
  const parentPath = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'orca-folder-reorder-')))
  registerPostElectronShutdownCleanup(async () => {
    rmSync(parentPath, { recursive: true, force: true })
  })
  const [alpha, bravo, charlie] = await createFolderWorkspaces(orcaPage, parentPath)
  const attachedId = await attachSecondaryWorktree(orcaPage, alpha)
  await expect.poll(() => renderedFolderOrder(orcaPage)).toEqual([charlie, bravo, alpha])
  await expect
    .poll(
      async () =>
        (await optionTop(orcaPage, attachedId)) > (await optionTop(orcaPage, `folder:${alpha}`))
    )
    .toBe(true)

  const sourceBox = await orcaPage
    .locator(`[data-worktree-sidebar] [role="option"][data-worktree-id="folder:${alpha}"]`)
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: (rect.top + rect.bottom) / 2 }
    })
  const firstTop = await optionTop(orcaPage, `folder:${charlie}`)
  await orcaPage.mouse.move(sourceBox.x, sourceBox.y)
  await orcaPage.mouse.down()
  try {
    await orcaPage.mouse.move(sourceBox.x, firstTop - 4, { steps: 12 })
    await orcaPage.waitForTimeout(400)
    await orcaPage.screenshot({ path: testInfo.outputPath('folder-with-child-mid-drag.png') })
  } finally {
    await orcaPage.mouse.up()
  }

  await expect.poll(() => renderedFolderOrder(orcaPage)).toEqual([alpha, charlie, bravo])
  const [alphaTop, attachedTop, charlieTop] = await Promise.all([
    optionTop(orcaPage, `folder:${alpha}`),
    optionTop(orcaPage, attachedId),
    optionTop(orcaPage, `folder:${charlie}`)
  ])
  expect(attachedTop).toBeGreaterThan(alphaTop)
  expect(attachedTop).toBeLessThan(charlieTop)
})
