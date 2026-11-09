import SwiftUI

struct ContentView: View {
    @State private var widgets: [WidgetItem] = []
    @State private var selectedId: String?
    @State private var payloads: [String: WidgetPayload] = [:]
    @State private var error: String?
    @State private var loading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("DSH 小组件")
                .font(.title2.bold())
            Text("其他 DSH 插件通过 macosWidgets 服务注册小组件；这里显示已注册的内容。桌面右键 → 编辑小组件 → 搜索「DSH 小组件」。")
                .font(.callout)
                .foregroundStyle(.secondary)
            Divider()
            if loading {
                ProgressView()
            } else if let error {
                Text(error).foregroundStyle(.red).font(.callout)
            } else if widgets.isEmpty {
                Text("没有注册的小组件。确认 macos-widget 插件已启用。")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(widgets) { widget in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(widget.title).font(.headline)
                                    if let subtitle = widget.subtitle {
                                        Text(subtitle).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if widget.id == selectedId {
                                        Text("当前显示").font(.caption).foregroundStyle(.tint)
                                    }
                                }
                                if let payload = payloads[widget.id] {
                                    ForEach(payload.sections.prefix(3)) { section in
                                        Text(section.title).font(.caption).foregroundStyle(.secondary)
                                        ForEach(section.rows.prefix(3)) { row in
                                            HStack {
                                                Text(row.label).font(.callout)
                                                Spacer()
                                                Text("\(Int(row.value.rounded()))\(row.unit ?? "%")").monospacedDigit()
                                                if let detail = row.detail {
                                                    Text(detail).font(.caption).foregroundStyle(.tertiary)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Spacer(minLength: 0)
            HStack {
                Button("刷新") { Task { await load() } }
                Spacer()
                Text("DSH 需保持运行").font(.caption).foregroundStyle(.tertiary)
            }
        }
        .padding(20)
        .frame(minWidth: 480, minHeight: 380)
        .task { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let directory = try await BridgeClient.directory()
            widgets = directory.widgets
            selectedId = directory.selectedId
            var next: [String: WidgetPayload] = [:]
            for widget in widgets {
                if let payload = try? await BridgeClient.payload(id: widget.id) {
                    next[widget.id] = payload
                }
            }
            payloads = next
            error = nil
        } catch {
            self.error = "读取失败：\(error.localizedDescription)（请确认 DSH 正在运行）"
            widgets = []
        }
    }
}
