// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAckFocusedTerminalAgent } from './useAckFocusedTerminalAgent'
import { resolveUnreadAgentPaneKeyForLeaf } from './agent-focus-ack-target'
import { useAppStore } from '../store'
import { createTestStore } from '../store/slices/store-test-helpers'
import { makePaneKey } from '../../../shared/stable-pane-id'

const leaf = '33333333-3333-4333-8333-333333333333'
const otherLeaf = '44444444-4444-4444-8444-444444444444'
const pane = makePaneKey('focus-tab', leaf)
const dismiss = vi.fn()
const previousApi = window.api

function mountPane(leafId: string): HTMLTextAreaElement {
  const container = document.createElement('div')
  container.className = 'pane'
  container.setAttribute('data-leaf-id', leafId)
  const input = document.createElement('textarea')
  container.appendChild(input)
  document.body.appendChild(container)
  return input
}

function setReadOnFocus(enabled: boolean): void {
  const settings = useAppStore.getState().settings
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads one flag; the rest of settings is irrelevant here.
  useAppStore.setState({ settings: { ...settings, agentReadOnTerminalFocus: enabled } as never })
}

beforeEach(() => {
  dismiss.mockReset()
  Object.assign(window, { api: { notifications: { dismiss } } })
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  useAppStore.setState({
    agentStatusByPaneKey: {},
    retainedAgentsByPaneKey: {},
    acknowledgedAgentsByPaneKey: {},
    unreadAgentCompletionPanes: {},
    manuallyUnreadTurnsByPaneKey: {}
  })
  setReadOnFocus(true)
  useAppStore.getState().setAgentStatus(pane, { state: 'done', prompt: 'p', agentType: 'claude' })
  useAppStore.getState().markAgentCompletionPaneUnread(pane, 'agent-completion')
})
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  Object.assign(window, { api: previousApi })
  vi.restoreAllMocks()
})

describe('useAckFocusedTerminalAgent', () => {
  it('acknowledges the agent when its terminal gains focus', () => {
    renderHook(() => useAckFocusedTerminalAgent())
    const input = mountPane(leaf)
    act(() => input.focus())
    expect(useAppStore.getState().unreadAgentCompletionPanes[pane]).toBeUndefined()
    expect(useAppStore.getState().acknowledgedAgentsByPaneKey[pane]).toBeGreaterThan(0)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('acknowledges on a keystroke and does not repeat once read', () => {
    const input = mountPane(leaf)
    input.focus()
    renderHook(() => useAckFocusedTerminalAgent())
    expect(dismiss).toHaveBeenCalledTimes(1)
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })))
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true })))
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('marks a turn read when it finishes while its pane has focus', () => {
    const input = mountPane(leaf)
    input.focus()
    renderHook(() => useAckFocusedTerminalAgent())
    useAppStore
      .getState()
      .setAgentStatus(pane, { state: 'working', prompt: 'p', agentType: 'claude' })
    act(() => {
      useAppStore
        .getState()
        .setAgentStatus(pane, { state: 'done', prompt: 'p', agentType: 'claude' })
      useAppStore.getState().markAgentCompletionPaneUnread(pane, 'agent-completion')
    })
    expect(useAppStore.getState().unreadAgentCompletionPanes[pane]).toBeUndefined()
  })

  it('leaves the agent unread when the setting is off, another pane has focus, or the window is blurred', () => {
    setReadOnFocus(false)
    renderHook(() => useAckFocusedTerminalAgent())
    const input = mountPane(leaf)
    act(() => input.focus())
    expect(useAppStore.getState().unreadAgentCompletionPanes[pane]).toBe('agent-completion')

    setReadOnFocus(true)
    const other = mountPane(otherLeaf)
    act(() => other.focus())
    expect(useAppStore.getState().unreadAgentCompletionPanes[pane]).toBe('agent-completion')

    vi.mocked(document.hasFocus).mockReturnValue(false)
    act(() => input.focus())
    expect(useAppStore.getState().unreadAgentCompletionPanes[pane]).toBe('agent-completion')
  })
})

describe('resolveUnreadAgentPaneKeyForLeaf', () => {
  it('skips a turn the user explicitly marked unread', () => {
    const store = createTestStore()
    store.getState().setAgentStatus(pane, { state: 'done', prompt: 'p', agentType: 'claude' })
    const turn = store.getState().agentStatusByPaneKey[pane].stateStartedAt
    expect(resolveUnreadAgentPaneKeyForLeaf(store.getState(), leaf)).toBe(pane)
    store.setState({ manuallyUnreadTurnsByPaneKey: { [pane]: turn } })
    expect(resolveUnreadAgentPaneKeyForLeaf(store.getState(), leaf)).toBeNull()
  })

  it('returns null for a leaf with no agent', () => {
    const store = createTestStore()
    store.getState().setAgentStatus(pane, { state: 'done', prompt: 'p', agentType: 'claude' })
    expect(resolveUnreadAgentPaneKeyForLeaf(store.getState(), otherLeaf)).toBeNull()
  })
})
