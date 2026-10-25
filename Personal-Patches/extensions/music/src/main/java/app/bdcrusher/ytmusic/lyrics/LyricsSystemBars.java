/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import java.lang.ref.WeakReference;
import app.morphe.extension.shared.Utils;

/** Transparent navigation while the native Lyrics panel owns the current window. */
@SuppressWarnings("deprecation")
final class LyricsSystemBars {
    private static WeakReference<View> owner=new WeakReference<>(null);
    private static WeakReference<Window> windowRef=new WeakReference<>(null);
    private static int previousColor,previousDivider;
    private static boolean previousContrast;
    private LyricsSystemBars(){}

    static void sync(View view,boolean active){
        if(!active){release(view);return;}
        Activity activity=Utils.getActivity();
        if(activity==null||activity.isFinishing()||activity.isDestroyed()||!(view.getParent() instanceof View body)){
            release(view);return;
        }
        Window window=activity.getWindow();View decor=window.getDecorView();
        if(view.getWindowToken()==null||!view.getWindowToken().equals(decor.getWindowToken())){release(view);return;}
        if(!body.isShown()||!decor.hasWindowFocus()||!hasNavigation(decor)){release(view);return;}
        if(owner.get()!=view||windowRef.get()!=window){
            release(null);owner=new WeakReference<>(view);windowRef=new WeakReference<>(window);
            previousColor=window.getNavigationBarColor();
            previousDivider=Build.VERSION.SDK_INT>=28?window.getNavigationBarDividerColor():0;
            previousContrast=Build.VERSION.SDK_INT>=29&&window.isNavigationBarContrastEnforced();
        }else{
            // Retain native theme changes for restoration when Lyrics closes.
            if(window.getNavigationBarColor()!=Color.TRANSPARENT)previousColor=window.getNavigationBarColor();
            if(Build.VERSION.SDK_INT>=28&&window.getNavigationBarDividerColor()!=Color.TRANSPARENT)previousDivider=window.getNavigationBarDividerColor();
            if(Build.VERSION.SDK_INT>=29&&window.isNavigationBarContrastEnforced())previousContrast=true;
        }
        if(window.getNavigationBarColor()!=Color.TRANSPARENT)window.setNavigationBarColor(Color.TRANSPARENT);
        if(Build.VERSION.SDK_INT>=28&&window.getNavigationBarDividerColor()!=Color.TRANSPARENT)window.setNavigationBarDividerColor(Color.TRANSPARENT);
        if(Build.VERSION.SDK_INT>=29&&window.isNavigationBarContrastEnforced())window.setNavigationBarContrastEnforced(false);
        // Leave native button/icon appearance and content/window insets untouched.
    }
    static void release(View view){
        if(view!=null&&owner.get()!=view)return;
        Window window=windowRef.get();
        if(window!=null){
            if(window.getNavigationBarColor()==Color.TRANSPARENT)window.setNavigationBarColor(previousColor);
            if(Build.VERSION.SDK_INT>=28&&window.getNavigationBarDividerColor()==Color.TRANSPARENT)window.setNavigationBarDividerColor(previousDivider);
            if(Build.VERSION.SDK_INT>=29&&!window.isNavigationBarContrastEnforced())window.setNavigationBarContrastEnforced(previousContrast);
        }
        owner.clear();windowRef.clear();
    }
    private static boolean hasNavigation(View decor){
        WindowInsets insets=decor.getRootWindowInsets();if(insets==null)return false;
        int bottom,left,right;
        if(Build.VERSION.SDK_INT>=30){android.graphics.Insets n=insets.getInsets(WindowInsets.Type.navigationBars());bottom=n.bottom;left=n.left;right=n.right;}
        else{bottom=Math.min(insets.getSystemWindowInsetBottom(),insets.getStableInsetBottom());left=Math.min(insets.getSystemWindowInsetLeft(),insets.getStableInsetLeft());right=Math.min(insets.getSystemWindowInsetRight(),insets.getStableInsetRight());}
        return bottom>0&&bottom<decor.getHeight()||left>0&&left<decor.getWidth()||right>0&&right<decor.getWidth();
    }
}
