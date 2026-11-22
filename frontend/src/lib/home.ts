import type { HistoryState } from '@tanstack/react-router'

/**
 * Signed-in users who open the home page are sent on to the dashboard,
 * unless they chose it from a menu. Those links carry this history state.
 * Cast rather than augmenting `HistoryState`: the router's history package
 * is installed more than once, so an augmentation would not reach it.
 */
export const SHOW_HOME_STATE = { showHome: true } as unknown as HistoryState

/** True when the visit to the home page came from one of those links. */
export function wantsHome(state: unknown): boolean {
  return (state as { showHome?: unknown } | null)?.showHome === true
}
