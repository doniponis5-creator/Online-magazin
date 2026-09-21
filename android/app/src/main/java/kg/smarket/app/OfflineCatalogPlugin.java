package kg.smarket.app;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/**
 * Каталог без интернета.
 *
 * Пока связь есть, сайт внутри приложения отдаёт сюда «снимок» каталога
 * (save): названия, цены, наличие, раздел. Снимок ложится файлом в память
 * приложения. Пропала связь — каталог всё равно открывается: поиск и разделы
 * работают, потому что считают по файлу.
 *
 * Заказать отсюда нельзя: для заказа нужен живой сервер. Экран честно говорит
 * об этом.
 */
@CapacitorPlugin(name = "OfflineCatalog")
public class OfflineCatalogPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String payload = call.getString("payload");
        if (payload == null || payload.isEmpty()) {
            call.reject("payload обязателен");
            return;
        }
        String updatedAt = call.getString("updatedAt", "");
        if (!Store.save(getContext(), payload, updatedAt)) {
            call.reject("снимок каталога не разобрался");
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void state(PluginCall call) {
        JSONObject snapshot = Store.load(getContext());
        JSObject result = new JSObject();
        result.put("saved", snapshot != null);
        result.put("version", snapshot != null ? snapshot.optString("version") : "");
        result.put("count", snapshot != null && snapshot.optJSONArray("items") != null
            ? snapshot.optJSONArray("items").length() : 0);
        result.put("updatedAt", Store.updatedAt(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void show(PluginCall call) {
        String lang = call.getString("lang", "ru");
        getActivity().runOnUiThread(() -> {
            Intent intent = new Intent(getContext(), OfflineCatalogActivity.class);
            intent.putExtra("lang", lang);
            getActivity().startActivity(intent);
            call.resolve();
        });
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Store.clear(getContext());
        call.resolve();
    }

    /**
     * Каталог — не секрет и весит сотни килобайт, поэтому обычный файл.
     * Папка no_backup: в резервную копию телефона снимок не попадает.
     */
    static final class Store {
        private static final String UPDATED_AT = "catalog-updated-at";

        private static File file(Context context) {
            File dir = new File(context.getNoBackupFilesDir(), "catalog");
            if (!dir.exists()) dir.mkdirs();
            return new File(dir, "snapshot.json");
        }

        /** Снимок приходит уже готовым JSON — проверяем, что он читается, и кладём как есть. */
        static boolean save(Context context, String payload, String updatedAt) {
            try {
                JSONObject parsed = new JSONObject(payload);
                if (parsed.optJSONArray("items") == null) return false;
                File target = file(context);
                File temp = new File(target.getPath() + ".tmp");
                try (FileOutputStream out = new FileOutputStream(temp)) {
                    out.write(payload.getBytes(StandardCharsets.UTF_8));
                }
                if (!temp.renameTo(target)) return false;
                Vault.prefs(context).edit().putString(UPDATED_AT, updatedAt).apply();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        static JSONObject load(Context context) {
            File source = file(context);
            if (!source.exists()) return null;
            try (FileInputStream in = new FileInputStream(source)) {
                byte[] data = new byte[(int) source.length()];
                int read = 0;
                while (read < data.length) {
                    int chunk = in.read(data, read, data.length - read);
                    if (chunk < 0) break;
                    read += chunk;
                }
                return new JSONObject(new String(data, 0, read, StandardCharsets.UTF_8));
            } catch (Exception e) {
                return null;
            }
        }

        static String updatedAt(Context context) {
            return Vault.prefs(context).getString(UPDATED_AT, "");
        }

        static void clear(Context context) {
            file(context).delete();
            Vault.prefs(context).edit().remove(UPDATED_AT).apply();
        }
    }
}
