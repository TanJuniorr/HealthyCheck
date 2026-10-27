/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the actual TypeScript service code with external I/O replaced, without a device.
function load(relative, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`);
    return dependencies[name];
  }, Date, Promise, Error });
  return module.exports;
}

test('email validation rejects malformed addresses', () => {
  const { isValidEmail } = load('src/lib/authErrors.ts');
  for (const value of ['', 'a', 'a@b', ' a@b.com', 'a b@example.com']) assert.equal(isValidEmail(value), false);
  assert.equal(isValidEmail('user+health@example.com'), true);
});

test('auth errors never expose server details or credentials', () => {
  const { authErrorMessage } = load('src/lib/authErrors.ts');
  assert.match(authErrorMessage({ code: 'invalid_credentials' }), /không đúng/);
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /xác nhận/);
  assert.match(authErrorMessage({ status: 429 }), /quá nhiều/);
  assert.match(authErrorMessage(new Error('Failed to fetch')), /kết nối/);
  assert.equal(authErrorMessage({ message: 'private-server-detail' }).includes('private-server-detail'), false);
});

test('missing profile uses metadata or neutral identity without fabricated personal values', () => {
  const { displayName, profileText } = load('src/lib/profileRepository.ts', { '../services/profileService': {}, './dataErrors': load('src/lib/dataErrors.ts') });
  assert.equal(displayName({ user_metadata: { full_name: '  Minh  ' } }, null), 'Minh');
  assert.equal(displayName({ user_metadata: { full_name: 42 } }, null), 'Healthy Check Member');
  assert.equal(profileText({ height_cm: null }, 'height_cm'), null);
  assert.equal(displayName({ user_metadata: {} }, { full_name: 'Lan' }), 'Lan');
});

function recovery(auth, configurationError = null, platform = 'android') {
  return load('src/lib/authRecovery.ts', {
    'react-native': { Platform: { OS: platform } },
    'expo-linking': { createURL: route => `https://app.example${route}` },
    './supabase': { supabase: { auth }, authConfigurationError: configurationError },
  });
}

test('recovery sends a real request with the mobile callback and throttles duplicates', async () => {
  const calls = [];
  const service = recovery({ async resetPasswordForEmail(...args) { calls.push(args); return { error: null }; } });
  await service.sendRecoveryEmail('user@example.com');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].redirectTo, 'healthycheck://auth/callback');
  await assert.rejects(service.sendRecoveryEmail('user@example.com'), error => error.status === 429);
  assert.equal(calls.length, 1);
});

test('recovery preserves server failures and fails closed for missing configuration', async () => {
  const failure = { status: 429 };
  const service = recovery({ async resetPasswordForEmail() { return { error: failure }; } });
  await assert.rejects(service.sendRecoveryEmail('a@example.com'), error => error === failure);
  const unconfigured = recovery({}, 'Missing configuration');
  await assert.rejects(unconfigured.sendRecoveryEmail('a@example.com'), /Missing configuration/);
  await assert.rejects(unconfigured.exchangeAuthCode('code'), /Missing configuration/);
});

test('PKCE callbacks share in-flight exchanges and reject missing or invalid sessions', async () => {
  let release;
  let calls = 0;
  const service = recovery({ exchangeCodeForSession() { calls++; return new Promise(resolve => { release = resolve; }); } });
  const first = service.exchangeAuthCode('test-code');
  const second = service.exchangeAuthCode('test-code');
  assert.equal(first, second);
  assert.equal(calls, 1);
  release({ data: { session: null }, error: null });
  await assert.rejects(first, /Missing callback session/);
  const invalid = recovery({ async exchangeCodeForSession() { return { data: {}, error: new Error('invalid verifier') }; } });
  await assert.rejects(invalid.exchangeAuthCode('invalid-code'), /invalid verifier/);
});

test('web recovery uses the current web origin', () => {
  assert.equal(recovery({}, null, 'web').recoveryRedirectUrl(), 'https://app.example/auth/callback');
});
