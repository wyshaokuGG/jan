import { useCoworkSessions } from '@/hooks/useCoworkSessions'

/**
 * Whether `/cowork/$sessionId` refers to a known session. Empty sessions are
 * valid Cowork start surfaces; unknown ids still redirect instead of rendering
 * a route with no session.
 */
export function canOpenCoworkSession(sessionId: string): boolean {
  return useCoworkSessions.getState().sessions.some((s) => s.id === sessionId)
}
