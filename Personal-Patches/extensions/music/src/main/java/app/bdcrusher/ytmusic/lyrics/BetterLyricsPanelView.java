/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.RenderProcessGoneDetail;
import android.widget.FrameLayout;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import app.morphe.extension.music.patches.lyrics.LyricsManager;
import app.morphe.extension.music.patches.lyrics.model.Lyrics;
import app.morphe.extension.music.patches.lyrics.model.LyricsLine;
import app.morphe.extension.music.patches.lyrics.model.Word;
import app.morphe.extension.music.patches.lyrics.model.TrackInfo;
import app.morphe.extension.music.settings.Settings;
import app.morphe.extension.music.shared.VideoInformation;
import app.morphe.extension.shared.Logger;
import app.morphe.extension.shared.Utils;

/** Local-only privileged renderer. Network services never load inside its native bridge origin. */
@SuppressLint("SetJavaScriptEnabled")
public final class BetterLyricsPanelView extends FrameLayout implements LyricsManager.Listener {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final String ROOT=ORIGIN+"/bdcrusher-lyrics/";
    private final Handler handler=new Handler(Looper.getMainLooper());
    private WebView web;
    private boolean ready,attached,hasDisplay;
    private boolean forceRefresh;
    private volatile int generation;
    private String identity="";
    private TrackInfo track;
    private final java.util.Map<View,Integer> covered=new java.util.IdentityHashMap<>();
    private final android.view.ViewTreeObserver.OnGlobalLayoutListener layoutListener=()->{if(hasDisplay)syncOverlay();};
    private LyricsCatalog.Sink catalogSink;
    private LyricsNetwork enrichmentNetwork;
    private java.util.concurrent.ExecutorService enrichmentExecutor;
    private final List<JSONObject> pending=new ArrayList<>();
    private final SharedPreferences.OnSharedPreferenceChangeListener listener=(preferences,key)->handler.post(()->{
        applySettings();if("serviceJwt".equals(key)&&!preferences.getString("serviceJwt","").isEmpty())reload();
    });
    private final Runnable tick=new Runnable(){public void run(){
        if(!attached)return;
        try{
            updateTrack();syncOverlay();
            if(ready){
                LyricsManager manager=LyricsManager.getInstance();
                JSONObject sample=new JSONObject().put("generation",generation)
                    .put("position",manager.getVideoPositionMs()-Settings.LYRICS_OFFSET_MS.get()-manager.getTemporaryOffsetMs()).put("playing",manager.isPlaybackPlaying())
                    .put("rate",manager.getPlaybackSpeed()).put("visible",isShown()&&NativeLyricsHost.isOpen());
                call("state",sample.toString());
            }
        }catch(Exception ex){Logger.printException(()->"BDCrusher lyric clock",ex);}
        handler.postDelayed(this,isShown()?100:500);
    }};
    public BetterLyricsPanelView(Context context){super(context);setVisibility(View.INVISIBLE);}
    @Override protected void onWindowVisibilityChanged(int visibility){super.onWindowVisibilityChanged(visibility);call("visible",String.valueOf(visibility==View.VISIBLE&&isShown()));}
    @Override protected void onVisibilityChanged(View changed,int visibility){super.onVisibilityChanged(changed,visibility);call("visible",String.valueOf(isShown()));}
    @Override protected void onAttachedToWindow(){
        super.onAttachedToWindow();attached=true;iconsLoading=false;createWebView();getViewTreeObserver().addOnGlobalLayoutListener(layoutListener);
        enrichmentNetwork=new LyricsNetwork();enrichmentExecutor=java.util.concurrent.Executors.newSingleThreadExecutor();
        LyricsConfig.preferences(getContext()).registerOnSharedPreferenceChangeListener(listener);
        LyricsManager.getInstance().addListener(this);handler.post(tick);
    }
    @Override protected void onDetachedFromWindow(){
        LyricsSystemBars.release(this);
        if(getViewTreeObserver().isAlive())getViewTreeObserver().removeOnGlobalLayoutListener(layoutListener);
        restoreNativeContent();
        attached=false;handler.removeCallbacksAndMessages(null);
        LyricsConfig.preferences(getContext()).unregisterOnSharedPreferenceChangeListener(listener);
        LyricsManager.getInstance().removeListener(this);if(catalogSink!=null){LyricsRepository.unsubscribe(catalogSink);catalogSink=null;}
        if(enrichmentNetwork!=null)enrichmentNetwork.close();if(enrichmentExecutor!=null)enrichmentExecutor.shutdownNow();
        if(web!=null){web.removeJavascriptInterface("BDNative");web.stopLoading();removeView(web);web.destroy();web=null;}
        ready=false;identity="";pending.clear();super.onDetachedFromWindow();
    }
    private void createWebView(){
        if(web!=null)return;
        try{
            web=new WebView(getContext());web.setBackgroundColor(Color.TRANSPARENT);
            web.getSettings().setJavaScriptEnabled(true);web.getSettings().setAllowFileAccess(false);
            web.getSettings().setAllowContentAccess(false);web.getSettings().setDomStorageEnabled(false);
            web.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            web.getSettings().setSupportMultipleWindows(false);web.getSettings().setSaveFormData(false);
            web.getSettings().setTextZoom(Math.round(100*getResources().getConfiguration().fontScale));
            web.addJavascriptInterface(new Bridge(),"BDNative");
            web.setWebViewClient(new WebViewClient(){
                @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
                @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                    String url=request.getUrl().toString();
                    try{
                        if(url.startsWith(ROOT)){
                            String file=url.substring(ROOT.length());
                            if(file.matches("[A-Za-z0-9_.-]+")){
                                String mime=file.endsWith(".html")?"text/html":file.endsWith(".css")?"text/css":file.endsWith(".woff2")?"font/woff2":"application/javascript";
                                return new WebResourceResponse(mime,"UTF-8",getContext().getAssets().open("bdcrusher-lyrics/"+file));
                            }
                        }
                    }catch(Exception ignored){}
                    return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
                }
                @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){
                    ready=false;hasDisplay=false;setVisibility(View.INVISIBLE);removeView(view);view.destroy();web=null;return true;
                }
            });
            addView(web,new FrameLayout.LayoutParams(-1,-1));web.loadUrl(ROOT+"index.html");
        }catch(Exception ex){Logger.printException(()->"Could not initialize Better Lyrics WebView",ex);setVisibility(View.INVISIBLE);}
    }
    private void call(String method,String args){if(ready&&web!=null)web.evaluateJavascript("window.BDC&&window.BDC."+method+"("+args+")",null);}
    public void applySettings(){
        if(!ready)return;
        try{JSONObject options=LyricsConfig.read(getContext());options.put("offset",Settings.LYRICS_OFFSET_MS.get()+LyricsManager.getInstance().getTemporaryOffsetMs());
            if(cachedIcons!=null)options.put("buttonIcons",cachedIcons);else loadToolbarIcons();
            int pill=app.morphe.extension.shared.ResourceUtils.getColor("ytm_color_white_at_10pct",0x1AFFFFFF);options.put("pillColor",String.format(java.util.Locale.ROOT,"rgba(%d,%d,%d,%.3f)",android.graphics.Color.red(pill),android.graphics.Color.green(pill),android.graphics.Color.blue(pill),android.graphics.Color.alpha(pill)/255.0));call("settings",options.toString());
        }catch(Exception ex){LyricsDiagnostics.record("settings",ex.getClass().getSimpleName());}
    }
    private JSONObject cachedIcons;
    private boolean iconsLoading;
    private void loadToolbarIcons(){
        if(iconsLoading||enrichmentExecutor==null||enrichmentExecutor.isShutdown())return;
        iconsLoading=true;final int tint=app.morphe.extension.shared.theme.ThemeUtils.getAppForegroundColor();
        enrichmentExecutor.execute(()->{
            JSONObject icons=new JSONObject();
            try{
                String[] keys={"copy","translate","romanize","refresh"};String[] names={"morphe_yt_copy_bold","yt_outline_experimental_translate_vd_theme_24","morphe_yt_romanize","ic_mtrl_arrow_circle"};
                for(int i=0;i<keys.length;i++){
                    android.graphics.drawable.Drawable d=app.morphe.extension.shared.ResourceUtils.getDrawable(names[i]);if(d==null)continue;
                    android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(72,72,android.graphics.Bitmap.Config.ARGB_8888);d=d.mutate();d.setTint(tint);d.setBounds(0,0,72,72);d.draw(new android.graphics.Canvas(bitmap));
                    java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);bitmap.recycle();
                    icons.put(keys[i],"data:image/png;base64,"+android.util.Base64.encodeToString(out.toByteArray(),android.util.Base64.NO_WRAP));
                }
            }catch(Exception ex){LyricsDiagnostics.record("icons",ex.getClass().getSimpleName());}
            handler.post(()->{iconsLoading=false;if(attached){cachedIcons=icons;applySettings();}});
        });
    }
    private void updateTrack(){
        TrackInfo next=LyricsManager.getInstance().getCurrentTrack();
        if(next==null)return;
        String nextId=VideoInformation.getVideoId();
        if(nextId==null||!nextId.equals(LyricsManager.getInstance().getCommittedVideoId())){
            if(!identity.isEmpty()){
                identity="";generation++;hasDisplay=false;track=null;pending.clear();restoreNativeContent();setVisibility(View.INVISIBLE);
                if(catalogSink!=null)LyricsRepository.unsubscribe(catalogSink);catalogSink=null;
                if(ready)call("track","{\"generation\":"+generation+",\"title\":\"\",\"artist\":\"\",\"album\":\"\",\"duration\":0,\"videoId\":\"\"}");
            }
            return;
        }
        String key=LyricsRepository.identity(next,nextId);
        if(key.equals(identity))return;
        identity=key;track=next;generation++;hasDisplay=false;pending.clear();
        restoreNativeContent();setVisibility(View.INVISIBLE);if(catalogSink!=null)LyricsRepository.unsubscribe(catalogSink);
        if(ready)sendTrack();
        int expected=generation;
        boolean refresh=forceRefresh;forceRefresh=false;
        LyricsRepository.ensure(getContext(),track,nextId,refresh);
        catalogSink=new LyricsCatalog.Sink(){
            public void reconnect(){handler.postDelayed(()->{if(attached&&generation==expected&&NativeLyricsHost.isOpen())ServiceConnection.renew(getContext());},700);}
            public void result(JSONObject payload){handler.post(()->receive(expected,payload));}
            public void notice(String message,boolean finished){handler.post(()->{if(attached&&generation==expected&&ready)call("notice",expected+","+JSONObject.quote(message)+","+finished);});}
        };
        LyricsRepository.subscribe(catalogSink);
    }
    private void sendTrack(){
        if(track==null)return;
        try{call("track",new JSONObject().put("generation",generation).put("title",track.title()).put("artist",track.artist()).put("album",track.album()).put("duration",track.durationSeconds()).put("videoId",VideoInformation.getVideoId()).put("preferredSource",LyricsConfig.preferences(getContext()).getString("source_"+VideoInformation.getVideoId(),"")).toString());}catch(Exception ignored){}
    }
    private void receive(int expected,JSONObject payload){
        if(!attached||expected!=generation)return;
        if(!ready){if(pending.size()<64)pending.add(payload);return;}
        call("source",expected+","+payload);
    }
    private void reload(){identity="";updateTrack();}
    @Override public void onLyricsChanged(LyricsManager.State state,Lyrics lyrics){
        updateTrack();
        if(lyrics==null||lyrics.isEmpty()||track==null)return;
        try{
            String name=lyrics.providerName();String key=switch(name){
                case "YTMusic"->"yt-lyrics";case "Captions"->"yt-captions";default->null;
            };
            if(key==null)return;
            JSONObject payload=new JSONObject().put("key",key).put("source",name);
            if(lyrics.rawFormat()!=null&&!lyrics.rawFormat().isEmpty()&&java.util.Arrays.asList("ttml","lrc","qrc","txt","plain").contains(lyrics.formatType()))payload.put("raw",lyrics.rawFormat()).put("format",lyrics.formatType());
            else{
                JSONArray lines=new JSONArray();List<LyricsLine> source=lyrics.lines();
                for(int i=0;i<source.size();i++){
                    LyricsLine line=source.get(i);long start=Math.max(0,line.startTimeMs());
                    long end=line.endTimeMs()>start?line.endTimeMs():i+1<source.size()?Math.max(start,source.get(i+1).startTimeMs()):track.durationSeconds()*1000L;
                    JSONObject item=new JSONObject().put("startTimeMs",start).put("durationMs",lyrics.synced()?Math.max(0,end-start):0).put("words",line.text());
                    if(line.agentId()!=null)item.put("agent",line.agentId());
                    if(line.hasWords()){
                        JSONArray parts=new JSONArray();for(Word word:line.words())parts.put(new JSONObject().put("startTimeMs",Math.max(0,word.startMs())).put("durationMs",Math.max(0,word.endMs()-word.startMs())).put("words",word.text()+(word.endsWithSpace()?" ":"")).put("isBackground",line.isBG()));item.put("parts",parts);
                    }
                    lines.put(item);
                }payload.put("lyrics",lines);
            }
            receive(generation,payload);
        }catch(Exception ex){Logger.printException(()->"Could not adapt native lyric fallback",ex);}
    }
    // A displayed acknowledgement changes visibility only. Reconfiguring here feeds
    // settings -> render -> displayed -> settings forever through the JS bridge.
    private void restoreNativeContent(){for(var entry:covered.entrySet())entry.getKey().setVisibility(entry.getValue());covered.clear();}
    public void syncOverlay(){
        boolean show=Settings.LYRICS_ENABLED.get()&&hasDisplay&&NativeLyricsHost.owns(this);
        setKeepScreenOn(show&&Settings.LYRICS_KEEP_SCREEN_ON.get());
        if(show&&getParent() instanceof android.view.ViewGroup parent){for(int i=0;i<parent.getChildCount();i++){View child=parent.getChildAt(i);if(child!=this){covered.putIfAbsent(child,child.getVisibility());child.setVisibility(View.INVISIBLE);}}}
        else restoreNativeContent();
        setVisibility(show?View.VISIBLE:View.INVISIBLE);
        LyricsSystemBars.sync(this,Settings.LYRICS_ENABLED.get()&&NativeLyricsHost.owns(this)&&getWindowVisibility()==View.VISIBLE);
    }
    // Preserve the installer's settings callbacks while the personal controls own rendering.
    public void applyToolbarButtonSettings(){applySettings();}public void applyTextSize(){applySettings();}
    public void applyLyricLayoutSettings(){applySettings();}public void applyWordSyncSetting(){applySettings();}
    public void applyHideInfo(){applySettings();}public void applyShowSection(){applySettings();}
    public void applyLineOverlaySettings(){applySettings();}
    public final class Bridge {
        @JavascriptInterface public void ready(){handler.post(()->{if(!attached||web==null)return;ready=true;sendTrack();applySettings();for(JSONObject payload:pending)receive(generation,payload);pending.clear();});}
        @JavascriptInterface public void displayed(int id,String source){handler.post(()->{if(id==generation){hasDisplay=true;syncOverlay();}});}
        @JavascriptInterface public void noLyrics(int id){handler.post(()->{if(id==generation){hasDisplay=false;restoreNativeContent();setVisibility(View.INVISIBLE);}});}
        @JavascriptInterface public void dock(boolean collapsed){handler.post(()->LyricsConfig.preferences(getContext()).edit().putBoolean("dockCollapsed",collapsed).apply());}
        @JavascriptInterface public void copy(int id,String text){if(text.length()>100000)return;handler.post(()->{if(id!=generation)return;android.content.ClipboardManager cb=(android.content.ClipboardManager)getContext().getSystemService(Context.CLIPBOARD_SERVICE);cb.setPrimaryClip(android.content.ClipData.newPlainText("Lyrics",text));});}
        @JavascriptInterface public void diagnostic(int id,String source,String message){if(id==generation&&source.matches("[A-Za-z-]{1,64}")&&message.length()<=240)LyricsDiagnostics.record(source,message);}
        @JavascriptInterface public void seek(long milliseconds){handler.post(()->{
            if(!LyricsConfig.preferences(getContext()).getBoolean("tapSeek",true)||track==null)return;
            LyricsManager manager=LyricsManager.getInstance();
            long target=milliseconds+Settings.LYRICS_OFFSET_MS.get()+manager.getTemporaryOffsetMs();
            long duration=VideoInformation.getVideoLength();
            VideoInformation.seekTo(Math.max(0,duration>0?Math.min(duration,target):target));
        });}
        @JavascriptInterface public void refresh(){handler.post(()->{forceRefresh=true;reload();});}
        @JavascriptInterface public void pin(int id,String key){
            if(!key.isEmpty()&&!key.matches("[a-zA-Z-]{1,64}"))return;
            handler.post(()->{String videoId=VideoInformation.getVideoId();if(id!=generation||videoId==null||videoId.isEmpty())return;
                SharedPreferences.Editor editor=LyricsConfig.preferences(getContext()).edit();
                if(key.isEmpty())editor.remove("source_"+videoId);else editor.putString("source_"+videoId,key);editor.apply();
            });
        }
        @JavascriptInterface public void configure(){handler.post(()->LyricsConfig.show(getContext()));}
        @JavascriptInterface public void connect(){handler.post(()->ServiceConnection.show(getContext()));}
        @JavascriptInterface public void toggle(String kind){handler.post(()->{String key="translate".equals(kind)?"translation":"romanize".equals(kind)?"romanization":null;if(key!=null){SharedPreferences p=LyricsConfig.preferences(getContext());p.edit().putBoolean(key,!p.getBoolean(key,false)).apply();}});}
        @JavascriptInterface public void enrich(int id,String source,String body){
            if(body.length()>120000||source.length()>64)return;
            handler.post(()->{
                if(id!=generation||!attached||enrichmentExecutor==null||enrichmentExecutor.isShutdown())return;
                LyricsNetwork network=enrichmentNetwork;
                enrichmentExecutor.execute(()->{
                    if(id!=generation||!attached)return;
                    try{
                        JSONObject request=new JSONObject(body);int start=request.optInt("start",0);request.remove("start");
                        JSONObject response=LyricsEnrichment.fetch(network,request);
                        handler.post(()->{if(id==generation&&attached)call("enrichment",id+","+JSONObject.quote(source)+","+start+","+JSONObject.quote(request.optString("to","en"))+","+response);});
                    }catch(Exception ignored){handler.post(()->{if(id==generation&&ready)call("notice",id+","+JSONObject.quote("Translation or romanization service unavailable")+",false");});}
                });
            });
        }
        @JavascriptInterface public void offset(int delta){if(Math.abs(delta)!=100)return;handler.post(()->{LyricsManager manager=LyricsManager.getInstance();int next=Math.max(-30000,Math.min(30000,manager.getTemporaryOffsetMs()+delta));manager.setTemporaryOffsetMs(next);manager.persistTemporaryOffsetMs();applySettings();});}
    }
}
