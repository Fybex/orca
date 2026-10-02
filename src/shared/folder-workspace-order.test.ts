import { describe, expect, it } from 'vitest'
import {
  compareFolderWorkspacesForDisplay,
  planFolderWorkspaceMove
} from './folder-workspace-order'

type Folder = { id: string; name: string; sortOrder: number; manualOrder?: number }

function displayOrder(scope: readonly Folder[], updates: ReadonlyMap<string, number>): string[] {
  return scope
    .map((folder) => ({ ...folder, manualOrder: updates.get(folder.id) ?? folder.manualOrder }))
    .sort(compareFolderWorkspacesForDisplay)
    .map(({ id }) => id)
}

const NOW = 2_000_000

describe('planFolderWorkspaceMove', () => {
  const ranked: Folder[] = [
    { id: 'a', name: 'A', sortOrder: 1, manualOrder: 30_000 },
    { id: 'b', name: 'B', sortOrder: 2, manualOrder: 20_000 },
    { id: 'c', name: 'C', sortOrder: 3, manualOrder: 10_000 }
  ]

  it('writes only the moved folder when every folder has a rank', () => {
    const updates = planFolderWorkspaceMove({
      scope: ranked,
      movedId: 'c',
      target: { beforeId: 'b' },
      now: NOW
    })
    expect([...updates.keys()]).toEqual(['c'])
    expect(displayOrder(ranked, updates)).toEqual(['a', 'c', 'b'])
  })

  it.each([
    ['c', { beforeId: 'a' }, ['c', 'a', 'b']],
    ['a', { afterId: 'c' }, ['b', 'c', 'a']],
    ['c', { afterId: 'a' }, ['a', 'c', 'b']]
  ] as const)('moves %s next to %j', (movedId, target, expected) => {
    const updates = planFolderWorkspaceMove({ scope: ranked, movedId, target, now: NOW })
    expect(displayOrder(ranked, updates)).toEqual(expected)
  })

  it('ranks the whole group once while folders still sort by creation time', () => {
    const unranked: Folder[] = [
      { id: 'old', name: 'Old', sortOrder: 100 },
      { id: 'new', name: 'New', sortOrder: 300 },
      { id: 'mid', name: 'Mid', sortOrder: 200 }
    ]
    const updates = planFolderWorkspaceMove({
      scope: unranked,
      movedId: 'old',
      target: { beforeId: 'new' },
      now: NOW
    })
    expect(new Set(updates.keys())).toEqual(new Set(['old', 'new', 'mid']))
    expect(displayOrder(unranked, updates)).toEqual(['old', 'new', 'mid'])
  })

  it('re-ranks when neighbours share a rank and leave no room between them', () => {
    const tight: Folder[] = [
      { id: 'a', name: 'A', sortOrder: 1, manualOrder: 5 },
      { id: 'b', name: 'B', sortOrder: 1, manualOrder: 4 },
      { id: 'c', name: 'C', sortOrder: 1, manualOrder: 3 }
    ]
    const updates = planFolderWorkspaceMove({
      scope: tight,
      movedId: 'c',
      target: { afterId: 'a' },
      now: NOW
    })
    expect(displayOrder(tight, updates)).toEqual(['a', 'c', 'b'])
  })

  it('writes nothing for a move that keeps the order or names an unknown target', () => {
    for (const target of [{ afterId: 'b' }, { beforeId: 'c' }, { beforeId: 'missing' }]) {
      expect(planFolderWorkspaceMove({ scope: ranked, movedId: 'b', target, now: NOW })).toEqual(
        new Map()
      )
    }
    expect(
      planFolderWorkspaceMove({ scope: ranked, movedId: 'x', target: { beforeId: 'a' }, now: NOW })
    ).toEqual(new Map())
  })
})
