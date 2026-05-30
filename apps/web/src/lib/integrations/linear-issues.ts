/**
 * Linear Issue Link Adapter (stub)
 *
 * Creates canonical links for Linear issues. This is a small helper used by
 * UI components until a richer API-backed implementation is available.
 */

export interface ResolvedLinearLink {
  url: string;
  id: string;
}

export async function resolveLinearIssueLink(team: string, issueId: string): Promise<ResolvedLinearLink> {
  return { url: `https://linear.app/${team}/issue/${issueId}`, id: issueId };
}

export default { resolveLinearIssueLink };
