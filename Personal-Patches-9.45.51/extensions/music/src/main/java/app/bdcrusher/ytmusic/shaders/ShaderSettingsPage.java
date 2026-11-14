/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.shaders;
import android.content.*;
import android.preference.*;
import app.bdcrusher.ytmusic.lyrics.LyricsSliderPreference;
import app.bdcrusher.ytmusic.lyrics.LyricsSettingsPage;
import app.bdcrusher.ytmusic.lyrics.StoragePreference;
import app.bdcrusher.ytmusic.common.PersonalRuntime;
import app.morphe.extension.shared.ResourceType;
import app.morphe.extension.shared.ResourceUtils;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.settings.SharedSettings;

@SuppressWarnings("deprecation")
public final class ShaderSettingsPage {
    private static final String KEY="bdcrusher_shaders_screen";
    private ShaderSettingsPage(){}
    public static void install(PreferenceFragment fragment){
        Context c=fragment.getActivity();if(!PersonalRuntime.installed(c,"shaders"))return;
        PreferenceScreen root=fragment.getPreferenceScreen();
        if(root.findPreference(KEY)!=null)return;
        PreferenceScreen page=fragment.getPreferenceManager().createPreferenceScreen(c);
        page.setKey(KEY);page.setTitle("Shaders");
        if(SharedSettings.SHOW_MENU_ICONS.get()){
            int layout=ResourceUtils.getIdentifier(ResourceType.LAYOUT,"morphe_preference_with_icon");
            if(layout!=0)page.setLayoutResource(layout);
            page.setIcon(ResourceUtils.getDrawable(Utils.appIsUsingBoldIcons()?"bdcrusher_settings_shaders_bold":"bdcrusher_settings_shaders"));
        }
        root.addPreference(page);populate(c,page);
    }
    public static void orderAfterLyrics(PreferenceScreen root){
        Preference shaders=root.findPreference(KEY);
        Preference after=root.findPreference(LyricsSettingsPage.KEY);
        if(after==null)after=root.findPreference("morphe_settings_music_screen_03_general_sort_by_title");
        if(shaders==null||after==null)return;
        int order=after.getOrder();
        java.util.List<Preference> later=new java.util.ArrayList<>();
        for(int i=0;i<root.getPreferenceCount();i++){
            Preference sibling=root.getPreference(i);
            if(sibling!=shaders&&sibling.getOrder()>order&&sibling.getOrder()<Integer.MAX_VALUE)
                later.add(sibling);
        }
        for(Preference sibling:later)sibling.setOrder(sibling.getOrder()+1);
        shaders.setOrder(order+1);
    }
    private static void populate(Context c,PreferenceScreen page){
        page.removeAll();page.setOrderingAsAdded(true);SharedPreferences p=ArtworkRepository.preferences(c);
        toggle(c,page,p,"enabled","Shaders",true);heading(c,page,"Artwork and backgrounds");
        toggle(c,page,p,"animatedCover","Animated album cover",true);toggle(c,page,p,"background","Artwork background",true);toggle(c,page,p,"animateBackground","Animate background",true);
        app.bdcrusher.ytmusic.common.PersonalCredits.reset(c,page,p,"artwork controls",()->populate(c,page),"animatedCover","background","animateBackground");
        Preference explanation=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);explanation.setTitle("Player and Lyrics");explanation.setSummary("Animated artwork streams when available. Only song/album availability and URLs are saved; no animation-file library. Native music video playback is preserved.");explanation.setSelectable(false);page.addPreference(explanation);
        heading(c,page,"Appearance");
        slider(c,page,p,"speed","Movement speed",0,200,5,100,"%");slider(c,page,p,"strength","Warp strength",0,200,5,100,"%");slider(c,page,p,"saturation","Saturation",0,250,5,150,"%");slider(c,page,p,"opacity","Background opacity",0,100,1,75,"%");slider(c,page,p,"dimming","Dimming",0,80,1,30,"%");slider(c,page,p,"transition","Artwork transition",0,3000,100,1000," ms");
        heading(c,page,"Motion and performance");toggle(c,page,p,"reducedMotion","Reduce motion",false);
        ListPreference fps=app.bdcrusher.ytmusic.common.FeaturePreferences.choice(c);fps.setTitle("Background frame limit");fps.setPersistent(false);fps.setEntries(new String[]{"24 FPS","30 FPS","60 FPS"});fps.setEntryValues(new String[]{"24","30","60"});fps.setValue(p.getString("fps","30"));fps.setSummary(fps.getEntry());fps.setOnPreferenceChangeListener((pref,v)->{p.edit().putString("fps",v.toString()).apply();fps.setValue(v.toString());fps.setSummary(fps.getEntry());return true;});page.addPreference(fps);
        app.bdcrusher.ytmusic.common.PersonalCredits.reset(c,page,p,"motion settings",()->populate(c,page),"fps","reducedMotion");
        heading(c,page,"Artwork records");page.addPreference(new StoragePreference(c,false));
        Preference clear=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);clear.setTitle("Clear artwork records");clear.setSummary("Remove saved artwork URLs and availability records; saved lyrics and music are kept");clear.setOnPreferenceClickListener(pref->{new android.app.AlertDialog.Builder(c).setTitle("Clear artwork records?").setNegativeButton("Cancel",null).setPositiveButton("Clear",(d,w)->ArtworkRepository.clear(c,()->{ShaderRuntime.mediaFailed();populate(c,page);})).show();return true;});page.addPreference(clear);
        Preference reset=app.bdcrusher.ytmusic.common.FeaturePreferences.action(c);reset.setTitle("Reset Shaders appearance");reset.setSummary("Restore effect defaults without clearing artwork records or verification");reset.setOnPreferenceClickListener(pref->{new android.app.AlertDialog.Builder(c).setTitle("Reset Shaders appearance?").setNegativeButton("Cancel",null).setPositiveButton("Reset",(d,w)->{SharedPreferences.Editor e=p.edit();for(String name:new String[]{"animatedCover","background","animateBackground","speed","strength","saturation","opacity","dimming","transition","fps","reducedMotion"})e.remove(name);e.apply();populate(c,page);}).show();return true;});page.addPreference(reset);
        app.bdcrusher.ytmusic.common.PersonalCredits.add(c,page);
    }
    private static void heading(Context c,PreferenceScreen page,String title){PreferenceCategory category=app.bdcrusher.ytmusic.common.FeaturePreferences.heading(c);category.setTitle(title);page.addPreference(category);}
    private static void toggle(Context c,PreferenceScreen page,SharedPreferences p,String key,String title,boolean def){SwitchPreference control=app.bdcrusher.ytmusic.common.FeaturePreferences.toggle(c);control.setTitle(title);control.setKey("bdcrusher_shaders_"+key);control.setPersistent(false);control.setChecked(p.getBoolean(key,def));control.setOnPreferenceChangeListener((pref,v)->{p.edit().putBoolean(key,(Boolean)v).apply();return true;});page.addPreference(control);}
    private static void slider(Context c,PreferenceScreen page,SharedPreferences p,String key,String title,int min,int max,int step,int def,String units){page.addPreference(new LyricsSliderPreference(c,p,key,title,min,max,step,def,units));}
}
