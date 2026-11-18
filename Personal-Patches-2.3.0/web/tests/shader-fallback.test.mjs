/* Copyright 2026 BDCrusher. GPL-3.0. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = (await readFile(new URL('../src/shaders.js',import.meta.url),'utf8'))
  .replace(/^import .*;\r?\n/gm,'');

function host(Kawarp) {
  const hooks = {}, images = [], rendered = [];
  const canvas = {style:{},addEventListener:(name,fn)=>{hooks[name]=fn;}};
  const poster = {style:{}};
  const document = {querySelector:()=>canvas,getElementById:()=>poster,addEventListener() {},hidden:false};
  const window = {BDShader:{ready(){},artReady:(generation,url)=>rendered.push([generation,url]),failure(){}}};
  const Image = class { constructor(){images.push(this);} };
  const ResizeObserver = class {observe(){}};
  vm.runInNewContext(source,{document,window,Image,ResizeObserver,Kawarp});
  return {canvas,poster,window,hooks,images,rendered};
}

test('loss of WebGL displays the album art and keeps its motion tied to playback',()=>{
  const h=host(class {
    renderLoop(){} loadImageElement(){} setOptions(){} start(){} stop(){} renderFrame(){}
  });
  h.window.BDS.settings({animateBackground:true});
  h.window.BDS.state({generation:1,image:'album.jpg',background:true,playing:true,visible:true});
  h.images[0].onload();
  assert.equal(h.canvas.hidden,false);
  assert.equal(h.poster.hidden,true);
  h.hooks.webglcontextlost({preventDefault(){}});
  assert.equal(h.canvas.hidden,true);
  assert.equal(h.poster.hidden,false);
  assert.equal(h.poster.style.animationPlayState,'running');
  h.window.BDS.state({generation:1,image:'album.jpg',background:true,playing:false,visible:true});
  assert.equal(h.poster.style.animationPlayState,'paused');
});

test('fallback ignores old artwork after a track change and reports the new image once decoded',()=>{
  const h=host(class {constructor(){throw new Error('WebGL disabled');}});
  h.window.BDS.state({generation:1,image:'old.jpg',background:true});
  h.window.BDS.state({generation:2,image:'new.jpg',background:true});
  h.images[0].onload();
  assert.equal(h.poster.hidden,true);
  h.images[1].onload();
  assert.equal(h.poster.hidden,false);
  assert.equal(h.poster.src,'new.jpg');
  assert.deepEqual(h.rendered,[[2,'new.jpg']]);
});
