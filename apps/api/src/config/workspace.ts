/**
 * Workspace Configuration
 * TICKET: TICKET-ARCH-001
 *
 * Centralized workspace path management with cross-platform compatibility.
 * All workspace path computations should go through this module.
 */
import path from 'path'

/**
 * Base directory for all user workspaces.
 * Override via WORKSPACE_BASE environment variable.
 * Default: /data/workspaces (Docker volume mount point)
 */
export const WORKSPACE_BASE = process.env.WORKSPACE_BASE || '/data/workspaces'

/**
 * Get the workspace path for a given user and optional project.
 * Uses path.join for Windows/Linux cross-platform compatibility.
 *
 * @param userId    The user ID (UUID or string)
 * @param projectId Optional project ID; defaults to 'default' when omitted
 * @returns Absolute workspace path
 */
export function getWorkspacePath(userId: string, projectId?: string): string {
  if (projectId) {
    return path.join(WORKSPACE_BASE, userId, projectId)
  }
  return path.join(WORKSPACE_BASE, userId, 'default')
}

/**
 * Get the chat-session workspace path for a given session.
 *
 * @param sessionId The chat session ID
 * @returns Absolute chat-session workspace path
 */
export function getChatWorkspacePath(sessionId: string): string {
  return path.join(WORKSPACE_BASE, 'chat-sessions', sessionId)
}
