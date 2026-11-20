(function federation() {
  "use strict";
  const list = v => Array.isArray(v) ? v : v == null || v === "" ? [] : [v];
  const clean = v => String(v ?? "").replace(/\s+/g, " ").trim();
  const norm = v => clean(v).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const distinct = values => [...new Set(values.filter(Boolean))];
  const objects = (values, key) => [...new Map(values.filter(Boolean).map(v => [key(v),v])).values()];
  const validUrl = v => {try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch { return ""; }};
  function orcid(value) {
    const key = clean(value).replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, "").replace(/\/$/, "").toUpperCase();
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(key)) return "";
    const chars = key.replaceAll("-", "");
    const checksum = (12 - [...chars.slice(0,-1)].reduce((n,c) => (n+Number(c))*2,0)%11)%11;
    return chars.at(-1) === (checksum === 10 ? "X" : String(checksum)) ? key : "";
  }
  function candidateOrcid(c) {
    if (orcid(c.requestedOrcid)) return orcid(c.requestedOrcid);
    const ids = distinct([c.orcid,...list(c.observedOrcids)].map(orcid));
    return ids.length === 1 ? ids[0] : "";
  }
  const doi = v => {const s = clean(v).replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "").toLowerCase();return /^10\.\d{4,9}\/[^\s"<>]+$/.test(s) ? s : "";};
  const pmid = v => {const m=clean(v).match(/^(?:(?:MED\/|PMID:\s*)|https?:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov\/|www\.ncbi\.nlm\.nih\.gov\/pubmed\/))?(\d+)\/?$/i);return m ? m[1] : "";};
  const sourceName = r => r.sources?.[0] || (/OpenAlex/i.test(r.source) ? "OpenAlex" : /Europe PMC|PubMed/i.test(r.source) ? "Europe PMC" : /书目导入|Google Scholar/i.test(r.source) ? "Google Scholar" : r.source || "已有记录");
  const instKey = i => i.ror || i.id || norm(i.name);
  function fromSource(item, source) {
    const row = {...item}, name = source || sourceName(row);
    row.doi = doi(row.doi);
    row.pmid = pmid(row.pmid) || pmid(/^MED\//i.test(row.id||"") ? row.id : "");
    row.sources = distinct([...list(row.sources), name]);
    const u = validUrl(row.evidenceUrl || (name==="OpenAlex"&&/^W\d+$/.test(row.id)?"https://openalex.org/"+row.id:row.url));
    row.provenance = row.provenance?.length ? [...row.provenance] : [{source:name,id:row.id || row.doi,url:u,year:row.year || null,title:row.title || "",identityBasis:row.identityBasis || ""}];
    row.conflicts = [...list(row.conflicts)];
    row.byline = list(row.byline);
    const targetBylines=row.byline.filter(p=>p.isTarget);
    row.authorAffiliations = objects([...list(row.authorAffiliations),...(targetBylines.length===1?list(targetBylines[0].institutions):[])],instKey);
    row.keywords = list(row.keywords);
    if (!Number.isSafeInteger(row.citedByCount)||row.citedByCount<0) row.citedByCount = null;
    row.citationEvidence=list(row.citationEvidence).filter(e=>e?.source&&Number.isSafeInteger(e.count)&&e.count>=0);
    const countSource=row.citationSource || (row.sources.length===1?name:"");
    if (row.citedByCount!==null && countSource && !row.citationEvidence.some(e=>e.source===countSource)) {
      const scholarUrl=validUrl(row.citationUrl||row.importCitationUrl||row.url);
      const evidenceUrl=countSource==="Google Scholar"?(/^https?:\/\/scholar\.google\./i.test(scholarUrl)?scholarUrl:""):u;
      row.citationEvidence.push({source:countSource,count:row.citedByCount,url:evidenceUrl,observedAt:new Date().toISOString().slice(0,10)});
    }
    row.citationsBySource={...row.citationsBySource};
    for(const e of [...row.citationEvidence].sort((a,b)=>clean(a.observedAt).localeCompare(clean(b.observedAt))))row.citationsBySource[e.source]=e.count;
    return row;
  }
  function mergeByline(left,right) {
    if (!left.length) return right;
    // Preserve the order and completeness which the primary source attests.
    return left.map(a => {
      const matches = right.filter(b => {
        if (a.orcid && b.orcid) return a.orcid===b.orcid;
        if (a.openAlexId && b.openAlexId) return a.openAlexId===b.openAlexId;
        return norm(a.name) && norm(a.name)===norm(b.name) && left.filter(p=>norm(p.name)===norm(a.name)).length===1;
      });
      if (matches.length!==1) return a;
      const b=matches[0];
      return {...b,...a,orcid:a.orcid||b.orcid||"",openAlexId:a.openAlexId||b.openAlexId||"",
        affiliations:distinct([...list(a.affiliations),...list(b.affiliations)]),
        institutions:objects([...list(a.institutions),...list(b.institutions)],instKey)};
    });
  }
  function preference(row) {
    if (row.review || row.excluded || row.identityReview) return 100;
    if (row.identityPending || row.identityStatus==="review") return 0;
    if (row.verificationUrl) return 8;
    return ({"work-orcid":6,"orcid-record":4,"work-affiliation":3})[row.identityBasis] || 2;
  }
  function combine(a,b) {
    const manual = Boolean(a.review||a.identityReview||a.excluded||b.review||b.identityReview||b.excluded);
    const [main,extra] = preference(b)>preference(a) ? [b,a] : [a,b];
    const mixed = {...extra,...main,id:a.id||b.id,doi:a.doi||b.doi,pmid:a.pmid||b.pmid,pmcid:a.pmcid||b.pmcid||""};
    mixed.sources=distinct([...a.sources,...b.sources]);
    mixed.provenance=objects([...a.provenance,...b.provenance],p=>[p.source,p.id,p.url].join("|"));
    mixed.conflicts=distinct([...a.conflicts,...b.conflicts]);
    if (a.year&&b.year&&a.year!==b.year) mixed.conflicts.push("发表年份不一致："+a.year+" / "+b.year);
    if (a.title&&b.title&&norm(a.title)!==norm(b.title)) mixed.conflicts.push("来源题名有差异，请对照原始记录。");
    mixed.conflicts=distinct(mixed.conflicts);
    const targetMismatch=Boolean(orcid(a.workOrcid)&&orcid(b.workOrcid)&&orcid(a.workOrcid)!==orcid(b.workOrcid));
    if (targetMismatch || mixed.conflicts.includes("来源指向不同的作者 ORCID。")) {
      mixed.conflicts=distinct([...mixed.conflicts,"来源指向不同的作者 ORCID。"]);
      if (!manual) Object.assign(mixed,{identityPending:true,identityStatus:"review",identityBasis:"review",identityEvidence:"同一成果的来源指向不同作者 ORCID，请逐篇核实。"});
    }
    const extraSafe = !targetMismatch && !extra.identityPending;
    if (!manual && extraSafe) mixed.roles=distinct([...list(main.roles),...list(extra.roles)]);
    const secondaryLine=extraSafe?extra.byline:extra.byline.map(person=>({...person,isTarget:false}));
    mixed.byline=mergeByline(main.byline,secondaryLine);
    mixed.authorAffiliations=objects([...main.authorAffiliations,...(extraSafe?extra.authorAffiliations:[])],instKey);
    mixed.keywords=objects([...main.keywords,...extra.keywords],k=>norm(typeof k==="string"?k:k.display_name||k.name||k.label));
    mixed.keywordEvidence=objects([...list(main.keywordEvidence),...list(extra.keywordEvidence)],e=>[e.source,e.kind,norm(e.term)].join("|"));
    mixed.issn=distinct([...list(main.issn),...list(extra.issn)]);
    mixed.citationsBySource={...extra.citationsBySource,...main.citationsBySource};
    mixed.citationEvidence=objects([...main.citationEvidence,...extra.citationEvidence],e=>[e.source,e.observedAt,e.count,e.url].join("|"));
    for(const e of [...mixed.citationEvidence].sort((l,r)=>clean(l.observedAt).localeCompare(clean(r.observedAt))))mixed.citationsBySource[e.source]=e.count;
    const counts=mixed.citationsBySource;
    mixed.citedByCount=counts.OpenAlex??counts["Europe PMC"]??counts.Crossref??counts["Google Scholar"]??main.citedByCount??extra.citedByCount??null;
    mixed.citationSource=["OpenAlex","Europe PMC","Crossref","Google Scholar"].find(s=>counts[s]!=null)||main.citationSource||extra.citationSource||"";
    if ((!main.journal || /^(?:来源|期刊)待核$/.test(main.journal)) && extra.journal) mixed.journal=extra.journal;
    if (!mixed.year) mixed.year=extra.year||null;
    return mixed;
  }
  const paperTitle = r => norm(r.title).length>=16 && r.year ? norm(r.title)+"|"+r.year : "";
  function compatible(a,b) {
    return !(a.doi&&b.doi&&a.doi!==b.doi || a.pmid&&b.pmid&&a.pmid!==b.pmid);
  }
  function firstSignature(row) {
    if(row.byline?.[0]?.name)return norm(row.byline[0].name);
    const entry=clean(row.importAuthorText).split(/\s+and\s+|;/i)[0], parts=entry.split(",");
    if(parts.length>2)return "";
    return norm(parts.length===2?parts[1]+" "+parts[0]:entry);
  }
  function titleCorroborated(a,b) {
    const aa=firstSignature(a), bb=firstSignature(b);
    if (aa && bb && aa!==bb) return false;
    const ja=norm(a.journal), jb=norm(b.journal);
    const venue=ja && ja===jb && !/待核|缺失|unknown/i.test(ja);
    return Boolean(aa && aa===bb || venue);
  }
  function merge(existing=[],incoming=[]) {
    const rows=[], indexes=new Map(), titles=new Map(), redirects=new Map();
    function active(i){while(redirects.has(i))i=redirects.get(i);return i;}
    function keys(r) {
      return distinct([r.doi&&"doi:"+r.doi,r.pmid&&"pmid:"+r.pmid,
        ...r.provenance.filter(p=>p.id).map(p=>"source:"+p.source+"|"+p.id)]);
    }
    const addIndex=(map,k,i)=>{if(!k)return;if(!map.has(k))map.set(k,new Set());map.get(k).add(i);};
    const all=[...existing,...incoming].map(r=>fromSource(r));
    // A title shared by two different DOIs or PMIDs cannot identify an unkeyed export.
    const groups=new Map();for(const r of all){const key=paperTitle(r);if(!key)continue;if(!groups.has(key))groups.set(key,{doi:new Set(),pmid:new Set()});const g=groups.get(key);if(r.doi)g.doi.add(r.doi);if(r.pmid)g.pmid.add(r.pmid);}
    for(const r of all) {
      const strong=new Set(keys(r).flatMap(k=>[...(indexes.get(k)||[])].map(active)));
      const possible=[...strong].filter(i=>compatible(rows[i],r));
      const title=paperTitle(r), group=groups.get(title);
      if (!strong.size && title && group.doi.size<=1 && group.pmid.size<=1) {
        const hits=[...new Set([...(titles.get(title)||[])].map(active))].filter(i=>compatible(rows[i],r)&&titleCorroborated(rows[i],r));
        if(hits.length===1)possible.push(hits[0]);
      }
      const disagreement=strong.size>possible.length || possible.some((i,n)=>possible.slice(n+1).some(j=>!compatible(rows[i],rows[j])));
      if (disagreement) {
        const warning="标识符指向不一致的记录，请核查 DOI 和 PMID。";
        for (const item of [r,...[...strong].map(index=>rows[index])]) {
          item.conflicts=distinct([...item.conflicts,warning]);
          if(!item.review&&!item.identityReview&&!item.excluded)Object.assign(item,{identityPending:true,identityStatus:"review",identityBasis:"review",identityEvidence:warning});
        }
      }
      const matched=possible.length>0 && !disagreement;
      const i=matched?possible[0]:rows.length;
      if(matched) for(const j of possible.slice(1)) {rows[i]=combine(rows[i],rows[j]);rows[j]=null;redirects.set(j,i);}
      rows[i]=matched?combine(rows[i],r):r;
      for (const key of keys(rows[i])) addIndex(indexes,key,i);
      addIndex(titles,title,i);
    }
    return rows.filter(Boolean);
  }
  async function getJson(url,headers={}) {
    const ctl=new AbortController(), timer=setTimeout(()=>ctl.abort(),15000);
    try {
      const res=await fetch(url,{headers,signal:ctl.signal,credentials:"omit"});
      if (!res.ok) throw Error("HTTP "+res.status + (res.status===429?" · 来源限流":res.status===401||res.status===403?" · 需要数据源授权":""));
      return await res.json();
    } finally {clearTimeout(timer);}
  }
  function importScholar(text) {
    return merge([],window.AtlasImport.parseBibliography(text).map(r=>fromSource({...r,identityPending:true,identityBasis:"review",identityStatus:"review",identityEvidence:"用户导入的书目，作者身份待逐篇核查。"},"Google Scholar")));
  }
  const completeName = s => norm(s).split(" ").filter(w=>w.length>1).length>=2 || /^[\p{Script=Han}]{2,6}$/u.test(clean(s));
  function fullMatch(a,n) {
    const g=norm(a.given), f=norm(a.family), wanted=norm(n);
    if (g && f && completeName(n)) return [g+" "+f,f+" "+g,g+f,f+g].includes(wanted);
    return completeName(n) && norm(a.name)===wanted;
  }
  const types={"journal-article":"article","proceedings-article":"proceedings-article","book-chapter":"book-chapter","posted-content":"preprint","journal-issue":"journal-issue"};
  function crossrefRow(w,c) {
    const aa=list(w.author), target=candidateOrcid(c);
    const byId=target ? aa.filter(a=>orcid(a.ORCID)===target) : [];
    const byName=aa.filter(a=>fullMatch(a,c.name));
    if (!byId.length && !byName.length) return null;
    // A deposited ORCID from another person outweighs a name-only resemblance.
    if (!byId.length && target && byName.every(a=>orcid(a.ORCID)&&orcid(a.ORCID)!==target)) return null;
    const mine=byId.length===1 ? byId[0] : !byId.length&&byName.length===1 ? byName[0] : null;
    const keyed=Boolean(mine && target && orcid(mine.ORCID)===target && byId.length===1);
    const authorEntries=aa.map(a=>{
      const institutions=list(a.affiliation).map(i=>({name:clean(i.name),ror:validUrl(list(i.id).find(k=>String(k["id-type"]||"").toLowerCase()==="ror")?.id)})).filter(i=>i.name);
      return {name:clean([a.given,a.family].filter(Boolean).join(" ")||a.name),orcid:orcid(a.ORCID),affiliations:institutions.map(i=>i.name),institutions,isTarget:a===mine};
    });
    const d=doi(w.DOI), url=validUrl(w.URL) || (d?"https://doi.org/"+d:"");
    if (!d || !w.title?.[0]) return null;
    const pdate=w.published||w["published-print"]||w["published-online"]||w.issued;
    const year=Number(pdate?.["date-parts"]?.[0]?.[0])||null;
    const pos=aa.indexOf(mine), own=authorEntries[pos];
    return {id:"CR/"+d,doi:d,title:clean(w.title[0]),journal:clean(w["container-title"]?.[0])||"来源待核",year,
      issn:distinct(list(w.ISSN)),workType:types[w.type]||w.type||"unknown",url,evidenceUrl:"https://api.crossref.org/works/"+encodeURIComponent(d),
      byline:authorEntries,authorAffiliations:own?.institutions||[],workOrcid:own?.orcid||"",rawAuthorName:own?.name||"",keywords:list(w.subject),
      keywordEvidence:list(w.subject).filter(s=>typeof s==="string"&&s.trim()).map(term=>({term,source:"Crossref",kind:"期刊主题"})),
      roles:pos===0&&(!mine.sequence||mine.sequence==="first")?["first"]:[],roleUnknown:true,firstUnit:null,
      citedByCount:Number.isFinite(w["is-referenced-by-count"])?w["is-referenced-by-count"]:null,source:"Crossref",
      identityPending:!keyed,identityStatus:keyed?"supported":"review",identityBasis:keyed?"work-orcid":"review",identityEvidenceUrl:url,
      identityEvidence:keyed?"Crossref 署名行 ORCID 与所选作者一致。":"Crossref 姓名候选，身份需结合逐篇署名地址确认。",
      evidence:pos>=0?"Crossref 登记作者顺位为第 "+(pos+1)+" 位。通讯、同等贡献请核对出版商原文。":"同一署名有多个候选，请核对原文。"};
  }
  async function crossrefStream(c,opts,kind) {
    const url=new URL("https://api.crossref.org/works");
    const filters=[], pageSize=50;
    if(kind==="name")url.searchParams.set("query.author",c.name);
    else filters.push("orcid:"+candidateOrcid(c));
    if (opts.year) filters.push("from-pub-date:"+opts.year+"-01-01","until-pub-date:"+opts.year+"-12-31");
    if(filters.length)url.searchParams.set("filter",filters.join(","));
    url.searchParams.set("rows",String(pageSize));url.searchParams.set("cursor",opts.cursor||"*");
    const json=await getJson(url), msg=json.message;
    if (!Array.isArray(msg?.items)) throw Error("Crossref 的返回格式不完整。");
    const records=msg.items.map(w=>crossrefRow(w,c)).filter(Boolean);
    const count=Number(msg["total-results"]), scanned=msg.items.length;
    const hits=Number.isFinite(count)?count:null;
    const next=scanned===pageSize && (hits===null || (opts.scanned||0)+scanned<hits) && msg["next-cursor"];
    return {records,scanned,sourceHits:hits,nextCursor:next||null,note:"姓名检索为模糊召回，按逐篇作者标识或完整姓名筛选。"};
  }
  async function crossref(c,opts) {
    const channels=[];
    if(candidateOrcid(c))channels.push("orcid");
    if(completeName(c.name)&&!orcid(c.name))channels.push("name");
    if(!channels.length)throw Error("缺少完整署名或 ORCID。");
    const state={...opts.cursor?.streams}, results=[], alerts=[];
    await Promise.all(channels.map(async kind=>{
      const old=state[kind]||{};
      if(old.done)return;
      try{
        const batch=await crossrefStream(c,{...opts,cursor:old.cursor,scanned:old.scanned||0},kind);
        state[kind]={scanned:(old.scanned||0)+batch.scanned,hits:batch.sourceHits,cursor:batch.nextCursor,done:!batch.nextCursor};
        results.push(batch);
      }catch(e){
        const warning=(kind==="name"?"姓名":"ORCID")+"查询："+message(e);
        state[kind]={...old,done:true,error:warning};alerts.push(warning);
      }
    }));
    if(!results.length && alerts.length)throw Error(alerts.join("；"));
    const parts=Object.values(state);
    const warnings=parts.map(x=>x.error).filter(Boolean);
    return {records:results.flatMap(v=>v.records),scanned:results.reduce((n,s)=>n+s.scanned,0),
      sourceHits:parts.reduce((n,s)=>n+(s.hits||0),0),nextCursor:parts.some(x=>!x.done)?{streams:state}:null,
      partialFailure:warnings.length>0,note:"ORCID 精确检索及完整姓名检索按可用线索执行，原始命中可能重叠。"+warnings.join("；")};
  }
  async function orcidWorks(c,opts) {
    const id=candidateOrcid(c);
    const data=await getJson("https://pub.orcid.org/v3.0/"+id+"/works",{Accept:"application/json"});
    if (!Array.isArray(data.group)) throw Error("ORCID 的返回格式不完整。");
    const records=[]; let n = 0;
    for(const g of data.group) {
      const works=list(g["work-summary"]);
      const w=works.reduce((best,item)=>!best||Number(item["display-index"]||0)>Number(best["display-index"]||0)?item:best,null);
      if(!w||!w.title?.title?.value)continue;
      const year=Number(w["publication-date"]?.year?.value)||null;
      if(opts.year&&year!==Number(opts.year))continue;
      n++;
      const ids=list(w["external-ids"]?.["external-id"]).filter(i=>!i["external-id-relationship"]||i["external-id-relationship"]==="self");
      const findId=(k)=>ids.find(i=>clean(i["external-id-type"]).toLowerCase()===k)?.["external-id-value"];
      const d=doi(findId("doi")), p=pmid(findId("pmid")), profile="https://orcid.org/"+id, put=String(w["put-code"]||"");
      if(!put&&!d&&!p)continue;
      records.push({id:"ORCID/"+id+"/"+(put||d||p),title:clean(w.title.title.value),doi:d,pmid:p,journal:clean(w["journal-title"]?.value)||"来源待核",year,
        workType:types[w.type]||w.type||"unknown",url:(d?"https://doi.org/"+d:"")||validUrl(w.url?.value)||profile,
        evidenceUrl:put?"https://pub.orcid.org/v3.0/"+id+"/work/"+put:profile,source:"ORCID",identityPending:false,identityStatus:"supported",identityBasis:"orcid-record",
        identityEvidence:"该作品列于选定 ORCID 的公开成果档案。",identityEvidenceUrl:profile,roles:[],roleUnknown:true,firstUnit:null,
        evidence:"公开成果登记未提供可确认的作者顺位。署名角色和单位请核实原文。"});
    }
    return {records,scanned:data.group.length,sourceHits:opts.year?n:data.group.length,nextCursor:null,note:"按 ORCID 已公开的成果分组读取。"};
  }
  const oaId = v => clean(v).replace(/^https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?/i,"").replace(/\/$/,"").toUpperCase();
  const publicOrcidEnabled=()=>window.AtlasFederationConfig?.publicOrcidEnabled!==false;
  async function orcidCandidates(q,hint) {
    if(!publicOrcidEnabled()||orcid(q)||!completeName(q))return [];
    const words=clean(q).replace(/,/g," ").split(/\s+/).filter(Boolean);
    const quote=v=>'"'+v.replace(/[\\"]/g,"\\$&")+'"';
    const patterns=["credit-name:"+quote(q)];
    if(words.length>1) {
      patterns.push("(given-names:"+quote(words.slice(0,-1).join(" "))+" AND family-name:"+quote(words.at(-1))+")");
      patterns.push("(given-names:"+quote(words.slice(1).join(" "))+" AND family-name:"+quote(words[0])+")");
    }
    const u=new URL("https://pub.orcid.org/v3.0/expanded-search");
    u.searchParams.set("q",patterns.join(" OR "));u.searchParams.set("rows","16");
    const data=await getJson(u,{Accept:"application/json"});
    return list(data["expanded-result"]).flatMap(r=>{
      const id=orcid(r["orcid-id"]), names=list(r["institution-name"]).map(clean).filter(Boolean);
      if(!id)return [];
      const name=clean([r["given-names"],r["family-names"]].filter(Boolean).join(" ")||r["credit-name"]||q);
      const matched=hint&&names.find(v=>norm(v).includes(norm(hint)));
      return [{id:"ORCID/"+id,provider:"orcid",name,orcid:id,requestedOrcid:id,affiliation:matched||names.join(" · ")||"公开 ORCID 档案",affiliationHint:hint,matched:Boolean(matched),detail:"ORCID 档案 · "+id}];
    });
  }
  async function search(mode,value,affiliation="") {
    if(mode!=="author")return window.ScholarSource.search(mode,value,affiliation);
    const q=clean(value),hint=clean(affiliation),id=orcid(q);
    if(!q)throw Error("请输入作者姓名、ORCID 或 OpenAlex 作者标识。");
    if(/^A\d+$/.test(oaId(q)))return window.ScholarSource.search(mode,q,hint);
    if(!id && (/^(?:https?:\/\/|scholar\.google\.)/i.test(q) || /^[\dX]+(?:-[\dX]+){3}$/i.test(q))) throw Error("请使用完整姓名、有效的 ORCID 或 OpenAlex 作者标识。Google Scholar 主页可导出 BibTeX 或 CSV 再导入。");
    const found=await Promise.allSettled([Promise.resolve().then(()=>window.ScholarSource.search(mode,q,hint)),Promise.resolve().then(()=>window.PmcSource.search(mode,q,hint)),orcidCandidates(q,hint)]);
    const candidates=found.flatMap(r=>r.status==="fulfilled"?r.value:[]);
    const result=[], byOrcid=new Map();
    for (const raw of candidates) {
      const c={...raw,provider:raw.provider||"openalex",affiliationHint:hint||raw.affiliationHint||""};
      const key=candidateOrcid(c), previous=byOrcid.get(key);
      // Two different OpenAlex person IDs can share an erroneous ORCID; keep both visible.
      if(key && previous && previous.provider!==c.provider && result.filter(x=>candidateOrcid(x)===key).length===1) {
        previous.matchSources=distinct([...(previous.matchSources||[]),c.provider]);
        if(!previous.affiliationHint)previous.affiliationHint=c.clue||"";
        continue;
      }
      c.matchSources=[c.provider];result.push(c);if(key)byOrcid.set(key,c);
    }
    if (id && !result.some(c=>candidateOrcid(c)===id)) result.push({id:"ORCID/"+id,provider:"bibliographic",orcid:id,requestedOrcid:id,name:id,affiliation:hint||"公开 ORCID 档案",affiliationHint:hint,detail:"ORCID 精确检索"});
    if (!id && completeName(q) && !result.some(c=>c.id.startsWith("MED/NAME/"))) {
      result.push({id:"NAME/"+norm(q)+"/"+norm(hint),provider:"bibliographic",name:q,affiliation:hint||"单位待核",affiliationHint:hint,detail:"按完整署名跨库查找，待核成果不计入个人指标。"});
    }
    if(!result.length && found.every(o=>o.status==="rejected")) throw Error("无法取得作者候选，请使用完整署名或 ORCID。");
    return result;
  }
  const message = err => clean(err?.message||err).slice(0,220) || "来源访问失败";
  async function load(mode,c,options={}) {
    if(mode!=="author")return window.ScholarSource.load(mode,c,options);
    const year=clean(options.year);
    if(year&&!/^[1-9]\d{3}$/.test(year))throw Error("发表年份应为四位数。");
    if(!c?.id)throw Error("请选择作者候选。");
    const sig=[c.provider||"",c.id,year].join("|"), prev=options.cursor;
    if(prev && (prev.signature!==sig||!prev.pages))throw Error("翻页游标与当前作者或年份不匹配，请重新检索。");
    const id=candidateOrcid(c), h=c.affiliationHint||c.clue||"";
    const oa=/^A\d+$/.test(oaId(c.id));
    const ep={...c,provider:"epmc",orcid:id,requestedOrcid:id,clue:h};
    const handlers=[
      ["OpenAlex",oa?o=>window.ScholarSource.load("author",{...c,requestedOrcid:id},o):null,"尚未关联唯一的 OpenAlex 作者 ID。"],
      ["Europe PMC",o=>window.PmcSource.load("author",ep,o),""],
      ["Crossref",o=>crossref(c,o),""],
      ["ORCID",publicOrcidEnabled()&&id?o=>orcidWorks(c,o):null,publicOrcidEnabled()?"尚未关联唯一的 ORCID。":"本站已关闭 ORCID 公共接口。"]
    ];
    const before=Object.fromEntries(list(prev?.coverage).map(s=>[s.source,s]));
    const pages={}, coverage=[], incoming=[];
    const jobs=handlers.map(async ([name,handler,reason])=>{
      if(!handler)return {source:name,scanned:0,hits:null,status:"unavailable",more:false,message:reason};
      if(prev && !(name in prev.pages))return before[name];
      const old=before[name], cursor=prev?.pages[name];
      try {
        const res=await handler({year,cursor,allTypes:true,includeNameMatches:true,scanned:old?.scanned||0});
        const scanned=(old?.scanned||0)+(res.scanned??res.records.length);
        const rawHits=res.sourceHits??res.total;
        const hits=Number.isFinite(rawHits)?rawHits:null;
        const more=Boolean(res.nextCursor)&&(hits===null||scanned<hits);
        const incomplete=!more && hits!==null && scanned<hits;
        const records=res.records.map(r=>fromSource(r,name));
        return {coverage:{source:name,scanned,hits,status:incomplete||more||res.partialFailure?"partial":"ok",more,message:incomplete?"来源仅返回部分结果，或需 API 密钥继续。":res.note||""},records,next:more?res.nextCursor:undefined};
      } catch(e) {
        return {coverage:{source:name,scanned:old?.scanned||0,hits:old?.hits??null,status:"error",more:false,message:message(e)},records:[]};
      }
    });
    for(const entry of await Promise.all(jobs)) {
      if(!entry)continue;
      const s=entry.coverage||entry;coverage.push(s);
      if(entry.next!==undefined)pages[s.source]=entry.next;
      if(entry.records)incoming.push(...entry.records);
    }
    const records=merge([],incoming), hasMore=Object.keys(pages).length>0;
    const hits=coverage.reduce((n,s)=>n+(s.hits||0),0);
    const note="本页去重后 "+records.length+" 篇。各来源原始命中可含重叠和同名结果。"+(coverage.some(s=>s.status==="error")?"部分来源连接失败，可重新检索。":"");
    return {records,total:records.length,sourceHits:hits,coverage,limited:hasMore||coverage.some(s=>s.status==="error"||s.status==="partial"),
      source:"多来源学术检索",note,nextCursor:hasMore?{signature:sig,pages,coverage}:null};
  }
  window.AtlasFederation=Object.freeze({search,load,merge,importScholar});
})();
