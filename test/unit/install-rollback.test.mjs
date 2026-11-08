import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { installIntoProfile, uninstallFromProfile } from '../../scripts/profile-install.mjs'

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

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
