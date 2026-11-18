/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.shaders;

import android.app.Activity;
import android.app.Application;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/** Scoped foreground tracking for the Shaders Single. */
public final class ShaderLifecycle implements Application.ActivityLifecycleCallbacks {
    private static ShaderLifecycle instance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable hide = () -> ShaderRuntime.hostVisible(false);
    private int visibleActivities;

    public static void attach(Activity activity) {
        if (instance != null) return;
        instance = new ShaderLifecycle();
        activity.getApplication().registerActivityLifecycleCallbacks(instance);
    }

    @Override public void onActivityStarted(Activity activity) {
        visibleActivities++;
        handler.removeCallbacks(hide);
        ShaderRuntime.hostVisible(true);
    }

    @Override public void onActivityStopped(Activity activity) {
        if (visibleActivities > 0 && --visibleActivities == 0) handler.post(hide);
    }

    @Override public void onActivityCreated(Activity activity, Bundle state) {}
    @Override public void onActivityResumed(Activity activity) {}
    @Override public void onActivityPaused(Activity activity) {}
    @Override public void onActivitySaveInstanceState(Activity activity, Bundle state) {}
    @Override public void onActivityDestroyed(Activity activity) {}
}
