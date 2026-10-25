/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import android.content.Context;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.*;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import app.morphe.extension.music.patches.lyrics.model.TrackInfo;

/** Native transport for the extension provider pipeline; all outcomes have bounded diagnostics. */
final class LyricsCatalog implements AutoCloseable {
    interface Sink {void result(JSONObject payload);void notice(String message,boolean finished);default void reconnect(){}default void completion(boolean definitelyNotFound){}}
    private final LyricsNetwork network=new LyricsNetwork();
    private final ExecutorService executor=Executors.newFixedThreadPool(4);
    private final AtomicInteger remaining=new AtomicInteger(1);
    private final java.util.Set<String> requested=ConcurrentHashMap.newKeySet();
    private final AtomicBoolean resultSeen=new AtomicBoolean(),lookupFailed=new AtomicBoolean();
    private volatile boolean closed,connectionNeeded;
    private final Context context;private final String videoId;private final boolean refresh;
    private final LyricsDiskCache cache;private final Sink sink;
    private final TrackInfo normalized;
    private final java.util.Set<String> connectionTokens=ConcurrentHashMap.newKeySet();
    private final java.util.Set<String> delivered=ConcurrentHashMap.newKeySet();
    LyricsCatalog(Context context,TrackInfo track,String videoId,boolean refresh,Sink sink){
        this.context=context;this.videoId=videoId;this.refresh=refresh;this.sink=sink;cache=new LyricsDiskCache(context);
        normalized=new TrackInfo(LyricsLookup.title(track.title()),LyricsLookup.artist(track.artist()),clean(track.album()),track.durationSeconds());
        LyricsDiagnostics.record("track","video="+videoId+"; title="+normalized.title()+"; artist="+normalized.artist()+"; album="+normalized.album()+"; duration="+normalized.durationSeconds());
        direct(normalized);
        task("Unison",()->unison(normalized));
        connectionChanged();
        finished();
    }
    synchronized void connectionChanged(){
        if(closed)return;
        String jwt=LyricsConfig.preferences(context).getString("serviceJwt","");
        if(jwt.isEmpty()||ServiceConnection.expired(jwt)){
            connectionNeeded=true;sink.notice("Additional sources are verifying automatically; Connect sources is available if interaction is needed",false);return;
        }
        if(connectionTokens.size()>=8||!connectionTokens.add(jwt))return;
        connectionNeeded=false;
        sink.notice("Loading additional lyric sources",false);
        task("Combined service",()->stream(normalized,jwt));
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
        String q=query(t);if(requested.size()>=4||!requested.add(q)||closed)return;
        String cacheKey="v2|"+videoId+"|"+q;
        task("Better Lyrics",()->{
            JSONObject cached=refresh?null:cache.get(cacheKey+"|ttml");if(cached!=null){LyricsDiagnostics.record("Better Lyrics","Positive cache");send(cached);return;}
            String relaxed="s="+LyricsNetwork.encode(t.title())+"&a="+LyricsNetwork.encode(t.artist());
            boolean retried=false;JSONObject data;
            try{data=new JSONObject(network.request("https://api.betterlyrics.org/getLyrics?"+q,"GET",null,null));}
            catch(LyricsNetwork.HttpFailure ex){if(ex.status!=404||q.equals(relaxed))throw ex;retried=true;LyricsDiagnostics.record("Better Lyrics","Exact metadata not found; retrying title and artist without album/duration");data=new JSONObject(network.request("https://api.betterlyrics.org/getLyrics?"+relaxed,"GET",null,null));}
            String raw=data.optString("ttml");
            if(raw.isEmpty()&&!retried&&!q.equals(relaxed)){retried=true;LyricsDiagnostics.record("Better Lyrics","Empty exact result; retrying title and artist without album/duration");data=new JSONObject(network.request("https://api.betterlyrics.org/getLyrics?"+relaxed,"GET",null,null));raw=data.optString("ttml");}
            if(raw.isEmpty()){LyricsDiagnostics.record("Better Lyrics","No TTML in response");return;}
            JSONObject payload=new JSONObject().put("key","bLyrics-richsynced").put("source","Better Lyrics").put("format","ttml").put("raw",raw).put("relaxedMetadata",retried);
            cache.put(cacheKey+"|ttml",payload);send(payload);LyricsDiagnostics.record("Better Lyrics","HTTP 200; TTML chars="+raw.length());
        });
        task("LRCLib",()->{
            JSONObject cached=refresh?null:cache.get(cacheKey+"|lrclib");if(cached!=null){send(cached);return;}
            String url="https://lrclib.net/api/get?track_name="+LyricsNetwork.encode(t.title())+"&artist_name="+LyricsNetwork.encode(t.artist());
            if(!t.album().isEmpty())url+="&album_name="+LyricsNetwork.encode(t.album());if(t.durationSeconds()>0)url+="&duration="+t.durationSeconds();
            JSONObject data;
            try{data=new JSONObject(network.request(url,"GET",null,null));}
            catch(LyricsNetwork.HttpFailure ex){if(ex.status!=404)throw ex;data=new JSONObject();}
            if(data.optString("syncedLyrics").trim().isEmpty()&&data.optString("plainLyrics").trim().isEmpty()){
                String search="https://lrclib.net/api/search?track_name="+LyricsNetwork.encode(t.title())+"&artist_name="+LyricsNetwork.encode(t.artist());
                data=LyricsLookup.best(new JSONArray(network.request(search,"GET",null,null)),t.title(),t.artist(),t.durationSeconds());
                if(data==null){LyricsDiagnostics.record("LRCLib","No exact title/artist/duration candidate");return;}
                LyricsDiagnostics.record("LRCLib","Search recovered an exact title/artist match"+(t.durationSeconds()>0?" within 2 seconds":"; duration unknown"));
            }
            if(!data.isNull("syncedLyrics")&&!data.optString("syncedLyrics").isEmpty()){
                JSONObject payload=new JSONObject().put("key","lrclib-synced").put("source","LRCLib").put("format","lrc").put("raw",data.getString("syncedLyrics"));cache.put(cacheKey+"|lrclib",payload);send(payload);
            }
            if(!data.isNull("plainLyrics")&&!data.optString("plainLyrics").isEmpty())send(new JSONObject().put("key","lrclib-plain").put("source","LRCLib").put("format","plain").put("raw",data.getString("plainLyrics")));
        });
    }
    interface Work {void run()throws Exception;}
    private void task(String source,Work work){
        if(closed)return;remaining.incrementAndGet();
        try{executor.execute(()->{try{for(int attempt=1;!closed;attempt++){
            try{work.run();break;}catch(Exception failure){long delay=LyricsRetry.delay(failure,attempt);if(delay<0||closed||Thread.currentThread().isInterrupted())throw failure;
                LyricsDiagnostics.record(source,"Temporary failure; retry "+(attempt+1)+"/3 in "+delay+" ms");
                Thread.sleep(delay);
            }
        }}catch(LyricsNetwork.HttpFailure ex){
            if(ex.status!=404)lookupFailed.set(true);
            String result=ex.status==404?"Not found":ex.status==401?"Service authorization required":ex.status==403?"Access denied":ex.status==429?"Rate limited":"HTTP "+ex.status;
            LyricsDiagnostics.record(source,result);if(ex.status!=404&&!closed)sink.notice(source+" unavailable: "+result,false);
        }catch(Exception ex){lookupFailed.set(true);if(!closed){LyricsDiagnostics.record(source,"Failed: "+ex.getClass().getSimpleName());sink.notice(source+" lookup failed",false);}}finally{finished();}});
        }catch(RejectedExecutionException canceled){finished();}
    }
    private void finished(){if(remaining.decrementAndGet()==0&&!closed){sink.completion(!resultSeen.get()&&!lookupFailed.get()&&!connectionNeeded);sink.notice(connectionNeeded?"Connect sources to enable or renew the combined service":lookupFailed.get()?"Some sources failed; available lyrics have been kept":"Source lookup complete",true);}}
    private void send(JSONObject payload){if(!closed){
        try{String hash=java.util.Base64.getEncoder().encodeToString(java.security.MessageDigest.getInstance("SHA-256").digest(payload.toString().getBytes(StandardCharsets.UTF_8)));if(delivered.contains(hash))return;if(delivered.size()<256)delivered.add(hash);}
        catch(java.security.NoSuchAlgorithmException impossible){throw new AssertionError(impossible);}
        if(hasLyricsPayload(payload))resultSeen.set(true);sink.result(payload);
    }}
    static boolean hasLyricsPayload(JSONObject payload){
        if(!payload.optString("raw").trim().isEmpty())return true;
        if("unison".equals(payload.optString("kind"))){JSONObject data=payload.optJSONObject("data");if(data!=null&&data.optJSONObject("data")!=null)data=data.optJSONObject("data");return data!=null&&!data.optString("lyrics").trim().isEmpty();}
        if(!"provider".equals(payload.optString("event")))return false;
        JSONObject data=payload.optJSONObject("data"),results=data==null?null:data.optJSONObject("results");if(results==null)return false;
        for(String key:new String[]{"lyrics","synced","plain","wordByWord"})if(!results.optString(key).trim().isEmpty())return true;
        return false;
    }
    private void event(String event,JSONObject data)throws Exception{
        if("metadata".equals(event)){
            String song=data.optString("song"),artist=data.optString("artist");
            if(!song.isEmpty()&&!artist.isEmpty()){
                TrackInfo corrected=new TrackInfo(LyricsLookup.title(song),LyricsLookup.artist(artist),clean(data.optString("album")),data.optInt("duration",0));
                LyricsDiagnostics.record("metadata","title="+corrected.title()+"; artist="+corrected.artist()+"; album="+corrected.album()+"; duration="+corrected.durationSeconds());
                direct(corrected);
            }
        }
        if("provider".equals(event)){
            LyricsDiagnostics.record("Combined service","Provider "+data.optString("provider")+" received");
        }
        send(new JSONObject().put("event",event).put("data",data));
    }
    private void stream(TrackInfo track,String jwt)throws Exception{
        String body="videoId="+LyricsNetwork.encode(videoId)+"&song="+LyricsNetwork.encode(track.title())+"&artist="+LyricsNetwork.encode(track.artist())+"&alwaysFetchMetadata=true&token="+LyricsNetwork.encode(jwt);
        if(!track.album().isEmpty())body+="&album="+LyricsNetwork.encode(track.album());if(track.durationSeconds()>0)body+="&duration="+track.durationSeconds();
        HttpURLConnection connection=network.open(LyricsNetwork.BROKER+"v2/lyrics","POST",body,"application/x-www-form-urlencoded");
        try{
            int status=connection.getResponseCode();
            if(status==403){if(!jwt.equals(LyricsConfig.preferences(context).getString("serviceJwt","")))return;connectionNeeded=true;LyricsConfig.preferences(context).edit().remove("serviceJwt").apply();LyricsDiagnostics.record("Combined service","Connection rejected; automatic normal verification requested");sink.notice("Source verification is renewing; Connect sources if interaction is needed",false);sink.reconnect();return;}
            if(status!=200)throw new LyricsNetwork.HttpFailure(status,connection.getHeaderField("Retry-After"));
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(connection.getInputStream(),StandardCharsets.UTF_8))){
                String line,event="";StringBuilder data=new StringBuilder();int total=0;boolean providerFailed=false;
                while(!closed&&(line=reader.readLine())!=null){
                    total+=line.length();if(total>6*1024*1024)throw new LyricsNetwork.PayloadLimit();
                    if(line.isEmpty()){if(data.length()>0){providerFailed|=streamEvent(event,data.toString());data.setLength(0);}event="";}
                    else if(line.startsWith("event:"))event=line.substring(6).trim();
                    else if(line.startsWith("data:")){if(data.length()>0)data.append('\n');data.append(line.substring(5).trim());}
                }
                if(data.length()>0&&!closed)providerFailed|=streamEvent(event,data.toString());
                if(providerFailed&&!closed)throw new IOException("Provider reported a temporary failure");
            }
        }finally{network.release(connection);}
    }
    private boolean streamEvent(String event,String raw)throws Exception{
        if("[DONE]".equals(raw.trim()))return false;
        JSONObject data;
        try{data=new JSONObject(raw);}catch(org.json.JSONException malformed){lookupFailed.set(true);LyricsDiagnostics.record("Combined service","Invalid stream event skipped; other sources continue");return false;}
        event(event,data);
        if(("provider".equals(event)&&!data.isNull("error")&&!data.optString("error").isEmpty())||"error".equals(event)){
            int status=data.optInt("status",0);String error=data.optString("error","").toLowerCase(java.util.Locale.ROOT);
            if(status==401||status==403||status==404||error.contains("not found")||error.contains("unauthoriz")||error.contains("forbidden")){lookupFailed.set(true);return false;}
            return status==0||status==408||status==429||status>=500;
        }
        return false;
    }
    @Override public void close(){closed=true;network.close();executor.shutdownNow();}
}

