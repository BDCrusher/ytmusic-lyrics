/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists;

import android.util.AtomicFile;
import java.io.*;
import java.util.*;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.*;
import app.bdcrusher.ytmusic.common.FeatureDiagnostics;

/** Native-player stream substitution for an exact saved recording. No playlist/queue replacement. */
public final class LocalPlayback {
    public static final String ORIGIN="https://bdcrusher-offline.invalid/audio/",VIDEO_ORIGIN="https://bdcrusher-offline.invalid/video/";
    private static final Set<String> unreadable=java.util.concurrent.ConcurrentHashMap.newKeySet();
    private static final Map<String,Format> network=new java.util.concurrent.ConcurrentHashMap<>();
    private static final Map<String,byte[]> merged=new java.util.concurrent.ConcurrentHashMap<>();
    private static final Set<String> adoptionPending=java.util.concurrent.ConcurrentHashMap.newKeySet();
    private static final Map<String,Long> adoptionAttempted=new java.util.concurrent.ConcurrentHashMap<>();
    private static final Set<String> rejected=java.util.concurrent.ConcurrentHashMap.newKeySet();
    private LocalPlayback(){}
    public static byte[] streams(String id){byte[] local=response(id);if(local==null||!PlaylistBrowse.offline()&&rejected.contains(id))return null;byte[] online=merged.get(id);return !PlaylistBrowse.offline()&&online!=null?online:local;}

    static Format network(String id,boolean video){return PlaylistBrowse.offline()||rejected.contains(id)?null:network.get(id+(video?":video":":audio"));}
    static void unreadable(String id){unreadable.add(id);FeatureDiagnostics.record("Downloads-playback","Saved media unavailable; "+(PlaylistBrowse.offline()?"offline item unavailable":"native stream fallback selected"));}

    private static File formatFile(String id){File audio=PlaylistRuntime.audio(id);return audio==null?null:new File(audio.getParentFile(),id+".format.pb");}
    public static synchronized void saved(String id,Format format,VideoDetails details){
        savedFile(id, format, details, audioFile(id, format));
    }

    public static synchronized void savedFile(String id, Format format, VideoDetails details, File file) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{11}") || file == null
                || !file.equals(audioFile(id, format)) || !file.isFile()) return;
        unreadable.remove(id);
        merged.remove(id);
        File target = new File(file.getParentFile(), id + ".format.pb");
        // Retain initialization/index ranges and codec details. Drop expiring service URLs/ciphers.
        Format local=format.toBuilder().setUrl(ORIGIN+id).setContentLength(file.length()).clearSignatureCipher().build();
        details=details.toBuilder().setVideoId(id).build();
        java.util.List<Format> formats=new java.util.ArrayList<>();formats.add(local);
        byte[] previous=response(id);if(previous!=null)try{for(Format f:PlayerResponse.parseFrom(previous).getStreamingData().getAdaptiveFormatsList())if(f.getMimeType().startsWith("video/")&&DownloadCatalog.video(id)!=null)formats.add(f);}catch(Exception ignored){}
        write(target,PlayerResponse.newBuilder().setVideoDetails(details).setStreamingData(StreamingData.newBuilder().addAllAdaptiveFormats(formats)).build());
    }
    public static synchronized void savedVideo(String id,Format video,VideoDetails details,File file){
        byte[] saved=response(id);if(saved==null)return;try{PlayerResponse prior=PlayerResponse.parseFrom(saved);StreamingData.Builder data=StreamingData.newBuilder();
            for(Format f:prior.getStreamingData().getAdaptiveFormatsList())if(f.getMimeType().startsWith("audio/"))data.addAdaptiveFormats(f);
            data.addAdaptiveFormats(video.toBuilder().setUrl(VIDEO_ORIGIN+id).setContentLength(file.length()).clearSignatureCipher());
            write(formatFile(id),prior.toBuilder().setVideoDetails(details).setStreamingData(data).build());
        }catch(Exception invalid){FeatureDiagnostics.record("Offline-player","Saved video metadata could not be finalized");}
    }
    private static void write(File target,PlayerResponse response){
        if(target==null)return;AtomicFile atomic=new AtomicFile(target);FileOutputStream out=null;
        try{out=atomic.startWrite();out.write(response.toByteArray());atomic.finishWrite(out);NativeMediaCache.prepare("",response.getVideoDetails().getVideoId(),0);}
        catch(Exception failure){if(out!=null)atomic.failWrite(out);FeatureDiagnostics.record("Offline-player","Could not save native format metadata; files kept");}
    }
    public static synchronized byte[] response(String id){
        if(!app.bdcrusher.ytmusic.common.PersonalRuntime.installed(Utils.getContext(),"downloads"))return null;
        if(id==null||!id.matches("[A-Za-z0-9_-]{11}")||unreadable.contains(id))return null;File target=formatFile(id);if(target==null){ExternalFiles.Item external=ExternalFiles.get(id);return external!=null&&ExternalFiles.granted(Utils.getContext())?external.nativeResponse():null;}if(!target.isFile()&&!new File(target+".bak").isFile()||target.length()>256*1024)return null;
        try(InputStream in=new AtomicFile(target).openRead()){
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] b=new byte[8192];int n;while((n=in.read(b))>=0){if(bytes.size()+n>256*1024)return null;bytes.write(b,0,n);}
            PlayerResponse response=PlayerResponse.parseFrom(bytes.toByteArray());if(!id.equals(response.getVideoDetails().getVideoId())||response.getStreamingData().getAdaptiveFormatsCount()<1||response.getStreamingData().getAdaptiveFormatsCount()>2)return null;
            StreamingData.Builder valid=StreamingData.newBuilder();boolean audio=false;
            for(Format format:response.getStreamingData().getAdaptiveFormatsList()){
                boolean video=format.getMimeType().startsWith("video/");File file=video?new File(DownloadCatalog.directory(),id+".video."+(format.getMimeType().contains("webm")?"webm":"mp4")):audioFile(id, format);
                if(file==null||!file.isFile()||file.length()!=format.getContentLength()||!format.getUrl().equals((video?VIDEO_ORIGIN:ORIGIN)+id))continue;
                valid.addAdaptiveFormats(format);if(!video)audio=true;
            }
            return audio?response.toBuilder().setStreamingData(valid).build().toByteArray():null;
        }catch(Exception invalid){FeatureDiagnostics.record("Offline-player","Saved format is unreadable; native network handling retained");return null;}
    }
    static File audioFile(String id, Format format) {
        String extension = format.getMimeType().contains("mp4") ? ".m4a" : ".webm";
        return new File(DownloadCatalog.directory(), id + extension);
    }

    static File playableAudio(String id) {
        if (PlaylistRuntime.audio(id) == null) return null;
        byte[] metadata = response(id);
        if (metadata == null) return null;
        try {
            for (Format format : PlayerResponse.parseFrom(metadata).getStreamingData().getAdaptiveFormatsList()) {
                if (format.getMimeType().startsWith("audio/")) return audioFile(id, format);
            }
        } catch (Exception invalid) {
            return null;
        }
        return null;
    }

    private static void adoptWhenValidated(String id, PlayerResponse online) {
        File file = PlaylistRuntime.audio(id);
        if (file == null || file.length() <= 0) return;
        long revision = file.lastModified();
        if (java.util.Objects.equals(adoptionAttempted.get(id), revision) || !adoptionPending.add(id)) return;
        Utils.runOnBackgroundThread(() -> {
            try {
                java.util.List<Format> candidates = new ArrayList<>();
                for (Format format : online.getStreamingData().getAdaptiveFormatsList()) {
                    if (format.getMimeType().startsWith("audio/") && format.getContentLength() == file.length()
                            && file.equals(audioFile(id, format))) candidates.add(format);
                }
                if (candidates.size() != 1) return;
                Format candidate = candidates.get(0);
                android.media.MediaExtractor extractor = new android.media.MediaExtractor();
                try {
                    extractor.setDataSource(file.getAbsolutePath());
                    if (extractor.getTrackCount() != 1) return;
                    android.media.MediaFormat media = extractor.getTrackFormat(0);
                    String mime = media.getString(android.media.MediaFormat.KEY_MIME);
                    String declared = candidate.getMimeType();
                    boolean opus = declared.contains("opus") && "audio/opus".equals(mime);
                    boolean aac = declared.contains("mp4a") && "audio/mp4a-latm".equals(mime);
                    if ((!opus && !aac) || !media.containsKey(android.media.MediaFormat.KEY_DURATION)) return;
                    long expected = candidate.getApproxDurationMs();
                    long actual = media.getLong(android.media.MediaFormat.KEY_DURATION) / 1000L;
                    if (expected <= 0 || Math.abs(actual - expected) > 1000L) return;
                    extractor.selectTrack(0);
                    if (extractor.readSampleData(java.nio.ByteBuffer.allocate(64 * 1024), 0) <= 0) return;
                    if (file.lastModified() == revision && response(id) == null)
                        savedFile(id, candidate, online.getVideoDetails(), file);
                } finally {
                    extractor.release();
                }
            } catch (Exception invalid) {
                FeatureDiagnostics.record("Downloads-playback", "Could not validate existing audio for native playback");
            } finally {
                if (adoptionAttempted.size() >= 256) adoptionAttempted.clear();
                adoptionAttempted.put(id, revision);
                adoptionPending.remove(id);
            }
        });
    }

    public static long duration(String id){byte[] data=response(id);if(data==null)return 0;try{return PlayerResponse.parseFrom(data).getVideoDetails().getLengthSeconds();}catch(Exception ignored){return 0;}}
    /** Preserve every native response field, including eligibility and metadata, changing only audio streams. */
    public static byte[] replace(byte[] original){
        try{PlayerResponse nativeResponse=PlayerResponse.parseFrom(original);String id=nativeResponse.getVideoDetails().getVideoId();
            if(nativeResponse.hasPlayabilityStatus()&&nativeResponse.getPlayabilityStatus().getStatus()!=Status.OK){rejected.add(id);merged.remove(id);return null;}rejected.remove(id);
            byte[] saved=response(id);
            if(saved==null){adoptWhenValidated(id,nativeResponse);return null;}
            FeatureDiagnostics.record("Downloads-playback","Native player selected saved media; recording="+id+"; metadata=online");
            PlayerResponse local=PlayerResponse.parseFrom(saved);
            for(Format stored:local.getStreamingData().getAdaptiveFormatsList())for(Format online:nativeResponse.getStreamingData().getAdaptiveFormatsList())
                if(stored.getItag()==online.getItag()&&(stored.getContentLength()==online.getContentLength()||online.getContentLength()==0)&&!online.getUrl().isBlank()&&!online.getUrl().startsWith(ORIGIN)&&!online.getUrl().startsWith(VIDEO_ORIGIN))network.put(id+(stored.getMimeType().startsWith("video/")?":video":":audio"),online.getContentLength()==0?online.toBuilder().setContentLength(stored.getContentLength()).build():online);
            // Bound expiring URL references to recent recordings; nothing is written to preferences.
            if(network.size()>64){network.keySet().removeIf(key->!key.startsWith(id+":"));}
            boolean savedVideo=local.getStreamingData().getAdaptiveFormatsList().stream().anyMatch(f->f.getMimeType().startsWith("video/"));
            StreamingData.Builder media=nativeResponse.getStreamingData().toBuilder().clearAdaptiveFormats().clearFormats().clearServerAbrStreamingUrl();
            media.addAllAdaptiveFormats(local.getStreamingData().getAdaptiveFormatsList());
            if(!savedVideo)for(Format online:nativeResponse.getStreamingData().getAdaptiveFormatsList())if(online.getMimeType().startsWith("video/"))media.addAdaptiveFormats(online);
            byte[] result=nativeResponse.toBuilder().setStreamingData(media).build().toByteArray();merged.put(id,result);if(merged.size()>32)merged.keySet().removeIf(key->!key.equals(id));return result;
        }catch(Exception invalid){return null;}
    }
}
