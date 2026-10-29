/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;
import android.content.*;
import android.preference.*;
import android.widget.*;
import app.morphe.extension.shared.theme.ThemeUtils;
/** Extends Morphe's existing Debugging page; never starts recording automatically. */
@SuppressWarnings("deprecation")
public final class DiagnosticsPage {
    private DiagnosticsPage(){}
    public static void install(PreferenceFragment fragment){
        Context c=fragment.getActivity();FeatureDiagnostics.configure(c);PreferenceScreen root=fragment.getPreferenceScreen();Preference existing=root.findPreference("morphe_debug_screen");PreferenceScreen page;
        if(existing instanceof PreferenceScreen)page=(PreferenceScreen)existing;else{page=fragment.getPreferenceManager().createPreferenceScreen(c);page.setKey("morphe_debug_screen");page.setTitle("Debugging");page.setOrder(7);root.addPreference(page);}
        if(page.findPreference("bdcrusher_diagnostics_ready")!=null)return;PreferenceCategory group=new PreferenceCategory(c);group.setKey("bdcrusher_diagnostics_ready");group.setTitle("Lyrics and Shaders");group.setOrder(-10);page.addPreference(group);
        SwitchPreference detailed=new SwitchPreference(c);detailed.setTitle("Detailed Lyrics and Shaders diagnostics");detailed.setSummary("Panel route, line transitions, source outcomes, Android frame timings and graphics failures. Included in Morphe's exported logs.");detailed.setPersistent(false);detailed.setChecked(c.getSharedPreferences("bdcrusher_diagnostics",0).getBoolean("detailed",false));detailed.setOnPreferenceChangeListener((p,v)->{FeatureDiagnostics.setDetailed(c,(Boolean)v);return true;});group.addPreference(detailed);
        action(c,group,"Capture the next 60 seconds","Start, return to Lyrics and reproduce the problem without screen recording.",()->FeatureDiagnostics.capture(c));
        action(c,group,"Stop timed capture","Keep the captured report; Morphe's debugging switch is unchanged.",FeatureDiagnostics::stop);
        action(c,group,"View Lyrics and Shaders report","Includes Native/Fallback route; no URLs, credentials or lyric text.",()->show(c));
        action(c,group,"Copy Lyrics and Shaders report","Copy a bounded report to share when reporting a problem.",()->copy(c));
        action(c,group,"Clear captured report","Keep lyrics, artwork records, settings and connections.",FeatureDiagnostics::clear);
    }
    private static void action(Context c,PreferenceGroup group,String title,String summary,Runnable run){Preference p=new Preference(c);p.setTitle(title);p.setSummary(summary);p.setOnPreferenceClickListener(v->{run.run();return true;});group.addPreference(p);}
    public static void copy(Context c){((ClipboardManager)c.getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Lyrics and Shaders diagnostics",FeatureDiagnostics.snapshot()));Toast.makeText(c,"Report copied",Toast.LENGTH_SHORT).show();}
    public static void show(Context c){TextView text=new TextView(c);text.setText(FeatureDiagnostics.snapshot());text.setTextColor(ThemeUtils.getAppForegroundColor());text.setTextIsSelectable(true);int pad=(int)(20*c.getResources().getDisplayMetrics().density);text.setPadding(pad,pad,pad,pad);ScrollView scroll=new ScrollView(c);scroll.addView(text);scroll.setBackgroundColor(ThemeUtils.getAppBackgroundColor());new android.app.AlertDialog.Builder(c).setTitle("Lyrics and Shaders report").setView(scroll).setPositiveButton("Close",null).setNeutralButton("Copy report",(d,w)->copy(c)).show();}
}
