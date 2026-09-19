//
//  Бонусная карта SBonus — экран приложения, работает без интернета.
//
//  Как это устроено. Сайт, открытый внутри приложения, после входа покупателя
//  отдаёт сюда его данные (BonusCard.save). Они ложатся в Keychain телефона.
//  Дальше карта открывается всегда: в метро, в лифте, в магазине без связи —
//  QR рисует сам телефон, сервер для этого не нужен.
//
//  На кассе важна яркость: пока карта на экране, приложение выкручивает её на
//  максимум и возвращает прежнюю, когда карта закрыта.
//

import Capacitor
import CoreImage.CIFilterBuiltins
import SwiftUI
import UIKit

// MARK: - Данные карты

struct BonusCardData: Codable, Equatable {
    /// Что зашито в QR. Это код клиента в SBonus вида «SB-XXXXXXXXXX».
    var qr: String
    var name: String
    var phone: String
    var balance: Double
    var tier: String
    /// Когда данные последний раз приходили с сервера (ISO 8601).
    var updatedAt: String
    /// Язык экрана: «ru» или «ky».
    var lang: String

    static let empty = BonusCardData(qr: "", name: "", phone: "", balance: 0, tier: "", updatedAt: "", lang: "ru")
}

// MARK: - Хранилище (Keychain)

/// Телефон и код клиента — личные данные, поэтому не UserDefaults, а Keychain.
enum BonusCardStore {
    private static let service = "kg.smarket.app.bonus-card"
    private static let account = "current"

    private static var query: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    static func save(_ card: BonusCardData) {
        guard let data = try? JSONEncoder().encode(card) else { return }
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        // Карта нужна и на заблокированном-разблокированном телефоне без пароля владельца,
        // но не должна уезжать в резервную копию на другой телефон.
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(item as CFDictionary, nil)
    }

    static func load() -> BonusCardData? {
        var item = query
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let card = try? JSONDecoder().decode(BonusCardData.self, from: data)
        else { return nil }
        return card
    }

    static func clear() {
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Надписи

private struct CardStrings {
    let title: String
    let subtitle: String
    let bonuses: String
    let asOf: String
    let close: String
    let emptyTitle: String
    let emptyText: String

    static func of(_ lang: String) -> CardStrings {
        lang.hasPrefix("ky")
            ? CardStrings(
                title: "Бонус картасы",
                subtitle: "Кассада көрсөтүңүз",
                bonuses: "Бонустар",
                asOf: "маалымат",
                close: "Жабуу",
                emptyTitle: "Карта әлі жок",
                emptyText: "Интернет бар кезде колдонмого кириңиз — карта ушул жерде сакталат.")
            : CardStrings(
                title: "Бонусная карта",
                subtitle: "Покажите на кассе",
                bonuses: "Бонусы",
                asOf: "данные на",
                close: "Закрыть",
                emptyTitle: "Карты пока нет",
                emptyText: "Войдите в приложение, пока есть интернет — карта сохранится здесь.")
    }
}

// MARK: - Экран карты

private enum Brand {
    static let ink = Color(red: 0x26 / 255, green: 0x32 / 255, blue: 0x44 / 255)
    static let lemon = Color(red: 0xEA / 255, green: 0xF5 / 255, blue: 0x00 / 255)
    static let muted = Color(red: 0xA8 / 255, green: 0xB4 / 255, blue: 0xC4 / 255)
}

struct BonusCardView: View {
    let card: BonusCardData?
    let onClose: () -> Void

    private var strings: CardStrings { CardStrings.of(card?.lang ?? "ru") }

    var body: some View {
        ZStack {
            Brand.ink.ignoresSafeArea()
            VStack(spacing: 0) {
                header
                Spacer(minLength: 12)
                if let card, !card.qr.isEmpty {
                    filled(card)
                } else {
                    empty
                }
                Spacer(minLength: 12)
                closeButton
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 12)
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(strings.title)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(.white)
                Text(strings.subtitle)
                    .font(.system(size: 14))
                    .foregroundStyle(Brand.muted)
            }
            Spacer()
        }
        .padding(.top, 16)
    }

    private func filled(_ card: BonusCardData) -> some View {
        VStack(spacing: 20) {
            VStack(spacing: 16) {
                qrImage(card.qr)
                    .frame(width: 236, height: 236)
                Text(card.qr)
                    .font(.system(size: 15, weight: .medium, design: .monospaced))
                    .foregroundStyle(Brand.ink)
                    .tracking(1)
            }
            .padding(24)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))

            VStack(spacing: 6) {
                if !card.name.isEmpty {
                    Text(card.name)
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Text(card.phone)
                    .font(.system(size: 15))
                    .foregroundStyle(Brand.muted)
            }

            VStack(spacing: 4) {
                Text("\(strings.bonuses): \(formatBonuses(card.balance))")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Brand.lemon)
                if let day = shortDate(card.updatedAt) {
                    Text("\(strings.asOf) \(day)")
                        .font(.system(size: 13))
                        .foregroundStyle(Brand.muted)
                }
            }
        }
    }

    private var empty: some View {
        VStack(spacing: 10) {
            Text(strings.emptyTitle)
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(.white)
            Text(strings.emptyText)
                .font(.system(size: 15))
                .foregroundStyle(Brand.muted)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 24)
    }

    private var closeButton: some View {
        Button(action: onClose) {
            Text(strings.close)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Brand.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Brand.lemon)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    /// QR рисует сам телефон (CoreImage), интернет и картинки с сервера не нужны.
    private func qrImage(_ value: String) -> Image {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(value.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage else { return Image(systemName: "qrcode") }
        let scale = 480 / output.extent.width
        let scaled = output.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let context = CIContext()
        guard let cgImage = context.createCGImage(scaled, from: scaled.extent) else {
            return Image(systemName: "qrcode")
        }
        return Image(decorative: cgImage, scale: 1)
            .interpolation(.none)
            .resizable()
    }

    private func formatBonuses(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        formatter.groupingSeparator = " "
        return formatter.string(from: NSNumber(value: value)) ?? "\(Int(value))"
    }

    private func shortDate(_ iso: String) -> String? {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return nil }
        let out = DateFormatter()
        out.dateFormat = "dd.MM.yyyy"
        return out.string(from: date)
    }
}

// MARK: - Мост в сайт

@objc(BonusCardPlugin)
public class BonusCardPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BonusCardPlugin"
    public let jsName = "BonusCard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
    ]

    private var previousBrightness: CGFloat?

    @objc func save(_ call: CAPPluginCall) {
        guard let qr = call.getString("qr"), !qr.isEmpty else {
            call.reject("qr обязателен")
            return
        }
        let card = BonusCardData(
            qr: qr,
            name: call.getString("name") ?? "",
            phone: call.getString("phone") ?? "",
            balance: call.getDouble("balance") ?? 0,
            tier: call.getString("tier") ?? "",
            updatedAt: call.getString("updatedAt") ?? ISO8601DateFormatter().string(from: Date()),
            lang: call.getString("lang") ?? "ru")
        BonusCardStore.save(card)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        BonusCardStore.clear()
        call.resolve()
    }

    @objc func state(_ call: CAPPluginCall) {
        let card = BonusCardStore.load()
        call.resolve([
            "saved": card != nil,
            "phone": card?.phone ?? "",
            "updatedAt": card?.updatedAt ?? "",
        ])
    }

    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self, let host = self.bridge?.viewController else {
                call.reject("нет экрана")
                return
            }
            let card = BonusCardStore.load()
            var controller: UIViewController?
            let view = BonusCardView(card: card) { [weak self] in
                self?.restoreBrightness(host)
                controller?.dismiss(animated: true)
            }
            let hosting = UIHostingController(rootView: view)
            hosting.modalPresentationStyle = .fullScreen
            controller = hosting
            self.raiseBrightness(host)
            host.present(hosting, animated: true) { call.resolve() }
        }
    }

    /// На кассе сканер читает экран легче, когда он ярче некуда.
    private func raiseBrightness(_ host: UIViewController) {
        guard let screen = host.view.window?.windowScene?.screen else { return }
        if previousBrightness == nil { previousBrightness = screen.brightness }
        screen.brightness = 1.0
    }

    private func restoreBrightness(_ host: UIViewController) {
        guard let screen = host.view.window?.windowScene?.screen, let previous = previousBrightness else { return }
        screen.brightness = previous
        previousBrightness = nil
    }
}

// MARK: - Регистрация

/// Свои плагины Capacitor сам не находит: их подключают здесь.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BonusCardPlugin())
        bridge?.registerPluginInstance(AppLockPlugin())
        bridge?.registerPluginInstance(OfflineCatalogPlugin())
    }
}
