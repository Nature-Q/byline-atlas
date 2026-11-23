(() => {
  "use strict";
  const base = window.AtlasFederation;
  if (!base || base.additionalSources) return;
  const semanticApi = "https://api.semanticscholar.org/graph/v1/author/";
  const labels = {dblp:"DBLP", s2:"Semantic Scholar"};
  const pageSize = 100;
  const dblpCache = new Map();
  const clean = value => String(value ?? "").replace(/\s+/g," ").trim();
  const asList = value => value == null ? [] : Array.isArray(value) ? value : [value];
  const validPID = s => /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(s) && !s.includes("..");
  const validS2 = s => /^\d{1,20}$/.test(s);
  const norm = name => clean(name).normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const exactName = (a,b) => norm(a) === norm(b) || norm(a).split(" ").sort().join(" ") === norm(b).split(" ").sort().join(" ");
  function extract(value) {
    const s = clean(value);
    if (/^DBLP[:/]/i.test(s) && validPID(s.slice(5))) return {provider:"dblp", key:s.slice(5)};
    if (/^(?:S2|SemanticScholar)[:/]/i.test(s) && validS2(s.split(/[:/]/)[1])) return {provider:"s2", key:s.split(/[:/]/)[1]};
    try {
      const u = new URL(s);
      if (u.protocol !== "https:" || u.username || u.password) return null;
      const path = u.pathname.replace(/\/$/,"");
      if (["dblp.org","www.dblp.org","dblp.uni-trier.de"].includes(u.hostname) && path.startsWith("/pid/")) {
        const k = path.slice(5).replace(/\.(?:html|xml|bib)$/i,"");
        if (validPID(k)) return {provider:"dblp",key:k};
      }
      const match = path.match(/^\/author\/(?:[^/]+\/)?(\d+)$/);
      if (["www.semanticscholar.org","semanticscholar.org"].includes(u.hostname) && match && validS2(match[1])) return {provider:"s2",key:match[1]};
    } catch {}
    return null;
  }
  function profile(provider,key) {
    return provider === "dblp" ? "https://dblp.org/pid/"+key : "https://www.semanticscholar.org/author/"+key;
  }
  function candidate(provider,key,name,hint,affiliation="",n=null) {
    return {provider,id:provider.toUpperCase()+"/"+key,name:clean(name),profileUrl:profile(provider,key),affiliationHint:hint || "",
      affiliation:clean(affiliation) || "单位待核",detail:labels[provider]+" · "+key+(Number.isSafeInteger(n)?" · 档案列出 "+n+" 篇":"")};
  }
  async function request(url,format) {
    const signal = new AbortController(), timeout = setTimeout(()=>signal.abort(),8500);
    try {
      const r=await fetch(url,{signal:signal.signal,credentials:"omit",referrerPolicy:"no-referrer"});
      if(r.status===202 || r.headers?.get("content-type")?.includes("text/html")) throw Error("来源要求访问验证。可在来源网站核对档案并导出书目。");
      if(!r.ok) throw Error("来源返回 HTTP "+r.status+"，可稍后重试。");
      return format==="xml"?await r.text():await r.json();
    } catch(e) {
      if(e.name==="AbortError"||e instanceof TypeError)throw Error("来源连接超时或未允许跨站读取。");
      throw e;
    } finally {clearTimeout(timeout);}
  }
  function semanticCandidate(r,hint) {
    return candidate("s2",r.authorId,r.name,hint,asList(r.affiliations).join(" · "),r.paperCount);
  }
  const xmlText = (el,tag) => [...el.children].find(c=>c.localName===tag)?.textContent?.trim() || "";
  function dblpCandidate(info,hint) {
    const id=extract(info.url);
    const name=typeof info.author==="string"?info.author:info.author?.text;
    if(id?.provider!=="dblp"||!name)return null;
    const af = asList(info.notes?.note).filter(x=>x?.["@type"]==="affiliation").map(x=>x.text);
    return candidate("dblp",id.key,name,hint,af.filter(Boolean).join(" · "));
  }
  async function names(provider,q,hint) {
    if (provider==="s2"){
      const u = new URL(semanticApi+"search");
      u.search=new URLSearchParams({query:q,fields:"name,affiliations,url,paperCount",limit:"40"});
      const data=await request(u);
      if(!Array.isArray(data?.data))throw Error("Semantic Scholar 未返回作者记录。");
      return data.data.filter(r=>validS2(r.authorId)&&r.name&&exactName(r.name,q)).map(r=>semanticCandidate(r,hint));
    }
    const u=new URL("https://dblp.org/search/author/api");u.search=new URLSearchParams({q,format:"json",h:"24"});
    const data=await request(u);
    if(!data?.result?.hits)throw Error("DBLP 未返回作者候选。");
    return asList(data.result.hits.hit).map(r=>dblpCandidate(r.info||{},hint)).filter(Boolean);
  }
  function doiValue(v) {
    const d=clean(v).replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,"");
    return /^10\.\d{4,9}\/[^\s<>"]+$/i.test(d)?d.toLowerCase():"";
  }
  const workYear = y => /^\d{4}$/.test(String(y))?Number(y):null;
  function paper(provider,key,title,doi,year,journal,workType,url,authors) {
    const source=labels[provider], target=authors.filter(a=>a.isTarget), lead=target.length===1 && authors[0]===target[0];
    return {id:source+"/"+key,title,doi,year,journal,workType,url,issn:[],roles:lead?["first"]:[],roleUnknown:true,firstUnit:null,authors:authors.map(a=>a.name),byline:authors,
      identityPending:true,identityStatus:"review",identityBasis:"provider-profile",identityEvidence:"记录来自所选 "+source+" 作者档案。需核对本人单位、原文或独立身份标识。",
      identityEvidenceUrl:url,source,sources:[source],provenance:[{source,id:key,url}],evidenceUrl:url,
      evidence:lead?"该档案指向作者列表首位。通讯与共同贡献须核对原文。":"保留来源署名顺序。通讯与共同贡献须核对原文。"};
  }
  async function dblpXml(key) {
    const old=dblpCache.get(key);
    if(old?.until>Date.now())return old.data;
    const xml=await request(profile("dblp",key)+".xml","xml");
    const doc=new DOMParser().parseFromString(xml,"application/xml"), root=doc.documentElement;
    if(root?.localName!=="dblpperson" || root.getAttribute("pid")!==key || doc.querySelector("parsererror"))throw Error("无法验证 DBLP 作者 XML 的 PID。可从 DBLP 主页导出 BibTeX 补入。");
    const types={article:"article",inproceedings:"conference-paper",proceedings:"proceedings",book:"book",incollection:"book-chapter",phdthesis:"dissertation",mastersthesis:"dissertation",www:"unknown"};
    const records=[];
    for(const item of [...root.children].filter(el=>el.localName==="r")){
      const p=item.firstElementChild;if(!p)continue;
      const id=p.getAttribute("key"), title=xmlText(p,"title");if(!id||!title)continue;
      const url="https://dblp.org/rec/"+id;
      const authors=[...p.children].filter(x=>x.localName==="author").map((x,i)=>({name:clean(x.textContent),dblpId:x.getAttribute("pid")||"",isTarget:x.getAttribute("pid")===key,position:i===0?"first":"",institutions:[],affiliations:[]}));
      const doi=[...p.children].filter(x=>x.localName==="ee").map(x=>doiValue(x.textContent)).find(Boolean)||"";
      records.push(paper("dblp",id,title,doi,workYear(xmlText(p,"year")),xmlText(p,"journal")||xmlText(p,"booktitle")||xmlText(p,"publisher"),types[p.localName]||"unknown",url,authors));
    }
    const data={records,name:root.getAttribute("name") || clean(root.querySelector("person > author")?.textContent)};
    if(dblpCache.size>=6)dblpCache.delete(dblpCache.keys().next().value);dblpCache.set(key,{until:Date.now()+600000,data});
    return data;
  }
  async function papers(provider,key,year,offset) {
    if(provider==="dblp"){
      const data=await dblpXml(key), rows=data.records.filter(r=>!year||r.year===Number(year));
      return {rows:rows.slice(offset,offset+pageSize),hits:rows.length,scanned:Math.min(offset+pageSize,rows.length),next:offset+pageSize<rows.length?offset+pageSize:null,
        message:"按 DBLP PID 读取作者 XML 并按年份过滤。DBLP 不提供此处所需的引用次数。"};
    }
    const u=new URL(semanticApi+key+"/papers");
    u.search=new URLSearchParams({fields:"title,authors,externalIds,publicationTypes,venue,year,citationCount,url",limit:String(pageSize),offset:String(offset)});
    const page=await request(u);
    if(!Array.isArray(page.data)||Number(page.offset)!==offset)throw Error("Semantic Scholar 返回了无效的论文页码。");
    const rows=[];
    for(const p of page.data) {
      const y=workYear(p.year);if(!p.paperId||!p.title||year&&Number(year)!==y)continue;
      const authors=asList(p.authors).filter(a=>a?.name).map((a,i)=>({name:clean(a.name),semanticScholarId:a.authorId||"",isTarget:a.authorId===key,position:i===0?"first":"",institutions:[],affiliations:[]}));
      const t=asList(p.publicationTypes),kind=t.includes("Conference")?"conference-paper":t.includes("Review")?"review":t.includes("JournalArticle")?"article":t.includes("Book")?"book":"unknown";
      const url="https://www.semanticscholar.org/paper/"+encodeURIComponent(p.paperId);
      const r=paper("s2",p.paperId,p.title,doiValue(p.externalIds?.DOI),y,p.venue||"",kind,url,authors);
      if(/^\d+$/.test(String(p.externalIds?.PubMed || "")))r.pmid=String(p.externalIds.PubMed);
      if(Number.isSafeInteger(p.citationCount)&&p.citationCount>=0){r.citationSource="Semantic Scholar";r.citedByCount=p.citationCount;r.citationEvidence=[{source:r.source,count:p.citationCount,url,observedAt:new Date().toISOString().slice(0,10)}];}
      rows.push(r);
    }
    const next=Number.isSafeInteger(page.next)&&page.next>offset?page.next:null;
    return {rows,hits:next===null?offset+page.data.length:null,scanned:offset+page.data.length,next,message:"按 Semantic Scholar 作者 ID 读取，已读条数包含各年份。同名档案可能混合多位作者。"};
  }
  async function search(mode,query,affiliation="") {
    if(mode!=="author")return base.search(mode,query,affiliation);
    const direct=extract(query);
    if(direct) {
      const {provider,key}=direct;
      if(provider==="dblp"){const data=await dblpXml(key);return [candidate(provider,key,data.name||"DBLP "+key,affiliation,"",data.records.length)];}
      const u=new URL(semanticApi+key);u.searchParams.set("fields","name,affiliations,url,paperCount");
      const r=await request(u);if(r.authorId!==key||!r.name)throw Error("Semantic Scholar 作者编号未匹配。");
      return [semanticCandidate(r,affiliation)];
    }
    if(!clean(query)||/[/:@\d]/.test(query))return base.search(mode,query,affiliation);
    const batch=[],discovery={},jobs=Object.keys(labels).map(async p=>{
      try {
        const rows=await names(p,query,affiliation);batch.push(...rows);
        discovery[labels[p]]={status:"ok",message:rows.length?"已找到独立候选，可在补充档案时选择。":"按此次署名未找到匹配的作者档案。"};
      } catch(e) {discovery[labels[p]]={status:"error",message:clean(e.message || e).slice(0,160)};}
    });
    let basic=[],error;
    try{basic=await base.search(mode,query,affiliation);}catch(e){error=e;}
    // Give already-started secondary searches a short grace period on fast local results.
    let timeout;
    await Promise.race([Promise.all(jobs),new Promise(resolve=>{timeout=setTimeout(resolve,basic.length?750:3000)})]);clearTimeout(timeout);
    if(!basic.length&&!batch.length&&error)throw error;
    return [...basic,...batch].map(c=>({...c,extraDiscovery:{...discovery}}));
  }
  async function load(mode,c,options={}) {
    if(mode!=="author")return base.load(mode,c,options);
    const selected=extract(c?.id), year=String(options.year||""), cursor=options.cursor;
    if(!selected){
      const result=await base.load(mode,c,options);
      const missing=Object.values(labels).map(source=>{
        const state=c.extraDiscovery?.[source];
        return {source,scanned:0,hits:null,status:state?.status==="error"?"error":"unavailable",more:false,
          message:(state?.message || "尚未关联此来源的作者标识。")+" 可补充该源的作者档案或输入其公开个人主页。"};
      });
      return {...result,coverage:[...(result.coverage||[]),...missing]};
    }
    if(year&&!/^\d{4}$/.test(year))throw Error("发表年份应为四位数。");
    const {provider,key}=selected, source=labels[provider],signature=[c.id,year].join("|");
    if(cursor&&(cursor.v4!==signature||!Number.isSafeInteger(cursor.offset)||cursor.offset<=0))throw Error("翻页游标与当前档案或年份不匹配。");
    const result=await papers(provider,key,year,cursor?.offset||0);
    const other=provider==="s2"?"DBLP":"Semantic Scholar",coverage=[{source,status:result.next===null?"ok":"partial",scanned:result.scanned,hits:result.hits,more:result.next!==null,message:result.message},
      {source:other,status:"unavailable",scanned:0,hits:null,more:false,message:"当前读取所选来源的作者档案。可通过补充同人档案关联其他来源。"}];
    const records=base.merge([],result.rows);
    return {records,total:records.length,sourceHits:result.hits,source,coverage,limited:result.next!==null,nextCursor:result.next===null?null:{v4:signature,offset:result.next},note:result.message};
  }
  window.AtlasFederation=Object.freeze({...base,search,load,additionalSources:true});
})();
