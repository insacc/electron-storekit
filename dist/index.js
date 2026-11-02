"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreKitError = void 0;
exports.products = products;
exports.purchase = purchase;
exports.finish = finish;
exports.currentEntitlements = currentEntitlements;
exports.sync = sync;
exports.onTransaction = onTransaction;
const node_path_1 = __importDefault(require("node:path"));
const types_1 = require("./types");
__exportStar(require("./types"), exports);
class StoreKitError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = 'StoreKitError';
        this.code = code;
    }
}
exports.StoreKitError = StoreKitError;
let binding = null;
/** Loaded on first use, so importing this package on Windows or Linux is safe. */
function native() {
    if (process.platform !== 'darwin') {
        throw new StoreKitError(types_1.StoreKitErrorCode.UnsupportedPlatform, 'StoreKit is only available on macOS');
    }
    if (binding == null) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const load = require('node-gyp-build');
        binding = load(node_path_1.default.join(__dirname, '..'));
    }
    return binding;
}
async function call(invoke) {
    try {
        return JSON.parse(await invoke(native()));
    }
    catch (error) {
        throw toStoreKitError(error);
    }
}
function toStoreKitError(error) {
    const payload = error?.payload;
    if (typeof payload !== 'string') {
        return error;
    }
    const parsed = JSON.parse(payload);
    return new StoreKitError(parsed.code ?? types_1.StoreKitErrorCode.StoreKit, parsed.message ?? 'StoreKit failed');
}
/** Products from App Store Connect (or a StoreKit configuration). Unknown
 * identifiers are left out rather than rejected. */
function products(identifiers) {
    return call((addon) => addon.products(JSON.stringify(identifiers)));
}
/** Shows Apple's purchase sheet. A purchased transaction stays unfinished
 * until you call `finish`, so StoreKit redelivers it if your app dies first. */
function purchase(productId, options = {}) {
    return call((addon) => addon.purchase(productId, options.appAccountToken));
}
/** Tells StoreKit the purchase was delivered. Call it only after your server
 * (or your app) has recorded the transaction. */
async function finish(transactionId) {
    await call((addon) => addon.finish(transactionId));
}
/** The transactions that currently entitle this Apple account: active
 * subscriptions and non-consumables, minus refunds. */
function currentEntitlements() {
    return call((addon) => addon.currentEntitlements());
}
/** Forces a sync with the App Store, for a "Restore Purchases" button. May
 * show a sign-in sheet; StoreKit normally syncs on its own. */
async function sync() {
    await call((addon) => addon.sync());
}
const listeners = new Set();
/** Transactions StoreKit delivers outside `purchase`: unfinished ones from
 * earlier launches, then renewals, refunds, Ask to Buy approvals and
 * purchases made on other devices. Subscribe once at launch. Returns a
 * function that unsubscribes. */
function onTransaction(listener) {
    const addon = native();
    listeners.add(listener);
    if (listeners.size === 1) {
        try {
            addon.listen((json) => {
                const transaction = JSON.parse(json);
                for (const subscriber of listeners) {
                    subscriber(transaction);
                }
            });
        }
        catch (error) {
            listeners.delete(listener);
            throw toStoreKitError(error);
        }
    }
    return () => {
        if (listeners.delete(listener) && listeners.size === 0) {
            addon.stopListening();
        }
    };
}
