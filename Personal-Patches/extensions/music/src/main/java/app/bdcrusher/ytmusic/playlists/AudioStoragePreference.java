/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists;
import android.content.Context;
import android.graphics.Color;
import android.os.*;
import android.preference.Preference;
import android.view.*;
import android.widget.*;
import android.text.format.Formatter;
import java.io.File;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.theme.ThemeUtils;

/** Real owned bytes and free device space, independent of an external downloader's private files. */
@SuppressWarnings("deprecation")
public final class AudioStoragePreference extends Preference {
    public AudioStoragePreference(Context c){super(c);setSelectable(false);}
    private TextView text(String value){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(14);t.setTextColor(ThemeUtils.getAppForegroundColor());return t;}
    @Override @android.annotation.SuppressLint("MissingSuperCall") protected View onCreateView(ViewGroup parent){
        Context c=getContext();LinearLayout card=new LinearLayout(c);card.setOrientation(LinearLayout.VERTICAL);card.addView(text("Available storage"));TextView label=text("Calculatingâ€¦");card.addView(label);LinearLayout bar=new LinearLayout(c);card.addView(bar,new LinearLayout.LayoutParams(-1,Math.round(16*c.getResources().getDisplayMetrics().density)));
        Utils.submitOnBackgroundThread(()->{File dir=new File(c.getExternalFilesDir(Environment.DIRECTORY_MUSIC),"Morphe");long[] sizes=new long[3];File[] files=dir.listFiles();if(files!=null)for(File f:files)if(f.isFile()){String n=f.getName();if(n.endsWith(".webm")||n.endsWith(".m4a"))sizes[0]+=f.length();else if(n.endsWith(".jpg"))sizes[1]+=f.length();else if(n.endsWith(".json")||n.endsWith(".format.pb"))sizes[2]+=f.length();}for(String name:new String[]{"bdcrusher-offline-native","bdcrusher-offline-playlists","bdcrusher-playlist-pages"}){File[] metadata=new File(c.getFilesDir(),name).listFiles();if(metadata!=null)for(File f:metadata)if(f.isFile())sizes[2]+=f.length();}File[] artwork=new File(c.getFilesDir(),"bdcrusher-playlist-artwork").listFiles();if(artwork!=null)for(File f:artwork)if(f.isFile()){if(f.getName().endsWith(".jpg")||f.getName().contains(".jpg."))sizes[1]+=f.length();else sizes[2]+=f.length();}File prefs=new File(c.getFilesDir().getParentFile(),"shared_prefs/bdcrusher_audio_downloads.xml");if(prefs.isFile())sizes[2]+=prefs.length();long free=dir.getUsableSpace();long own=sizes[0]+sizes[1]+sizes[2],total=Math.max(1,own+free);
            new Handler(Looper.getMainLooper()).post(()->{label.setText(Formatter.formatShortFileSize(c,own)+" used Â· "+Formatter.formatShortFileSize(c,free)+" free");String[] names={"Downloaded audio","Cover artwork","Track metadata, chapters and download preferences","Free device storage"};long[] values={sizes[0],sizes[1],sizes[2],free};int[] colors={0xff64b5f6,0xffb39ddb,0xff80cbc4,0xffbbbbbb};for(int i=0;i<values.length;i++){if(values[i]<=0)continue;String detail=names[i]+": "+Formatter.formatShortFileSize(c,values[i]);View v=new View(c);v.setBackgroundColor(colors[i]);v.setContentDescription(detail);v.setFocusable(true);v.setOnClickListener(anchor->{TextView callout=text(detail);callout.setPadding(24,16,24,16);callout.setBackgroundColor(ThemeUtils.getAppBackgroundColor());PopupWindow popup=new PopupWindow(callout,-2,-2,true);popup.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(ThemeUtils.getAppBackgroundColor()));popup.setOutsideTouchable(true);popup.showAsDropDown(anchor);});bar.addView(v,new LinearLayout.LayoutParams(0,-1,Math.max(.01f,(float)values[i]/total)));}card.addView(text("Includes files saved by In-app mode. Your selected YTDLnis folder is read-only and is not counted as app-owned storage."));});return null;});
        app.bdcrusher.ytmusic.common.FeaturePreferences.card(card,false);return card;
    }
}
