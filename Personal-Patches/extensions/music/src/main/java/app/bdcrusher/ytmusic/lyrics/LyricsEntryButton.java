/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import java.lang.ref.WeakReference;
import app.morphe.extension.music.patches.lyrics.LyricsManager;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.shared.VideoInformation;

/** Availability bridge into the native action MODEL. No view, drawable or listener edits. */
public final class LyricsEntryButton {
    private static WeakReference<Object> presenter=new WeakReference<>(null);
    private static WeakReference<LyricsEntryButton> active=new WeakReference<>(null);
    private volatile boolean available;
    private volatile String identity="",videoId="";
    public LyricsEntryButton(){active=new WeakReference<>(this);}
    public static void capturePresenter(Object value){
        presenter=new WeakReference<>(value);
        new Handler(Looper.getMainLooper()).post(()->{LyricsEntryButton entry=active.get();if(entry!=null&&entry.available)entry.refresh();});
    }
    public static byte[] rewrite(Object owner,byte[] element){
        LyricsEntryButton entry=active.get();
        if(entry==null||!entry.available||!entry.isCurrent())return element;
        try{if(!entry.videoId.equals(nativeVideoId(owner)))return element;return NativeActionModel.enable(element);}
        catch(Exception ex){LyricsDiagnostics.record("Lyrics action model",ex.getClass().getSimpleName());return element;}
    }
    void update(Activity activity,String key){
        if(!key.equals(identity))trackChanged(key);
        if(!isCurrent())return;
        Object owner=presenter.get();
        if(owner==null||!videoId.equals(nativeVideoId(owner)))return;
        if(!NativeLyricsHost.prepare(videoId))return;
        if(!available){available=true;refresh();}
    }
    private void refresh(){
        Object owner=presenter.get();if(owner==null)return;
        try{if(videoId.equals(nativeVideoId(owner)))refreshNative(owner);}
        catch(Exception ex){LyricsDiagnostics.record("Lyrics action model","Native refresh failed: "+ex.getClass().getSimpleName());}
    }
    private boolean isCurrent(){
        LyricsManager manager=LyricsManager.getInstance();var track=manager.getCurrentTrack();String id=VideoInformation.getVideoId();
        return Settings.LYRICS_ENABLED.get()&&track!=null&&id!=null&&id.equals(manager.getCommittedVideoId())&&identity.equals(LyricsRepository.identity(track,id));
    }
    void hideButton(){if(available){available=false;refresh();}}
    void trackChanged(String key){hideButton();identity=key;String id=VideoInformation.getVideoId();videoId=id==null?"":id;}
    void clear(){hideButton();identity="";videoId="";}
    // Exact-target native proxies, replaced at patch time.
    private static String nativeVideoId(Object owner){return "";}
    private static void refreshNative(Object owner){}
    public static Object rewriteNative(Object owner,Object element){return element;}
}
