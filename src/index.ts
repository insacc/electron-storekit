import path from 'node:path';

import {
  Product,
  PurchaseOptions,
  PurchaseResult,
  StoreKitErrorCode,
  Transaction,
  TransactionListener,
} from './types';

export * from './types';

/** The raw addon: every call settles with a JSON string. */
interface Binding {
  products(identifiersJson: string): Promise<string>;
  purchase(productId: string, appAccountToken?: string): Promise<string>;
  finish(transactionId: string): Promise<string>;
  currentEntitlements(): Promise<string>;
  sync(): Promise<string>;
  listen(listener: (json: string) => void): void;
  stopListening(): void;
}

export class StoreKitError extends Error {
  readonly code: StoreKitErrorCode;

  constructor(code: StoreKitErrorCode, message: string) {
    super(message);
    this.name = 'StoreKitError';
    this.code = code;
  }
}

let binding: Binding | null = null;

/** Loaded on first use, so importing this package on Windows or Linux is safe. */
function native(): Binding {
  if (process.platform !== 'darwin') {
    throw new StoreKitError(StoreKitErrorCode.UnsupportedPlatform, 'StoreKit is only available on macOS');
  }
  if (binding == null) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const load = require('node-gyp-build') as (directory: string) => Binding;
    binding = load(path.join(__dirname, '..'));
  }
  return binding;
}

async function call<T>(invoke: (addon: Binding) => Promise<string>): Promise<T> {
  try {
    return JSON.parse(await invoke(native())) as T;
  } catch (error) {
    throw toStoreKitError(error);
  }
}

function toStoreKitError(error: unknown): unknown {
  const payload = (error as { payload?: unknown } | null)?.payload;
  if (typeof payload !== 'string') {
    return error;
  }
  const parsed = JSON.parse(payload) as { code?: StoreKitErrorCode; message?: string };
  return new StoreKitError(parsed.code ?? StoreKitErrorCode.StoreKit, parsed.message ?? 'StoreKit failed');
}

/** Products from App Store Connect (or a StoreKit configuration). Unknown
 * identifiers are left out rather than rejected. */
export function products(identifiers: string[]): Promise<Product[]> {
  return call((addon) => addon.products(JSON.stringify(identifiers)));
}

/** Shows Apple's purchase sheet. A purchased transaction stays unfinished
 * until you call `finish`, so StoreKit redelivers it if your app dies first. */
export function purchase(productId: string, options: PurchaseOptions = {}): Promise<PurchaseResult> {
  return call((addon) => addon.purchase(productId, options.appAccountToken));
}

/** Tells StoreKit the purchase was delivered. Call it only after your server
 * (or your app) has recorded the transaction. */
export async function finish(transactionId: string): Promise<void> {
  await call((addon) => addon.finish(transactionId));
}

/** The transactions that currently entitle this Apple account: active
 * subscriptions and non-consumables, minus refunds. */
export function currentEntitlements(): Promise<Transaction[]> {
  return call((addon) => addon.currentEntitlements());
}

/** Forces a sync with the App Store, for a "Restore Purchases" button. May
 * show a sign-in sheet; StoreKit normally syncs on its own. */
export async function sync(): Promise<void> {
  await call((addon) => addon.sync());
}

const listeners = new Set<TransactionListener>();

/** Transactions StoreKit delivers outside `purchase`: unfinished ones from
 * earlier launches, then renewals, refunds, Ask to Buy approvals and
 * purchases made on other devices. Subscribe once at launch. Returns a
 * function that unsubscribes. */
export function onTransaction(listener: TransactionListener): () => void {
  const addon = native();
  listeners.add(listener);
  if (listeners.size === 1) {
    addon.listen((json) => {
      const transaction = JSON.parse(json) as Transaction;
      for (const subscriber of listeners) {
        subscriber(transaction);
      }
    });
  }
  return () => {
    if (listeners.delete(listener) && listeners.size === 0) {
      addon.stopListening();
    }
  };
}
