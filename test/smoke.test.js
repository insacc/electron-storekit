const assert = require('node:assert/strict');
const test = require('node:test');

const storekit = require('..');

// Outside a signed app bundle StoreKit refuses every request, so plain `node`
// only proves the round trip: the call reaches StoreKit and its answer comes
// back as a typed result or a typed error.
test('a product request round-trips through StoreKit', { timeout: 30_000 }, async () => {
  try {
    assert.deepEqual(await storekit.products([]), []);
  } catch (error) {
    assert.ok(error instanceof storekit.StoreKitError);
    assert.equal(error.code, storekit.StoreKitErrorCode.StoreKit);
  }
});

test('a malformed app account token is rejected before StoreKit is asked', async () => {
  await assert.rejects(
    storekit.purchase('com.example.pro', { appAccountToken: 'not-a-uuid' }),
    (error) => error instanceof storekit.StoreKitError && error.code === storekit.StoreKitErrorCode.InvalidArgument,
  );
});

test('finishing a non-numeric transaction id is rejected', async () => {
  await assert.rejects(
    storekit.finish('abc'),
    (error) => error instanceof storekit.StoreKitError && error.code === storekit.StoreKitErrorCode.InvalidArgument,
  );
});

test('a transaction listener can subscribe and unsubscribe', () => {
  const unsubscribe = storekit.onTransaction(() => {});
  unsubscribe();
});
