/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import app.morphe.extension.music.patches.lyrics.model.TrackInfo;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/** One current-track lookup, independent of views. All state and subscribers live on main. */
final class LyricsRepository {
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final List<LyricsCatalog.Sink> sinks = new ArrayList<>();
    private static final List<JSONObject> results = new ArrayList<>();
    private static LyricsCatalog catalog;
    private static String identity = "", notice = "";
    private static int generation;
    private static boolean finished;
    private static Boolean definitelyNotFound;
    private static JSONObject health;

    static String identity(TrackInfo track, String id) {
        return id + "\u0000" + track.title() + "\u0000" + track.artist() + "\u0000"
                + track.durationSeconds() + "\u0000" + track.album();
    }

    static void ensure(Context context, TrackInfo track, String id, boolean refresh) {
        String next = identity(track, id);
        if (!refresh && next.equals(identity)) return;
        clear();
        identity = next;
        int expected = generation;
        catalog = new LyricsCatalog(context.getApplicationContext(), track, id, refresh, new LyricsCatalog.Sink() {
            public void health(JSONObject value){main.post(()->{if(expected!=generation)return;health=value;for(var sink:new ArrayList<>(sinks))sink.health(value);});}
            public void result(JSONObject payload) { main.post(() -> {
                if (expected != generation) return;
                if (results.size() < 64) results.add(payload);
                for (var sink : new ArrayList<>(sinks)) sink.result(payload);
            }); }
            public void notice(String message, boolean done) { main.post(() -> {
                if (expected != generation) return;
                notice = message; finished = done;
                for (var sink : new ArrayList<>(sinks)) sink.notice(message, done);
            }); }
            public void reconnect() { main.post(() -> {
                if (expected == generation) for (var sink : new ArrayList<>(sinks)) sink.reconnect();
            }); }
            public void completion(boolean notFound){main.post(()->{if(expected!=generation)return;definitelyNotFound=notFound;for(var sink:new ArrayList<>(sinks))sink.completion(notFound);});}
        });
    }

    static void connectionChanged() { if(catalog!=null)catalog.connectionChanged(); }

    static void subscribe(LyricsCatalog.Sink sink) {
        if (sinks.contains(sink)) return;
        sinks.add(sink);
        for (var payload : new ArrayList<>(results)) sink.result(payload);
        if(health!=null)sink.health(health);
        if(definitelyNotFound!=null)sink.completion(definitelyNotFound);
        if (!notice.isEmpty()) sink.notice(notice, finished);
    }

    static void unsubscribe(LyricsCatalog.Sink sink) { sinks.remove(sink); }

    static void clear() {
        generation++;
        if (catalog != null) catalog.close();
        catalog = null; identity = ""; results.clear(); sinks.clear(); notice = ""; finished = false;definitelyNotFound=null;health=null;
    }
}
