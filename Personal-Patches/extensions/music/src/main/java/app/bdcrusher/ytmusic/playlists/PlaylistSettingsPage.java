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
    private PlaylistSettingsPage(){}
    public static void install(PreferenceFragment fragment){
        Context c=fragment.getActivity();if(!PersonalRuntime.installed(c,"playlists"))return;
        PreferenceScreen root=fragment.getPreferenceScreen();if(root.findPreference("bdcrusher_playlists_screen")!=null)return;
        PreferenceScreen page=fragment.getPreferenceManager().createPreferenceScreen(c);page.setKey("bdcrusher_playlists_screen");page.setTitle("Playlist downloads");page.setOrder(7);root.addPreference(page);
        Preference routing=new Preference(c);routing.setTitle("Uses your Downloads mode");routing.setSummary("Default uses YouTube Music's own playlist download. In-app saves an ordered offline playlist. External opens the selected downloader's normal review screen. Change the mode under Player > Downloads.");routing.setSelectable(false);page.addPreference(routing);
        Preference batches=new Preference(c);batches.setTitle("Offline playlists and progress");batches.setSummary("Play saved entries, pause, resume, cancel remaining items, or retry failures");batches.setOnPreferenceClickListener(p->{showBatches(fragment.getActivity());return true;});page.addPreference(batches);
        page.addPreference(new StoragePreference(c,false));
        app.bdcrusher.ytmusic.common.PersonalCredits.add(c,page);
    }
    /** Added inside the existing local library's native layout, without an overlay. */
    public static void addLibraryAction(View root){
        if(!(root instanceof LinearLayout))return;LinearLayout group=(LinearLayout)root;
        Button button=new Button(root.getContext());button.setText("Offline playlists");button.setAllCaps(false);button.setContentDescription("Open saved playlists and download progress");
        button.setOnClickListener(v->showBatches(root.getContext() instanceof Activity?(Activity)root.getContext():app.morphe.extension.shared.Utils.getActivity()));
        group.addView(button,Math.min(1,group.getChildCount()),new LinearLayout.LayoutParams(-1,-2));
    }
    public static void showBatches(Activity activity){
        if(activity==null||activity.isFinishing())return;
        ScrollView scroll=new ScrollView(activity);LinearLayout list=new LinearLayout(activity);list.setOrientation(LinearLayout.VERTICAL);int pad=(int)(16*activity.getResources().getDisplayMetrics().density);list.setPadding(pad,pad,pad,pad);scroll.addView(list);
        AlertDialog dialog=new AlertDialog.Builder(activity).setTitle("Offline playlists").setView(scroll).setNegativeButton("Close",null).create();
        Runnable render=()->{
            list.removeAllViews();
            if(PlaylistRuntime.snapshot().isEmpty()){TextView empty=new TextView(activity);empty.setText("No saved playlists yet. Use Download playlist in a playlist header with In-app download mode selected.");list.addView(empty);}
            for(JSONObject batch:PlaylistRuntime.snapshot()){
                String id=batch.optString("id");TextView title=new TextView(activity);title.setText(batch.optString("title"));title.setTextSize(18);title.setTypeface(null,android.graphics.Typeface.BOLD);list.addView(title);
                JSONArray entries=batch.optJSONArray("entries");int complete=0,failed=0;
                if(entries!=null)for(int i=0;i<entries.length();i++){JSONObject e=entries.optJSONObject(i);if(e==null)continue;String state=e.optString("state");if(state.equals("complete"))complete++;if(state.equals("failed")||state.equals("unavailable"))failed++;}
                TextView status=new TextView(activity);status.setText(complete+" / "+(entries==null?0:entries.length())+" saved"+(batch.optBoolean("enumerated")?"":" (still enumerating)")+"\n"+batch.optString("status")+(failed>0?"\n"+failed+" unavailable or failed":""));list.addView(status);
                ProgressBar progress=new ProgressBar(activity,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(entries==null?1:Math.max(1,entries.length()));progress.setProgress(complete);progress.setIndeterminate(!batch.optBoolean("enumerated"));list.addView(progress);
                LinearLayout buttons=new LinearLayout(activity);buttons.setOrientation(LinearLayout.VERTICAL);list.addView(buttons);
                action(activity,buttons,"Play downloaded entries",()->PlaylistRuntime.play(activity,batch));
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
