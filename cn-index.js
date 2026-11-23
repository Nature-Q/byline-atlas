(() => {
  "use strict";
  const db = "CNKI", catalogKey = "byline-atlas-cn-index-catalog-v1";
  const names = {CSSCI:"CSSCI 来源（南核）", CSSCI_EXT:"CSSCI 扩展版", PKU:"北大中文核心", SSCI:"SSCI"};
  const refs = {
    cnki:"https://kns.cnki.net/kns8s/AdvSearch", cssci:"https://cssrac.nju.edu.cn/cpzx/index.html",
    pku:"https://lib.pku.edu.cn/publish/bjdxtsg/5jlhd/56cgfb/561hxqkym/index.htm",
    ssci:"https://mjl.clarivate.com/", crossref:"https://search.crossref.org/"
  };
  const cssciPDF="https://lic.cua.edu.cn/_upload/article/files/16/98/bb8cf0a249a3b1565c49568ed3d0/2b93434d-63a8-47d3-a336-f98a19506f10.pdf";
  const extendedPDF="https://lic.cua.edu.cn/_upload/article/files/16/98/bb8cf0a249a3b1565c49568ed3d0/55136716-d5ff-4bdb-930d-6c2bdae22001.pdf";
  const pkuPDF="https://lic.cua.edu.cn/_upload/article/files/16/98/bb8cf0a249a3b1565c49568ed3d0/a9fc57ef-9fcc-4a83-a865-f55b450ef87e.pdf";
  const ssci2025="https://home.izum.si/COBISS/bibliografije/seznami_za_mednarodne_baze/2025/ser-SSCI-tuje.html";
  const seeds=[...["北京大学教育评论","北京体育大学学报","编辑学报","比较教育研究"].map(journal=>({journal,system:"CSSCI",url:cssciPDF})),
    ...["编辑学刊","出版科学"].map(journal=>({journal,system:"CSSCI_EXT",url:extendedPDF}))].map(r=>({...r,edition:"2025–2026",from:2025,to:2026,issn:"",source:"南京大学中国社会科学研究评价中心目录，第 1 页",observedAt:"2026-11-24"}));
  for(const journal of ["中国全科医学","中华医学杂志","南方医科大学学报"])seeds.push({journal,system:"PKU",edition:"2023 版（本站示例适用年 2025）",from:2025,to:2025,issn:"",url:pkuPDF,source:"《中文核心期刊要目总览》2023 年版，第 9 页；示例仅覆盖 2025 年",observedAt:"2026-11-24"});
  for(const [journal,issn] of [["China Economic Review","1043-951X|1873-7781"],["The China Quarterly","0305-7410|1468-2648"]])seeds.push({journal,issn,system:"SSCI",edition:"2025",from:2025,to:2025,url:ssci2025,source:"COBISS / IZUM · SSCI 2025 目录",observedAt:"2026-11-24"});
  const clean = s=>String(s??"").trim().replace(/\s+/g," ");
  const norm = s=>clean(s).normalize("NFKC").toLowerCase().replace(/\s+/g,"");
  const esc = v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const day = ()=>new Date().toISOString().slice(0,10);
  function safeURL(value) {
    try {const url=new URL(clean(value));return /^https?:$/.test(url.protocol)&&!url.username&&!url.password?url.href:"";} catch {return "";}
  }
  function link(url,label) {const u=safeURL(url);return u?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':esc(label);}
  const year = v=>/^\d{4}$/.test(clean(v)) && +v>=1500 && +v<=2100?+v:null;
  function doi(v) {const d=clean(v).replace(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/i,"");return /^10\.\d{4,9}\/[^\s<>"\u0000-\u001f]+$/i.test(d)?d.toLowerCase():"";}
  function system(v) {
    const s=norm(v);
    if(["cssci","cssci来源","cssci来源期刊","南核","南大核心"].includes(s))return "CSSCI";
    if(["cssci_ext","cssciext","cssci扩展","cssci扩展版","南大扩展","南扩"].includes(s))return "CSSCI_EXT";
    if(["pku","北大核心","北核","北大中文核心","中文核心期刊要目总览"].includes(s))return "PKU";
    return s==="ssci"?"SSCI":"";
  }
  function issns(s) {return [...new Set((String(s||"").match(/\b\d{4}[- ]?\d{3}[\dX]\b/ig)||[]).map(v=>v.replace(/[- ]/g,"").toUpperCase()))];}
  function csv(text) {
    const input=text.replace(/^\uFEFF/,""), delim=input.split(/\r?\n/)[0].includes("\t")?"\t":",";
    const all=[];let row=[],cell="",quoted=false;
    for(let i=0;i<input.length;i++) {
      const c=input[i];
      if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
      else if(!quoted&&c===delim){row.push(cell.trim());cell="";}
      else if(!quoted&&(c==="\n"||c==="\r")){if(c==="\r"&&input[i+1]==="\n")i++;row.push(cell.trim());if(row.some(Boolean))all.push(row);row=[];cell="";}
      else cell+=c;
    }
    if(quoted)throw Error("CSV 有未闭合的双引号。");
    row.push(cell.trim());if(row.some(Boolean))all.push(row);
    if(all.length<2)throw Error("CSV 至少需要表头和一行数据。");
    const headers=all.shift().map(norm);
    return all.map((r,i)=>{if(r.length!==headers.length)throw Error("第 "+(i+2)+" 行与表头列数不符。");return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
  }
  const val=(obj,...keys)=>keys.map(k=>obj[norm(k)]).find(v=>clean(v))||"";
  function tags(text,kind) {
    const records=[];let record={},last=null;
    function flush(){if(Object.keys(record).length)records.push(record);record={};last=null;}
    for(const raw of text.replace(/^\uFEFF/,"").split(/\r?\n/)){
      const re=kind==="end"?/^%([A-Za-z0-9@+!])(?:\s+(.*)|$)/:kind==="ris"?/^([A-Z][A-Z0-9])\s{1,3}-\s*(.*)$/:/^([A-Z][A-Z0-9])(?:\s+(.*)|$)/;
      const m=raw.trimEnd().match(re);
      if(m){const key=m[1];if(key===({end:"0",ris:"TY",rw:"RT"})[kind])flush();
        if(kind==="ris"&&key==="ER"){flush();continue;}
        last=key;(record[key]||=[]).push((m[2]||"").trim());
      }else if(last&&raw.trim()){const lines=record[last];lines[lines.length-1]+=" "+raw.trim();}
    }
    flush();
    const fields=kind==="end"?{title:"T",authors:"A",journal:"J|B",year:"D",doi:"R",url:"U",issn:"@",org:"+" ,keywords:"K",type:"0"}:
      kind==="ris"?{title:"TI|T1",authors:"AU|A1",journal:"JF|JO|T2|JA",year:"PY|Y1|DA",doi:"DO",url:"UR",issn:"SN",org:"AD",keywords:"KW",type:"TY"}:
      {title:"T1|TI",authors:"A1|AU",journal:"JF|JO",year:"YR",doi:"DO",url:"LK|UL|UR",issn:"SN",org:"AD",keywords:"K1",type:"RT"};
    return records.map(r=>Object.fromEntries(Object.entries(fields).map(([key,variants])=>{
      const v=variants.split("|").map(k=>r[k]).find(a=>a?.length)||[];return [key,v.join(key==="authors"||key==="org"||key==="keywords"?";":" ")];
    })));
  }
  const fieldAliases={title:["title","题名","篇名","文献题名","标题"],authors:["authors","author","作者","作者姓名"],journal:["journal","source","期刊","刊名","来源","文献来源"],year:["year","年","出版年","年份","发表年度","发表年份"],doi:["doi"],url:["url","链接","来源链接","文献链接"],issn:["issn"],org:["org","affiliation","作者单位","机构","单位"],keywords:["keywords","关键词","关键字"],cite:["cites","cited by","被引次数","被引频次","引证文献数","引证数","被引"],citeDate:["citation_date","引证查询日期","被引统计日期"],cor:["corresponding","通讯作者","通信作者"],cofirst:["cofirst","共同第一作者","共同一作"],roleUrl:["role_url","署名证据链接","原文署名链接"],type:["type","文献类型"],language:["language","语种"],idx:["system","索引体系","收录体系"],edition:["edition","版次","版本"],from:["from","起始年"],to:["to","截止年"],indexUrl:["index_url","收录证据链接"]};
  function readRows(text) {
    const s=text.replace(/^\uFEFF/,"").trim();if(!s)throw Error("请选择文件或粘贴题录。");if(s.length>12000000)throw Error("请拆分为 12 MB 以内的文件再导入。");
    const kind=/^RT\s+/m.test(s)?"rw":/^TY\s{1,3}-\s/m.test(s)?"ris":/^%[0T]\s/m.test(s)?"end":"csv";
    if(kind!=="csv")return tags(s,kind);
    const rows=csv(s);if(!fieldAliases.title.some(k=>Object.hasOwn(rows[0],norm(k))))throw Error("请使用知网 RefWorks、EndNote、RIS 或带“题名”表头的 CSV。");
    return rows.map(r=>Object.fromEntries(Object.entries(fieldAliases).map(([key,a])=>[key,val(r,...a)])));
  }
  function splitNames(v) {const s=clean(v);if(!s)return [];return s.split(/[;；、]|\s+and\s+|(?<=[\u3400-\u9fff])[,，](?=\s*[\u3400-\u9fff])/iu).map(clean).filter(Boolean);}
  function hash(s){let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.codePointAt(0),16777619);b=Math.imul(b,33)^c.codePointAt(0);}return (a>>>0).toString(36)+(b>>>0).toString(36);}
  function cnkiId(v) {try {const u=new URL(v);if(!/(^|\.)cnki\.(net|com\.cn)$/i.test(u.hostname))return "";const en=[...u.searchParams].find(([k])=>k.toLowerCase()==="filename")?.[1];return /^[a-z0-9_-]{4,60}$/i.test(en||"")?"cnki:"+en.toUpperCase():"";}catch{return "";}}
  function catalogueItem(record) {
    const r=record, sys=system(r.system), start=year(r.from), end=year(r.to), url=safeURL(r.url);
    if(!sys||!clean(r.edition)||!start||!end||end<start||!url||(!clean(r.journal)&&!issns(r.issn).length))return null;
    return {system:sys,edition:clean(r.edition),from:start,to:end,journal:clean(r.journal),issn:issns(r.issn).join("|"),url,source:clean(r.source)||"本地目录",observedAt:clean(r.observedAt)||day()};
  }
  function catalogRows(text) {return csv(text).map((r,i)=>{
    const item=catalogueItem({system:val(r,"system","体系"),edition:val(r,"edition","版本"),from:val(r,"from","起始年"),to:val(r,"to","截止年"),journal:val(r,"journal","刊名"),issn:val(r,"issn"),url:val(r,"url","来源链接"),source:val(r,"source","依据")});
    if(!item)throw Error("第 "+(i+2)+" 行缺少有效的体系、版本、适用年份、期刊标识或证据链接。");return item;
  });}
  let custom=[];try{const cached=JSON.parse(localStorage.getItem(catalogKey)||"[]");if(Array.isArray(cached))custom=cached.map(catalogueItem).filter(Boolean);}catch{}
  const catID=r=>[r.system,r.edition,r.from,r.to,norm(r.journal),r.issn].join("|");
  function labels(row) {
    const y=year(row.year), ids=issns((row.issn||[]).toString()),j=norm(row.journal);
    if(!y||["book","book-chapter","conference-paper","inproceedings","proceedings","thesis","dissertation"].includes(String(row.workType||"").toLowerCase()))return [];
    const catalog=[...seeds,...custom].filter(r=>{
      const ri=issns(r.issn),matched=ids.length&&ri.length?ids.some(i=>ri.includes(i)):!!j&&j===norm(r.journal);
      return matched&&r.from<=y&&y<=r.to;
    });
    const specific=(row.cnIndexEvidence||[]).map(e=>catalogueItem({...e,journal:e.journal||row.journal,issn:e.issn||ids.join("|")})).filter(e=>e&&e.from<=y&&e.to>=y);
    return Array.from(new Map([...catalog,...specific].map(r=>[catID(r),{...r,label:names[r.system]}])).values());
  }
  function importedRow(v,target) {
    const title=clean(v.title);if(!title)throw Error("记录缺少题名。");
    const d=doi(v.doi)||doi(v.url),url=safeURL(v.url)||(d?"https://doi.org/"+d:"");
    const y=year(clean(v.year).match(/\b\d{4}\b/)?.[0]),journal=clean(v.journal),authors=splitNames(v.authors),name=norm(target);
    const byline=authors.map((a,i)=>({name:a,position:i===0?"first":i===authors.length-1?"last":"middle",affiliations:[],institutions:[],isTarget:!!name&&norm(a)===name}));
    const hits=byline.filter(p=>p.isTarget);
    if(hits.length!==1)byline.forEach(p=>p.isTarget=false);
    const roleURL=safeURL(v.roleUrl)||url, roles=[], declared=(v)=>!!roleURL&&hits.length===1&&splitNames(v).some(n=>norm(n)===name);
    if(hits.length===1&&byline[0].isTarget)roles.push("first");
    if(declared(v.cor)){roles.push("corresponding");if(splitNames(v.cor).length>1)roles.push("cocorresponding");}
    if(declared(v.cofirst))roles.push("cofirst");
    const id=cnkiId(url)||"cn-record:"+hash([d,norm(title),y,norm(v.authors),norm(journal)].join("|"));
    const citationText=clean(v.cite), count=/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(citationText)?Number(citationText.replace(/,/g,"")):null;
    const date=/^\d{4}-\d{2}-\d{2}$/.test(v.citeDate||"")?v.citeDate:day();
    const type=norm(v.type);
    const workType=/conference|conferencepaper|会议|conf/.test(type)?"conference-paper":/thes|学位/.test(type)?"thesis":/journal|jour|期刊/.test(type)||(!type&&journal)?"article":"unknown";
    const terms=clean(v.keywords).split(/[;；、,，]/).map(clean).filter(Boolean);
    const out={id,title,journal,year:y,doi:d,url,issn:issns(v.issn),roles,roleUnknown:!roles.includes("corresponding"),firstUnit:null,workType,byline,importAuthorText:authors.join("; "),keywords:terms,
      keywordEvidence:terms.map(term=>({source:db,kind:"题录关键词",term,url})),source:db,sources:[db],provenance:[{source:db,id,url,year:y,title}],
      identityPending:true,identityStatus:"review",identityBasis:"review",identityEvidence:"知网导出书目；同名、跨单位记录须逐篇确认。",identityEvidenceUrl:url,
      evidence:"知网导出署名："+(authors.join("、")||"未提供")+(v.org?"。题录所列机构："+clean(v.org):"")+(v.cor?"。导出记录的通讯作者："+clean(v.cor):""),evidenceUrl:roleURL,
      ...( /^zh\b|中文|chinese/i.test(v.language||"")?{language:"zh"}:{}),
      ...(Number.isSafeInteger(count)?{citedByCount:count,citationSource:db,citationEvidence:[{source:db,count,url,observedAt:date}]}:{})};
    if(v.idx) {
      const item=catalogueItem({system:v.idx,journal,issn:v.issn,edition:v.edition,from:v.from,to:v.to,url:v.indexUrl,source:"导入记录的收录依据"});
      if(item)out.cnIndexEvidence=[item];
    }
    return out;
  }
  function parse(text,target=""){return readRows(text).map((r,i)=>{try{return importedRow(r,target);}catch(e){throw Error("第 "+(i+1)+" 条："+e.message);}});}
  function chinese(row){return row.sources?.includes(db)||row.source===db||/^zh\b/i.test(row.language||"")||/[\u3400-\u9fff]/u.test(row.title||"");}
  function exportFile(filename,contents){const a=document.createElement("a"),url=URL.createObjectURL(new Blob(["\uFEFF",contents],{type:"text/csv;charset=utf-8"}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function toCSV(rows){const cell=v=>{let s=String(v??"");if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return rows.map(r=>r.map(cell).join(",")).join("\r\n");}
  async function readFile(file) {if(file.size>12000000)throw Error("请拆分为 12 MB 以内的文件。");const buf=await file.arrayBuffer();const u8=new Uint8Array(buf);
    if(u8[0]===255&&u8[1]===254)return new TextDecoder("utf-16le").decode(buf);
    if(u8[0]===254&&u8[1]===255)return new TextDecoder("utf-16be").decode(buf);
    try{return new TextDecoder("utf-8",{fatal:true}).decode(buf);}catch{return new TextDecoder("gb18030",{fatal:true}).decode(buf);}
  }
  async function lookup(name,start,signal){
    const u=new URL("https://api.crossref.org/works");
    u.search=new URLSearchParams({"query.author":name,filter:"type:journal-article",rows:"40",offset:String(start),select:"DOI,title,author,container-title,published,ISSN,language,is-referenced-by-count"}).toString();
    const res=await fetch(u,{credentials:"omit",signal});
    if(!res.ok)throw Error("Crossref 返回 "+res.status+"。可继续通过知网导入。");
    const body=(await res.json())?.message;
    if(!Array.isArray(body?.items))throw Error("Crossref 未返回有效书目。");
    const rows=[];
    for(const item of body.items){
      const paperTitle=item.title?.[0], paperJournal=item["container-title"]?.[0]||"";
      if(!paperTitle||(!/^zh\b/i.test(item.language||"")&&!/[\u3400-\u9fff]/.test(paperTitle)))continue;
      const contributors=Array.isArray(item.author)?item.author:[];
      const people=contributors.map(a=>clean(a.name||(/[\u3400-\u9fff]/.test((a.family||"")+(a.given||""))?(a.family||"")+(a.given||""):[a.given,a.family].filter(Boolean).join(" "))));
      const matches=contributors.map((a,i)=>[people[i],clean([a.family,a.given].join("")),clean([a.given,a.family].join(""))].some(n=>norm(n)===norm(name)));
      if(matches.filter(Boolean).length!==1)continue;
      const d=doi(item.DOI);if(!d)continue;
      const url="https://doi.org/"+d, byline=people.map((n,i)=>({name:n,isTarget:matches[i],position:i===0?"first":i===people.length-1?"last":"middle",
        affiliations:(contributors[i].affiliation||[]).map(o=>clean(o.name)).filter(Boolean),institutions:[]}));
      const count=item["is-referenced-by-count"],yearVal=year(item.published?.["date-parts"]?.[0]?.[0]);
      rows.push({id:"cr:"+d,title:paperTitle,journal:paperJournal,doi:d,url,year:yearVal,issn:item.ISSN||[],workType:"article",firstUnit:null,
        byline,importAuthorText:people.join("; "),roles:matches[0]?["first"]:[],roleUnknown:true,source:"Crossref",sources:["Crossref"],provenance:[{source:"Crossref",id:d,url}],
        identityPending:true,identityStatus:"review",identityBasis:"review",identityEvidence:"Crossref 有同名署名。请核查是否属于当前档案。",identityEvidenceUrl:url,evidence:people.join("、"),evidenceUrl:url,
        ...(item.language?{language:item.language}:{}),...(Number.isSafeInteger(count)&&count>=0?{citedByCount:count,citationEvidence:[{source:"Crossref",count,url:"https://api.crossref.org/works/"+encodeURIComponent(d),observedAt:day()}]}:{})});
    }
    const total=body["total-results"];return {rows,total,scanned:body.items.length,more:body.items.length===40&&(!Number.isFinite(total)||start+40<total)};
  }
  function render(scope={}){
    const who=scope.displayName||scope.name||"",cnName=clean(who).match(/[\u3400-\u9fff]{2,8}/)?.[0]||"";
    return '<div class="cn-index" data-cn-index><header class="page-head"><div><h1>中文文献与期刊收录</h1><p>以知网题录补全中文成果，按论文发表年核对核心期刊目录。</p></div></header>'+
      (scope.mode==="institution"?'<section class="panel"><p>当前是机构档案。请选定一位学者后补充其个人书目。</p><a href="#search">查找学者</a></section>':'<section class="panel"><h2>查找 '+esc(who||"当前学者")+' 的中文论文</h2>'+
      '<p>在知网高级检索中选择“作者”，可用“作者单位”缩小范围。在结果中勾选论文，导出 RefWorks 或 EndNote 后导入。</p><p>'+link(refs.cnki,"打开中国知网高级检索 ↗")+'</p>'+
      '<form data-cn-form="import"><label>这位学者发表中文论文时的署名<input name="alias" data-cn-alias maxlength="120" placeholder="例如 钟志豪" value="'+esc(cnName)+'"></label>'+
      '<label>知网题录文件<input name="bibfile" type="file" accept=".txt,.csv,.tsv,.ris,.enw,.ref"></label><label>或粘贴题录<textarea name="text" rows="3" placeholder="RT Journal Article，或带表头的 CSV"></textarea></label>'+
      '<div class="cn-actions"><button class="solid" type="submit">读取知网题录</button><button class="outline" type="button" data-cn-action="bib-template">下载论文表头</button></div></form>'+
      '<details><summary>在线补查中文 DOI 论文</summary><p>使用上方署名向 Crossref 查询，逐页筛出有相符署名、中文题名或中文语种的记录。这些记录单独标注 Crossref 来源。</p><button class="outline" type="button" data-cn-action="live">补查 Crossref</button><button class="outline" type="button" data-cn-action="more" hidden>继续读取</button><p data-cn-status="live" role="status"></p></details></section>'+
      '<section class="panel" data-cn-stage hidden></section>')+
      '<div data-cn-status="imports" role="status"></div><section class="panel"><div class="cn-head"><h2>收录与年度统计</h2><button class="outline" type="button" data-cn-action="export">导出当前清单</button></div><p>统计覆盖当前档案中有中文题名、中文语种、知网来源或匹配目录的论文。每篇可同时命中多个体系。</p>'+
      '<div class="cn-filters"><label>收录体系<select data-cn-filter="system"><option value="">全部</option>'+Object.entries(names).map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join("")+'<option value="unknown">待补目录</option></select></label>'+
      '<label>署名角色<select data-cn-filter="role"><option value="">全部署名</option><option value="first">一作含共一</option><option value="corresponding">通讯含共通</option><option value="pending">身份待核</option></select></label><label>发表年<select data-cn-filter="year"><option value="">全部年份</option></select></label></div><div data-cn-results></div></section>'+
      '<section class="panel"><details><summary>核心期刊目录与适用年份</summary><p>南核区分 CSSCI 来源与扩展版。北核指《中文核心期刊要目总览》。SSCI 是 Web of Science 的社会科学引文索引，适用于其收录期刊的各类语言。这里统计目录匹配，核对单篇 WoS 收录可查看该论文的 WoS 记录。</p><p>'+
      link(refs.cssci,"南京大学 CSSCI")+' · '+link(refs.pku,"北京大学图书馆")+' · '+link(refs.ssci,"Clarivate 期刊目录")+'</p><p>内置 11 条经核对的刊名，包括 CSSCI 来源及扩展版（2025–2026）、北核 2023 版和 SSCI 2025 年目录。后两项的内置示例仅匹配发表年 2025。可导入有权使用的目录。每行填写体系、具体版本、适用起止年份、刊名或 ISSN 与证据链接。北核适用年份请依单位的正式口径填写。</p><p data-cn-catalog></p>'+
      '<form data-cn-form="catalog"><label>期刊目录 CSV<input name="catfile" type="file" accept=".csv,.tsv,.txt" required></label><div class="cn-actions"><button class="outline" type="submit">导入目录</button><button class="outline" type="button" data-cn-action="cat-template">下载目录模板</button></div></form><p data-cn-status="catalog" role="status"></p></details></section></div>';
  }
  const roleMatch=(row,key)=>row.roles?.some(r=>key==="first"?r==="first"||r==="cofirst":r==="corresponding"||r==="cocorresponding");
  function mount(container,{scope={},onMerge}={}){
    const root=container.matches?.("[data-cn-index]")?container:container.querySelector("[data-cn-index]");if(!root)return;
    const $=s=>root.querySelector(s);
    let rows=[...(scope.records||[])],stage=[],offset=0,query="",controller=null;
    let page=0,stagePage=0;const pageSize=25;
    const stat=(key,s)=>{const e=$('[data-cn-status="'+key+'"]');if(e)e.textContent=s;};
    const filter=(key)=>$('[data-cn-filter="'+key+'"]').value;
    function filtered(){
      return rows.filter(r=>{if(r.excluded)return false;const flags=labels(r),idx=filter("system"),role=filter("role"),yr=filter("year");
        if(!chinese(r)&&!flags.length)return false;
        if(idx==="unknown"?flags.length:idx&&!flags.some(f=>f.system===idx))return false;
        if(yr&&String(r.year)!==yr)return false;
        if(role==="pending")return r.identityPending;
        return !role||(!r.identityPending&&roleMatch(r,role));
      });
    }
    function draw(){
      const sel=$('[data-cn-filter="year"]'),chosen=sel.value,years=[...new Set(rows.filter(r=>chinese(r)||labels(r).length).map(r=>r.year).filter(Boolean))].sort((a,b)=>b-a);
      sel.innerHTML='<option value="">全部年份</option>'+years.map(y=>'<option value="'+esc(y)+'">'+esc(y)+'</option>').join("");if(years.some(y=>String(y)===chosen))sel.value=chosen;
      const selected=filtered(),accepted=selected.filter(r=>!r.identityPending),annual=new Map();
      for(const r of accepted){const y=r.year||"年份待核",obj=annual.get(y)||{total:0,lead:0,corr:0};obj.total++;if(roleMatch(r,"first"))obj.lead++;if(roleMatch(r,"corresponding"))obj.corr++;annual.set(y,obj);}
      page=Math.min(page,Math.max(0,Math.ceil(selected.length/pageSize)-1));
      const list=selected.slice(page*pageSize,(page+1)*pageSize);
      const yearsHtml=[...annual].sort((a,b)=>(+b[0]||0)-(+a[0]||0)).map(([y,s])=>'<tr><th>'+esc(y)+'</th><td>'+s.total+'</td><td>'+s.lead+'</td><td>'+s.corr+'</td></tr>').join("");
      const totals=Object.fromEntries(Object.keys(names).map(k=>[k,0]));
      for(const r of accepted)for(const key of new Set(labels(r).map(f=>f.system)))totals[key]++;
      $('[data-cn-results]').innerHTML='<p class="cn-count"><strong>'+accepted.length+'</strong> 篇已确认归属 · '+(selected.length-accepted.length)+' 篇身份待核</p>'+
      (accepted.length?'<dl class="cn-index-totals">'+Object.entries(names).map(([k,name])=>'<div><dt>'+esc(name)+'</dt><dd>'+totals[k]+' 篇</dd></div>').join("")+'</dl>':'')+
      (yearsHtml?'<div class="cn-scroll"><table><thead><tr><th>发表年</th><th>已确认论文</th><th>一作含共一</th><th>通讯含共通</th></tr></thead><tbody>'+yearsHtml+'</tbody></table></div>':'')+
      (list.length?'<div class="cn-scroll"><table><thead><tr><th>论文</th><th>署名与来源</th><th>收录依据</th></tr></thead><tbody>'+list.map(r=>{
        const flags=labels(r);const role=[roleMatch(r,"first")?"一作含共一":"",roleMatch(r,"corresponding")?"通讯含共通":""].filter(Boolean).join(" / ");
        return '<tr><td>'+link(r.url,r.title)+'<small>'+esc([r.journal,r.year].filter(Boolean).join(" · "))+'</small></td><td>'+esc(r.identityPending?"身份待核":role||"其他署名或角色待核")+'<small>'+esc((r.sources||[r.source]).join(" · "))+'</small></td><td>'+ (flags.length?flags.map(f=>link(f.url,f.label+" · "+f.edition)).join("<br>"):"待补目录")+'</td></tr>';
      }).join("")+'</tbody></table></div>'+pager("page",page,selected.length):'<p class="cn-empty">没有符合当前筛选条件的论文。</p>');
      $('[data-cn-catalog]').textContent="已载入 "+seeds.length+" 条内置目录记录、"+custom.length+" 条本地目录记录。";
    }
    function pager(kind,n,len){if(len<=pageSize)return "";return '<div class="cn-actions"><button class="outline" type="button" data-cn-action="'+kind+'-prev" '+(n<=0?"disabled":"")+'>上一页</button><span>'+String(n+1)+' / '+Math.ceil(len/pageSize)+'</span><button class="outline" type="button" data-cn-action="'+kind+'-next" '+((n+1)*pageSize>=len?"disabled":"")+'>下一页</button></div>';}
    function drawStage(){
      const box=$("[data-cn-stage]");if(!box)return;box.hidden=!stage.length;if(box.hidden)return;
      box.innerHTML='<h2>待并入 '+esc(scope.name||"当前档案")+' 的题录</h2><p>共 '+stage.length+' 条。合并后可在论文清单中逐篇核定身份、共同一作与通讯署名。身份待核的论文单列。</p><div class="cn-scroll"><table><thead><tr><th>题名</th><th>作者</th><th>期刊及年份</th></tr></thead><tbody>'+
        stage.slice(stagePage*pageSize,(stagePage+1)*pageSize).map(r=>'<tr><td>'+link(r.url,r.title)+'</td><td>'+esc(r.importAuthorText)+'</td><td>'+esc([r.journal,r.year].filter(Boolean).join(" · "))+'</td></tr>').join("")+'</tbody></table></div>'+pager("stage",stagePage,stage.length)+'<div class="cn-actions"><button class="solid" data-cn-action="merge">去重并加入当前档案</button><button class="outline" data-cn-action="clear">清空待并入题录</button></div>';
    }
    const merge=(a,b)=>window.AtlasFederation.merge(a,b);
    async function live(more){
      if(controller)return;const alias=clean($("[data-cn-alias]").value);if(alias.length<2)throw Error("请先在上方填写这位学者的具体署名。");
      if(!more||query!==alias)offset=0;
      query=alias;const ctl=new AbortController();controller=ctl;const timer=setTimeout(()=>ctl.abort(),22000);
      stat("live","正在读取 Crossref 候选记录…");
      try{const d=await lookup(alias,offset,ctl.signal);if(!root.isConnected)return;
        offset+=d.scanned;stage=merge(stage,d.rows);stagePage=0;drawStage();$('[data-cn-action="more"]').hidden=!d.more;
        stat("live","该署名检索到目前已扫描 "+offset+" 条模糊命中。本批有 "+d.rows.length+" 条同时满足中文条件和本人姓名，身份待核。");
      }catch(e){stat("live",ctl.signal.aborted?"本次查询已中止或超时。可重试或通过知网导入。":e.message);}finally{clearTimeout(timer);if(ctl===controller)controller=null;}
    }
    root.addEventListener("change",e=>{if(e.target.dataset.cnFilter){page=0;draw();}});
    root.addEventListener("submit",async e=>{
      const f=e.target;if(!f.dataset.cnForm)return;e.preventDefault();
      const catalog=f.dataset.cnForm==="catalog", key=catalog?"catalog":"imports";
      try {
        if(catalog){const file=f.elements.catfile.files[0];if(!file)throw Error("请选择目录 CSV。");
          const incoming=catalogRows(await readFile(file));const next=[...new Map([...custom,...incoming].map(r=>[catID(r),r])).values()];
          localStorage.setItem(catalogKey,JSON.stringify(next));custom=next;
          stat(key,"本次载入 "+incoming.length+" 条版本化目录记录。");draw();return;
        }
        const file=f.elements.bibfile.files[0],text=file?await readFile(file):f.elements.text.value,parsed=parse(text,f.elements.alias.value);
        if(!parsed.length)throw Error("未读到有效题录。");stage=merge(stage,parsed);stagePage=0;drawStage();stat(key,"本批读取 "+parsed.length+" 条，已保留来源与署名顺序。");
      }catch(err){stat(key,err.message);}
    });
    root.addEventListener("click",async e=>{
      const action=e.target.closest("[data-cn-action]")?.dataset.cnAction;if(!action)return;
      try{
        if(action==="merge"){
          if(typeof onMerge!=="function")throw Error("当前工作区无法写入档案。");
          const count=stage.length;if(!count)return;
          await onMerge(stage.slice());rows=merge(rows,stage);stage=[];drawStage();draw();stat("imports","已提交 "+count+" 条候选，档案中的同篇论文按证据合并。");return;
        }
        if(action==="live"||action==="more"){await live(action==="more");return;}
        if(action==="clear"){stage=[];stagePage=0;drawStage();return;}
        if(action.startsWith("page-")){page+=action.endsWith("next")?1:-1;draw();return;}
        if(action.startsWith("stage-")){stagePage+=action.endsWith("next")?1:-1;drawStage();return;}
        if(action==="bib-template"){exportFile("知网题录表头.csv","题名,作者,期刊,年份,doi,来源链接,ISSN,机构,关键词,被引次数,引证查询日期,通讯作者,共同第一作者,署名证据链接,语种\r\n");return;}
        if(action==="cat-template"){exportFile("核心目录模板.csv",toCSV([["system","edition","from","to","journal","issn","url","source"],["CSSCI","2025–2026",2025,2026,"编辑学报","",cssciPDF,"南京大学中国社会科学研究评价中心目录，第 1 页"]]));return;}
        if(action==="export"){
          const data=filtered().map(r=>[r.title,r.journal,r.year,r.doi,(r.sources||[r.source]).join(" | "),r.identityPending?"待核":"已确认",roleMatch(r,"first")?"已标记":"",roleMatch(r,"corresponding")?"已标记":"",labels(r).map(f=>f.label+" "+f.edition).join(" | "),labels(r).map(f=>f.url).join(" | "),r.url]);
          exportFile("中文成果与期刊收录.csv",toCSV([["题名","期刊","发表年","DOI","书目来源","身份","一作含共一","通讯含共通","收录目录及版本","目录依据","论文链接"],...data]));
        }
      }catch(err){stat(action==="live"||action==="more"?"live":"imports",err.message);}
    });
    draw();return ()=>{controller?.abort();};
  }
  window.AtlasCN=Object.freeze({render,mount,parse,catalogRows,labels,lookup});
})();
