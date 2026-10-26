/* Copyright 2026 BDCrusher. GPL-3.0. Uses host authenticated browse and existing Morphe downloads. */
package app.bdcrusher.ytmusic.playlists;

import android.app.Activity;
import android.content.Intent;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.json.*;
import app.bdcrusher.ytmusic.common.PersonalRuntime;
import app.bdcrusher.ytmusic.lyrics.ProtoWire;
import app.morphe.extension.music.patches.downloads.LocalDownloadManager;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.patches.DownloadMode;
import app.morphe.extension.shared.settings.preference.ExternalDownloaderPreference;

/** One durable batch repository. Enumeration never reads visible rows or changes the playback queue. */
public final class PlaylistRuntime {
    public interface PhoneClient {
        Future<?> bd_playlistBrowse(String browseId,java.util.concurrent.Executor executor);
        Future<?> bd_playlistContinue(String token,java.util.concurrent.Executor executor);
    }
    public interface PhoneResponse { byte[] bd_playlistBytes(); }
    public interface CommandBytes { byte[] toByteArray(); }
    public interface Completion { void complete(String videoId,File file,String failure); }
    private static final ExecutorService STATE=Executors.newSingleThreadExecutor();
    private static final ExecutorService BROWSE=Executors.newSingleThreadExecutor();
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static volatile PhoneClient client;
    private static final Map<String,Batch> batches=new LinkedHashMap<>();
    private static final Map<String,List<Completion>> observers=new HashMap<>();
    private static final List<Runnable> listeners=new ArrayList<>();
    private static volatile List<JSONObject> snapshot=List.of();
    private static boolean loaded,enumerating;
    private static boolean resumeOffered;
    private static volatile Future<?> enumerationFuture;
    private static volatile String enumeratingId="";
    private static int activeDownloads;
    private static String storageError="";
    private PlaylistRuntime(){}
    public static void capture(PhoneClient value){client=value;}
    public static String url(String id){if(!PlaylistHeaderModel.validId(id))throw new IllegalArgumentException("Invalid playlist identity");return "https://music.youtube.com/playlist?list="+id;}
    /** DEFAULT is left to the original native command. Other modes consume only our own marked action. */
    public static boolean command(CommandBytes command){
        try{
            ProtoWire.Field marker=new ProtoWire(command.toByteArray()).one(PlaylistHeaderModel.MARKER);
            if(marker==null||marker.wire!=2)return false;
            ProtoWire data=new ProtoWire(marker.data);
            String id=new String(data.child(1),StandardCharsets.UTF_8),title=new String(data.child(2),StandardCharsets.UTF_8);
            if(!PlaylistHeaderModel.validId(id)||title.length()>1024)return false;
            DownloadMode mode=Settings.DOWNLOAD_MODE.get();if(mode==DownloadMode.DEFAULT)return false;
            MAIN.post(()->{
                if(mode==DownloadMode.EXTERNAL){Activity a=Utils.getActivity();if(a!=null)ExternalDownloaderPreference.launchExternalDownloader(id,a,url(id));}
                else{start(id,title);PlaylistSettingsPage.showBatches(Utils.getActivity());}
            });return true;
        }catch(Exception malformed){return false;}
    }
    private static File directory(){return new File(Utils.getContext().getFilesDir(),"bdcrusher-offline-playlists");}
    static File audio(String id){
        if(!id.matches("[A-Za-z0-9_-]{11}"))return null;
        File root=new File(Utils.getContext().getExternalFilesDir(Environment.DIRECTORY_MUSIC),"Morphe");
        for(String ext:new String[]{".m4a",".webm"}){File file=new File(root,id+ext);if(file.isFile()&&file.length()>0)return file;}return null;
    }
    public static void init(){if(PersonalRuntime.installed(Utils.getContext(),"playlists"))STATE.execute(()->{load();publish();if(!resumeOffered&&batches.values().stream().anyMatch(b->b.status.startsWith("Interrupted"))){resumeOffered=true;MAIN.post(()->{Activity a=Utils.getActivity();if(a!=null&&!a.isFinishing())new android.app.AlertDialog.Builder(a).setTitle("Resume playlist downloads?").setMessage("An interrupted batch is saved. Review it to resume; completed music is kept.").setNegativeButton("Later",null).setPositiveButton("Review",(d,w)->PlaylistSettingsPage.showBatches(a)).show();});}});}
    private static void load(){
        if(loaded)return;loaded=true;File[] files=directory().listFiles();if(files==null)return;
        for(File f:files){
            if(!f.getName().matches("[A-Za-z0-9_-]{2,150}\\.json")||f.length()>8*1024*1024)continue;
            try(InputStream in=new AtomicFile(f).openRead()){
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[8192];int count;
                while((count=in.read(buffer))!=-1){if(bytes.size()+count>8*1024*1024)throw new IOException("record size");bytes.write(buffer,0,count);}
                JSONObject data=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
                Batch batch=new Batch(data);if(!PlaylistHeaderModel.validId(batch.id)||!f.getName().equals(batch.id+".json"))continue;
                batch.running=false;
                for(int i=0;i<batch.entries.length();i++){JSONObject e=batch.entries.getJSONObject(i);if("downloading".equals(e.optString("state")))e.put("state","queued");}
                batches.put(batch.id,batch);
            }catch(Exception invalid){storageError="An interrupted or unreadable playlist record was kept for recovery";}
        }
    }
    private static final class Batch {
        final String id,title;final JSONArray entries,tokens;String token="",status="Paused";boolean complete,running;volatile long epoch;
        Batch(String id,String title){this.id=id;this.title=title;entries=new JSONArray();tokens=new JSONArray();}
        Batch(JSONObject o)throws JSONException{
            if(o.getInt("schema")!=1)throw new JSONException("schema");id=o.getString("id");title=o.getString("title");entries=o.getJSONArray("entries");tokens=o.optJSONArray("tokens")==null?new JSONArray():o.getJSONArray("tokens");
            token=o.optString("continuation");complete=o.optBoolean("enumerated");status=o.optBoolean("running")?"Interrupted; resume available":o.optString("status","Paused");
            if(entries.length()>100000||tokens.length()>5000)throw new JSONException("size");
        }
        JSONObject json()throws JSONException{return new JSONObject().put("schema",1).put("id",id).put("title",title).put("entries",entries).put("tokens",tokens).put("continuation",token).put("enumerated",complete).put("running",running).put("status",status);}
    }
    private static boolean save(Batch batch){
        AtomicFile atomic=new AtomicFile(new File(directory(),batch.id+".json"));FileOutputStream out=null;
        try{if(!directory().isDirectory()&&!directory().mkdirs())throw new IOException("directory");out=atomic.startWrite();out.write(batch.json().toString().getBytes(StandardCharsets.UTF_8));atomic.finishWrite(out);return true;}
        catch(Exception failure){if(out!=null)atomic.failWrite(out);batch.running=false;batch.status="Storage unavailable; progress has not been discarded";storageError=batch.status;return false;}
    }
    public static void start(String id,String title){STATE.execute(()->{
        load();Batch b=batches.get(id);if(b==null){b=new Batch(id,title);batches.put(id,b);}b.running=true;b.status="Preparing playlist";if(save(b))pump();publish();
    });}
    public static void control(String id,String action){STATE.execute(()->{
        load();Batch b=batches.get(id);if(b==null)return;
        try{
            if(action.equals("pause")||action.equals("cancel")){b.running=false;b.epoch++;Future<?> pending=enumerationFuture;if(id.equals(enumeratingId)&&pending!=null)pending.cancel(true);b.status=action.equals("cancel")?"Cancelled remaining; completed files kept":"Paused; active files finish safely";}
            else{
                if(action.equals("retry"))for(int i=0;i<b.entries.length();i++){JSONObject e=b.entries.getJSONObject(i);if(e.optString("state").equals("failed"))e.put("state","queued").remove("reason");}
                b.running=true;b.status="Resuming";
            }
            if(save(b))pump();publish();
        }catch(JSONException failure){b.running=false;b.status="Playlist record is unreadable";publish();}
    });}
    private static void pump(){
        for(Batch b:batches.values())if(b.running){
            if(!b.complete&&!enumerating){enumerate(b);}
            for(int i=0;i<b.entries.length()&&activeDownloads<2;i++){
                JSONObject e=b.entries.optJSONObject(i);if(e==null||!e.optString("state").equals("queued"))continue;
                String id=e.optString("id");File saved=audio(id);
                try{if(saved!=null){e.put("state","complete");continue;}e.put("state","downloading");}catch(JSONException ignored){continue;}
                activeDownloads++;int index=i;
                Completion callback=(videoId,file,failure)->STATE.execute(()->{
                    activeDownloads--;try{JSONObject entry=b.entries.getJSONObject(index);entry.put("state",file!=null?"complete":"failed");if(file==null)entry.put("reason",failure);}catch(JSONException ignored){}
                    save(b);pump();publish();
                });
                MAIN.post(()->enqueue(id,callback));
            }
            boolean pending=false;int failures=0;
            for(int i=0;i<b.entries.length();i++){JSONObject e=b.entries.optJSONObject(i);if(e==null)continue;String state=e.optString("state");pending|=state.equals("queued")||state.equals("downloading");if(state.equals("failed")||state.equals("unavailable"))failures++;}
            if(b.complete&&!pending){b.running=false;b.status=failures==0?"Complete":"Finished with "+failures+" unavailable or failed entries";}
            else if(b.complete)b.status="Downloading";
            save(b);
        }
    }
    private static void enumerate(Batch b){
        PhoneClient c=client;if(c==null){b.running=false;b.status="Open a playlist in YouTube Music, then resume";return;}
        enumerating=true;enumeratingId=b.id;long epoch=b.epoch;String token=b.token;boolean continued=b.entries.length()>0||!token.isEmpty();b.status="Reading playlist pages";
        BROWSE.execute(()->{
            PlaylistPage page=null;String error="";
            Future<?> future=null;
            try{future=continued?c.bd_playlistContinue(token,BROWSE_CALLBACKS):c.bd_playlistBrowse("VL"+b.id,BROWSE_CALLBACKS);
                enumerationFuture=future;if(epoch!=b.epoch)future.cancel(true);
                Object response=future.get(45,TimeUnit.SECONDS);
                if(!(response instanceof PhoneResponse))throw new IOException("Native playlist response contract unavailable");
                page=PlaylistPage.parse(((PhoneResponse)response).bd_playlistBytes(),b.id,continued);
            }catch(Exception failure){if(future!=null)future.cancel(true);error="Playlist enumeration incomplete ("+failure.getClass().getSimpleName()+"); resume to retry";}
            PlaylistPage result=page;String message=error;
            STATE.execute(()->{
                enumerating=false;enumerationFuture=null;enumeratingId="";if(epoch!=b.epoch){pump();publish();return;}
                if(result==null){b.running=false;b.status=message;save(b);publish();pump();return;}
                try{
                    if(!result.continuation.isEmpty()){
                        for(int i=0;i<b.tokens.length();i++)if(result.continuation.equals(b.tokens.optString(i)))throw new IllegalArgumentException("Repeated continuation");
                        b.tokens.put(result.continuation);
                    }
                    if(b.entries.length()+result.entries.size()>100000||b.tokens.length()>5000)throw new IllegalArgumentException("Playlist limit reached");
                    for(PlaylistPage.Entry entry:result.entries)b.entries.put(new JSONObject().put("id",entry.videoId()).put("title",entry.title()).put("state",entry.reason().isEmpty()?"queued":"unavailable").put("reason",entry.reason()));
                    b.token=result.continuation;b.complete=b.token.isEmpty();
                }catch(Exception invalid){b.running=false;b.status="Playlist enumeration incomplete: "+invalid.getMessage();}
                if(save(b))pump();publish();
            });
        });
    }
    // Host future callbacks must not queue behind the worker waiting for that future.
    private static final Executor BROWSE_CALLBACKS=Runnable::run;
    private static void enqueue(String id,Completion callback){
        File saved=audio(id);if(saved!=null){callback.complete(id,saved,"");return;}
        synchronized(observers){observers.computeIfAbsent(id,k->new ArrayList<>()).add(callback);}
        try{LocalDownloadManager.enqueue(id);}catch(Exception failure){finished(id);}
    }
    /** Injected immediately after the native downloader releases an active recording, on every outcome. */
    public static void finished(String id){
        List<Completion> callbacks;synchronized(observers){callbacks=observers.remove(id);}if(callbacks==null)return;
        File file=audio(id);for(Completion c:callbacks)c.complete(id,file,file==null?"Native downloader could not save this track":"");
    }
    private static void publish(){
        List<JSONObject> list=new ArrayList<>();
        for(Batch b:batches.values())try{JSONObject o=new JSONObject(b.json().toString());o.put("storageError",storageError);list.add(o);}catch(JSONException ignored){}
        snapshot=List.copyOf(list);MAIN.post(()->{for(Runnable listener:List.copyOf(listeners))listener.run();});
    }
    public static List<JSONObject> snapshot(){return snapshot;}
    public static void addListener(Runnable listener){listeners.add(listener);init();}
    public static void removeListener(Runnable listener){listeners.remove(listener);}
    public static void play(Activity activity,JSONObject batch){
        if(activity==null)return;ArrayList<String> queue=new ArrayList<>();JSONArray entries=batch.optJSONArray("entries");if(entries==null)return;
        for(int i=0;i<entries.length();i++){JSONObject e=entries.optJSONObject(i);if(e==null)continue;File f=audio(e.optString("id"));if(f!=null)queue.add(f.getAbsolutePath());}
        if(queue.isEmpty()){Utils.showToastShort("No downloaded entries in this playlist");return;}
        Intent intent=new Intent(activity,app.morphe.extension.music.patches.downloads.OfflinePlaybackService.class);
        intent.setAction(app.morphe.extension.music.patches.downloads.OfflinePlaybackService.ACTION_PLAY_FILE);
        intent.putExtra(app.morphe.extension.music.patches.downloads.OfflinePlaybackService.EXTRA_PATH,queue.get(0));
        intent.putStringArrayListExtra(app.morphe.extension.music.patches.downloads.OfflinePlaybackService.EXTRA_QUEUE,queue);
        intent.putExtra(app.morphe.extension.music.patches.downloads.OfflinePlaybackService.EXTRA_QUEUE_INDEX,0);
        activity.startForegroundService(intent);
    }
}
