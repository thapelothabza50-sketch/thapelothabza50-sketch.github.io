/* Campus Collective – shared UI behaviour: reveal-on-load/scroll, glow, progress, toast. */
(()=>{
const d=document,$=(s,c=d)=>[...c.querySelectorAll(s)],rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const bar=d.body.appendChild(Object.assign(d.createElement('div'),{className:'cc-progress'}));
const nav=d.querySelector('nav');
const onScroll=()=>{const h=d.documentElement,m=h.scrollHeight-h.clientHeight;bar.style.width=(m>0?scrollY/m*100:0)+'%';nav&&nav.classList.toggle('cc-scrolled',scrollY>30)};
addEventListener('scroll',onScroll,{passive:true});onScroll();

const CARDS='.feature-card,.team-card,.vision-card,.achievement-card,.choice-card,.student-card,.landlord-card,.assistant-card,.accommodation,.contact-info-box,.card';
const rules=[['.hero-copy>*','left'],['.hero-visual','right'],['.container,.page-header,.mission-header','pop'],
 ['.main-wrapper h1,.subtitle,.section-title,.features h2,.sec-head','up'],[CARDS,'alt'],['.footer-column','up']];
if(!rm&&'IntersectionObserver'in window){
 const seen=new Set(),cnt=new Map(),all=['cc-r','cc-in','cc-left','cc-right','cc-up','cc-pop'];
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const el=e.target;io.unobserve(el);el.classList.add('cc-in');
  setTimeout(()=>el.classList.remove(...all),1700+(parseFloat(el.style.getPropertyValue('--d'))||0)*1000)}),{threshold:.1});
 rules.forEach(([s,dir])=>$(s).forEach(el=>{if(seen.has(el)||el.closest('nav'))return;seen.add(el);
  const n=cnt.get(el.parentNode)||0;cnt.set(el.parentNode,n+1);
  el.style.setProperty('--d',Math.min(n*.09,.45)+'s');
  el.classList.add('cc-r','cc-'+(dir==='alt'?['left','up','right'][n%3]:dir));io.observe(el)}));
 void d.body.offsetHeight;
}
/* cursor glow on glass cards + gentle tilt on the home visual */
const glass=CARDS+',.container';
d.addEventListener('pointermove',e=>{const c=e.target.closest&&e.target.closest(glass);if(c){const r=c.getBoundingClientRect();c.style.setProperty('--mx',e.clientX-r.left+'px');c.style.setProperty('--my',e.clientY-r.top+'px')}},{passive:true});
const hv=d.querySelector('.hero-visual');
if(hv&&!rm)d.addEventListener('pointermove',e=>{hv.style.setProperty('--rx',((e.clientY/innerHeight-.5)*-6)+'deg');hv.style.setProperty('--ry',((e.clientX/innerWidth-.5)*8)+'deg')},{passive:true});
/* welcome pop-up (home only) */
const t=d.getElementById('ccToast');
if(t){let seenIt=false;try{seenIt=sessionStorage.getItem('ccToast')}catch(e){}
 if(!seenIt){const hide=()=>{t.classList.remove('show');try{sessionStorage.setItem('ccToast','1')}catch(e){}};
  setTimeout(()=>t.classList.add('show'),2200);t.querySelector('button').onclick=hide;t.querySelector('a').onclick=hide;setTimeout(hide,12000)}}
/* floating glass orbs behind the page */
[['90px','6%','18%','left','linear-gradient(135deg,#97d2ce,#8db96c)'],['150px','7%','52%','right','linear-gradient(135deg,#4c81a8,#97d2ce)'],['70px','42%','7%','bottom','linear-gradient(135deg,#c99f6b,#8db96c)']]
 .forEach(([s,x,y,side,bg],i)=>{const o=d.createElement('div');o.className='cc-orb';
  Object.assign(o.style,{width:s,height:s,background:bg,animationDelay:-i*4+'s',animationDuration:12+i*3+'s'});
  if(side==='bottom'){o.style.left=x;o.style.bottom=y}else{o.style[side]=x;o.style.top=y}d.body.appendChild(o)});
})();
