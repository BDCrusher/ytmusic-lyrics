/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

/** Bounded transient retries; never retry denial, not-found, invalid data or TLS failures. */
final class LyricsRetry {
    private LyricsRetry(){}
    static long delay(Exception failure,int completedAttempts){
        if(completedAttempts>=3)return -1;
        long delay=completedAttempts==1?750:2000;
        if(failure instanceof LyricsNetwork.HttpFailure http){
            if(http.status!=408&&http.status!=429&&http.status!=500&&http.status!=502&&http.status!=503&&http.status!=504)return -1;
            if(http.retryAfterMs>15000)return -1; // Respect a long server backoff without holding a track worker.
            return Math.max(delay,http.retryAfterMs);
        }
        if(failure instanceof java.io.IOException&&!(failure instanceof javax.net.ssl.SSLException)
                &&!(failure instanceof java.net.ProtocolException)&&!(failure instanceof LyricsNetwork.PayloadLimit))return delay;
        return -1;
    }
}
