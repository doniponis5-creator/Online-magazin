package kg.smarket.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Свои плагины Capacitor сам не находит: их подключают до super.onCreate.
        registerPlugin(BonusCardPlugin.class);
        registerPlugin(AppLockPlugin.class);
        registerPlugin(OfflineCatalogPlugin.class);
        super.onCreate(savedInstanceState);

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
}
