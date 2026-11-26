(() => {
  "use strict";
  const storageKey = "byline-atlas-report-history-1";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt = n => Number.isFinite(n) ? Number(n.toFixed(1)).toLocaleString("zh-CN") : "待补";
  const roleNames = {first:"首位",cofirst:"共一",corresponding:"通讯",cocorresponding:"共通"};
  const asOf = () => window.AtlasScorecardV4.reportingDay();
  function href(raw){
    try {const u=new URL(raw);return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : "";} catch {return "";}
  }
  function latest(records) {
    const bySource=new Map();
    for(const entry of records||[]) {
      if(!entry?.source||!Number.isSafeInteger(entry.count)||entry.count<0)continue;
      const old=bySource.get(entry.source);
      if(!old || (entry.observedAt||"") >= (old.observedAt||""))bySource.set(entry.source,entry);
    }
    return [...bySource.values()].sort((a,b)=>a.source.localeCompare(b.source));
  }
  function documentId(r){return String(r.doi||r.pmid||r.openAlexId||r.id||"").toLowerCase();}
  function identity(s){
    if(s.archiveId)return s.archiveId;
    if(s.kind==="case"&&s.mode==="author")return "curated:zhong-cardiff";
    if(s.kind==="sample")return "sample:"+s.mode;
    return s.candidate?.id ? [s.mode,s.candidate.provider||s.kind,s.candidate.id].join(":") : "";
  }
  function make(scope){
    const input=scope.records||[], rows=input.filter(r=>r.title&&!r.excluded&&!r.identityPending&&r.identityStatus!=="review");
    const docs=rows.map(r=>({id:documentId(r),title:r.title,year:r.year||"",journal:r.journal||"",roles:(r.roles||[]).map(k=>roleNames[k]).filter(Boolean),
      unknown:r.roleUnknown===true,citations:latest(r.citationEvidence),sources:r.sources?.length?r.sources:[r.source].filter(Boolean),url:href(r.url||r.evidenceUrl||(r.doi?"https://doi.org/"+r.doi:"")),index:window.AtlasCN?.labels(r).map(x=>[x.label,x.edition].filter(Boolean).join(" "))||[]}));
    return {at:asOf(),name:scope.displayName||scope.name,key:identity(scope),docs,span:scope.liveYear||"全部年份",pending:input.filter(r=>r.identityPending&&!r.excluded).length,excluded:input.filter(r=>r.excluded).length,sourceNote:scope.note||scope.source||"",score:window.AtlasScorecardV4.summary(input, asOf())};
  }
  function bibliography(data){
    if(!data.docs.length)return "<p>当前档案尚无已核实归属的论文。</p>";
    return '<div class="r4-overflow"><table><thead><tr><th>论文与出处</th><th>署名</th><th>引用量及取数日期</th><th>收录</th></tr></thead><tbody>'+data.docs.map(p=>'<tr><td><b>'+(p.url?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">'+esc(p.title)+'</a>':esc(p.title))+'</b><small>'+esc([p.year,p.journal].filter(Boolean).join(" · "))+'</small></td><td>'+esc(p.roles.join("、")||(p.unknown?"待核":"其他署名"))+'</td><td>'+ (p.citations.length?p.citations.map(c=>esc(c.source)+' '+fmt(c.count)+'<small>'+esc(c.observedAt||"取数日期未记录")+'</small>').join(""):"待补")+'</td><td>'+esc(p.sources.concat(p.index).join(" · ")||"待补")+'</td></tr>').join("")+'</tbody></table></div>';
  }
  function history(){
    try {const list=JSON.parse(localStorage.getItem(storageKey));return Array.isArray(list)?list.filter(s=>s&&Array.isArray(s.ids)):[];}catch{return [];}
  }
  function archive(data){
    return history().filter(s=>s.key===data.key&&s.span===data.span);
  }
  function changes(data,previous){
    if(!previous)return "";
    const ids=new Set(data.docs.map(p=>p.id).filter(Boolean)),before=new Set(previous.ids);
    let added=0,removed=0;
    for(const id of ids)if(!before.has(id))added++;
    for(const id of before)if(!ids.has(id))removed++;
    return '<p>与 '+esc(previous.at)+' 保存的同档案、同发表年份范围相比，新增计入 <b>'+added+'</b> 篇，移出 <b>'+removed+'</b> 篇。变动包括新收录和人工核查调整。</p>';
  }
  function capabilitySummary(scope) {
    const analysis=window.AtlasInsightsV5.analyze(scope.records,scope);
    const measures=[
      ["学术独立性（论文贡献）",analysis.indScore,analysis.ind],
      ["高分区主导发表率（中科院 2025 版）",analysis.pubScore,analysis.publication],
      ["资源整合（跨机构合作）",analysis.resourceScore,analysis.resources]
    ];
    const body=measures.map(([name,score,parts])=>'<tr><th scope="row">'+name+'</th><td>'+esc(score.text)+'</td><td>'+parts.map(p=>esc(p.label)+' · '+p.yes+' 篇符合，'+p.known+'/'+p.n+' 篇可判定').join('<br>')+'</td></tr>').join("");
    return '<section class="panel boxpad r4-capabilities"><h2>科研能力指标依据</h2><p>当前已归属成果 '+analysis.details.length+' 篇。指标使用固定权重；区间为缺失资料下的上下界。跨机构合作以作者单位署名为依据。</p><div class="r4-overflow"><table><thead><tr><th>指标</th><th>百分制</th><th>证据覆盖</th></tr></thead><tbody>'+body+'</tbody></table></div></section>';
  }
  function render(scope){
    if(scope.mode!=="author")return '<section class="panel boxpad"><h1>学者证据报告</h1><p>请先选择学者。机构报表可在年度认领页导出。</p><a href="#claims">机构年度报表</a></section>';
    const d=make(scope);
    return '<div class="r4-root"><header class="page-head"><div><h1>'+esc(d.name)+' · 科研成果报告</h1><p>生成日期 '+d.at+' · 发表年份 '+esc(d.span)+'</p></div><div class="buttonset r4-controls"><button class="solid" data-report="print">打印 / 保存 PDF</button><button class="outline" data-report="save" '+(!d.key?'disabled':'')+'>保存本次统计</button></div></header><section class="panel boxpad"><div class="r4-stats"><div><small>已核实论文</small><b>'+d.docs.length+' 篇</b></div><div><small>身份待核</small><b>'+d.pending+' 篇</b></div><div><small>固定指数 v'+esc(d.score.version)+'</small><b>'+fmt(d.score.score)+'</b></div></div><p>'+esc(d.score.reason||d.score.coverageText||"")+'</p><p>'+esc(d.sourceNote)+'</p><div data-r4-history>'+changes(d,archive(d)[0])+'</div><p data-r4-status aria-live="polite"></p></section>'+capabilitySummary(scope)+'<section class="panel boxpad r4-papers"><h2>逐篇证据</h2>'+bibliography(d)+'</section></div>';
  }
  function mount(container,scope){
    if(scope.mode!=="author")return;
    const root=container.querySelector(".r4-root");
    root.addEventListener("click",event=>{
      const btn=event.target.closest("[data-report]");if(!btn)return;
      if(btn.dataset.report==="print"){window.print();return;}
      const d=make(scope);if(!d.key)return;
      const prior=archive(d)[0],ids=[...new Set(d.docs.map(p=>p.id).filter(Boolean))].sort();
      const stamp={key:d.key,span:d.span,at:d.at,ids,score:d.score.score,version:d.score.version};
      const status=root.querySelector("[data-r4-status]");
      if(prior && JSON.stringify(prior)===JSON.stringify(stamp)){status.textContent="今天的相同统计已保存。";return;}
      try {localStorage.setItem(storageKey,JSON.stringify([stamp,...history()].slice(0,60)));root.querySelector("[data-r4-history]").innerHTML=changes(d,prior);status.textContent="已在本浏览器保存。下次打开可查看计入论文的变化。";}
      catch {status.textContent="当前浏览器无法保存快照，可通过打印保留本次报告。";}
    });
  }
  window.AtlasReportV4=Object.freeze({render,mount});
})();
