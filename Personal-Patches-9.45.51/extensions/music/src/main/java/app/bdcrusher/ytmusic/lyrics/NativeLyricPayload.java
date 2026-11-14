/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;
import org.json.*;
import java.util.List;
import app.morphe.extension.music.patches.lyrics.model.*;
final class NativeLyricPayload {
 private NativeLyricPayload(){}
 static JSONObject from(Lyrics lyrics,TrackInfo track)throws JSONException {
            String name=lyrics.providerName();String key=switch(name){
                case "YTMusic"->"yt-lyrics";case "Captions"->"yt-captions";default->null;
            };
            if(key==null)return null;
            return from(lyrics,track,key);
 }
 static JSONObject from(Lyrics lyrics,TrackInfo track,String key)throws JSONException {
            String name=lyrics.providerName();
            JSONObject payload=new JSONObject().put("key",key).put("source",name);
            if(lyrics.sourceUrl()!=null)payload.put("sourceHref",lyrics.sourceUrl());
            if(lyrics.songwriters()!=null)payload.put("songwriters",new JSONArray(lyrics.songwriters()));
            if(lyrics.credits()!=null)payload.put("providerCredits",new JSONArray(lyrics.credits()));
            if(lyrics.agentNames()!=null)payload.put("agentNames",new JSONObject(lyrics.agentNames()));
            if(lyrics.about()!=null)payload.put("about",lyrics.about());
            // Retain native translations and romanizations in the saved payload even if a
            // particular renderer option is currently disabled.
            if(lyrics.translations()!=null)payload.put("nativeTranslations",auxiliary(lyrics.translations()));
            if(lyrics.romanizations()!=null)payload.put("nativeRomanizations",auxiliary(lyrics.romanizations()));
            if(lyrics.romanization()!=null)payload.put("nativeRomanization",texts(lyrics.romanization()));
            JSONArray sections=new JSONArray();
            for(LyricsLine line:lyrics.lines()){
                if(line.songPart()!=null&&!line.songPart().isBlank())
                    sections.put(new JSONObject().put("startTimeMs",line.startTimeMs()).put("label",line.songPart()));
            }
            if(sections.length()>0)payload.put("sections",sections);
            if(lyrics.rawFormat()!=null&&!lyrics.rawFormat().isEmpty()&&java.util.Arrays.asList("ttml","lrc","qrc","txt","plain").contains(lyrics.formatType()))payload.put("raw",lyrics.rawFormat()).put("format",lyrics.formatType());
            else{
                JSONArray lines=new JSONArray();List<LyricsLine> source=lyrics.lines();
                var retimed=lyrics.synced()?LyricsRetiming.retimeLyrics(source,null,null):List.<LyricsRetiming.RetimedEntry>of();
                for(int i=0;i<source.size();i++){
                    LyricsLine line=source.get(i);long start=Math.max(0,line.startTimeMs());
                    long end=line.endTimeMs()>start?line.endTimeMs():retimed.isEmpty()?start:retimed.get(i).actualEndTimeMs();
                    if(end<=start&&lyrics.synced())end=track.durationSeconds()*1000L;
                    JSONObject item=new JSONObject().put("startTimeMs",start).put("durationMs",lyrics.synced()?Math.max(0,end-start):0).put("words",line.text());
                    if(line.agentId()!=null)item.put("agent",line.agentId());
                    item.put("isBackground",line.isBG());
                    if(lyrics.translations()!=null){JSONObject translations=new JSONObject();for(var entry:lyrics.translations().entrySet())if(entry.getValue()!=null&&i<entry.getValue().size())translations.put(entry.getKey(),entry.getValue().get(i).text());item.put("translations",translations);}
                    if(lyrics.romanization()!=null&&i<lyrics.romanization().size())item.put("romanization",lyrics.romanization().get(i).text());
                    if(line.hasWords()){
                        JSONArray parts=new JSONArray();for(Word word:line.words())parts.put(new JSONObject().put("startTimeMs",Math.max(0,word.startMs())).put("durationMs",Math.max(0,word.endMs()-word.startMs())).put("words",word.text()+(word.endsWithSpace()?" ":"")).put("isBackground",line.isBG()));item.put("parts",parts);
                    }
                    lines.put(item);
                }payload.put("lyrics",lines);
            }
            return payload;
 }
 private static JSONArray texts(List<LyricsLine> lines){JSONArray values=new JSONArray();for(LyricsLine line:lines)values.put(line.text());return values;}
 private static JSONObject auxiliary(java.util.Map<String,List<LyricsLine>> values)throws JSONException{JSONObject out=new JSONObject();for(var e:values.entrySet())if(e.getValue()!=null)out.put(e.getKey(),texts(e.getValue()));return out;}
}
