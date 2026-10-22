/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Fixed public origins; no arbitrary URL, credential, cookie or host-key bridge. */
final class LyricsNetwork implements AutoCloseable {
    static final class HttpFailure extends IOException {final int status;HttpFailure(int status){super("HTTP "+status);this.status=status;}}
    static final String BROKER="https://lyrics.api.dacubeking.com/";
    private final Set<HttpURLConnection> connections=ConcurrentHashMap.newKeySet();
    private volatile boolean closed;
    static String encode(String value){try{return URLEncoder.encode(value==null?"":value,"UTF-8");}catch(java.io.UnsupportedEncodingException impossible){throw new AssertionError(impossible);}}
    HttpURLConnection open(String url,String method,String body,String contentType)throws Exception{
        URL parsed=new URL(url);
        if(!"https".equals(parsed.getProtocol())||!java.util.Arrays.asList("lyrics.api.dacubeking.com","api.betterlyrics.org","unison.betterlyrics.org","lrclib.net","translate.googleapis.com").contains(parsed.getHost()))throw new IOException("Unsupported lyrics origin");
        if(closed)throw new IOException("Lyrics request canceled");
        HttpURLConnection connection=(HttpURLConnection)parsed.openConnection();
        connection.setConnectTimeout(8000);connection.setReadTimeout(18000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent","BDCrusher-YTMusic-Lyrics/0.1 (personal Android client)");
        connection.setRequestProperty("Accept","application/json, text/event-stream");connection.setRequestMethod(method);
        connections.add(connection);
        if(closed){release(connection);throw new IOException("Lyrics request canceled");}
        if(body!=null){byte[] bytes=body.getBytes(StandardCharsets.UTF_8);connection.setDoOutput(true);connection.setRequestProperty("Content-Type",contentType);connection.setFixedLengthStreamingMode(bytes.length);try(var out=connection.getOutputStream()){out.write(bytes);}}
        return connection;
    }
    String request(String url,String method,String body,String type)throws Exception{
        HttpURLConnection connection=open(url,method,body,type);
        try{
            int code=connection.getResponseCode();
            if(code!=200)throw new HttpFailure(code);
            try(InputStream input=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                byte[] buffer=new byte[8192];int count,total=0;
                while((count=input.read(buffer))!=-1){total+=count;if(total>4*1024*1024)throw new IOException("Lyrics response too large");if(closed||Thread.currentThread().isInterrupted())throw new IOException("Lyrics request canceled");out.write(buffer,0,count);}
                return new String(out.toByteArray(),StandardCharsets.UTF_8);
            }
        }finally{release(connection);}
    }
    void release(HttpURLConnection connection){connections.remove(connection);connection.disconnect();}
    @Override public void close(){closed=true;for(HttpURLConnection connection:connections)connection.disconnect();connections.clear();}
}
