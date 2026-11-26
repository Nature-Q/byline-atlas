(() => {
  "use strict";
  const base = window.AtlasFederation;
  if (!base || base.extendedRecall) return;
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const names = value => clean(value).normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const list = value => Array.isArray(value) ? value : value ? [value] : [];
  const unique = values => [...new Set(values.filter(Boolean))];
  const dateYear = value => /^[12]\d{3}$/.test(String(value)) ? Number(value) : null;
  const doi = value => { const s=clean(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,"").toLowerCase(); return /^10\.\d{4,9}\/[^\s"<>]+$/.test(s) ? s : ""; };
  const orcid = value => {
    const id=clean(value).replace(/^https?:\/\/orcid\.org\//i,"").replace(/\/$/,"").toUpperCase();
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) return "";
    const raw=id.replaceAll("-",""),check=(12-[...raw.slice(0,15)].reduce((sum,c)=>(sum+Number(c))*2,0)%11)%11;
    return raw.at(-1)===(check===10?"X":String(check)) ? id : "";
  };
  function targetId(c) {
    const ids=unique([c.orcid,c.requestedOrcid,...list(c.observedOrcids)].map(orcid));
    return ids.length===1?ids[0]:"";
  }
  function variants(name) {
    const s=clean(name),t=names(s).split(" ");
    if(s.length>120 || (!/\p{Script=Han}{2,}/u.test(s) && (t.length<2 || t.filter(w=>w.length>1).length<2)) || /[^\p{L}\p{M} ,.'’\-]/u.test(s))return [];
    return unique([s,t.join(" "),[t.at(-1),...t.slice(0,-1)].join(" "),[...t.slice(1),t[0]].join(" ")]);
  }
  async function json(url,options) {
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),6500);
    try {
      const response=await fetch(url,{...options,signal:control.signal,credentials:"omit",referrerPolicy:"no-referrer"});
      if(!response.ok)throw Error("来源返回 HTTP "+response.status);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  const types={JournalArticle:"article",ConferencePaper:"conference-paper",Preprint:"preprint"};
  function dataRow(item,c,trustId,validNames,year) {
    const x=item.attributes||{}, key=doi(x.doi||item.id), title=clean(x.titles?.[0]?.title), kind=types[x.types?.resourceTypeGeneral], y=dateYear(x.publicationYear);
    if(!key || !title || !kind || year && y!==Number(year))return null;
    const people=list(x.creators).map(a=>{
      const name=clean([a.givenName,a.familyName].filter(Boolean).join(" ")||a.name);
      const ids=unique(list(a.nameIdentifiers).map(v=>orcid(v.nameIdentifier)));
      const affiliations=unique(list(a.affiliation).map(v=>clean(typeof v==="string"?v:v.name)));
      return {name,orcid:ids.length===1?ids[0]:"",ids,affiliations,collective:a.nameType==="Organizational"};
    });
    const idMatches=trustId?people.filter(a=>!a.collective && a.ids.includes(trustId)):[];
    const byName=people.filter(a=>!a.collective && validNames.has(names(a.name)));
    if(!idMatches.length && (!byName.length || trustId && byName.every(p=>p.ids.length&&!p.ids.includes(trustId))))return null;
    const supported=idMatches.length===1 && idMatches[0].ids.length===1;
    const mine=supported?idMatches[0]:byName.length===1&&!idMatches.length&&(!trustId||!byName[0].ids.length)?byName[0]:null;
    const byline=people.map((p,i)=>({name:p.name,orcid:p.orcid,affiliations:p.affiliations,institutions:[],position:i===0?"first":"",isTarget:p===mine}));
    const link="https://doi.org/"+key, evidence="https://commons.datacite.org/doi.org/"+key;
    return {id:"DATACITE/"+key,doi:key,title,year:y,workType:kind,journal:clean(x.container?.title)||"来源待核",url:link,
      source:"DataCite",sources:["DataCite"],evidenceUrl:evidence,identityEvidenceUrl:evidence,firstUnit:null,
      workOrcid:mine?.orcid||"",identityPending:!supported,identityStatus:supported?"supported":"review",identityBasis:supported?"work-orcid":"review",
      identityEvidence:supported?"DataCite 逐篇创建者行与所选 ORCID 一致。":"DataCite 创建者署名匹配，身份仍需交叉核实。",
      byline,authors:byline.map(a=>a.name),roles:mine && people[0]===mine?["first"]:[],roleUnknown:true,
      evidence:"DataCite 登记的创建者顺序。共同贡献与通讯身份须查原文。",rawAuthorName:mine?.name||"",
      provenance:[{source:"DataCite",id:key,url:evidence}],issn:/^\d{4}-\d{3}[\dX]$/i.test(x.container?.identifier||"") && /^issn$/i.test(x.container?.identifierType||"") ? [x.container.identifier] : []};
  }
  async function dataPage(c,year,token) {
    const id=targetId(c), ns=unique([c.name,...list(c.aliases).slice(0,5)].flatMap(variants));
    if(!id&&!ns.length)return {status:"unavailable",message:"需完整署名或 ORCID。",records:[],scanned:0,hits:null};
    const url=new URL("https://api.datacite.org/dois"),q=v=>'"'+v.replace(/[\\"]/g,"\\$&")+'"';
    const clauses=ns.map(n=>"creators.name:"+q(n));
    if(id)clauses.push("creators.nameIdentifiers.nameIdentifier:"+q("https://orcid.org/"+id), "creators.nameIdentifiers.nameIdentifier:"+q(id));
    const kind=Object.keys(types).map(t=>"types.resourceTypeGeneral:"+t).join(" OR ");
    const query="("+clauses.join(" OR ")+") AND ("+kind+")"+(year?" AND publicationYear:"+year:"");
    url.search=new URLSearchParams({query,affiliation:"true","page[size]":"100","page[cursor]":token||"1"});
    const data=await json(url);
    if(!Array.isArray(data.data) || !Number.isSafeInteger(data.meta?.total))throw Error("DataCite 返回格式不完整。");
    const valid=new Set(ns.map(names)),records=data.data.map(v=>dataRow(v,c,id,valid,year)).filter(Boolean);
    let next="";
    if(data.links?.next){
      const u=new URL(data.links.next,url);
      if(u.origin===url.origin&&u.pathname===url.pathname)next=u.searchParams.get("page[cursor]")||"";
      if(!next || next===token || next.length>3500)throw Error("DataCite 返回了无效的翻页标识。");
    }
    return {status:next?"partial":"ok",records,hits:data.meta.total,scanned:data.data.length,next,
      message:"按创建者姓名或 ORCID 补查期刊论文、会议论文和预印本。数据集和软件不计入此通道。"};
  }
  function anchors(records) {
    const safe=new Set(["work-orcid","orcid-record","work-affiliation"]);
    return unique(records.filter(p=>!p.excluded && !p.identityPending && safe.has(p.identityBasis) && !p.conflicts?.length).map(p=>doi(p.doi))).slice(0,5);
  }
  async function linkedAuthor(c,seeds) {
    if(seeds.length<2 || !variants(c.name).length)return null;
    // A simple GET is supported in browsers that cannot send cross-origin batch POSTs.
    const reads=await Promise.allSettled(seeds.map(d=>json("https://api.semanticscholar.org/graph/v1/paper/DOI:"+encodeURIComponent(d)+"?fields=authors,externalIds")));
    const data=reads.filter(r=>r.status==="fulfilled").map(r=>r.value);
    if(!data.length)throw reads[0].reason;
    const valid=new Set(variants(c.name).map(names)),groups=new Map();
    for(const p of data) {
      const key=doi(p?.externalIds?.DOI);
      if(!seeds.includes(key))continue;
      const matching=list(p.authors).filter(a=>valid.has(names(a.name)));
      if(matching.length!==1 || !/^\d{1,20}$/.test(matching[0].authorId||""))continue;
      const id=matching[0].authorId;
      if(!groups.has(id))groups.set(id,new Set());
      groups.get(id).add(key);
    }
    if(groups.size!==1)return null;
    const [id,dois]=[...groups][0];
    return {id,dois:[...dois]};
  }
  function status(source,old,r) {
    return {source,scanned:(old?.scanned||0)+(r.scanned||0),hits:r.hits??null,
      status:r.status,more:Boolean(r.next),message:r.message};
  }
  const failure=(source,e)=>({source,status:"error",scanned:0,hits:null,more:false,message:(e.name==="AbortError"?"来源超时":e.name==="TypeError"?"浏览器未能连接该来源":clean(e.message).slice(0,140))+"，本次未取得该来源的补充记录。"});
  async function load(mode,c,opts={}) {
    if(mode!=="author" || !c?.id)return base.load(mode,c,opts);
    const year=String(opts.year||""),signature=JSON.stringify([c.id,year]),old=opts.cursor?.recallVersion===5?opts.cursor:null;
    if(year && !/^[12]\d{3}$/.test(year))throw Error("发表年份应为四位数。");
    if(old && old.signature!==signature)throw Error("补查游标与作者或年份不符。");
    const results=await Promise.allSettled([
      !old||old.core?base.load(mode,c,{...opts,cursor:old?old.core:opts.cursor}):null,
      !old||old.data?dataPage(c,year,old?.data):null
    ]);
    const core=results[0].status==="fulfilled"?results[0].value:null;
    const dc=results[1].status==="fulfilled"?results[1].value:null;
    const coverage=core?[...(core.coverage||[])]:[...(old?.coverage||[])].filter(r=>r.source!=="DataCite"&&r.source!=="Semantic Scholar · DOI 关联");
    if(results[0].status==="rejected")coverage.push(failure("主检索",results[0].reason));
    const dataStatus=dc?status("DataCite",old?.dataStatus,dc):results[1].status==="rejected"?{...failure("DataCite",results[1].reason),scanned:old?.dataStatus?.scanned||0,hits:old?.dataStatus?.hits??null}:old?.dataStatus;
    if(dataStatus)coverage.push(dataStatus);
    let rows=base.merge(core?.records||[],dc?.records||[]),s2=old?.s2||null,s2Cursor=null,s2Status=old?.s2Status||null;
    const seeds=unique([...(old?.seeds||[]),...anchors(rows)]).slice(0,5),eligible=!/^S2\//i.test(c.id) && (!old?.tried || old.s2Cursor) && seeds.length>=2;
    let tried=Boolean(old?.tried);
    if(eligible){
      tried=true;
      try {
        if(!s2)s2=await linkedAuthor(c,seeds);
        if(s2){
          const candidate={...c,provider:"s2",id:"S2/"+s2.id};
          const more=await base.load(mode,candidate,{year,cursor:old?.s2Cursor||null});
          const hit=more.coverage?.find(r=>r.source==="Semantic Scholar");
          if(!hit)throw Error("Semantic Scholar 返回格式不完整。");
          const eligibleRows=(more.records||[]).filter(p=>p.byline?.filter(a=>a.isTarget).length===1);
          const valid=new Set(variants(c.name).map(names));
          const overlaps=eligibleRows.filter(p=>seeds.includes(doi(p.doi)) && valid.has(names(p.byline.find(a=>a.isTarget)?.name)));
          s2.dois=unique([...s2.dois,...overlaps.map(p=>doi(p.doi))]);
          if(s2.dois.length<2)throw Error("该作者档案中的署名与已核实成果重叠不足两篇");
          s2Cursor=more.nextCursor||null;
          rows=base.merge(rows,eligibleRows);
          s2Status={...hit,source:"Semantic Scholar · DOI 关联",message:s2.dois.length+" 篇已确认 DOI 的同名署名均指向作者 "+s2.id+"。新成果仍按逐篇证据核对。"};
        }else s2Status={source:"Semantic Scholar · DOI 关联",status:"unavailable",more:false,scanned:0,hits:null,message:"已确认 DOI 未能指向唯一且得到两篇独立论文支持的作者 ID。"};
      } catch(e) { s2Status={...failure("Semantic Scholar · DOI 关联",e),scanned:old?.s2Status?.scanned||0,hits:old?.s2Status?.hits??null}; }
    }
    if(s2Status) {
      if(s2Status.status==="ok" || s2Status.status==="partial"){
        const duplicate=coverage.findIndex(r=>r.source==="Semantic Scholar" && !r.scanned);
        if(duplicate!==-1)coverage.splice(duplicate,1);
      }
      coverage.push(s2Status);
    }
    if(!core && results[0].status==="rejected" && !rows.length && !dc)throw results[0].reason;
    const continuing=core?.nextCursor||dc?.next||s2Cursor;
    const nextCursor=continuing?{recallVersion:5,signature,core:core?.nextCursor||null,data:dc?.next||null,s2,s2Cursor,tried,seeds,dataStatus,s2Status,coverage}:null;
    return {records:rows,total:rows.length,sourceHits:coverage.reduce((n,r)=>n+(r.hits||0),0),coverage,
      source:"多来源学术检索",limited:Boolean(continuing)||coverage.some(r=>["partial","error"].includes(r.status)),nextCursor,
      note:"本页跨库去重后 "+rows.length+" 项。各来源命中可能重叠；预印本保留出版类型。"};
  }
  window.AtlasFederation=Object.freeze({...base,extendedRecall:true,load});
})();
