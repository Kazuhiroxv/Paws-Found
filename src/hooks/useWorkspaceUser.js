import { useOutletContext } from 'react-router-dom'

/**
 * The signed-in account, inside a workspace page.
 *
 * WorkspaceLayout hands it to its pages through the router's outlet context,
 * so a page can ask `can(user, …)` (src/utils/permissions.js) without a
 * provider of its own or a second request for who is signed in.
 *
 * @returns {Object|null}
 */
export function useWorkspaceUser() {
  return useOutletContext()?.user ?? null
}
