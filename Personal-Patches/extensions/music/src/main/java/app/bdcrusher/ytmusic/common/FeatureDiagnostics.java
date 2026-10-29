/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;
import android.content.Context;
import android.os.*;
import app.morphe.extension.shared.Logger;
import app.morphe.extension.shared.settings.BaseSettings;
import java.util.ArrayDeque;
/** Bounded process-local evidence, also included in Morphe's existing exported logs. */
public final class FeatureDiagnostics {
    private static final ArrayDeque<String> events=new ArrayDeque<>();
    private static final long started=SystemClock.elapsedRealtime();
    private static volatile String entry="Unknown";private static volatile boolean panelOpen;
    private static int storedBytes;private static String last="";private static long lastAt;
    private static volatile Context app;private static volatile String previous="";private static boolean loaded;
    private static final java.util.concurrent.ExecutorService io=java.util.concurrent.Executors.newSingleThreadExecutor();
    private static volatile long captureUntil;private static volatile boolean detail;
    private FeatureDiagnostics(){}
    public static synchronized void configure(Context c){app=c.getApplicationContext();if(!loaded){loaded=true;io.execute(()->{try{java.io.File f=new java.io.File(app.getFilesDir(),"bdcrusher-last-diagnostics.txt");if(f.isFile()&&f.length()<=96000)previous=new String(new android.util.AtomicFile(f).readFully(),java.nio.charset.StandardCharsets.UTF_8);}catch(Exception ignored){}});}detail=c.getSharedPreferences("bdcrusher_diagnostics",0).getBoolean("detailed",false);}
    public static boolean detailed(){return detail||SystemClock.elapsedRealtime()<captureUntil||BaseSettings.DEBUG.get();}
    public static void setDetailed(Context c,boolean enabled){detail=enabled;c.getSharedPreferences("bdcrusher_diagnostics",0).edit().putBoolean("detailed",enabled).apply();PersonalRuntime.diagnosticsChanged();}
    public static void capture(Context c){configure(c);captureUntil=SystemClock.elapsedRealtime()+60000;record("Capture","Started 60-second capture; Android "+Build.VERSION.SDK_INT);PersonalRuntime.diagnosticsChanged();}
    public static void stop(){captureUntil=0;record("Capture","Timed capture stopped");PersonalRuntime.diagnosticsChanged();}
    public static void entry(String value){String next="Native".equals(value)?"Native":"Fallback".equals(value)?"Fallback":"Unknown";if(!next.equals(entry)){entry=next;record("Panel",entry+" Lyrics entry");}}
    public static String entry(){return entry;}
    public static void panel(boolean shown){panelOpen=shown;}
    public static boolean panelOpen(){return panelOpen;}
    public static void event(String category,String message){if(detailed())record(category,message);}
    public static synchronized void record(String category,String message){
        if(message==null||category==null)return;
        String safe=(category+": "+message).replaceAll("[\\r\\n\\t]"," ").replaceAll("(?i)https?://[^ ]+","[url omitted]").replaceAll("(?i)(bearer|authorization|cookie|token|jwt|secret|password)[=: ]+[^ ;,]+","$1=[redacted]").replaceAll("[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{8,}","[credential omitted]");
        if(safe.length()>360)safe=safe.substring(0,360);long now=SystemClock.elapsedRealtime();if(safe.equals(last)&&now-lastAt<1000)return;last=safe;lastAt=now;
        String line="+"+(now-started)+"ms "+safe;events.addLast(line);storedBytes+=line.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;while(events.size()>240||storedBytes>80000)storedBytes-=events.removeFirst().getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
        if(detailed())Logger.printInfo(()->"Personal diagnostics "+line);
    }
    public static synchronized String snapshot(){return "YT-Music personal diagnostics 0.4.0-beta.1\nAndroid "+Build.VERSION.SDK_INT+"; Lyrics entry: "+entry+"; detailed="+detailed()+"\nWeb callback gaps and actual Android window metrics are reported separately.\n"+(previous.isEmpty()?"":"Previous session:\n"+previous+"\nCurrent session:\n")+android.text.TextUtils.join("\n",events);}
    public static synchronized void clear(){events.clear();storedBytes=0;last="";lastAt=0;previous="";Context c=app;if(c!=null)io.execute(()->new android.util.AtomicFile(new java.io.File(c.getFilesDir(),"bdcrusher-last-diagnostics.txt")).delete());}
    public static void persist(Context context){Context c=context.getApplicationContext();final String data; synchronized(FeatureDiagnostics.class){data="YT-Music personal diagnostics 0.4.0-beta.1; entry="+entry+"\n"+android.text.TextUtils.join("\n",events);}io.execute(()->{android.util.AtomicFile file=new android.util.AtomicFile(new java.io.File(c.getFilesDir(),"bdcrusher-last-diagnostics.txt"));java.io.FileOutputStream out=null;try{out=file.startWrite();out.write(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));file.finishWrite(out);}catch(Exception e){file.failWrite(out);}});}
}
