import http from "node:http";

const port = Number(process.env.PORT || 8791);
const allowedOrigins = new Set(["https://nature-q.github.io", ...(process.env.ATLAS_ORIGIN || "").split(",").map(s=>s.trim()).filter(Boolean)]);
const cache = new Map(), inflight = new Map();
let lastStart = 0;
async function lookup(authorId, start) {
  const key = authorId + "/" + start;
  const saved = cache.get(key);
  if (saved?.until > Date.now()) return saved.data;
  if (inflight.has(key)) return inflight.get(key);
  if (!process.env.SERPAPI_KEY) throw new Error("missing-key");
  if (Date.now() - lastStart < 1500) throw new Error("cooldown");
  lastStart = Date.now();
  const query = new URL("https://serpapi.com/search.json");
  query.search = new URLSearchParams({engine:"google_scholar_author",author_id:authorId,hl:"en",num:"100",start:String(start),api_key:process.env.SERPAPI_KEY}).toString();
  const pending = (async () => {
    const res = await fetch(query,{signal:AbortSignal.timeout(24000)});
    if (!res.ok) throw new Error("provider");
    const raw = await res.json();
    if (raw.error || !Array.isArray(raw.articles)) throw new Error("provider");
    const articles = raw.articles.map(a => ({citation_id:a.citation_id,title:a.title,authors:a.authors,publication:a.publication,year:a.year,citedBy:a.cited_by?.value}));
    let nextStart = null;
    if (raw.serpapi_pagination?.next) {
      const params = new URL(raw.serpapi_pagination.next).searchParams;
      const offset = Number(params.get("start") || params.get("cstart"));
      if (Number.isInteger(offset) && offset > start && offset <= 100000) nextStart = offset;
    }
    const data = {articles,nextStart};
    if (cache.size >= 150) cache.delete(cache.keys().next().value);
    cache.set(key,{until:Date.now()+3600000,data});
    return data;
  })();
  inflight.set(key,pending);
  try { return await pending; } finally { inflight.delete(key); }
}
http.createServer(async (req,res) => {
  function send(status,data) {res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});res.end(JSON.stringify(data));}
  if (![ "127.0.0.1:"+port,"localhost:"+port ].includes(req.headers.host) || !allowedOrigins.has(req.headers.origin)) return send(403,{error:"此来源未获本机服务授权。"});
  res.setHeader("Access-Control-Allow-Origin",req.headers.origin);
  res.setHeader("Vary","Origin");
  if (req.url !== "/scholar") return send(404,{error:"地址无效。"});
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Access-Control-Allow-Private-Network","true");res.writeHead(204);res.end();return;
  }
  if (req.method !== "POST" || !req.headers["content-type"]?.startsWith("application/json")) return send(405,{error:"需要 JSON POST 请求。"});
  let payload;
  try {
    const chunks=[];let length=0;
    for await (const chunk of req) {length+=chunk.length;if (length>2048) return send(413,{error:"请求过长。"});chunks.push(chunk);}
    payload=JSON.parse(Buffer.concat(chunks).toString());
  } catch {return send(400,{error:"无效 JSON。"});}
  if (!payload || !/^[\w-]{12}$/.test(String(payload.authorId)) || !Number.isInteger(payload.start) || payload.start<0 || payload.start>100000) return send(400,{error:"作者 ID 或页码无效。"});
  try {send(200,await lookup(payload.authorId,payload.start));} catch(e) {
    if (e.message==="missing-key") return send(503,{error:"服务尚未配置 SerpApi 密钥。"});
    if (e.message==="cooldown") return send(429,{error:"请稍后重试。"});
    send(502,{error:"Google Scholar 数据服务未完成查询，请检查额度或稍后重试。"});
  }
}).listen(port,"127.0.0.1",()=>console.log("Scholar relay listening on 127.0.0.1:"+port));
