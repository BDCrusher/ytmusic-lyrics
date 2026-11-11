/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists;
import android.app.*;
import android.content.Context;
import android.preference.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import app.bdcrusher.ytmusic.common.PersonalRuntime;
import app.bdcrusher.ytmusic.lyrics.StoragePreference;

@SuppressWarnings("deprecation")
public final class PlaylistSettingsPage {
    private static final java.util.List<java.lang.ref.WeakReference<Preference>> folderRows=new java.util.ArrayList<>();
    private PlaylistSettingsPage(){}
    static void folderChanged(){new android.os.Handler(android.os.Looper.getMainLooper()).post(()->{folderRows.removeIf(ref->ref.get()==null);for(var ref:folderRows){Preference row=ref.get();if(row!=null)row.setSummary("Read-only access; files are matched by [video ID]. "+ExternalFiles.status());}});}
    static void trackFolder(Preference folder) {
        folderRows.add(new java.lang.ref.WeakReference<>(folder));
    }

    public static void showBatches(Activity activity){
        if(activity==null||activity.isFinishing())return;
        ScrollView scroll=new ScrollView(activity);LinearLayout list=new LinearLayout(activity);list.setOrientation(LinearLayout.VERTICAL);int pad=(int)(16*activity.getResources().getDisplayMetrics().density);list.setPadding(pad,pad,pad,pad);scroll.addView(list);
        AlertDialog dialog=new AlertDialog.Builder(activity).setTitle("Offline playlists").setView(scroll).setNegativeButton("Close",null).create();
        Runnable render=()->{
            list.removeAllViews();
            if(PlaylistRuntime.snapshot().isEmpty()){TextView empty=new TextView(activity);empty.setText("No saved playlists yet. Select the Download playlist patch when patching, then use the added playlist-header action with In-app or External mode.");list.addView(empty);}
            for(JSONObject batch:PlaylistRuntime.snapshot()){
                String id=batch.optString("id");TextView title=new TextView(activity);title.setText(batch.optString("title"));title.setTextSize(18);title.setTypeface(null,android.graphics.Typeface.BOLD);list.addView(title);
                JSONArray entries=batch.optJSONArray("entries");int complete=0,failed=0;
                if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject e=entries.optJSONObject(i);if(e==null)continue;String state=e.optString("state");if(state.equals("complete"))complete++;if(state.equals("failed")||state.equals("unavailable"))failed++;}
                TextView status=new TextView(activity);status.setText(complete+" / "+(entries==null?0:entries.length())+" saved"+(batch.optBoolean("enumerated")?"":" (still enumerating)")+"\n"+batch.optString("status")+(failed>0?"\n"+failed+" unavailable or failed":""));list.addView(status);
                ProgressBar progress=new ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(entries==null?1:Math.max(1,entries.length()));progress.setProgress(complete);progress.setIndeterminate(!batch.optBoolean("enumerated"));list.addView(progress);
                LinearLayout buttons=new LinearLayout(activity);buttons.setOrientation(LinearLayout.VERTICAL);list.addView(buttons);
                action(activity,buttons,"Open original playlist",()->PlaylistRuntime.play(activity,batch));
                action(activity,buttons,batch.optBoolean("running")?"Pause":"Resume",()->PlaylistRuntime.control(id,batch.optBoolean("running")?"pause":"resume"));
                action(activity,buttons,"Retry missing tracks",()->PlaylistRuntime.control(id,"retry"));
                action(activity,buttons,"Cancel remaining",()->new AlertDialog.Builder(activity).setTitle("Cancel remaining downloads?").setMessage("Completed files and the offline playlist are kept. Active downloads finish safely.").setNegativeButton("Keep downloading",null).setPositiveButton("Cancel remaining",(d,w)->PlaylistRuntime.control(id,"cancel")).show());
                action(activity,buttons,"Entry details",()->{
                    StringBuilder info=new StringBuilder();if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject e=entries.optJSONObject(i);if(e!=null)info.append(i+1).append(". ").append(e.optString("title")).append(" - ").append(e.optString("state")).append(e.optString("reason").isEmpty()?"":" ("+e.optString("reason")+")").append('\n');}
                    TextView text=new TextView(activity);text.setText(info);text.setTextIsSelectable(true);text.setPadding(pad,pad,pad,pad);ScrollView detail=new ScrollView(activity);detail.addView(text);new AlertDialog.Builder(activity).setTitle(batch.optString("title")).setView(detail).setPositiveButton("Close",null).show();
                });
            }
        };
        dialog.setOnDismissListener(d->PlaylistRuntime.removeListener(render));PlaylistRuntime.addListener(render);render.run();dialog.show();
    }
    private static void action(Context c,LinearLayout group,String label,Runnable action){Button b=new Button(c);b.setAllCaps(false);b.setText(label);b.setOnClickListener(v->action.run());group.addView(b);}
}
