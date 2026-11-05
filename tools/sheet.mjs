import { createCanvas } from '@napi-rs/canvas';
import { setCanvasFactory } from '../public/js/util.js';
setCanvasFactory((w,h)=>createCanvas(w,h));
const A = await import('../public/js/art.js');
import fs from 'node:fs';
const out = createCanvas(1600, 1000), ctx = out.getContext('2d');
ctx.fillStyle = '#4d7a3c'; ctx.fillRect(0,0,1600,1000);
let x=20,y=20;
for (const type of ['sword','archer','mage','knight','golem','dragon']) for (const team of ['red','blue']) {
  for (const [anim,n] of [['walk',8],['attack',6]]) for (let i=0;i<n;i+=(type==='dragon'||type==='golem')?2:1) {
    const f=A.frame(type,team,anim,i);
    if (x+f.w>1580){x=20;y+=rowH;rowH=0}
    ctx.drawImage(f.c,x,y); x+=f.w+4; rowH=Math.max(rowH||0,f.h);
  }
  x=20;y+=rowH+6;rowH=0;
}
var rowH;
const cr=A.drawCastle('red',0), cb=A.drawCastle('blue',2);
ctx.drawImage(cr.c,1100,300,cr.w*0.7,cr.h*0.7); ctx.drawImage(cb.c,1100,620,cb.w*0.7,cb.h*0.7);
let gx=20; for (const g of ['小心心','玫瑰','甜甜圈','火箭']) { ctx.drawImage(A.giftIcon(g,40),gx,930); gx+=100; }
ctx.drawImage(A.crestIcon('red',40),500,930); ctx.drawImage(A.crestIcon('blue',40),600,930);
fs.writeFileSync('/tmp/sheet.png', out.toBuffer('image/png'));
console.log('ok');
