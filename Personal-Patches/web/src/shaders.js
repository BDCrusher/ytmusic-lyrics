/* Android host for Better Lyrics Shaders 1.5.1; GPL-3.0. Kawarp/ALTCHA notices apply. */
import Kawarp from '@kawarp/core';
import {solveChallenge} from 'altcha-lib';
import {deriveKey} from 'altcha-lib/algorithms/web/pbkdf2';
const native=window.BDShader, canvas=document.querySelector('canvas'), video=document.querySelector('video');
let engine,config={},state={},generation=-1,lastImage='',lastVideo='',lastPaint=0,closed=false,sampling='',graphicsFailed=false;
function fail(error){native?.failure(String(error?.message||error).slice(0,160));}
function create(){
 if(engine||closed||graphicsFailed||!state.background)return;
 engine=new Kawarp(canvas,{warpIntensity:1,blurPasses:8,animationSpeed:1,transitionDuration:1000,saturation:1.5,dithering:.008});
 // Preserve Kawarp's render function and clock; pace only its RAF scheduling.
 const render=engine.renderLoop;
 if(typeof render!=='function')throw new Error('Pinned Kawarp scheduling contract missing');
 engine.renderLoop=timestamp=>{if(!engine.isPlaying)return;const interval=1000/(config.fps||30),delta=timestamp-lastPaint;if(delta>=interval){lastPaint=timestamp-(delta%interval);render(timestamp);}else engine.animationId=requestAnimationFrame(engine.renderLoop);};
}
function visibility(){
 const motion=state.visible&&state.playing&&!config.reducedMotion&&!document.hidden;
 if(state.video&&motion&&(state.cover||state.background&&config.animateBackground)){video.play().catch(()=>{});}else video.pause();
 if(!engine)return;
 engine.animationSpeed=config.animateBackground&&motion?(config.speed??1):0;
 if(state.background&&motion){engine.start();}else{engine.stop();engine.renderFrame();}
}
function update(){
 try{
  const strength=Math.max(0,Math.min(1,config.opacity??.75));
  canvas.hidden=!state.background;canvas.style.opacity=String(strength);canvas.style.filter=`brightness(${1-(config.dimming??.3)})`;
  video.hidden=!state.cover;video.style.opacity=state.cover?'1':'0';
  try{create();}catch(error){graphicsFailed=true;fail(error);}
  engine?.setOptions({warpIntensity:config.strength??1,saturation:config.saturation??1.5,transitionDuration:config.transition??1000,animationSpeed:config.animateBackground?(config.speed??1):0,blurPasses:8,dithering:.008});
  if(engine&&state.image&&state.image!==lastImage){lastImage=state.image;engine.unloadVideo();sampling='';engine.loadImage(state.image).then(()=>{if(!closed)visibility();}).catch(error=>{lastImage='';fail(error);});}
  if(state.video!==lastVideo){lastVideo=state.video||'';video.pause();video.removeAttribute('src');engine?.unloadVideo();sampling='';if(lastVideo){video.src=lastVideo;video.load();}}
  const nextSampling=state.video&&state.background&&config.animateBackground&&video.readyState>=2?`${state.video}|${config.fps||30}`:'';
  if(engine&&nextSampling!==sampling){sampling=nextSampling;engine.unloadVideo();if(sampling)engine.loadVideo(video,{sampleWidth:208,sampleHeight:117,downsampleFactor:2,frameRate:config.fps||30,smoothing:250,onError:fail});}
  visibility();
 }catch(error){fail(error);}
}
video.addEventListener('loadeddata',()=>{native?.mediaReady(generation);update();});
video.addEventListener('error',()=>{if(lastVideo)native?.mediaError(generation);});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();engine?.stop();native?.failure('Graphics context lost; native artwork retained');});
canvas.addEventListener('webglcontextrestored',()=>{engine?.dispose();engine=undefined;graphicsFailed=false;lastImage='';sampling='';update();});
document.addEventListener('visibilitychange',visibility);
const sizeObserver=new ResizeObserver(entries=>{for(const entry of entries){const rect=entry.contentRect;if(rect.width<=0||rect.height<=0)continue;const scale=Math.min(devicePixelRatio||1,2,2048/Math.max(rect.width,rect.height));const width=Math.max(1,Math.round(rect.width*scale)),height=Math.max(1,Math.round(rect.height*scale));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;engine?.resize();engine?.renderFrame();}}});sizeObserver.observe(canvas);
window.BDS={
 settings(next){config=next;update();},
 state(next){if(next.generation!==generation){generation=next.generation;lastVideo='';lastImage='';sampling='';video.pause();video.removeAttribute('src');engine?.unloadVideo();}state=next;update();},
 async solve(id,challenge){try{const solution=await solveChallenge({challenge,deriveKey,timeout:60000});native?.proof(id,solution?JSON.stringify(solution):'');}catch{native?.proof(id,'');}},
 close(){closed=true;sizeObserver.disconnect();video.pause();video.removeAttribute('src');video.load();engine?.dispose();engine=undefined;}
};
native?.ready();
