package kg.smarket.app;

import android.content.Context;
import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/**
 * Бонусная карта SBonus — работает без интернета.
 *
 * Сайт, открытый внутри приложения, после входа покупателя отдаёт сюда его
 * данные (save). Они ложатся в память телефона в зашифрованном виде. Дальше
 * карта открывается всегда: в метро, в лифте, в магазине без связи — QR рисует
 * сам телефон, сервер для этого не нужен.
 */
@CapacitorPlugin(name = "BonusCard")
public class BonusCardPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String qr = call.getString("qr");
        if (qr == null || qr.isEmpty()) {
            call.reject("qr обязателен");
            return;
        }
        try {
            JSONObject card = new JSONObject();
            card.put("qr", qr);
            card.put("name", call.getString("name", ""));
            card.put("phone", call.getString("phone", ""));
            card.put("balance", call.getDouble("balance", 0.0));
            card.put("tier", call.getString("tier", ""));
            card.put("updatedAt", call.getString("updatedAt", nowIso()));
            card.put("lang", call.getString("lang", "ru"));
            Store.save(getContext(), card);
            call.resolve();
        } catch (Exception e) {
            call.reject("карта не сохранилась");
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Store.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void state(PluginCall call) {
        JSONObject card = Store.load(getContext());
        JSObject result = new JSObject();
        result.put("saved", card != null);
        result.put("phone", card != null ? card.optString("phone") : "");
        result.put("updatedAt", card != null ? card.optString("updatedAt") : "");
        call.resolve(result);
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            getActivity().startActivity(new Intent(getContext(), BonusCardActivity.class));
            call.resolve();
        });
    }

    private static String nowIso() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    /** Телефон и код клиента — личные данные, поэтому храним зашифрованными. */
    static final class Store {
        private static final String ALIAS = "kg.smarket.app.bonus-card";
        private static final String PREF = "bonus-card";

        static void save(Context context, JSONObject card) throws Exception {
            String sealed = Vault.encrypt(Vault.key(ALIAS), card.toString());
            Vault.prefs(context).edit().putString(PREF, sealed).apply();
        }

        static JSONObject load(Context context) {
            String sealed = Vault.prefs(context).getString(PREF, null);
            if (sealed == null) return null;
            try {
                return new JSONObject(Vault.decrypt(Vault.key(ALIAS), sealed));
            } catch (Exception e) {
                return null;
            }
        }

        static void clear(Context context) {
            Vault.prefs(context).edit().remove(PREF).apply();
        }
    }
}
