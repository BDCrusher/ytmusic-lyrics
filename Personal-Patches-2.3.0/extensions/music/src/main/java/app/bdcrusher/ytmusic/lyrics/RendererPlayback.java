/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.media.session.PlaybackState;
import android.os.SystemClock;
import app.morphe.extension.music.shared.VideoInformation;

/** Personal renderer clock. Official/native lyric clocks and runtime classes are unchanged. */
public final class RendererPlayback {
    private static final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private static String video="";
    private static long position,at,lastSample,revision;
    private static float rate=1;
    private static boolean playing,initialized;
    private static long lastTransition;
    private RendererPlayback(){}
    public static synchronized void sample(PlaybackState state){
        if(state==null||state.getPosition()<0)return;
        String id=VideoInformation.getVideoId();if(id==null||id.isEmpty())return;
        long now=SystemClock.elapsedRealtime(),stamp=state.getLastPositionUpdateTime();
        if(stamp<=0||stamp>now)stamp=now;
        boolean sameRecording = initialized && id.equals(video);
        if(sameRecording&&stamp<lastSample)return;
        float speed=state.getPlaybackSpeed();if(!(speed>0)||Float.isInfinite(speed))speed=rate;
        boolean nextPlaying=state.getState()==PlaybackState.STATE_PLAYING;
        boolean transition=nextPlaying!=playing;
        long reported=state.getPosition();
        long previous=read(stamp);
        long anchor=PlaybackTransition.anchor(reported,previous,sameRecording,transition);
        // A second stale paused callback must not undo the boundary correction.
        if(sameRecording&&!transition&&!nextPlaying&&stamp-lastTransition<1000
                &&previous>reported&&previous-reported<=750)anchor=previous;
        long next=anchor+(nextPlaying?(long)((now-stamp)*speed):0);
        long predicted=read(now);
        boolean resync=!sameRecording||transition||speed!=rate||Math.abs(next-predicted)>240;
        if(resync||!nextPlaying&&Math.abs(next-predicted)>30)revision++;
        if(initialized&&(!id.equals(video)||Math.abs(next-predicted)>750))LyricsDiagnostics.record("Clock-correction","recordingChanged="+!id.equals(video)+" driftMs="+(next-predicted)+" revision="+revision);
        video=id;position=next;at=now;lastSample=stamp;playing=nextPlaying;rate=speed;initialized=true;
        if(transition||!sameRecording)lastTransition=stamp;
        if(resync) main.post(() -> {
            NativeLyricsHost.playbackChanged();
            PersonalLyricsTab.playbackChanged();
        });
    }
    private static long read(long now){return position+(playing?(long)(Math.max(0,now-at)*rate):0);}
    static synchronized long[] snapshot(String id,long fallback,boolean fallbackPlaying,float fallbackRate){
        if(!initialized||!video.equals(id))return new long[]{fallback,fallbackPlaying?1:0,Float.floatToIntBits(fallbackRate),revision};
        return new long[]{read(SystemClock.elapsedRealtime()),playing?1:0,Float.floatToIntBits(rate),revision};
    }
    static synchronized void seek(String id,long target){
        if(initialized&&video.equals(id)){LyricsDiagnostics.record("Seek","positionMs="+target+" revision="+(revision+1));position=target;at=SystemClock.elapsedRealtime();lastSample=at;revision++;}
    }
}
