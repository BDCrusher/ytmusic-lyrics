/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.shared.ResourceUtils;
import app.morphe.extension.shared.Utils;
import java.lang.ref.WeakReference;

/** Mounts the personal renderer in the selected, visible Music lyrics tab. */
public final class PersonalLyricsTab {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static WeakReference<BetterLyricsPanelView> renderer = new WeakReference<>(null);
    private static long pendingUntil;
    private static final Runnable INSTALL = PersonalLyricsTab::install;

    private PersonalLyricsTab() {}

    public static void onTabSelected(ViewGroup tabs) {
        if (tabs.getId() == ResourceUtils.getIdIdentifier("bottom_sheet_tabbed_view")) schedule();
    }

    public static void schedule() {
        if (selectedTabs() == null || pendingUntil != 0) return;
        pendingUntil = SystemClock.uptimeMillis() + 2_000;
        MAIN.postDelayed(INSTALL, 150);
    }

    static boolean owns(BetterLyricsPanelView panel) {
        ViewGroup tabs = selectedTabs();
        return tabs != null && panel.getParent() != null && panel.getParent() == content(tabs);
    }

    static void onDetached(BetterLyricsPanelView panel) {
        if (renderer.get() == panel) schedule();
    }

    static void recordingChanged() {
        BetterLyricsPanelView panel = renderer.get();
        if (panel != null && panel.isAttachedToWindow()) panel.recordingChanged();
    }

    static void playbackChanged() {
        BetterLyricsPanelView panel = renderer.get();
        if (panel != null) panel.publishPlayback();
    }

    private static void install() {
        ViewGroup tabs = selectedTabs();
        ViewGroup body = tabs == null ? null : content(tabs);
        if (body == null) {
            if (tabs != null && SystemClock.uptimeMillis() < pendingUntil) {
                MAIN.postDelayed(INSTALL, 32);
                return;
            }
            pendingUntil = 0;
            return;
        }
        pendingUntil = 0;
        BetterLyricsPanelView panel = renderer.get();
        if (panel == null || panel.getParent() != body) {
            BetterLyricsPanelView previous = panel;
            panel = new BetterLyricsPanelView(body.getContext());
            panel.useNativeTab();
            renderer = new WeakReference<>(panel);
            if (previous != null && previous.getParent() instanceof ViewGroup old) old.removeView(previous);
            body.addView(panel, new FrameLayout.LayoutParams(-1, -1));
        }
        panel.syncOverlay();
    }

    private static ViewGroup selectedTabs() {
        var activity = Utils.getActivity();
        if (activity == null || !Settings.LYRICS_ENABLED.get()) return null;
        int id = ResourceUtils.getIdIdentifier("bottom_sheet_tabbed_view");
        int title = ResourceUtils.getStringIdentifier("lyrics_tab_title");
        if (id == 0 || title == 0) return null;
        View view = activity.getWindow().getDecorView().findViewById(id);
        if (view instanceof ViewGroup tabs && tabs.getChildCount() != 0
                && hasSelectedTitle(tabs.getChildAt(0), tabs.getResources().getString(title))) return tabs;
        return null;
    }

    private static boolean hasSelectedTitle(View view, String title) {
        if (view instanceof TextView text && text.isSelected() && title.equalsIgnoreCase(text.getText().toString())) return true;
        if (view instanceof ViewGroup group) {
            for (int i = 0; i < group.getChildCount(); i++) {
                if (hasSelectedTitle(group.getChildAt(i), title)) return true;
            }
        }
        return false;
    }

    private static ViewGroup content(ViewGroup tabs) {
        int id = ResourceUtils.getIdIdentifier("elements_component_holder");
        return id == 0 || tabs.getWidth() == 0 ? null : visibleContent(tabs, id, tabs.getWidth(), new Rect());
    }

    private static ViewGroup visibleContent(View view, int id, int width, Rect clip) {
        if (view.getVisibility() != View.VISIBLE || !(view instanceof ViewGroup group)) return null;
        if (group.getId() == id) return group.getGlobalVisibleRect(clip) && clip.width() == width ? group : null;
        for (int i = 0; i < group.getChildCount(); i++) {
            ViewGroup match = visibleContent(group.getChildAt(i), id, width, clip);
            if (match != null) return match;
        }
        return null;
    }
}
