import SwiftUI

/// Severity color for a used percentage.
func severityColor(_ percent: Double) -> Color {
    if percent >= 85 { return Color(red: 0.86, green: 0.22, blue: 0.20) }
    if percent >= 60 { return Color(red: 0.93, green: 0.60, blue: 0.10) }
    return Color(red: 0.18, green: 0.68, blue: 0.35)
}

extension Color {
    /// Parse a `#RRGGBB` accent from a widget payload.
    init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let number = UInt64(value, radix: 16) else { return nil }
        self.init(
            red: Double((number >> 16) & 0xFF) / 255,
            green: Double((number >> 8) & 0xFF) / 255,
            blue: Double(number & 0xFF) / 255
        )
    }
}

/// Clock text for a payload's `updatedAt` ISO timestamp.
func clockText(_ iso: String?) -> String? {
    guard let iso, let date = ISO8601DateFormatter.withFractional.date(from: iso)
        ?? ISO8601DateFormatter.plain.date(from: iso) else { return nil }
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm"
    return formatter.string(from: date)
}

extension ISO8601DateFormatter {
    static let withFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}

/// A thin rounded meter with a visible track.
struct MeterBar: View {
    let value: Double
    let max: Double
    let tint: Color

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.primary.opacity(0.10))
                Capsule()
                    .fill(tint)
                    .frame(width: Swift.max(4, proxy.size.width * Swift.min(Swift.max(value / max, 0), 1)))
            }
        }
        .frame(height: 5)
    }
}
