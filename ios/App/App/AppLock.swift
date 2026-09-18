//
//  Вход по Face ID.
//
//  После обычного входа по коду сайт отдаёт приложению ключ. Приложение кладёт его
//  в Keychain телефона с замком: достать ключ можно, только приложив лицо (или палец,
//  или введя код телефона). Когда вход на сайте закончился, покупатель прикладывает
//  лицо — и снова внутри, без кода из Telegram.
//
//  Сам ключ приложение не читает и никуда не отправляет, кроме самого сайта.
//

import Capacitor
import Foundation
import LocalAuthentication

// MARK: - Хранилище ключа под Face ID

enum AppLockStore {
    private static let service = "kg.smarket.app.native-key"
    private static let account = "current"

    private static var base: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    static func save(_ key: String) -> Bool {
        SecItemDelete(base as CFDictionary)
        // .userPresence: сначала Face ID, а если лицо не узнали — код телефона.
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .userPresence,
            nil)
        else { return false }
        var item = base
        item[kSecValueData as String] = Data(key.utf8)
        item[kSecAttrAccessControl as String] = access
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    /// Есть ли сохранённый ключ. Проверяем только наличие — лицо для этого не нужно.
    static func exists() -> Bool {
        var item = base
        item[kSecReturnAttributes as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        return SecItemCopyMatching(item as CFDictionary, &result) == errSecSuccess
    }

    /// Достать ключ. Здесь телефон и спросит лицо.
    static func unlock(reason: String, done: @escaping (String?) -> Void) {
        let context = LAContext()
        context.localizedReason = reason
        DispatchQueue.global(qos: .userInitiated).async {
            var item = base
            item[kSecReturnData as String] = true
            item[kSecMatchLimit as String] = kSecMatchLimitOne
            item[kSecUseAuthenticationContext as String] = context
            var result: AnyObject?
            let status = SecItemCopyMatching(item as CFDictionary, &result)
            let key = status == errSecSuccess ? (result as? Data).flatMap { String(data: $0, encoding: .utf8) } : nil
            DispatchQueue.main.async { done(key) }
        }
    }

    static func clear() {
        SecItemDelete(base as CFDictionary)
    }
}

// MARK: - Мост в сайт

@objc(AppLockPlugin)
public class AppLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppLockPlugin"
    public let jsName = "AppLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlock", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearKey", returnType: CAPPluginReturnPromise),
    ]

    /// Что умеет телефон: Face ID, отпечаток или ничего.
    @objc func available(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let ok = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        var kind = "none"
        if ok {
            switch context.biometryType {
            case .faceID: kind = "face"
            case .touchID: kind = "touch"
            default: kind = "passcode"
            }
        }
        call.resolve(["available": ok, "kind": kind])
    }

    @objc func saveKey(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key обязателен")
            return
        }
        call.resolve(["ok": AppLockStore.save(key)])
    }

    @objc func hasKey(_ call: CAPPluginCall) {
        call.resolve(["saved": AppLockStore.exists()])
    }

    @objc func unlock(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "Вход в личный кабинет"
        AppLockStore.unlock(reason: reason) { key in
            if let key {
                call.resolve(["ok": true, "key": key])
            } else {
                // Отмена или неудачная проверка — не ошибка, просто «не пустили».
                call.resolve(["ok": false])
            }
        }
    }

    @objc func clearKey(_ call: CAPPluginCall) {
        AppLockStore.clear()
        call.resolve()
    }
}
