import Foundation

enum BridgeError: LocalizedError {
    case badStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badStatus(let code): return "Bridge returned HTTP \(code)"
        }
    }
}

/// Reads the widget directory and payloads from the DSH plugin bridge.
enum BridgeClient {
    /// Loopback port the plugin's `macos-widget` bridge listens on.
    static let base = URL(string: "http://127.0.0.1:47823")!

    static func directory() async throws -> WidgetDirectory {
        try await get(WidgetDirectory.self, path: "/widgets")
    }

    static func selectedPayload() async throws -> WidgetPayload {
        try await get(WidgetPayload.self, path: "/widget")
    }

    static func payload(id: String) async throws -> WidgetPayload {
        try await get(WidgetPayload.self, path: "/widgets/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)")
    }

    private static func get<T: Decodable>(_ type: T.Type, path: String) async throws -> T {
        var request = URLRequest(url: URL(string: path, relativeTo: base)!)
        request.timeoutInterval = 10
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw BridgeError.badStatus(-1) }
        guard http.statusCode == 200 else { throw BridgeError.badStatus(http.statusCode) }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
