/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import android.content.Context;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import app.morphe.extension.music.patches.lyrics.model.TrackInfo;

/** Native transport for the extension provider pipeline; all outcomes have bounded diagnostics. */
final class LyricsCatalog implements AutoCloseable {
    interface Sink {void result(JSONObject payload);void notice(String message,boolean finished);default void reconnect(){}}
    private final LyricsNetwork network=new LyricsNetwork();
    private final ExecutorService executor=Executors.newFixedThreadPool(4);
    private final AtomicInteger remaining=new AtomicInteger(1);
    private final java.util.Set<String> requested=ConcurrentHashMap.newKeySet();
    private volatile boolean closed,connectionNeeded;
    private final Context context;private final String videoId;private final boolean refresh;
    private final LyricsDiskCache cache;private final Sink sink;
    LyricsCatalog(Context context,TrackInfo track,String videoId,boolean refresh,Sink sink){
        this.context=context;this.videoId=videoId;this.refresh=refresh;this.sink=sink;cache=new LyricsDiskCache(context);
        TrackInfo normalized=new TrackInfo(clean(track.title()),clean(track.artist()).replace(", & ",", "),clean(track.album()),track.durationSeconds());
        LyricsDiagnostics.record("track","video="+videoId+"; title="+normalized.title()+"; artist="+normalized.artist()+"; album="+normalized.album()+"; duration="+normalized.durationSeconds());
        direct(normalized);
        task("Unison",()->unison(normalized));
        String jwt=LyricsConfig.preferences(context).getString("serviceJwt","");
        if(!jwt.isEmpty()&&ServiceConnection.expired(jwt)){connectionNeeded=true;LyricsConfig.preferences(context).edit().remove("serviceJwt").apply();LyricsDiagnostics.record("Combined service","Stored connection expired; normal verification required");sink.reconnect();}
        else if(!jwt.isEmpty())task("Combined service",()->stream(normalized,jwt));
        else{connectionNeeded=true;sink.notice("Connect sources to enable the combined Better Lyrics service",false);}
        finished();
    }
    private static String clean(String value){return value==null?"":value.trim();}
    private void unison(TrackInfo t)throws Exception{
        String base="https://unison.betterlyrics.org/lyrics?v="+LyricsNetwork.encode(videoId);
        JSONObject response;
        try{
            // Recording identity first: video titles and uploader names can differ from catalog metadata.
            response=new JSONObject(network.request(base,"GET",null,null));
        }catch(LyricsNetwork.HttpFailure ex){
            if(ex.status!=404)throw ex;
            String url=base+"&song="+LyricsNetwork.encode(t.title())+"&artist="+LyricsNetwork.encode(t.artist());
            if(t.durationSeconds()>0)url+="&duration="+t.durationSeconds();
            if(!t.album().isEmpty())url+="&album="+LyricsNetwork.encode(t.album());
            response=new JSONObject(network.request(url,"GET",null,null));
        }
        JSONObject data=response.optJSONObject("data");
        if(data==null||data.optString("lyrics").isEmpty()){LyricsDiagnostics.record("Unison","No usable lyrics");return;}
        String found=data.optString("videoId");boolean exact=videoId.equals(found);
        LyricsDiagnostics.record("Unison","HTTP 200; recording="+found+"; exact="+exact+"; format="+data.optString("format")+"; chars="+data.optString("lyrics").length());
        send(new JSONObject().put("kind","unison").put("data",response).put("recordingVideoId",found).put("recordingMatched",exact));
    }
    private String query(TrackInfo t){
        String q="s="+LyricsNetwork.encode(t.title())+"&a="+LyricsNetwork.encode(t.artist());
        if(!t.album().isEmpty())q+="&al="+LyricsNetwork.encode(t.album());if(t.durationSeconds()>0)q+="&d="+t.durationSeconds();return q;
    }
    private void direct(TrackInfo t){
        String q=query(t);if(!requested.add(q)||closed)return;
        String cacheKey="v2|"+videoId+"|"+q;
        task("Better Lyrics",()->{
            JSONObject cached=refresh?null:cache.get(cacheKey+"|ttml");if(cached!=null){LyricsDiagnostics.record("Better Lyrics","Positive cache");send(cached);return;}
            JSONObject data=new JSONObject(network.request("https://api.betterlyrics.org/getLyrics?"+q,"GET",null,null));String raw=data.optString("ttml");
            if(raw.isEmpty()){LyricsDiagnostics.record("Better Lyrics","No TTML in response");return;}
            JSONObject payload=new JSONObject().put("key","bLyrics-richsynced").put("source","Better Lyrics").put("format","ttml").put("raw",raw);
            cache.put(cacheKey+"|ttml",payload);send(payload);LyricsDiagnostics.record("Better Lyrics","HTTP 200; TTML chars="+raw.length());
        });
        task("LRCLib",()->{
            JSONObject cached=refresh?null:cache.get(cacheKey+"|lrclib");if(cached!=null){send(cached);return;}
            String url="https://lrclib.net/api/get?track_name="+LyricsNetwork.encode(t.title())+"&artist_name="+LyricsNetwork.encode(t.artist());
            if(!t.album().isEmpty())url+="&album_name="+LyricsNetwork.encode(t.album());if(t.durationSeconds()>0)url+="&duration="+t.durationSeconds();
            JSONObject data=new JSONObject(network.request(url,"GET",null,null));
            if(!data.isNull("syncedLyrics")&&!data.optString("syncedLyrics").isEmpty()){
                JSONObject payload=new JSONObject().put("key","lrclib-synced").put("source","LRCLib").put("format","lrc").put("raw",data.getString("syncedLyrics"));cache.put(cacheKey+"|lrclib",payload);send(payload);
            }
            if(!data.isNull("plainLyrics")&&!data.optString("plainLyrics").isEmpty())send(new JSONObject().put("key","lrclib-plain").put("source","LRCLib").put("format","plain").put("raw",data.getString("plainLyrics")));
        });
    }
    interface Work {void run()throws Exception;}
    private void task(String source,Work work){
        if(closed)return;remaining.incrementAndGet();
        try{executor.execute(()->{try{if(!closed)work.run();}catch(LyricsNetwork.HttpFailure ex){
            String result=ex.status==404?"Not found":ex.status==401?"Service authorization required":ex.status==403?"Access denied":ex.status==429?"Rate limited":"HTTP "+ex.status;
            LyricsDiagnostics.record(source,result);if(ex.status!=404&&!closed)sink.notice(source+" unavailable: "+result,false);
        }catch(Exception ex){if(!closed){LyricsDiagnostics.record(source,"Failed: "+ex.getClass().getSimpleName());sink.notice(source+" lookup failed",false);}}finally{finished();}});
        }catch(RejectedExecutionException canceled){finished();}
    }
    private void finished(){if(remaining.decrementAndGet()==0&&!closed)sink.notice(connectionNeeded?"Connect sources to enable or renew the combined service":"Source lookup complete",true);}
    private void send(JSONObject payload){if(!closed)sink.result(payload);}
    private void event(String event,JSONObject data)throws Exception{
        if("metadata".equals(event)){
            String song=data.optString("song"),artist=data.optString("artist");
            if(!song.isEmpty()&&!artist.isEmpty()){
                TrackInfo corrected=new TrackInfo(clean(song),clean(artist).replace(", & ",", "),clean(data.optString("album")),data.optInt("duration",0));
                LyricsDiagnostics.record("metadata","title="+corrected.title()+"; artist="+corrected.artist()+"; album="+corrected.album()+"; duration="+corrected.durationSeconds());
                direct(corrected);
            }
        }
        if("provider".equals(event))LyricsDiagnostics.record("Combined service","Provider "+data.optString("provider")+" received");
        send(new JSONObject().put("event",event).put("data",data));
    }
    private void stream(TrackInfo track,String jwt)throws Exception{
        String body="videoId="+LyricsNetwork.encode(videoId)+"&song="+LyricsNetwork.encode(track.title())+"&artist="+LyricsNetwork.encode(track.artist())+"&alwaysFetchMetadata=true&token="+LyricsNetwork.encode(jwt);
        if(!track.album().isEmpty())body+="&album="+LyricsNetwork.encode(track.album());if(track.durationSeconds()>0)body+="&duration="+track.durationSeconds();
        HttpURLConnection connection=network.open(LyricsNetwork.BROKER+"v2/lyrics","POST",body,"application/x-www-form-urlencoded");
        try{
            int status=connection.getResponseCode();
            if(status==403){connectionNeeded=true;LyricsConfig.preferences(context).edit().remove("serviceJwt").apply();LyricsDiagnostics.record("Combined service","Connection rejected or expired; normal verification required");sink.notice("Source connection expired — connect again",false);sink.reconnect();return;}
            if(status!=200)throw new LyricsNetwork.HttpFailure(status);
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream(),StandardCharsets.UTF_8))){
                String line,event="";StringBuilder data=new StringBuilder();int total=0;
                while(!closed&&(line=reader.readLine())!=null){
                    total+=line.length();if(total>6*1024*1024)throw new IOException("Stream too large");
                    if(line.isEmpty()){if(data.length()>0){event(event,new JSONObject(data.toString()));data.setLength(0);}event="";}
                    else if(line.startsWith("event:"))event=line.substring(6).trim();
                    else if(line.startsWith("data:")){if(data.length()>0)data.append('\n');data.append(line.substring(5).trim());}
                }
                if(data.length()>0&&!closed)event(event,new JSONObject(data.toString()));
            }
        }finally{network.release(connection);}
    }
    @Override public void close(){closed=true;network.close();executor.shutdownNow();}
}

