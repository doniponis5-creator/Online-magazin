package kg.smarket.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Экран «каталог без интернета». Поиск и разделы считаются по снимку в памяти.
 *
 * Фото: если товар уже открывали здесь со связью, картинка лежит в кэше
 * и видна офлайн. Нет фото или нет кэша — спокойная заглушка, а не пустота.
 */
public class OfflineCatalogActivity extends AppCompatActivity {

    /** Товар в снимке. Короткие имена полей — такими их отдаёт сайт. */
    static final class Item {
        String name;
        String brand;
        String category;
        int price;
        int oldPrice;
        boolean inStock;
        String image;
    }

    private final List<Item> all = new ArrayList<>();
    private final List<Item> shown = new ArrayList<>();
    private final List<TextView> chips = new ArrayList<>();
    private String category;
    private String query = "";
    private boolean ky;
    private Adapter adapter;
    private TextView nothing;

    private final ExecutorService loader = Executors.newFixedThreadPool(3);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final LruCache<String, Bitmap> memory = new LruCache<>(40);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ky = Ui.kyrgyz(getIntent().getStringExtra("lang"));

        JSONObject snapshot = OfflineCatalogPlugin.Store.load(this);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFFFFFFFF);
        Ui.keepClearOfSystemBars(root);
        root.addView(topBar());

        if (snapshot == null) {
            root.addView(empty(), new LinearLayout.LayoutParams(-1, 0, 1f));
        } else {
            read(snapshot);
            root.addView(note());
            root.addView(search());
            root.addView(categories(snapshot.optJSONArray("categories")));

            ListView list = new ListView(this);
            list.setDivider(null);
            adapter = new Adapter();
            list.setAdapter(adapter);
            root.addView(list, new LinearLayout.LayoutParams(-1, 0, 1f));

            nothing = label(ky ? "Эч нерсе табылган жок" : "Ничего не найдено", 15, Ui.SECONDARY, false);
            nothing.setGravity(Gravity.CENTER);
            nothing.setVisibility(View.GONE);
            root.addView(nothing, new LinearLayout.LayoutParams(-1, 0, 1f));
            filter();
        }
        setContentView(root);
    }

    @Override
    protected void onDestroy() {
        loader.shutdownNow();
        super.onDestroy();
    }

    private void read(JSONObject snapshot) {
        JSONArray items = snapshot.optJSONArray("items");
        if (items == null) return;
        for (int i = 0; i < items.length(); i++) {
            JSONObject raw = items.optJSONObject(i);
            if (raw == null) continue;
            Item item = new Item();
            String nk = raw.optString("nk", "");
            item.name = ky && !nk.isEmpty() ? nk : raw.optString("n");
            item.brand = raw.optString("b", "");
            item.category = raw.optString("c");
            item.price = raw.optInt("p", 0);
            item.oldPrice = raw.optInt("o", 0);
            item.inStock = raw.optInt("s", 0) == 1;
            item.image = raw.optString("img", "");
            all.add(item);
        }
    }

    /** Отбор идёт по снимку в памяти: сервер для этого не нужен. */
    private void filter() {
        String needle = query.trim().toLowerCase(Locale.ROOT);
        shown.clear();
        for (Item item : all) {
            if (category != null && !category.equals(item.category)) continue;
            if (!needle.isEmpty()
                && !item.name.toLowerCase(Locale.ROOT).contains(needle)
                && !item.brand.toLowerCase(Locale.ROOT).contains(needle)) continue;
            shown.add(item);
        }
        adapter.notifyDataSetChanged();
        nothing.setVisibility(shown.isEmpty() ? View.VISIBLE : View.GONE);
    }

    // ---- Части экрана ----

    private View topBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        int pad = Ui.dp(this, 16);
        bar.setPadding(pad, Ui.dp(this, 10), Ui.dp(this, 8), Ui.dp(this, 10));
        TextView title = label("Каталог", 18, Ui.INK, true);
        bar.addView(title, new LinearLayout.LayoutParams(0, -2, 1f));
        TextView close = label(ky ? "Жабуу" : "Закрыть", 16, Ui.INK, true);
        close.setPadding(pad, Ui.dp(this, 8), pad, Ui.dp(this, 8));
        close.setOnClickListener(v -> finish());
        bar.addView(close);
        return bar;
    }

    private View note() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(Ui.SURFACE);
        int pad = Ui.dp(this, 16);
        box.setPadding(pad, Ui.dp(this, 10), pad, Ui.dp(this, 10));
        box.addView(label(ky
            ? "Бул сакталган тизме. Буйрутма берүү үчүн интернет керек."
            : "Это сохранённый список. Чтобы заказать, нужен интернет.", 13, Ui.INK, false));
        String day = Ui.day(OfflineCatalogPlugin.Store.updatedAt(this));
        if (!day.isEmpty()) {
            box.addView(label((ky ? "маалымат " : "данные на ") + day, 11, Ui.SECONDARY, false));
        }
        return box;
    }

    private View search() {
        EditText field = new EditText(this);
        field.setHint(ky ? "Товарды издөө" : "Поиск товара");
        field.setSingleLine(true);
        field.setTextSize(16);
        int pad = Ui.dp(this, 12);
        field.setPadding(pad, pad, pad, pad);
        field.setBackground(Ui.rounded(Ui.SURFACE, Ui.dp(this, 12)));
        field.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) {
                query = s.toString();
                filter();
            }
        });
        LinearLayout wrap = new LinearLayout(this);
        wrap.setPadding(Ui.dp(this, 16), Ui.dp(this, 10), Ui.dp(this, 16), 0);
        wrap.addView(field, new LinearLayout.LayoutParams(-1, -2));
        return wrap;
    }

    private View categories(JSONArray list) {
        HorizontalScrollView scroll = new HorizontalScrollView(this);
        scroll.setHorizontalScrollBarEnabled(false);
        LinearLayout row = new LinearLayout(this);
        row.setPadding(Ui.dp(this, 16), Ui.dp(this, 10), Ui.dp(this, 16), Ui.dp(this, 10));
        scroll.addView(row);
        row.addView(chip(ky ? "Баары" : "Все", null));
        if (list != null) {
            for (int i = 0; i < list.length(); i++) {
                JSONObject cat = list.optJSONObject(i);
                if (cat == null) continue;
                row.addView(chip(cat.optString(ky ? "ky" : "ru"), cat.optString("id")));
            }
        }
        paintChips();
        return scroll;
    }

    private TextView chip(String title, String id) {
        TextView chip = label(title, 14, Ui.INK, true);
        chip.setTag(id);
        chip.setPadding(Ui.dp(this, 14), Ui.dp(this, 8), Ui.dp(this, 14), Ui.dp(this, 8));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-2, -2);
        params.rightMargin = Ui.dp(this, 8);
        chip.setLayoutParams(params);
        chip.setOnClickListener(v -> {
            category = id;
            paintChips();
            filter();
        });
        chips.add(chip);
        return chip;
    }

    private void paintChips() {
        for (TextView chip : chips) {
            Object id = chip.getTag();
            boolean active = id == null ? category == null : id.equals(category);
            chip.setBackground(Ui.rounded(active ? Ui.LEMON : Ui.SURFACE, Ui.dp(this, 100)));
        }
    }

    private View empty() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(Ui.dp(this, 32), 0, Ui.dp(this, 32), 0);
        TextView icon = label("📦", 44, Ui.INK, false);
        box.addView(icon);
        TextView title = label(ky ? "Каталог азырынча жок" : "Каталога пока нет", 17, Ui.INK, true);
        title.setPadding(0, Ui.dp(this, 12), 0, 0);
        box.addView(title);
        TextView text = label(ky
            ? "Интернет бар кезде колдонмону ачыңыз — каталог ушул жерде сакталат."
            : "Откройте приложение, пока есть интернет — каталог сохранится здесь.", 15, Ui.SECONDARY, false);
        text.setGravity(Gravity.CENTER);
        text.setPadding(0, Ui.dp(this, 8), 0, 0);
        box.addView(text);
        return box;
    }

    private TextView label(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    // ---- Список товаров ----

    private final class Adapter extends BaseAdapter {
        @Override public int getCount() { return shown.size(); }
        @Override public Object getItem(int position) { return shown.get(position); }
        @Override public long getItemId(int position) { return position; }

        @Override
        public View getView(int position, View convert, ViewGroup parent) {
            Row row = convert != null ? (Row) convert.getTag() : new Row();
            Item item = shown.get(position);
            row.name.setText(item.name);
            row.brand.setText(item.brand);
            row.brand.setVisibility(item.brand.isEmpty() ? View.GONE : View.VISIBLE);
            if (item.price > 0) {
                row.price.setText(Ui.number(item.price) + " сом");
                row.price.setTypeface(Typeface.DEFAULT_BOLD);
                row.price.setTextColor(Ui.INK);
                row.price.setTextSize(15);
            } else {
                row.price.setText(ky ? "Баасын сураңыз" : "Цена по запросу");
                row.price.setTypeface(Typeface.DEFAULT);
                row.price.setTextColor(Ui.SECONDARY);
                row.price.setTextSize(13);
            }
            if (item.oldPrice > item.price && item.price > 0) {
                row.old.setText(Ui.number(item.oldPrice));
                row.old.setVisibility(View.VISIBLE);
            } else {
                row.old.setVisibility(View.GONE);
            }
            row.stock.setVisibility(item.inStock ? View.GONE : View.VISIBLE);
            showImage(row.image, item.image);
            return row.root;
        }
    }

    private final class Row {
        final LinearLayout root = new LinearLayout(OfflineCatalogActivity.this);
        final ImageView image = new ImageView(OfflineCatalogActivity.this);
        final TextView name = label("", 15, Ui.INK, false);
        final TextView brand = label("", 12, Ui.SECONDARY, false);
        final TextView price = label("", 15, Ui.INK, true);
        final TextView old = label("", 12, Ui.SECONDARY, false);
        final TextView stock = label(ky ? "Жок" : "Нет в наличии", 11, Ui.SECONDARY, false);

        Row() {
            int pad = Ui.dp(OfflineCatalogActivity.this, 16);
            root.setPadding(pad, Ui.dp(OfflineCatalogActivity.this, 8), pad, Ui.dp(OfflineCatalogActivity.this, 8));
            int size = Ui.dp(OfflineCatalogActivity.this, 64);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setBackground(Ui.rounded(Ui.SURFACE, Ui.dp(OfflineCatalogActivity.this, 12)));
            image.setClipToOutline(true);
            root.addView(image, new LinearLayout.LayoutParams(size, size));

            LinearLayout text = new LinearLayout(OfflineCatalogActivity.this);
            text.setOrientation(LinearLayout.VERTICAL);
            text.setPadding(Ui.dp(OfflineCatalogActivity.this, 12), 0, 0, 0);
            name.setMaxLines(3);
            text.addView(name);
            text.addView(brand);
            LinearLayout prices = new LinearLayout(OfflineCatalogActivity.this);
            prices.setGravity(Gravity.CENTER_VERTICAL);
            prices.addView(price);
            old.setPaintFlags(old.getPaintFlags() | Paint.STRIKE_THRU_TEXT_FLAG);
            old.setPadding(Ui.dp(OfflineCatalogActivity.this, 8), 0, 0, 0);
            prices.addView(old);
            text.addView(prices);
            text.addView(stock);
            root.addView(text, new LinearLayout.LayoutParams(0, -2, 1f));
            root.setTag(this);
        }
    }

    // ---- Фото: память → файл в кэше → сеть ----

    private void showImage(ImageView view, String url) {
        view.setTag(url);
        view.setImageResource(android.R.drawable.ic_menu_gallery);
        view.setImageAlpha(90);
        if (url == null || url.isEmpty()) return;
        Bitmap cached = memory.get(url);
        if (cached != null) {
            view.setImageBitmap(cached);
            view.setImageAlpha(255);
            return;
        }
        loader.execute(() -> {
            Bitmap bitmap = fetch(url);
            if (bitmap == null) return;
            memory.put(url, bitmap);
            main.post(() -> {
                if (url.equals(view.getTag())) {
                    view.setImageBitmap(bitmap);
                    view.setImageAlpha(255);
                }
            });
        });
    }

    private Bitmap fetch(String url) {
        File dir = new File(getCacheDir(), "catalog-img");
        if (!dir.exists()) dir.mkdirs();
        File file = new File(dir, Integer.toHexString(url.hashCode()) + ".img");
        if (file.exists()) {
            Bitmap bitmap = decode(file);
            if (bitmap != null) return bitmap;
        }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            if (connection.getResponseCode() != 200) return null;
            try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(file)) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            }
            return decode(file);
        } catch (Exception e) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** Уменьшаем при чтении: для значка 64×64 полноразмерное фото не нужно. */
    private static Bitmap decode(File file) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getPath(), bounds);
        int sample = 1;
        while (bounds.outWidth / (sample * 2) >= 200 && bounds.outHeight / (sample * 2) >= 200) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        return BitmapFactory.decodeFile(file.getPath(), options);
    }
}
