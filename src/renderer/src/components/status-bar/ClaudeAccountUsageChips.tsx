import React, { useEffect } from 'react'
import type { UsagePercentageDisplay } from '../../../../shared/usage-percentage-display'
import { useAppStore } from '../../store'
import { ProviderSegment } from './StatusBarProviderSegment'

function useShowAllClaudeAccounts(): boolean {
  // Why: remote-owned accounts have no local inactive-usage cache to fill.
  return useAppStore(
    (s) =>
      s.settings?.showAllClaudeAccountsInStatusBar === true &&
      !s.settings.activeRuntimeEnvironmentId?.trim()
  )
}

function ClaudeAccountLabel({ email }: { email: string }): React.JSX.Element {
  return <span className="max-w-[96px] truncate text-muted-foreground">{email.split('@')[0]}</span>
}

/** Names the active managed account on the Claude chip so it reads like the inactive account chips. */
export function ActiveClaudeAccountLabel(): React.JSX.Element | null {
  const enabled = useShowAllClaudeAccounts()
  const email = useAppStore((s) => {
    const activeId =
      s.settings?.activeClaudeManagedAccountIdsByRuntime?.host ??
      s.settings?.activeClaudeManagedAccountId
    return s.settings?.claudeManagedAccounts.find((account) => account.id === activeId)?.email
  })
  if (!enabled || !email) {
    return null
  }
  return <ClaudeAccountLabel email={email} />
}

/** One usage chip per inactive managed Claude account, shown when the user opts in. */
export function ClaudeAccountUsageChips({
  display
}: {
  display: UsagePercentageDisplay
}): React.JSX.Element | null {
  const enabled = useShowAllClaudeAccounts()
  const managedAccounts = useAppStore((s) => s.settings?.claudeManagedAccounts)
  const inactiveAccounts = useAppStore((s) => s.rateLimits.inactiveClaudeAccounts)
  const fetchInactiveClaudeAccountUsage = useAppStore((s) => s.fetchInactiveClaudeAccountUsage)

  // Why: the main-process timer refreshes these later; this fills the bar when the setting turns on.
  useEffect(() => {
    if (enabled) {
      void fetchInactiveClaudeAccountUsage()
    }
  }, [enabled, fetchInactiveClaudeAccountUsage])

  if (!enabled) {
    return null
  }
  return (
    <>
      {inactiveAccounts.map(({ accountId, rateLimits }) => {
        if (!rateLimits || (!rateLimits.session && !rateLimits.weekly)) {
          return null
        }
        const email = managedAccounts?.find((account) => account.id === accountId)?.email
        if (!email) {
          return null
        }
        return (
          <span
            key={accountId}
            data-claude-account-usage={accountId}
            title={email}
            className="inline-flex items-center gap-1.5"
          >
            <ClaudeAccountLabel email={email} />
            <ProviderSegment p={rateLimits} compact={false} display={display} />
          </span>
        )
      })}
    </>
  )
}
