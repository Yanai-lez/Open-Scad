// Editor extras: syntax colors, Find, Library, Clear + Undo, Share, autosave.
const $=s=>document.querySelector(s);
const om=window.__om||{};
const code=$('#code'),syn=$('#syntax');
const DRAFT='openscad-draft',LIB='openscad-library';
const load=(k,f)=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch{return f;}};
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{return false;}};
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ---------- Toast ---------- */
let toastT;
function toast(msg,label,fn){
  const t=$('#toast');t.innerHTML='';
  const m=document.createElement('span');m.textContent=msg;t.append(m);
  if(label){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{t.hidden=true;fn();};t.append(b);}
  t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},label?8000:3500);
}

/* ---------- Syntax colors (OpenSCAD) ---------- */
const KW=new Set('module function if else for let each include use true false undef intersection_for assert echo'.split(' '));
const BI=new Set(('cube sphere cylinder polyhedron square circle polygon text translate rotate scale resize mirror multmatrix color offset hull minkowski union difference intersection linear_extrude rotate_extrude surface projection render children import import_stl import_dxf version lookup len concat sin cos tan asin acos atan atan2 abs sign floor ceil round sqrt pow exp ln log min max norm cross str chr ord search rands is_undef is_list is_num is_string is_bool is_function').split(' '));
const RX=/(\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*)|("(?:\\[\s\S]|[^"\\\n])*"?)|(\$[A-Za-z_]\w*)|(\b\d+\.?\d*(?:[eE][+-]?\d+)?\b|\.\d+\b)|([A-Za-z_]\w*)|([\s\S])/g;
const COLOR_MAX=300000;
function pieces(text){
  const out=[];let m;RX.lastIndex=0;
  const push=(s,e,c)=>{const l=out[out.length-1];if(l&&l.c===c&&l.e===s)l.e=e;else out.push({s,e,c});};
  while((m=RX.exec(text))){
    const s=m.index,e=s+m[0].length;
    let c='';
    if(m[1])c='tc';else if(m[2])c='ts';else if(m[3])c='tv';else if(m[4])c='tn';
    else if(m[5])c=KW.has(m[5])?'tk':BI.has(m[5])?'tb':'';
    push(s,e,c);
  }
  return out;
}
let hl=null,hlTimer;
function paint(){
  const text=code.value,ps=text.length>COLOR_MAX?[{s:0,e:text.length,c:''}]:pieces(text);
  let html='';
  const seg=(s,e,c)=>{if(e<=s)return;const t=esc(text.slice(s,e));html+=c?`<span class="${c}">${t}</span>`:t;};
  for(const p of ps){
    if(hl&&hl.e>p.s&&hl.s<p.e){
      const a=Math.max(p.s,hl.s),b=Math.min(p.e,hl.e);
      seg(p.s,a,p.c);
      const t=esc(text.slice(a,b));html+='<mark>'+(p.c?`<span class="${p.c}">${t}</span>`:t)+'</mark>';
      seg(b,p.e,p.c);
    }else seg(p.s,p.e,p.c);
  }
  syn.innerHTML=html+'​';
  syn.scrollTop=code.scrollTop;syn.scrollLeft=code.scrollLeft;
}
code.addEventListener('scroll',()=>{syn.scrollTop=code.scrollTop;syn.scrollLeft=code.scrollLeft;});

/* ---------- Autosave + Undo for replaced code ---------- */
let cur=code.value,saveT;
function saveDraft(){store(DRAFT,{code:code.value,name:om.getName?om.getName():'model'});}
function setCode(v){code.value=v;cur=v;code.dispatchEvent(new Event('input',{bubbles:true}));paint();}
code.addEventListener('input',()=>{cur=code.value;hl=null;paint();clearTimeout(saveT);saveT=setTimeout(saveDraft,400);});
addEventListener('pagehide',saveDraft);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveDraft();});
// Code replaced by Paste / Upload / Share / Library (no input event): offer Undo.
setInterval(()=>{
  if(code.value===cur)return;
  const old=cur;cur=code.value;hl=null;paint();saveDraft();
  if(old.trim())toast('Code replaced.','Undo',()=>{setCode(old);if(om.tab)om.tab('codepane');});
},300);
// Restore the last draft (unless a file was just shared/opened into the app).
if(!/[?&]shared/.test(location.search)&&!code.value){
  const d=load(DRAFT,null);
  if(d&&d.code){code.value=d.code;cur=d.code;if(om.setName&&d.name)om.setName(d.name);}
}
paint();

/* ---------- Clear ---------- */
$('#btnClear').onclick=()=>{
  const old=code.value;if(!old.trim()){toast('The text box is already empty.');return;}
  setCode('');saveDraft();
  toast('Cleared.','Undo',()=>{setCode(old);saveDraft();});
};

/* ---------- Library ---------- */
const getLib=()=>load(LIB,[]);
function addToLib(name,text){
  const lib=getLib(),it=lib.find(x=>x.name===name);
  if(it){it.code=text;it.updated=Date.now();}else lib.push({id:Date.now().toString(36),name,code:text,updated:Date.now()});
  return store(LIB,lib);
}
function renderLib(){
  const ul=$('#libList');ul.innerHTML='';
  const lib=getLib().sort((a,b)=>b.updated-a.updated);
  if(!lib.length){const li=document.createElement('li');li.className='m';li.textContent='Nothing saved yet. Tap Save .scad to add files here.';ul.append(li);return;}
  for(const it of lib){
    const li=document.createElement('li');
    const n=document.createElement('span');n.className='n';n.textContent=it.name+'.scad';
    const o=document.createElement('button');o.textContent='Open';
    o.onclick=()=>{$('#libDlg').close();if(om.loadCode)om.loadCode(it.code,it.name);};
    const d=document.createElement('button');d.textContent='Delete';
    d.onclick=()=>{if(confirm('Delete "'+it.name+'.scad" from the library?')){store(LIB,getLib().filter(x=>x.id!==it.id));renderLib();}};
    li.append(n,o,d);ul.append(li);
  }
}
$('#btnLib').onclick=()=>{renderLib();$('#libDlg').showModal();};
$('#libClose').onclick=()=>$('#libDlg').close();
$('#libDlg').addEventListener('click',e=>{if(e.target===$('#libDlg'))$('#libDlg').close();});
$('#btnSave').addEventListener('click',()=>{
  if(!code.value.trim())return;
  const name=om.getName?om.getName():'model';
  toast(addToLib(name,code.value)?'Saved "'+name+'.scad" and added it to your library.':'Saved "'+name+'.scad". (Library storage is unavailable.)');
});

/* ---------- Share ---------- */
if(navigator.share)$('#btnShare').hidden=false;
$('#btnShare').onclick=()=>{
  if(!code.value.trim()){toast('The text box is empty.');return;}
  const name=(om.getName?om.getName():'model')+'.scad';
  const file=new File([code.value],name,{type:'text/plain'});
  if(navigator.canShare&&navigator.canShare({files:[file]}))
    navigator.share({files:[file],title:name}).catch(e=>{if(e&&e.name!=='AbortError')toast('Sharing failed.');});
  else{
    const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.append(a);a.click();a.remove();
    toast('This device cannot share files, so "'+name+'" was downloaded instead.');
  }
};

/* ---------- Find (text or line number) ---------- */
const fb=$('#findbar'),fi=$('#findIn'),fm=$('#findMode'),fc=$('#findCount');
let cw=7.8;try{const g=document.createElement('canvas').getContext('2d');g.font='13px ui-monospace, monospace';cw=g.measureText('M').width||7.8;}catch{}
function reveal(s){
  const text=code.value,before=text.slice(0,s),line=before.split('\n').length-1,col=s-(before.lastIndexOf('\n')+1);
  code.scrollTop=Math.max(0,line*19.5-code.clientHeight/2);
  code.scrollLeft=Math.max(0,col*cw-code.clientWidth/2);
}
function show(s,e){
  hl={s,e};paint();reveal(s);
  clearTimeout(hlTimer);hlTimer=setTimeout(()=>{hl=null;paint();},4000);
}
function lineRanges(){const r=[];let p=0;for(const l of code.value.split('\n')){r.push([p,p+l.length]);p+=l.length+1;}return r;}
function run(dir){
  const q=fi.value;if(!q){fc.textContent='';return;}
  const text=code.value;
  if(fm.value==='line'){
    const rs=lineRanges();let n=parseInt(q,10);
    if(!(n>=1))n=1;
    if(hl&&hl.line&&dir){n=hl.line+(dir==='prev'?-1:1);}
    if(n>rs.length)n=1;if(n<1)n=rs.length;
    const [s,e]=rs[n-1];show(s,Math.max(e,s+1));hl.line=n;fc.textContent='Line '+n+'/'+rs.length;fi.value=String(n);return;
  }
  const low=text.toLowerCase(),ql=q.toLowerCase();
  const all=[];let i=-1;while((i=low.indexOf(ql,i+1))!==-1)all.push(i);
  if(!all.length){fc.textContent='No match';hl=null;paint();return;}
  let idx;const at=hl?hl.s:-1;
  if(dir==='prev'){idx=all.map((x,k)=>x<at?k:-1).filter(k=>k>=0).pop();if(idx===undefined)idx=all.length-1;}
  else if(dir==='next'){idx=all.findIndex(x=>x>at);if(idx<0)idx=0;}
  else{idx=all.findIndex(x=>x>=Math.max(0,at));if(idx<0)idx=0;}
  show(all[idx],all[idx]+q.length);fc.textContent=(idx+1)+'/'+all.length;
}
$('#btnFind').onclick=()=>{fb.hidden=!fb.hidden;if(!fb.hidden)fi.focus();else{hl=null;paint();}};
$('#findClose').onclick=()=>{fb.hidden=true;hl=null;paint();};
$('#findNext').onclick=()=>run('next');
$('#findPrev').onclick=()=>run('prev');
['findNext','findPrev','findClose'].forEach(id=>$('#'+id).addEventListener('mousedown',e=>e.preventDefault()));
fi.addEventListener('input',()=>{hl=null;run(null);});
fm.addEventListener('change',()=>{fi.inputMode=fm.value==='line'?'numeric':'text';fi.placeholder=fm.value==='line'?'Line number':'Find';hl=null;fc.textContent='';});
fi.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run(e.shiftKey?'prev':'next');}else if(e.key==='Escape')$('#findClose').click();});
