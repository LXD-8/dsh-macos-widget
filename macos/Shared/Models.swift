import Foundation

/// One registered widget in the bridge directory.
struct WidgetItem: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String?
}

/// The directory payload served by `GET /widgets`.
struct WidgetDirectory: Decodable {
    let selectedId: String?
    let widgets: [WidgetItem]
}

/// The generic payload every widget provider renders.
struct WidgetPayload: Decodable, Hashable {
    /// Presentation the providing plugin chose for its widget.
    struct Style: Decodable, Hashable {
        /// `list` renders sections and rows; `single` renders the tightest value.
        let layout: String?
        /// Fallback accent for section markers.
        let accent: String?
        /// Optional `#RRGGBB` card background.
        let background: String?
        /// Whether the header shows the update time.
        let showUpdated: Bool?
    }

    struct Section: Decodable, Hashable, Identifiable {
        let id: String
        let title: String
        let subtitle: String?
        let accent: String?
        let rows: [Row]
    }

    struct Row: Decodable, Hashable, Identifiable {
        let label: String
        let value: Double
        let max: Double?
        let unit: String?
        let detail: String?

        var id: String { "\(label)-\(value)" }
    }

    let title: String?
    let subtitle: String?
    let updatedAt: String?
    let style: Style?
    let sections: [Section]
}
