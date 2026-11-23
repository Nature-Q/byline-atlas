(() => {
  "use strict";
  const version = "1.0";
  const sourceOrder = ["Google Scholar","OpenAlex","CNKI","Europe PMC","Crossref"];
  const roleGroups = [["first","第一作者（含共一）"],["corresponding","通讯作者（含共通）"],["both","同时一作和通讯"],["either","一作或通讯（去重）"]];
  const views = new Map();
  let serial = 0;
  const array = v => Array.isArray(v) ? v : [];
  const text = v => typeof v === "string" ? v.trim() : "";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  function urlOf(v) {
    try { const u = new URL(v); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ""; }
    catch { return ""; }
  }
  function dayOf(v) {
    const s = v instanceof Date && Number.isFinite(+v) ? v.toISOString() : text(v);
    if (!/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(s)) return "";
    const d = new Date(s.slice(0,10)+"T00:00:00Z");
    if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==s.slice(0,10)) return "";
    const timestamp = new Date(s);
    return Number.isFinite(+timestamp) ? timestamp.toISOString().slice(0,10) : "";
  }
  function sourceName(v) {
    const s = text(v).normalize("NFKC");
    if (/^(?:Google\s*Scholar|谷歌学术|Google\s*学术)$/i.test(s)) return "Google Scholar";
    if (/^(?:CNKI|中国知网|知网)(?:（CNKI）)?$/i.test(s)) return "CNKI";
    return sourceOrder.find(k=>k.toLowerCase()===s.toLowerCase()) || s;
  }
  function publicationYear(v) {
    const s = String(v??"").trim();
    return /^\d{4}$/.test(s) && Number(s)>=1500 ? Number(s) : null;
  }
  function count(v) { return Number.isSafeInteger(v) && v>=0 ? v : null; }
  function roleOf(row,k) {
    const roles = array(row.roles);
    if (roles.includes(k) || roles.includes("co"+k)) return true;
    return row.roleUnknown===false && Array.isArray(row.roles) ? false : null;
  }
  function canonicalDOI(raw) {
    const s = text(raw).replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,"").toLowerCase();
    return /^10\.\d{4,9}\/\S+$/.test(s) ? s : "";
  }
  function citationObservations(row) {
    const evidence = array(row.citationEvidence).filter(e=>sourceName(e?.source) && count(e.count)!==null).map(e=>({...e,source:sourceName(e.source)}));
    const known = new Set(evidence.map(e=>e.source));
    for (const [key,value] of Object.entries(row.citationsBySource||{})) {
      const source = sourceName(key);
      if(source && !known.has(source) && count(value)!==null) { evidence.push({source,count:value}); known.add(source); }
    }
    const inferred = row.citationSource || (array(row.sources).length===1 ? row.sources[0] : sourceOrder.find(s=>s.toLowerCase()===text(row.source).toLowerCase()));
    const source = sourceName(inferred);
    if(source && !known.has(source) && count(row.citedByCount)!==null) evidence.push({source,count:row.citedByCount});
    return evidence;
  }
  function latest(events, asOf) {
    const bySource = new Map();
    for (const e of events) {
      const source = e.source, rawDate=text(e.observedAt), day=dayOf(rawDate);
      if ((rawDate && !day) || (day && day>asOf)) continue;
      const old=bySource.get(source);
      if (!old || day>old.day) bySource.set(source,{day,count:e.count,url:urlOf(e.url),conflict:false});
      else if(day===old.day) {
        if(e.count!==old.count)old.conflict=true;
        else if(!old.url)old.url=urlOf(e.url);
      }
    }
    return bySource;
  }
  function combineRole(rows,k) {
    const values=new Set(rows.map(r=>roleOf(r,k)).filter(v=>v!==null));
    return values.size===1 ? [...values][0] : null;
  }
  function reportingDay(now=new Date()) {
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const at=k=>parts.find(p=>p.type===k).value;
    return at("year")+"-"+at("month")+"-"+at("day");
  }
  function analyze(records, asOf=reportingDay()) {
    const date=dayOf(asOf);
    if(!date)throw Error("评分日期需为有效的 ISO 日期。");
    const year=Number(date.slice(0,4)), groups=new Map();
    let pending=0,excluded=0;
    for(const r of array(records)) {
      if(!r)continue;
      if(r.excluded){excluded++;continue;}
      if(r.identityPending || r.identityStatus==="review"){pending++;continue;}
      const doi=canonicalDOI(r.doi);
      const id=doi?"doi:"+doi:r.id?"id:"+r.id:Symbol();
      if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push(r);
    }
    const papers=[];
    const sources=new Set(["Google Scholar","OpenAlex"]);
    for(const duplicates of groups.values()) {
      const r=duplicates[0],years=new Set(duplicates.map(d=>publicationYear(d.year)).filter(Boolean)),y=years.size===1?[...years][0]:null;
      if(y && y>year)continue;
      const first=combineRole(duplicates,"first"), corresponding=combineRole(duplicates,"corresponding");
      const roles={first,corresponding,both:first===false||corresponding===false?false:first&&corresponding?true:null,
        either:first===true||corresponding===true?true:first===false&&corresponding===false?false:null};
      const citations=latest(duplicates.flatMap(citationObservations),date);
      for(const source of citations.keys())sources.add(source);
      papers.push({row:r,year:y,roles,citations});
    }
    const ordered=[...sourceOrder.filter(s=>sources.has(s)),...[...sources].filter(s=>!sourceOrder.includes(s)).sort()];
    const result={date,year,papers,sources:ordered,pending,excluded};
    result.fixed=fixedScore(result);
    return result;
  }
  function roleTotals(data, source) {
    return roleGroups.map(([key,label])=>{
      let assigned=0,known=0,sum=0,uncertain=0;
      for(const p of data.papers) {
        if(p.roles[key]===null){uncertain++;continue;}
        if(!p.roles[key])continue;
        assigned++;
        const e=p.citations.get(source);
        if(e && !e.conflict){known++;sum+=e.count;}
      }
      const structuralZero=Boolean(data.papers.length && !assigned && !uncertain);
      return {key,label,assigned,known,sum:known || structuralZero ? sum : null,uncertain};
    });
  }
  const componentNames=["第一作者占比","通讯作者占比","按论文年龄折算的被引表现","近五年发表活跃度"];
  const weights=Object.freeze([30,20,35,15]);
  function fixedScore(data) {
    const {papers,year,date}=data,from=year-4;
    const windowRows=papers.filter(p=>p.year>=from && p.year<=year);
    const unknownYear=papers.filter(p=>!p.year).length;
    const components=[];
    function part(i,known,total,frac,detail) {
      const ratio=total && known===total && !unknownYear ? frac : null;
      components.push({label:componentNames[i],weight:weights[i],known,total,value:ratio===null?null:ratio*weights[i],detail});
    }
    for (const [i,role] of ["first","corresponding"].entries()) {
      const known=windowRows.filter(p=>p.roles[role]!==null).length;
      const yes=windowRows.filter(p=>p.roles[role]===true).length;
      part(i,known,windowRows.length,yes/windowRows.length,yes+" 篇符合，"+known+"/"+windowRows.length+" 篇署名可判定");
    }
    const mature=windowRows.filter(p=>p.year<=year-2);
    const cutoff=new Date(date+"T00:00:00Z");cutoff.setUTCDate(cutoff.getUTCDate()-365);
    const minimum=cutoff.toISOString().slice(0,10);
    let n=0,impactSum=0;
    for(const p of mature) {
      const e=p.citations.get("OpenAlex");
      if(!e || e.conflict || !e.day || e.day<minimum || Number(e.day.slice(0,4))<=p.year)continue;
      const elapsed=Number(e.day.slice(0,4))-p.year;
      impactSum+=Math.min(1,Math.log1p(e.count/elapsed)/Math.log(11));
      n++;
    }
    part(2,n,mature.length,impactSum/mature.length,n+"/"+mature.length+" 篇较早发表的论文有近 365 天的 OpenAlex 引文快照"+(!mature.length?"，观察期尚不足":""));
    const active=new Set(windowRows.map(p=>p.year)).size;
    part(3,windowRows.length,windowRows.length,active/5,active+"/5 个日历年有发表");
    const missing=[];
    if(unknownYear)missing.push(unknownYear+" 篇年份待核");
    if(windowRows.length<3)missing.push("窗口内不足 3 篇已确认成果");
    for(const c of components.slice(0,2))if(c.known<c.total)missing.push(c.label+"有 "+(c.total-c.known)+" 篇待核");
    if(!mature.length)missing.push("尚无发表年份早于 "+(year-1)+" 年的窗口内论文");
    else if(n<mature.length)missing.push((mature.length-n)+" 篇缺少有效且足够新的 OpenAlex 引用数");
    const total=missing.length?null:components.reduce((s,c)=>s+c.value,0);
    return {score:total===null?null:Math.round(total*10)/10,version,year,from,referenceSource:"OpenAlex",sourceAsOf:date,
      coverageText:from+"–"+year+" 年 "+windowRows.length+" 篇，引文覆盖 "+n+"/"+mature.length+" 篇",reason:missing.join("。"),components};
  }
  const one=v=>v===null?"待补":Number(v).toFixed(1);
  function link(u,label) {
    const href=urlOf(u);
    return href?'<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':esc(label);
  }
  function fixedHTML(d) {
    const f=d.fixed;
    const parts=f.components.map(c=>'<tr><th scope="row">'+esc(c.label)+'</th><td>'+c.weight+'%</td><td>'+one(c.value)+'</td><td>'+esc(c.detail)+'</td></tr>').join("");
    return '<section class="panel sc4-panel"><div class="sc4-head"><div><h2>署名与引用指数</h2><p>试行版 '+version+' · 固定权重 · '+f.from+'–'+f.year+' 年</p></div><div class="sc4-result"><b>'+one(f.score)+'</b><span>/ 100</span></div></div>'+
      (f.reason?'<p class="sc4-note">总分待补。'+esc(f.reason)+'。</p>':'<p>按当前档案中已确认的成果计分。比较时应使用相同学科、职业阶段和书目范围。</p>')+
      '<div class="sc4-scroll"><table><thead><tr><th scope="col">维度</th><th scope="col">权重</th><th scope="col">得分</th><th scope="col">依据</th></tr></thead><tbody>'+parts+'</tbody></table></div>'+
      '<details class="sc4-detail"><summary>查看固定公式和适用范围</summary><p>令 F 为一作（含共一）比例，C 为通讯（含共通）比例，Y 为近五个日历年中有成果的年份数。总分 = 30F + 20C + 35I + 15Y/5。两个署名维度分别计分。</p><p>I 采用固定来源 OpenAlex。对窗口内发表年份不晚于 '+(f.year-2)+' 年的每篇论文，以取数年份减发表年份得到年差 t，以被引数 c 计算 min(1, ln(1+c/t)/ln(11))，再对这些论文取平均。每年 10 次是本版本设定的封顶值。快照须在计算日及之前 365 天内取得。同一来源同日计数冲突时待核。</p>'+
      '<p>窗口含当前年和此前四年，采用当前档案中确认归属的有年份成果，最低 3 篇。任一维度缺少完整证据或有成果年份待核，总分显示“待补”。权重、阈值和引文来源按版本固定。分值仅描述此书目，未按学科归一化，也未建立全体学者的名次。</p></details></section>';
  }
  function selectedSource(d) {
    return d.sources.find(s=>d.papers.some(p=>{const o=p.citations.get(s);return o && !o.conflict;}))||"Google Scholar";
  }
  function sourceTable(d,s) {
    const rows=roleTotals(d,s).map(r=>'<tr><th scope="row">'+r.label+'</th><td>'+r.assigned+'</td><td><b>'+(r.sum===null?"—":r.sum.toLocaleString("zh-CN"))+'</b></td><td>'+r.known+'/'+r.assigned+'</td><td>'+r.uncertain+'</td></tr>').join("");
    return '<div class="sc4-scroll"><table><caption>'+esc(s)+' · 按已确认的署名统计</caption><thead><tr><th scope="col">本人署名</th><th scope="col">论文数</th><th scope="col">已知被引次数之和</th><th scope="col">有计数 / 确认篇数</th><th scope="col">角色待核篇数</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function paperInfo(d,source,index) {
    const start=index*25,slice=d.papers.slice(start,start+25);
    const label=p=>p.roles.both?"一作及通讯":p.roles.first?"一作"+(p.roles.corresponding===null?"，通讯待核":""):p.roles.corresponding?"通讯"+(p.roles.first===null?"，一作待核":""):p.roles.either===null?"署名待核":"其他署名";
    let html='<ol class="sc4-papers" start="'+(start+1)+'">';
    for (const p of slice) {
      const e=p.citations.get(source);
      const obs=!e?"缺少计数":e.conflict?"同日计数冲突":(e.count+" 次 · "+(e.day||"取数日待补"));
      html+='<li><b>'+link(p.row.evidenceUrl||p.row.url,p.row.title||p.row.doi||"论文")+'</b><small>'+esc(p.year||"年份待核")+' · '+label(p)+' · '+link(e?.url,obs)+'</small></li>';
    }
    const pages=Math.max(1,Math.ceil(d.papers.length/25));
    return html+'</ol>'+(pages>1?'<div class="sc4-paging"><button type="button" class="outline" data-sc4-page="-1" '+(!index?'disabled':'')+'>上一页</button><span>'+(index+1)+' / '+pages+'</span><button type="button" class="outline" data-sc4-page="1" '+(index>=pages-1?'disabled':'')+'>下一页</button></div>':'');
  }
  function render(records,scope={}) {
    if(scope.mode==="institution")return "";
    const d=analyze(records),source=selectedSource(d),id=String(++serial);
    views.set(id,{d,source,index:0,subject:scope.name||"学者"});
    if(views.size>8)views.delete(views.keys().next().value);
    const options=d.sources.map(s=>'<option'+(s===source?' selected':'')+' value="'+esc(s)+'">'+esc(s)+'</option>').join("");
    const roles='<section class="panel sc4-panel"><div class="sc4-head"><div><h2>一作与通讯论文的被引次数</h2><p>档案内全部年份 · '+d.papers.length+' 篇已确认，'+d.pending+' 条身份待核</p></div><label>引文来源 <select data-sc4-source>'+options+'</select></label></div><div data-sc4-table>'+sourceTable(d,source)+'</div>'+
      '<p>每个来源独立统计。“一作或通讯”按篇去重。仅已知计数参与加总，横线表示缺少可用计数；点击逐篇明细可核对取数日期。</p><details class="sc4-detail" data-sc4-list><summary>逐篇核对引用记录</summary><div data-sc4-papers></div></details>'+
      '<div class="sc4-actions"><button class="outline" type="button" data-sc4-export="csv">导出当前来源逐篇 CSV</button><button class="outline" type="button" data-sc4-export="json">导出固定评分依据</button></div></section>';
    return '<div class="sc4-root" data-sc4-id="'+id+'">'+roles+fixedHTML(d)+'</div>';
  }
  function csvCell(v) {
    const s=String(v??"");
    return '"'+(/^[\s]*[=+\-@]/.test(s)?"'":"")+s.replace(/"/g,'""')+'"';
  }
  function exportBody(view,format) {
    const {d,source,subject}=view;
    if(format==="json")return JSON.stringify({学者:subject,计算日:d.date,指数:d.fixed,论文:d.papers.map(p=>({题名:p.row.title,年份:p.year,DOI:p.row.doi,署名:p.roles,各来源引用:Object.fromEntries(p.citations),署名依据:urlOf(p.row.evidenceUrl||p.row.url)}))},null,2);
    const rows=[["学者","引文来源","题名","DOI","年份","第一作者含共一","通讯作者含共通","同时一作及通讯","一作或通讯","该来源引用次数","取数日期","状态","引文出处","署名出处"]];
    const flag=v=>v===null?"待核":v?"是":"否";
    for(const p of d.papers) {
      const e=p.citations.get(source);
      rows.push([subject,source,p.row.title,p.row.doi,p.year,flag(p.roles.first),flag(p.roles.corresponding),flag(p.roles.both),flag(p.roles.either),
        e&&!e.conflict?e.count:null,e?.day,e?.conflict?"同日计数冲突":e?"已收录":"缺少计数",e?.url,urlOf(p.row.evidenceUrl||p.row.url)]);
    }
    return "\ufeff"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n");
  }
  if(typeof document!=="undefined"){
    const state=(el)=>views.get(el?.closest?.("[data-sc4-id]")?.dataset.sc4Id);
    document.addEventListener("change",e=>{
      if(!e.target.matches?.("[data-sc4-source]"))return;
      const v=state(e.target),root=e.target.closest("[data-sc4-id]"); if(!v)return;
      v.source=e.target.value;v.index=0;root.querySelector("[data-sc4-table]").innerHTML=sourceTable(v.d,v.source);
      if(root.querySelector("[data-sc4-list]").open)root.querySelector("[data-sc4-papers]").innerHTML=paperInfo(v.d,v.source,0);
    });
    document.addEventListener("toggle",e=>{
      if(!e.target.matches?.("[data-sc4-list]")||!e.target.open)return;
      const v=state(e.target);if(v)e.target.querySelector("[data-sc4-papers]").innerHTML=paperInfo(v.d,v.source,v.index);
    },true);
    document.addEventListener("click",e=>{
      const b=e.target.closest?.("[data-sc4-export],[data-sc4-page]"),v=state(b);
      if(!v)return;
      if(b.hasAttribute("data-sc4-page")){
        v.index=Math.min(Math.max(0,Math.ceil(v.d.papers.length/25)-1),Math.max(0,v.index+Number(b.dataset.sc4Page)));
        b.closest("[data-sc4-papers]").innerHTML=paperInfo(v.d,v.source,v.index);return;
      }
      const isCsv=b.dataset.sc4Export==="csv",ext=isCsv?"csv":"json",filename=v.subject.replace(/[\\/:*?"<>|\p{C}]/gu,"_").slice(0,60);
      const href=URL.createObjectURL(new Blob([exportBody(v,ext)],{type:isCsv?"text/csv;charset=utf-8":"application/json"}));
      const a=document.createElement("a");a.href=href;a.download=filename+"_"+(isCsv?v.source.replace(/[\\/:*?"<>|\p{C}]/gu,"_")+"_署名引文":"固定评分_v"+version)+"_"+v.d.date+"."+ext;
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
    });
  }
  const summary=(records,asOf)=>analyze(records,asOf).fixed;
  window.AtlasScorecardV4=Object.freeze({render,analyze,summary,roleTotals,reportingDay,version});
})();
