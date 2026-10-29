import Foundation
import StoreKit

/// C entry points over StoreKit 2 for the Node addon. Every call answers once
/// through `reply(context, json, error)`: `json` on success, `error` (a JSON
/// `{ code, message }`) on failure, the other one null. Replies arrive on a
/// background thread; the addon hops back to JavaScript.
public typealias StoreKitReply = @convention(c) (
    UnsafeMutableRawPointer?, UnsafePointer<CChar>?, UnsafePointer<CChar>?
) -> Void

enum BridgeErrorCode: String, Encodable {
    case invalidArgument
    case productNotFound
    case transactionNotFound
    case storeKit
}

struct BridgeError: Error, Encodable {
    let code: BridgeErrorCode
    let message: String
}

/// The C context pointer belongs to the addon, which keeps it alive until the
/// single reply has been delivered.
struct Reply: @unchecked Sendable {
    let context: UnsafeMutableRawPointer?
    let callback: StoreKitReply

    func succeed<Value: Encodable>(_ value: Value) {
        do {
            let json = String(decoding: try JSONEncoder.bridge.encode(value), as: UTF8.self)
            json.withCString { callback(context, $0, nil) }
        } catch {
            fail(BridgeError(code: .storeKit, message: error.localizedDescription))
        }
    }

    func fail(_ error: Error) {
        let bridgeError = error as? BridgeError
            ?? BridgeError(code: .storeKit, message: error.localizedDescription)
        let data = (try? JSONEncoder.bridge.encode(bridgeError)) ?? Data("{}".utf8)
        String(decoding: data, as: UTF8.self).withCString { callback(context, nil, $0) }
    }

    /// Runs `work` off the calling thread and replies with its result.
    func run<Value: Encodable>(_ work: @escaping @Sendable () async throws -> Value) {
        Task.detached {
            do {
                succeed(try await work())
            } catch {
                fail(error)
            }
        }
    }
}

extension JSONEncoder {
    static let bridge: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}

private struct Empty: Encodable {}

@_cdecl("storekit_products")
public func storekitProducts(
    _ identifiersJSON: UnsafePointer<CChar>,
    _ context: UnsafeMutableRawPointer?,
    _ callback: StoreKitReply
) {
    let reply = Reply(context: context, callback: callback)
    guard let identifiers = try? JSONDecoder().decode([String].self, from: Data(String(cString: identifiersJSON).utf8)) else {
        reply.fail(BridgeError(code: .invalidArgument, message: "Product identifiers must be an array of strings"))
        return
    }
    reply.run {
        try await Product.products(for: identifiers).map(ProductPayload.init)
    }
}

@_cdecl("storekit_purchase")
public func storekitPurchase(
    _ productIdentifier: UnsafePointer<CChar>,
    _ appAccountToken: UnsafePointer<CChar>?,
    _ context: UnsafeMutableRawPointer?,
    _ callback: StoreKitReply
) {
    let reply = Reply(context: context, callback: callback)
    let identifier = String(cString: productIdentifier)
    var options = Set<Product.PurchaseOption>()
    if let appAccountToken {
        guard let token = UUID(uuidString: String(cString: appAccountToken)) else {
            reply.fail(BridgeError(code: .invalidArgument, message: "appAccountToken must be a UUID"))
            return
        }
        options.insert(.appAccountToken(token))
    }
    let purchaseOptions = options
    reply.run {
        guard let product = try await Product.products(for: [identifier]).first else {
            throw BridgeError(code: .productNotFound, message: "No product with identifier \(identifier)")
        }
        switch try await product.purchase(options: purchaseOptions) {
        case .success(let verification):
            return PurchasePayload(
                outcome: .purchased,
                transaction: await TransactionStore.shared.remember(verification)
            )
        case .pending:
            return PurchasePayload(outcome: .pending, transaction: nil)
        case .userCancelled:
            return PurchasePayload(outcome: .cancelled, transaction: nil)
        @unknown default:
            return PurchasePayload(outcome: .cancelled, transaction: nil)
        }
    }
}

@_cdecl("storekit_finish")
public func storekitFinish(
    _ transactionIdentifier: UnsafePointer<CChar>,
    _ context: UnsafeMutableRawPointer?,
    _ callback: StoreKitReply
) {
    let reply = Reply(context: context, callback: callback)
    guard let identifier = UInt64(String(cString: transactionIdentifier)) else {
        reply.fail(BridgeError(code: .invalidArgument, message: "Transaction id must be numeric"))
        return
    }
    reply.run {
        try await TransactionStore.shared.finish(identifier)
        return Empty()
    }
}

@_cdecl("storekit_current_entitlements")
public func storekitCurrentEntitlements(
    _ context: UnsafeMutableRawPointer?,
    _ callback: StoreKitReply
) {
    Reply(context: context, callback: callback).run {
        var transactions: [TransactionPayload] = []
        for await verification in Transaction.currentEntitlements {
            transactions.append(await TransactionStore.shared.remember(verification))
        }
        return transactions
    }
}

@_cdecl("storekit_sync")
public func storekitSync(
    _ context: UnsafeMutableRawPointer?,
    _ callback: StoreKitReply
) {
    Reply(context: context, callback: callback).run {
        try await AppStore.sync()
        return Empty()
    }
}

/// Starts delivering `Transaction.unfinished`, then `Transaction.updates`,
/// one reply per transaction, until `storekit_stop_listening`. A second call
/// replaces the first listener.
@_cdecl("storekit_listen")
public func storekitListen(_ callback: StoreKitReply) {
    let reply = Reply(context: nil, callback: callback)
    Listener.shared.start {
        for await verification in Transaction.unfinished {
            guard !Task.isCancelled else { return }
            reply.succeed(await TransactionStore.shared.remember(verification))
        }
        for await verification in Transaction.updates {
            guard !Task.isCancelled else { return }
            reply.succeed(await TransactionStore.shared.remember(verification))
        }
    }
}

@_cdecl("storekit_stop_listening")
public func storekitStopListening() {
    Listener.shared.stop()
}
