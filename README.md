# electron-storekit

StoreKit 2 in-app purchases for Electron (and Node) on macOS.

Electron's built-in `inAppPurchase` module wraps the original StoreKit API, which gives you receipts. This package wraps **StoreKit 2**: typed products, async purchases, `Transaction.updates`, and the **signed JWS transaction** that Apple's App Store Server Library and every modern backend expect.

- macOS 13+, Apple silicon and Intel (prebuilt binaries, no Xcode needed to install)
- Electron main process (or plain Node inside a signed app bundle)
- No server and no vendor lock-in: you get StoreKit's data and decide what to do with it

## Install

```sh
npm install electron-storekit
```

Importing it on Windows or Linux is safe; every call rejects with `StoreKitErrorCode.UnsupportedPlatform`.

## Use

```js
const storekit = require('electron-storekit');

// At launch, before any purchase UI: transactions StoreKit delivers outside
// `purchase` (unfinished ones, renewals, refunds, Ask to Buy, other devices).
storekit.onTransaction(async (transaction) => {
  await recordOnYourServer(transaction.signedTransaction);
  await storekit.finish(transaction.id);
});

const products = await storekit.products(['com.example.pro.monthly']);

const result = await storekit.purchase(products[0].id, {
  appAccountToken: '6f9619ff-8b86-4011-b42d-00c04fc964ff', // optional, your user's UUID
});
if (result.outcome === storekit.PurchaseOutcome.Purchased) {
  await recordOnYourServer(result.transaction.signedTransaction);
  await storekit.finish(result.transaction.id);
}

// "Restore Purchases" button
await storekit.sync();
const owned = await storekit.currentEntitlements();
```

### API

- `products(ids)`: products from App Store Connect; unknown ids are left out.
- `purchase(productId, { appAccountToken? })`: shows Apple's sheet, resolves `{ outcome, transaction }`. `outcome` is `purchased`, `pending` (Ask to Buy, bank) or `cancelled`.
- `finish(transactionId)`: tell StoreKit the purchase is delivered. Until then StoreKit redelivers it through `onTransaction`, even after a crash.
- `currentEntitlements()`: transactions that entitle this Apple account now.
- `sync()`: force an App Store sync; may show a sign-in sheet.
- `onTransaction(listener)`: returns an unsubscribe function.

Every transaction carries `signedTransaction` (the JWS), `verified` (StoreKit's on-device check), ids, product, dates, `revocationDate`, `appAccountToken` and `environment`.

## Things to know

- **Verify on your server.** `verified` is a hint. Send `signedTransaction` to your backend and verify it with Apple's [App Store Server Library](https://github.com/apple/app-store-server-library-node) before granting anything.
- **Main process only.** Call it from Electron's main process and reach it from pages over IPC (see `example/`).
- **Signed builds only.** StoreKit answers only an app whose bundle id has products in App Store Connect. Unsigned `electron .` and plain `node` get `Unable to Complete Request`. Test with a sandbox Apple account on a signed development build, or a Mac App Store build.
- **Mac App Store sandbox.** MAS builds need `com.apple.security.app-sandbox` and `com.apple.security.network.client` entitlements.

## Example

```sh
npm install && npm run build
cd example && npm install && PRODUCT_IDS=com.example.pro.monthly npm start
```

## Build from source

Needs Xcode 15+ (Swift 5.9+). `npm run build` compiles the Swift bridge (`swift/`) into a universal static library, links it into the Node-API addon (`native/`), and compiles `src/`. `npm run prebuilds` produces the binaries that ship in the package.

## License

MIT

## Fork integration notes

This fork retains upstream's StoreKit 2 API and adds Git-install TypeScript
preparation, concurrent unfinished replay/live updates, native listener cleanup
on Node/Electron environment shutdown, listener-start retry handling, and typed
cancellation/payment-restriction/network errors. Optional Swift JSON fields are
optional in the TypeScript declarations as well.

Generated `dist/` entry points and declarations are committed for consumers
that intentionally install Git dependencies with `--ignore-scripts`. They are
regenerated with `npm run build:ts`; CI checks that they match the source.
Native binaries are not committed: such consumers must explicitly rebuild the
addon with their normal native build pipeline.

The bridge uses Node-API and requires macOS 13 or later. Building from a pinned
Git commit requires Xcode/Swift and the normal Node native build prerequisites.
Smoke tests outside a signed bundle validate compilation, argument/error
round-trips and cleanup, not real purchases, restores, renewals or Apple account
behavior. Those still require a signed app and sandbox acceptance testing.
