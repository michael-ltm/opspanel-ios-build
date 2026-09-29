import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAGIC = Buffer.from('OPSPANEL-CI-1\n')
const MAX = 256 * 1024 * 1024
const NONCE = 12, TAG = 16
function checkKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid bundle key')
}
export function seal(plaintext, key) {
  checkKey(key)
  if (!Buffer.isBuffer(plaintext) || plaintext.length > MAX) throw new Error('Invalid bundle size')
  const nonce = randomBytes(NONCE)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(MAGIC)
  return Buffer.concat([MAGIC, nonce, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
}
export function open(encrypted, key) {
  checkKey(key)
  const prefix = MAGIC.length + NONCE
  if (!Buffer.isBuffer(encrypted) || encrypted.length < prefix + TAG || encrypted.length > MAX + prefix + TAG || !encrypted.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid encrypted bundle')
  const decipher = createDecipheriv('aes-256-gcm', key, encrypted.subarray(MAGIC.length, prefix))
  decipher.setAAD(MAGIC)
  decipher.setAuthTag(encrypted.subarray(-TAG))
  return Buffer.concat([decipher.update(encrypted.subarray(prefix, -TAG)), decipher.final()])
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [mode, source, destination] = process.argv.slice(2)
    const encodedKey = process.env.BUILD_BUNDLE_KEY ?? ''
    if (!['seal', 'open'].includes(mode) || !source || !destination || !/^[a-f0-9]{64}$/.test(encodedKey)) throw new Error('Invalid arguments')
    const metadata = statSync(source)
    if (!metadata.isFile() || metadata.size > MAX + 64) throw new Error('Invalid input')
    const output = (mode === 'seal' ? seal : open)(readFileSync(source), Buffer.from(encodedKey, 'hex'))
    // Authentication completes before any plaintext is written. Existing files stay intact.
    writeFileSync(destination, output, { flag: 'wx', mode: 0o600 })
  } catch {
    console.error('Bundle operation failed; verify arguments, key, integrity and output path.')
    process.exitCode = 1
  }
}
