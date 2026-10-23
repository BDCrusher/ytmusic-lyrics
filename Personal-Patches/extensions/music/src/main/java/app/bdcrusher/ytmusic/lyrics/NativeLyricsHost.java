/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.FrameLayout;
import java.lang.ref.WeakReference;
import java.util.Locale;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.shared.ResourceUtils;

/** Attaches only to the content returned by the active native engagement-panel model. */
public final class NativeLyricsHost {
    static final String ID="music_watch_lyrics_panel";
    private static String preparedVideo="";
    private static final Handler main=new Handler(Looper.getMainLooper());
    private static WeakReference<Object> controller=new WeakReference<>(null),panel=new WeakReference<>(null);
    private static WeakReference<BetterLyricsPanelView> renderer=new WeakReference<>(null);
    private static int epoch;
    private static boolean lyrics;
    private NativeLyricsHost(){}
    public static void captureController(Object value){controller=new WeakReference<>(value);preparedVideo="";}
    public static boolean isOpen(){return lyrics&&panel.get()!=null;}
    public static boolean prepare(String videoId){
        Object owner=controller.get();if(owner==null)return false;
        try{
            byte[] original=nativeDefinition(owner,ID);
            if(original!=null&&preparedVideo.equals(videoId))return true;
            boolean related=original==null||new ProtoWire(original).one(3)==null;
            if(related)original=nativeDefinition(owner,"music-related-panel");
            if(original==null){LyricsDiagnostics.record("Lyrics panel","Native Music presentation is not ready");return false;}
            registerNative(owner,NativePanelWire.definition(original,ResourceUtils.getString("lyrics_tab_title"),related));
            preparedVideo=videoId;
            LyricsDiagnostics.record("Lyrics panel","Prepared native Music Lyrics with mini-player snap and native palette");
            return true;
        }catch(Exception ex){LyricsDiagnostics.record("Lyrics panel","Native Music setup failed: "+ex.getClass().getSimpleName());return false;}
    }
    public static void onNativePanelChanged(Object value){
        epoch++;panel=new WeakReference<>(value);lyrics=false;
        try{if(value!=null){String id=panelId(value);lyrics=id!=null&&(ID.equals(id)||id.toLowerCase(Locale.ROOT).contains("lyrics"));}}
        catch(Exception ex){LyricsDiagnostics.record("Lyrics panel","Native identity failed: "+ex.getClass().getSimpleName());}
        BetterLyricsPanelView old=renderer.get();if(old!=null)old.syncOverlay();
        if(lyrics)attach(epoch,0);
    }
    public static void onNativeLayout(){if(isOpen())attach(epoch,0);}
    private static void attach(int expected,int attempt){
        main.postDelayed(()->{
            if(expected!=epoch||!isOpen()||!Settings.LYRICS_ENABLED.get())return;
            try{
                View root=panelRoot(panel.get());
                // Never fall back to the activity/decor, a title ancestor, or a guessed container.
                if(!(root instanceof FrameLayout body)){LyricsDiagnostics.record("Lyrics panel","Unsupported native content root");return;}
                if(!body.isAttachedToWindow()){
                    if(attempt<30)attach(expected,attempt+1);
                    return;
                }
                BetterLyricsPanelView view=renderer.get();
                if(view!=null&&view.getParent()==body){view.syncOverlay();return;}
                if(view!=null&&view.getParent() instanceof android.view.ViewGroup parent)parent.removeView(view);
                view=new BetterLyricsPanelView(body.getContext());renderer=new WeakReference<>(view);
                body.addView(view,new FrameLayout.LayoutParams(-1,-1));
                view.syncOverlay();
            }catch(Exception ex){LyricsDiagnostics.record("Lyrics panel","Native attachment failed: "+ex.getClass().getSimpleName());}
        },attempt==0?0:32);
    }
    public static boolean owns(View view){
        if(!isOpen()||renderer.get()!=view)return false;
        try{return view.getParent()==panelRoot(panel.get());}catch(Exception ex){return false;}
    }
    // Replaced with typed native calls by the exact-target patch. No reflection or bundled host stubs.
    private static byte[] nativeDefinition(Object owner,String id){return null;}
    private static void registerNative(Object owner,byte[] definition){}
    private static View panelRoot(Object value){return null;}
    private static String panelId(Object value){return null;}
}
