# Fork context

This checkout is `Fybex/orca` (the `fork` remote), a personal fork of `stablyai/orca` (the `origin` remote).

- `main` is `origin/main` plus the fork commits listed below. Fork work is edited in place in the main checkout and committed on `main` directly, with no worktrees or feature branches.
- Update from upstream on `main`: `git fetch origin && git rebase origin/main`, then rebuild. Resolve conflicts by keeping upstream's behavior and re-applying the fork's intent.
- Keep the `chore(fork)` commits last so the upstream candidates stay a contiguous range.
- Commit hashes change on every rebase; find a commit by its subject.

## What the fork adds

Upstream PR candidates, one commit each:

- Folder workspace nesting: `feat(sidebar): nest worktrees attached to a folder workspace under it`
- Feature folders (`~/orca/features/<slug>` with links to each repo's worktree): `feat(features): give a feature workspace its own folder linking its worktrees`
- Repo picker for features: `feat(features): pick repos when creating a feature and add more later`
- Quiet project groups: `feat(sidebar): quiet project groups fold idle repos into one line`
- Runtime RPC feature folders: `feat(features): runtime RPC creates and deletes feature folders`
- Folder lineage in worktree output: `feat(worktrees): show folder workspace lineage in worktree output`
- `orca folder` CLI (list, show, create, add-repo, set, rm): ``feat(cli): add an `orca folder` command group for folder workspaces``
- Headless link sync: `fix(features): keep feature folder links in sync on headless hosts`
- Folder drag reorder: `feat(sidebar): drag folder workspace rows to reorder them`
- `orca folder move`: ``feat(cli): add `orca folder move` to reorder folder workspaces``
- Branch case: `feat(features): keep the ticket key's case in feature branch names`
- Folder browser tabs: `fix(browser): scope browser tab commands to folder workspaces`
- English catalog for fork strings: `fix(i18n): add English catalog entries for fork-added strings`
- Read on terminal focus (setting): `feat(agents): mark an agent read when its terminal pane has focus`
- Bell rows by session name: `feat(activity): title bell rows by the agent's session name`
- Sidebar badge and bell switches: `feat(sidebar): add switches for the primary and detached HEAD badges and the activity bell`
- GitLab MR unlink: `feat(review): let users unlink a detected GitLab merge request`
- `orca worktree set --unlink-review`: `feat(cli): add worktree set --unlink-review for GitHub and GitLab reviews`
- Folder child plus agent in one call (tests): `test(worktrees): cover creating a folder workspace child that starts an agent in one call`
- Every Claude account in the status bar (setting): `feat(status-bar): optionally show every Claude account's usage in the status bar`
- Transcripts from other Claude config dirs: `feat(claude-usage): scan sibling Claude config dirs and CLAUDE_CONFIG_DIR for transcripts`
- Typecheck fix for an upstream test: `fix(claude): pass a prompt registry in the child work retention test`
- Attached worktrees review (setting): `feat(sidebar): review attached worktrees' branch diffs from the Attached worktrees panel`
- Attached worktrees tab for git parents (same setting): `feat(sidebar): open the Attached worktrees tab for a worktree with stacked children`
- `worktree create --display-name` and `--agent-title`: `feat(cli): add --display-name and --agent-title to worktree create`
- Folder parent repo inference for `worktree create`: `feat(cli): infer the repo of a folder workspace parent in worktree create`
- Attached worktree stats refresh on focus: `feat(sidebar): refresh attached worktree diff stats when the panel or window is seen again`
- Active Claude account label (same setting): `feat(status-bar): label the active Claude account's chip when every account is shown`
- Folder workspaces in the parent picker: `feat(sidebar): offer folder workspaces as worktree parents in the parent picker`
- Agent Needs Input switch (setting): `feat(notifications): add an Agent Needs Input switch separate from Agent Task Complete`
- Decision banners for escalations and decision gates: `feat(orchestration): raise a desktop banner for escalation and decision gate messages`

Fork-only commits, drop before any upstream PR:

- This file and its `AGENTS.md` pointer: `chore(fork): document the fork in FORK.md`
- Local builds skip background update checks: `chore(fork): skip background update checks on local builds`
- Install script: `chore(fork): add a detached macOS install script for local builds`

## Build and install (macOS)

1. `pnpm install`
2. `pnpm install:release` (`build:mac` builds x64 and arm64 and needs both native module sets)
3. `pnpm --dir mobile install --frozen-lockfile` (the desktop build bundles the mobile web client)
4. `pnpm build:mac`. The app version is `<base>-local.<timestamp>.<commit>`, for example `1.4.214-local.1790000000000.0123456789ab`.
5. `bash config/scripts/fork-install-mac.sh` (try `--dry-run` first). It detaches into its own session, quits Orca, moves the old app to `~/Library/Application Support/orca-fork-backups` (keeping the last two), `ditto`s `dist/mac-arm64/Orca.app` into `/Applications`, relaunches it, and logs the installed version and the `orca` CLI target to `~/Library/Logs/orca-fork-install.log`.

The `orca` CLI updates with the app: `/usr/local/bin/orca` is a symlink into `/Applications/Orca.app`. Local builds never check for updates in the background, so an update is the rebase above plus a rebuild.
