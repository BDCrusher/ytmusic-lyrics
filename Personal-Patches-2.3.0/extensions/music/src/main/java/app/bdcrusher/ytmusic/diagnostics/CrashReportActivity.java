/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.diagnostics;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

/** Lets the user pick the destination of an otherwise private report. */
public final class CrashReportActivity extends Activity {
    private static final int SAVE_REPORT = 8942;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        PlaybackCrashRecorder.install(this);
        if (savedInstanceState != null) return;
        try {
            startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TITLE, "bdcrusher-music-crash-report.txt"), SAVE_REPORT);
        } catch (ActivityNotFoundException unavailable) {
            finishWithMessage(false);
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != SAVE_REPORT) return;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            PlaybackCrashRecorder.saveReport(data.getData(), this::finishWithMessage);
        } else {
            finish();
        }
    }

    private void finishWithMessage(boolean saved) {
        Toast.makeText(this, saved ? "Crash report saved" : "Could not save the crash report", Toast.LENGTH_SHORT).show();
        finish();
    }
}
