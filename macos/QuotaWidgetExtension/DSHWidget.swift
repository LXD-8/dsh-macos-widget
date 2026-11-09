import SwiftUI
import WidgetKit

// MARK: - Timeline

struct DSHWidgetEntry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload?
    let error: String?

    static let sample = DSHWidgetEntry(
        date: Date(),
        payload: WidgetPayload(
            title: "示例小组件",
            subtitle: "由某个插件提供",
            updatedAt: nil,
            style: WidgetPayload.Style(layout: "list", accent: "#4D6BFE", background: nil, showUpdated: true),
            sections: [
                WidgetPayload.Section(id: "example", title: "示例插件", subtitle: "示例", accent: "#10B981", rows: [
                    WidgetPayload.Row(label: "指标 A", value: 42, max: 100, unit: "%", detail: "示例明细"),
                    WidgetPayload.Row(label: "指标 B", value: 18, max: 100, unit: "%", detail: "示例明细"),
                ]),
            ]
        ),
        error: nil
    )
}

struct DSHWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> DSHWidgetEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping (DSHWidgetEntry) -> Void) {
        if context.isPreview {
            completion(.sample)
            return
        }
        Task { completion(await Self.load()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DSHWidgetEntry>) -> Void) {
        Task {
            let entry = await Self.load()
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }

    private static func load() async -> DSHWidgetEntry {
        do {
            return DSHWidgetEntry(date: Date(), payload: try await BridgeClient.selectedPayload(), error: nil)
        } catch {
            return DSHWidgetEntry(date: Date(), payload: nil, error: error.localizedDescription)
        }
    }
}

struct DSHWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DSHWidgetEntry

    var body: some View {
        content
            .containerBackground(for: .widget) { background }
    }

    private var background: Color {
        if let hex = entry.payload?.style?.background, let color = Color(hex: hex) { return color }
        return Color(nsColor: .windowBackgroundColor)
    }

    @ViewBuilder
    private var content: some View {
        if let error = entry.error {
            ErrorWidgetView(error: error)
        } else if let payload = entry.payload {
            if payload.style?.layout == "single" {
                SingleWidgetView(payload: payload)
            } else {
                switch family {
                case .systemSmall: SmallWidgetView(payload: payload)
                case .systemMedium: MediumWidgetView(payload: payload)
                default: LargeWidgetView(payload: payload)
                }
            }
        } else {
            ErrorWidgetView(error: "暂无数据")
        }
    }
}

// MARK: - Widget

@main
struct DSHWidget: Widget {
    let kind = "DSHWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DSHWidgetProvider()) { entry in
            DSHWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("DSH 小组件")
        .description("显示你在 DSH 设置里选中的插件小组件。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
