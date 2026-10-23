/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import java.nio.charset.StandardCharsets;

/** Preserve the registered native Music presentation, including its palette entity. */
final class NativePanelWire {
    static byte[] definition(byte[] original,String title,boolean fromRelated){
        ProtoWire panel=new ProtoWire(original);
        if(fromRelated){
            ProtoWire.Field style=panel.one(37),entity=panel.one(41);
            if(style==null||style.wire!=0||style.value!=4||entity==null||entity.wire!=2||entity.data.length==0)
                throw new IllegalArgumentException("Native Music palette binding unavailable");
            panel.remove(3); // Never show Related content in the Lyrics body.
            panel.put(ProtoWire.blob(18,ProtoWire.message(ProtoWire.number(1,1),ProtoWire.blob(3,NativeLyricsHost.ID.getBytes(StandardCharsets.UTF_8)))));
            byte[] header=ProtoWire.at(panel.child(2),new int[]{138681548,1},0,raw->{
                ProtoWire label=new ProtoWire(raw);label.put(ProtoWire.blob(4,title.getBytes(StandardCharsets.UTF_8)));return label.bytes();
            });
            panel.put(ProtoWire.blob(2,header));panel.put(ProtoWire.number(5,95102));
        }
        // Native enum: BELOW_THE_MINI_PLAYER = 4. Avoid the video-sized half sheet.
        panel.put(ProtoWire.blob(21,new byte[]{4}));
        panel.put(ProtoWire.number(20,1)); // Allow the native registry to update an existing definition.
        // Background style/entity, native header options and all other fields remain native.
        return panel.bytes();
    }
    static byte[] command(){
        byte[] id=ProtoWire.message(ProtoWire.number(1,1),ProtoWire.blob(3,NativeLyricsHost.ID.getBytes(StandardCharsets.UTF_8)));
        return ProtoWire.message(ProtoWire.blob(138681778,ProtoWire.message(ProtoWire.blob(10,id))));
    }
}
