/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import android.content.Context;
import android.widget.*;
import android.app.AlertDialog;
import app.morphe.extension.shared.theme.ThemeUtils;
/** Bounded process-local request evidence. Never accepts URLs, headers, tokens or lyric bodies. */
public final class LyricsDiagnostics {
    private static final java.util.ArrayDeque<String> events=new java.util.ArrayDeque<>();
    public static synchronized void record(String source,String message){
        String line=(source+": "+message).replaceAll("[\\r\\n]"," ");if(line.length()>360)line=line.substring(0,360);
        if(!events.isEmpty()&&events.peekLast().equals(line))return;events.add(line);while(events.size()>60)events.removeFirst();
    }
    public static synchronized String snapshot(){return android.text.TextUtils.join("\n",events);}
    static void show(Context c){TextView text=new TextView(c);text.setText(snapshot());text.setTextIsSelectable(true);text.setTextColor(ThemeUtils.getAppForegroundColor());text.setPadding(24,24,24,24);ScrollView scroll=new ScrollView(c);scroll.addView(text);
        new AlertDialog.Builder(c).setTitle("Source diagnostics").setView(scroll).setPositiveButton("Close",null).setNeutralButton("Copy",(d,w)->{android.content.ClipboardManager cb=(android.content.ClipboardManager)c.getSystemService(Context.CLIPBOARD_SERVICE);cb.setPrimaryClip(android.content.ClipData.newPlainText("Lyrics diagnostics",snapshot()));}).show();}
}
