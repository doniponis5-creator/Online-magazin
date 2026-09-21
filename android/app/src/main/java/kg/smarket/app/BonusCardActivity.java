package kg.smarket.app;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.util.EnumMap;
import java.util.Map;
import org.json.JSONObject;

/**
 * Экран бонусной карты. Открывается и без интернета.
 *
 * На кассе важна яркость: пока карта на экране, яркость на максимуме.
 * Закрыли карту — телефон сам возвращает прежнюю.
 */
public class BonusCardActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL;
        getWindow().setAttributes(params);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        JSONObject card = BonusCardPlugin.Store.load(this);
        String lang = card != null ? card.optString("lang", "ru") : "ru";
        boolean ky = Ui.kyrgyz(lang);

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Ui.INK);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(Ui.dp(this, 20), Ui.dp(this, 16), Ui.dp(this, 20), Ui.dp(this, 12));
        scroll.addView(root, new ScrollView.LayoutParams(-1, -1));
        Ui.keepClearOfSystemBars(scroll);

        root.addView(text(ky ? "Бонус картасы" : "Бонусная карта", 20, Color.WHITE, true));
        root.addView(text(ky ? "Кассада көрсөтүңүз" : "Покажите на кассе", 14, Ui.MUTED, false));
        root.addView(spacer());

        String qr = card != null ? card.optString("qr") : "";
        if (!qr.isEmpty()) {
            filled(root, card, ky);
        } else {
            empty(root, ky);
        }

        root.addView(spacer());
        Button close = new Button(this);
        close.setText(ky ? "Жабуу" : "Закрыть");
        close.setAllCaps(false);
        close.setTextSize(17);
        close.setTypeface(Typeface.DEFAULT_BOLD);
        close.setTextColor(Ui.INK);
        close.setStateListAnimator(null);
        close.setBackground(Ui.rounded(Ui.LEMON, Ui.dp(this, 14)));
        close.setOnClickListener(v -> finish());
        root.addView(close, new LinearLayout.LayoutParams(-1, Ui.dp(this, 54)));

        setContentView(scroll);
    }

    private void filled(LinearLayout root, JSONObject card, boolean ky) {
        String qr = card.optString("qr");

        LinearLayout plate = new LinearLayout(this);
        plate.setOrientation(LinearLayout.VERTICAL);
        plate.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = Ui.dp(this, 24);
        plate.setPadding(pad, pad, pad, pad);
        plate.setBackground(Ui.rounded(Color.WHITE, Ui.dp(this, 24)));

        ImageView image = new ImageView(this);
        image.setImageBitmap(qrBitmap(qr));
        image.setContentDescription(qr);
        plate.addView(image, new LinearLayout.LayoutParams(Ui.dp(this, 236), Ui.dp(this, 236)));

        TextView code = text(qr, 15, Ui.INK, false);
        code.setTypeface(Typeface.MONOSPACE);
        code.setLetterSpacing(0.08f);
        LinearLayout.LayoutParams codeParams = new LinearLayout.LayoutParams(-2, -2);
        codeParams.topMargin = Ui.dp(this, 16);
        plate.addView(code, codeParams);

        LinearLayout.LayoutParams plateParams = new LinearLayout.LayoutParams(-2, -2);
        plateParams.gravity = Gravity.CENTER_HORIZONTAL;
        root.addView(plate, plateParams);

        String name = card.optString("name");
        if (!name.isEmpty()) root.addView(centered(text(name, 19, Color.WHITE, true), 20));
        root.addView(centered(text(card.optString("phone"), 15, Ui.MUTED, false), 6));

        String bonuses = (ky ? "Бонустар" : "Бонусы") + ": " + Ui.number(card.optDouble("balance", 0));
        root.addView(centered(text(bonuses, 17, Ui.LEMON, true), 20));
        String day = Ui.day(card.optString("updatedAt"));
        if (!day.isEmpty()) {
            root.addView(centered(text((ky ? "маалымат " : "данные на ") + day, 13, Ui.MUTED, false), 4));
        }
    }

    private void empty(LinearLayout root, boolean ky) {
        root.addView(centered(text(ky ? "Карта азырынча жок" : "Карты пока нет", 19, Color.WHITE, true), 0));
        TextView hint = text(ky
                ? "Интернет бар кезде колдонмого кириңиз — карта ушул жерде сакталат."
                : "Войдите в приложение, пока есть интернет — карта сохранится здесь.",
            15, Ui.MUTED, false);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(Ui.dp(this, 24), 0, Ui.dp(this, 24), 0);
        root.addView(centered(hint, 10));
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private View centered(TextView view, int topDp) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-2, -2);
        params.gravity = Gravity.CENTER_HORIZONTAL;
        params.topMargin = Ui.dp(this, topDp);
        view.setLayoutParams(params);
        return view;
    }

    private View spacer() {
        View view = new View(this);
        view.setLayoutParams(new LinearLayout.LayoutParams(-1, 0, 1f));
        view.setMinimumHeight(Ui.dp(this, 12));
        return view;
    }

    /** QR рисует сам телефон — интернет и картинки с сервера не нужны. */
    private static Bitmap qrBitmap(String value) {
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 0);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            BitMatrix matrix = new QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, 480, 480, hints);
            int width = matrix.getWidth();
            int height = matrix.getHeight();
            int[] pixels = new int[width * height];
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    pixels[y * width + x] = matrix.get(x, y) ? Color.BLACK : Color.WHITE;
                }
            }
            return Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888);
        } catch (Exception e) {
            return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
        }
    }
}
