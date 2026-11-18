/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import java.util.*;
import app.morphe.extension.shared.Utils;
import app.bdcrusher.ytmusic.common.FeatureDiagnostics;

/** Every entry opens the native Music watch flow, never the legacy file player. */
public final class NativePlayback {
    private NativePlayback(){}
    public static void open(String id){
        open(id, "", -1);
    }
    static boolean sourceId(String id) {
        return id != null && (PlaylistHeaderModel.validId(id)
                || id.matches("(?:OLAK5uy_|RD)[A-Za-z0-9_-]{8,120}"));
    }
    public static boolean canOpen(String id,String playlist,int position){
        if(!PlaylistBrowse.offline())return true;
        String source=sourceId(playlist)?playlist:"";
        return NativeMediaCache.ready(source,id,source.isEmpty()?0:Math.max(0,position));
    }
    public static void open(String id,String playlist,int position){
        if(id==null||!id.matches("[A-Za-z0-9_-]{11}"))return;Activity activity=Utils.getActivity();if(activity==null)return;
        if (!canOpen(id, playlist, position)) {
            Utils.showToastShort("This recording is unavailable offline");
            return;
        }
        Uri.Builder uri=Uri.parse("https://music.youtube.com/watch").buildUpon().appendQueryParameter("v",id);
        if(sourceId(playlist)){uri.appendQueryParameter("list",playlist);if(position>=0)uri.appendQueryParameter("index",Integer.toString(position));}
        final Uri target=uri.build();Utils.runOnMainThread(()->{try{
            activity.startActivity(new Intent(Intent.ACTION_VIEW,target).setPackage(activity.getPackageName()));
            FeatureDiagnostics.record("Downloads-playback","Native watch opened; saved="+(LocalPlayback.response(id)!=null)+"; playlist="+sourceId(playlist));
        }catch(RuntimeException failure){Utils.showToastShort("Could not open the native music player");FeatureDiagnostics.record("Downloads-playback",failure.getClass().getSimpleName());}});
    }
}
