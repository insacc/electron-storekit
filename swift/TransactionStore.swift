import StoreKit

/// Transactions handed to JavaScript but not finished yet, so `finish` can
/// find them by id. One StoreKit hands out can also be found in
/// `Transaction.unfinished` after a relaunch.
actor TransactionStore {
    static let shared = TransactionStore()

    private var pending: [UInt64: Transaction] = [:]

    func remember(_ verification: VerificationResult<Transaction>) -> TransactionPayload {
        let transaction = verification.unsafePayloadValue
        pending[transaction.id] = transaction
        return TransactionPayload(verification)
    }

    func finish(_ identifier: UInt64) async throws {
        if let transaction = pending.removeValue(forKey: identifier) {
            await transaction.finish()
            return
        }
        for await verification in Transaction.unfinished {
            let transaction = verification.unsafePayloadValue
            if transaction.id == identifier {
                await transaction.finish()
                return
            }
        }
        throw BridgeError(code: .transactionNotFound, message: "No unfinished transaction with id \(identifier)")
    }
}
