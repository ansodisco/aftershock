'use strict';
const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString('en-US');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = reduced;
const terrain = $('#terrain'), ctx = terrain.getContext('2d');
let tw = 0, th = 0, frame = 0;
function fitCanvas(canvas) {
  const r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width*d); canvas.height = Math.round(r.height*d);
  canvas.getContext('2d').setTransform(d,0,0,d,0,0);
  return [r.width,r.height];
}
function height(x,z) {
  const ridge = Math.exp(-Math.pow((z+.17*x-.07)/.36,2));
  const peaks = .5+.24*Math.sin(x*10+1.5)+.17*Math.sin(x*21+.4)+.1*Math.sin(x*39);
  return ridge*peaks*.55+Math.sin(x*19+z*12)*Math.cos(z*17-x*4)*.035+Math.sin(x*37+z*31)*.013;
}
function projection(x,z,h) {
  const mobile = tw < 650;
  return [tw*(mobile?.69:.68)+(x-z*.5)*tw*(mobile?.61:.52), th*.66+(z*.39+x*.14-h*.93)*th*.83];
}
function drawTerrain(t=0) {
  ctx.clearRect(0,0,tw,th);
  const bg=ctx.createLinearGradient(0,0,tw,th);bg.addColorStop(0,'#101e29');bg.addColorStop(1,'#172f3a');ctx.fillStyle=bg;ctx.fillRect(0,0,tw,th);
  const glow=ctx.createRadialGradient(tw*.72,th*.4,0,tw*.72,th*.4,tw*.55);glow.addColorStop(0,'#718b6720');glow.addColorStop(1,'#11202b00');ctx.fillStyle=glow;ctx.fillRect(0,0,tw,th);
  const n=84,m=62;
  // A projected, procedural wire mesh, independent of the catalog coordinates.
  for(let j=m;j>=0;j--){
    const z=j/m*1.9-1;
    ctx.beginPath();
    for(let i=0;i<=n;i++){
      const x=i/n*2.2-1.1,h=height(x,z),p=projection(x,z,h);
      i?ctx.lineTo(...p):ctx.moveTo(...p);
    }
    const alpha=.13+(.5-Math.abs(z)*.32)*.6;
    ctx.strokeStyle=`rgba(146,179,158,${Math.max(.06,alpha)})`;ctx.lineWidth=.65;ctx.stroke();
  }
  for(let i=0;i<=n;i++){
    const x=i/n*2.2-1.1;ctx.beginPath();
    for(let j=m;j>=0;j--){const z=j/m*1.9-1,p=projection(x,z,height(x,z));j===m?ctx.moveTo(...p):ctx.lineTo(...p)}
    ctx.strokeStyle='rgba(116,159,146,.21)';ctx.lineWidth=.6;ctx.stroke();
  }
  for(const [x,z,phase] of [[.05,-.02,0],[.56,.24,1.8],[-.44,.34,3.4]]){
    const p=projection(x,z,height(x,z));
    const radius=3+(Math.sin(t*.001+phase)+1)*2;
    const g=ctx.createRadialGradient(...p,0,...p,24);g.addColorStop(0,'#ff703a88');g.addColorStop(1,'#ff703a00');ctx.fillStyle=g;ctx.fillRect(p[0]-24,p[1]-24,48,48);
    ctx.fillStyle='#ff8654';ctx.beginPath();ctx.arc(...p,2.6,0,Math.PI*2);ctx.fill();
    for(let k=0;k<3;k++){
      const cycle=((t*.00012+phase*.15+k/3)%1);const r=12+cycle*95;
      ctx.strokeStyle=`rgba(249,116,67,${(1-cycle)*.52})`;ctx.lineWidth=.9;ctx.beginPath();ctx.ellipse(p[0],p[1],r,r*.38,-.15,0,Math.PI*2);ctx.stroke();
    }
    ctx.strokeStyle='#ddaa7360';ctx.beginPath();ctx.moveTo(p[0],p[1]-10);ctx.lineTo(p[0],p[1]-42);ctx.stroke();
    ctx.font='8px monospace';ctx.fillStyle='#d0b598';ctx.fillText('SEISMIC SIGNAL',p[0]+7,p[1]-37);
  }
  const shade=ctx.createLinearGradient(0,0,tw*.62,0);shade.addColorStop(0,'#101e29');shade.addColorStop(.42,'#101e29db');shade.addColorStop(1,'#101e2900');ctx.fillStyle=shade;ctx.fillRect(0,0,tw,th);
  // Subtle film grain and tiny registration marks.
  ctx.fillStyle='#d4e4d711';for(let i=0;i<240;i++){const x=(Math.sin(i*97.3)*.5+.5)*tw,y=(Math.cos(i*33.7)*.5+.5)*th;ctx.fillRect(x,y,1,1)}
}
let animationTime=0,lastTick=0;
function animate(t){if(!paused){if(lastTick)animationTime+=Math.min(t-lastTick,70);drawTerrain(animationTime)}lastTick=t;frame=requestAnimationFrame(animate)}
function updateMotion(){ $('#motion').setAttribute('aria-pressed',String(paused));$('#motion').innerHTML=paused?'▶ <span>Resume motion</span>':'Ⅱ <span>Pause motion</span>' }
$('#motion').addEventListener('click',()=>{paused=!paused;updateMotion()});updateMotion();
const terrainObserver=new ResizeObserver(()=>{[tw,th]=fitCanvas(terrain);drawTerrain(animationTime)});terrainObserver.observe(terrain);frame=requestAnimationFrame(animate);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);lastTick=0}else frame=requestAnimationFrame(animate)});

let catalog=[],visible=[],selected=null,mw=0,mh=0,pointCache=[];
const map=$('#map'), mc=map.getContext('2d');
function mapPoint(e){return [38+(e[2]-64)/28*(mw-65),mh-49-(e[1]-32)/24*(mh-100)]}
function eventColor(e,alpha=.42){const v=$('#color').value==='depth'?(e[3]<0?0:e[3]/70):e[4]/17.5;const a=Math.min(1,Math.max(0,v));return `rgba(${Math.round(60+192*a)},${Math.round(141-44*a)},${Math.round(136-80*a)},${alpha})`}
function drawMap(){
  if(!mw)return;
  mc.clearRect(0,0,mw,mh);mc.fillStyle='#e7eae2';mc.fillRect(0,0,mw,mh);
  mc.font='8px monospace';mc.textAlign='left';
  for(let lon=65;lon<=90;lon+=5){const x=mapPoint([0,32,lon])[0];mc.strokeStyle='#c7d0c4';mc.lineWidth=.6;mc.beginPath();mc.moveTo(x,46);mc.lineTo(x,mh-45);mc.stroke();mc.fillStyle='#8a968b';mc.fillText(lon+'° E',x+5,mh-33)}
  for(let lat=35;lat<=55;lat+=5){const y=mapPoint([0,lat,64])[1];mc.strokeStyle='#c7d0c4';mc.beginPath();mc.moveTo(30,y);mc.lineTo(mw-20,y);mc.stroke();mc.fillStyle='#8a968b';mc.fillText(lat+'°',8,y-4)}
  mc.font=`${mw<500?13:19}px 'Space Grotesk',sans-serif`;mc.fillStyle='#b8c2b377';mc.fillText('K A Z A K H S T A N',mw*.27,mh*.28);mc.font='11px sans-serif';mc.fillText('KYRGYZSTAN',mw*.28,mh*.64);mc.fillText('CHINA',mw*.75,mh*.66);
  pointCache=[];
  for(const e of visible){const p=mapPoint(e);pointCache.push(p);mc.fillStyle=eventColor(e,.29);mc.beginPath();mc.arc(p[0],p[1],e[4]>12?2.2:1.2,0,Math.PI*2);mc.fill()}
  if(selected&&selected[0]<=Number($('#year').value)){
    const p=mapPoint(selected);mc.strokeStyle='#f56538';mc.lineWidth=1.5;mc.beginPath();mc.arc(...p,10,0,Math.PI*2);mc.stroke();mc.fillStyle='#fc663b';mc.beginPath();mc.arc(...p,3,0,Math.PI*2);mc.fill();
    mc.strokeStyle='#f5653866';mc.beginPath();mc.moveTo(p[0]-18,p[1]);mc.lineTo(p[0]+18,p[1]);mc.moveTo(p[0],p[1]-18);mc.lineTo(p[0],p[1]+18);mc.stroke();
  }
}
function selectEvent(e){selected=e;const date=`${e[0]} / ${String(e[5]).padStart(2,'0')} / ${String(e[6]).padStart(2,'0')}`;$('#event-detail').innerHTML=`<p class="event-date">${date}</p><div class="event-meta"><div><span>LATITUDE</span><strong>${e[1].toFixed(2)}° N</strong></div><div><span>LONGITUDE</span><strong>${e[2].toFixed(2)}° E</strong></div><div><span>DEPTH</span><strong>${e[3]<0?'Unknown':e[3]+' km'}</strong></div><div><span>CLASS</span><strong>${e[4].toFixed(1)}</strong></div></div>`;drawMap()}
function updateCatalog(){const year=Number($('#year').value);$('#year-label').textContent=year;visible=catalog.filter(e=>e[0]<=year);$('#event-count').textContent=fmt(visible.length);const sample=[];for(let i=0;i<Math.min(60,visible.length);i++)sample.push(Math.floor(i*(visible.length-1)/Math.max(1,Math.min(60,visible.length)-1)));$('#event-picker').innerHTML=sample.map((index,i)=>{const e=visible[index];return `<option value="${index}">${e[0]}-${String(e[5]).padStart(2,'0')}-${String(e[6]).padStart(2,'0')} · ${e[1].toFixed(2)}° N, ${e[2].toFixed(2)}° E</option>`}).join('');selectEvent(visible[0]);}
$('#year').addEventListener('input',updateCatalog);
$('#color').addEventListener('change',()=>{const depth=$('#color').value==='depth';$('#legend-low').textContent=depth?'Shallow / unknown':'Lower class';$('#legend-high').textContent=depth?'70 km':'Higher class';drawMap()});
$('#reset').addEventListener('click',()=>{$('#year').value='2013';$('#color').value='class';$('#legend-low').textContent='Lower class';$('#legend-high').textContent='Higher class';updateCatalog()});
$('#event-picker').addEventListener('change',e=>selectEvent(visible[Number(e.target.value)]));
map.addEventListener('click',e=>{const r=map.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=-1,d=Infinity;pointCache.forEach((p,i)=>{const n=(p[0]-x)**2+(p[1]-y)**2;if(n<d){d=n;best=i}});if(best>=0&&d<1600){selectEvent(visible[best]);const picker=$('#event-picker');let option=Array.from(picker.options).find(o=>Number(o.value)===best);if(!option){option=new Option('Selected point · '+visible[best][0],best);picker.add(option)}picker.value=best;}});
new ResizeObserver(()=>{[mw,mh]=fitCanvas(map);drawMap()}).observe(map);
fetch('data.json').then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json()}).then(data=>{
  catalog=data.events;$('#training-stat').textContent=fmt(data.training);updateCatalog();
  const max=Math.max(...Object.values(data.years));$('#year-chart').innerHTML=Object.entries(data.years).map(([year,count])=>`<button class="bar" style="height:${count/max*100}%" aria-label="${year}: ${fmt(count)} events. Show catalog through ${year}." data-year="${year}"><span class="bar-tooltip">${year} · ${fmt(count)}</span></button>`).join('');
  $('#year-chart').addEventListener('click',e=>{const b=e.target.closest('[data-year]');if(b){$('#year').value=b.dataset.year;updateCatalog();$('#atlas').scrollIntoView({behavior:reduced?'instant':'smooth'})}});
  const known=catalog.filter(e=>e[3]>=0),bins=[[0,10],[10,20],[20,40],[40,71]];const counts=bins.map(([a,b])=>known.filter(e=>e[3]>=a&&e[3]<b).length);
  $('#depth-chart').innerHTML=counts.map((count,i)=>`<div class="depth-row"><span>${['0–9','10–19','20–39','40–70'][i]} km</span><div class="depth-track"><div style="width:${count/known.length*100}%"></div></div><strong>${(count/known.length*100).toFixed(1)}%</strong></div>`).join('');$('#unknown-depth').textContent=`${fmt(known.length)} known depths · ${fmt(catalog.length-known.length)} unknown excluded.`;
}).catch(err=>{$('#event-count').textContent='—';$('#event-detail').textContent='The catalog could not load. Refresh the page or download the CSV below.';$('#training-stat').textContent='1,250';console.error(err)});
