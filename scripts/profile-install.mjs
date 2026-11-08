import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PLUGIN_NAME = 'dsh-fast-open'

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n') }

function findProfileRoot(start) {
  let cur = path.resolve(start)
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(cur, 'package.json')
    if (fs.existsSync(pkg)) {
      try { const j = readJson(pkg); if (j && j.dsh && j.dsh.profile) return cur } catch {}
    }
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return null
}

export function installIntoProfile(profileDir, pluginDir) {
  const root = path.resolve(profileDir)
  const pkgPath = path.join(root, 'package.json')
  const pkg = readJson(pkgPath)
  pkg.dependencies = pkg.dependencies || {}
  pkg.dependencies[PLUGIN_NAME] = 'link:' + path.resolve(pluginDir).replaceAll('\\', '/')
  pkg.dsh = pkg.dsh || {}
  pkg.dsh.profile = pkg.dsh.profile || {}
  const bundles = pkg.dsh.profile.bundles || (pkg.dsh.profile.bundles = [])
  if (!bundles.includes(PLUGIN_NAME)) bundles.push(PLUGIN_NAME)
  writeJson(pkgPath, pkg)
  const nm = path.join(root, 'node_modules')
  fs.mkdirSync(nm, { recursive: true })
  const link = path.join(nm, PLUGIN_NAME)
  try { fs.rmSync(link, { recursive: true, force: true }) } catch {}
  execFileSync('cmd', ['/c', 'mklink', '/J', link, path.resolve(pluginDir)], { stdio: 'ignore' })
  return { profileDir: root, link, bundles, dependency: pkg.dependencies[PLUGIN_NAME] }
}

export function uninstallFromProfile(profileDir) {
  const root = path.resolve(profileDir)
  const pkgPath = path.join(root, 'package.json')
  const pkg = readJson(pkgPath)
  if (pkg.dependencies) delete pkg.dependencies[PLUGIN_NAME]
  const bundles = (pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []
  const i = bundles.indexOf(PLUGIN_NAME)
  if (i >= 0) bundles.splice(i, 1)
  writeJson(pkgPath, pkg)
  const link = path.join(root, 'node_modules', PLUGIN_NAME)
  try { execFileSync('cmd', ['/c', 'rmdir', link], { stdio: 'ignore' }) } catch {}
  return { profileDir: root, link, exists: fs.existsSync(link), listed: bundles.includes(PLUGIN_NAME) }
}

const cli = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (cli && cli === fileURLToPath(import.meta.url)) {
  const [action, profileArg, pluginArg] = process.argv.slice(2)
  if (action === 'install' || action === 'uninstall') {
    const profile = profileArg || findProfileRoot(process.cwd())
    if (!profile) { console.error('profile dir not found; pass <profileDir>'); process.exit(2) }
    const plugin = pluginArg || path.dirname(process.argv[1])
    const result = action === 'install' ? installIntoProfile(profile, plugin) : uninstallFromProfile(profile)
    console.log(JSON.stringify({ action, ...result }, null, 2))
  } else {
    console.log('usage: node scripts/profile-install.mjs install|uninstall <profileDir> [pluginDir]')
  }
}
