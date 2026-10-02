import { describe, expect, it } from 'vitest'
import { toFeatureBranchName, toFeatureFolderName } from './feature-folder-name'

describe('feature names', () => {
  it.each([
    ['ABC-1234 checkout flow', 'ABC-1234-checkout-flow', 'abc-1234-checkout-flow'],
    ['Checkout flow · ABC-12/34', 'Checkout-flow-ABC-12-34', 'checkout-flow-abc-12-34'],
    ['  .ABC-1: Fix it!  ', 'ABC-1-Fix-it', 'abc-1-fix-it'],
    ['   ', 'feature', 'feature']
  ])('%j → branch %s, folder %s', (name, branch, folder) => {
    expect(toFeatureBranchName(name)).toBe(branch)
    expect(toFeatureFolderName(name)).toBe(folder)
  })

  it('caps both at 60 characters', () => {
    const name = `ABC-1 ${'x'.repeat(80)}`
    expect(toFeatureBranchName(name)).toHaveLength(60)
    expect(toFeatureFolderName(name)).toHaveLength(60)
  })
})
