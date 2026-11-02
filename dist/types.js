"use strict";
/** Mirrors the JSON shapes in swift/Payloads.swift. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreKitErrorCode = exports.PurchaseOutcome = exports.PeriodUnit = exports.ProductType = void 0;
var ProductType;
(function (ProductType) {
    ProductType["Consumable"] = "consumable";
    ProductType["NonConsumable"] = "nonConsumable";
    ProductType["NonRenewable"] = "nonRenewable";
    ProductType["AutoRenewable"] = "autoRenewable";
    ProductType["Unknown"] = "unknown";
})(ProductType || (exports.ProductType = ProductType = {}));
var PeriodUnit;
(function (PeriodUnit) {
    PeriodUnit["Day"] = "day";
    PeriodUnit["Week"] = "week";
    PeriodUnit["Month"] = "month";
    PeriodUnit["Year"] = "year";
    PeriodUnit["Unknown"] = "unknown";
})(PeriodUnit || (exports.PeriodUnit = PeriodUnit = {}));
var PurchaseOutcome;
(function (PurchaseOutcome) {
    PurchaseOutcome["Purchased"] = "purchased";
    /** Waiting on something outside the app (Ask to Buy, a bank). The
     * transaction arrives later through `onTransaction`. */
    PurchaseOutcome["Pending"] = "pending";
    PurchaseOutcome["Cancelled"] = "cancelled";
})(PurchaseOutcome || (exports.PurchaseOutcome = PurchaseOutcome = {}));
var StoreKitErrorCode;
(function (StoreKitErrorCode) {
    StoreKitErrorCode["InvalidArgument"] = "invalidArgument";
    StoreKitErrorCode["ProductNotFound"] = "productNotFound";
    StoreKitErrorCode["TransactionNotFound"] = "transactionNotFound";
    StoreKitErrorCode["Cancelled"] = "cancelled";
    StoreKitErrorCode["NotAllowed"] = "notAllowed";
    StoreKitErrorCode["NetworkError"] = "networkError";
    StoreKitErrorCode["StoreKit"] = "storeKit";
    StoreKitErrorCode["UnsupportedPlatform"] = "unsupportedPlatform";
})(StoreKitErrorCode || (exports.StoreKitErrorCode = StoreKitErrorCode = {}));
