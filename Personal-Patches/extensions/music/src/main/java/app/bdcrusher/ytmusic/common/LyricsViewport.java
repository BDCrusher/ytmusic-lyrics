/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;

import android.graphics.Rect;
import android.view.View;
import android.view.ViewGroup;
import java.util.IdentityHashMap;
import java.util.Map;

/** Extend only the verified native Lyrics body to the navigation edge, never its header. */
final class LyricsViewport implements AutoCloseable {
    final View root;
    private final View decor;
    private final Map<ViewGroup, boolean[]> clipping = new IdentityHashMap<>();
    private int baseMargin, lastMargin, baseHeight, lastHeight;
    private boolean owned;
    private final android.os.Handler handler=new android.os.Handler(android.os.Looper.getMainLooper());
    private long geometry=Long.MIN_VALUE,stableAt;private int navigation;
    private final Runnable settle=()->update(navigation);

    LyricsViewport(View root, View decor) { this.root = root; this.decor = decor; }
    boolean contains(View view){for(View child=root;child!=null;child=child.getParent() instanceof View parent?parent:null)if(child==view)return true;return false;}

    void update(int navigationBottom) {
        navigation=navigationBottom;Rect visible = new Rect();
        if (navigationBottom <= 0 || !root.isShown() || !root.getGlobalVisibleRect(visible)) {
            close();
            return;
        }
        ViewGroup.LayoutParams params = root.getLayoutParams();
        if (params == null) return;
        int[] position = new int[2];
        root.getLocationInWindow(position);
        int gap = decor.getHeight() - (position[1] + root.getHeight());
        if (gap < 0 || gap > navigationBottom + 1 || gap == 0) return;
        long current=((long)position[1]<<32)|(root.getHeight()&0xffffffffL),now=android.os.SystemClock.elapsedRealtime();
        if(current!=geometry){geometry=current;stableAt=now;handler.removeCallbacks(settle);handler.postDelayed(settle,90);return;}
        if(now-stableAt<80)return;
        if (!owned) {
            baseHeight = lastHeight = params.height;
            baseMargin = lastMargin = params instanceof ViewGroup.MarginLayoutParams margin ? margin.bottomMargin : 0;
            owned = true;
        }
        // Native drag/snap/layout changes remain authoritative; retain their latest base.
        if (params.height != lastHeight) baseHeight = params.height;
        if (params instanceof ViewGroup.MarginLayoutParams margin && margin.bottomMargin != lastMargin) baseMargin = margin.bottomMargin;
        boolean changed = false;
        if (params.height >= 0) {
            int next = Math.min(baseHeight + navigationBottom, params.height + gap);
            if (next != params.height) { params.height = next; changed = true; }
        } else if (params.height == ViewGroup.LayoutParams.MATCH_PARENT && params instanceof ViewGroup.MarginLayoutParams margin) {
            int next=Math.max(baseMargin-navigationBottom,margin.bottomMargin-gap);
            if(next!=margin.bottomMargin){margin.bottomMargin=next;changed=true;}
        }
        if (!changed) return;
        lastHeight = params.height;
        if (params instanceof ViewGroup.MarginLayoutParams margin) lastMargin = margin.bottomMargin;
        for (android.view.ViewParent parent = root.getParent(); parent instanceof ViewGroup group; parent = group.getParent()) {
            clipping.putIfAbsent(group, new boolean[]{group.getClipChildren(), group.getClipToPadding()});
            if (group.getClipChildren()) group.setClipChildren(false);
            if (group.getClipToPadding()) group.setClipToPadding(false);
            if (group == decor) break;
        }
        root.setLayoutParams(params);
        FeatureDiagnostics.event("Panel-layout","entry="+FeatureDiagnostics.entry()+" extendedBottom="+gap+" navigation="+navigationBottom);
    }

    @Override public void close() {
        handler.removeCallbacks(settle);geometry=Long.MIN_VALUE;
        if (owned) {
            ViewGroup.LayoutParams params = root.getLayoutParams();
            if (params != null) {
                boolean changed = false;
                if (params.height == lastHeight && params.height != baseHeight) { params.height = baseHeight; changed = true; }
                if (params instanceof ViewGroup.MarginLayoutParams margin && margin.bottomMargin == lastMargin && margin.bottomMargin != baseMargin) { margin.bottomMargin = baseMargin; changed = true; }
                if (changed) root.setLayoutParams(params);
            }
            owned = false;
        }
        for (var entry : clipping.entrySet()) {
            entry.getKey().setClipChildren(entry.getValue()[0]);
            entry.getKey().setClipToPadding(entry.getValue()[1]);
        }
        clipping.clear();
    }
}
