import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InactiveAccountUsage, RateLimitWindow } from '../../../../shared/rate-limit-types'

vi.mock('@/i18n/i18n', () => ({
  i18n: { language: 'en' },
  translate: (_key: string, fallback: string, values?: Record<string, string>) => {
    let result = fallback
    for (const [key, value] of Object.entries(values ?? {})) {
      result = result.replace(`{{${key}}}`, value)
    }
    return result
  }
}))

vi.mock('@/lib/agent-catalog', () => ({
  AgentIcon: () => null
}))

type StoreState = {
  settings: {
    showAllClaudeAccountsInStatusBar: boolean
    activeRuntimeEnvironmentId: string | null
    claudeManagedAccounts: { id: string; email: string }[]
  }
  rateLimits: { inactiveClaudeAccounts: InactiveAccountUsage[] }
  fetchInactiveClaudeAccountUsage: () => void
}

const storeState: StoreState = {
  settings: {
    showAllClaudeAccountsInStatusBar: true,
    activeRuntimeEnvironmentId: null,
    claudeManagedAccounts: [
      { id: 'acct-work', email: 'work.person@example.com' },
      { id: 'acct-side', email: 'side@example.com' }
    ]
  },
  rateLimits: { inactiveClaudeAccounts: [] },
  fetchInactiveClaudeAccountUsage: vi.fn()
}

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(storeState)
}))

function usageWindow(usedPercent: number, windowMinutes: number): RateLimitWindow {
  return { usedPercent, windowMinutes, resetsAt: null, resetDescription: null }
}

function inactiveUsage(accountId: string, session: number, weekly: number): InactiveAccountUsage {
  return {
    accountId,
    isFetching: false,
    updatedAt: 1,
    rateLimits: {
      provider: 'claude',
      session: usageWindow(session, 300),
      weekly: usageWindow(weekly, 10_080),
      updatedAt: 1,
      error: null,
      status: 'ok'
    }
  }
}

describe('ClaudeAccountUsageChips', () => {
  beforeEach(() => {
    storeState.settings.showAllClaudeAccountsInStatusBar = true
    storeState.settings.activeRuntimeEnvironmentId = null
    storeState.rateLimits.inactiveClaudeAccounts = [
      inactiveUsage('acct-work', 12, 40),
      inactiveUsage('acct-side', 70, 85)
    ]
  })

  it('labels each inactive account with its 5-hour and weekly use', async () => {
    const { ClaudeAccountUsageChips } = await import('./ClaudeAccountUsageChips')
    const markup = renderToStaticMarkup(<ClaudeAccountUsageChips display="used" />)

    expect(markup).toContain('title="work.person@example.com"')
    expect(markup).toContain('>work.person<')
    expect(markup).toContain('12% 5h')
    expect(markup).toContain('40% wk')
    expect(markup).toContain('>side<')
    expect(markup).toContain('85% wk')
  })

  it('renders nothing when the setting is off or a remote server owns the accounts', async () => {
    const { ClaudeAccountUsageChips } = await import('./ClaudeAccountUsageChips')
    storeState.settings.showAllClaudeAccountsInStatusBar = false
    expect(renderToStaticMarkup(<ClaudeAccountUsageChips display="used" />)).toBe('')

    storeState.settings.showAllClaudeAccountsInStatusBar = true
    storeState.settings.activeRuntimeEnvironmentId = 'remote-1'
    expect(renderToStaticMarkup(<ClaudeAccountUsageChips display="used" />)).toBe('')
  })
})
