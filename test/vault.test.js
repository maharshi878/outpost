const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const createVault = require('../vault.js');

const fake = (over = {}) => ({
  isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome_libsecret',
  encryptString: s => Buffer.from('ENC:' + [...s].reverse().join('')), decryptString: b => [...b.toString().slice(4)].reverse().join(''), ...over
});
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vault-')), 'key.json');

test('the key is encrypted on disk, never stored as plain text', () => {
  const file = tmp(), v = createVault({ safeStorage: fake(), fs, file, platform: 'linux' });
  assert.equal(v.set('re_secret123'), 'keychain');
  assert.ok(!fs.readFileSync(file, 'utf8').includes('re_secret123'));
  assert.equal(createVault({ safeStorage: fake(), fs, file, platform: 'linux' }).get(), 're_secret123');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test('remove() deletes the file and forgets the key in one call', () => {
  const file = tmp(), v = createVault({ safeStorage: fake(), fs, file, platform: 'darwin' });
  v.set('re_x'); v.remove();
  assert.equal(fs.existsSync(file), false); assert.equal(v.get(), null); assert.equal(v.status().has, false);
});

test('Linux without a real keyring: memory only, nothing on disk', () => {
  const file = tmp(), v = createVault({ safeStorage: fake({ getSelectedStorageBackend: () => 'basic_text' }), fs, file, platform: 'linux' });
  assert.equal(v.set('re_mem'), 'session'); assert.equal(fs.existsSync(file), false);
  assert.equal(v.get(), 're_mem'); assert.equal(v.status().level, 'session');
});

test('encryption unavailable: memory only', () => {
  const file = tmp(), v = createVault({ safeStorage: fake({ isEncryptionAvailable: () => false }), fs, file, platform: 'win32' });
  assert.equal(v.set('re_mem'), 'session'); assert.equal(fs.existsSync(file), false);
});

test('a plain text key from 0.2.0 is upgraded when possible', () => {
  const file = tmp(); fs.writeFileSync(file, JSON.stringify({ enc: false, d: 're_old' }));
  const v = createVault({ safeStorage: fake(), fs, file, platform: 'darwin' });
  assert.equal(v.get(), 're_old'); assert.ok(!fs.readFileSync(file, 'utf8').includes('re_old'));
});

test('a plain text key from 0.2.0 is destroyed when it cannot be protected', () => {
  const file = tmp(); fs.writeFileSync(file, JSON.stringify({ enc: false, d: 're_old' }));
  const v = createVault({ safeStorage: fake({ isEncryptionAvailable: () => false }), fs, file, platform: 'win32' });
  assert.equal(v.get(), 're_old'); assert.equal(fs.existsSync(file), false);
});
