// Split out of protocol-version.ts, which spreads the list below into its capability lists.
export const WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY =
  'worktree.github-pr-suppression.v1' as const
export const WORKTREE_GITLAB_MR_SUPPRESSION_RUNTIME_CAPABILITY =
  'worktree.gitlab-mr-suppression.v1' as const

export const WORKTREE_REVIEW_SUPPRESSION_RUNTIME_CAPABILITIES = [
  WORKTREE_GITHUB_PR_SUPPRESSION_RUNTIME_CAPABILITY,
  WORKTREE_GITLAB_MR_SUPPRESSION_RUNTIME_CAPABILITY
] as const
