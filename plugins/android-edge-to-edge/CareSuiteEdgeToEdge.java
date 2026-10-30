package app.caresuitehealthos.edge;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.lang.ref.WeakReference;
import java.util.Map;
import java.util.WeakHashMap;

/** System-bar protection is drawn inside the window, using its actual insets. */
public final class CareSuiteEdgeToEdge {
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final Map<Window, WeakReference<Surface>> SURFACES = new WeakHashMap<>();

  private CareSuiteEdgeToEdge() {}

  public static int readStatusSurface(Window window) {
    synchronized (SURFACES) {
      WeakReference<Surface> reference = SURFACES.get(window);
      Surface surface = reference == null ? null : reference.get();
      return surface == null ? Color.TRANSPARENT : surface.statusColor;
    }
  }

  public static void paintStatusSurface(Window window, int color) { paint(window, color, true); }
  public static void paintNavigationSurface(Window window, int color) { paint(window, color, false); }

  private static void paint(Window window, int color, boolean status) {
    if (window == null) return;
    if (Looper.myLooper() != Looper.getMainLooper()) {
      MAIN.post(() -> paint(window, color, status));
      return;
    }
    Surface surface;
    synchronized (SURFACES) {
      WeakReference<Surface> reference = SURFACES.get(window);
      surface = reference == null ? null : reference.get();
      if (surface == null) {
        surface = new Surface(window.getDecorView());
        SURFACES.put(window, new WeakReference<>(surface));
      }
    }
    if (status) surface.statusColor = color;
    else surface.navigationColor = color;
    surface.refresh();
    surface.invalidateSelf();
  }

  public static void applyCutoutMode(WindowManager.LayoutParams attributes, int retiredRequest) {
    // ALWAYS is available from API 30; older cutout-capable devices retain a
    // safe non-overlapping layout. DEFAULT and SHORT_EDGES are never stored.
    if (Build.VERSION.SDK_INT >= 30) {
      attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
    } else if (Build.VERSION.SDK_INT >= 28) {
      attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
    }
  }

  private static final class Surface extends Drawable implements
      ViewTreeObserver.OnPreDrawListener, View.OnAttachStateChangeListener, View.OnLayoutChangeListener {
    private final View decor;
    private final Paint paint = new Paint();
    private Insets statusInsets = Insets.NONE;
    private Insets navigationInsets = Insets.NONE;
    private volatile int statusColor = Color.TRANSPARENT;
    private volatile int navigationColor = Color.TRANSPARENT;
    private int alpha = 255;
    private boolean observing;

    Surface(View decor) {
      this.decor = decor;
      // An overlay drawable never intercepts touches or replaces an activity's
      // existing inset listener. Its lifecycle belongs to this decor view.
      decor.getOverlay().add(this);
      decor.addOnAttachStateChangeListener(this);
      decor.addOnLayoutChangeListener(this);
      if (decor.isAttachedToWindow()) observe();
    }

    private void observe() {
      if (!observing && decor.getViewTreeObserver().isAlive()) {
        decor.getViewTreeObserver().addOnPreDrawListener(this);
        observing = true;
      }
    }

    void refresh() {
      WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
      Insets nextStatus = insets == null ? Insets.NONE : insets.getInsets(WindowInsetsCompat.Type.statusBars());
      Insets nextNavigation = insets == null ? Insets.NONE : insets.getInsets(WindowInsetsCompat.Type.navigationBars());
      boolean changed = !nextStatus.equals(statusInsets) || !nextNavigation.equals(navigationInsets)
          || getBounds().width() != decor.getWidth() || getBounds().height() != decor.getHeight();
      statusInsets = nextStatus;
      navigationInsets = nextNavigation;
      setBounds(0, 0, decor.getWidth(), decor.getHeight());
      if (changed) invalidateSelf();
    }

    @Override public boolean onPreDraw() { refresh(); return true; }
    @Override public void onViewAttachedToWindow(View view) { observe(); refresh(); }
    @Override public void onViewDetachedFromWindow(View view) {
      if (observing && view.getViewTreeObserver().isAlive()) view.getViewTreeObserver().removeOnPreDrawListener(this);
      observing = false;
    }
    @Override public void onLayoutChange(View view, int left, int top, int right, int bottom,
        int oldLeft, int oldTop, int oldRight, int oldBottom) { refresh(); }

    private void bar(Canvas canvas, Insets insets, int color) {
      if (Color.alpha(color) == 0) return;
      paint.setColor(color);
      paint.setAlpha(Color.alpha(color) * alpha / 255);
      int width = getBounds().width(), height = getBounds().height();
      if (insets.top > 0) canvas.drawRect(0, 0, width, insets.top, paint);
      if (insets.bottom > 0) canvas.drawRect(0, height - insets.bottom, width, height, paint);
      if (insets.left > 0) canvas.drawRect(0, 0, insets.left, height, paint);
      if (insets.right > 0) canvas.drawRect(width - insets.right, 0, width, height, paint);
    }
    @Override public void draw(Canvas canvas) {
      bar(canvas, statusInsets, statusColor);
      bar(canvas, navigationInsets, navigationColor);
    }
    @Override public void setAlpha(int value) { alpha = value; invalidateSelf(); }
    @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
  }
}
