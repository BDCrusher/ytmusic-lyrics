/* Copyright 2026 BDCrusher. GPL-3.0. Keep word animation in Braccato; scroll one native viewport. */
export function createViewportMotion(element) {
  const native = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  if (!native?.get || !native?.set) return null;
  let timed=false, reduced=false, moving=false;
  let from=0,target=0,started=0,physicalWrite=NaN,writeTime=-Infinity;
  const read=()=>native.get.call(element);
  function write(value){physicalWrite=value;writeTime=performance.now();native.set.call(element,value);}
  // The extension's normal ease-out curve, applied to the viewport instead of many line layers.
  function ease(t){
    let u=t;
    for(let i=0;i<7;i++){
      const x=3*(1-u)*(1-u)*u*.25+3*(1-u)*u*u*.5+u*u*u;
      const dx=.75*(1-u)*(1-u)+1.5*(1-u)*u+1.5*u*u;
      u=Math.max(0,Math.min(1,u-(x-t)/Math.max(.001,dx)));
    }
    return 1-Math.pow(1-u,3);
  }
  function cancel(){moving=false;physicalWrite=NaN;writeTime=-Infinity;}
  Object.defineProperty(element,'scrollTop',{
    configurable:true,
    get(){return read();},
    set(value){
      cancel();if(timed)write(value);else native.set.call(element,value);
    }
  });
  // Invoked for every timed engine scroll, including a resize/theme retick outside RAF.
  // No expected native-event counter is needed: this host owns all animation events.
  Object.defineProperty(element,'__bdScrollTo',{
    configurable:true,
    value(value){
      const next=Math.max(0,Math.min(Number(value)||0,element.scrollHeight-element.clientHeight));
      if(moving&&Math.abs(next-target)<.5)return;
      from=read();target=next;started=performance.now();
      moving=!reduced&&Math.abs(target-from)>1;
      if(!moving)write(target);
    }
  });
  return {
    configure(isTimed,reduce){timed=isTimed;reduced=reduce;if(!timed)cancel();if(reduced&&moving){moving=false;write(target);}},
    advance(now){if(!moving)return;const p=Math.max(0,Math.min(1,(now-started)/750));write(from+(target-from)*ease(p));if(p===1)moving=false;},
    ignoreScrollEvent(){return performance.now()-writeTime<100&&Math.abs(read()-physicalWrite)<1.1;},
    settle(){moving=false;physicalWrite=read();writeTime=performance.now();},
    cancel,
    destroy(){cancel();delete element.scrollTop;delete element.__bdScrollTo;}
  };
}
