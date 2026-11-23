// Deploy behind Sites Dispatch, which supplies the authenticated identity headers.
const providers = ['qwen','deepseek'];
const fixedHeaders = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const status = (code, data, headers={})=>Response.json(data,{status:code,headers:{...fixedHeaders,...headers}});
function credentials(env,provider){
  return provider==='qwen'?env.DASHSCOPE_API_KEY:env.DEEPSEEK_API_KEY;
}
function bounded(value, fallback, max){
  const n=Number(value);
  return Number.isSafeInteger(n)&&n>0?Math.min(n,max):fallback;
}
async function reserve(env,user){
  if(!env.DB?.prepare)return false;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(user));
  const userHash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  const day=new Date().toISOString().slice(0,10);
  // One statement arbitrates both caps, including concurrent requests across Workers.
  const row=await env.DB.prepare('INSERT INTO atlas_ai_daily (day,user_hash,requests) SELECT ?,?,1 WHERE (SELECT COALESCE(SUM(requests),0) FROM atlas_ai_daily WHERE day=?) < ? ON CONFLICT(day,user_hash) DO UPDATE SET requests=requests+1 WHERE requests < ? RETURNING requests')
    .bind(day,userHash,day,bounded(env.ATLAS_AI_TOTAL_PER_DAY,100,2000),bounded(env.ATLAS_AI_USER_PER_DAY,5,50)).first();
  return Boolean(row);
}
async function boundedText(stream,maximum){
  if(!stream)return '';
  let length=0;
  const reader=stream.getReader(),decoder=new TextDecoder(), parts=[];
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>maximum){await reader.cancel();throw Error('length');}
      parts.push(decoder.decode(value,{stream:true}));
    }
    parts.push(decoder.decode());return parts.join('');
  }finally{reader.releaseLock();}
}
function providerError(code){
  if(code===401||code===403)return status(403,{error:'provider_credentials'});
  if(code===402||code===429)return status(code,{error:'provider_quota'});
  return status(502,{error:'provider'});
}
async function chat(req,env,ui,path){
  const origin=new URL(req.url).origin;
  if(req.method!=='POST')return status(405,{error:'method'},{Allow:'POST'});
  if(req.headers.get('Origin')!==origin || req.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return status(403,{error:'origin'});
  const user=req.headers.get('oai-authenticated-user-id');
  if(!user||user.length>256)return status(401,{error:'login_required'});
  if(path==='/api/ai/session'||path==='/api/ai/login')return status(200,{authenticated:true,platform:true});
  if(path==='/api/ai/logout')return status(200,{signOutPath:'/signout-with-chatgpt'});
  if(path!=='/api/ai/chat')return status(404,{error:'not_found'});
  if(Number(req.headers.get('Content-Length'))>150000)return status(413,{error:'size'});
  let data;
  try{data=ui.validateConversation(JSON.parse(await boundedText(req.body,150000)));}
  catch(e){return status(e.message==='length'?413:400,{error:'invalid_request'});}
  if(!providers.includes(data.provider))return status(400,{error:'provider_unsupported'});
  const auth=req.headers.get('Authorization')||'';
  const personal=auth.match(/^Bearer ([^\s,]{6,1024})$/i)?.[1];
  if(auth&&!personal)return status(400,{error:'invalid_key'});
  const key=personal||credentials(env,data.provider);
  if(!key)return status(503,{error:'provider_not_configured'});
  if(!personal){
    if(!env.DB?.prepare)return status(503,{error:'operator_quota_not_configured'});
    try{if(!await reserve(env,user))return status(429,{error:'daily_limit'});}
    catch{return status(503,{error:'operator_quota_unavailable'});}
  }
  const region=env.DASHSCOPE_REGION==='intl'?'intl':'cn';
  const target=data.provider==='qwen'?ui.qwenBases[region]+'/chat/completions':ui.endpoint;
  const model=data.provider==='qwen'?(env.DASHSCOPE_MODEL||'qwen-plus'):(env.DEEPSEEK_MODEL||ui.model);
  const deadline=new AbortController(),timer=setTimeout(()=>deadline.abort(),45000);
  try{
    const params=ui.chatBody(data.provider,ui.chatMessages(data.packet,data.history,data.question),model);
    const upstream=await fetch(target,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(params),redirect:'error',signal:deadline.signal});
    if(!upstream.ok)return providerError(upstream.status);
    const answer=JSON.parse(await boundedText(upstream.body,192000)), content=answer?.choices?.[0]?.message?.content;
    if(typeof content!=='string'||!content.trim())return status(502,{error:'provider_response'});
    const usage={};
    for(const k of ['prompt_tokens','completion_tokens','total_tokens'])if(Number.isSafeInteger(answer.usage?.[k])&&answer.usage[k]>=0)usage[k]=answer.usage[k];
    return status(200,{choices:[{message:{content:content.slice(0,24000)}}],...(Object.keys(usage).length?{usage}:{})});
  }catch{return status(502,{error:'provider_unavailable'});}
  finally{clearTimeout(timer);}
}
export function createWorker(assets,ui){
  return {async fetch(req,env={}){
    const pathname=new URL(req.url).pathname.replace(/^\/byline-atlas(?=\/|$)/,'')||'/';
    if(pathname.startsWith('/api/ai/'))return chat(req,env,ui,pathname);
    if(!['GET','HEAD'].includes(req.method))return status(405,{error:'method'},{Allow:'GET, HEAD'});
    const asset=Object.hasOwn(assets,pathname==='/'?'index.html':pathname.slice(1))?assets[pathname==='/'?'index.html':pathname.slice(1)]:null;
    if(!asset)return status(404,{error:'not_found'});
    let body=asset.body;
    if(asset.binary)body=Uint8Array.from(atob(body),c=>c.charCodeAt(0));
    if(asset.type.startsWith('text/html')){
      const config={authenticatedRelay:true,platformAuth:true,signInPath:'/signin-with-chatgpt',signOutPath:'/signout-with-chatgpt',
        relayProviders:providers,operatorProviders:env.DB?providers.filter(p=>Boolean(credentials(env,p))):[],allowRelayKey:true};
      body=body.replace('</head>','<script>window.AtlasAIConfig='+JSON.stringify(config)+'</script></head>');
    }
    return new Response(req.method==='HEAD'?null:body,{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin'}});
  }};
}
