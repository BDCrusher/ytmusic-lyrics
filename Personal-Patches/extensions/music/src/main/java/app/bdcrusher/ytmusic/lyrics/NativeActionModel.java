/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Edits the actual video_action_bar model before native Elements rendering. */
final class NativeActionModel {
    // Android Music 9.42.52 public native response; guarded by the component URI and VM shape.
    private static final int[] ACTION_PATH={172660663,1,168777401,5,389155117};
    private static final int[] BUTTON_PATH={10,461054335};
    static byte[] enable(byte[] element){
        if(!contains(element,"video_action_bar.eml"))return element;
        try{return ProtoWire.at(element,ACTION_PATH,0,NativeActionModel::update);}
        catch(IllegalArgumentException ex){LyricsDiagnostics.record("Lyrics action model","Unsupported native button model: "+ex.getMessage());return element;}
    }
    private static byte[] update(byte[] input){
        ProtoWire row=new ProtoWire(input);List<ProtoWire.Field> buttons=new ArrayList<>();
        for(ProtoWire.Field f:row.fields)if(f.number==4){if(f.wire!=2)throw new IllegalArgumentException("action wire type");buttons.add(f);}
        if(buttons.size()<2||buttons.size()>32)throw new IllegalArgumentException("action count");
        int lyrics=-1,like=-1;
        for(int i=0;i<buttons.size();i++){
            byte[] raw=buttons.get(i).data;
            if(contains(raw,"_thumb_up_")){if(like>=0)throw new IllegalArgumentException("ambiguous Like action");like=i;}
            boolean lyric=false;
            try{
                byte[] vm=path(raw,BUTTON_PATH);ProtoWire model=new ProtoWire(vm);ProtoWire.Field icon=model.one(2);
                lyric=icon!=null&&icon.wire==2&&contains(icon.data,"_quote_");
            }catch(IllegalArgumentException ignored){/* Other native action types are retained verbatim. */}
            if(lyric){if(lyrics>=0)throw new IllegalArgumentException("ambiguous Lyrics action");lyrics=i;}
        }
        if(lyrics<0||like<0)throw new IllegalArgumentException("missing Lyrics/Like action");
        final boolean[] changed={false};
        byte[] patched=ProtoWire.at(buttons.get(lyrics).data,BUTTON_PATH,0,raw->{
            ProtoWire vm=new ProtoWire(raw);ProtoWire.Field state=vm.one(14),title=vm.one(3);
            if(title==null||title.wire!=2||title.data.length>256)throw new IllegalArgumentException("Lyrics title");
            if(state!=null&&(state.wire!=0||state.value!=3))throw new IllegalArgumentException("unrecognized Lyrics state");
            // Absent state is the same normal enabled state used by Comments/Share/Save.
            if(state!=null){vm.remove(14);vm.remove(38);changed[0]=true;}
            if(vm.one(4)==null){vm.put(ProtoWire.blob(4,ProtoWire.message(ProtoWire.blob(169495254,NativePanelWire.command()))));changed[0]=true;}
            return changed[0]?vm.bytes():raw;
        });
        ProtoWire.Field item=ProtoWire.blob(4,patched);buttons.remove(lyrics);if(lyrics<like)like--;
        buttons.add(like+1,item);
        if(!changed[0]&&lyrics==like+1)return input;
        int i=0;for(int n=0;n<row.fields.size();n++)if(row.fields.get(n).number==4)row.fields.set(n,buttons.get(i++));
        LyricsDiagnostics.record("Lyrics action model","Enabled native Lyrics model after Like/Dislike");
        return row.bytes();
    }
    private static byte[] path(byte[] bytes,int[] path){for(int f:path)bytes=new ProtoWire(bytes).child(f);return bytes;}
    static boolean contains(byte[] bytes,String text){byte[] find=text.getBytes(StandardCharsets.US_ASCII);outer:for(int i=0;i<=bytes.length-find.length;i++){for(int j=0;j<find.length;j++)if(bytes[i+j]!=find[j])continue outer;return true;}return false;}
}
