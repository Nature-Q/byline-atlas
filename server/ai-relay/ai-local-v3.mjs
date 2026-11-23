// Node 20+. Start locally or publish the loopback listener behind an HTTPS reverse proxy.
import http from 'node:http';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,extname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dir=existsSync(resolve(repo,'dist/index.html'))?resolve(repo,'dist'):repo;
const ui=createRequire(import.meta.url)(resolve(dir,'ai-v3.js'));
const port=Number(process.env.PORT||8775), local='http://127.0.0.1:'+port;
const origin=new URL(process.env.ATLAS_AI_ORIGIN||local);
const password=process.env.ATLAS_AI_PASSWORD||'';
if(origin.origin!==local&&(origin.protocol!=='https:'||password.length<16))throw Error('A hosted service requires an HTTPS ATLAS_AI_ORIGIN and ATLAS_AI_PASSWORD (at least 16 characters).');
const hosted=origin.origin!==local;
const hash=s=>createHash('sha256').update(s).digest();
const sessions=new Map(), attempts=new Map();
const prune=()=>{const now=Date.now();for(const [id,end] of sessions)if(end<=now)sessions.delete(id);for(const [id,x] of attempts)if(x.until<=now)attempts.delete(id);};
const cookie=req=>{const id=String(req.headers.cookie||'').match(/(?:^|;\s*)atlas_ai_session=([a-f0-9]{64})(?:;|$)/)?.[1];return id?hash(id).toString('hex'):'';};
function authCookie(value,age){return 'atlas_ai_session='+value+'; Path=/api/ai/; HttpOnly; SameSite=Strict'+(origin.protocol==='https:'?'; Secure':'')+(age==null?'':'; Max-Age='+age);}
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.json':'application/json'};
const published=new Set(['index.html','zhong.html','ai-worker-v4.js']);
for(const name of ['index.html','zhong.html']){
  if(!existsSync(resolve(dir,name)))continue;
  for(const m of readFileSync(resolve(dir,name),'utf8').matchAll(/(?:href|src)=["'](?:\.\/)?([a-zA-Z0-9_-]+\.(?:js|css|svg))(?:\?[^"']*)?["']/g))published.add(m[1]);
}
function reply(res,status,data,headers={}){
  if(res.destroyed||res.writableEnded)return;
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));
}
async function input(req){
  const chunks=[];let length=0;
  for await(const chunk of req){length+=chunk.length;if(length>150000)throw Error('payload');chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function options(provider){
  if(provider==='deepseek')return {url:ui.endpoint,key:process.env.DEEPSEEK_API_KEY,model:process.env.DEEPSEEK_MODEL||ui.model};
  if(provider==='ollama')return {url:'http://127.0.0.1:11434/api/chat',model:process.env.OLLAMA_MODEL||'qwen3:4b'};
  const base=new URL(process.env.DASHSCOPE_BASE_URL||ui.qwenBases.cn);
  if(base.protocol!=='https:'||base.username||base.password||base.port||base.search||base.hash||!(/^(?:dashscope|dashscope-intl)\.aliyuncs\.com$/.test(base.hostname)||/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.maas\.aliyuncs\.com$/.test(base.hostname))||!/^\/compatible-mode\/v1\/?$/.test(base.pathname))throw Error('Invalid DashScope official compatible-mode base URL.');
  return {url:base.href.replace(/\/$/,'')+'/chat/completions',key:process.env.DASHSCOPE_API_KEY,model:process.env.DASHSCOPE_MODEL||'qwen-plus'};
}
let busy=false;
async function ask(req,res,path){
  const legacy=path==='/api/ai/analysis';
  const json=await input(req).catch(()=>undefined);
  let packet,provider,body;
  try{
    if(legacy){packet=ui.validatePacket(json);if(!packet?.papers.length)throw Error('papers');provider='deepseek';}
    else {body=ui.validateConversation(json);provider=body.provider;}
  }catch{return reply(res,400,{error:'invalid_chat'});}
  if(busy)return reply(res,429,{error:'busy'});
  const config=options(provider);
  if(provider!=='ollama'&&!config.key)return reply(res,503,{error:'missing_provider_credentials'});
  busy=true;
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),95000);res.on('close',()=>ctrl.abort());
  try{
    const messages=legacy?null:ui.chatMessages(body.packet,body.history,body.question);
    const upstream=legacy?{...ui.requestBody(packet),model:config.model}:provider==='ollama'?{model:config.model,messages,stream:false,think:false,options:{num_predict:850,temperature:0.3}}:ui.chatBody(provider,messages,config.model);
    const headers={'Content-Type':'application/json'};if(config.key)headers.Authorization='Bearer '+config.key;
    const response=await fetch(config.url,{method:'POST',headers,body:JSON.stringify(upstream),signal:ctrl.signal,redirect:'error'});
    if(!response.ok)return reply(res,response.status,{error:'provider'});
    const data=await response.json();
    if(provider==='ollama'){
      const prompt=data.prompt_eval_count,completion=data.eval_count, usage=Number.isSafeInteger(prompt)&&Number.isSafeInteger(completion)?{prompt_tokens:prompt,completion_tokens:completion,total_tokens:prompt+completion}:undefined;
      return reply(res,200,{choices:[{message:{content:data.message?.content}}],usage});
    }
    reply(res,200,{choices:[{message:{content:data?.choices?.[0]?.message?.content}}],usage:data.usage});
  }catch{return reply(res,502,{error:'provider_unavailable'});}
  finally{clearTimeout(timer);busy=false;}
}
const server=http.createServer(async(req,res)=>{
  try{
    if(![new URL(local).host,origin.host].includes(req.headers.host))return reply(res,403,{error:'host'});
    const path=req.url.split('?',1)[0];
    if(path.startsWith('/api/ai/')){
      if(req.method!=='POST')return reply(res,405,{error:'method'});
      if(req.headers.origin!==origin.origin||req.headers['content-type']?.split(';')[0]!=='application/json')return reply(res,403,{error:'origin'});
      prune();
      if(path==='/api/ai/login'){
        if(!password)return reply(res,200,{local:true});
        const ip=req.socket.remoteAddress||'local',entry=attempts.get(ip)||{count:0,until:Date.now()+300000};
        if(entry.count>=8)return reply(res,429,{error:'login_limit'});
        const data=await input(req).catch(()=>({}));
        if(typeof data.password!=='string'||!timingSafeEqual(hash(data.password),hash(password))){entry.count++;attempts.set(ip,entry);return reply(res,401,{error:'credentials'});}
        attempts.delete(ip);sessions.delete(cookie(req));const token=randomBytes(32).toString('hex'),age=data.remember===true?7*86400:4*3600;
        if(sessions.size>=256)sessions.delete(sessions.keys().next().value);
        sessions.set(hash(token).toString('hex'),Date.now()+1000*age);
        return reply(res,200,{authenticated:true},{'Set-Cookie':authCookie(token,data.remember===true?age:null)});
      }
      if(path==='/api/ai/logout'){sessions.delete(cookie(req));return reply(res,200,{ok:true},{'Set-Cookie':authCookie('',0)});}
      if(!['/api/ai/chat','/api/ai/analysis'].includes(path))return reply(res,404,{error:'not_found'});
      if(password&&!sessions.has(cookie(req)))return reply(res,401,{error:'login_required'});
      return await ask(req,res,path);
    }
    if(req.method!=='GET')return reply(res,405,{error:'method'});
    const name=path==='/'?'index.html':path.slice(1);
    if(!published.has(name))return reply(res,404,{error:'not_found'});
    const file=await readFile(resolve(dir,name),'utf8');
    let content=file;
    if(extname(name)==='.html'&&(hosted||origin.origin!== 'http://127.0.0.1:8775'))content=file.replace('</head>','<script>window.AtlasAIConfig={authenticatedRelay:true}</script></head>');
    res.writeHead(200,{'Content-Type':types[extname(name)]+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(content);
  }catch{return reply(res,500,{error:'service_error'});}
});
server.listen(port,'127.0.0.1',()=>console.log('Byline Atlas AI: '+origin.origin));
