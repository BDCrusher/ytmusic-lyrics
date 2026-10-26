/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.shaders;
import android.content.*;
import android.graphics.Bitmap;
import android.media.MediaMetadata;
import android.media.session.PlaybackState;
import android.os.*;
import android.view.*;
import android.widget.*;
import java.io.File;
import java.lang.ref.WeakReference;
import java.util.*;
import org.json.*;
import app.bdcrusher.ytmusic.common.PersonalRuntime;
import app.morphe.extension.music.shared.VideoInformation;
import app.morphe.extension.shared.Utils;

/** Typed native callbacks. Only registered player/native Lyrics containers can host effects. */
public final class ShaderRuntime {
    private static final Handler main=new Handler(Looper.getMainLooper());
    private static final Map<View,Binding> surfaces=new WeakHashMap<>();
    private static MediaMetadata metadata;
    private static Bitmap artwork;
    private static File media;
    private static String identity="",mediaKey="";
    private static int generation;
    private static int panelEpoch;
    private static boolean playing,watching;
    private static volatile boolean effectsActive;
    private static SharedPreferences preferences;
    private static ArtworkRepository.Track currentTrack;
    private static long lastLookup;
    private static WeakReference<View> lyricsBody=new WeakReference<>(null);
    private static WeakReference<Object> panelOwner=new WeakReference<>(null);
    private ShaderRuntime(){}
    static int generation(){return generation;}
    public static boolean isEffectSurface(View view){return view instanceof ShaderSurface;}
    private static boolean enabled(Context c){return PersonalRuntime.installed(c,"shaders");}
    private static final SharedPreferences.OnSharedPreferenceChangeListener changed=(p,k)->main.post(()->{refresh();if("mediaLimit".equals(k))ArtworkRepository.trim(Utils.getContext());if("artworkToken".equals(k)||"enabled".equals(k)){lastLookup=0;retryArtwork();}});
    private static void init(Context c){if(!watching){watching=true;preferences=ArtworkRepository.preferences(c);preferences.registerOnSharedPreferenceChangeListener(changed);VideoInformation.addVideoIdListener(id->main.post(ShaderRuntime::track));
        try{android.net.ConnectivityManager connectivity=(android.net.ConnectivityManager)c.getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);connectivity.registerDefaultNetworkCallback(new android.net.ConnectivityManager.NetworkCallback(){@Override public void onCapabilitiesChanged(android.net.Network n,android.net.NetworkCapabilities capabilities){if(capabilities.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)&&capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_NOT_METERED))main.post(()->{lastLookup=0;retryArtwork();});}});}catch(Exception unavailable){}
    }}
    static boolean active(){return effectsActive;}
    static void retryArtwork(){
        if(currentTrack==null||media!=null||!active()||lastLookup!=0&&SystemClock.elapsedRealtime()-lastLookup<30000)return;
        lastLookup=SystemClock.elapsedRealtime();int expected=generation;
        ArtworkRepository.lookup(Utils.getContext(),currentTrack,(file,key)->{if(generation!=expected)return;media=file;mediaKey=key;refresh();});
    }
    public static void onMetadata(MediaMetadata value){main.post(()->{metadata=value;track();});}
    public static void onPlayback(PlaybackState value){boolean active=value!=null&&value.getState()==PlaybackState.STATE_PLAYING;main.post(()->{playing=active;refresh();});}
    private static void track(){
        Context c=Utils.getActivity();if(c==null||!enabled(c)||metadata==null)return;init(c);
        String id=VideoInformation.getVideoId();if(id==null||!id.matches("[A-Za-z0-9_-]{11}"))return;
        String mediaId=metadata.getString(MediaMetadata.METADATA_KEY_MEDIA_ID);if(mediaId!=null&&mediaId.matches("[A-Za-z0-9_-]{11}")&&!id.equals(mediaId))return;
        String title=metadata.getString(MediaMetadata.METADATA_KEY_TITLE),artist=metadata.getString(MediaMetadata.METADATA_KEY_ARTIST),album=metadata.getString(MediaMetadata.METADATA_KEY_ALBUM);
        if(title==null||artist==null)return;String next=id+"|"+title+"|"+artist+"|"+album;
        if(next.equals(identity)){refresh();return;}identity=next;generation++;int expected=generation;media=null;mediaKey="";
        Bitmap cover=metadata.getBitmap(MediaMetadata.METADATA_KEY_ART);if(cover==null)cover=metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);artwork=cover;
        for(Binding binding:new ArrayList<>(surfaces.values())){binding.surface.clearImage();if(artwork!=null)binding.surface.image(artwork,expected);}
        currentTrack=new ArtworkRepository.Track(id,title,artist,album==null?"":album,(int)(metadata.getLong(MediaMetadata.METADATA_KEY_DURATION)/1000));lastLookup=0;retryArtwork();refresh();
    }
    @android.annotation.SuppressLint("ResourceType")
    public static void onArtwork(View player,Bitmap bitmap){
        if(!enabled(player.getContext()))return;artwork=bitmap;
        View anchor=player.findViewById(0x7f0b0943); // Exact APK resource verified with the artwork-owner fingerprint.
        if(anchor!=null)watch(anchor,true);for(Binding binding:new ArrayList<>(surfaces.values())){if(bitmap!=null)binding.surface.image(bitmap,generation);else binding.surface.clearImage();}refresh();
    }
    public static void onPlayerBackground(View view){if(enabled(view.getContext()))watch(view,false);}
    private static void watch(View anchor,boolean cover){
        if(surfaces.containsKey(anchor))return;init(anchor.getContext());
        if(anchor.getParent() instanceof ViewGroup parent&&anchor.isAttachedToWindow()){Binding binding=new Binding(anchor,parent,cover);surfaces.put(anchor,binding);track();binding.update();}
        else anchor.addOnAttachStateChangeListener(new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){v.removeOnAttachStateChangeListener(this);watch(v,cover);}public void onViewDetachedFromWindow(View v){}});
    }
    static void refresh(){effectsActive=false;for(Binding binding:new ArrayList<>(surfaces.values())){binding.update();effectsActive|=!binding.closed&&binding.anchor.isShown()&&binding.anchor.hasWindowFocus()&&ArtworkRepository.preferences(binding.anchor.getContext()).getBoolean("enabled",true);}if(effectsActive)retryArtwork();}
    static void mediaFailed(){ArtworkRepository.invalidate(Utils.getContext(),mediaKey);media=null;lastLookup=SystemClock.elapsedRealtime();refresh();}
    static boolean requestProof(int id,JSONObject challenge){for(Binding binding:new ArrayList<>(surfaces.values()))if(binding.surface.solve(id,challenge))return true;return false;}
    public static void onNativePanel(Object panel){
        main.post(()->{
            if(panel==panelOwner.get()){refresh();return;}panelOwner=new WeakReference<>(panel);
            int epoch=++panelEpoch;
            View previous=lyricsBody.get();if(previous!=null){Binding old=surfaces.remove(previous);if(old!=null)old.close();lyricsBody.clear();}
            if(panel==null){refresh();return;}
            try{String id=nativePanelId(panel);if(!"music_watch_lyrics_panel".equals(id)&&!"music_offline_lyrics_panel".equals(id)){refresh();return;}attachLyrics(panel,0,epoch);}
            catch(Exception ignored){}
        });
    }
    private static void attachLyrics(Object panel,int attempt,int epoch){
        if(epoch!=panelEpoch)return;
        try{View root=nativePanelView(panel);if(root==null||!enabled(root.getContext()))return;if(!(root instanceof FrameLayout body))return;
            if(!root.isAttachedToWindow()){if(attempt<30)main.postDelayed(()->attachLyrics(panel,attempt+1,epoch),32);return;}
            Binding binding=new Binding(root,body,false);surfaces.put(root,binding);lyricsBody=new WeakReference<>(root);refresh();
        }catch(Exception ignored){}
    }
    // Replaced with typed native panel calls by the exact-target Shaders patch.
    private static String nativePanelId(Object value){throw new IllegalStateException("Missing native panel identity hook");}
    private static View nativePanelView(Object value){throw new IllegalStateException("Missing native panel root hook");}
    private static final class Binding implements AutoCloseable {
        final View anchor;final ViewGroup parent;final ShaderSurface surface;final boolean cover;
        boolean closed;
        final ViewTreeObserver.OnGlobalLayoutListener layout=this::update;
        final ViewTreeObserver.OnWindowFocusChangeListener focus=this::focusChanged;
        void focusChanged(boolean focused){refresh();if(focused){retryArtwork();ArtworkToken.ensure(anchor.getContext());}}
        final View.OnAttachStateChangeListener attachment=new View.OnAttachStateChangeListener(){public void onViewAttachedToWindow(View v){update();}public void onViewDetachedFromWindow(View v){surfaces.remove(anchor);close();}};
        Binding(View a,ViewGroup p,boolean image){anchor=a;parent=p;cover=image;surface=new ShaderSurface(a.getContext());surface.setClipToOutline(true);surface.setOutlineProvider(a.getOutlineProvider());
            ViewGroup.LayoutParams params=a==p?new FrameLayout.LayoutParams(-1,-1):a.getLayoutParams();
            int index=a==p?0:p.indexOfChild(a)+1;p.addView(surface,index,params);
            a.addOnAttachStateChangeListener(attachment);a.getViewTreeObserver().addOnGlobalLayoutListener(layout);a.getViewTreeObserver().addOnWindowFocusChangeListener(focus);if(artwork!=null)surface.image(artwork,generation);update();
        }
        void update(){if(closed)return;SharedPreferences prefs=ArtworkRepository.preferences(anchor.getContext());boolean master=prefs.getBoolean("enabled",true);
            if(anchor!=parent){if(surface.getLayoutParams()!=anchor.getLayoutParams())surface.setLayoutParams(anchor.getLayoutParams());if(surface.getTranslationX()!=anchor.getTranslationX())surface.setTranslationX(anchor.getTranslationX());if(surface.getTranslationY()!=anchor.getTranslationY())surface.setTranslationY(anchor.getTranslationY());if(surface.getScaleX()!=anchor.getScaleX())surface.setScaleX(anchor.getScaleX());if(surface.getScaleY()!=anchor.getScaleY())surface.setScaleY(anchor.getScaleY());}
            boolean visible=master&&anchor.isShown()&&anchor.getWindowVisibility()==View.VISIBLE&&anchor.hasWindowFocus()&&anchor.getAlpha()>0;
            View panel=lyricsBody.get();if(panel!=null&&panel!=anchor&&panel.isShown())visible=false;
            boolean show=cover?prefs.getBoolean("animatedCover",true)&&media!=null:prefs.getBoolean("background",true);
            surface.setVisibility(visible&&show?View.VISIBLE:View.INVISIBLE);surface.setAlpha(anchor==parent?1:anchor.getAlpha());
            try{boolean reduced=prefs.getBoolean("reducedMotion",false)||SettingsMotion.reduced(anchor.getContext());
                JSONObject options=new JSONObject().put("animateBackground",prefs.getBoolean("animateBackground",true)).put("fps",Integer.parseInt(prefs.getString("fps","30"))).put("speed",prefs.getInt("speed",100)/100.0).put("strength",prefs.getInt("strength",100)/100.0).put("saturation",prefs.getInt("saturation",150)/100.0).put("opacity",prefs.getInt("opacity",75)/100.0).put("dimming",prefs.getInt("dimming",30)/100.0).put("transition",prefs.getInt("transition",1000)).put("reducedMotion",reduced);
                JSONObject state=new JSONObject().put("generation",generation).put("playing",playing).put("visible",visible&&show).put("cover",cover).put("background",!cover).put("image",surface.imageUrl()).put("video",media==null?"":ShaderSurface.ROOT+"cover.mp4?g="+generation);
                surface.update(state,options,media);
            }catch(Exception invalid){surface.setVisibility(View.INVISIBLE);}
        }
        public void close(){if(closed)return;closed=true;anchor.removeOnAttachStateChangeListener(attachment);if(anchor.getViewTreeObserver().isAlive()){anchor.getViewTreeObserver().removeOnGlobalLayoutListener(layout);anchor.getViewTreeObserver().removeOnWindowFocusChangeListener(focus);}parent.removeView(surface);surface.closeSurface();}
    }
    private static final class SettingsMotion {static boolean reduced(Context c){try{return android.provider.Settings.Global.getFloat(c.getContentResolver(),android.provider.Settings.Global.ANIMATOR_DURATION_SCALE,1)==0;}catch(Exception unavailable){return false;}}}
}
