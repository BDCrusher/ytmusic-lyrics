/* Copyright 2026 BDCrusher. GPL-3.0. Service flow adapted from Better Lyrics Shaders 1.5.1. */
package app.bdcrusher.ytmusic.shaders;
import android.content.*;
import android.net.*;
import android.os.*;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import app.morphe.extension.shared.Logger;

final class ArtworkRepository {
    static final String API="https://artwork.boidu.dev";
    static final ExecutorService io=Executors.newSingleThreadExecutor();
    private static final Map<String,List<Callback>> pending=new HashMap<>();
    private static volatile String activeAlbum="";
    private static volatile HttpURLConnection downloading;
    private static final class DownloadPaused extends IOException {}
    interface Callback{void result(File file,String key);}
    record Track(String id,String song,String artist,String album,int duration){}
    static SharedPreferences preferences(Context c){return c.getSharedPreferences("bdcrusher_shaders",Context.MODE_PRIVATE);}
    static File mediaDirectory(Context c){return new File(c.getCacheDir(),"bdcrusher-shaders-media");}
    static File metadataDirectory(Context c){return new File(c.getFilesDir(),"bdcrusher-shaders-art-metadata");}
    static String digest(String value)throws Exception{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder text=new StringBuilder();for(byte b:bytes)text.append(String.format(Locale.ROOT,"%02x",b&255));return text.toString();}
    static void lookup(Context context,Track track,Callback callback){
        Context c=context.getApplicationContext();String albumKey=track.album().isBlank()?"recording|"+track.id():track.artist()+"|"+track.album();
        if(!albumKey.equals(activeAlbum)){activeAlbum=albumKey;HttpURLConnection previous=downloading;if(previous!=null)previous.disconnect();}
        synchronized(pending){List<Callback> callbacks=pending.get(albumKey);if(callbacks!=null){callbacks.add(callback);return;}callbacks=new ArrayList<>();callbacks.add(callback);pending.put(albumKey,callbacks);}
        io.execute(()->{File result=null;String key="";
            try{
                key=digest(albumKey.isBlank()?track.id():albumKey);File metadata=new File(metadataDirectory(c),key+".json");JSONObject data=read(metadata);
                String stored=data==null?key:data.optString("mediaKey",key);if(!stored.matches("[a-f0-9]{64}"))stored=key;
                File media=new File(mediaDirectory(c),stored+".mp4");
                ArtworkToken.ensure(c);
                if(media.isFile()&&media.length()>0){media.setLastModified(System.currentTimeMillis());result=media;}
                else if(unmeteredWifi(c)){
                    boolean missing=data!=null&&data.optLong("notFoundAt",0)>0&&System.currentTimeMillis()-data.optLong("notFoundAt")<7L*24*60*60*1000;
                    if(!missing){
                        if(data==null||data.optString("videoUrl").isEmpty()){
                            String query="?s="+encode(track.song())+"&a="+encode(track.artist())+"&al="+encode(track.album())+"&d="+track.duration();
                            data=request(API+query,"GET",null,ArtworkToken.usable(c));
                            if(data.optString("videoUrl").isEmpty())data.put("notFoundAt",System.currentTimeMillis());
                            write(metadata,data);
                        }
                        String url=data.optString("videoUrl");
                        if(!url.isEmpty()){
                            URL cover=new URL(url);String coverKey=digest(cover.getHost()+"|"+cover.getPath());media=new File(mediaDirectory(c),coverKey+".mp4");data.put("mediaKey",coverKey);write(metadata,data);
                            if(media.isFile()&&media.length()>0){media.setLastModified(System.currentTimeMillis());result=media;}
                            else{
                            try{download(c,url,media,albumKey);result=media;}
                            catch(Exception stale){if(!(stale instanceof DownloadPaused))metadata.delete();throw stale;}
                            }
                        }
                    }
                }
            }catch(Exception ex){Logger.printDebug(()->"Personal artwork unavailable: "+ex.getClass().getSimpleName());}
            final File ready=result;final String identity=key;List<Callback> callbacks;
            synchronized(pending){callbacks=pending.remove(albumKey);}
            if(callbacks!=null)new Handler(Looper.getMainLooper()).post(()->{for(Callback listener:callbacks)listener.result(ready,identity);});
        });
    }
    private static String encode(String value)throws Exception{return URLEncoder.encode(value==null?"":value,"UTF-8");}
    static boolean unmeteredWifi(Context c){try{ConnectivityManager manager=(ConnectivityManager)c.getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities cap=manager.getNetworkCapabilities(manager.getActiveNetwork());return cap!=null&&cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)&&cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&!manager.isActiveNetworkMetered();}catch(Exception unavailable){return false;}}
    static JSONObject request(String value,String method,JSONObject body,String token)throws Exception{
        URL url=new URL(value);if(!"https".equals(url.getProtocol())||!"artwork.boidu.dev".equals(url.getHost()))throw new IOException("Unsupported artwork origin");
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(8000);connection.setReadTimeout(18000);connection.setInstanceFollowRedirects(false);connection.setRequestMethod(method);
        connection.setRequestProperty("User-Agent","BDCrusher-YTMusic-Artwork/1.0");if(token!=null)connection.setRequestProperty("Authorization","Bearer "+token);
        try{if(body!=null){byte[] data=body.toString().getBytes(StandardCharsets.UTF_8);connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");connection.setFixedLengthStreamingMode(data.length);try(var out=connection.getOutputStream()){out.write(data);}}
            if(connection.getResponseCode()!=200)throw new IOException("Artwork HTTP "+connection.getResponseCode());
            try(var in=connection.getInputStream();var out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int count,total=0;while((count=in.read(b))!=-1){total+=count;if(total>256*1024)throw new IOException("Artwork metadata limit");out.write(b,0,count);}return new JSONObject(out.toString("UTF-8"));}
        }finally{connection.disconnect();}
    }
    static JSONObject read(File file){try{if(!file.isFile()||file.length()>256*1024)return null;return new JSONObject(new String(new AtomicFile(file).readFully(),StandardCharsets.UTF_8));}catch(Exception absent){return null;}}
    static void write(File target,JSONObject data)throws IOException{
        File parent=target.getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Artwork metadata storage unavailable");AtomicFile file=new AtomicFile(target);FileOutputStream out=null;
        try{out=file.startWrite();out.write(data.toString().getBytes(StandardCharsets.UTF_8));file.finishWrite(out);}catch(Exception ex){file.failWrite(out);throw new IOException("Artwork metadata write failed",ex);}
    }
    private static void download(Context c,String value,File destination,String album)throws Exception{
        URL url=new URL(value);if(!"https".equals(url.getProtocol())||!"mvod.itunes.apple.com".equals(url.getHost())||!url.getPath().endsWith(".mp4"))throw new IOException("Unsupported animated cover URL");
        File folder=mediaDirectory(c);if(!folder.isDirectory()&&!folder.mkdirs())throw new IOException("Cover cache unavailable");
        File[] interrupted=folder.listFiles((d,n)->n.matches("[a-f0-9]{64}\\.mp4\\.part"));if(interrupted!=null)for(File old:interrupted)if(!old.delete())throw new IOException("Could not reset interrupted artwork download");
        File part=new File(folder,destination.getName()+".part");long limit=Math.min(128L*1024*1024,Math.max(128,preferences(c).getInt("mediaLimit",512))*1024L*1024/2);
        HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(8000);connection.setReadTimeout(18000);connection.setInstanceFollowRedirects(false);
        downloading=connection;
        try{if(connection.getResponseCode()!=200)throw new IOException("Cover HTTP "+connection.getResponseCode());long expected=connection.getContentLengthLong();if(expected>limit)throw new IOException("Cover exceeds cache budget");
            try(var in=connection.getInputStream();var out=new FileOutputStream(part)){byte[] bytes=new byte[65536];int count;long total=0;while((count=in.read(bytes))!=-1){if(!unmeteredWifi(c)||!album.equals(activeAlbum))throw new DownloadPaused();total+=count;if(total>limit)throw new IOException("Cover download limit");out.write(bytes,0,count);}out.getFD().sync();if(total==0||expected>=0&&total!=expected)throw new IOException("Incomplete cover download");}
            android.media.MediaMetadataRetriever media=new android.media.MediaMetadataRetriever();try{media.setDataSource(part.getPath());if(media.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)==null)throw new IOException("Invalid cover video");}finally{media.release();}
            if(!part.renameTo(destination))throw new IOException("Could not commit cover");evict(c,destination);
        }finally{connection.disconnect();if(downloading==connection)downloading=null;if(part.isFile())part.delete();}
    }
    static void invalidate(Context c,String key){if(key==null||!key.matches("[a-f0-9]{64}"))return;io.execute(()->{File metadata=new File(metadataDirectory(c),key+".json");JSONObject data=read(metadata);String media=data==null?key:data.optString("mediaKey",key);if(media.matches("[a-f0-9]{64}"))new File(mediaDirectory(c),media+".mp4").delete();metadata.delete();});}
    static void trim(Context c){io.execute(()->evict(c,null));}
    private static void evict(Context c,File keep){File[] files=mediaDirectory(c).listFiles((d,n)->n.matches("[a-f0-9]{64}\\.mp4"));if(files==null)return;Arrays.sort(files,Comparator.comparingLong(File::lastModified));long total=0;for(File f:files)total+=f.length();long cap=Math.max(128,Math.min(2048,preferences(c).getInt("mediaLimit",512)))*1024L*1024;for(File f:files){if(total<=cap)break;if(f.equals(keep))continue;long bytes=f.length();if(f.delete())total-=bytes;}}
    static void clear(Context c,Runnable done){io.execute(()->{for(File folder:new File[]{mediaDirectory(c),metadataDirectory(c)}){File[] files=folder.listFiles((d,n)->n.matches("[a-f0-9]{64}\\.(?:mp4|json)(?:\\.part|\\.bak|\\.new)?"));if(files!=null)for(File f:files)f.delete();}new Handler(Looper.getMainLooper()).post(done);});}
}
