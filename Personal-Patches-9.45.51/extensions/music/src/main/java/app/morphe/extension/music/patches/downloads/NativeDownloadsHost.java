/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.morphe.extension.music.patches.downloads;

import android.app.Activity;
import android.content.Context;
import android.content.ContextWrapper;
import android.view.View;
import android.view.ViewTreeObserver;
import java.lang.ref.WeakReference;
import android.widget.FrameLayout;

import app.bdcrusher.ytmusic.common.FeatureDiagnostics;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.shared.patches.DownloadMode;
import app.morphe.extension.shared.Logger;

import java.util.IdentityHashMap;
import java.util.Map;
import java.util.WeakHashMap;

/** The owned catalogue shares the stock Library header, navigation and player. */
public final class NativeDownloadsHost {
    public interface Owner {
        FrameLayout bd_libraryDownloadsContent();
        boolean bd_libraryDownloadsSelected();
    }

    private static final Map<Owner, Mounted> mounts = new WeakHashMap<>();
    private static final Map<Owner, LayoutBinding> layouts = new WeakHashMap<>();

    private NativeDownloadsHost() {}

    public static void changed(Owner owner) {
        try {
            FrameLayout content = owner.bd_libraryDownloadsContent();
            if (content == null || !owner.bd_libraryDownloadsSelected()
                    || Settings.DOWNLOAD_MODE.get() != DownloadMode.IN_APP) {
                release(owner);
                return;
            }
            LayoutBinding binding = layouts.get(owner);
            if (binding == null || binding.content != content) {
                if (binding != null) binding.close();
                layouts.put(owner, new LayoutBinding(owner, content));
            }
            if (!content.isShown() || !content.isAttachedToWindow()
                    || content.getWidth() == 0 || content.getHeight() == 0) return;

            Mounted old = mounts.get(owner);
            if (old != null && old.content == content && old.catalogue.view().getParent() == content) {
                old.coverStockContent();
                return;
            }
            unmount(owner);
            Activity activity = activity(content.getContext());
            if (activity == null || activity.isFinishing()) return;
            Mounted mount = new Mounted(content, new LocalDownloadsView(activity));
            mounts.put(owner, mount);
            content.addView(mount.catalogue.view(), new FrameLayout.LayoutParams(-1, -1));
            mount.coverStockContent();
            mount.catalogue.refreshCatalogue();
            FeatureDiagnostics.record("Downloads-library", "Owned catalogue attached inside Library Downloads");
        } catch (RuntimeException failure) {
            release(owner);
            Logger.printException(() -> "Could not attach the owned downloads catalogue", failure);
        }
    }

    public static boolean handleBack(Owner owner) {
        Mounted mount = mounts.get(owner);
        if (mount == null) return false;
        if (mount.catalogue.handleBack()) return true;
        release(owner);
        // The existing Library back callback resets the native chip selection.
        return false;
    }

    public static void release(Owner owner) {
        LayoutBinding binding = layouts.remove(owner);
        if (binding != null) binding.close();
        unmount(owner);
    }

    private static void unmount(Owner owner) {
        Mounted mount = mounts.remove(owner);
        if (mount == null) return;
        mount.catalogue.release();
        mount.content.removeView(mount.catalogue.view());
        for (var entry : mount.accessibility.entrySet()) {
            if (entry.getKey().getParent() == mount.content) {
                entry.getKey().setImportantForAccessibility(entry.getValue());
            }
        }
    }

    private static Activity activity(Context context) {
        while (context instanceof ContextWrapper wrapper) {
            if (context instanceof Activity activity) return activity;
            Context next = wrapper.getBaseContext();
            if (next == context) break;
            context = next;
        }
        return null;
    }

    private static final class LayoutBinding implements ViewTreeObserver.OnGlobalLayoutListener {
        final FrameLayout content;
        final WeakReference<Owner> owner;
        final ViewTreeObserver initialObserver;

        LayoutBinding(Owner owner, FrameLayout content) {
            this.owner = new WeakReference<>(owner);
            this.content = content;
            initialObserver = content.getViewTreeObserver();
            initialObserver.addOnGlobalLayoutListener(this);
        }

        @Override public void onGlobalLayout() {
            Owner current = owner.get();
            if (current == null) close();
            else changed(current);
        }

        void close() {
            if (initialObserver.isAlive()) initialObserver.removeOnGlobalLayoutListener(this);
            ViewTreeObserver observer = content.getViewTreeObserver();
            if (observer != initialObserver && observer.isAlive()) observer.removeOnGlobalLayoutListener(this);
        }
    }

    private static final class Mounted {
        final FrameLayout content;
        final LocalDownloadsView catalogue;
        final Map<View, Integer> accessibility = new IdentityHashMap<>();

        Mounted(FrameLayout content, LocalDownloadsView catalogue) {
            this.content = content;
            this.catalogue = catalogue;
        }

        void coverStockContent() {
            View panel = catalogue.view();
            for (int index = 0; index < content.getChildCount(); index++) {
                View child = content.getChildAt(index);
                if (child == panel) continue;
                accessibility.putIfAbsent(child, child.getImportantForAccessibility());
                if (child.getImportantForAccessibility() != View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS)
                    child.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            }
            if (content.getChildAt(content.getChildCount() - 1) != panel) panel.bringToFront();
        }
    }
}
