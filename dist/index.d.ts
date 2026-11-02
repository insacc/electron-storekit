import { Product, PurchaseOptions, PurchaseResult, StoreKitErrorCode, Transaction, TransactionListener } from './types';
export * from './types';
export declare class StoreKitError extends Error {
    readonly code: StoreKitErrorCode;
    constructor(code: StoreKitErrorCode, message: string);
}
/** Products from App Store Connect (or a StoreKit configuration). Unknown
 * identifiers are left out rather than rejected. */
export declare function products(identifiers: string[]): Promise<Product[]>;
/** Shows Apple's purchase sheet. A purchased transaction stays unfinished
 * until you call `finish`, so StoreKit redelivers it if your app dies first. */
export declare function purchase(productId: string, options?: PurchaseOptions): Promise<PurchaseResult>;
/** Tells StoreKit the purchase was delivered. Call it only after your server
 * (or your app) has recorded the transaction. */
export declare function finish(transactionId: string): Promise<void>;
/** The transactions that currently entitle this Apple account: active
 * subscriptions and non-consumables, minus refunds. */
export declare function currentEntitlements(): Promise<Transaction[]>;
/** Forces a sync with the App Store, for a "Restore Purchases" button. May
 * show a sign-in sheet; StoreKit normally syncs on its own. */
export declare function sync(): Promise<void>;
/** Transactions StoreKit delivers outside `purchase`: unfinished ones from
 * earlier launches, then renewals, refunds, Ask to Buy approvals and
 * purchases made on other devices. Subscribe once at launch. Returns a
 * function that unsubscribes. */
export declare function onTransaction(listener: TransactionListener): () => void;
