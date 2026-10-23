/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Rect;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import java.lang.ref.WeakReference;
import app.morphe.extension.shared.Utils;

/** Native navigation-inset protection, scoped to the displayed native Lyrics panel. */
@SuppressWarnings("deprecation")
final class LyricsSystemBars {
    private static WeakReference<View> owner=new WeakReference<>(null),decorRef=new WeakReference<>(null);
    private static WeakReference<Window> windowRef=new WeakReference<>(null);
    private static final ColorDrawable protection=new ColorDrawable();
    private static int previousColor,previousDivider,previousAppearance,appliedColor;
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
        Rect navigation=navigationBounds(decor);
        Integer color=panelColor(body);
        if(!body.isShown()||!decor.hasWindowFocus()||navigation.isEmpty()||color==null){release(view);return;}
        if(owner.get()!=view||windowRef.get()!=window){
            release(null);owner=new WeakReference<>(view);decorRef=new WeakReference<>(decor);windowRef=new WeakReference<>(window);
            previousColor=window.getNavigationBarColor();previousAppearance=appearance(window,decor);
            previousDivider=Build.VERSION.SDK_INT>=28?window.getNavigationBarDividerColor():0;
            previousContrast=Build.VERSION.SDK_INT>=29&&window.isNavigationBarContrastEnforced();
            appliedColor=previousColor;decor.getOverlay().add(protection);
        }else if(window.getNavigationBarColor()!=appliedColor){
            // Preserve a newer native theme update for restoration after closing Lyrics.
            previousColor=window.getNavigationBarColor();
        }
        appliedColor=color;protection.setColor(color);protection.setBounds(navigation);
        window.setNavigationBarColor(color);
        if(Build.VERSION.SDK_INT>=28)window.setNavigationBarDividerColor(Color.TRANSPARENT);
        if(Build.VERSION.SDK_INT>=29)window.setNavigationBarContrastEnforced(false);
        boolean light=Color.red(color)*299+Color.green(color)*587+Color.blue(color)*114>=160000;
        if(Build.VERSION.SDK_INT>=30){
            WindowInsetsController controller=window.getInsetsController();
            if(controller!=null)controller.setSystemBarsAppearance(light?WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS:0,WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }else{
            int flags=decor.getSystemUiVisibility();decor.setSystemUiVisibility(light?flags|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR:flags&~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }
    static void release(View view){
        if(view!=null&&owner.get()!=view)return;
        Window window=windowRef.get();View decor=decorRef.get();
        if(decor!=null)decor.getOverlay().remove(protection);
        if(window!=null&&decor!=null){
            if(window.getNavigationBarColor()==appliedColor)window.setNavigationBarColor(previousColor);
            if(Build.VERSION.SDK_INT>=28&&window.getNavigationBarDividerColor()==Color.TRANSPARENT)window.setNavigationBarDividerColor(previousDivider);
            if(Build.VERSION.SDK_INT>=29&&!window.isNavigationBarContrastEnforced())window.setNavigationBarContrastEnforced(previousContrast);
            if(Build.VERSION.SDK_INT>=30){WindowInsetsController controller=window.getInsetsController();if(controller!=null)controller.setSystemBarsAppearance(previousAppearance,WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);}
            else{int flags=decor.getSystemUiVisibility();decor.setSystemUiVisibility((flags&~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR)|previousAppearance);}
        }
        owner.clear();decorRef.clear();windowRef.clear();
    }
    private static int appearance(Window window,View decor){
        if(Build.VERSION.SDK_INT>=30){WindowInsetsController controller=window.getInsetsController();return controller==null?0:controller.getSystemBarsAppearance()&WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;}
        return decor.getSystemUiVisibility()&View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
    }
    private static Rect navigationBounds(View decor){
        WindowInsets insets=decor.getRootWindowInsets();if(insets==null)return new Rect();
        int bottom,left,right;
        if(Build.VERSION.SDK_INT>=30){android.graphics.Insets n=insets.getInsets(WindowInsets.Type.navigationBars());bottom=n.bottom;left=n.left;right=n.right;}
        else{bottom=Math.min(insets.getSystemWindowInsetBottom(),insets.getStableInsetBottom());left=Math.min(insets.getSystemWindowInsetLeft(),insets.getStableInsetLeft());right=Math.min(insets.getSystemWindowInsetRight(),insets.getStableInsetRight());}
        int w=decor.getWidth(),h=decor.getHeight();
        if(bottom>0&&bottom<h)return new Rect(0,h-bottom,w,h);
        if(right>0&&right<w)return new Rect(w-right,0,w,h);
        if(left>0&&left<w)return new Rect(0,0,left,h);
        return new Rect();
    }
    private static Integer panelColor(View body){
        for(int depth=0;body!=null&&depth<12;depth++){
            Drawable background=body.getBackground();
            if(background!=null){
                Integer color=sample(background);
                if(color!=null&&Color.alpha(color)==255)return color;
            }
            body=body.getParent() instanceof View?(View)body.getParent():null;
        }
        return null;
    }
    private static Integer sample(Drawable drawable){
        Rect bounds=drawable.getBounds();if(bounds.isEmpty())return null;
        Bitmap bitmap=Bitmap.createBitmap(1,1,Bitmap.Config.ARGB_8888);
        try{Canvas canvas=new Canvas(bitmap);canvas.translate(-bounds.centerX(),-(bounds.bottom-1));drawable.draw(canvas);return bitmap.getPixel(0,0);}
        catch(RuntimeException unsupported){return null;}
        finally{bitmap.recycle();}
    }
}
