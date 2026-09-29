import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { seal, open } from './bundle.mjs'

test('encrypted binary bundles round-trip without exposing plaintext and use a fresh nonce', () => {
  const key = randomBytes(32), source = Buffer.from('synthetic private archive\0\xff')
  const first = seal(source, key), second = seal(source, key)
  assert.notDeepEqual(first, second)
  assert.equal(first.includes(source), false)
  assert.deepEqual(open(first, key), source)
  assert.deepEqual(open(seal(Buffer.alloc(0), key), key), Buffer.alloc(0))
})

test('wrong keys, changed framing, ciphertext, tags and truncated bundles are rejected', () => {
  const key = randomBytes(32), encrypted = seal(Buffer.from('fixture'), key)
  assert.throws(() => open(encrypted, randomBytes(32)))
  for (const index of [0, 16, encrypted.length - 17, encrypted.length - 1]) {
    const changed = Buffer.from(encrypted); changed[index] ^= 1
    assert.throws(() => open(changed, key))
  }
  assert.throws(() => open(encrypted.subarray(0, -1), key))
  assert.throws(() => seal(Buffer.from('fixture'), Buffer.alloc(0)))
})

test('CLI authenticates before creating output and never overwrites existing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'opspanel-bundle-test-'))
  try {
    const key = randomBytes(32), input = join(root, 'input'), output = join(root, 'output')
    writeFileSync(input, Buffer.from('synthetic source'))
    const run = (mode, source, destination, keyValue = key.toString('hex')) => spawnSync(process.execPath, [fileURLToPath(new URL('./bundle.mjs', import.meta.url)), mode, source, destination], { env: { ...process.env, BUILD_BUNDLE_KEY: keyValue }, encoding: 'utf8' })
    assert.equal(run('seal', input, output).status, 0)
    assert.equal(run('open', output, join(root, 'wrong'), randomBytes(32).toString('hex')).status, 1)
    assert.equal(existsSync(join(root, 'wrong')), false)
    assert.equal(run('open', output, input).status, 1)
    assert.equal(readFileSync(input, 'utf8'), 'synthetic source')
    assert.equal(run('open', output, join(root, 'decoded')).status, 0)
    assert.equal(readFileSync(join(root, 'decoded'), 'utf8'), 'synthetic source')
    assert.equal(run('seal', input, join(root, 'no-key'), '').status, 1)
    assert.equal(existsSync(join(root, 'no-key')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
