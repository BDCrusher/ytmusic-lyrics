/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.shaders;

import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.util.AtomicFile;
import java.io.*;
import java.nio.ByteBuffer;

/** Finalize fragmented motion artwork for complete, stable file playback; no re-encoding. */
final class ArtworkFile {
    private static ByteBuffer sampleBuffer;
    private ArtworkFile() {}
    private static boolean fragmented(File file)throws IOException{
        try(RandomAccessFile input=new RandomAccessFile(file,"r")){
            long offset=0,length=input.length();int boxes=0;
            while(offset+8<=length){
                if(++boxes>4096)throw new IOException("Artwork container limit");
                input.seek(offset);long size=Integer.toUnsignedLong(input.readInt());int type=input.readInt();int header=8;
                if(size==1){size=input.readLong();header=16;}else if(size==0)size=length-offset;
                if(size<header||size>length-offset)throw new IOException("Incomplete artwork container");
                if(type==0x6d6f6f66)return true; // moof: final duration must be indexed after every fragment.
                offset+=size;
            }
            return false;
        }
    }

    static synchronized void ensure(File file) throws IOException {
        MediaExtractor extractor = new MediaExtractor();
        MediaMuxer muxer = null;
        File normalized = new File(file.getPath() + ".normalize");
        try {
            extractor.setDataSource(file.getPath());
            int track = -1;
            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                if (format.getString(MediaFormat.KEY_MIME).startsWith("video/")) {
                    if (track >= 0) throw new IOException("Multiple artwork video tracks");
                    track = i;
                }
            }
            if (track < 0) throw new IOException("Artwork video track absent");
            MediaFormat format = extractor.getTrackFormat(track);
            extractor.selectTrack(track);
            long first = extractor.getSampleTime();
            long duration = format.containsKey(MediaFormat.KEY_DURATION) ? format.getLong(MediaFormat.KEY_DURATION) : 0;
            if (first < 0) throw new IOException("Artwork samples absent");
            if (first == 0 && duration > 0 && !fragmented(file)) return;

            // Scan every fragment before muxing; never infer full duration from its first part.
            long origin = Long.MAX_VALUE;
            int count = 0;
            do {
                long timestamp = extractor.getSampleTime();
                if (timestamp < 0) break;
                if ((extractor.getSampleFlags() & MediaExtractor.SAMPLE_FLAG_ENCRYPTED) != 0)
                    throw new IOException("Encrypted artwork is unsupported");
                origin = Math.min(origin, timestamp);
                if (++count > 100000) throw new IOException("Artwork sample limit");
            } while (extractor.advance());
            if (count == 0) throw new IOException("Artwork samples absent");
            extractor.seekTo(first, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);
            muxer = new MediaMuxer(normalized.getPath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            if (format.containsKey(MediaFormat.KEY_ROTATION)) {
                int rotation = format.getInteger(MediaFormat.KEY_ROTATION);
                if (rotation == 0 || rotation == 90 || rotation == 180 || rotation == 270) muxer.setOrientationHint(rotation);
            }
            int outputTrack = muxer.addTrack(format);
            muxer.start();
            if(sampleBuffer==null)sampleBuffer=ByteBuffer.allocateDirect(16 * 1024 * 1024);
            ByteBuffer buffer = sampleBuffer;
            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            long copied = 0;
            int written = 0;
            while (extractor.getSampleTime() >= 0) {
                buffer.clear();
                int size = extractor.readSampleData(buffer, 0);
                if (size < 0) break;
                copied += size;
                if (size > buffer.capacity() || copied > 128L * 1024 * 1024) throw new IOException("Artwork remux limit");
                info.set(0, size, extractor.getSampleTime() - origin,
                        (extractor.getSampleFlags() & MediaExtractor.SAMPLE_FLAG_SYNC) != 0 ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0);
                muxer.writeSampleData(outputTrack, buffer, info);
                written++;
                if (!extractor.advance()) break;
            }
            if (written != count) throw new IOException("Incomplete artwork remux");
            muxer.stop();
            muxer.release();
            muxer = null;
            if (!normalized.isFile() || normalized.length() == 0 || normalized.length() > 128L * 1024 * 1024)
                throw new IOException("Invalid finalized artwork");

            // Keep the original intact until the complete index and normalized samples exist.
            AtomicFile atomic = new AtomicFile(file);
            FileOutputStream output = null;
            try (InputStream input = new FileInputStream(normalized)) {
                output = atomic.startWrite();
                byte[] bytes = new byte[65536];
                int size;
                while ((size = input.read(bytes)) >= 0) output.write(bytes, 0, size);
                atomic.finishWrite(output);
                output = null;
            } catch (Exception failed) {
                if (output != null) atomic.failWrite(output);
                throw new IOException("Could not commit finalized artwork", failed);
            }
        } catch (IOException failure) {
            throw failure;
        } catch (Exception failure) {
            throw new IOException("Artwork finalization failed", failure);
        } finally {
            extractor.release();
            if (muxer != null) try { muxer.release(); } catch (Exception ignored) {}
            if (normalized.isFile()) normalized.delete();
        }
    }
}
