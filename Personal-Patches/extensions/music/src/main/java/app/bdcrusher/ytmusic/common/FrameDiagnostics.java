/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;
import android.os.*;
import android.view.*;
/** Actual Android window timings; registered only during enabled diagnostic captures. */
final class FrameDiagnostics implements AutoCloseable {
    private final Window window;private HandlerThread thread;
    private final Handler main=new Handler(Looper.getMainLooper());private final Runnable expiry=this::update;
    private long frames,late,worst,layout,draw,reportAt,lost;private boolean closed,unavailableWindow;private volatile long epoch;
    private Window.OnFrameMetricsAvailableListener listener;
    private synchronized void collect(long expected,Window w,FrameMetrics m,int dropped){
        if(expected!=epoch||!FeatureDiagnostics.detailed())return;lost+=dropped;if(m.getMetric(FrameMetrics.FIRST_DRAW_FRAME)!=0)return;
        long total=m.getMetric(FrameMetrics.TOTAL_DURATION);if(total<=0)return;frames++;worst=Math.max(worst,total);layout=Math.max(layout,m.getMetric(FrameMetrics.LAYOUT_MEASURE_DURATION));draw=Math.max(draw,m.getMetric(FrameMetrics.DRAW_DURATION));
        float hz=w.getDecorView().getDisplay()==null?60:w.getDecorView().getDisplay().getRefreshRate();if(total>1_000_000_000L/Math.max(24,hz))late++;
        long now=SystemClock.elapsedRealtime();if(now>=reportAt){FeatureDiagnostics.event("Android-frames","entry="+FeatureDiagnostics.entry()+" lyricsOpen="+FeatureDiagnostics.panelOpen()+" frames="+frames+" overBudget="+late+" worstMs="+worst/1_000_000+" layoutMaxMs="+layout/1_000_000+" drawMaxMs="+draw/1_000_000+" listenerDrops="+lost);frames=late=worst=layout=draw=lost=0;reportAt=now+2000;}
    }
    FrameDiagnostics(Window w){window=w;}
    synchronized void update(){
        main.removeCallbacks(expiry);if(closed)return;
        if(FeatureDiagnostics.detailed()){
            if(unavailableWindow)return;
            if(thread==null)try{thread=new HandlerThread("YTMusic-frame-diagnostics");thread.start();frames=late=worst=layout=draw=lost=0;long expected=++epoch;listener=(w,m,d)->collect(expected,w,m,d);reportAt=SystemClock.elapsedRealtime()+2000;window.addOnFrameMetricsAvailableListener(listener,new Handler(thread.getLooper()));}
            catch(Exception unavailable){unavailableWindow=true;release();FeatureDiagnostics.record("Android-frames","Window metrics unavailable: "+unavailable.getClass().getSimpleName());return;}
            main.postDelayed(expiry,2000);
        }else{unavailableWindow=false;release();}
    }
    private synchronized void release(){if(thread!=null){epoch++;try{window.removeOnFrameMetricsAvailableListener(listener);}catch(Exception ignored){}finally{thread.quitSafely();thread=null;}}}

    public void close(){closed=true;main.removeCallbacks(expiry);release();}
}
