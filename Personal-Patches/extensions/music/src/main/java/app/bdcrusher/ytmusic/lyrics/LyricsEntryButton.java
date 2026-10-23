/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import app.morphe.extension.music.patches.lyrics.LyricsManager;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.shared.VideoInformation;

/** Availability bridge for both server and client-generated native action models. */
public final class LyricsEntryButton {
    private static final Handler main=new Handler(Looper.getMainLooper());
    private static final ArrayList<Presentation> presentations=new ArrayList<>();
    private static WeakReference<LyricsEntryButton> active=new WeakReference<>(null);
    private static final class Presentation {
        final WeakReference<Object> owner;
        String video="";
        Object original;
        boolean replaying,enabled,currentModel;
        Presentation(Object value){owner=new WeakReference<>(value);}
    }
    private volatile boolean available;
    private volatile String identity="",videoId="";
    public LyricsEntryButton(){active=new WeakReference<>(this);}
    private static synchronized Presentation presentation(Object owner){
        presentations.removeIf(p->p.owner.get()==null);
        for(Presentation p:presentations)if(p.owner.get()==owner)return p;
        Presentation p=new Presentation(owner);
        if(presentations.size()>=8)presentations.remove(0);
        presentations.add(p);return p;
    }
    public static void capturePresenter(Object owner){presentation(owner);}
    private static synchronized ArrayList<Presentation> snapshot(){return new ArrayList<>(presentations);}
    /** The actual native b/c/e video argument, including the no-response path. */
    public static void captureIdentity(Object owner,String id){
        if(owner==null||id==null||id.isEmpty())return;
        Presentation p=presentation(owner);
        if(!id.equals(p.video)){p.video=id;p.original=null;p.enabled=false;p.currentModel=false;}
        main.post(()->{LyricsEntryButton entry=active.get();if(entry!=null&&entry.available)entry.refresh();});
    }
    /** Retain the unmodified native model, never a personal view or tap handler. */
    public static void captureModel(Object owner,Object original,byte[] bytes){
        Presentation p=presentation(owner);
        if(p.replaying){p.currentModel=true;return;}
        if(bytes==null||bytes.length>2_000_000){p.currentModel=false;return;}
        String recording=NativeActionModel.recording(bytes);
        p.currentModel=recording==null||recording.equals(p.video);p.enabled=false;
        if(p.currentModel)p.original=original;
        else LyricsDiagnostics.record("Lyrics action model","Ignored native action row for a different recording");
    }
    public static Object originalModel(Object owner){return presentation(owner).original;}
    public static byte[] rewrite(Object owner,byte[] element){
        LyricsEntryButton entry=active.get();
        Presentation p=presentation(owner);
        if(entry==null||!entry.available||!entry.isCurrent()||!p.currentModel||!entry.videoId.equals(p.video))return element;
        byte[] result=NativeActionModel.enable(element);
        p.enabled=result!=element;
        return result;
    }
    void update(Activity activity,String key){
        if(!key.equals(identity))trackChanged(key);
        if(!isCurrent())return;
        // Panel definitions can be registered after provider results arrive.
        NativeLyricsHost.prepare(videoId);
        available=true;refresh();
    }
    private void refresh(){
        if(!videoId.equals(VideoInformation.getVideoId()))return;
        if(available&&!isCurrent())return;
        for(Presentation p:snapshot()){
            Object owner=p.owner.get();
            if(owner==null||p.original==null||p.replaying||!videoId.equals(p.video))continue;
            if(available==p.enabled)continue;
            try{p.replaying=true;refreshNative(owner);p.enabled=available;}
            catch(Exception ex){LyricsDiagnostics.record("Lyrics action model","Native model replay failed: "+ex.getClass().getSimpleName());}
            finally{p.replaying=false;}
        }
    }
    private boolean isCurrent(){
        LyricsManager manager=LyricsManager.getInstance();var track=manager.getCurrentTrack();String id=VideoInformation.getVideoId();
        return Settings.LYRICS_ENABLED.get()&&track!=null&&id!=null&&id.equals(manager.getCommittedVideoId())&&identity.equals(LyricsRepository.identity(track,id));
    }
    void hideButton(){if(available){available=false;refresh();}}
    void trackChanged(String key){hideButton();identity=key;String id=VideoInformation.getVideoId();videoId=id==null?"":id;}
    void clear(){hideButton();identity="";videoId="";}
    // Replays the remembered model through the presenter's own renderer at patch time.
    private static void refreshNative(Object owner){}
    public static Object rewriteNative(Object owner,Object element){return element;}
}
