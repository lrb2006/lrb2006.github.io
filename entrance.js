/* Lianna's financial particle entrance. Camera is opt-in and frames stay local. */
(() => {
'use strict';
// Geometry is isolated so gesture thresholds can be checked without a camera.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function createPinchGate(){
 let armed=false,openSince=null,closeSince=null,lastSeen=null;
 return {
  reset(){armed=false;openSince=null;closeSince=null;lastSeen=null;},
  update(landmarks,now){
   if(!landmarks||landmarks.length<21){this.reset();return {trigger:false,ratio:Infinity,armed:false};}
   if(lastSeen!==null&&now-lastSeen>300)this.reset();
   lastSeen=now;
   const palm=distance(landmarks[0],landmarks[9]);
   if(!Number.isFinite(palm)||palm<.025){this.reset();return {trigger:false,ratio:Infinity,armed:false};}
   const ratio=distance(landmarks[4],landmarks[8])/palm;
   if(ratio>.55){closeSince=null;openSince??=now;if(now-openSince>=130)armed=true;}
   else if(ratio<.32&&armed){closeSince??=now;if(now-closeSince>=100){armed=false;closeSince=null;openSince=null;return {trigger:true,ratio,armed:false};}}
   else {closeSince=null;if(!armed)openSince=null;}
   return {trigger:false,ratio,armed};
  }
 };
}
window.LiannaGestureMath={createPinchGate};
window.LiannaEntrance={init({setSound,playSound,onEnter,onReplay}){
 const $=s=>document.querySelector(s), intro=$('#intro'),site=$('#site'),canvas=$('#code-canvas'),ctx=canvas.getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const pointer={x:-1000,y:-1000,active:false};
 let done=false,transitioning=false,particles=[],quotes=[],frame=0,start=0,lastFrame=0,phaseChanged=false;
 let w=innerWidth,h=innerHeight,pixelRatio=1,rippleCleanup;
 let cameraGeneration=0,cameraStream=null,landmarker=null,cameraFrame=0,cameraLoading=false,cameraLastTime=-1,cameraLastFrame=0;
 const pinch=createPinchGate();
 const video=$('#hand-video'),cameraPanel=$('#camera-panel'),cameraButton=$('#enable-gesture'),status=$('#gesture-status'),gestureCursor=$('#gesture-cursor');
 function say(text){if(status.textContent!==text)status.textContent=text;}
 function setup(reset=true){
  w=innerWidth;h=innerHeight;pixelRatio=Math.min(devicePixelRatio||1,2);canvas.width=w*pixelRatio;canvas.height=h*pixelRatio;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx?.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d');
  if(!ctx||!m){intro.classList.add('canvas-fallback');return;}
  const rect=$('.intro h1').getBoundingClientRect();
  let fontSize=Math.min(w*.155,190);m.font=`700 ${fontSize}px "Space Grotesk", Arial`;
  const maxWidth=w*.86;if(m.measureText('LIANNA').width>maxWidth){fontSize*=maxWidth/m.measureText('LIANNA').width;m.font=`700 ${fontSize}px "Space Grotesk", Arial`;}
  m.fillStyle='#fff';m.textAlign='center';m.textBaseline='middle';m.fillText('LIANNA',w/2,rect.top+rect.height*.5);
  const pixels=m.getImageData(0,0,w,h).data;particles=[];
  const step=w<600?5:7;
  for(let y=Math.max(0,Math.floor(rect.top)-20);y<Math.min(h,rect.bottom+20);y+=step)for(let x=0;x<w;x+=step){if(pixels[(y*w+x)*4+3]>100){const a={x:Math.random()*w,y:Math.random()*h,tx:x,ty:y,vx:0,vy:0,char:'0123456789+-'[Math.floor(Math.random()*12)],seed:Math.random()*10};a.sx=a.x;a.sy=a.y;particles.push(a);}}
  quotes=Array.from({length:w<600?26:52},(_,i)=>({x:Math.random()*w,y:Math.random()*h,speed:8+Math.random()*15,seed:i,word:['σ 0.24','Δ +0.08','E[r]','β 0.92','P(t)','Σ xᵢ','+1.28%','010101','∂V/∂t','alpha','100.42','μ + ε'][i%12]}));
  if(reset){start=performance.now();phaseChanged=false;$('#intro-phase').textContent='small signals. infinite possibilities.';}
  cancelAnimationFrame(frame);lastFrame=0;frame=requestAnimationFrame(draw);
 }
 function drawBackdrop(t){
  ctx.lineWidth=.6;ctx.strokeStyle='rgba(130,191,165,.07)';ctx.beginPath();const size=w<600?48:65;
  for(let x=0;x<w;x+=size){ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let y=0;y<h;y+=size){ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();
  const chartY=h*.74,chartH=h*.18,columns=w<600?22:42;
  const travel=reduced.matches?0:t*8;
  ctx.lineWidth=1;
  for(let i=0;i<columns;i++){
   const x=(i*(w/(columns-1))+travel)%(w+40)-20;
   const signal=i*.14+Math.sin(i*.8)*.23;
   const y=chartY-Math.min(signal/6,1)*chartH+Math.sin(i*1.83)*22;
   const up=i%4!==0;ctx.strokeStyle=up?'rgba(132,216,178,.22)':'rgba(142,171,165,.13)';ctx.fillStyle=up?'rgba(132,216,178,.11)':'rgba(142,171,165,.07)';
   ctx.beginPath();ctx.moveTo(x,y-20);ctx.lineTo(x,y+24);ctx.stroke();ctx.fillRect(x-4,y-9,8,18);ctx.strokeRect(x-4,y-9,8,18);
  }
  ctx.font='12px ui-monospace,monospace';
  quotes.forEach(q=>{const y=reduced.matches?q.y:(q.y-t*q.speed+h*100)%h;let x=q.x+Math.sin(t*.2+q.seed)*10;if(pointer.active){const dx=x-pointer.x,dy=y-pointer.y,d=Math.hypot(dx,dy);if(d<120)x+=dx/(d||1)*(120-d)*.2;}ctx.fillStyle='rgba(132,194,167,.18)';ctx.fillText(q.word,x,y);});
 }
 function draw(now){
  if(done||transitioning)return;
  if(document.hidden){frame=0;return;}
  if(now-lastFrame<1000/40){frame=requestAnimationFrame(draw);return;}lastFrame=now;
  const t=(now-start)/1000;ctx?.clearRect(0,0,w,h);if(!ctx)return;
  drawBackdrop(t);
  const raw=reduced.matches?1:Math.max(0,Math.min(1,(t-1.45)/2.8));const progress=raw<.5?4*raw*raw*raw:1-Math.pow(-2*raw+2,3)/2;
  if(raw===1&&!phaseChanged){phaseChanged=true;$('#intro-phase').textContent='a little math. a little instinct. lianna.';intro.classList.add('name-formed');}
  ctx.font=`${w<600?7:9}px ui-monospace,monospace`;
  const threshold=w<600?90:140;
  particles.forEach(a=>{
   const targetX=a.sx+(a.tx-a.sx)*progress+Math.sin(t*.3+a.seed)*(1-progress)*20;
   const targetY=a.sy+(a.ty-a.sy)*progress+Math.cos(t*.23+a.seed)*(1-progress)*20;
   let pushX=0,pushY=0;
   if(pointer.active&&!reduced.matches){const dx=a.x-pointer.x,dy=a.y-pointer.y,d=Math.hypot(dx,dy);if(d<threshold){const force=(1-d/threshold)*11;pushX=dx/(d||1)*force;pushY=dy/(d||1)*force;}}
   a.vx=(a.vx+(targetX-a.x)*.035+pushX)*.78;a.vy=(a.vy+(targetY-a.y)*.035+pushY)*.78;a.x+=a.vx;a.y+=a.vy;
   if(reduced.matches){a.x=a.tx;a.y=a.ty;}
   ctx.fillStyle=`rgba(${a.seed>7?'221,245,230':'137,226,183'},${.55+progress*.4})`;ctx.fillText(a.char,a.x,a.y);
  });
  if(pointer.active&&!reduced.matches){ctx.beginPath();ctx.arc(pointer.x,pointer.y,18,0,Math.PI*2);ctx.strokeStyle='rgba(163,235,202,.3)';ctx.lineWidth=.7;ctx.stroke();}
  if(!reduced.matches)frame=requestAnimationFrame(draw);
 }
 function stopCamera(message='Camera off. Mouse and touch still work.'){
  cameraGeneration++;cameraLoading=false;cancelAnimationFrame(cameraFrame);cameraFrame=0;
  cameraStream?.getTracks().forEach(track=>track.stop());cameraStream=null;
  video.pause();video.srcObject=null;landmarker?.close();landmarker=null;
  cameraButton.textContent='✧ Try hand control';cameraButton.setAttribute('aria-pressed','false');
  cameraPanel.hidden=true;gestureCursor.classList.remove('active');pinch.reset();pointer.active=false;cameraLastTime=-1;
  if(message)$('#gesture-help').textContent=message;
 }
 function enter(withSound=false,origin=null,skip=false){
  if(done||transitioning)return;
  transitioning=true;stopCamera(null);setSound(withSound);onEnter();
  if(withSound)playSound('water');
  site.inert=false;document.body.classList.remove('intro-active');site.classList.add('site-entered');
  intro.inert=true;intro.setAttribute('aria-hidden','true');
  $('.wordmark').focus({preventScroll:true});cancelAnimationFrame(frame);
  clearTimeout(rippleCleanup);
  const finish=()=>{done=true;transitioning=false;intro.hidden=true;intro.style.removeProperty('mask-image');intro.style.removeProperty('-webkit-mask-image');rippleCleanup=setTimeout(()=>$('#ripple-transition').classList.remove('active'),500);};
  if(skip||reduced.matches){finish();return;}
  const x=Math.max(0,Math.min(w,origin?.x??w*.5)),y=Math.max(0,Math.min(h,origin?.y??h*.5));
  const radius=Math.max(Math.hypot(x,y),Math.hypot(w-x,y),Math.hypot(x,h-y),Math.hypot(w-x,h-y))+40;
  const ripple=$('#ripple-transition');ripple.style.setProperty('--ripple-x',x+'px');ripple.style.setProperty('--ripple-y',y+'px');ripple.style.setProperty('--ripple-size',radius*2+'px');ripple.classList.remove('active');void ripple.offsetWidth;ripple.classList.add('active');
  const started=performance.now();
  const wipe=now=>{const p=Math.min((now-started)/1150,1),ease=1-Math.pow(1-p,2.5),r=radius*ease;const mask=`radial-gradient(circle at ${x}px ${y}px, transparent ${Math.max(0,r-16)}px, #000 ${r+4}px)`;intro.style.maskImage=mask;intro.style.webkitMaskImage=mask;if(p<1)requestAnimationFrame(wipe);else finish();};
  requestAnimationFrame(wipe);
 }
 function replay(){if(transitioning)return;done=false;intro.hidden=false;intro.inert=false;intro.removeAttribute('aria-hidden');intro.classList.remove('name-formed');site.classList.remove('site-entered');site.inert=true;document.body.classList.add('intro-active');onReplay();$('#gesture-help').textContent='Optional camera · pinch your thumb and index finger to enter.';$('#enter-quiet').focus({preventScroll:true});setup();}
 function eventPoint(e){return {x:e.clientX||w/2,y:e.clientY||h*.6};}
 $('#enter-quiet').addEventListener('click',e=>enter(false,eventPoint(e)));
 $('#enter-sound').addEventListener('click',e=>enter(true,eventPoint(e)));
 $('#skip-intro').addEventListener('click',()=>enter(false,null,true));
 $('.skip-link').addEventListener('click',()=>enter(false,null,true));
 $('#replay-intro').addEventListener('click',replay);
 intro.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;pointer.active=true;});
 intro.addEventListener('pointerleave',()=>{if(!cameraStream)pointer.active=false;});
 intro.addEventListener('click',e=>{if(e.target.closest('button,a,.camera-panel,.gesture-help'))return;enter(false,eventPoint(e));});
 intro.addEventListener('keydown',e=>{if(e.key==='Escape'){enter(false,null,true);return;}if(e.key==='Tab'){const items=[...intro.querySelectorAll('button')].filter(x=>!x.closest('[hidden]'));if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}});
 function overlayHand(points){
  const overlay=$('#hand-overlay');overlay.width=320;overlay.height=240;const c=overlay.getContext('2d');if(!c)return;c.clearRect(0,0,320,240);if(!points)return;
  c.strokeStyle='#a8f2ce';c.lineWidth=1.5;
  for(const finger of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){c.beginPath();finger.forEach((i,j)=>{const x=points[i].x*320,y=points[i].y*240;j?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}
  c.fillStyle='#e3fff1';points.forEach(p=>{c.beginPath();c.arc(p.x*320,p.y*240,2.5,0,Math.PI*2);c.fill();});
 }
 async function startCamera(){
  if(cameraLoading||cameraStream){stopCamera();return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.isSecureContext){$('#gesture-help').textContent='Camera needs a supported browser on HTTPS or localhost. Mouse entry works here.';return;}
  const token=++cameraGeneration;cameraLoading=true;cameraPanel.hidden=false;cameraButton.textContent='Cancel hand setup';cameraButton.setAttribute('aria-pressed','true');say('Allow camera access to try hand control.');
  let stream=null,model=null;
  try{
   stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(token!==cameraGeneration||done||transitioning){stream.getTracks().forEach(t=>t.stop());return;}
   cameraStream=stream;video.srcObject=stream;await video.play();say('Loading the hand model…');
   const timed=(promise)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('The hand model took too long to load.')),25000);})]).finally(()=>clearTimeout(timer));};
   const vision=await timed(import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs'));
   if(token!==cameraGeneration)return;
   const files=await timed(vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'));
   if(token!==cameraGeneration)return;
   const pending=vision.HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
   pending.then(m=>{if(token!==cameraGeneration)m.close();}).catch(()=>{});
   model=await timed(pending);
   if(token!==cameraGeneration){model.close();return;}
   landmarker=model;cameraLoading=false;cameraButton.textContent='✧ Hand control on';say('Show your open hand, then pinch to enter.');
   $('#gesture-help').textContent='Move your index finger to steer. Pinch thumb + index to make a ripple.';
   pinch.reset();cameraLastTime=-1;cameraLastFrame=0;
   const track=now=>{
    if(token!==cameraGeneration||done||transitioning||!landmarker)return;
    try{
     if(video.readyState>=2&&video.currentTime!==cameraLastTime&&now-cameraLastFrame>65){
      cameraLastFrame=now;cameraLastTime=video.currentTime;const result=landmarker.detectForVideo(video,now);const hand=result.landmarks?.[0];overlayHand(hand);
      const state=pinch.update(hand,now);
      if(hand){const targetX=(1-hand[8].x)*w,targetY=hand[8].y*h;pointer.x=pointer.active?pointer.x*.55+targetX*.45:targetX;pointer.y=pointer.active?pointer.y*.55+targetY*.45:targetY;pointer.active=true;gestureCursor.classList.add('active');gestureCursor.style.left=pointer.x+'px';gestureCursor.style.top=pointer.y+'px';gestureCursor.style.setProperty('--pinch-scale',String(Math.min(1.7,Math.max(.5,state.ratio))));say(state.armed?'Pinch to make a ripple.':'Open thumb + index first.');if(state.trigger){enter(false,{x:pointer.x,y:pointer.y});return;}}
      else {pointer.active=false;gestureCursor.classList.remove('active');say('Bring one hand into view.');}
     }
     cameraFrame=requestAnimationFrame(track);
    }catch(_){stopCamera('Hand tracking stopped. Please retry, or click to enter.');}
   };
   cameraFrame=requestAnimationFrame(track);
  }catch(error){
   stream?.getTracks().forEach(t=>t.stop());
   if(token!==cameraGeneration)return;
   stopCamera(error.name==='NotAllowedError'?'Camera access was not granted. Click anywhere to enter.':error.name==='NotFoundError'?'No camera found. Mouse and touch still work.':'Hand control could not start. Check your connection and browser, or click to enter.');
  }
 }
 cameraButton.addEventListener('click',startCamera);$('#stop-gesture').addEventListener('click',()=>stopCamera());
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);stopCamera();}else if(!done&&!transitioning){lastFrame=0;frame=requestAnimationFrame(draw);}});
 window.addEventListener('pagehide',()=>stopCamera(null));
 let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!done&&!transitioning)setup(false);},160);});
 reduced.addEventListener('change',()=>{if(!done&&!transitioning)setup(false);});
 intro.hidden=false;site.inert=true;document.documentElement.classList.remove('js-pending');document.body.classList.add('intro-active');$('#enter-quiet').focus({preventScroll:true});setup();
 document.fonts?.ready.then(()=>{if(!done&&!transitioning)setup(false);});
 return {enter,replay,stopCamera};
}};
})();
