//
//  Каталог без интернета.
//
//  Как это устроено. Пока связь есть, сайт внутри приложения отдаёт сюда
//  «снимок» каталога (OfflineCatalog.save): названия, цены, наличие, раздел.
//  Снимок ложится файлом в память приложения. Пропала связь — каталог всё
//  равно открывается: поиск и разделы работают, потому что считают по файлу.
//
//  Заказать отсюда нельзя: для заказа нужен живой сервер. Экран честно
//  говорит об этом и предлагает открыть товар, когда связь вернётся.
//
//  Фотографии не скачиваем заранее: в каталоге магазина их сейчас нет.
//  Если фото появится, оно возьмётся из обычного кэша URLSession — то есть
//  покажется офлайн, если человек уже видел его онлайн.
//

import Capacitor
import SwiftUI
import UIKit

// MARK: - Данные снимка

/// Товар в снимке. Короткие имена полей — такими их отдаёт сайт: снимок едет
/// по мобильному интернету, и лишние буквы в нём платные.
struct CatalogItem: Codable, Identifiable, Equatable {
    let id: String
    /// Название по-русски
    let n: String
    /// Название по-кыргызски; нет — значит совпадает с русским
    let nk: String?
    /// Бренд
    let b: String?
    /// Раздел каталога
    let c: String
    /// Цена, сом. 0 — «цена по запросу»
    let p: Int
    /// Прежняя цена, если есть скидка
    let o: Int?
    /// 1 — есть в наличии
    let s: Int
    /// Адрес фотографии, если она есть
    let img: String?

    var inStock: Bool { s == 1 }

    func name(_ lang: String) -> String {
        lang.hasPrefix("ky") ? (nk ?? n) : n
    }
}

struct CatalogCategory: Codable, Identifiable, Equatable {
    let id: String
    let ru: String
    let ky: String

    func name(_ lang: String) -> String {
        lang.hasPrefix("ky") ? ky : ru
    }
}

struct CatalogSnapshot: Codable, Equatable {
    let version: String
    let count: Int
    let categories: [CatalogCategory]
    let items: [CatalogItem]
}

// MARK: - Хранилище (файл)

/// Каталог — не секрет и весит сотни килобайт, поэтому обычный файл, а не
/// Keychain. Папка Application Support: система её не чистит сама и не
/// показывает пользователю в «Файлах».
enum CatalogStore {
    private static var folder: URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        else { return nil }
        let dir = base.appendingPathComponent("catalog", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    private static var file: URL? { folder?.appendingPathComponent("snapshot.json") }
    private static let updatedAtKey = "kg.smarket.app.catalog.updatedAt"

    /// Снимок приходит от сайта уже готовым JSON — просто кладём его как есть.
    static func save(payload: Data, updatedAt: String) -> Bool {
        guard let file, (try? JSONDecoder().decode(CatalogSnapshot.self, from: payload)) != nil
        else { return false }
        do {
            try payload.write(to: file, options: .atomic)
            // Снимок не личные данные, но и в чужую резервную копию ему незачем.
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var mutable = file
            try? mutable.setResourceValues(values)
            UserDefaults.standard.set(updatedAt, forKey: updatedAtKey)
            return true
        } catch {
            return false
        }
    }

    static func load() -> CatalogSnapshot? {
        guard let file, let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(CatalogSnapshot.self, from: data)
    }

    static var updatedAt: String {
        UserDefaults.standard.string(forKey: updatedAtKey) ?? ""
    }

    static func clear() {
        if let file { try? FileManager.default.removeItem(at: file) }
        UserDefaults.standard.removeObject(forKey: updatedAtKey)
    }
}

// MARK: - Надписи

private struct CatalogStrings {
    let title: String
    let subtitle: String
    let search: String
    let all: String
    let close: String
    let outOfStock: String
    let onRequest: String
    let nothing: String
    let emptyTitle: String
    let emptyText: String
    let offlineNote: String
    let asOf: String
    let som: String

    static func of(_ lang: String) -> CatalogStrings {
        lang.hasPrefix("ky")
            ? CatalogStrings(
                title: "Каталог",
                subtitle: "Интернетсиз көрүнөт",
                search: "Товарды издөө",
                all: "Баары",
                close: "Жабуу",
                outOfStock: "Жок",
                onRequest: "Баасын сураңыз",
                nothing: "Эч нерсе табылган жок",
                emptyTitle: "Каталог әлі жок",
                emptyText: "Интернет бар кезде колдонмону ачыңыз — каталог ушул жерде сакталат.",
                offlineNote: "Бул сакталган тизме. Буйрутма берүү үчүн интернет керек.",
                asOf: "маалымат",
                som: "сом")
            : CatalogStrings(
                title: "Каталог",
                subtitle: "Виден без интернета",
                search: "Поиск товара",
                all: "Все",
                close: "Закрыть",
                outOfStock: "Нет в наличии",
                onRequest: "Цена по запросу",
                nothing: "Ничего не найдено",
                emptyTitle: "Каталога пока нет",
                emptyText: "Откройте приложение, пока есть интернет — каталог сохранится здесь.",
                offlineNote: "Это сохранённый список. Чтобы заказать, нужен интернет.",
                asOf: "данные на",
                som: "сом")
    }
}

private enum CatalogBrand {
    static let ink = Color(red: 0x26 / 255, green: 0x32 / 255, blue: 0x44 / 255)
    static let lemon = Color(red: 0xEA / 255, green: 0xF5 / 255, blue: 0x00 / 255)
    static let muted = Color(red: 0xA8 / 255, green: 0xB4 / 255, blue: 0xC4 / 255)
    static let surface = Color(red: 0xF7 / 255, green: 0xF9 / 255, blue: 0xFC / 255)
}

/// «24900» → «24 900». Неразрывный пробел, чтобы цена не переносилась.
private func formatSom(_ value: Int) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .decimal
    formatter.groupingSeparator = "\u{00A0}"
    return formatter.string(from: NSNumber(value: value)) ?? String(value)
}

/// «2026-09-19T14:30:00Z» → «19.09.2026»
private func formatDay(_ iso: String) -> String {
    let parser = ISO8601DateFormatter()
    parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    guard let date else { return "" }
    let out = DateFormatter()
    out.dateFormat = "dd.MM.yyyy"
    return out.string(from: date)
}

// MARK: - Экран каталога

struct OfflineCatalogView: View {
    let snapshot: CatalogSnapshot?
    let updatedAt: String
    let lang: String
    let onClose: () -> Void

    @State private var query = ""
    @State private var category: String? = nil

    private var strings: CatalogStrings { CatalogStrings.of(lang) }

    /// Отбор идёт по снимку в памяти: сервер для этого не нужен.
    private var shown: [CatalogItem] {
        guard let items = snapshot?.items else { return [] }
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        return items.filter { item in
            if let category, item.c != category { return false }
            if needle.isEmpty { return true }
            return item.name(lang).lowercased().contains(needle)
                || (item.b ?? "").lowercased().contains(needle)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if snapshot == nil {
                    empty
                } else {
                    list
                }
            }
            .navigationTitle(strings.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(strings.close, action: onClose)
                        .fontWeight(.semibold)
                }
            }
        }
    }

    private var empty: some View {
        VStack(spacing: 12) {
            Text("📦").font(.system(size: 44))
            Text(strings.emptyTitle).font(.headline)
            Text(strings.emptyText)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    private var list: some View {
        VStack(spacing: 0) {
            note
            categoryStrip
            if shown.isEmpty {
                Spacer()
                Text(strings.nothing).foregroundStyle(.secondary)
                Spacer()
            } else {
                List(shown) { item in
                    row(item)
                }
                .listStyle(.plain)
            }
        }
        .searchable(text: $query, prompt: strings.search)
    }

    private var note: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(strings.offlineNote)
                .font(.footnote)
            if !updatedAt.isEmpty, !formatDay(updatedAt).isEmpty {
                Text("\(strings.asOf) \(formatDay(updatedAt))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(CatalogBrand.surface)
    }

    private var categoryStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                chip(title: strings.all, active: category == nil) { category = nil }
                ForEach(snapshot?.categories ?? []) { cat in
                    chip(title: cat.name(lang), active: category == cat.id) { category = cat.id }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
    }

    private func chip(title: String, active: Bool, tap: @escaping () -> Void) -> some View {
        Button(action: tap) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(active ? CatalogBrand.lemon : CatalogBrand.surface)
                .foregroundStyle(CatalogBrand.ink)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func row(_ item: CatalogItem) -> some View {
        HStack(alignment: .top, spacing: 12) {
            thumbnail(item)
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name(lang))
                    .font(.subheadline)
                    .lineLimit(3)
                if let brand = item.b, !brand.isEmpty {
                    Text(brand)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    if item.p > 0 {
                        Text("\(formatSom(item.p)) \(strings.som)")
                            .font(.subheadline.weight(.bold))
                        if let old = item.o, old > item.p {
                            Text("\(formatSom(old))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .strikethrough()
                        }
                    } else {
                        Text(strings.onRequest)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                if !item.inStock {
                    Text(strings.outOfStock)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
    }

    /// Фото берём из обычного кэша: было видно онлайн — будет видно и офлайн.
    /// Нет фото или нет кэша — рисуем спокойную заглушку, а не пустоту.
    private func thumbnail(_ item: CatalogItem) -> some View {
        Group {
            if let raw = item.img, let url = URL(string: raw) {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFit()
                    } else {
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: 64, height: 64)
        .background(CatalogBrand.surface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var placeholder: some View {
        Image(systemName: "shippingbox")
            .font(.system(size: 24))
            .foregroundStyle(CatalogBrand.muted)
    }
}

// MARK: - Плагин Capacitor

@objc(OfflineCatalogPlugin)
public class OfflineCatalogPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OfflineCatalogPlugin"
    public let jsName = "OfflineCatalog"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let payload = call.getString("payload"), let data = payload.data(using: .utf8) else {
            call.reject("payload обязателен")
            return
        }
        let updatedAt = call.getString("updatedAt") ?? ISO8601DateFormatter().string(from: Date())
        guard CatalogStore.save(payload: data, updatedAt: updatedAt) else {
            call.reject("снимок каталога не разобрался")
            return
        }
        call.resolve()
    }

    @objc func state(_ call: CAPPluginCall) {
        let snapshot = CatalogStore.load()
        call.resolve([
            "saved": snapshot != nil,
            "version": snapshot?.version ?? "",
            "count": snapshot?.items.count ?? 0,
            "updatedAt": CatalogStore.updatedAt,
        ])
    }

    @objc func show(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? "ru"
        DispatchQueue.main.async { [weak self] in
            guard let self, let host = self.bridge?.viewController else {
                call.reject("нет экрана")
                return
            }
            let snapshot = CatalogStore.load()
            var controller: UIViewController?
            let view = OfflineCatalogView(
                snapshot: snapshot,
                updatedAt: CatalogStore.updatedAt,
                lang: lang) {
                    controller?.dismiss(animated: true)
                }
            let hosting = UIHostingController(rootView: view)
            hosting.modalPresentationStyle = .fullScreen
            controller = hosting
            host.present(hosting, animated: true) { call.resolve() }
        }
    }

    @objc func clear(_ call: CAPPluginCall) {
        CatalogStore.clear()
        call.resolve()
    }
}
