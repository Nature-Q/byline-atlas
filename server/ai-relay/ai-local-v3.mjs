// Optional personal loopback server for installations where browser CORS is unavailable.
import http from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const folder=existsSync(resolve(project,'dist/index.html'))?resolve(project,'dist'):project;
const ui=createRequire(import.meta.url)(resolve(folder,'ai-v3.js'));
const origin='http://127.0.0.1:8775';
const key=process.env.DEEPSEEK_API_KEY;
if(!key) { console.error('Set DEEPSEEK_API_KEY before starting the local server.'); process.exit(1); }
// Only publicly shipped application assets are served from the chosen UI directory.
const staticTypes={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.json':'application/json'};
const allowedFiles=new Set(['index.html','zhong.html']);
for(const page of [...allowedFiles]){
  const path=resolve(folder,page);
  if(!existsSync(path)) continue;
  for(const m of readFileSync(path,'utf8').matchAll(/(?:href|src)=["'](?:\.\/)?([a-zA-Z0-9_-]+\.(?:js|css|svg))(?:\?[^"']*)?["']/g)) allowedFiles.add(m[1]);
}
let busy=false;
function reply(res,status,data){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));
}
async function readPacket(req){
  const chunks=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>64000)throw Error('too large');chunks.push(chunk);}
  const o=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!o || !['学者','机构'].includes(o.view) || typeof o.subject!=='string' || o.subject.length>120
    || !Array.isArray(o.papers) || !o.papers.length || o.papers.length>ui.limit || !Number.isSafeInteger(o.eligible) || o.eligible<o.papers.length) throw Error('invalid');
  const text=(s,len)=>typeof s==='string'?s.slice(0,len):'';
  const papers=o.papers.map((p,i)=>{
    if(!p || p.id!=='P'+(i+1) || !text(p.title,260).trim())throw Error('invalid paper');
    return {id:p.id,title:text(p.title,260),year:Number.isInteger(p.year)?p.year:null,journal:text(p.journal,140),doi:text(p.doi,190),source:text(p.source,140),
      roles:Array.isArray(p.roles)?p.roles.filter(r=>['首位作者','共同一作','通讯作者','共同通讯'].includes(r)).slice(0,4):[],
      rolesPending:typeof p.rolesPending==='boolean'?p.rolesPending:null,firstInstitution:typeof p.firstInstitution==='boolean'?p.firstInstitution:null};
  });
  return {subject:o.subject,view:o.view,eligible:o.eligible,papers};
}
async function analyze(req,res){
  if(req.headers.origin!==origin || req.headers['content-type']?.split(';')[0]!=='application/json')return reply(res,403,{error:'origin'});
  if(busy)return reply(res,429,{error:'busy'});
  busy=true;
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),85000);
  res.on('close',()=>controller.abort());
  try {
    let packet;
    try{packet=await readPacket(req);}catch{return reply(res,400,{error:'bibliography'});}
    const up=await fetch(ui.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
      body:JSON.stringify(ui.requestBody(packet)),redirect:'error',signal:controller.signal});
    if(!up.ok)return reply(res,up.status,{error:'provider'});
    const data=await up.json();
    reply(res,200,{choices:[{message:{content:data?.choices?.[0]?.message?.content}}],usage:data?.usage});
  }catch{if(!res.destroyed)reply(res,502,{error:'provider_unavailable'});}
  finally{clearTimeout(timer);busy=false;}
}
const server=http.createServer(async (req,res)=>{
  if(req.headers.host!=='127.0.0.1:8775')return reply(res,403,{error:'host'});
  const path=req.url.split('?',1)[0];
  if(req.method==='POST' && path==='/api/ai/analysis')return analyze(req,res);
  if(req.method!=='GET')return reply(res,405,{error:'method'});
  const name=path==='/'?'index.html':path.slice(1);
  if(!allowedFiles.has(name))return reply(res,404,{error:'not_found'});
  try{
    const data=await readFile(resolve(folder,name));
    res.writeHead(200,{'Content-Type':staticTypes[extname(name)]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);
  }catch{reply(res,404,{error:'not_found'});}
});
server.listen(8775,'127.0.0.1',()=>console.log('Byline Atlas: '+origin));
