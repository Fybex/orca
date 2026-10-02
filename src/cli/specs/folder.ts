import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

const FOLDER_SELECTOR_NOTE =
  'Folder selectors: id:<folderId>, folder:<folderId>, name:<name>, or active/current for the folder workspace of this Orca terminal, else the folder or attached worktree containing the shell cwd.'

export const FOLDER_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['folder', 'list'],
    summary: 'List folder workspaces',
    usage: 'orca folder list [--group <id|name>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'group'],
    notes: [
      'A folder workspace is a workspace on a project group folder rather than a git checkout; worktrees from any repo in the group can be attached to it.'
    ],
    examples: ['orca folder list', 'orca folder list --group Platform --json']
  },
  {
    path: ['folder', 'show'],
    summary: 'Show one folder workspace and the worktrees attached to it',
    usage: 'orca folder show --folder <selector> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'folder'],
    notes: [FOLDER_SELECTOR_NOTE],
    examples: [
      'orca folder show --folder current',
      'orca folder show --folder "name:Checkout flow" --json'
    ]
  },
  {
    path: ['folder', 'create'],
    summary: 'Create a folder workspace, optionally a feature with one worktree per repo',
    usage:
      'orca folder create --group <id|name> --name <name> [--feature] [--repo <selector>]... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'group', 'name', 'feature', 'repo'],
    repeatableFlags: ['repo'],
    notes: [
      "--feature puts the workspace in its own folder beside Orca's worktrees directory (by default ~/orca/features/<name-slug>), holding one link per attached worktree. Local project groups only.",
      'Each --repo creates one worktree on branch <name-slug>, named after the repo and attached to the folder, one repo at a time. A failed repo is reported and the rest continue; the command then exits non-zero.'
    ],
    examples: [
      'orca folder create --group Platform --name "Checkout flow" --json',
      'orca folder create --group Platform --name "Checkout flow" --feature --repo name:api --repo name:web --json'
    ]
  },
  {
    path: ['folder', 'add-repo'],
    summary: 'Add one worktree per repo to a folder workspace',
    usage: 'orca folder add-repo --folder <selector> --repo <selector>... [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'folder', 'repo'],
    repeatableFlags: ['repo'],
    notes: [
      FOLDER_SELECTOR_NOTE,
      'Each worktree goes on branch <folder-name-slug>, named after its repo, like folder create --repo. A repo that already has a worktree attached to the folder is skipped.'
    ],
    examples: ['orca folder add-repo --folder current --repo name:worker --json']
  },
  {
    path: ['folder', 'set'],
    summary: 'Update Orca metadata for a folder workspace',
    usage:
      'orca folder set --folder <selector> [--name <name>] [--comment <text>] [--workspace-status <id>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'folder', 'name', 'comment', 'workspace-status'],
    notes: [
      FOLDER_SELECTOR_NOTE,
      'Renaming does not move a feature folder on disk or rename the branches of attached worktrees.'
    ],
    examples: [
      'orca folder set --folder current --comment "API done; web in review" --json',
      'orca folder set --folder folder:<folderId> --name "Checkout flow v2" --workspace-status in-review'
    ]
  },
  {
    path: ['folder', 'rm'],
    destructive: true,
    summary: 'Remove a folder workspace from Orca',
    usage: 'orca folder rm --folder <selector> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'folder'],
    notes: [
      FOLDER_SELECTOR_NOTE,
      "Stops the folder workspace's own terminals and forgets its tabs, browser pages and notes.",
      'Attached worktrees are kept with their checkouts, branches and terminals; they move back under their repos. Remove them with worktree rm.',
      "A feature folder's links are removed, and the folder itself if nothing else is in it. Any other folder on disk is left alone."
    ],
    examples: ['orca folder rm --folder folder:<folderId> --json']
  }
]
