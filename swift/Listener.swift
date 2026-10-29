import Foundation

/// The one running transaction listener; starting a new one cancels the old.
final class Listener: @unchecked Sendable {
    static let shared = Listener()

    private let lock = NSLock()
    private var task: Task<Void, Never>?

    func start(_ work: @escaping @Sendable () async -> Void) {
        lock.lock()
        defer { lock.unlock() }
        task?.cancel()
        task = Task.detached(operation: work)
    }

    func stop() {
        lock.lock()
        defer { lock.unlock() }
        task?.cancel()
        task = nil
    }
}
