import Foundation
import StoreKit

/// The JSON shapes the bridge sends to JavaScript; `src/types.ts` mirrors them.

enum ProductKind: String, Encodable {
    case consumable
    case nonConsumable
    case nonRenewable
    case autoRenewable
    case unknown

    init(_ type: Product.ProductType) {
        switch type {
        case .consumable: self = .consumable
        case .nonConsumable: self = .nonConsumable
        case .nonRenewable: self = .nonRenewable
        case .autoRenewable: self = .autoRenewable
        default: self = .unknown
        }
    }
}

enum PeriodUnit: String, Encodable {
    case day
    case week
    case month
    case year
    case unknown

    init(_ unit: Product.SubscriptionPeriod.Unit) {
        switch unit {
        case .day: self = .day
        case .week: self = .week
        case .month: self = .month
        case .year: self = .year
        @unknown default: self = .unknown
        }
    }
}

struct SubscriptionPeriodPayload: Encodable {
    let unit: PeriodUnit
    let value: Int
}

struct ProductPayload: Encodable {
    let id: String
    let type: ProductKind
    let displayName: String
    let description: String
    /// Localized, with currency, ready to show.
    let displayPrice: String
    /// Decimal as a string, so no precision is lost on the way to JavaScript.
    let price: String
    let currencyCode: String?
    let subscriptionGroupId: String?
    let subscriptionPeriod: SubscriptionPeriodPayload?

    init(_ product: Product) {
        id = product.id
        type = ProductKind(product.type)
        displayName = product.displayName
        description = product.description
        displayPrice = product.displayPrice
        price = "\(product.price)"
        currencyCode = product.priceFormatStyle.currencyCode
        subscriptionGroupId = product.subscription?.subscriptionGroupID
        subscriptionPeriod = product.subscription.map {
            SubscriptionPeriodPayload(unit: PeriodUnit($0.subscriptionPeriod.unit), value: $0.subscriptionPeriod.value)
        }
    }
}

struct TransactionPayload: Encodable {
    /// The JWS StoreKit signed. Send this to your server and verify it there.
    let signedTransaction: String
    /// Whether StoreKit's on-device check passed. A hint, not proof.
    let verified: Bool
    let id: String
    let originalId: String
    let productId: String
    let productType: ProductKind
    let purchaseDate: Date
    let originalPurchaseDate: Date
    let expirationDate: Date?
    let revocationDate: Date?
    let isUpgraded: Bool
    let appAccountToken: String?
    let environment: String

    init(_ verification: VerificationResult<Transaction>) {
        let transaction: Transaction
        switch verification {
        case .verified(let value):
            transaction = value
            verified = true
        case .unverified(let value, _):
            transaction = value
            verified = false
        }
        signedTransaction = verification.jwsRepresentation
        id = String(transaction.id)
        originalId = String(transaction.originalID)
        productId = transaction.productID
        productType = ProductKind(transaction.productType)
        purchaseDate = transaction.purchaseDate
        originalPurchaseDate = transaction.originalPurchaseDate
        expirationDate = transaction.expirationDate
        revocationDate = transaction.revocationDate
        isUpgraded = transaction.isUpgraded
        appAccountToken = transaction.appAccountToken?.uuidString.lowercased()
        environment = transaction.environment.rawValue
    }
}

enum PurchaseOutcome: String, Encodable {
    case purchased
    case pending
    case cancelled
}

struct PurchasePayload: Encodable {
    let outcome: PurchaseOutcome
    let transaction: TransactionPayload?
}
