package kg.smarket.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Шифрованное хранилище приложения — замена Keychain с iPhone.
 *
 * Сам ключ шифрования лежит в защищённом чипе телефона (Android Keystore) и
 * наружу не выходит. В обычных настройках приложения хранится только
 * зашифрованный текст: без этого телефона его не прочитать.
 */
final class Vault {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String PREFS = "kg.smarket.app.vault";
    private static final int TAG_BITS = 128;

    private Vault() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Ключ шифрования по имени. Создаётся при первом обращении. */
    static SecretKey key(String alias) throws Exception {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        store.load(null);
        if (store.containsAlias(alias)) {
            return ((KeyStore.SecretKeyEntry) store.getEntry(alias, null)).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
                alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return generator.generateKey();
    }

    static void dropKey(String alias) {
        try {
            KeyStore store = KeyStore.getInstance(KEYSTORE);
            store.load(null);
            store.deleteEntry(alias);
        } catch (Exception ignored) {
            // Ключа и так нет — ничего страшного.
        }
    }

    static String encrypt(SecretKey key, String plain) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] iv = cipher.getIV();
        byte[] body = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(body, Base64.NO_WRAP);
    }

    static String decrypt(SecretKey key, String sealed) throws Exception {
        String[] parts = sealed.split(":", 2);
        if (parts.length != 2) throw new IllegalArgumentException("испорченная запись");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key,
            new GCMParameterSpec(TAG_BITS, Base64.decode(parts[0], Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
}
