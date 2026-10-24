/* BDCrusher's Android host for Braccato. Copyright 2026 BDCrusher. GPL-3.0. */
import { createLyricsRenderer, resetPlaybackClock, injectTranslation, injectRomanization } from '@braccato/core';
import { parseTTMLContent, parseLRC, parseQRC, PlainParser } from '@braccato/parsers';
import { processStreamData, fillTtml } from './upstream-providers.ts';
import { stringSimilarity } from './lyric-parse-utils.ts';
import { catalog, controls } from './catalog.js';
import { createViewportMotion } from './viewport-motion.js';

export const PRIORITY = ['bLyrics-richsynced','unison-richsynced','binimum-richsynced',
  'unison-wordsynced','portato-richsynced','musixmatch-richsync','bLyrics-synced',
  'unison-synced','yt-captions','binimum-synced','lrclib-synced','legato-synced',
  'musixmatch-synced','yt-lyrics','unison-plain','lrclib-plain'];
const $ = id => document.getElementById(id);
const native = window.BDNative;
let settings = {fontSize:28, letterWave:true, wordSync:true, background:true,
  bgSize:0.65, bgOpacity:0.7, agents:{}, translation:false, romanization:false,
  language:'en', passive:false, tapSeek:true, reducedMotion:false};
let generation = -1, params, selected = '', pinned = '', currentResult;
let clock = {position:0,playing:false,rate:1,received:performance.now()};
let active = true, raf = 0, enrichmentGeneration = 0;
let availableKeys = [], autoPreferred='', collapsed = false;
const reportedMismatches=new Set();
const icon = (key) => catalog.icons[catalog.providers.find(p=>p.key===key)?.type] || '';
const config = key => catalog.providers.find(p=>p.key===key);
function svgInto(target,svg){target.replaceChildren();if(!svg)return;const doc=new DOMParser().parseFromString(svg,'image/svg+xml');if(!doc.querySelector('parsererror'))target.appendChild(document.importNode(doc.documentElement,true));}
for(const [key,svg] of Object.entries(controls)){if($(key))svgInto($(key),svg);}
svgInto($('collapse'),controls.chevron);
svgInto($('copy'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="12" height="15" rx="1.5"/><path d="M4 7v14h12"/></svg>');
const arrow=direction=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${direction<0?'M14 6l-6 6 6 6':'M10 6l6 6-6 6'}"/></svg>`;
svgInto($('previous'),arrow(-1));svgInto($('next'),arrow(1));
for(const [id,path] of [['earlier','M5 12h14'],['later','M5 12h14M12 5v14']])svgInto($(id),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${path}"/></svg>`);
// Like the extension, the flyout lives in body: a blurred pill is a backdrop root.
document.body.appendChild($('source-menu'));
let menuCloseTimer,menuEpoch=0;
function closeSources(){const menu=$('source-menu');menuEpoch++;clearTimeout(menuCloseTimer);menu.classList.remove('open');menu.inert=true;$('source-label').setAttribute('aria-expanded','false');menuCloseTimer=setTimeout(()=>{menu.hidden=true;},settings.reducedMotion?0:160);}
function positionSources(){const menu=$('source-menu'),rect=$('source-label').getBoundingClientRect();menu.style.maxHeight=`${Math.max(48,Math.min(240,rect.top-16))}px`;menu.style.left=`${Math.max(8,Math.min(rect.left-4,innerWidth-menu.offsetWidth-8))}px`;menu.style.bottom=`${innerHeight-rect.top+8}px`;}
function openSources(){if(!availableKeys.length)return;clearTimeout(menuCloseTimer);const epoch=++menuEpoch,menu=$('source-menu');menu.hidden=false;menu.inert=false;positionSources();requestAnimationFrame(()=>{if(epoch===menuEpoch)menu.classList.add('open');});$('source-label').setAttribute('aria-expanded','true');}
function selectSource(key){pinned=key===autoPreferred?'':key;native?.pin(generation,pinned);closeSources();choose(true);}
function updateDock(){
  const entry=config(selected),i=availableKeys.indexOf(selected);
  $('source-name').textContent=entry?.name||(availableKeys.length?'Choose a source':'Looking for lyrics…');
  $('source-position').textContent=i<0?'':`${i+1}/${availableKeys.length}`;
  svgInto($('source-icon'),icon(selected));$('source-icon').style.color=catalog.colors[entry?.type]||'inherit';
  $('previous').disabled=$('next').disabled=availableKeys.length<2;
  const menu=$('source-menu');menu.replaceChildren();
  menu.style.setProperty('--dock-accent',catalog.colors[entry?.type]||'#fde69b');
  for(const key of availableKeys){const p=config(key),button=document.createElement('button'),image=document.createElement('span'),label=document.createElement('span');
    svgInto(image,icon(key));image.style.color=catalog.colors[p.type];label.textContent=p.name;button.append(image,label);button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(key===selected));button.setAttribute('aria-label',`${p.name}, ${p.type}`);button.classList.toggle('selected',key===selected);button.onclick=()=>selectSource(key);menu.append(button);}
  if(menu.classList.contains('open'))positionSources();
}
function setCollapsed(value,persist=false){collapsed=value===true;$('dock').classList.toggle('collapsed',collapsed);$('collapse').setAttribute('aria-expanded',String(!collapsed));$('collapse').setAttribute('aria-label',collapsed?'Expand lyrics controls':'Collapse lyrics controls');$('dock-content').inert=collapsed;closeSources();if(persist)native?.dock(collapsed);}
let dockLayoutTimer,lastDockClearance=-1;
function settleDockLayout(){
  clearTimeout(dockLayoutTimer);
  const height=Math.round($('dock').getBoundingClientRect().height+12);
  if(height===lastDockClearance)return;
  lastDockClearance=height;document.documentElement.style.setProperty('--dock-clearance',`${height}px`);renderer.relayout();
}
const dockResize=new ResizeObserver(()=>{
  if($('source-menu').classList.contains('open'))positionSources();
  clearTimeout(dockLayoutTimer);dockLayoutTimer=setTimeout(settleDockLayout,64);
});
$('dock-content').addEventListener('transitionend',event=>{if(event.propertyName==='grid-template-rows')settleDockLayout();});
const enrichmentRequested=new Set();
let renderer = createLyricsRenderer({document,window,mount:$('lyrics'),host:{
  getScrollElement:()=>$('scroll'),
  isViewVisible:()=>active && !document.hidden,
  setResumeAffordanceVisible:visible=>$('resume').hidden=!visible,
  seek:seconds=>{if(settings.tapSeek){viewportMotion?.settle();native?.seek(Math.round(seconds*1000));renderer.resumeAutoscroll();}},
  log:message=>native?.diagnostic(generation,'Renderer',String(message).slice(0,240)),
}});
const viewportMotion=createViewportMotion($('scroll'));
const systemReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function configureMotion(){viewportMotion?.configure(renderer.syncType!=='none'&&renderer.syncType!=='plain',settings.reducedMotion||systemReducedMotion.matches);}
systemReducedMotion.addEventListener('change',configureMotion);

function theme() {
  const css = `/* blyrics-letter-wave = ${settings.letterWave&&!settings.reducedMotion&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches};
    blyrics-disable-richsync = ${!settings.wordSync}; */`;
  const rebuild=renderer.setTheme(css);
  const root=document.documentElement.style;
  root.setProperty('--blyrics-font-size',`${settings.fontSize}px`);
  root.setProperty('--bd-bg-size',String(settings.bgSize));
  root.setProperty('--bd-bg-opacity',String(settings.bgOpacity));
  document.body.classList.toggle('no-background',!settings.background);
  document.body.classList.toggle('reduce-motion',settings.reducedMotion);
  const rules=[];
  if(['left','center','right'].includes(settings.bgAlignment))rules.push(`.blyrics-background-line{text-align:${settings.bgAlignment}}`);
  for(const [agent,alignment] of Object.entries(settings.agents||{})) {
    if(!/^v\d+$/.test(agent)||!['left','center','right'].includes(alignment))continue;
    const origin=alignment==='center'?'center':alignment;
    rules.push(`.blyrics--line[data-agent="${agent}"]{text-align:${alignment};transform-origin:${origin} center}`);
    rules.push(`.blyrics--line[data-agent="${agent}"]>.blyrics--romanized{margin-left:${alignment==='left'?'0':'auto'};margin-right:${alignment==='right'?'0':'auto'}}`);
  }
  $('agents').textContent=rules.join('\n');
  return rebuild;
}

function parsePayload(payload) {
  const text=payload.raw;
  if(payload.format==='ttml') return parseTTMLContent(text,{songDurationMs:params.duration*1000}).lyrics;
  if(payload.format==='lrc')return parseLRC(text,params.duration*1000);
  if(payload.format==='qrc')return parseQRC(text,params.duration*1000,{title:params.song,artist:params.artist});
  if(payload.lyrics)return payload.lyrics;
  return PlainParser.parse(text||'');
}

function put(key,result) {
  if(!params?.sourceMap[key]||!result?.lyrics?.length)return;
  // Protect the view against unexpectedly large provider responses.
  if(result.lyrics.length>2000)throw Error('Too many lyric lines');
  params.sourceMap[key].lyricSourceResult=result;
}

function choose(force=false) {
  if(!params)return;
  const custom=Array.isArray(settings.priority)?settings.priority.filter(k=>PRIORITY.includes(k)):[];
  const disabled=new Set(settings.disabled||[]);
  const order=[...new Set([...custom,...PRIORITY])].filter(key=>!disabled.has(key));
  const baseline=params.sourceMap['yt-lyrics']?.lyricSourceResult?.lyrics;
  const reference=baseline?.map(line=>line.words).join('\n');
  const available=order.filter(key=>params.sourceMap[key]?.lyricSourceResult?.lyrics?.length);
  const automatic=available.filter(key=>{
    const result=params.sourceMap[key]?.lyricSourceResult;
    if(!result?.lyrics?.length)return false;
    if(!reference||key==='yt-lyrics'||key.startsWith('unison-'))return true;
    const accepted=stringSimilarity(result.lyrics.map(line=>line.words+'\n').join(''),reference)>=0.5;
    if(!accepted&&!reportedMismatches.has(key)){reportedMismatches.add(key);native?.diagnostic(generation,key,'Automatic match rejected; received lyrics remain available for manual selection');}
    return accepted;
  });
  $('sources').replaceChildren(...available.map(key=>{
    const option=document.createElement('option');option.value=key;
    option.textContent=params.sourceMap[key].lyricSourceResult.source+' · '+key.split('-').slice(1).join('-');
    return option;
  }));
  autoPreferred=automatic[0]||'';
  const key=available.includes(pinned)?pinned:autoPreferred;
  availableKeys=available;
  if(!key){
    selected='';currentResult=null;viewportMotion?.cancel();renderer.clear();configureMotion();updateDock();$('sources').value='';
    if(available.length){$('empty').textContent='These lyrics differ from YouTube Music. Choose a source to use them.';$('empty').hidden=false;native?.displayed(generation,'choose-source');}
    else native?.noLyrics(generation);
    return;
  }
  $('sources').value=key;
  const result=params.sourceMap[key].lyricSourceResult;
  if(!force&&key===selected&&result===currentResult){updateDock();return;}
  selected=key;currentResult=result;
  viewportMotion?.cancel();
  updateDock();
  renderer.setLyrics(result.lyrics,{language:result.language,songwriters:result.songwriters});
  configureMotion();
  decorate();
  $('status').textContent=result.source;
  $('status').title=key;
  $('empty').hidden=true;
  if(/connect|renew/i.test($('notice').textContent))$('connection').hidden=true;
  renderer.relayout();
  native?.displayed(generation,key);
  enrichMissing();
}

function translationFor(line,language){
  const translations=line.translations||{};
  const key=Object.keys(translations).find(key=>key===language)||
    Object.keys(translations).find(key=>key.split('-')[0]===language.split('-')[0]);
  if(key)return {text:translations[key],language:key};
  if(line.translation?.text&&(!line.translation.lang||line.translation.lang.split('-')[0]===language.split('-')[0]))return {text:line.translation.text,language:line.translation.lang||language};
  return null;
}
function enrichMissing(){
  if(!native?.enrich||!currentResult||(!settings.translation&&!settings.romanization))return;
  const requestKey=`${generation}|${selected}|${settings.language}`;
  if(enrichmentRequested.has(requestKey))return;
  const missing=currentResult.lyrics.some(line=>!line.isInstrumental&&
    ((settings.translation&&!translationFor(line,settings.language))||
     (settings.romanization&&!line.romanization)));
  if(!missing)return;
  enrichmentRequested.add(requestKey);
  for(let start=0;start<currentResult.lyrics.length;start+=200){
    const lines=currentResult.lyrics.slice(start,start+200).map(line=>line.isInstrumental?'':line.words);
    if(lines.some(line=>line.length>500))continue;
    native.enrich(generation,selected,JSON.stringify({lines,to:settings.language,videoId:params.videoId,start}));
  }
}

function decorate() {
  const lines=$('lyrics').querySelectorAll('.blyrics--line');
  currentResult?.lyrics.forEach((lyric,index)=>{
    const line=lines[index];if(!line)return;
    if(settings.translation){
      const translated=translationFor(lyric,settings.language);
      if(translated)injectTranslation(document,line,translated.text,translated.language);
    }
    if(settings.romanization&&lyric.romanization){
      injectRomanization(document,line,renderer.lines[index],lyric.romanization,lyric.timedRomanization);
    }
  });
}

function renderFrame(now) {
  raf=0;
  if(!active||document.hidden)return;
  // Android delivers asynchronous snapshots, not a synchronous HTML media element.
  // Extrapolate once at the supplied rate on a monotonic clock; hand Braccato "now".
  const position=clock.position+(clock.playing?Math.max(0,now-clock.received)*clock.rate:0);
  renderer.tick(position/1000,{eventCreationTime:Date.now(),isPlaying:clock.playing,
    playbackRate:clock.rate,passiveScrollEnabled:settings.passive,smoothScroll:!viewportMotion&&!settings.reducedMotion});
  viewportMotion?.advance(now);
  raf=requestAnimationFrame(renderFrame);
}
function startClock(){if(!raf&&active&&!document.hidden)raf=requestAnimationFrame(renderFrame);}

window.BDC = {
  track(track) {
    viewportMotion?.cancel();
    reportedMismatches.clear();autoPreferred='';
    generation=track.generation;selected='';pinned=track.preferredSource||'';currentResult=null;enrichmentGeneration++;enrichmentRequested.clear();
    params={song:track.title,artist:track.artist,album:track.album,duration:track.duration,
      videoId:track.videoId,sourceMap:Object.fromEntries([...PRIORITY,'metadata'].map(key=>[key,{filled:false,lyricSourceResult:null}]))};
    renderer.clear();resetPlaybackClock();
    availableKeys=[];updateDock();$('sources').replaceChildren();$('status').textContent='Looking for lyrics…';
    $('empty').textContent='Looking for lyrics…';$('empty').hidden=false;
    $('track').textContent=track.title+' · '+track.artist;
  },
  async source(id,payload) {
    if(id!==generation||!params)return;
    const expected=params;
    const previous=new Map(PRIORITY.filter(key=>expected.sourceMap[key]?.lyricSourceResult?.lyrics?.length).map(key=>[key,expected.sourceMap[key].lyricSourceResult]));
    try {
      if(payload.event) {
        await processStreamData(payload.event,payload.data,expected);
        if(id!==generation||params!==expected)return;
      }else if(payload.kind==='unison'){
        const data=payload.data?.data||payload.data;
        if(data.format==='ttml')fillTtml(data.lyrics,params,{richsyncKey:'unison-richsynced',syncedKey:'unison-synced',source:'Unison',sourceHref:'https://unison.betterlyrics.org',cacheAllowed:false});
        else if(data.lyrics)put(data.format==='plain'?'unison-plain':data.syncType==='richsync'?'unison-wordsynced':'unison-synced',
          {lyrics:data.format==='plain'?PlainParser.parse(data.lyrics):parseLRC(data.lyrics,params.duration*1000),source:'Unison'});
      }else {
        const lyrics=parsePayload(payload);
        let key=payload.key;
        if(payload.format==='ttml'&&key?.endsWith('-richsynced')){
          const parsed=parseTTMLContent(payload.raw,{songDurationMs:params.duration*1000});
          if(!parsed.isWordSynced)key=key.replace('-richsynced','-synced');
        }
        put(key,{...payload,lyrics});
      }
      // A slower provider response may be empty or less detailed than an earlier
      // public result. Only a track change or explicit refresh clears good lyrics.
      for(const [key,result] of previous)if(!expected.sourceMap[key]?.lyricSourceResult?.lyrics?.length)expected.sourceMap[key].lyricSourceResult=result;
      choose();
    } catch(error){
      if(id!==generation||params!==expected)return;
      for(const [key,result] of previous)if(!expected.sourceMap[key]?.lyricSourceResult?.lyrics?.length)expected.sourceMap[key].lyricSourceResult=result;
      choose();native?.diagnostic(generation,payload.key||payload.event||payload.kind||'unknown',String(error?.message||error).slice(0,240));
      if(!selected)$('status').textContent='A lyric source could not be decoded';
    }
  },
  state(sample) {
    if(sample.generation!==generation)return;
    const age=Number.isFinite(sample.sampledAt)?Math.max(0,Math.min(10000,Date.now()-sample.sampledAt)):0;
    clock={position:sample.position,playing:sample.playing,rate:sample.rate||1,received:performance.now()-age};
    if(sample.visible===false)viewportMotion?.cancel();active=sample.visible!==false;
    renderer.noteVisibilityChange();startClock();
  },
  visible(visible){
    const next=visible===true;if(active===next)return;active=next;
    if(!active){viewportMotion?.cancel();cancelAnimationFrame(raf);raf=0;}
    renderer.noteVisibilityChange();if(active){renderer.relayout();startClock();}
  },
  settings(next) {
    const rebuild=['translation','romanization','language'].some(key=>key in next&&next[key]!==settings[key]);
    settings={...settings,...next};const themeRebuild=theme();choose(rebuild||themeRebuild);renderer.relayout();
    configureMotion();
    setCollapsed(settings.dockCollapsed);
    for(const [key,url] of Object.entries(next.buttonIcons||{})){if(!$(key)||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(url))continue;const img=document.createElement('img');img.src=url;img.alt='';$(key).replaceChildren(img);}
    if(next.pillColor)document.documentElement.style.setProperty('--bd-pill',next.pillColor);
    $('translate').ariaPressed=String(settings.translation);
    $('romanize').ariaPressed=String(settings.romanization);
    $('offset').textContent=`${settings.offset||0} ms`;
    if(next.textColor){
      const style=document.documentElement.style;
      style.setProperty('--blyrics-text-color',next.textColor);style.setProperty('--bd-foreground',next.textColor);
      if(/^#[0-9a-f]{6}$/i.test(next.textColor)){
        const color=parseInt(next.textColor.slice(1),16),rgb=`${color>>16},${(color>>8)&255},${color&255}`;
        style.setProperty('--blyrics-lyric-active-color',next.textColor);
        style.setProperty('--blyrics-lyric-inactive-color',`rgba(${rgb},.3)`);
        style.setProperty('--blyrics-glow-color',`rgba(${rgb},.5)`);
        style.setProperty('--blyrics-translated-color',`rgba(${rgb},.6)`);
      }
    }
  },
  enrichment(id,key,start,language,response){
    if(id!==generation||key!==selected||!currentResult||!Array.isArray(response.lines))return;
    response.lines.forEach((data,index)=>{
      const line=currentResult.lyrics[start+index];if(!line||line.isInstrumental)return;
      if(data.translation&&data.needsTranslation){line.translations??={};line.translations[language]??=data.translation;}
      if(data.romanization&&!line.romanization)line.romanization=data.romanization;
    });
    choose(true);
  },
  notice(id,message,finished=false){
    if(id!==generation)return;
    if(!selected&&!availableKeys.length){$('empty').textContent=finished?'No lyrics found. YouTube Music’s lyrics remain available behind this panel.':message;}
    $('notice').textContent=message;
    $('connection').hidden=!!selected||!/connect|expired|HTTP|failed|unavailable/i.test(message);
    if(finished&&!selected&&!availableKeys.length)native?.noLyrics(generation);
  },
  dispose(){cancelAnimationFrame(raf);clearTimeout(dockLayoutTimer);dockResize.disconnect();systemReducedMotion.removeEventListener('change',configureMotion);viewportMotion?.destroy();renderer.destroy();},
};
$('sources').addEventListener('change',()=>{pinned=$('sources').value;native?.pin(generation,pinned);choose(true);});
$('source-label').onclick=()=>{$('source-label').getAttribute('aria-expanded')==='true'?closeSources():openSources();};
document.addEventListener('click',event=>{if(!$('source-menu').contains(event.target)&&!$('source-label').contains(event.target))closeSources();});
document.addEventListener('keydown',event=>{
  if($('source-label').getAttribute('aria-expanded')!=='true')return;
  if(event.key==='Escape'){closeSources();$('source-label').focus();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();const items=[...$('source-menu').children],i=items.indexOf(document.activeElement);
    items[event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
  }
});
window.addEventListener('resize',()=>{if($('source-menu').classList.contains('open'))positionSources();});
for(const [id,direction] of [['previous',-1],['next',1]])$(id).onclick=()=>{if(availableKeys.length>1)selectSource(availableKeys[(Math.max(0,availableKeys.indexOf(selected))+direction+availableKeys.length)%availableKeys.length]);};
$('collapse').onclick=()=>setCollapsed(!collapsed,true);
$('copy').onclick=()=>native?.copy(generation,(currentResult?.lyrics||[]).map(line=>line.words).join('\n').slice(0,100000));
$('refresh').addEventListener('click',()=>native?.refresh());
$('connect').addEventListener('click',()=>native?.connect());
$('configure').addEventListener('click',()=>native?.configure());
$('resume').addEventListener('click',()=>{viewportMotion?.settle();renderer.resumeAutoscroll();});
for(const kind of ['translate','romanize'])$(kind).addEventListener('click',()=>native?.toggle(kind));
$('earlier').addEventListener('click',()=>native?.offset(-100));
$('later').addEventListener('click',()=>native?.offset(100));
// The core counts programmatic scroll events; feed actual scrolling so its skip counter
// is consumed by those events, rather than swallowing the next user's touch/wheel gesture.
$('scroll').addEventListener('scroll',()=>{if(!viewportMotion?.ignoreScrollEvent())renderer.noteUserScroll();},{passive:true});
for(const type of ['pointerdown','touchstart','wheel'])$('scroll').addEventListener(type,()=>viewportMotion?.cancel(),{passive:true});
$('scroll').addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))viewportMotion?.cancel();});
document.addEventListener('visibilitychange',()=>{renderer.noteVisibilityChange();if(!document.hidden)startClock();});
dockResize.observe($('dock'));theme();startClock();native?.ready();
