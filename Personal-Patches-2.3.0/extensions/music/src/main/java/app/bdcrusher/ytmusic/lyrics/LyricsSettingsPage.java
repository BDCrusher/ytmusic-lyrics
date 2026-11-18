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

/** Installs real native preferences on the existing Morphe Lyrics page in either edition. */
@SuppressWarnings("deprecation")
public final class LyricsSettingsPage {
    public static final String KEY="morphe_settings_music_screen_04_lyrics";
    private LyricsSettingsPage(){}
    public static void install(PreferenceFragment fragment){
        try(var ignored=fragment.getActivity().getAssets().open("bdcrusher-lyrics/providers.json")){}catch(Exception absent){return;}
        Context c=fragment.getActivity();PreferenceScreen root=fragment.getPreferenceScreen();
        if(!(root.findPreference(KEY) instanceof PreferenceScreen page))return;
        if(page.findPreference("bdcrusher_source_order")==null)populate(c,page);
        if(fragment.getActivity().getIntent().getBooleanExtra("bdcrusher_open_lyrics",false)){
            fragment.getActivity().getIntent().removeExtra("bdcrusher_open_lyrics");
            new Handler(Looper.getMainLooper()).post(()->{for(int i=0;i<root.getRootAdapter().getCount();i++)if(root.getRootAdapter().getItem(i)==page){root.onItemClick(null,null,i,0);break;}});
        }
    }
    static void populate(Context c,PreferenceScreen page){
        for(int i=page.getPreferenceCount()-1;i>=0;i--){
            Preference child=page.getPreference(i);
            if(child.getKey()!=null&&child.getKey().startsWith("bdcrusher_lyrics_group_"))page.removePreference(child);
            else if(child instanceof PreferenceGroup group)removeOwnedRows(group);
        }
        removeOwnedRows(page);
        // The personal controls and the upstream processing/session controls share one screen.
        // Remove equivalent native controls so each setting has one owner.
        for(String key:new String[]{"morphe_music_lyrics_source",
                "morphe_music_lyrics_source_advice","morphe_music_lyrics_clear_cache",
                "morphe_music_lyrics_word_sync","morphe_music_lyrics_text_size",
                "morphe_music_lyrics_tap_to_seek","morphe_music_lyrics_dynamic_background",
                "morphe_music_lyrics_dynamic_background_animated"}){
            Preference duplicate=page.findPreference(key);
            if(duplicate!=null)removePreference(page,duplicate);
        }
        populatePersonal(c,page);
    }
    private static void removeOwnedRows(PreferenceGroup group){
        for(int i=group.getPreferenceCount()-1;i>=0;i--){
            Preference child=group.getPreference(i);
            if(child.getKey()!=null&&child.getKey().startsWith("bdcrusher_"))group.removePreference(child);
        }
    }
    private static boolean removePreference(PreferenceGroup group,Preference item){
        if(group.removePreference(item))return true;
        for(int i=0;i<group.getPreferenceCount();i++){
            if(group.getPreference(i) instanceof PreferenceGroup child&&removePreference(child,item))return true;
        }
        return false;
    }
    private static void populatePersonal(Context c,PreferenceScreen screen){
        SharedPreferences p=LyricsConfig.preferences(c);
        if(p.getInt("catalogSchema",0)<2)p.edit().putString("legacyPriority",p.getString("priority","")).putString("priority",join(LyricsConfig.order(c))).putInt("catalogSchema",2).apply();
        PreferenceGroup page=group(screen,"morphe_music_lyrics_section_display");
        toggle(c,page,p,"wordSync","Word and syllable highlighting",true);toggle(c,page,p,"letterWave","Letter wave",true);
        number(c,page,p,"fontSize","Lyrics text size",20,44,28);toggle(c,page,p,"reducedMotion","Reduce motion",false);
        toggle(c,page,p,"passive","Slow scroll for untimed lyrics",false);
        page=group(screen,"morphe_music_lyrics_section_panel");
        toggle(c,page,p,"tapSeek","Tap lyrics to seek",true);
        page=newGroup(c,screen,"vocals","Background vocals and singers");
        toggle(c,page,p,"background","Show background vocals",true);
        number(c,page,p,"bgSize","Background vocal size",40,90,65);number(c,page,p,"bgOpacity","Background vocal opacity",30,100,70);
        alignment(c,page,p,"backgroundAlignment","Background vocal placement");
        for(String a:new String[]{"v1","v2","v3","v1000"})alignment(c,page,p,a,"Singer "+a+" placement");
        text(c,page,p,"extraAgents","Additional singer positions","For example: v4=center,v5=right","");
        app.bdcrusher.ytmusic.common.PersonalCredits.reset(c,page,p,"vocals and singers",()->populate(c,screen),"background","bgSize","bgOpacity","backgroundAlignment","v1","v2","v3","v1000","extraAgents");
        page=newGroup(c,screen,"language","Translation and romanization");
        toggle(c,page,p,"translation","Translate lyrics",false);toggle(c,page,p,"romanization","Romanize lyrics",false);
        page=group(screen,"morphe_music_lyrics_section_service");
        LyricsSourceOrderPreference sources=new LyricsSourceOrderPreference(c);
        sources.setOrder(-1);
        page.addPreference(sources);
        page=newGroup(c,screen,"credentials","Provider credentials");
        credential(c,page,"Apple Music token",Settings.APPLE_MUSIC_TOKEN);
        credential(c,page,"Spotify token",Settings.SPOTIFY_TOKEN);
        credential(c,page,"Deezer ARL",Settings.DEEZER_ARL);
        credential(c,page,"Musixmatch token",Settings.MUSIXMATCH_TOKEN);
        page=newGroup(c,screen,"storage","Saved lyrics and storage");
        ListPreference policy=app.bdcrusher.ytmusic.common.FeaturePreferences.choice(c);policy.setTitle("Choose the saved version");policy.setKey("bdcrusher_cache_policy");policy.setPersistent(false);
        policy.setEntries(new String[]{"Best timing, then source order","Source order first"});policy.setEntryValues(new String[]{"quality","source"});policy.setValue(p.getString("cachePolicy","quality"));policy.setSummary(policy.getEntry());
        policy.setOnPreferenceChangeListener((pref,value)->{p.edit().putString("cachePolicy",value.toString()).apply();policy.setValue(value.toString());policy.setSummary(policy.getEntry());return true;});page.addPreference(policy);
        page.addPreference(new StoragePreference(c,true));
        Preference clear=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);clear.setTitle("Clear saved lyrics");clear.setSummary("Lyrics remain saved until you clear them; no automatic expiry");
        clear.setOnPreferenceClickListener(pref->{new android.app.AlertDialog.Builder(c).setTitle("Clear saved lyrics?").setMessage("Remove your saved lyric library. Rendering settings, source connections and downloaded music are kept.").setNegativeButton("Cancel",null).setPositiveButton("Clear",(d,w)->new LyricsLibrary(c).clear(()->populate(c,screen))).show();return true;});page.addPreference(clear);
        Preference connection=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);connection.setKey("bdcrusher_source_connection");connection.setTitle("Source connection");
        String jwt=p.getString("serviceJwt","");connection.setSummary(jwt.isEmpty()?"Additional providers verify automatically while the app is active. Tap if interaction is needed.":ServiceConnection.expired(jwt)?"Additional-provider verification expired · tap to renew":"Additional providers connected · tap to reconnect");
        connection.setOnPreferenceClickListener(pref->{ServiceConnection.show(c);return true;});group(screen,"morphe_music_lyrics_section_service").addPreference(connection);

        Preference license=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);license.setKey("bdcrusher_lyrics_credits");license.setTitle("Credits and licenses");license.setOnPreferenceClickListener(pref->{showNotice(c);return true;});group(screen,"morphe_music_lyrics_section_about").addPreference(license);
        Preference reset=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);reset.setKey("bdcrusher_lyrics_reset_rendering");reset.setTitle("Reset rendering settings");reset.setSummary("Restore visual defaults without changing sources, saved lyrics or connections");reset.setOnPreferenceClickListener(pref->{new android.app.AlertDialog.Builder(c).setTitle("Reset rendering settings?").setNegativeButton("Cancel",null).setPositiveButton("Reset",(d,w)->{SharedPreferences.Editor e=p.edit();for(String key:new String[]{"wordSync","letterWave","fontSize","reducedMotion","tapSeek","passive","background","bgSize","bgOpacity","backgroundAlignment","v1","v2","v3","v1000","extraAgents"})e.remove(key);e.apply();populate(c,screen);}).show();return true;});group(screen,"morphe_music_lyrics_section_display").addPreference(reset);
    }
    private static void credential(Context c,PreferenceGroup page,String title,
            app.morphe.extension.shared.settings.StringSetting setting){
        EditTextPreference input=app.bdcrusher.ytmusic.common.FeaturePreferences.text(c);
        input.setTitle(title);input.setDialogTitle(title);input.setKey(setting.key);
        input.setPersistent(false);input.setText(setting.get());
        input.getEditText().setInputType(android.text.InputType.TYPE_CLASS_TEXT
                |android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        input.setSummary(setting.get().isBlank()?"Optional provider credential":"Configured");
        input.setOnPreferenceChangeListener((pref,value)->{
            String token=value.toString().trim();
            setting.save(token);input.setSummary(token.isEmpty()?"Optional provider credential":"Configured");
            return true;
        });
        page.addPreference(input);
    }
    static String join(org.json.JSONArray a){java.util.List<String> v=new java.util.ArrayList<>();for(int i=0;i<a.length();i++)v.add(a.optString(i));return android.text.TextUtils.join(",",v);}
    private static PreferenceGroup group(PreferenceScreen screen,String key){
        return screen.findPreference(key) instanceof PreferenceGroup group?group:screen;
    }
    private static PreferenceGroup newGroup(Context context,PreferenceScreen screen,String id,String title){
        PreferenceCategory group=new PreferenceCategory(context);
        group.setKey("bdcrusher_lyrics_group_"+id);
        group.setTitle(title);
        screen.addPreference(group);
        return group;
    }
    private static void toggle(Context c,PreferenceGroup page,SharedPreferences p,String key,String title,boolean def){
        SwitchPreference control=app.bdcrusher.ytmusic.common.FeaturePreferences.toggle(c);control.setKey("bdcrusher_"+key);control.setTitle(title);control.setPersistent(false);control.setChecked(p.getBoolean(key,def));
        control.setOnPreferenceChangeListener((pref,value)->{p.edit().putBoolean(key,(Boolean)value).apply();return true;});page.addPreference(control);
    }
    private static void text(Context c,PreferenceGroup page,SharedPreferences p,String key,String title,String help,String def){
        EditTextPreference control=app.bdcrusher.ytmusic.common.FeaturePreferences.text(c);control.setKey("bdcrusher_"+key);control.setTitle(title);control.setDialogTitle(title);control.setPersistent(false);control.setText(p.getString(key,def));control.setSummary(help+" · "+p.getString(key,def));
        control.setOnPreferenceChangeListener((pref,value)->{String v=value.toString().trim();p.edit().putString(key,v).apply();control.setSummary(help+" · "+v);return true;});page.addPreference(control);
    }
    private static void alignment(Context c,PreferenceGroup page,SharedPreferences p,String key,String title){
        ListPreference control=app.bdcrusher.ytmusic.common.FeaturePreferences.choice(c);control.setKey("bdcrusher_"+key);control.setTitle(title);control.setDialogTitle(title);control.setPersistent(false);
        control.setEntries(new String[]{"Better Lyrics default","Left","Center","Right"});control.setEntryValues(new String[]{"auto","left","center","right"});control.setValue(p.getString(key,"auto"));control.setSummary(control.getEntry());
        control.setOnPreferenceChangeListener((pref,value)->{p.edit().putString(key,value.toString()).apply();control.setValue(value.toString());control.setSummary(control.getEntry());return true;});page.addPreference(control);
    }
    private static void number(Context c,PreferenceGroup page,SharedPreferences p,String key,String title,int min,int max,int def){
        page.addPreference(new LyricsSliderPreference(c,p,key,title,min,max,1,def,"fontSize".equals(key)?" sp":"%"));
    }
    private static void showNotice(Context c){try(var in=c.getAssets().open("bdcrusher-lyrics/NOTICE.txt")){
        java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);
        TextView text=new TextView(c);text.setText(out.toString("UTF-8"));text.setTextColor(ThemeUtils.getAppForegroundColor());text.setPadding(24,24,24,24);text.setTextIsSelectable(true);
        ScrollView scroll=new ScrollView(c);scroll.addView(text);new android.app.AlertDialog.Builder(c).setTitle("Credits and licenses").setView(scroll).setPositiveButton("Close",null).show();
    }catch(Exception ex){Toast.makeText(c,"Credits unavailable",Toast.LENGTH_SHORT).show();}}
}
