import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_NAME = 'dsh-fast-open'
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function atomicWrite(file, value) {
  const tmp = `${file}.fastopen-${process.pid}.tmp`
  try { fs.writeFileSync(tmp, value); fs.renameSync(tmp, file) }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) }
}
function findProfileRoot(start) {
  let cur = path.resolve(start)
  for (let i = 0; i < 6; i++) {
    try { if (readJson(path.join(cur, 'package.json')).dsh?.profile) return cur } catch {}
    const parent = path.dirname(cur); if (parent === cur) break; cur = parent
  }
  return null
}
function linkState(link) {
  let stat
  try { stat = fs.lstatSync(link) } catch (e) { if (e.code === 'ENOENT') return null; throw e }
  if (!stat.isSymbolicLink()) throw new Error(`Refusing to replace ordinary path: ${link}`)
  return fs.readlinkSync(link)
}
function transaction(profileDir, update, pluginDir) {
  const root = fs.realpathSync(path.resolve(profileDir))
  const pkgPath = path.join(root, 'package.json')
  const lock = path.join(root, '.dsh-fast-open-install.lock')
  fs.mkdirSync(lock) // Exclusive installer ownership; a leftover lock requires inspection.
  const nm = path.join(root, 'node_modules'), link = path.join(nm, PLUGIN_NAME)
  const backup = path.join(nm, `.fastopen-backup-${process.pid}`)
  const staged = path.join(nm, `.fastopen-next-${process.pid}`)
  let oldBytes, oldTarget, moved = false, installed = false, wrote = false
  try {
    oldBytes = fs.readFileSync(pkgPath)
    const pkg = JSON.parse(oldBytes)
    if (!Array.isArray(pkg.dsh?.profile?.bundles)) throw new Error('Not a DSH profile')
    fs.mkdirSync(nm, { recursive: true })
    if (fs.lstatSync(nm).isSymbolicLink()) throw new Error('Shared node_modules links are not supported; use the owning profile')
    oldTarget = linkState(link)
    if (fs.existsSync(backup) || fs.existsSync(staged)) throw new Error('Previous transaction artifacts require inspection')
    update(pkg)
    if (pluginDir) fs.symlinkSync(pluginDir, staged, 'junction')
    if (oldTarget !== null) { fs.renameSync(link, backup); moved = true }
    if (pluginDir) { fs.renameSync(staged, link); installed = true }
    atomicWrite(pkgPath, JSON.stringify(pkg, null, 2) + '\n'); wrote = true
    if (moved) { fs.unlinkSync(backup); moved = false }
    return { profileDir: root, link, bundles: pkg.dsh.profile.bundles, dependency: pkg.dependencies?.[PLUGIN_NAME], exists: fs.existsSync(link), listed: pkg.dsh.profile.bundles.includes(PLUGIN_NAME) }
  } catch (error) {
    const failures = [error]
    try { if (wrote) atomicWrite(pkgPath, oldBytes) } catch (e) { failures.push(e) }
    try {
      if (installed) fs.unlinkSync(link)
      if (moved) fs.renameSync(backup, link)
      if (fs.existsSync(staged)) fs.unlinkSync(staged)
    } catch (e) { failures.push(e) }
    if (failures.length > 1) throw new AggregateError(failures, 'Installation failed and rollback needs inspection')
    throw error
  } finally { fs.rmdirSync(lock) }
}
export function installIntoProfile(profileDir, pluginDir) {
  const resolved = fs.realpathSync(path.resolve(pluginDir))
  const manifest = readJson(path.join(resolved, 'package.json'))
  if (manifest.name !== PLUGIN_NAME || !fs.existsSync(path.join(resolved, 'client.js'))) throw new Error('pluginDir must be the dsh-fast-open package root')
  return transaction(profileDir, pkg => {
    pkg.dependencies ||= {}; pkg.dependencies[PLUGIN_NAME] = 'link:' + resolved.replaceAll('\\', '/')
    pkg.dsh.profile.bundles = [...new Set(pkg.dsh.profile.bundles)]
    if (!pkg.dsh.profile.bundles.includes(PLUGIN_NAME)) pkg.dsh.profile.bundles.push(PLUGIN_NAME)
  }, resolved)
}
export function uninstallFromProfile(profileDir) {
  return transaction(profileDir, pkg => {
    if (pkg.dependencies) delete pkg.dependencies[PLUGIN_NAME]
    pkg.dsh.profile.bundles = pkg.dsh.profile.bundles.filter(n => n !== PLUGIN_NAME)
  })
}

const cli = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (cli && cli === fileURLToPath(import.meta.url)) {
  const [action, profileArg, pluginArg] = process.argv.slice(2)
  if (action === 'install' || action === 'uninstall') {
    const profile = profileArg || findProfileRoot(process.cwd())
    if (!profile) { console.error('profile dir not found; pass <profileDir>'); process.exit(2) }
    const plugin = pluginArg || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const result = action === 'install' ? installIntoProfile(profile, plugin) : uninstallFromProfile(profile)
    console.log(JSON.stringify({ action, ...result }, null, 2))
  } else {
    console.log('usage: node scripts/profile-install.mjs install|uninstall <profileDir> [pluginDir]')
  }
}
