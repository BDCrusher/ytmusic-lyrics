/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.net.Uri;
import android.widget.Toast;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

/** Normal public Turnstile flow in an unprivileged WebView; no native JS interface is exposed. */
final class ServiceConnection {
    private static java.lang.ref.WeakReference<AlertDialog> active=new java.lang.ref.WeakReference<>(null);
    private static long lastRenewal;
    static void renew(Context context){long now=android.os.SystemClock.elapsedRealtime();if(lastRenewal!=0&&now-lastRenewal<300000)return;lastRenewal=now;show(context);}
    static boolean expired(String jwt){return TokenExpiry.expired(jwt,System.currentTimeMillis()/1000);}
    private ServiceConnection(){}
    @SuppressLint("SetJavaScriptEnabled")
    static void show(Context context){
        AlertDialog previous=active.get();if(previous!=null&&previous.isShowing())return;
        WebView view=new WebView(context);view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);view.getSettings().setAllowFileAccess(false);view.getSettings().setAllowContentAccess(false);
        view.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){
                Uri uri=request.getUrl();return !"https".equals(uri.getScheme())||!("lyrics.api.dacubeking.com".equals(uri.getHost())||"challenges.cloudflare.com".equals(uri.getHost()));
            }
        });
        int height=(int)(220*context.getResources().getDisplayMetrics().density);view.setMinimumHeight(height);
        AlertDialog dialog=new AlertDialog.Builder(context).setTitle("Connect Better Lyrics sources")
            .setMessage("Complete the service’s verification. Access remains subject to its availability and rules.")
            .setView(view).setNegativeButton("Cancel",null).create();
        Handler handler=new Handler(Looper.getMainLooper());ExecutorService executor=Executors.newSingleThreadExecutor();LyricsNetwork network=new LyricsNetwork();
        boolean[] stopped={false},verifying={false};long deadline=android.os.SystemClock.uptimeMillis()+120000;
        Runnable poll=new Runnable(){public void run(){
            if(stopped[0]||verifying[0])return;
            if(android.os.SystemClock.uptimeMillis()>deadline){Toast.makeText(context,"Verification timed out",Toast.LENGTH_LONG).show();dialog.dismiss();return;}
            if(view.getUrl()!=null&&view.getUrl().startsWith(LyricsNetwork.BROKER+"challenge")){
                view.evaluateJavascript("window.turnstile ? window.turnstile.getResponse() : ''",encoded->{
                    try{
                        Object value=new JSONTokener(encoded).nextValue();
                        if(!(value instanceof String token)||token.isEmpty()||stopped[0]||verifying[0])return;
                        verifying[0]=true;
                        executor.execute(()->{
                            try{
                                JSONObject response=new JSONObject(network.request(LyricsNetwork.BROKER+"verify-turnstile","POST",new JSONObject().put("token",token).toString(),"application/json"));
                                String jwt=response.optString("jwt");if(jwt.isEmpty())throw new IllegalStateException("No token returned");
                                if(!stopped[0])LyricsConfig.preferences(context).edit().putString("serviceJwt",jwt).apply();
                                handler.post(()->{if(!stopped[0]){Toast.makeText(context,"Sources connected — refresh lyrics",Toast.LENGTH_LONG).show();dialog.dismiss();}});
                            }catch(Exception ex){handler.post(()->{if(!stopped[0]){Toast.makeText(context,"Service verification was not accepted",Toast.LENGTH_LONG).show();dialog.dismiss();}});}
                        });
                    }catch(Exception ignored){}
                });
            }
            handler.postDelayed(this,750);
        }};
        active=new java.lang.ref.WeakReference<>(dialog);
        dialog.setOnDismissListener(d->{stopped[0]=true;handler.removeCallbacksAndMessages(null);network.close();executor.shutdownNow();view.stopLoading();view.destroy();if(active.get()==dialog)active.clear();});
        dialog.show();view.loadUrl(LyricsNetwork.BROKER+"challenge");handler.postDelayed(poll,750);
    }
}
