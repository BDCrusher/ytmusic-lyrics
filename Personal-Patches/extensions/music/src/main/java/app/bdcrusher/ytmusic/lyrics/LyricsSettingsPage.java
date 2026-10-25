/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import android.content.Context;
import android.content.SharedPreferences;
import android.preference.*;
import android.os.Handler;
import android.os.Looper;
import android.widget.*;
import android.graphics.Color;
import android.view.View;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.shared.theme.ThemeUtils;
import app.morphe.extension.shared.ResourceUtils;

/** Installs real native preferences on the existing Morphe Lyrics page in either edition. */
@SuppressWarnings("deprecation")
public final class LyricsSettingsPage {
    private static final String KEY="morphe_settings_music_screen_5_lyrics";
    private static java.lang.ref.WeakReference<PreferenceScreen> latest=new java.lang.ref.WeakReference<>(null);
    private LyricsSettingsPage(){}
    public static void install(PreferenceFragment fragment){
        try(var ignored=fragment.getActivity().getAssets().open("bdcrusher-lyrics/providers.json")){}catch(Exception absent){return;}
        Context c=fragment.getActivity();PreferenceScreen root=fragment.getPreferenceScreen();
        Preference existing=root.findPreference(KEY);PreferenceScreen page;
        if(existing instanceof PreferenceScreen)page=(PreferenceScreen)existing;
        else{page=fragment.getPreferenceManager().createPreferenceScreen(c);page.setKey(KEY);page.setTitle("Lyrics");page.setOrder(5);page.setIcon(ResourceUtils.getDrawable("morphe_settings_screen_14_lyrics"));root.addPreference(page);}
        if(page.findPreference("bdcrusher_lyrics_inline_ready")==null)populate(c,page);
        latest=new java.lang.ref.WeakReference<>(page);
        if(fragment.getActivity().getIntent().getBooleanExtra("bdcrusher_open_lyrics",false)){
            fragment.getActivity().getIntent().removeExtra("bdcrusher_open_lyrics");
            new Handler(Looper.getMainLooper()).post(()->{for(int i=0;i<root.getRootAdapter().getCount();i++)if(root.getRootAdapter().getItem(i)==page){root.onItemClick(null,null,i,0);break;}});
        }
    }
    static void populate(Context c,PreferenceScreen page){
        page.removeAll();page.setOrderingAsAdded(true);
        SharedPreferences p=LyricsConfig.preferences(c);
        if(p.getInt("catalogSchema",0)<2)p.edit().putString("legacyPriority",p.getString("priority","")).putString("priority",join(LyricsConfig.order(c))).putInt("catalogSchema",2).apply();
        SwitchPreference enabled=new SwitchPreference(c);enabled.setTitle("Third-party lyrics");enabled.setKey("bdcrusher_lyrics_inline_ready");enabled.setPersistent(false);enabled.setChecked(Settings.LYRICS_ENABLED.get());
        enabled.setOnPreferenceChangeListener((pref,v)->{Settings.LYRICS_ENABLED.save((Boolean)v);return true;});page.addPreference(enabled);
        category(c,page,"Rendering");
        toggle(c,page,p,"wordSync","Word and syllable highlighting",true);toggle(c,page,p,"letterWave","Letter wave",true);
        number(c,page,p,"fontSize","Lyrics text size",20,44,28);toggle(c,page,p,"reducedMotion","Reduce motion",false);
        toggle(c,page,p,"tapSeek","Tap lyrics to seek",true);toggle(c,page,p,"passive","Slow scroll for untimed lyrics",false);
        category(c,page,"Background vocals and singers");toggle(c,page,p,"background","Show background vocals",true);
        number(c,page,p,"bgSize","Background vocal size",40,90,65);number(c,page,p,"bgOpacity","Background vocal opacity",30,100,70);
        alignment(c,page,p,"backgroundAlignment","Background vocal placement");
        for(String a:new String[]{"v1","v2","v3","v1000"})alignment(c,page,p,a,"Singer "+a+" placement");
        text(c,page,p,"extraAgents","Additional singer positions","For example: v4=center,v5=right","");
        category(c,page,"Translation and romanization");toggle(c,page,p,"translation","Translate lyrics",false);toggle(c,page,p,"romanization","Romanize lyrics",false);
        text(c,page,p,"language","Translation language","Language code",java.util.Locale.getDefault().getLanguage());
        category(c,page,"Sources");page.addPreference(new LyricsSourceOrderPreference(c));
        Preference connection=new Preference(c);connection.setTitle("Source connection");
        String jwt=p.getString("serviceJwt","");connection.setSummary(jwt.isEmpty()?"Additional providers verify automatically while the app is active. Tap if interaction is needed.":ServiceConnection.expired(jwt)?"Additional-provider verification expired · tap to renew":"Additional providers connected · tap to reconnect");
        connection.setOnPreferenceClickListener(pref->{ServiceConnection.show(c);return true;});page.addPreference(connection);
        Preference diagnostics=new Preference(c);diagnostics.setTitle("Source diagnostics");diagnostics.setSummary("Request metadata and provider outcomes; credentials are excluded");
        diagnostics.setOnPreferenceClickListener(pref->{LyricsDiagnostics.show(c);return true;});page.addPreference(diagnostics);
        Preference license=new Preference(c);license.setTitle("Credits and licenses");license.setOnPreferenceClickListener(pref->{showNotice(c);return true;});page.addPreference(license);
    }
    static String join(org.json.JSONArray a){java.util.List<String> v=new java.util.ArrayList<>();for(int i=0;i<a.length();i++)v.add(a.optString(i));return android.text.TextUtils.join(",",v);}
    private static void category(Context c,PreferenceScreen page,String title){PreferenceCategory category=new PreferenceCategory(c);category.setTitle(title);page.addPreference(category);}
    private static void toggle(Context c,PreferenceScreen page,SharedPreferences p,String key,String title,boolean def){
        SwitchPreference control=new SwitchPreference(c);control.setKey("bdcrusher_"+key);control.setTitle(title);control.setPersistent(false);control.setChecked(p.getBoolean(key,def));
        control.setOnPreferenceChangeListener((pref,value)->{p.edit().putBoolean(key,(Boolean)value).apply();return true;});page.addPreference(control);
    }
    private static void text(Context c,PreferenceScreen page,SharedPreferences p,String key,String title,String help,String def){
        EditTextPreference control=new EditTextPreference(c);control.setKey("bdcrusher_"+key);control.setTitle(title);control.setDialogTitle(title);control.setPersistent(false);control.setText(p.getString(key,def));control.setSummary(help+" · "+p.getString(key,def));
        control.setOnPreferenceChangeListener((pref,value)->{String v=value.toString().trim();p.edit().putString(key,v).apply();control.setSummary(help+" · "+v);return true;});page.addPreference(control);
    }
    private static void alignment(Context c,PreferenceScreen page,SharedPreferences p,String key,String title){
        ListPreference control=new ListPreference(c);control.setKey("bdcrusher_"+key);control.setTitle(title);control.setDialogTitle(title);control.setPersistent(false);
        control.setEntries(new String[]{"Better Lyrics default","Left","Center","Right"});control.setEntryValues(new String[]{"auto","left","center","right"});control.setValue(p.getString(key,"auto"));control.setSummary(control.getEntry());
        control.setOnPreferenceChangeListener((pref,value)->{p.edit().putString(key,value.toString()).apply();control.setValue(value.toString());control.setSummary(control.getEntry());return true;});page.addPreference(control);
    }
    private static void number(Context c,PreferenceScreen page,SharedPreferences p,String key,String title,int min,int max,int def){
        page.addPreference(new LyricsSliderPreference(c,p,key,title,min,max,1,def,"fontSize".equals(key)?" sp":"%"));
    }
    private static void showNotice(Context c){try(var in=c.getAssets().open("bdcrusher-lyrics/NOTICE.txt")){
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);
        TextView text=new TextView(c);text.setText(out.toString("UTF-8"));text.setTextColor(ThemeUtils.getAppForegroundColor());text.setPadding(24,24,24,24);text.setTextIsSelectable(true);
        ScrollView scroll=new ScrollView(c);scroll.addView(text);new android.app.AlertDialog.Builder(c).setTitle("Credits and licenses").setView(scroll).setPositiveButton("Close",null).show();
    }catch(Exception ex){Toast.makeText(c,"Credits unavailable",Toast.LENGTH_SHORT).show();}}
}
