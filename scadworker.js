// Runs OpenSCAD off the main thread so the page stays responsive and a render can be cancelled.
let mod=null;
const mkdirp=(FS,p)=>{let c='';for(const s of p.split('/').filter(Boolean)){c+='/'+s;try{FS.mkdir(c);}catch{}}};
self.onmessage=async e=>{
  const {code,args,fnt,xf,libs,uploads}=e.data;
  const log=[];
  try{
    mod=mod||await import('./vendor/openscad.js');
    const inst=await mod.default({noInitialRun:true,print:t=>log.push(t),printErr:t=>log.push(t),
      preRun:[m=>{
        m.ENV.FONTCONFIG_PATH='/fonts';m.ENV.OPENSCADPATH='/libraries';
        mkdirp(m.FS,'/fonts');mkdirp(m.FS,'/tmp/fc');
        for(const [f,d] of fnt)m.FS.writeFile(`/fonts/LiberationSans-${f}.ttf`,d);
        for(const [fn,d] of xf)m.FS.writeFile('/fonts/'+fn,d);
        m.FS.writeFile('/fonts/fonts.conf','<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>/fonts</dir><cachedir>/tmp/fc</cachedir></fontconfig>');
        if(libs){mkdirp(m.FS,'/libraries/BOSL2');for(const [f,d] of libs)m.FS.writeFile(`/libraries/BOSL2/${f}`,d);}
        if(uploads.length){mkdirp(m.FS,'/uploads');for(const [p,d] of uploads)m.FS.writeFile(p,d);}
      }]});
    inst.FS.writeFile('/in.scad',code);
    inst.callMain(args);
    const out=inst.FS.readFile('/out.3mf');
    postMessage({ok:true,out,log},[out.buffer]);
  }catch(err){
    postMessage({ok:false,msg:String((err&&err.message)||err),log});
  }
};
