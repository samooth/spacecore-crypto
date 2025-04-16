const test = require('brittle')
const b4a = require('b4a')
const crypto = require('./')
const sodium = require('sodium-universal')

test('randomBytes', function (t) {
  const buffer = crypto.randomBytes(100)
  t.ok(b4a.isBuffer(buffer))
  t.unlike(crypto.randomBytes(100), buffer)
})

test('key pair', function (t) {
  const keyPair = crypto.keyPair()

  t.is(keyPair.publicKey.length, 32)
  t.is(keyPair.secretKey.length, 64)
  t.is(keyPair.publicKey.buffer.byteLength, 96, 'small slab')
  t.is(keyPair.publicKey.buffer, keyPair.secretKey.buffer, 'public and seret key share the same slab')
})

test('validate key pair', function (t) {
  const keyPair1 = crypto.keyPair()
  const keyPair2 = crypto.keyPair()

  t.absent(crypto.validateKeyPair({ publicKey: keyPair1.publicKey, secretKey: keyPair2.secretKey }))
  t.ok(crypto.validateKeyPair({ publicKey: keyPair1.publicKey, secretKey: keyPair1.secretKey }))
})

test('sign', function (t) {
  const keyPair = crypto.keyPair()
  const message = b4a.from('hello world')

  const sig = crypto.sign(message, keyPair.secretKey)

  t.is(sig.length, 64)
  t.ok(crypto.verify(message, sig, keyPair.publicKey))
  t.absent(crypto.verify(message, b4a.alloc(64), keyPair.publicKey))
  t.is(sig.buffer.byteLength, sodium.crypto_sign_BYTES, 'dedicated slab for signatures')
})

test('hash leaf', function (t) {
  const data = b4a.from('hello world')

  t.alike(crypto.data(data), b4a.from('9f1b578fd57a4df015493d2886aec9600eef913c3bb009768c7f0fb875996308', 'hex'))
})

test('hash parent', function (t) {
  const data = b4a.from('hello world')

  const parent = crypto.parent({
    index: 0,
    size: 11,
    hash: crypto.data(data)
  }, {
    index: 2,
    size: 11,
    hash: crypto.data(data)
  })

  t.alike(parent, b4a.from('3ad0c9b58b771d1b7707e1430f37c23a23dd46e0c7c3ab9c16f79d25f7c36804', 'hex'))
})

test('tree', function (t) {
  const roots = [
    { index: 3, size: 11, hash: b4a.alloc(32) },
    { index: 9, size: 2, hash: b4a.alloc(32) }
  ]

  t.alike(crypto.tree(roots), b4a.from('0e576a56b478cddb6ffebab8c494532b6de009466b2e9f7af9143fc54b9eaa36', 'hex'))
})

test('hash', function (t) {
  const hash1 = b4a.allocUnsafe(32)
  const hash2 = b4a.allocUnsafe(32)
  const hash3 = b4a.allocUnsafe(32)

  const input = [b4a.alloc(24, 0x3), b4a.alloc(12, 0x63)]

  sodium.crypto_generichash(hash1, b4a.concat(input))
  sodium.crypto_generichash_batch(hash2, input)
  crypto.hash(input, hash3)

  t.alike(hash2, hash1)
  t.alike(hash3, hash1)
  t.alike(crypto.hash(input), hash1)
  t.alike(crypto.hash(b4a.concat(input)), hash1)
})

test('namespace', function (t) {
  const ns = crypto.namespace('spaceswarm-secret-stream', 2)

  t.alike(ns[0], b4a.from('0df8254b6340e1191c6512ff230f394b0f9f96c2ed505d3127e1ec6a3fe0f70e', 'hex'))
  t.alike(ns[1], b4a.from('6a51c2e03e4da9c3bf794ca72f406786cbf27310eedaa626455bde3cca47beb1', 'hex'))
  t.is(ns[0].buffer.byteLength < 1000, true, 'no default slab')
  t.is(ns[0].buffer, ns[1].buffer, 'slab shared between entries')
})

test('namespace (random access)', function (t) {
  const ns = crypto.namespace('spaceswarm-secret-stream', [1, 0])

  t.alike(ns[0], b4a.from('6a51c2e03e4da9c3bf794ca72f406786cbf27310eedaa626455bde3cca47beb1', 'hex'))
  t.alike(ns[1], b4a.from('0df8254b6340e1191c6512ff230f394b0f9f96c2ed505d3127e1ec6a3fe0f70e', 'hex'))
})

test('another namespace', function (t) {
  const ns = crypto.namespace('foo', [1])

  t.alike(ns[0], b4a.from('fff5eac99641b1b9dee6cabaaeb5959f4b452f7c83769156566aa44de89c82fb', 'hex'))
})

test('random namespace', function (t) {
  const s = Math.random().toString()
  const ns1 = crypto.namespace(s, 10).slice(1)
  const ns2 = crypto.namespace(s, [1, 2, 3, 4, 5, 6, 7, 8, 9])

  t.alike(ns1, ns2)
})

test('discovery key does not use slabs', function (t) {
  const key = b4a.allocUnsafe(32)
  const discKey = crypto.discoveryKey(key)
  t.is(discKey.buffer.byteLength, 32, 'does not use slab memory')
})
