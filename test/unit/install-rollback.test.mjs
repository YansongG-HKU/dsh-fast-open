import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { installIntoProfile, uninstallFromProfile } from '../../scripts/profile-install.mjs'

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

test('CLI install without plugin argument links package root, not scripts directory', () => {
  const root = makeTempProfile()
  try {
    execFileSync(process.execPath, [path.join(pluginDir, 'scripts/profile-install.mjs'), 'install', root])
    assert.equal(fs.realpathSync(path.join(root, 'node_modules', 'dsh-fast-open')), fs.realpathSync(pluginDir))
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'dsh-fast-open', 'package.json'), 'utf8')).name, 'dsh-fast-open')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('invalid plugin directory fails before modifying profile', () => {
  const root = makeTempProfile()
  try {
    const before = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    assert.throws(() => installIntoProfile(root, path.join(pluginDir, 'scripts')))
    assert.equal(fs.readFileSync(path.join(root, 'package.json'), 'utf8'), before)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

function makeTempProfile() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-fast-open-test-'))
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'test-profile', dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } } }, null, 2) + '\n')
  return root
}

test('install adds dependency, bundle entry and a resolving junction', () => {
  const root = makeTempProfile()
  try {
    const r = installIntoProfile(root, pluginDir)
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies['dsh-fast-open'], 'link:' + pluginDir.replaceAll('\\', '/'))
    assert.ok(pkg.dsh.profile.bundles.includes('dsh-fast-open'))
    assert.ok(pkg.dsh.profile.bundles.includes('@deepseek-ai/dsh-base'))
    assert.equal(fs.existsSync(path.join(root, 'node_modules', 'dsh-fast-open', 'package.json')), true)
    assert.equal(r.link.endsWith('dsh-fast-open'), true)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('uninstall removes dependency, bundle entry and the junction (full rollback)', () => {
  const root = makeTempProfile()
  try {
    installIntoProfile(root, pluginDir)
    const r = uninstallFromProfile(root)
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    assert.equal(pkg.dependencies['dsh-fast-open'], undefined)
    assert.equal(pkg.dsh.profile.bundles.includes('dsh-fast-open'), false)
    assert.deepEqual(pkg.dsh.profile.bundles, ['@deepseek-ai/dsh-base'])
    assert.equal(r.exists, false)
    assert.equal(fs.existsSync(path.join(root, 'node_modules', 'dsh-fast-open')), false)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('reinstall after rollback restores the exact enabled state', () => {
  const root = makeTempProfile()
  try {
    installIntoProfile(root, pluginDir)
    uninstallFromProfile(root)
    installIntoProfile(root, pluginDir)
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    assert.ok(pkg.dsh.profile.bundles.includes('dsh-fast-open'))
    assert.equal(fs.existsSync(path.join(root, 'node_modules', 'dsh-fast-open', 'package.json')), true)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('ordinary plugin directories are preserved on install and uninstall', () => {
  const root=makeTempProfile(), link=path.join(root,'node_modules','dsh-fast-open')
  try {
    fs.mkdirSync(link);fs.writeFileSync(path.join(link,'keep.txt'),'keep')
    const before=fs.readFileSync(path.join(root,'package.json'),'utf8')
    assert.throws(()=>installIntoProfile(root,pluginDir),/ordinary path/)
    assert.throws(()=>uninstallFromProfile(root),/ordinary path/)
    assert.equal(fs.readFileSync(path.join(link,'keep.txt'),'utf8'),'keep')
    assert.equal(fs.readFileSync(path.join(root,'package.json'),'utf8'),before)
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})

test('profile commit failure restores the original junction and exact bytes', async () => {
  const { mock }=await import('node:test')
  const root=makeTempProfile()
  try {
    installIntoProfile(root,pluginDir)
    const pkg=path.join(root,'package.json'),before=fs.readFileSync(pkg,'utf8')
    const rename=fs.renameSync
    const patched=mock.method(fs,'renameSync',(a,b)=>{if(b===pkg)throw new Error('injected commit failure');return rename(a,b)})
    try {assert.throws(()=>installIntoProfile(root,pluginDir),/injected commit failure/)} finally {patched.mock.restore()}
    assert.equal(fs.readFileSync(pkg,'utf8'),before)
    assert.equal(fs.realpathSync(path.join(root,'node_modules','dsh-fast-open')),fs.realpathSync(pluginDir))
  } finally {fs.rmSync(root,{recursive:true,force:true})}
})
