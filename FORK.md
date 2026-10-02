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

Fork-only commits, drop before any upstream PR:

- This file and its `AGENTS.md` pointer: `chore(fork): document the fork in FORK.md`
- Local builds skip background update checks: `chore(fork): skip background update checks on local builds`

## Build and install (macOS)

1. `pnpm install`
2. `pnpm install:release` (`build:mac` builds x64 and arm64 and needs both native module sets)
3. `pnpm --dir mobile install --frozen-lockfile` (the desktop build bundles the mobile web client)
4. `pnpm build:mac`. The app version is `<base>-local.<timestamp>.<commit>`, for example `1.4.214-local.1790000000000.0123456789ab`.
5. Quit Orca, move `/Applications/Orca.app` to a backup location, and copy `dist/mac-arm64/Orca.app` to `/Applications/Orca.app` (`ditto` keeps the signature and symlinks intact).

The `orca` CLI updates with the app: `/usr/local/bin/orca` is a symlink into `/Applications/Orca.app`. Local builds never check for updates in the background, so an update is the rebase above plus a rebuild.
