/** Mirrors the JSON shapes in swift/Payloads.swift. */

export enum ProductType {
  Consumable = 'consumable',
  NonConsumable = 'nonConsumable',
  NonRenewable = 'nonRenewable',
  AutoRenewable = 'autoRenewable',
  Unknown = 'unknown',
}

export enum PeriodUnit {
  Day = 'day',
  Week = 'week',
  Month = 'month',
  Year = 'year',
  Unknown = 'unknown',
}

export interface SubscriptionPeriod {
  unit: PeriodUnit;
  value: number;
}

export interface Product {
  id: string;
  type: ProductType;
  displayName: string;
  description: string;
  /** Localized and formatted with currency, ready to show. */
  displayPrice: string;
  /** Decimal price as a string, so no precision is lost. */
  price: string;
  currencyCode: string | null;
  subscriptionGroupId: string | null;
  subscriptionPeriod: SubscriptionPeriod | null;
}

export interface Transaction {
  /** The JWS StoreKit signed. Send it to your server and verify it there. */
  signedTransaction: string;
  /** Whether StoreKit's on-device check passed. A hint, not proof. */
  verified: boolean;
  id: string;
  originalId: string;
  productId: string;
  productType: ProductType;
  /** ISO 8601. */
  purchaseDate: string;
  originalPurchaseDate: string;
  expirationDate: string | null;
  revocationDate: string | null;
  isUpgraded: boolean;
  /** Lowercase UUID, when the purchase carried one. */
  appAccountToken: string | null;
  /** `Production`, `Sandbox` or `Xcode`. */
  environment: string;
}

export enum PurchaseOutcome {
  Purchased = 'purchased',
  /** Waiting on something outside the app (Ask to Buy, a bank). The
   * transaction arrives later through `onTransaction`. */
  Pending = 'pending',
  Cancelled = 'cancelled',
}

export interface PurchaseResult {
  outcome: PurchaseOutcome;
  /** Present when `outcome` is `Purchased`. Finish it once you have
   * delivered what was bought. */
  transaction: Transaction | null;
}

export interface PurchaseOptions {
  /** A UUID tying the purchase to your own account; Apple returns it on the
   * transaction and in App Store Server Notifications. */
  appAccountToken?: string;
}

export enum StoreKitErrorCode {
  InvalidArgument = 'invalidArgument',
  ProductNotFound = 'productNotFound',
  TransactionNotFound = 'transactionNotFound',
  StoreKit = 'storeKit',
  UnsupportedPlatform = 'unsupportedPlatform',
}

export type TransactionListener = (transaction: Transaction) => void;
