package kg.smarket.app;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.MGF1ParameterSpec;
import java.security.spec.X509EncodedKeySpec;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import javax.crypto.spec.SecretKeySpec;

/**
 * Вход по отпечатку пальца — то же, что Face ID на iPhone.
 *
 * После обычного входа по коду сайт отдаёт приложению ключ. Приложение прячет
 * его так, что открыть можно только после отпечатка (или кода телефона). Когда
 * вход на сайте закончился, покупатель прикладывает палец — и снова внутри,
 * без кода из Telegram.
 *
 * Как спрятано. В защищённом чипе телефона лежит пара ключей: «замок» и «ключ
 * от замка». Закрыть замок можно без проверки — поэтому сохранение проходит
 * молча, как на iPhone. Открыть — только в течение 30 секунд после отпечатка.
 *
 * Сам ключ приложение никуда не отправляет, кроме самого сайта.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "kg.smarket.app.native-key";
    private static final String PREF_KEY = "native-key";
    private static final String PREF_WRAP = "native-key-wrap";
    private static final OAEPParameterSpec OAEP = new OAEPParameterSpec(
        "SHA-256", "MGF1", MGF1ParameterSpec.SHA1, PSource.PSpecified.DEFAULT);

    /** Чем телефон разрешает подтвердить вход: отпечаток или код телефона. */
    private static int authenticators() {
        if (Build.VERSION.SDK_INT >= 30) {
            return BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        }
        // Android 9–10 не умеет «сильный отпечаток или код» вместе — берём так.
        return BiometricManager.Authenticators.BIOMETRIC_WEAK
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
    }

    /**
     * Что умеет телефон. Отвечаем 'touch' («войти по отпечатку»), только если
     * отпечаток или лицо записаны в телефоне. Если есть лишь код телефона,
     * кнопку не показываем: надпись про отпечаток была бы неправдой.
     */
    @PluginMethod
    public void available(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        boolean biometric = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                == BiometricManager.BIOMETRIC_SUCCESS
            || manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                == BiometricManager.BIOMETRIC_SUCCESS;
        JSObject result = new JSObject();
        result.put("available", biometric);
        result.put("kind", biometric ? "touch" : "none");
        call.resolve(result);
    }

    @PluginMethod
    public void saveKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.isEmpty()) {
            call.reject("key обязателен");
            return;
        }
        JSObject result = new JSObject();
        try {
            // Каждый раз новая пара: старая могла стать негодной, если сменили отпечатки.
            Vault.dropKey(ALIAS);
            PublicKey lock = newLock();
            // Сам ключ шифруем разовым ключом, а разовый — «замком».
            // Так длина ключа от сайта ничем не ограничена.
            KeyGenerator aes = KeyGenerator.getInstance("AES");
            aes.init(256);
            SecretKey once = aes.generateKey();
            Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            rsa.init(Cipher.ENCRYPT_MODE, lock, OAEP);
            String wrapped = Base64.encodeToString(rsa.doFinal(once.getEncoded()), Base64.NO_WRAP);
            Vault.prefs(getContext()).edit()
                .putString(PREF_KEY, Vault.encrypt(once, key))
                .putString(PREF_WRAP, wrapped)
                .apply();
            result.put("ok", true);
        } catch (Exception e) {
            // Например, на телефоне нет ни кода, ни отпечатка — прятать не во что.
            result.put("ok", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void hasKey(PluginCall call) {
        JSObject result = new JSObject();
        result.put("saved", Vault.prefs(getContext()).contains(PREF_KEY));
        call.resolve(result);
    }

    @PluginMethod
    public void unlock(PluginCall call) {
        String sealed = Vault.prefs(getContext()).getString(PREF_KEY, null);
        String wrapped = Vault.prefs(getContext()).getString(PREF_WRAP, null);
        if (sealed == null || wrapped == null) {
            refuse(call);
            return;
        }
        String reason = call.getString("reason", "Вход в личный кабинет");
        getActivity().runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(
                getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult done) {
                        open(call, sealed, wrapped);
                    }

                    @Override
                    public void onAuthenticationError(int code, @NonNull CharSequence message) {
                        refuse(call);
                    }
                    // onAuthenticationFailed — палец не узнан, окно остаётся открытым
                    // и само даёт попробовать ещё раз. Отвечать сайту рано.
                });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(reason)
                .setAllowedAuthenticators(authenticators())
                .build();
            try {
                prompt.authenticate(info);
            } catch (Exception e) {
                refuse(call);
            }
        });
    }

    @PluginMethod
    public void clearKey(PluginCall call) {
        clear();
        call.resolve();
    }

    /** Палец приложили — открываем замок и отдаём ключ сайту. */
    private void open(PluginCall call, String sealed, String wrapped) {
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            PrivateKey unlock = (PrivateKey) store.getKey(ALIAS, null);
            Cipher rsa = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            rsa.init(Cipher.DECRYPT_MODE, unlock, OAEP);
            byte[] once = rsa.doFinal(Base64.decode(wrapped, Base64.NO_WRAP));
            String key = Vault.decrypt(new SecretKeySpec(once, "AES"), sealed);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("key", key);
            call.resolve(result);
        } catch (KeyPermanentlyInvalidatedException e) {
            // В телефоне поменяли отпечатки — старый замок больше не откроется.
            clear();
            refuse(call);
        } catch (Exception e) {
            refuse(call);
        }
    }

    /** Новая пара ключей в защищённом чипе. Возвращает «замок» — им можно только закрыть. */
    private static PublicKey newLock() throws Exception {
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(2048)
            .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA1)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_RSA_OAEP)
            .setUserAuthenticationRequired(true);
        if (Build.VERSION.SDK_INT >= 30) {
            spec.setUserAuthenticationParameters(30,
                KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
        } else {
            spec.setUserAuthenticationValidityDurationSeconds(30);
        }
        KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, KEYSTORE);
        generator.initialize(spec.build());
        PublicKey lock = generator.generateKeyPair().getPublic();
        // Копия «замка» вне чипа: чип не даёт закрывать своим экземпляром без проверки.
        return KeyFactory.getInstance(lock.getAlgorithm())
            .generatePublic(new X509EncodedKeySpec(lock.getEncoded()));
    }

    private void clear() {
        Vault.prefs(getContext()).edit().remove(PREF_KEY).remove(PREF_WRAP).apply();
        Vault.dropKey(ALIAS);
    }

    /** Отмена или неудачная проверка — не ошибка, просто «не пустили». */
    private static void refuse(PluginCall call) {
        JSObject result = new JSObject();
        result.put("ok", false);
        call.resolve(result);
    }
}
