import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SCRIPT = join(import.meta.dirname, 'fork-install-mac.sh')
const BUNDLE_ID = 'com.example.orca-fork-install-test'
const roots = []

function makeApp(path, version) {
  mkdirSync(join(path, 'Contents'), { recursive: true })
  const plist = join(path, 'Contents', 'Info.plist')
  execFileSync('/usr/bin/plutil', ['-create', 'xml1', plist])
  for (const [key, value] of [
    ['CFBundleIdentifier', BUNDLE_ID],
    ['CFBundleShortVersionString', version],
    ['CFBundleVersion', version]
  ]) {
    execFileSync('/usr/bin/plutil', ['-insert', key, '-string', value, plist])
  }
}

function readVersion(path) {
  return execFileSync('/usr/libexec/PlistBuddy', [
    '-c',
    'Print :CFBundleShortVersionString',
    join(path, 'Contents', 'Info.plist')
  ])
    .toString()
    .trim()
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'orca-fork-install-'))
  roots.push(root)
  const paths = {
    app: join(root, 'build', 'Orca.app'),
    dest: join(root, 'Applications', 'Orca.app'),
    backups: join(root, 'backups'),
    log: join(root, 'install.log')
  }
  makeApp(paths.app, '2.0.0-local.2.newsha')
  makeApp(paths.dest, '1.0.0-local.1.oldsha')
  makeApp(join(paths.backups, 'Orca-20260101-000000-0.8.0.app'), '0.8.0')
  makeApp(join(paths.backups, 'Orca-20260201-000000-0.9.0.app'), '0.9.0')
  return paths
}

function runInstall(paths, args) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ORCA_FORK_INSTALL_APP: paths.app,
      ORCA_FORK_INSTALL_DEST: paths.dest,
      ORCA_FORK_INSTALL_BACKUP_DIR: paths.backups,
      ORCA_FORK_INSTALL_LOG: paths.log,
      ORCA_FORK_INSTALL_CLI_LINK: join(paths.backups, 'no-cli-link')
    }
  })
}

async function waitForLog(path, text) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const log = existsSync(path) ? readFileSync(path, 'utf8') : ''
    if (log.includes(text)) {
      return log
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out waiting for "${text}" in ${path}`)
}

function sessionIdOf(pid) {
  return Number(
    execFileSync('python3', ['-c', `import os; print(os.getsid(${pid}))`])
      .toString()
      .trim()
  )
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe.runIf(process.platform === 'darwin')('fork-install-mac.sh', () => {
  it('refuses to start without a build', () => {
    const paths = setup()
    rmSync(paths.app, { recursive: true })

    const result = runInstall(paths, ['--dry-run'])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No build at')
    expect(existsSync(paths.log)).toBe(false)
  })

  it('prints every action in a dry run from its own session and changes nothing', async () => {
    const paths = setup()

    const result = runInstall(paths, ['--dry-run'])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('Version: 2.0.0-local.2.newsha')

    const log = await waitForLog(paths.log, 'install finished')
    const [, pid, session] = log.match(/pid (\d+), session (\d+)/) ?? []
    expect(Number(session)).toBe(Number(pid))
    expect(Number(session)).not.toBe(sessionIdOf(process.pid))
    expect(log).toContain(`dry run: would run: mv ${paths.dest}`)
    expect(log).toContain(
      `dry run: would run: rm -rf ${join(paths.backups, 'Orca-20260101-000000-0.8.0.app')}`
    )
    expect(log).toContain(`dry run: would run: ditto ${paths.app} ${paths.dest}`)
    expect(log).toContain(`dry run: would run: open ${paths.dest}`)
    expect(readVersion(paths.dest)).toBe('1.0.0-local.1.oldsha')
    expect(readdirSync(paths.backups)).toHaveLength(2)
  })

  it('backs up the installed app, keeps two backups and copies the build in', async () => {
    const paths = setup()

    expect(runInstall(paths, ['--no-launch']).status).toBe(0)

    const log = await waitForLog(paths.log, 'install finished')
    expect(log).toContain('installed version: 2.0.0-local.2.newsha')
    expect(readVersion(paths.dest)).toBe('2.0.0-local.2.newsha')
    const backups = readdirSync(paths.backups).sort()
    expect(backups).toHaveLength(2)
    expect(backups[0]).toBe('Orca-20260201-000000-0.9.0.app')
    expect(backups[1]).toMatch(/^Orca-\d{8}-\d{6}-1\.0\.0-local\.1\.oldsha\.app$/)
  })
})
