import { createCanvas } from '@napi-rs/canvas';
import { setCanvasFactory } from '../public/js/util.js';
setCanvasFactory((w,h)=>createCanvas(w,h));
const A = await import('../public/js/art.js');
import fs from 'node:fs';
const out = createCanvas(1600, 900), ctx = out.getContext('2d');
ctx.fillStyle = '#4d7a3c'; ctx.fillRect(0,0,1600,900);
let y=10;
for (const type of ['golem','dragon']) for (const team of ['red','blue']) {
  let x=10, h=0;
  for (const [anim,idx] of [['walk',[0,2,4,6]],['attack',[0,2,3,4]]]) for (const i of idx) { const f=A.frame(type,team,anim,i); const s=type==='dragon'?0.8:1; ctx.drawImage(f.c,x,y,f.w*s,f.h*s); x+=f.w*s+2; h=Math.max(h,f.h*s); }
  y+=h+4;
}
fs.writeFileSync('/tmp/sheet2.png', out.toBuffer('image/png'));
