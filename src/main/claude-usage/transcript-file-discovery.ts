import { claudeProfileHistoryDirs } from '../claude-accounts/claude-profile-installed-router'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readdir, realpath } from 'node:fs/promises'
import { isDefinitiveAbsence } from '../../shared/definitive-filesystem-absence'

async function walkJsonlFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true }).catch((error: unknown) => {
    if (isDefinitiveAbsence(error)) {
      return []
    }
    throw error
  })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      appendDiscoveredFiles(files, await walkJsonlFiles(fullPath))
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(fullPath)
    }
  }

  return files
}

function appendDiscoveredFiles(target: string[], source: readonly string[]): void {
  // Why: long-lived transcript directories can exceed V8's argument limit if
  // child file arrays are spread into push().
  for (const filePath of source) {
    target.push(filePath)
  }
}

/** Resolved by the host process: a scan worker has no account router of its own. */
export function claudeProfileTranscriptDirs(): string[] {
  return [...claudeProfileHistoryDirs('projects'), ...claudeProfileHistoryDirs('transcripts')]
}

// Why: per-account Claude config dirs (`~/.claude-work`, CLAUDE_CONFIG_DIR) keep their own
// transcripts; turns copied between them are deduped by the scanner's message-id ownership.
async function listClaudeConfigDirs(): Promise<string[]> {
  const home = homedir()
  const dirs = [join(home, '.claude')]
  const configured = process.env.CLAUDE_CONFIG_DIR?.trim()
  if (configured) {
    dirs.push(configured)
  }
  try {
    for (const entry of await readdir(home, { withFileTypes: true })) {
      if (entry.name.startsWith('.claude-') && (entry.isDirectory() || entry.isSymbolicLink())) {
        dirs.push(join(home, entry.name))
      }
    }
  } catch {
    // An unreadable home still leaves the default config dir.
  }
  return dirs
}

async function listTranscriptRoots(profileDirs: readonly string[]): Promise<string[]> {
  const roots: string[] = []
  const seenRealPaths = new Set<string>()
  const configRoots = (await listClaudeConfigDirs()).flatMap((dir) => [
    join(dir, 'projects'),
    join(dir, 'transcripts')
  ])
  for (const root of [...configRoots, ...profileDirs]) {
    // Why: a symlinked config dir would otherwise walk the same tree twice.
    const realRoot = await realpath(root).catch(() => root)
    if (!seenRealPaths.has(realRoot)) {
      seenRealPaths.add(realRoot)
      roots.push(root)
    }
  }
  return roots
}

export async function listClaudeTranscriptFiles(
  profileDirs = claudeProfileTranscriptDirs()
): Promise<string[]> {
  const roots = await listTranscriptRoots(profileDirs)
  const files = await Promise.all(roots.map((root) => walkJsonlFiles(root)))
  return [...new Set(files.flat())].sort()
}
