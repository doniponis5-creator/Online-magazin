package kg.smarket.app;

import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Общие мелочи для своих экранов приложения: цвета, отступы, форматы. */
final class Ui {
    static final int INK = 0xFF263244;
    static final int LEMON = 0xFFEAF500;
    static final int MUTED = 0xFFA8B4C4;
    static final int SURFACE = 0xFFF7F9FC;
    static final int SECONDARY = 0xFF6B7788;

    private Ui() {}

    static int dp(Context context, float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    static GradientDrawable rounded(int color, float radiusPx) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(radiusPx);
        return shape;
    }

    /**
     * Android 15 рисует экран под часами и под полоской жестов. Добавляем
     * отступ ровно на их высоту, чтобы кнопки не прятались под ними.
     */
    static void keepClearOfSystemBars(View view) {
        int left = view.getPaddingLeft();
        int top = view.getPaddingTop();
        int right = view.getPaddingRight();
        int bottom = view.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(view, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            v.setPadding(left + bars.left, top + bars.top, right + bars.right, bottom + bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }

    /** «24900» → «24 900». Неразрывный пробел, чтобы число не переносилось. */
    static String number(double value) {
        DecimalFormatSymbols symbols = new DecimalFormatSymbols(Locale.US);
        symbols.setGroupingSeparator(' ');
        return new DecimalFormat("#,##0", symbols).format(Math.round(value));
    }

    /** «2026-09-19T14:30:00Z» → «19.09.2026». Не разобрали — пустая строка. */
    static String day(String iso) {
        if (iso == null || iso.isEmpty()) return "";
        String[] patterns = {"yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX"};
        for (String pattern : patterns) {
            try {
                SimpleDateFormat parser = new SimpleDateFormat(pattern, Locale.US);
                parser.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = parser.parse(iso);
                if (date != null) return new SimpleDateFormat("dd.MM.yyyy", Locale.US).format(date);
            } catch (Exception ignored) {
                // пробуем следующий вид записи
            }
        }
        return "";
    }

    static boolean kyrgyz(String lang) {
        return lang != null && lang.startsWith("ky");
    }
}
