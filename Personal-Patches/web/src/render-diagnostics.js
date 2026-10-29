/* Copyright 2026 BDCrusher. GPL-3.0. Timing evidence only; never controls scrolling. */
export class RenderDiagnostics {
 constructor(log){this.log=log;this.enabled=false;this.last=0;this.index=-1;this.lastSlow=0;this.schedule=[];}
 enable(value){if(this.enabled===value)return;this.enabled=value;this.last=0;this.log('Capture',value?'Renderer timing enabled':'Renderer timing disabled');}
 lines(lines){this.schedule=lines.map((line,index)=>({time:line.time,index})).filter(x=>Number.isFinite(x.time)).sort((a,b)=>a.time-b.time);this.index=-1;}
 sample(now,position,cpu,playing){
  if(!this.enabled||!playing){this.last=0;return;}const gap=this.last?now-this.last:0;this.last=now;
  let lo=0,hi=this.schedule.length;while(lo<hi){const mid=(lo+hi)>>>1;if(this.schedule[mid].time<=position)lo=mid+1;else hi=mid;}const index=lo?this.schedule[lo-1].index:-1;
  if(index!==this.index){this.log('Line-transition',`line=${index} playbackMs=${Math.round(position*1000)} callbackGapMs=${gap.toFixed(1)} tickCpuMs=${cpu.toFixed(2)}`);this.index=index;}
  if((gap>32||cpu>12)&&now-this.lastSlow>=250){this.lastSlow=now;this.log('Renderer-stall',`line=${index} callbackGapMs=${gap.toFixed(1)} tickCpuMs=${cpu.toFixed(2)}`);}
 }
}
