/**
 * GitHub Issue Link Adapter (stub)
 *
 * Small, dependency-free helper that resolves a GitHub issue link for use
 * in the UI. This is intentionally lightweight and works without a token.
 */

export interface ResolvedIssueLink {
  url: string;
  title?: string;
}

export async function resolveGithubIssueLink(owner: string, repo: string, issueNumber: number): Promise<ResolvedIssueLink> {
  // Construct canonical GitHub issue URL. Consumers may later extend this to
  // call the GitHub API for richer metadata.
  return {
    url: `https://github.com/${owner}/${repo}/issues/${issueNumber}`,
    title: `#${issueNumber}`,
  };
}

export default { resolveGithubIssueLink };
