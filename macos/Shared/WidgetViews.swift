import SwiftUI
import WidgetKit


struct WidgetHeader: View {
    let payload: WidgetPayload

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(payload.title ?? "DSH 小组件")
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
                if let subtitle = payload.subtitle {
                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 0)
            if payload.style?.showUpdated != false, let updated = clockText(payload.updatedAt) {
                Text("更新于 \(updated)")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

struct SectionHeader: View {
    let section: WidgetPayload.Section
    var fallbackAccent: String?

    var body: some View {
        HStack(spacing: 6) {
            if let accent = (section.accent ?? fallbackAccent).flatMap(Color.init(hex:)) {
                Circle().fill(accent).frame(width: 6, height: 6)
            }
            Text(section.title)
                .font(.system(size: 11, weight: .semibold))
                .lineLimit(1)
            if let subtitle = section.subtitle {
                Text(subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }
}

struct MeterRow: View {
    let row: WidgetPayload.Row
    let showDetail: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(row.label)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text("\(Int(row.value.rounded()))\(row.unit ?? "%")")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .monospacedDigit()
            }
            MeterBar(value: row.value, max: row.max ?? 100, tint: severityColor(row.value))
            if showDetail, let detail = row.detail {
                Text(detail)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Family views

struct SmallWidgetView: View {
    let payload: WidgetPayload

    private var firstRow: (WidgetPayload.Section, WidgetPayload.Row)? {
        guard let section = payload.sections.first, let row = section.rows.first else { return nil }
        return (section, row)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(payload.title ?? "DSH 小组件")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            if let (section, row) = firstRow {
                VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 6) {
                    if let accent = section.accent.flatMap(Color.init(hex:)) {
                        Circle().fill(accent).frame(width: 6, height: 6)
                    }
                    Text(section.title)
                        .font(.system(size: 12, weight: .semibold))
                        .lineLimit(1)
                }
                Text(row.label)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text("\(Int(row.value.rounded()))")
                        .font(.system(size: 36, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                    Text(row.unit ?? "%")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 8)
                MeterBar(value: row.value, max: row.max ?? 100, tint: severityColor(row.value))
                    .padding(.top, 6)
                if let detail = row.detail {
                    Text(detail)
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .padding(.top, 4)
                }
                }
                .padding(.top, 10)
            } else {
                Text("暂无数据")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

struct SingleWidgetView: View {
    let payload: WidgetPayload

    private var tightest: (WidgetPayload.Section, WidgetPayload.Row)? {
        payload.sections
            .flatMap { section in section.rows.map { (section, $0) } }
            .max { $0.1.value < $1.1.value }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(payload.title ?? "DSH 小组件")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            Spacer(minLength: 10)
            if let (section, row) = tightest {
                HStack(spacing: 6) {
                    if let accent = (section.accent ?? payload.style?.accent).flatMap(Color.init(hex:)) {
                        Circle().fill(accent).frame(width: 6, height: 6)
                    }
                    Text(section.title)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)
                }
                Text(row.label)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
                Spacer(minLength: 8)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(Int(row.value.rounded()))")
                        .font(.system(size: 44, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                    Text(row.unit ?? "%")
                        .font(.system(size: 15, weight: .medium, design: .rounded))
                        .foregroundStyle(.secondary)
                }
                MeterBar(value: row.value, max: row.max ?? 100, tint: severityColor(row.value))
                    .padding(.top, 8)
                if let detail = row.detail {
                    Text(detail)
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .padding(.top, 4)
                }
            } else {
                Text("暂无数据")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

struct MediumWidgetView: View {
    let payload: WidgetPayload

    /// Flatten the first rows so a narrow widget shows the tightest windows
    /// instead of one provider's whole card.
    private var rows: [(WidgetPayload.Section, WidgetPayload.Row)] {
        payload.sections
            .flatMap { section in section.rows.map { (section, $0) } }
            .sorted { $0.1.value > $1.1.value }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            WidgetHeader(payload: payload)
            let visible = Array(rows.prefix(3))
            ForEach(Array(visible.enumerated()), id: \.offset) { _, item in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(item.0.title) · \(item.1.label)")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Text("\(Int(item.1.value.rounded()))\(item.1.unit ?? "%")")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .monospacedDigit()
                    }
                    MeterBar(value: item.1.value, max: item.1.max ?? 100, tint: severityColor(item.1.value))
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

struct LargeWidgetView: View {
    let payload: WidgetPayload

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            WidgetHeader(payload: payload)
            let sections = Array(payload.sections.prefix(2))
            let perSection = sections.count > 1 ? 2 : 3
            ForEach(Array(sections.enumerated()), id: \.offset) { index, section in
                if index > 0 { Divider().opacity(0.5) }
                VStack(alignment: .leading, spacing: 8) {
                    SectionHeader(section: section, fallbackAccent: payload.style?.accent)
                    ForEach(Array(section.rows.prefix(perSection))) { row in
                        MeterRow(row: row, showDetail: true)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(16)
    }
}

struct ErrorWidgetView: View {
    let error: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("DSH 小组件")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
            Text("无法读取小组件")
                .font(.system(size: 14, weight: .semibold))
            Text(error)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .lineLimit(3)
            Spacer(minLength: 0)
            Text("请确认 DSH 正在运行")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
        }
        .padding(16)
    }
}
