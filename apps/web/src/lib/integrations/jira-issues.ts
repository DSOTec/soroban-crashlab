/**
 * Jira Issue Link Adapter (stub)
 *
 * Builds a canonical issue link for Jira instances. This is a stub that
 * can be extended to call Jira REST API when credentials are available.
 */

export interface ResolvedJiraLink {
  url: string;
  key: string;
}

export async function resolveJiraIssueLink(baseUrl: string, issueKey: string): Promise<ResolvedJiraLink> {
  const base = baseUrl.replace(/\/$/, '');
  return { url: `${base}/browse/${issueKey}`, key: issueKey };
}

export default { resolveJiraIssueLink };
