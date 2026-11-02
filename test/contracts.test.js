const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(platform = 'darwin') {
  const calls = [];
  let callback;
  let failListen = false;
  const addon = Object.fromEntries(
    ['products', 'purchase', 'finish', 'currentEntitlements', 'sync'].map(name => [
      name, async (...args) => { calls.push([name, ...args]); return name === 'products' ? '[]' : '{}'; },
    ]),
  );
  addon.listen = listener => {
    calls.push(['listen']);
    if (failListen) throw new Error('listener unavailable');
    callback = listener;
  };
  addon.stopListening = () => calls.push(['stop']);
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../dist/index.js'), 'utf8'), {
    exports, __dirname: path.resolve(__dirname, '../dist'), process: { platform },
    require: name => name === 'node-gyp-build' ? () => addon
      : name === './types' ? require('../dist/types') : require(name),
  });
  return {
    api: exports, calls, addon,
    emit: value => callback(JSON.stringify(value)),
    failListen: value => { failListen = value; },
  };
}

test('all one-shot APIs preserve native arguments and parse JSON responses', async () => {
  const { api, calls } = fixture();
  assert.equal((await api.products(['example.product'])).length, 0);
  await api.purchase('example.product', { appAccountToken: 'example-token' });
  await api.finish('123');
  await api.currentEntitlements();
  await api.sync();
  assert.deepEqual(calls, [
    ['products', '["example.product"]'], ['purchase', 'example.product', 'example-token'],
    ['finish', '123'], ['currentEntitlements'], ['sync'],
  ]);
});

for (const code of ['invalidArgument', 'productNotFound', 'transactionNotFound', 'cancelled', 'notAllowed', 'networkError']) {
  test(`native ${code} failures remain typed errors`, async () => {
    const { api, addon } = fixture();
    addon.sync = async () => { throw { payload: JSON.stringify({ code, message: 'Test failure' }) }; };
    await assert.rejects(api.sync(), error => error instanceof api.StoreKitError && error.code === code);
  });
}

test('listeners share one native subscription, unsubscribe independently and preserve signed transactions', () => {
  const { api, calls, emit } = fixture();
  const first = [];
  const second = [];
  const offFirst = api.onTransaction(value => first.push(value));
  const offSecond = api.onTransaction(value => second.push(value));
  emit({ id: '123', signedTransaction: 'header.payload.signature' });
  assert.equal(first[0].signedTransaction, 'header.payload.signature');
  assert.equal(second.length, 1);
  offFirst();
  emit({ id: '456' });
  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
  offSecond();
  offSecond();
  assert.deepEqual(calls, [['listen'], ['stop']]);
});

test('a failed native subscription does not prevent subsequent subscriptions', () => {
  const setup = fixture();
  setup.failListen(true);
  assert.throws(() => setup.api.onTransaction(() => {}), /listener unavailable/);
  setup.failListen(false);
  const received = [];
  const unsubscribe = setup.api.onTransaction(value => received.push(value));
  setup.emit({ id: 'retry' });
  assert.equal(received[0].id, 'retry');
  unsubscribe();
  assert.deepEqual(setup.calls, [['listen'], ['listen'], ['stop']]);
});

for (const platform of ['win32', 'linux']) {
  test(`non-macOS ${platform} imports are safe and operations reject explicitly`, async () => {
    const { api } = fixture(platform);
    await assert.rejects(api.products([]), error =>
      error instanceof api.StoreKitError && error.code === api.StoreKitErrorCode.UnsupportedPlatform);
  });
}

test('native environment cleanup permits exit with an active transaction listener', { skip: process.platform !== 'darwin' }, () => {
  const result = spawnSync(process.execPath, ['-e',
    "require('.').onTransaction(() => {}); setImmediate(() => process.exit(0));"],
  { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
