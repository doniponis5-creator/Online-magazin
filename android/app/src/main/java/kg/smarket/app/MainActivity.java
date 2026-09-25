package kg.smarket.app;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSExport;
import com.getcapacitor.Logger;
import com.getcapacitor.PluginHandle;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class MainActivity extends BridgeActivity {

    // Плагины, которыми пользуется страница «Нет связи» (ios-web/index.html).
    private static final String[] OFFLINE_PAGE_PLUGINS = { "BonusCard", "OfflineCatalog" };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Свои плагины Capacitor сам не находит: их подключают до super.onCreate.
        registerPlugin(BonusCardPlugin.class);
        registerPlugin(AppLockPlugin.class);
        registerPlugin(OfflineCatalogPlugin.class);
        super.onCreate(savedInstanceState);
        connectOfflinePage();

        // Кнопка и жест «назад» листают страницы сайта, как в браузере.
        // Возвращаться некуда — сворачиваем приложение, а не закрываем его.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = getBridge() != null ? getBridge().getWebView() : null;
                if (web != null && web.canGoBack()) {
                    web.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    // Страница «Нет связи» открывается с https://localhost, а Capacitor вставляет
    // свой JS (window.Capacitor и плагины) только в страницы адреса server.url —
    // https://smarket.kg. Без него страница не видит плагины, и кнопки «Бонусная
    // карта» и «Каталог» не появляются. На iPhone JS попадает во все страницы,
    // там это и так работает. Здесь даём странице тот же мост и два её плагина.
    private void connectOfflinePage() {
        Bridge bridge = getBridge();
        // Старый WebView без DOCUMENT_START_SCRIPT: тогда Capacitor сам вставляет
        // JS в каждую страницу из приложения, включая эту.
        if (bridge == null || !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        String errorUrl = bridge.getErrorUrl();
        if (errorUrl == null) return;
        Uri page = Uri.parse(errorUrl);
        String origin = page.getScheme() + "://" + page.getAuthority();

        List<PluginHandle> plugins = new ArrayList<>();
        for (String id : OFFLINE_PAGE_PLUGINS) {
            PluginHandle handle = bridge.getPlugin(id);
            if (handle != null) plugins.add(handle);
        }
        try {
            // Тот же порядок, что у Capacitor: глобальный объект, адрес, мост, плагины.
            String js =
                JSExport.getGlobalJS(this, bridge.getConfig().isLoggingEnabled(), bridge.isDevMode()) +
                "\n\nwindow.WEBVIEW_SERVER_URL = '" + bridge.getLocalUrl() + "';" +
                "\n\n" + JSExport.getBridgeJS(this) +
                "\n\n" + JSExport.getPluginJS(plugins);
            WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), js, Collections.singleton(origin));
        } catch (Exception e) {
            Logger.error("Offline page: Capacitor JS not added", e);
        }
    }
}
