(function(){

"use strict";
const $ = s => document.querySelector(s);
const byId = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g, ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
const safeLink = u => {try{const v=new URL(u);return ["https:","http:"].includes(v.protocol)?v.href:"";}catch{return "";}};
const external = (u,label) => safeLink(u) ? `<a class="anchor" href="${esc(safeLink(u))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:"";
const paths={grid:"M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z",list:"M8 6h12 M8 12h12 M8 18h12 M4 6h.1 M4 12h.1 M4 18h.1",upload:"M12 15V3 M7.5 7.5 12 3l4.5 4.5 M4 14v5a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-5",book:"M3 4.8c3.7-.9 6.5-.4 9 1.4 2.5-1.8 5.3-2.3 9-1.4v14c-3.7-.9-6.5-.5-9 1.2-2.5-1.7-5.3-2.1-9-1.2z M12 6v14",user:"M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4.5 20c.7-4.2 3.8-6.2 7.5-6.2s6.8 2 7.5 6.2",institution:"M3 9l9-6 9 6z M4 20h16 M6 11v6 M10 11v6 M14 11v6 M18 11v6",search:"M15.8 15.8l4.6 4.6 M17 10.4a6.6 6.6 0 1 1-13.2 0A6.6 6.6 0 0 1 17 10.4z",arrow:"M4 12h15 M13 6l6 6-6 6",down:"M12 3v13 M7 11l5 5 5-5 M4 17v3h16v-3",calendar:"M4 6h16v14H4z M8 3v5 M16 3v5 M4 10h16",file:"M6 3h8l5 5v13H6z M14 3v5h5 M9 13h7 M9 17h5",pen:"M4 20l2-6L16.5 3.5a1.5 1.5 0 0 1 2 0l2 2a1.5 1.5 0 0 1 0 2L10 18z M14 6l4 4",mail:"M3 5h18v14H3z M3 6l9 7 9-7",layers:"M2.5 8 12 3.5 21.5 8 12 12.5z M2.5 12l9.5 4.5 9.5-4.5 M2.5 16l9.5 4.5 9.5-4.5",flag:"M5 21V4 M5 4c5-3 8 3 14 0v10c-5 3-9-3-14 0",check:"M4 11l5 5L20 5",help:"M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9 9a3 3 0 0 1 6 .2c0 2.2-3 2.6-3 4.9 M12 17h.01",menu:"M3 5h18 M3 12h18 M3 19h18",x:"M5 5l14 14 M19 5 5 19",filter:"M3 5h18 M6 12h12 M9 19h6",building:"M4 21V8h7v13 M11 3h8v18 M2 21h20 M14 7h2 M14 11h2 M14 15h2 M6.5 12h2 M6.5 16h2"};
const icon=name=>`<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="${paths[name]||paths.file}"/></svg>`;
const pageMap={search:["多源检索","search"],overview:["成果概览","grid"],papers:["论文清单","list"],profile:["学者画像","user"],metrics:["署名与合作","layers"],claims:["机构年度认领","institution"],ai:["AI 解读","book"],imports:["数据导入","upload"],classic:["单库检索","search"],method:["统计口径","book"]};
Object.assign(pageMap,{score:["固定指数与引用","layers"],chinese:["中文文献与核心目录","book"],report:["学者证据报告","file"],ai:["论文问答","book"]});
pageMap.insights=["科研能力分析","layers"];
pageMap.he=["何恺明 · 书目档案","user"];
pageMap.zhong=["钟志豪 · 学者画像","user"];
const roleNames={first:"首位作者",cofirst:"共同一作",corresponding:"通讯作者",cocorresponding:"共同通讯"};
const familyNames={flagship:"CNS 主刊",family:"系列期刊",other:"其他期刊",unknown:"目录未覆盖"};
const unitText=v=>v===true?"第一单位":v===false?"非第一单位":"单位待核";
const SKEY="byline-atlas-workspace-v1", RKEY="byline-atlas-ranks-v1";
function localRead(key,def){try{return JSON.parse(localStorage.getItem(key))??def;}catch{return def;}}
function storeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast("浏览器存储空间不足，本次操作仅在当前页面保留。");return false;}}
const sample=window.AtlasSample;
function zhongScope(mode="author") {
 const z=window.AtlasZhong, org=mode==="institution";
 const name=org?z.institution:z.name;
 const records=JSON.parse(JSON.stringify(z.records));
 return {kind:"case",mode,name,displayName:org?name:name+" · "+z.chineseName,records,total:records.length,source:z.source,
  affiliation:org?"钟志豪论文中的第一单位":z.affiliation,note:z.note,
  candidate:{name,id:org?"I79510175":"",aliases:[name],affiliationHint:z.institution}};
}
function sampleScope(mode="author"){const item=mode==="institution"?window.AtlasOrgSample:sample;return {mode,kind:"sample",name:item.name,affiliation:item.affiliation,note:item.note,total:item.records.length,source:item.source,candidate:{id:"",name:item.name,affiliation:item.affiliation,orcid:item.orcid||"",aliases:[item.name]},records:item.records.map(r=>({...r,roles:[...r.roles]}))};}
let scope=localRead(SKEY,null);
if(!scope||!Array.isArray(scope.records)||!["author","institution"].includes(scope.mode))scope=zhongScope("author");
else if(scope.kind==="case"){
 const refreshed=zhongScope(scope.mode),previous=new Map(scope.records.map(r=>[r.id,r]));
 scope={...refreshed,...scope,records:refreshed.records.map(r=>{
  const saved=previous.get(r.id)||{};
  const merged={...r,...saved};
  for(const k of ["byline","keywords","keywordEvidence","openAlexId","primaryTopicId","primaryTopicName","citationEvidence","citationsBySource","citationSource","citedByCount","topicAnnualBaseline"])if(Object.hasOwn(r,k))merged[k]=r[k];
  return merged;
 })};
}
if(scope.kind==="live"&&scope.mode==="author"&&scope.records.some(r=>!r.identityStatus)){for(const r of scope.records){if(r.identityStatus)continue;r.identityPending=true;r.identityStatus="review";r.identityEvidence="旧版记录未保留逐篇身份判断。可重新检索，或保留原文依据后手动计入。";}}
let ranks=localRead(RKEY,window.AtlasZhong.ranks);
if(!Array.isArray(ranks))ranks=window.AtlasZhong.ranks;
const JIF_KEY="byline-atlas-journal-impact-v1";
let impactRows=localRead(JIF_KEY,[]);
if(!Array.isArray(impactRows))impactRows=[];
let impactYear=window.AtlasJournals.year;
function impactInfo(record) {
 return window.AtlasJournalImports?.lookup(record,impactYear,impactRows) || window.AtlasJournals.lookup(record,impactYear);
}
function impactCell(record) {
 const info=impactInfo(record);
 return info ? esc(info.jif) : '<span class="muted">待补</span>';
}
function impactYearsControl() {
 const years=[...new Set([window.AtlasJournals.year,...impactRows.map(r=>r.year)])].sort((a,b)=>b-a);
 return '<label class="years">JIF 指标年 <select data-control="jif-year">'+opts(years.map(y=>[y,y]),impactYear)+'</select></label>';
}
const defaultFilters=()=>({text:"",role:"",family:"",minJif:"",system:"",edition:"",category:"",quartile:"",kind:"",status:"",catalog:""});
let filters=defaultFilters(),year="",searchMode=scope.mode,query="",affiliation="",busy=false,requestSeq=0,candidates=[],notice="",toastTimer,currentRecord=null,hasKey=false;
const page=()=>Object.hasOwn(pageMap,location.hash.slice(1))?location.hash.slice(1):"search";
function toast(message){const e=byId("toast");e.textContent=message;e.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove("show"),3200);}
function remember(){storeLocal(SKEY,scope);window.AtlasSearchV3?.syncScope?.(scope);}
const HISTKEY="byline-atlas-recent-v1";
const identityKey=v=>v.kind==="federated"&&v.archiveId?[v.kind,v.archiveId,v.liveYear||""].join("|"):[v.mode,v.kind,v.candidate?.id||v.name,v.candidate?.requestedOrcid||"",v.candidate?.affiliationHint||"",v.liveYear||""].join("|");
function recent(){const saved=localRead(HISTKEY,[]);return Array.isArray(saved)?saved.filter(v=>Array.isArray(v?.records)):[];}
function setScope(v,destination="overview"){
 if(v.kind==="federated" && v.mode==="author")window.AtlasAuthorID.assign(v);
 const key=identityKey(v),oldKey=identityKey(scope),past=recent(),snapshot=key===oldKey?scope:past.find(p=>identityKey(p)===key);
 if(snapshot && v.kind!=="import"){
  const edits=new Map();
  const recordKeys=r=>[r.id,r.doi&&"doi:"+r.doi.toLowerCase(),...(r.provenance||[]).filter(p=>p.id).map(p=>p.source+":"+p.id)].filter(Boolean);
  for(const r of snapshot.records.filter(r=>r.review||r.excluded||r.identityReview||r.verificationUrl)) for(const id of recordKeys(r)) edits.set(id,r);
  v.records=v.records.map(r=>{
   const old=recordKeys(r).map(k=>edits.get(k)).find(Boolean);
   if(!old || (r.review?.date && r.review.date >= (old.review?.date||"")))return r;
   const fields=["excluded"];
   if(old.review||old.verificationUrl)fields.push("review","roles","roleUnknown","firstUnit","verificationUrl","evidenceUrl","contribution");
   if(old.identityReview)fields.push("identityStatus","identityPending","identityBasis","identityReview","identityEvidence","identityEvidenceUrl");
   return {...r,...Object.fromEntries(fields.filter(k=>Object.hasOwn(old,k)).map(k=>[k,old[k]]))};
  });
 }
 if(key!==oldKey)storeLocal(HISTKEY,[scope,...past.filter(p=>![key,oldKey].includes(identityKey(p)))].slice(0,3));
 scope=v;year="";filters=defaultFilters();searchMode=v.mode;remember();if(page()===destination){render();}else{location.hash=destination;}
}
function years(){return [...new Set(scope.records.map(r=>r.year).filter(Boolean))].sort((a,b)=>b-a);}
const scoped=()=>scope.records.filter(r=>!r.excluded&&!r.identityPending&&(!year||String(r.year)===String(year)));
const isLead=r=>r.roles?.some(k=>k==="first"||k==="cofirst");
const isCorr=r=>r.roles?.some(k=>k==="corresponding"||k==="cocorresponding");
const has=(r,k)=>r.roles?.includes(k);
const count=(rows,fn)=>rows.filter(fn).length;
const selected=(a,b)=>String(a)===String(b)?" selected":"";
const option=(value,label,v)=>`<option value="${esc(value)}"${selected(value,v)}>${esc(label)}</option>`;
const opts=(items,v)=>items.map(([key,label])=>option(key,label,v)).join("");
function rankRows(r){
 const canonical=window.AtlasJournals.lookup(r);
 const ids=new Set([...(r.issn||[]),...(canonical?.issn||[])].map(window.AtlasImport.normalizeIssn));
 return ranks.filter(x=>ids.has(x.issn));
}
function rankSelection(r){return rankRows(r).filter(x=>(!filters.system||x.system===filters.system)&&(!filters.edition||String(x.year)===filters.edition)&&(!filters.category||x.category===filters.category)&&(!filters.quartile||String(x.quartile)===filters.quartile));}
function rowKey(r){return scope.records.indexOf(r);}
function filtered(){
 return scope.records.filter(r=>{
  if((filters.status==="excluded")!==Boolean(r.excluded)||year&&String(r.year)!==year)return false;
 if(filters.status==="identity"?!r.identityPending:(r.identityPending&&filters.status!=="excluded"))return false;
  if(filters.status==="pending"&&(scope.mode==="institution"?r.firstUnit!=null:!r.roleUnknown))return false;
  if(filters.status==="manual"&&!r.review)return false;
  if(filters.kind&&r.workType!==filters.kind)return false;
  if(filters.catalog&&!window.AtlasCN.labels(r).some(c=>c.label===filters.catalog))return false;
  if(filters.text&&!`${r.title} ${r.journal} ${r.doi||""}`.toLowerCase().includes(filters.text.trim().toLowerCase()))return false;
  if(filters.family&&window.AtlasImport.classifyJournal(r)!==filters.family)return false;
  if((filters.system||filters.edition||filters.quartile||filters.category)&&!rankSelection(r).length)return false;
  if(filters.minJif!==""){
   const info=impactInfo(r);
   if(!info||info.jif<Number(filters.minJif))return false;
  }
  if(!filters.role)return true;
  if(filters.role==="lead")return isLead(r);
  if(filters.role==="union")return isLead(r)||isCorr(r);
  if(filters.role==="unit")return r.firstUnit===true;
  if(filters.role==="unit-pending")return r.firstUnit==null;
  if(filters.role==="nonunit")return r.firstUnit===false;
  if(filters.role==="no-role")return !isLead(r)&&!isCorr(r);
  return has(r,filters.role);
 }).sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
}
function badge(s,w=""){return `<span class="tag ${w}">${esc(s)}</span>`;}
function tags(r){
 if(scope.mode==="institution")return badge(unitText(r.firstUnit),r.firstUnit==null?"dim":"");
 if(r.identityPending)return badge("身份待核","warm");const rs=r.roles||[],labels=[];
 if(rs.includes("first"))labels.push(badge("首位"));
 if(rs.includes("cofirst"))labels.push(badge("共一"));
 if(rs.includes("corresponding")||rs.includes("cocorresponding"))labels.push(badge(rs.includes("cocorresponding")?"共同通讯":"通讯","warm"));
 if(!labels.length)labels.push(badge(r.roleUnknown?"署名待核":"其他署名","dim"));
 return labels.join("");
}
function drawNav(){
 const navItem=(n)=>`<button class="nav-item${page()===n?" active":""}" data-page="${n}" ${page()===n?'aria-current="page"':""}>${icon(pageMap[n][1])}<span>${pageMap[n][0]}</span></button>`;
 byId("nav").innerHTML=["search","chinese","overview","papers","insights","score","profile","ai","report","claims"].map(navItem).join("");
 byId("support-nav").innerHTML=["metrics","imports","classic","method"].map(navItem).join("");
 byId("page-name").textContent=pageMap[page()][0];
 byId("guide").innerHTML=icon("help")+"使用指南";byId("menu-btn").innerHTML=icon("menu");byId("dia-close").innerHTML=icon("x");
}
function nav(n){byId("sidebar").classList.remove("open");byId("shade").classList.remove("open");if(["zhong","he"].includes(page()) && ["papers","insights","score","ai","report","profile","metrics","overview","chinese"].includes(n)){setScope(page()==="he"?window.AtlasLibraryCaseV5.scope():zhongScope("author"),n);return;}if(page()===n)render();else location.hash=n;}
function dia(title,html){byId("dia-title").textContent=title;byId("dia-content").innerHTML=html;if(!byId("dialog").open)byId("dialog").showModal();}
const closeDia=()=>byId("dialog").close();
const yearsSelect=()=>`<label class="years">${icon("calendar")}<select aria-label="发表年份" data-control="year">${option("","全部年份",year)}${years().map(y=>option(y,`${y} 年`,year)).join("")}</select></label>`;
const exportBtn=()=>`<button class="outline" data-act="export">${icon("down")}导出清单</button>`;
function stats(rows){
 const n=rows.length;
 return scope.mode==="institution"?[
 ["收录论文",n,"本次统计范围","file","#e6eee7","#376c50"],["第一单位",count(rows,r=>r.firstUnit===true),"按当前机构口径","institution","#e1eee7","#34664e"],["非第一单位",count(rows,r=>r.firstUnit===false),"参与署名的其他论文","layers","#faecdf","#99623b"],["单位待核",count(rows,r=>r.firstUnit==null),"缺少明确地址顺序","flag","#eeebf4","#736489"]
 ]:[
 ["收录论文",n,"当前范围内的独立论文","file","#e7eee6","#326046"],["第一作者",count(rows,isLead),`首位 ${count(rows,r=>has(r,"first"))} · 共一 ${count(rows,r=>has(r,"cofirst"))}`,"pen","#e0eee7","#30654e"],[["live","federated"].includes(scope.kind)?"已标记通讯作者":"通讯作者",count(rows,isCorr),`其中共同通讯 ${count(rows,r=>has(r,"cocorresponding"))} 篇${rows.some(r=>!isCorr(r)&&r.roleUnknown)?" · 另有署名待核记录":""}`,"mail","#f8eadc","#a2683d"],["一作或通讯",count(rows,r=>isLead(r)||isCorr(r)),"重叠署名按篇去重","layers","#efebf4","#716282"]
 ];
}
function hero(){
 return `<section class="hero"><canvas id="hero-art" aria-hidden="true"></canvas><div class="eyebrow" lang="en">BYLINE ATLAS</div><h1>科研贡献检索</h1><p>从作者署名到第一单位，逐篇追溯科研成果。</p><div class="mode-tabs" aria-label="检索类型">${[["author","user","查学者"],["institution","institution","查机构"]].map(([k,i,t])=>`<button data-mode="${k}" aria-pressed="${k===searchMode}" class="${k===searchMode?"selected":""}">${icon(i)}${t}</button>`).join("")}<button class="example-jump" type="button" data-act="cardiff">钟志豪查询结果 ↗</button><button class="example-jump" type="button" data-act="quick-example">${searchMode==="institution"?"查看机构示例":"查看学者示例"} ↗</button></div>${searchMode==="author"?`<label style="display:block;color:#e5eee6;font-size:12px;margin:2px 0 6px">数据源 <select id="provider" aria-label="检索数据源" style="border:1px solid #809a8b;border-radius:4px;background:#244c3c;color:white">${opts([["openalex","OpenAlex · 全学科"],["epmc","Europe PMC · 生物医学"]],searchProvider)}</select></label>`:""}<form class="search-form" id="search-form"><label class="inputwrap">${icon("search")}<input aria-label="${searchMode==="author"?"学者姓名或标识符":"机构名称或标识符"}" id="query" value="${esc(query)}" required placeholder="${searchMode==="author"?"输入学者姓名、ORCID 或学术主页":"输入机构英文名称或 OpenAlex ID"}"></label>${searchMode==="author"?`<label class="inputwrap unit">${icon("building")}<input id="affiliation" aria-label="学者所属机构，可选" placeholder="所属机构（可选）" value="${esc(affiliation)}"></label>`:""}<button class="searchbtn"${busy?" disabled":""}>${busy?"检索中…":"检索"}${icon("arrow")}</button></form><div class="status" role="status" id="search-status">${esc(notice)}</div></section>`;
}
function engrave(){
 const canvas=byId("hero-art");if(!canvas)return;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
 const d=Math.min(window.devicePixelRatio||1,2);canvas.width=w*d;canvas.height=h*d;const ctx=canvas.getContext("2d");if(!ctx)return;ctx.scale(d,d);
 // Offset contour lines form a topographic print at the edge of the search panel.
 const a=w*.69,b=h*.39,scale=Math.min(w/365,h/176);
 ctx.save();ctx.translate(a,b);ctx.rotate(-.32);ctx.scale(scale,scale);
 for(let j=0;j<57;j++){
  const t=j/56;ctx.beginPath();
  for(let k=0;k<=230;k++){
   const p=2*Math.PI*k/230, cs=Math.cos(p),sn=Math.sin(p);
   const lobes=1+.155*Math.cos(3*p+.7+t*1.5)+.095*Math.sin(2*p+1.3)+.05*Math.sin(5*p-.4);
   const sx=(19+145*t)*cs*lobes+30*Math.sin(t*3.3)-13*t;
   const sy=(7+80*t)*sn*lobes+7*Math.sin(p*2.1)*t+8*t;
   if(k===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);
  }
  ctx.closePath();ctx.strokeStyle=`rgba(197,218,170,${.23+.39*Math.sin(t*Math.PI)})`;ctx.lineWidth=.69;ctx.stroke();
 }
 ctx.restore();
}
function identity(){const initials=scope.name.split(/\s+/).map(s=>s[0]).slice(0,2).join("").toUpperCase();
 return `<div class="report-head"><div class="identity"><span class="avatar">${scope.mode==="institution"?icon("institution"):esc(initials)}</span><div class="namewrap"><h2>${esc(scope.displayName||scope.name)}</h2><span class="badge">${scope.kind==="case"?"Cardiff 目录样本":scope.kind==="sample"?"精选示例":scope.kind==="import"?"导入档案":scope.mode==="institution"?"机构档案":"学者档案"}</span><div class="spec">${esc(scope.kind==="case"?(scope.mode==="institution"?"仅含钟志豪在 Cardiff 署名的 4 篇期刊论文":"Cardiff 博士 · 2026 年 8 月会议列名单位为哈工大（深圳）"):scope.affiliation||scope.source||"")}${scope.kind==="sample"?" · 选录 "+scope.records.length+" 篇":""}</div></div></div><div class="top-actions">${yearsSelect()}${exportBtn()}</div></div>`;
}
function metricsPage(){
 const rows=scoped();
 return identity()+window.AtlasContributions.render(rows,scope);
}
function table(rows){
 if(!rows.length)return '<div class="empty">当前条件下没有论文。可调整筛选或导入书目。</div>';
 return `<div class="table-scroll"><table class="pub-table"><thead><tr><th>论文 / 期刊</th><th>年份</th><th>${scope.mode==="institution"?"机构归属":"作者署名"}</th><th>JIF · ${esc(impactYear)}</th><th>期刊类别</th>${ranks.length?`<th>期刊分区</th>`:""}<th>证据</th></tr></thead><tbody>${rows.map(r=>{
  const family=window.AtlasImport.classifyJournal(r);
  return `<tr><td><button class="titlebtn" data-record="${rowKey(r)}">${esc(r.short||r.title)}</button><div class="journal">${esc(r.journal||"期刊待核")}</div>${catalogText(r)?`<small>${esc(catalogText(r))}</small>`:""}</td><td class="yearcell">${esc(r.year||"—")}</td><td><div class="tags">${tags(r)}</div></td><td class="impact-cell">${impactCell(r)}</td><td>${badge(familyNames[family],family==="unknown"||family==="other"?"dim":"")}</td>${ranks.length?`<td class="muted">${esc(rankSelection(r).map(x=>x.system+" "+x.year+" · "+x.category+" "+(x.system==="JCR"?"Q"+x.quartile:x.quartile+"区")).join(" / ")||(r.issn?.length?"未匹配":"待补 ISSN"))}</td>`:""}<td><button class="linkbtn" data-record="${rowKey(r)}">核查</button></td></tr>`;
 }).join("")}</tbody></table></div>`;
}
function paperList(rows) {
 if (!rows.length) return '<p class="no-recent">此范围未收录论文。</p>';
 return rows.slice(0,4).map(record=>{
  const info=impactInfo(record);
  const role=scope.mode==="institution" ? unitText(record.firstUnit) :
   (record.roles||[]).map(key=>roleNames[key]).filter(Boolean).join("、") || "署名待核";
  return `<details class="paper-summary"><summary><strong>${esc(record.short||record.title)}</strong><span>${esc(record.year)} · ${esc(role)}</span><span class="paper-jif">JIF ${info?esc(info.jif):"待补"}</span></summary><div class="paper-more"><p>${esc(record.title)}</p><p>${esc(record.journal)} · ${impactYear} JIF ${impactCell(record)} ${external(info?.jifSource,"指标来源")}</p><p>${esc(record.evidence||"署名待核")}</p><button class="linkbtn" data-record="${rowKey(record)}">查看完整证据</button>　${external(record.url,"原文")}</div></details>`;
 }).join("");
}
function overview() {
 const rows=scoped();
 const latest=[...rows].sort((a,b)=>(b.year||0)-(a.year||0));
 const metricCards=stats(rows).map(([label,value,detail])=>
  `<div class="metric"><div class="metric-label">${esc(label)}</div><div class="metric-value">${value}<small>篇</small></div><div class="metric-foot">${esc(detail)}</div></div>`
 ).join("");
 const modeControls=scope.kind==="case" ? `<div class="result-switch"><button data-act="case-author" aria-pressed="${scope.mode==="author"}">作者署名</button><button data-act="case-org" aria-pressed="${scope.mode==="institution"}">机构归属</button></div>` : "";
 const pending=scope.records.filter(r=>r.identityPending&&!r.excluded).length;
 return `<section class="result-summary">${modeControls}${identity()}
  <div class="metrics">${metricCards}</div>
  <div class="paper-list">${paperList(latest)}</div>
  <div class="result-footer"><span>期刊影响因子 · ${impactYear} 指标年</span><button class="linkbtn" data-page="papers">全部论文与分区 ${icon("arrow")}</button></div></section>
  <p class="scope-line">${esc(scope.note||"")} ${scope.kind==="case"?external(window.AtlasZhong.sourceUrl,"Cardiff 作者目录")+"　"+external(window.AtlasZhong.institutionSource,"深圳会议署名")+(scope.mode==="author"?'　<a href="./zhong.html">查看精简结果卡片</a>':""):""}</p>
  ${pending?`<div class="notice">${pending} 条成果身份待核。 <button class="linkbtn" data-act="identity-list">查看待核论文</button></div>`:""}
  <div class="buttonset workspace-links">${scope.mode==="author"?'<a href="#score">一作及通讯引用 · 固定指数</a><a href="#profile">学者画像</a><a href="#report">证据报告</a>':'<a href="#claims">进入机构年度认领</a>'}<a href="#papers">逐篇核对来源与署名</a></div>
  ${window.AtlasContributions.render(rows,scope)}
  <div class="analysis"><section class="panel chart-panel"><div class="panel-head"><h2>年度发表趋势</h2><span class="tiny">按发表年</span></div>${window.AtlasCharts.trend(rows,scope.mode)}</section><section class="panel chart-panel"><div class="panel-head"><h2>${scope.mode==="institution"?"第一单位分布":"署名构成"}</h2></div>${window.AtlasCharts.composition(rows,scope.mode)}</section></div>`;
}

const typeNames={article:"研究论文 / Article",review:"综述 / Review",letter:"来信 / Letter",unknown:"类型待核","conference-paper":"会议论文",book:"图书",proceedings:"会议录",inproceedings:"会议论文"};
const typeName=k=>typeNames[k]||k||"类型待核";
function filterSelect(key,values,placeholder){
 return `<select aria-label="${esc(placeholder)}" data-filter="${key}">${option("",placeholder,filters[key])}${opts(values,filters[key])}</select>`;
}
const unique=items=>[...new Set(items)];
function catalogText(r){return window.AtlasCN.labels(r).map(c=>[c.label,c.edition].filter(Boolean).join(" ")).join(" · ");}
function citeText(r){return (r.citationEvidence||[]).filter(c=>Number.isSafeInteger(c.count)&&c.count>=0).map(c=>[c.source,String(c.count),c.observedAt].filter(Boolean).join(" ")).join(" | ");}
function openChineseRows(rows){
 if(scope.mode!=="author" || !rows?.length)return;
 if(scope.kind==="case" || scope.kind==="sample"){
  const candidate={...scope.candidate,name:scope.name,id:scope.candidate?.id||"curated/"+scope.name};
  scope={...scope,kind:"federated",candidate,providers:[],scholarImports:[],source:scope.source||"核查档案"};
  window.AtlasAuthorID.assign(scope);
 }
 scope.records=window.AtlasFederation.merge(scope.records,rows);
 scope.total=scope.records.length;
 scope.note="当前档案合并 "+scope.total+" 条记录，其中 "+scope.records.filter(r=>!r.excluded&&r.identityPending).length+" 条身份待核。";
 remember();
}
function authorOnly(){
 return '<section class="panel boxpad"><h1>请选择学者档案</h1><p>当前打开的是机构。可在多源检索中选择学者，或直接打开钟志豪的核查样本。</p><div class="buttonset"><a href="#search">检索学者</a><a href="#zhong">钟志豪的学者画像</a></div></section>';
}
function profileScreen(v,samplePage=false){
 const buttons=v.kind==="public-bibliography"?'<button class="outline" data-he-open="papers">浏览完整论文清单</button><button class="outline" data-he-open="report">导出当前档案报告</button>':samplePage?'<button class="outline" data-case-page="report">导出钟志豪的报告</button><button class="outline" data-case-page="ai">就这些论文提问</button><a href="./zhong.html">逐篇署名与期刊影响因子</a>':'<a href="#report">导出学者证据报告</a><a href="#ai">就这些论文提问</a><a href="#chinese">补充中文文献</a>';
 return '<div class="buttonset workspace-links">'+buttons+'<button class="outline" data-research-search>继续检索此人</button></div>'+window.AtlasInsightsV5.render(v.records,v)+window.AtlasScorecardV4.render(v.records,v)+(samplePage||v.kind==="case"?window.AtlasZhongBibliographyV4.render():"")+window.AtlasProfileV3.render(v.records,v);
}
function papers(){const rows=filtered();
 const roleOptions=scope.mode==="institution"?[["unit","第一单位"],["nonunit","非第一单位"],["unit-pending","单位待核"]]:[["lead","一作（含共一）"],...Object.entries(roleNames),["union","一作或通讯"],["no-role","其余或待核"]];
 const sysRanks=ranks.filter(x=>!filters.system||x.system===filters.system);
 const edRanks=sysRanks.filter(x=>!filters.edition||String(x.year)===filters.edition);
 return `<div class="page-head"><div><h1>论文清单</h1><p>${esc(scope.name)} · ${esc(scope.note||scope.source)}</p></div><div class="top-actions">${yearsSelect()}${impactYearsControl()}${exportBtn()}</div></div><section class="panel boxpad"><div class="filters"><input id="paper-search" placeholder="搜索论文题名、期刊或 DOI" aria-label="搜索论文" value="${esc(filters.text)}">${filterSelect("role",roleOptions,"全部署名")}${filterSelect("family",Object.entries(familyNames),"全部期刊类别")}${filterSelect("catalog",unique(scope.records.flatMap(r=>window.AtlasCN.labels(r).map(c=>c.label))).sort().map(k=>[k,k]),"核心 / 国际索引")}${filterSelect("kind",unique(scope.records.map(r=>r.workType).filter(Boolean)).map(k=>[k,typeName(k)]),"全部文献类型")}${filterSelect("status",[["identity","身份待核（未计入）"],["pending","署名或单位待核"],["manual","已有人工核查"],["excluded","已排除的论文"]],"全部状态")}</div>
 <div class="filters">${icon("filter")}<strong style="font-size:12px">期刊分区</strong>${filterSelect("system",[["CAS","中科院历史版"],["JCR","JCR"]],"选择分区体系")}${filters.system?`${filterSelect("edition",unique(sysRanks.map(x=>x.year)).sort((a,b)=>b-a).map(y=>[y,`${y} 版`]),"全部版本")}${filterSelect("category",unique(edRanks.map(x=>x.category)).sort().map(c=>[c,c]),"全部学科")}${filterSelect("quartile",[1,2,3,4].map(n=>[n,filters.system==="JCR"?"Q"+n:n+"区"]),"全部区位")}`:""}${!ranks.length?'<button class="linkbtn" data-page="imports">导入分区表 ↗</button>':""}<label class="jif-filter">最低 JIF <input type="number" min="0" step="any" data-filter="minJif" value="${esc(filters.minJif)}" placeholder="不限"></label><button class="plain" data-act="clear-filters">重置</button></div>
 <div class="section-head"><strong class="active-count" id="paper-count">显示 ${rows.length} 篇</strong></div><div id="papers-table">${table(rows)}</div></section><details class="filtered-contributions"><summary>查看筛选范围内的贡献与合作指标</summary><div id="filtered-contributions">${window.AtlasContributions.render(rows.filter(r=>!r.identityPending&&!r.excluded),scope)}</div></details>${!ranks.length?'<p class="scope-line">当前没有已导入的分区数据。导入有权使用的版本后，可按 ISSN、学科和区位查询。</p>':""}${continuation()}`;
}
function continuation(){
 if(scope.kind==="federated" && scope.limited)return '<div class="notice">当前档案仅覆盖已读的来源和页数。<a href="#search">查看各库状态并继续检索</a></div>';
 if(scope.kind!=="live"||!scope.limited)return "";
 return `<div class="notice" style="margin-top:12px"><p>已载入 ${scope.records.length} 条候选，来源报告命中 ${scope.sourceHits??scope.total} 条。所有角色与分区计数仅覆盖已载入论文。</p>${scope.nextCursor?`<button class="outline" data-act="next-page">载入下一页</button>`:`<button class="linkbtn" data-page="imports">设置 OpenAlex Key</button> 后重新检索，可继续翻页。`}</div>`;
}
function importsView(){
 return `<div class="page-head"><div><h1>数据导入</h1><p>导入个人书目或有权使用的分区表，补充当前工作区。</p></div></div><div class="twopanels">
 <section class="panel boxpad stack"><div><span class="labelico">${icon("book")}<b>Google 学术书目</b></span><p>在个人学术主页勾选论文，点击“导出”，选择 BibTeX 或 CSV。署名和通讯关系可逐篇补证。</p></div><label>档案名称<input style="width:100%;margin-top:5px" class="field" id="import-name" placeholder="例如：Zhihao Zhong"></label><label>书目文件<input class="file-input" id="bib-file" type="file" accept=".csv,.bib,.bibtex,.txt"></label><div><button class="solid" data-act="bib-import">${icon("upload")}导入书目</button></div><div id="bib-note" class="notice" role="status"></div></section>
 <section class="panel boxpad stack"><div><span class="labelico">${icon("layers")}<b>期刊分区表</b></span><p>支持 JCR 和中科院历史版。CSV 每行对应一个 ISSN、版本年和学科，以本次文件更新本地分区表。可带 scope（大类或小类）、top（是或否）、source（出处链接）。</p></div><div class="buttonset"><button class="outline" data-act="template">${icon("down")}下载 CSV 模板</button><span class="muted">已载入 ${ranks.length} 条</span></div><label>分区文件<input class="file-input" type="file" id="rank-file" accept=".csv,.tsv,.txt"></label><div><button class="solid" data-act="rank-import">${icon("upload")}更新分区表</button></div><div class="notice" id="rank-note" role="status"></div></section></div>
 <section class="panel boxpad content-panel"><h2>年度影响因子</h2><p>按 ISSN 和 JIF 指标年匹配。CSV 包含 issn、year、jif、source 四列，source 填写来源的 HTTPS 链接。导入多年份后可在论文清单切换指标年。</p><div class="buttonset"><button class="outline" data-act="impact-template">下载模板</button><span class="muted">自定义 ${impactRows.length} 条</span></div><label>影响因子文件<input class="file-input" id="impact-file" type="file" accept=".csv,.txt"></label><button class="solid" data-act="impact-import">合并影响因子数据</button><div id="impact-note" class="notice" role="status"></div></section>
 <section class="panel boxpad content-panel" style="margin-top:16px"><h2>OpenAlex 查询额度</h2><p>若 OpenAlex 要求密钥或返回额度限制，可在此应用个人 API Key 后重新查询。密钥仅保存在当前页面内存中，随请求发送到 OpenAlex。</p><div class="buttonset"><input id="api-key" class="field" type="password" autocomplete="off" aria-label="个人 OpenAlex API Key" placeholder="OpenAlex API Key"><button class="outline" data-act="apply-key">应用密钥</button>${hasKey?'<button class="plain" data-act="clear-key">移除密钥</button>':""}${external("https://openalex.org/settings/api","获取密钥")}</div></section>
 <section class="panel boxpad"><h2>精选档案</h2><p>眼科 AI 学者与大学的真实论文选录，可离线核查署名和第一单位。</p><div class="buttonset"><button class="outline" data-act="sample">学者示例 ${icon("arrow")}</button><button class="outline" data-act="org-sample">机构示例 ${icon("arrow")}</button></div></section>${recent().length?`<section class="panel boxpad" style="margin-top:15px"><h2>最近档案</h2>${recent().map((p,i)=>`<button class="candidate" data-recent="${i}"><strong>${esc(p.name)}</strong><small>${p.records.length} 篇 · ${esc(p.source)}</small></button>`).join("")}</section>`:""}`;
}
function method(){
 const items=[
 ["多源检索","按库显示已读数量、失败和剩余页。公开 ORCID 标识、论文署名、单位和原文用于核查身份。选定 Scholar 档案后可补入导出书目，或通过配置的服务读取主页。"],
 ["单位轨迹与评价","以该作者逐篇关联的单位和发表年份重建署名轨迹。独立性等指标展示代理变量、证据覆盖、观察窗与权重。报告可随证据更新。"],
 ["机构年度认领","按发表年份核对医院的单位署名，将署名人与本地名册匹配并人工确认。结果和认领明细可导出。"],
 ["固定指数与分来源引用","固定指数 v1.0 对同一观察时点使用同一权重和证据要求。逐篇引用按来源和取数日期列示；一作与通讯重叠的论文在并集中只计算一次。导师关系、个人权重和付费状态不参与固定公式。"],
 ["中文成果认定","中文论文保留原始姓名顺序。共同一作、通讯作者须有原文标注。CSSCI 来源与扩展、北大中文核心和 SSCI 独立显示，匹配目录版次或覆盖时间。"],
 ["科研贡献指标","个人指标分别呈现承担通讯责任、研究构思及合作关系的可观察证据。每项标出分母与可用证据，历史记录缺失时显示待补。同领域和相同观察窗下的结果更易解释。"],
 ["期刊影响因子","JIF 为期刊的年度指标。论文清单统一采用选定的 JIF 指标年，每篇可查看期刊数据来源。重复发表在同一本期刊不会增加该期刊的 JIF。"],
 ["同名作者归属","档案层面的 ORCID 可能由多个同名作者的作品汇集而成。输入 ORCID 时优先核对署名行 raw_orcid；输入单位时核对该作者本人的逐篇地址。身份待核的行保存在单独的清单中，补充依据后可计入。"],
 ["第一作者与共同第一","“首位”只统计作者列表第 1 位。“共同一作”需要可以关联到作者的同等贡献或共同第一声明，并确认其属于第一作者组。一作总数是两个集合的并集。"],
 ["通讯作者与共同通讯","通讯身份来自明确的通讯标记、出版商脚注或人工原文记录。同一论文列出多位通讯作者时可以同时属于“通讯”和“共通”。末位署名本身不能确定通讯身份。"],
 ["一作或通讯","对每篇论文检查第一作者或通讯角色，任一满足即计 1 篇。一个人同时占有多种角色时仍计 1 篇。证据不足归为待核，当前计数表示可识别的成果。"],
 ["机构的第一单位","默认口径为首位作者的首个署名单位。元数据阶段仅接受单一作者地址、唯一机构映射。开放原文核验时再比对第一单位标注与作者关联。多单位或医院归属有歧义时留待人工确认。按机构标识精确匹配，附属医院需分别查询。"],
 ["分区版本与学科","中科院文献情报中心自 2026 年起停止更新期刊分区表。JCR 与历史中科院分区独立匹配，上传的 ISSN、年份和分类原样保留。多学科筛选表示满足所选条件的任一行，未指定版本时可匹配多个版本。"],
 ["主刊和系列期刊","本工具将 Cell、Nature、Science 定义为 CNS 主刊。系列期刊使用显式刊名与 ISSN 目录，出版集团名或刊名中的单词都不能单独决定类别。此分类仅用于筛选。"],
 ["医学文献","Europe PMC 提供生命科学和医学文献记录。可按年份缩小范围，并结合逐篇署名、ORCID 和作者本人的地址判断归属。"],
 ["查询和样本边界","来源覆盖、年份、已读页数和身份核查均会影响计数。示例、文件导入与在线检索各自标记来源和范围。"],
 ["保存与核查","多源检索会向列明的数据库发送学术查询。开放全文核查会向 Europe PMC 发送文献标识。书目、分区表和人工备注仅在此浏览器保存，导出可保留副本。原文、数据库标记和人工核查在详情中分别说明。"]
 ];
 return `<div class="page-head"><div><h1>统计口径</h1><p>读懂每个数字的来源、范围与署名证据。</p></div></div><div class="method-grid">${items.map(([h,t])=>`<section class="panel boxpad"><h2>${esc(h)}</h2><p>${esc(t)}</p></section>`).join("")}</div><section class="panel boxpad" style="margin-top:15px"><details><summary style="cursor:pointer;font-weight:600">查看期刊分类目录（${window.AtlasImport.journalCatalogue.length} 本）</summary>${["flagship","family","other"].map(t=>`<p><b>${familyNames[t]}</b>　${esc(window.AtlasImport.journalCatalogue.filter(j=>j.group===t).map(j=>j.title).join(" · "))}</p>`).join("")}</details><p class="source-links">${external("https://help.openalex.org/data/authorships/","OpenAlex 署名字段")}　${external("https://europepmc.org/RestfulWebService","Europe PMC")}　${external("https://nssc.ac.cn/library/dtxx/202604/t20260409_8183275.html","分区表停更公告")}　${external("https://developer.clarivate.com/apis/wos-journal","JCR 数据说明")}</p></section>`;
}
function render(){
 if(typeof disposeView==="function")disposeView();
 disposeView=null;
 drawNav();
 const p=page(),main=byId("main");
 const screens={he:()=>profileScreen(window.AtlasLibraryCaseV5.scope()),insights:()=>scope.mode==="author"?'<header class="page-head"><div><h1>科研能力分析</h1><p>'+esc(scope.displayName||scope.name)+'</p></div></header>'+window.AtlasInsightsV5.render(scope.records,scope):authorOnly(),zhong:()=>profileScreen(zhongScope("author"),true),score:()=>scope.mode==="author"?'<header class="page-head"><div><h1>固定指数与引用</h1><p>'+esc(scope.displayName||scope.name)+'</p></div></header>'+window.AtlasScorecardV4.render(scope.records,scope):authorOnly(),chinese:()=>scope.mode==="author"?window.AtlasCN.render(scope):authorOnly(),report:()=>window.AtlasReportV4.render(scope),overview:()=>overview()+continuation(),search:()=>window.AtlasSearchV3.render(),classic:hero,papers,metrics:metricsPage,
  profile:()=>scope.mode==="author"?profileScreen(scope):'<section class="panel boxpad"><h1>当前打开的是机构档案</h1><p>查看学者画像，请先选定一位学者。机构成果可按年度核对署名单位与认领人。</p><div class="buttonset"><a href="#search">查找学者</a><a href="#claims">进入机构年度认领</a></div></section>',claims:()=>window.AtlasClaimsV3.render(),ai:()=>window.AtlasAIV3.render(),imports:importsView,method};
 main.innerHTML=screens[p]();
 if(p==="zhong" || p==="he" || (p==="profile" && scope.mode==="author")){
  const subject=p==="zhong"?zhongScope("author"):p==="he"?window.AtlasLibraryCaseV5.scope():scope, archive=subject.archiveId;
  main.insertAdjacentHTML("afterbegin",`<header class="page-head"><div><h1>${esc(subject.displayName||subject.name)}</h1><p>${esc(subject.kind==="case"?"Cardiff 目录核查样本":subject.affiliation||"学者画像")}${archive?" · 本地档案编号 "+esc(archive):""}${subject.archiveIdConflict?" · 档案标识存在冲突，需人工核查":""}</p></div></header>`);
 }
 if(p==="he"||(p==="profile"&&scope.kind==="public-bibliography")){
  const example=window.AtlasLibraryCaseV5.scope();
  main.querySelector("header")?.insertAdjacentHTML("beforeend",'<div><p>'+esc(example.note)+'</p><p>'+external(example.catalog,"核对 MIT 作者书目")+' · '+external(example.scholarUrl,"Google Scholar 主页")+'</p></div>');
 }
 if(["profile","zhong","he","insights"].includes(p)){
  const subject=p==="zhong"?zhongScope("author"):p==="he"?window.AtlasLibraryCaseV5.scope():scope;
  if(subject.mode==="author")disposeView=window.AtlasInsightsV5.mount(main,subject.records,subject);
 }
 if(p==="search"){
  main.insertAdjacentHTML("beforeend", '<div class="entry-routes"><section><h2>钟志豪的学者画像</h2><p>查看 Cardiff 的逐篇署名，以及哈工大（深圳）会议记录提供的单位线索。</p><div><a href="#zhong">打开画像 ↗</a><a href="./zhong.html">逐篇核查卡</a></div></section><section><h2>机构年度认领</h2><p>按发表年份找出署名本院的论文，与人员名册匹配并导出认领结果。</p><div><a href="#claims">进入年度工作台 ↗</a></div></section><section><h2>何恺明的计算机视觉论文</h2><p>从已核对身份的公开书目查看逐篇合作者与发表场所。</p><a href="#he">打开书目档案 ↗</a></section></div>');
  disposeView=window.AtlasSearchV3.mount(main,{scope,onOpen:(v,dest="profile")=>setScope(v,dest==="ai"?"ai":"profile")});
 }
 if(p==="chinese"&&scope.mode==="author")disposeView=window.AtlasCN.mount(main,{scope,onMerge:rows=>{openChineseRows(rows);return scope.records;}});
 if(p==="report")disposeView=window.AtlasReportV4.mount(main,scope);
 if(p==="claims")disposeView=window.AtlasClaimsV3.mount(main,{scope});
 if(p==="ai"){
  disposeView=window.AtlasAIV3.mount(main,{scope,records:scope.records});
  if(!window.AtlasAIConfig?.platformAuth)main.insertAdjacentHTML("beforeend",'<section class="panel boxpad"><h2>使用云端账号</h2><p>账号版可登录后通过服务器调用 Qwen 或 DeepSeek。两个网址的浏览器工作区独立，切换前可导出书目。</p><a href="https://byline-atlas-cn-r8m4.funcord8.chatgpt.site/#ai" target="_blank" rel="noopener noreferrer">打开云端账号版</a></section>');
 }
 if(p==="classic")requestAnimationFrame(engrave);
}
function openRecord(idx){
 const r=scope.records[idx];if(!r)return;currentRecord=idx;
 const rr=rankRows(r),rankInfo=rr.length?rr.map(x=>`${x.system==="JCR"?"JCR":"中科院历史版"} ${x.year} · ${x.category} · ${x.system==="JCR"?"Q"+x.quartile:x.quartile+"区"}`).join("；"):r.issn?.length?"当前分区表无匹配":"待补 ISSN";
 dia("论文证据",`<h3 style="margin:0 0 5px;line-height:1.5">${esc(r.title)}</h3><div class="muted">${esc(r.journal)} · ${esc(r.year||"年份待核")} · ${esc(typeName(r.workType))}</div><div class="tags" style="margin-top:10px">${tags(r)}${r.review?badge("已人工核查","warm"):""}${r.excluded?badge("已排除","dim"):""}</div>
 <div class="evidencebox"><strong>${esc(r.source||"书目")}</strong><br>${esc(r.evidence||"请核对原文")} ${r.evidenceUrl?external(r.evidenceUrl,"证据出处"):""} ${r.verificationUrl?external(r.verificationUrl,"开放全文"):""}</div>
 ${r.provenance?.length?`<div class="evidencebox"><strong>收录来源</strong><ul>${r.provenance.map(p=>`<li>${external(p.url,p.source)||esc(p.source)} ${esc(p.id||"")}</li>`).join("")}</ul></div>`:""}
 ${r.conflicts?.length?`<div class="notice"><strong>来源差异待核</strong><p>${esc(r.conflicts.join(" · "))}</p></div>`:""}
 ${r.review?`<div class="evidencebox"><strong>人工核查 · ${esc(r.review.date?.slice(0,10))}</strong><br>${esc(r.review.note)} ${external(r.review.url,"人工证据")}</div>`:""}
 ${r.identityEvidence?`<div class="evidencebox"><strong>身份依据</strong><br>${esc(r.identityEvidence)} ${external(r.identityEvidenceUrl,"身份出处")}</div>`:""}
 ${citeText(r)?`<p><b>引用记录</b>　${esc(citeText(r))}</p>`:""}
 ${window.AtlasCN.labels(r).length?`<p><b>核心目录与索引</b>　${window.AtlasCN.labels(r).map(c=>external(c.url,[c.label,c.edition].filter(Boolean).join(" "))||esc(c.label)).join(" · ")}</p>`:""}
 <p><b>期刊影响因子 JIF · ${esc(impactYear)}</b>　${impactCell(r)} ${external(impactInfo(r)?.jifSource,"JIF 数据来源")}</p>
 <p><b>期刊分区</b>　${esc(rankInfo)} ${external(window.AtlasJournals.lookup(r)?.cas?.source,"核对内置中科院分区")} ${external(window.AtlasJournals.lookup(r)?.jcrSource,"核对内置 JCR 学科分区")}</p><div class="buttonset">${external(r.url,"论文原文")}${scope.kind!=="import"&&!r.identityPending&&r.doi&&!r.review?'<button class="outline" data-act="verify-paper">核验开放全文</button>':""}<button class="outline" data-act="edit-paper">人工核查</button><button class="plain" data-act="exclude">${r.excluded?(r.identityPending?"恢复到身份待核":"恢复计入"):"排除本篇"}</button></div><div id="verify-note" class="notice" style="margin-top:12px" role="status"></div>`);
}
const contributionFields=[
 ["conceptualization","作者贡献声明确认研究构思"],
 ["methodology","作者贡献声明确认方法设计"],
 ["mentorCoauthored","已核实博士导师参与联署"]
];
function contributionInputs(record){
 return '<details class="review-contributions"><summary>补充科研贡献依据</summary><p>依据论文贡献声明填写构思与方法。判定导师未联署需核实完整导师名单和论文署名。</p>'+
 contributionFields.map(([key,label])=>{
  const value=record.contribution?.[key];
  const select=opts([["","待核"],["yes","是"],["no","否"]],value===true?"yes":value===false?"no":"");
  return `<label>${esc(label)} <select class="field" name="${key}">${select}</select></label>`;
 }).join("")+`<label>导师关系出处 <input name="mentor-source" type="url" class="field" placeholder="https://…" value="${esc(record.contribution?.mentorEvidenceUrl||"")}"></label></details>`;
}
function editPaper(){
 const r=scope.records[currentRecord];const org=scope.mode==="institution";
 dia("记录人工核查",`<p style="margin-top:0">${esc(r.title)}</p><form class="stack" id="review-form">${org?`<label>第一单位　<select class="field" name="unit">${opts([["yes","是"],["no","否"],["unknown","待核"]],r.firstUnit==null?"unknown":r.firstUnit?"yes":"no")}</select></label>`:`<div class="checks">${Object.entries(roleNames).map(([k,t])=>`<label><input type="checkbox" name="role" value="${k}" ${has(r,k)?"checked":""}>${t}</label>`).join("")}</div><label><input name="pending" type="checkbox"${r.roleUnknown?" checked":""}> 仍有署名信息待核</label>`}
 ${!org&&r.identityStatus?`<label>身份归属　<select class="field" name="identity">${opts([["supported","计入当前作者"],["review","身份待核，暂不计入"]],r.identityPending?"review":"supported")}</select></label>`:""}${org?"":contributionInputs(r)}<label>证据链接<input required type="url" style="display:block;width:100%;margin-top:4px" class="field" name="url" value="${esc(r.review?.url||r.evidenceUrl||r.url||"")}" placeholder="https://…"></label>
 <label>原文依据<textarea class="textarea" required name="note" placeholder="记录署名顺位、脚注文字或单位地址">${esc(r.review?.note||"")}</textarea></label><div class="buttonset"><button class="solid">保存核查结果</button><button class="plain" type="button" data-act="cancel-edit">返回</button></div></form>`);
}


function download(name,data,mime){
 const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([data],{type:mime}));link.download=name;document.body.append(link);link.click();link.remove();const u=link.href;setTimeout(()=>URL.revokeObjectURL(u),2000);
}
function exportRows(){
 const rows=page()==="papers"?filtered():scoped();
 const header=["档案","统计范围","当前论文数","来源命中数","来源","论文题名","期刊","发表年","文献类型","DOI","ISSN","角色标记","署名仍待核","首位作者第一单位","期刊类别","分区及版本学科","证据来源","证据说明","原文","核验证据链接","人工核查日期","人工核查说明","人工证据链接","是否排除","本行是否计入","身份依据","身份出处","JIF 指标年","期刊影响因子 JIF","JIF 来源","收录数据库","逐库证据链接","来源差异","分来源引用数与日期","核心目录及索引版本"];
 const s=scope.mode==="institution";
 const data=rows.map(r=>[scope.name,scope.note,rows.length,scope.sourceHits??scope.total,scope.source,r.title,r.journal,r.year,typeName(r.workType),r.doi,(r.issn||[]).join(" | "),s?"":(r.roles||[]).map(k=>roleNames[k]).filter(Boolean).join(" | "),s?"":r.roleUnknown?"是":"否",s?unitText(r.firstUnit):"",familyNames[window.AtlasImport.classifyJournal(r)],rankRows(r).map(x=>`${x.system} ${x.year} ${x.category} ${x.system==="JCR"?"Q"+x.quartile:x.quartile+"区"}`).join(" | "),r.source,r.evidence,r.url,r.verificationUrl||r.evidenceUrl,r.review?.date,r.review?.note,r.review?.url,r.excluded?"是":"否",r.identityPending||r.excluded?"否":"是",r.identityEvidence,r.identityEvidenceUrl,impactYear,impactInfo(r)?.jif??"待补",impactInfo(r)?.jifSource,(r.sources||[]).join(" | "),(r.provenance||[]).map(p=>p.url).join(" | "),(r.conflicts||[]).join(" | "),citeText(r),catalogText(r)]);
 const safeCell=v=>{let s=String(v??"");if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const text=[header,...data].map(line=>line.map(safeCell).join(",")).join("\r\n");
 download(`署名图谱_${scope.name.replace(/[<>:"/\\|?*\x00-\x1F]/g,"_")}.csv`,"\uFEFF"+text,"text/csv;charset=utf-8");toast(`已导出 ${rows.length} 篇论文`);
}
function showStatus(id,message,isError=false){const n=byId(id);if(n){n.textContent=message;n.classList.toggle("err",isError);}}
function resultBody(message=""){return `<p style="margin-top:0">根据单位和 ORCID 选择检索对象。发表年份可缩小本次分析范围。</p><label>发表年份（可选）　<input class="field" id="live-year" type="number" min="1500" max="2099" step="1" placeholder="例如 2025" value="${esc(lastLiveYear)}"></label><div id="candidate-status" class="notice" style="margin-top:8px" role="status">${esc(message)}</div><div>${candidates.map((c,i)=>`<button class="candidate" data-candidate="${i}"><strong>${esc(c.name)}</strong><small>${esc([c.affiliation,c.detail].filter(Boolean).join(" · "))}</small></button>`).join("")}</div>`;}
let lastLiveYear="",searchProvider="openalex";
function snapshotDraft(){if(byId("query"))query=byId("query").value;if(byId("affiliation"))affiliation=byId("affiliation").value;}
function localCandidate(m,q,unit){
 const n=q.trim().toLowerCase().replace(/^https?:\/\/(?:orcid\.org|openalex\.org)\//,"").replace(/\s+/g," ");
 if(m!=="author"||!["zhihao zhong","zhong zhihao","钟志豪"].includes(n))return null;
 const hint=(unit||"").trim().toLowerCase().normalize("NFKC").replace(/[\s(),，·-]/g,"");
 const units=["cardiff","cardiffuniversity","universityofcardiff","卡迪夫","卡迪夫大学","hit","hitsz","harbininstituteoftechnology","harbininstituteoftechnologyshenzhen","哈尔滨工业大学","哈尔滨工业大学深圳","哈工大","哈工大深圳"];
 if(hint&&!units.includes(hint))return null;
 const v=zhongScope(m);return {...v.candidate,provider:"snapshot",affiliation:v.affiliation,detail:"Cardiff 目录样本 · 4 篇期刊论文 · 2026-11-19 核查"};
}
async function search(){
 snapshotDraft();if(!query.trim()||busy)return;notice="";const seq=++requestSeq;
 if(/^(?:https?:\/\/)?scholar\.google\.[^/]+/i.test(query.trim())){
  dia("从 Google 学术导入",`<p>在这个学者主页勾选论文，点击“导出”，保存为 BibTeX 或 CSV。导入后可以逐篇核对原文署名。</p><div class="buttonset"><button class="solid" data-act="go-imports">导入书目</button><button class="outline" data-act="search-by-name">改用姓名检索</button></div>`);return;
 }
 const provider=searchMode==="author"&&searchProvider==="epmc"?window.PmcSource:window.ScholarSource;busy=true;notice=provider===window.PmcSource?"正在查询 Europe PMC…":"正在查询 OpenAlex…";render();const m=searchMode;const cached=localCandidate(m,query,affiliation);
 try{
  const result=await provider.search(m,query,affiliation);if(seq!==requestSeq)return;
  candidates=cached?[cached,...result]:result;lastLiveYear="";notice="";
  if(!candidates.length){notice=m==="author"?"未找到匹配学者。可试论文上的英文署名、ORCID，或导入学术主页导出的书目。":"未找到匹配机构。可试英文全称或 OpenAlex 机构 ID。";}
  else if(page()==="classic"||page()==="overview")dia(m==="author"?"选择学者":"选择机构",resultBody());
 }catch(e){if(seq!==requestSeq)return;notice=e.message+" 可在“数据导入”中导入书目或设置 OpenAlex Key。";if(cached&&["overview","classic"].includes(page())){candidates=[cached];lastLiveYear="";dia("本地核查样本",resultBody("在线数据源连接失败。以下为已逐篇核查的离线样本。"));}}
 finally{if(seq===requestSeq){busy=false;render();}}
}
async function chooseCandidate(i){
 if(busy)return;const c=candidates[i];if(!c)return;const input=byId("live-year");if(input&&!input.reportValidity())return;
 lastLiveYear=input?.value.trim()||"";
 if(c.provider==="snapshot"){const v=zhongScope(searchMode);notice="";closeDia();setScope(v);if(lastLiveYear){year=lastLiveYear;render();}return;}
 const seq=++requestSeq;busy=true;const m=searchMode;
 byId("dia-content").querySelectorAll("[data-candidate]").forEach(el=>el.disabled=true);showStatus("candidate-status","正在获取论文与作者署名…");
 try{
  const data=await (c.provider==="epmc"?window.PmcSource:window.ScholarSource).load(m,c,{year:lastLiveYear});if(seq!==requestSeq||!byId("dialog").open)return;
  const v={name:c.name,affiliation:c.affiliation,mode:m,kind:"live",candidate:c,source:data.source,records:data.records,total:data.total,limited:data.limited,nextCursor:data.nextCursor||null,liveYear:lastLiveYear,loadedAt:new Date().toISOString().slice(0,10)};
  v.sourceHits=data.sourceHits??data.total;v.note=data.note||liveNote(v);notice="";closeDia();setScope(v);
 }catch(e){if(seq===requestSeq)showStatus("candidate-status",e.message,true);}
 finally{if(seq===requestSeq){busy=false;byId("dia-content").querySelectorAll("[data-candidate]").forEach(el=>el.disabled=false);if(page()==="overview")render();}}
}
function liveNote(v){return `${v.source}。来源命中 ${v.total} 条，已载入 ${v.records.length} 条；指标仅基于已载入且计入的论文。`;}
let loadingPage=false;
async function loadNext(button){
 if(loadingPage||!scope.nextCursor)return;
 loadingPage=true;button.disabled=true;button.textContent="载入中…";const dest=scope,prev=dest.nextCursor;
 try{
  const v=await (dest.candidate?.provider==="epmc"?window.PmcSource:window.ScholarSource).load(dest.mode,dest.candidate,{year:dest.liveYear,cursor:prev});
  if(scope!==dest)return;const ids=new Set(dest.records.map(r=>r.id));const added=v.records.filter(r=>!ids.has(r.id)&&ids.add(r.id));dest.records.push(...added);
  dest.total=v.total;dest.sourceHits=v.sourceHits??v.total;dest.nextCursor=v.nextCursor!==prev?v.nextCursor:null;dest.limited=Boolean(dest.nextCursor)||Boolean(v.limited);dest.note=v.note||liveNote(dest);remember();render();toast(`新增 ${added.length} 篇论文`);
 }catch(e){toast(e.message);}
 finally{loadingPage=false;button.disabled=false;button.textContent="载入下一页";}
}
async function parseFile(inputId){
 const file=byId(inputId)?.files?.[0];if(!file)throw new Error("请先选择文件。");if(file.size>12*1024*1024)throw new Error("请选择 12 MB 以内的 UTF-8 文本文件。");
 const text=await file.text();if(text.includes("\uFFFD"))throw new Error("文件编码无法识别，请保存为 UTF-8 后重新导入。");return {file,text};
}
async function importBib(){
 try{
  const {file,text}=await parseFile("bib-file"),records=window.AtlasImport.parseBibliography(text).map(r=>({...r,identityPending:true,identityStatus:"review",identityEvidence:"书目文件中的作者归属待核。"})),name=byId("import-name").value.trim()||file.name.replace(/\.[^.]+$/,"");
  dia("打开导入档案",`<p>已解析 <b>${records.length}</b> 篇文献。确认后切换到「${esc(name)}」，可在论文清单逐篇核查署名。</p><div class="buttonset"><button class="solid" id="confirm-bib">打开此档案</button><button class="outline" data-act="close-dialog">返回</button></div>`);
  byId("confirm-bib").onclick=()=>{notice="";query="";affiliation="";closeDia();setScope({kind:"import",mode:"author",name,affiliation:"个人导入书目",source:"用户导入书目",total:records.length,candidate:{name},records,note:`书目文件 ${file.name} 含 ${records.length} 篇独立文献。署名、通讯与单位信息以逐篇核查记录为准。`});};
 }catch(e){showStatus("bib-note",e.message,true);}
}
async function importImpact(){
 try {
  const {text}=await parseFile("impact-file");
  const incoming=window.AtlasJournalImports.parse(text);
  if(!incoming.length)throw new Error("文件没有可导入的数据行。");
  const keyed=new Map(impactRows.map(row=>[row.issn+"|"+row.year,row]));
  for(const row of incoming)keyed.set(row.issn+"|"+row.year,row);
  impactRows=[...keyed.values()];
  const saved=storeLocal(JIF_KEY,impactRows);
  impactYear=Math.max(...incoming.map(row=>row.year));
  render();
  showStatus("impact-note",`本次载入 ${incoming.length} 条影响因子，指标年已切换为 ${impactYear}。${saved?"":"仅在本次会话保留。"}`);
 }catch(e){showStatus("impact-note",e.message,true);}
}
async function importRanks(){
 try{
  const {text}=await parseFile("rank-file");const table=window.AtlasImport.parseRankCSV(text);if(!table.length)throw new Error("文件只有列头，请填写分区数据。");
  const install=()=>{ranks=table;const saved=storeLocal(RKEY,ranks);filters=defaultFilters();render();showStatus("rank-note",`已载入 ${ranks.length} 条分区记录${saved?"，可在论文清单中筛选。":"，本次会话可用。"} `);};
  if(ranks.length){dia("更新本地分区表",`<p>新文件的 ${table.length} 条分区记录将替换当前 ${ranks.length} 条。要保留多个年份，请将需要的版本放在同一个 CSV 中。</p><button class="solid" id="confirm-rank">替换分区表</button> <button class="outline" data-act="close-dialog">返回</button>`);byId("confirm-rank").onclick=()=>{closeDia();install();};}else install();
 }catch(e){showStatus("rank-note",e.message,true);}
}
async function verifyPaper(button){
 const idx=currentRecord,r=scope.records[idx],originalScope=scope;if(!r)return;button.disabled=true;showStatus("verify-note","正在查找出版商开放全文中的作者和贡献脚注…");
 try{
  const updated=await window.ScholarSource.verify(r,scope.candidate,scope.mode);
  if(originalScope!==scope||scope.records[idx]!==r)return;
  // Supplement the evidence; retain reviewed source annotations that the XML may omit.
  if(scope.kind==="sample"||scope.kind==="case"){
   updated.roles=unique([...(r.roles||[]),...(updated.roles||[])]);updated.evidence=r.evidence+" "+updated.evidence;
   if(scope.mode==="institution"&&updated.firstUnit==null)updated.firstUnit=r.firstUnit;
   updated.source=r.source+" + Europe PMC";updated.roleUnknown=r.roleUnknown&&updated.roleUnknown;
  }
  scope.records[idx]=updated;remember();if(byId("dialog").open&&currentRecord===idx){openRecord(idx);showStatus("verify-note","已保存开放全文的核验记录。");}render();
 }catch(e){if(currentRecord===idx)showStatus("verify-note",e.message,true);}finally{button.disabled=false;}
}
function saveReview(form){
 const fd=new FormData(form),r=scope.records[currentRecord],url=safeLink(String(fd.get("url")||"")),note=String(fd.get("note")||"").trim();
 if(!r||!url||!note){toast("请填写原文依据及有效的网页链接。");return;}
 const mentorUrl=safeLink(String(fd.get("mentor-source")||"").trim());
 if(scope.mode==="author"&&fd.get("mentorCoauthored")&&!mentorUrl){toast("判定导师联署情况时，请补充导师关系的公开出处。");return;}
 if(scope.mode==="institution"){const v=fd.get("unit");r.firstUnit=v==="yes"?true:v==="no"?false:null;}
 else{const roles=fd.getAll("role").filter(k=>Object.hasOwn(roleNames,k));if(roles.includes("cocorresponding")&&!roles.includes("corresponding"))roles.push("corresponding");r.roles=roles;r.roleUnknown=!!fd.get("pending");
  const facts={...r.contribution};
  facts.soleCorresponding=r.roleUnknown?null:roles.includes("corresponding")&&!roles.includes("cocorresponding");
  for(const [key] of contributionFields){
   const value=fd.get(key);
   facts[key]=value==="yes"?true:value==="no"?false:null;
  }
  facts.mentorEvidenceUrl=mentorUrl;
  facts.evidenceUrl=url;
  r.contribution=facts;
 }
 if(fd.has("identity")){r.identityPending=fd.get("identity")==="review";r.identityStatus=r.identityPending?"review":"supported";r.identityBasis="manual";r.identityEvidence=note;r.identityEvidenceUrl=url;r.identityReview=true;}r.review={note,url,date:new Date().toISOString()};remember();openRecord(currentRecord);render();toast("核查结果已保存");
}
document.addEventListener("click",e=>{
 const b=e.target.closest("button");if(!b)return;
 if(b.hasAttribute("data-research-search")){
  const person=page()==="he"?window.AtlasLibraryCaseV5.scope():page()==="zhong"?zhongScope("author"):scope;
  window.AtlasSearchV3.prefill(person.name,person.kind==="case"?"Cardiff University":person.candidate?.affiliationHint||"");
  nav("search");return;
 }
 if(b.dataset.heOpen && ["papers","report"].includes(b.dataset.heOpen)){setScope(window.AtlasLibraryCaseV5.scope(),b.dataset.heOpen);return;}
 if(b.dataset.casePage && ["report","ai","papers","search"].includes(b.dataset.casePage)){setScope(zhongScope("author"),b.dataset.casePage);return;}
 if(b.dataset.page){nav(b.dataset.page);return;}
 if(b.hasAttribute("data-mode")){snapshotDraft();requestSeq++;busy=false;notice="";if(searchMode!==b.dataset.mode)query="";searchMode=b.dataset.mode;render();byId("query")?.focus();return;}
 if(b.hasAttribute("data-recent")){const v=recent()[Number(b.dataset.recent)];if(v){notice="";query="";affiliation="";setScope(v);}return;}
 if(b.hasAttribute("data-record")){openRecord(Number(b.dataset.record));return;}
 if(b.hasAttribute("data-candidate")){chooseCandidate(Number(b.dataset.candidate));return;}
 const act=b.dataset.act;
 if(act==="identity-list"){filters=defaultFilters();filters.status="identity";year="";nav("papers");}
 if(act==="cardiff"){query="";affiliation="";notice="";setScope(zhongScope(searchMode));}
 if(act==="case-author"||act==="case-org"){
  const currentYear=page()==="zhong"?"":year;
  setScope(zhongScope(act==="case-org"?"institution":"author"));
  year=currentYear;
  render();
 }
 if(act==="export")exportRows();
 if(act==="clear-filters"){year="";filters=defaultFilters();render();}
 if(act==="bib-import")importBib();
 if(act==="rank-import")importRanks();
 if(act==="go-imports"){closeDia();nav("imports");}
 if(act==="search-by-name"){closeDia();query="";render();byId("query")?.focus();}
 if(act==="next-page")loadNext(b);
 if(["sample","org-sample","quick-example"].includes(act)){const m=act==="quick-example"?searchMode:act==="org-sample"?"institution":"author";closeDia();notice="";query="";affiliation="";setScope(sampleScope(m));}
 if(act==="impact-import")importImpact();
 if(act==="impact-template")download("JIF年度指标模板.csv","\uFEFFissn,year,jif,source\r\n","text/csv;charset=utf-8");
 if(act==="template")download("期刊分区模板.csv",window.AtlasImport.template(),"text/csv;charset=utf-8");
 if(act==="apply-key"){const k=byId("api-key").value.trim();if(!k){toast("请输入 OpenAlex API Key");return;}window.ScholarSource.setKey(k);hasKey=true;render();toast("密钥已应用，可重新检索");}
 if(act==="clear-key"){window.ScholarSource.setKey("");hasKey=false;render();toast("密钥已移除");}
 if(act==="edit-paper")editPaper();if(act==="cancel-edit")openRecord(currentRecord);if(act==="verify-paper")verifyPaper(b);
 if(act==="exclude"){const r=scope.records[currentRecord];r.excluded=!r.excluded;remember();openRecord(currentRecord);render();toast(r.excluded?"已排除，可在“已排除的论文”中恢复":"已恢复计入");}
 if(act==="close-dialog")closeDia();
 if(b.id==="menu-btn"){byId("sidebar").classList.toggle("open");byId("shade").classList.toggle("open");}
 if(b.id==="dia-close")closeDia();
});
document.addEventListener("input",e=>{
 if(e.target.id==="query")query=e.target.value;
 if(e.target.id==="affiliation")affiliation=e.target.value;
 if(e.target.id==="paper-search"){filters.text=e.target.value;const rows=filtered();byId("papers-table").innerHTML=table(rows);byId("paper-count").textContent=`显示 ${rows.length} 篇`;byId("filtered-contributions").innerHTML=window.AtlasContributions.render(rows.filter(r=>!r.identityPending&&!r.excluded),scope);}
});
document.addEventListener("change",e=>{
 const n=e.target;if(n.dataset.control==="jif-year"){impactYear=Number(n.value);render();return;}if(n.id==="provider"){searchProvider=n.value;requestSeq++;busy=false;notice="";render();return;}if(n.dataset.control==="year"){year=n.value;render();}
 if(n.dataset.filter){if(!n.reportValidity())return;filters[n.dataset.filter]=n.value;if(n.dataset.filter==="system"){filters.edition="";filters.category="";filters.quartile="";}if(n.dataset.filter==="edition")filters.category="";render();}
});
document.addEventListener("submit",e=>{if(e.target.id==="search-form"){e.preventDefault();search();}if(e.target.id==="review-form"){e.preventDefault();saveReview(e.target);}});
byId("shade").onclick=()=>{byId("sidebar").classList.remove("open");byId("shade").classList.remove("open");};
byId("dialog").addEventListener("click",e=>{if(e.target!==byId("dialog"))return;const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDia();});
byId("dialog").addEventListener("close",()=>{if(busy){requestSeq++;busy=false;if(page()==="overview")render();}});
window.addEventListener("hashchange",()=>{requestSeq++;busy=false;notice="";render();window.scrollTo(0,0);});
window.addEventListener("resize",engrave);
let disposeView=null;
render();

})();
