(() => {
  "use strict";
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function http(value) {
    try { const u = new URL(value); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : ""; } catch { return ""; }
  }
  const link = (url,label) => http(url) ? `<a href="${esc(http(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : esc(label);
  const date = () => new Date().toISOString().slice(0,10);
  const engine = () => window.AtlasFederation;
  const statusNames = {ok:"已读取",partial:"部分读取",error:"请求失败",unavailable:"当前不可用",imported:"已导入",manual:"等待补充"};
  let draft = null, query = "", unit = "", year = "", candidates = [], searching = false, loading = false, notice = "", error = false, run = 0;
  let filter = "all", page = 0, reviewRow = null, attachMode = false, proposed = null, latestMount = null;
  let liveReading = false;
  let scholarUrl = "", relayUrl = window.AtlasScholarConfig?.relayUrl || "", importText = "", scholarBusy = false, submittedName="", aiPrompt="";
  const directory = name => "https://scholar.google.com/citations?hl=zh-CN&view_op=search_authors&mauthors="+encodeURIComponent(name);
  const scholarAPI = () => window.AtlasScholarLive;
  const scholarTypes = ".bib,.bibtex,.csv,.txt,.html,.htm";
  function scholarId(value){try{return scholarAPI().profileId(value);}catch{return "";}}
  function boundScholar(d){return d?.scholarProfileId || scholarId(d?.scholarLive?.url) || "";}
  function emptyDraft(c,y) {
    return {kind:"federated",mode:"author",candidate:c,name:c.name,affiliation:c.affiliation || c.affiliationHint || "",liveYear:y,
      records:[],providers:[],scholarImports:[],scholarLive:null,source:"跨库检索",nextCursor:null,limited:false,loadedAt:date()};
  }
  function scopeFromDraft() {
    const records = draft.records, pending = records.filter(r=>!r.excluded && r.identityPending).length;
    const coverage = allCoverage();
    return {...draft,records:[...records],sourceCoverage:coverage,total:records.length,nextCursor:null,
      sourceHits:coverage.reduce((s,c)=>s+(Number(c.hits)||0),0),limited:!draft.providers.length || draft.providers.some(p=>p.failed||p.nextCursor) || coverage.some(c=>["partial","error","unavailable","manual"].includes(c.status)),
      note:`已归并 ${records.length} 条，身份待核 ${pending} 条。按当前已读取且确认归属的论文计算。`};
  }
  function allCoverage() {
    const rows = (draft?.providers || []).flatMap(p=>p.coverage.map(c=>({...c,target:p.candidate.name})));
    if (draft?.scholarImports?.length) rows.unshift({source:"Google Scholar · 导入",status:"imported",scanned:draft.scholarImports.reduce((s,i)=>s+i.count,0),message:draft.scholarImports.map(i=>i.name+(i.hasMore===true?"（该页仍可展开更多）":"")).join("、")+"。计数按文件内可见记录，可能只覆盖部分论文。"});
    if (draft?.scholarLive) {const s=draft.scholarLive;rows.unshift({source:"Google Scholar · 主页",status:s.nextStart!=null?"partial":"ok",scanned:s.count,more:s.nextStart!=null,message:s.url});}
    if(draft && !draft.scholarImports.length && !draft.scholarLive) rows.unshift({source:"Google Scholar",status:"manual",scanned:0,message:"可导入公开作者主页网页、BibTeX 或 CSV，或通过已配置的服务读取主页。"});
    return rows;
  }
  function render() {
    return `<section class="fs3" data-federated-search><header class="page-head"><div><h1>跨库学者检索</h1><p>从 Google Scholar 建立论文清单，再用其他来源核对署名、引用与单位。</p></div></header>
    <section class="fs3-panel fs4-primary"><h2>从 Google Scholar 开始</h2>
    <form class="fs4-start" data-fs-form="start"><label>作者主页或 Scholar ID<input name="profile" maxlength="600" autocomplete="off" placeholder="scholar.google.com/citations?user=…"></label>
    <label>学者姓名<input name="scholarName" maxlength="200" placeholder="姓名可用于查找主页"></label>
    <div class="fs4-paths"><button class="solid" type="submit">打开 Scholar 档案</button><a data-fs-dir href="${directory("")}" target="_blank" rel="noopener noreferrer">在 Scholar 查找作者 ↗</a></div>
    <label class="fs4-files">导入 Scholar 网页或书目（可多选）<input name="file" type="file" multiple accept="${scholarTypes}"></label></form>
    <p class="fs4-help">在公开作者主页点击「显示更多」直至所需论文全部展开，再用浏览器保存 HTML，能保留表中显示的逐篇被引次数。自己的主页也可导出 BibTeX 或 CSV。${link("https://scholar.google.com/intl/en-US/scholar/citations.html","Google 导出帮助")}</p></section>
    <section class="fs3-panel"><h2>检索其他学术来源</h2><form class="fs3-form" data-fs-form="find">
      <label>姓名或学术标识符<input name="person" autocomplete="off" required maxlength="220" placeholder="例如 Zhihao Zhong 或 ORCID" value="${esc(query)}"></label>
      <label>单位线索（选填）<input name="org" autocomplete="off" maxlength="200" placeholder="现任或曾任单位" value="${esc(unit)}"></label>
      <label>发表年份（选填）<input name="year" type="number" min="1500" max="2099" placeholder="全部年份" value="${esc(year)}"></label>
      <button class="solid" type="submit">查找学者</button></form>
      <div class="fs3-sources">OpenAlex · Europe PMC · Crossref · ORCID · DBLP</div></section>
      <details class="fs4-question"><summary>先记下想问 AI 的问题（选填）</summary><label>检索后想问什么<textarea name="aiPrompt" maxlength="1600" rows="2" placeholder="例如：哪几篇一作论文贡献了最多引用？">${esc(aiPrompt)}</textarea></label><p>问题暂存在当前页面，打开问答并确认发送后才会调用模型。</p></details><div data-fs-region="local"></div>
      <div data-fs-region="saved"></div><div data-fs-region="status" role="status" aria-live="polite"></div>
      <div data-fs-region="candidates"></div><div data-fs-region="result"></div></section>`;
  }
  function active(root){return latestMount===root && root.isConnected;}
  function tell(msg,bad=false){notice=msg;error=bad;}
  function candidateSection(){
    if (!candidates.length) return "";
    const providers={openalex:"OpenAlex",epmc:"Europe PMC",orcid:"ORCID",dblp:"DBLP",bibliographic:"署名检索"};
    const button=(c,i)=>`<button type="button" class="fs3-candidate" data-fs-candidate="${i}"><span><b>${esc(c.name)}</b><small>${esc(c.affiliation || "单位待核")}</small></span><span>${esc((c.matchSources||[c.provider]).map(s=>providers[s]||s).filter(Boolean).join(" · "))}<small>${esc([orcid(c),c.detail||c.id].filter(Boolean).join(" · "))}</small></span></button>`;
    return `<section class="fs3-panel"><h2>${attachMode?"选择同一人的另一份档案":"选择学者档案"}</h2><div class="fs3-candidates">${candidates.slice(0,8).map(button).join("")}</div>
      ${candidates.length>8?`<details><summary>其余 ${candidates.length-8} 位候选</summary><div class="fs3-candidates">${candidates.slice(8).map((c,i)=>button(c,i+8)).join("")}</div></details>`:""}
      ${proposed?`<form data-fs-form="attach" class="fs3-proof"><b>补充归属到 ${esc(draft.name)}</b><p>候选档案：${esc(proposed.name)} · ${esc(proposed.id || "")}。不同档案中缺少共同 ORCID 的新增论文将保留为身份待核。</p><label>同人依据或经历说明<input name="reason" required maxlength="400" placeholder="例如两份档案共同引用的院系主页"></label><button class="outline" type="submit">确认加入候选论文</button></form>`:""}
      </section>`;
  }
  function coverageView(){
    const coverage=allCoverage();
    if(!coverage.length) return "";
    return `<details class="fs3-cover" open><summary>来源覆盖范围</summary><div class="fs3-scroll"><table><thead><tr><th>来源</th><th>已读取</th><th>来源命中</th><th>状态与说明</th></tr></thead><tbody>${coverage.map(c=>`<tr><td>${esc(c.source)}${draft.providers.length>1 && c.target?`<small>${esc(c.target)}</small>`:""}</td><td>${esc(c.scanned??"—")}</td><td>${esc(c.hits??"—")}</td><td>${esc(statusNames[c.status]||c.status)}${c.message?`<small>${esc(c.message)}</small>`:""}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
  function recordStatus(r){return r.excluded?"已排除":r.identityPending?"待核":"已计入";}
  const fullName = name => String(name||"").normalize("NFKC").toLowerCase().replace(/[.,，]/g," ").replace(/\s+/g," ").trim();
  function batchCandidates(){
    const id=boundScholar(draft), name=fullName(draft.name);
    if(!id || !(name.split(" ").filter(s=>s.length>1).length>=2 || /^[\p{Script=Han}]{2,8}$/u.test(name)))return [];
    return draft.records.filter(row=>{
      if(!row.identityPending || row.excluded || row.review || row.identityReview || row.conflicts?.length)return false;
      const matching=(row.byline||[]).filter(p=>fullName(p.name)===name);
      return matching.length===1 && matching[0].isTarget && row.provenance?.some(p=>p.source==="Google Scholar" && String(p.id).startsWith(id+":"));
    });
  }
  function batchPanel(){
    const ready=batchCandidates(),undo=draft.records.some(r=>r.scholarBatchProof?.date && r.scholarBatchProof.date===r.review?.date);
    if(!ready.length && !undo)return "";
    return `<details class="fs3-cover"><summary>批量核对 Scholar 作者归属（${ready.length} 篇可复核）</summary>
      ${ready.length?`<form class="fs3-proof" data-fs-form="batch"><p>以下记录来自同一 Scholar 主页，作者列表中恰有一位与「${esc(draft.name)}」全名一致的作者。核对清单后，可一次计入本人的论文。</p><div class="fs4-batch"><ol>${ready.map(r=>"<li>"+link(r.url,r.title)+"</li>").join("")}</ol></div><label><input type="checkbox" required> 我已核对列出的 ${ready.length} 篇论文属于此人</label><button class="outline" type="submit">计入这 ${ready.length} 篇论文</button></form>`:""}
      ${undo?'<button type="button" class="fs3-inline" data-fs-action="undo-batch">撤回这些批量确认</button>':""}</details>`;
  }
  function rowsView(){
    const rows=draft.records.filter(r=>filter==="pending"?r.identityPending&&!r.excluded:filter==="confirmed"?!r.identityPending&&!r.excluded:filter==="excluded"?r.excluded:true);
    const size=12;page=Math.max(0,Math.min(page,Math.ceil(rows.length/size)-1));
    const items=rows.slice(page*size,(page+1)*size);
    return `<div class="fs3-rowhead"><h3>合并后的论文</h3><label>身份状态 <select data-fs-filter>${[["all","全部"],["confirmed","已计入"],["pending","待核"],["excluded","已排除"]].map(([key,label])=>`<option value="${key}" ${key===filter?"selected":""}>${label}</option>`).join("")}</select></label></div>
    ${items.length?`<div class="fs3-scroll"><table><thead><tr><th>题名与来源</th><th>年份</th><th>归属</th></tr></thead><tbody>${items.map(r=>{
      const idx=draft.records.indexOf(r), src=(r.sources||[]).join(" · ")||r.source||"";
      const links=(r.provenance||[]).map(p=>link(p.url,p.source)).join(" · ");
      return `<tr><td>${link(r.url,r.title)}<small>${links||esc(src)}</small>${r.conflicts?.length?`<small>跨库字段有差异，需对照来源</small>`:""}</td><td>${esc(r.year||"—")}</td><td><button class="fs3-inline" data-fs-review="${idx}">${recordStatus(r)}</button></td></tr>
      ${idx===reviewRow?`<tr><td colspan="3"><form class="fs3-proof" data-fs-form="review"><p>${esc(r.identityEvidence||r.evidence||"请对照原文署名、ORCID 或作者主页确认身份。")}</p><label>身份判定<select name="decision"><option value="yes">计入本人论文</option><option value="pending" ${r.identityPending?"selected":""}>保留待核</option><option value="no" ${r.excluded?"selected":""}>排除该论文</option></select></label><label>证据链接<input type="url" name="url" value="${esc(http(r.identityEvidenceUrl)||http(r.url))}" required></label><label>核查说明<input name="note" required maxlength="450" value="${esc(r.review?.note||"")}" placeholder="记录原文、主页或标识符匹配的依据"></label><button type="submit" class="outline">保存判定</button></form></td></tr>`:""}`;
    }).join("")}</tbody></table></div><div class="fs3-pager"><button class="outline" data-fs-action="prev" ${page===0?"disabled":""}>上一页</button><span>${page+1} / ${Math.ceil(rows.length/size)}</span><button class="outline" data-fs-action="next" ${(page+1)*size>=rows.length?"disabled":""}>下一页</button></div>`:"<p>此状态下没有论文。</p>"}`;
  }
  function scholarView(){
    const live=draft.scholarLive;
    const person=draft.candidate?.scholarPlaceholder?"":draft.name;
    const relay=window.AtlasScholarLive?`<details class="fs3-cover"><summary>在线读取公开主页</summary><form class="fs3-proof" data-fs-form="scholar"><label>Scholar 作者主页或 ID<input required name="scholar" value="${esc(scholarUrl)}"></label><label>Scholar 服务地址<input type="url" required name="relay" placeholder="http://127.0.0.1:8791/scholar" value="${esc(relayUrl)}"></label><label>本次最多读取页数<select name="pageLimit"><option value="1">1 页</option><option value="5">5 页</option><option value="20">20 页</option></select></label><p>每页最多 100 条。检测到末页会提前停止，实际请求的页数消耗服务配额。${link("https://github.com/Nature-Q/byline-atlas/tree/main/server/scholar-relay","配置服务")}</p><label><input type="checkbox" required> 已核对主页并同意本次在线读取</label><button type="submit" class="outline">${live && live.nextStart!=null?"读取下一批 Scholar 论文":"读取 Scholar 论文"}</button></form></details>`:"";
    const linked=boundScholar(draft);
    return `<details class="fs3-cover" data-fs-scholar open><summary>Google Scholar 论文与引用</summary><p>${linked?link(scholarAPI().canonicalProfile(linked),"打开已关联的 Scholar 主页"):link(directory(person),"在 Google Scholar 查找此人")} · 支持同时导入多份文件。合并匹配的记录后保留每个来源的引用数。</p>
    <form data-fs-form="import" class="fs3-proof"><label>已保存的 Scholar 主页或书目<input name="file" multiple type="file" accept="${scholarTypes}"></label><label>或粘贴 BibTeX / CSV<textarea rows="3" name="bib" maxlength="12000000" placeholder="@article{…}">${esc(importText)}</textarea></label><button type="submit" class="outline">合并书目到此人</button></form>${relay}</details>`;
  }
  function enrichmentView(){
    if(!engine()?.enrichDOIs || !draft.records.some(r=>(r.sources||[]).some(x=>/Google Scholar|CNKI|知网/.test(x))))return "";
    const attempted=draft.records.some(r=>r.importedLookup);
    return `<div class="fs4-enrich"><h3>补齐引用与作者署名</h3><p>将最多 20 篇导入论文的 DOI（缺少时使用题名和年份）发往 Crossref 和 OpenAlex，保留匹配来源。</p><button class="outline" data-fs-action="enrich">核对下一批书目</button> ${attempted?'<button class="fs3-inline" data-fs-action="enrich-retry">重新核对已尝试的记录</button>':""}</div>`;
  }
  function results(){
    if(!draft)return "";
    const included=draft.records.filter(r=>!r.excluded&&!r.identityPending).length;
    const pending=draft.records.filter(r=>!r.excluded&&r.identityPending).length;
    return `<section class="fs3-panel"><div class="fs3-rowhead"><div><small>当前学者</small><h2>${esc(draft.name)}</h2>${esc(draft.affiliation)}${draft.liveYear?" · "+esc(draft.liveYear)+" 年":""}</div><button class="solid" data-fs-action="open" ${draft.records.length?"":"disabled"}>查看学者画像</button></div>
    <div class="fs3-numbers"><div><strong>${draft.records.length}</strong><span>去重后记录</span></div><div><strong>${included}</strong><span>计入统计</span></div><div><strong>${pending}</strong><span>身份待核</span></div></div>
    ${profileLinks(draft.candidate)}${scholarView()}${coverageView()}<div class="fs3-actions">${draft.providers.map((p,i)=>p.nextCursor||p.failed||p.coverage.some(c=>c.status==="error")?`<button class="outline" data-fs-more="${i}" ${loading?"disabled":""}>${p.nextCursor?"继续读取下一批":"重新请求来源"}${draft.providers.length>1?" · "+esc(p.candidate.name):""}</button>`:"").join("")}<button class="outline" data-fs-action="alias" ${loading?"disabled":""}>补充同一人的其他署名或档案</button></div>
    ${enrichmentView()}${batchPanel()}${rowsView()}<div class="fs4-model"><button class="outline" data-fs-action="ask" ${!draft.records.length?"disabled":""}>用这份档案进行 AI 问答</button></div></section>`;
  }
  const storageKey="byline-atlas-federated-draft-v1";
  function storeDraft(){
    try {localStorage.setItem(storageKey,JSON.stringify(draft));}
    catch {tell(notice+" 当前浏览器存储空间不足，本次工作仍保留在此页面。");}
  }
  function restoreDraft(){
    try {
      const d=JSON.parse(localStorage.getItem(storageKey));
      if(d?.kind==="federated" && d.candidate && Array.isArray(d.records) && Array.isArray(d.providers) && Array.isArray(d.scholarImports)) draft=d;
    } catch {}
  }
  function syncScope(scope){
    if(scope?.kind!=="federated" || scope.mode!=="author" || !Array.isArray(scope.records))return false;
    if(!draft)restoreDraft();
    if(!draft || String(scope.liveYear||"")!==String(draft.liveYear||""))return false;
    const isSame=scope.archiveId && draft.archiveId ? scope.archiveId===draft.archiveId :
      Boolean(scope.candidate?.id && scope.candidate.id===draft.candidate?.id && scope.candidate.provider===draft.candidate.provider);
    if(!isSame)return false;
    draft.records=structuredClone(scope.records);
    if(scope.archiveId)draft.archiveId=scope.archiveId;
    storeDraft();return true;
  }
  function orcid(c){
    const ids=[c?.requestedOrcid,c?.orcid,...(c?.observedOrcids||[])].map(v=>String(v||"").match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i)?.[0]?.toUpperCase()).filter(Boolean);
    if(new Set(ids).size!==1)return "";
    return ids[0];
  }
  function profileLinks(c){
    const oa=String(c?.id||"").match(/(?:^|\/)(A\d+)$/)?.[1], oid=orcid(c), links=[];
    if(oa)links.push(link("https://openalex.org/"+oa,"OpenAlex 作者档案"));
    if(c?.provider==="dblp" && c.profileUrl)links.push(link(c.profileUrl,"DBLP 作者档案"));
    if(oid)links.push(link("https://orcid.org/"+oid,"ORCID "+oid));
    return links.length?`<p>${links.join(" · ")}</p>`:"";
  }
  function reviewOnly(rows,reason) {
    return rows.map(r=>({...r,identityPending:true,identityStatus:"review",identityBasis:"secondary-profile",identityEvidence:reason}));
  }
  function mount(container,{onOpen,scope}={}){
    const root=container.matches?.("[data-federated-search]")?container:container.querySelector("[data-federated-search]");
    if(!root || latestMount===root) return;
    latestMount=root;run++;searching=false;loading=false;scholarBusy=false;
    if(!draft) restoreDraft();
    const part=k=>root.querySelector('[data-fs-region="'+k+'"]');
    const find=root.querySelector('[data-fs-form="find"]');
    const start=root.querySelector('[data-fs-form="start"]');
    const dir=root.querySelector('[data-fs-dir]');
    function localOptions(){
      const name=find.elements.person.value.trim().normalize("NFKC");
      const normalized=name.toLowerCase().replace(/[\s,，]+/g," ").trim();
      dir.href=directory(start.elements.scholarName.value.trim()||name);
      const org=find.elements.org.value.trim().normalize("NFKC").toLowerCase();
      const isCase=["zhihao zhong","zhong zhihao","钟志豪","鍾志豪"].includes(normalized)
        && (!org || /cardiff|卡迪夫|加的夫|harbin institute of technology|哈尔滨工业大学|哈爾濱工業大學|哈工大|\bhit(?:sz)?\b/i.test(org));
      const named=Boolean(name && submittedName===name && /\p{L}/u.test(name) && !/[/:@<>\d]/u.test(name));
      part("local").innerHTML=attachMode?"":(isCase?`<section class="fs3-local"><div><h2>Zhihao Zhong · 钟志豪</h2><p>经原文核查的 Cardiff 作者目录样本，含 4 篇期刊论文。另附 2026 年会议列名哈工大（深圳）的单位证据。画像覆盖样本全部年份。</p></div><div><a href="#zhong">查看已核查画像 ↗</a><a href="./zhong.html">查看逐篇署名依据</a></div></section>`:"")+(named && !loading && !scholarBusy?`<button class="fs3-inline fs3-resume" data-fs-action="manual">以「${esc(name)}」建立空白档案，直接导入书目</button>`:"");
    }
    function draw(){
      if(!active(root)) return;
      localOptions();
      const scholarOpen=root.querySelector("[data-fs-scholar]")?.open;
      const relayOpen=root.querySelector("[data-fs-scholar] details")?.open;
      const eligible=scope?.mode==="author" && Array.isArray(scope.records) && scope.records.length;
      part("saved").innerHTML=eligible && (!draft || draft.candidate?.id!==scope.candidate?.id || scope.kind!=="federated")?`<button class="fs3-inline fs3-resume" data-fs-action="saved">继续补充 ${esc(scope.name)} 的当前档案</button>`:"";
      const busy=searching?"正在匹配学者身份…":loading?"正在向论文来源请求这一批记录…":scholarBusy?"正在读取 Scholar 主页…":"";
      const cancel=attachMode?` <button class="fs3-inline" data-fs-action="cancelalias">取消补充档案</button>`:"";
      part("status").innerHTML=(busy||notice||cancel)?`<div class="fs3-status${error?" fs3-error":""}">${esc([busy,notice].filter(Boolean).join(" "))}${cancel}${liveReading?' <button type="button" class="fs3-inline" data-fs-action="stopScholar">停止继续读取</button>':""}</div>`:"";
      part("candidates").innerHTML=candidateSection();
      part("result").innerHTML=results();
      if(scholarOpen!=null && root.querySelector("[data-fs-scholar]")) root.querySelector("[data-fs-scholar]").open=scholarOpen;
      if(relayOpen && root.querySelector("[data-fs-scholar] details")) root.querySelector("[data-fs-scholar] details").open=true;
      const submit=find.querySelector('[type="submit"]');submit.disabled=searching||loading||scholarBusy;
      start.querySelector('[type="submit"]').disabled=loading||scholarBusy;
      find.elements.year.disabled=attachMode;
    }
    function post(msg,bad=false){tell(msg,bad);draw();}
    function clearSelection(c,yr){
      draft=emptyDraft(c,yr);importText="";scholarUrl="";filter="all";page=0;reviewRow=null;
      attachMode=false;proposed=null;candidates=[];
    }
    async function lookup(form){
      query=form.elements.person.value.trim();unit=form.elements.org.value.trim();year=form.elements.year.value;
      if(!query) return post("请输入学者姓名或 ORCID。",true);
      if(!attachMode && (/scholar\.google\./i.test(query)||scholarId(query)&&/[_\d-]/.test(query))) return startScholar(form,true);
      const attempt=++run;submittedName=query.normalize("NFKC");searching=true;proposed=null;candidates=[];post("");
      try {
        const list=await engine().search("author",query,unit);
        if(attempt!==run || !active(root)) return;
        candidates=list;
        tell(list.length?"请结合单位、ORCID 或原始档案核对候选。":"未找到匹配档案。可尝试英文署名、曾任单位或 ORCID。");
      } catch(e){if(attempt===run)tell("身份检索失败。"+(e.message||"请稍后重试。"),true);}
      finally {if(attempt===run){searching=false;draw();}}
    }
    async function readProvider(index) {
      const d=draft, provider=d.providers[index], cursor=provider.nextCursor, attempt=++run;
      loading=true;reviewRow=null;post("");
      try {
        const bundle=await engine().load("author",provider.candidate,{year:d.liveYear||"",cursor:cursor||null});
        if(attempt!==run || d!==draft || !active(root)) return;
        const raw=Array.isArray(bundle.records)?bundle.records:[];
        const rows=provider.reviewNew?reviewOnly(raw,"补充档案来自 "+provider.candidate.name+"。同人线索："+provider.reason):raw;
        d.records=engine().merge(d.records,rows);
        provider.coverage=bundle.coverage||[];provider.failed=false;
        const next=bundle.nextCursor||null;
        provider.nextCursor=cursor && JSON.stringify(cursor)===JSON.stringify(next)?null:next;
        const incomplete=provider.coverage.some(c=>c.status==="error"||c.status==="partial"||c.status==="unavailable");
        tell(`本批返回 ${rows.length} 条。当前去重后 ${d.records.length} 条。${incomplete?"部分来源仍有缺口，详见来源覆盖范围。":""}`);storeDraft();
      } catch(e){
        if(attempt!==run||d!==draft)return;
        provider.failed=true;tell("这一批未能读取。"+(e.message||"请稍后重试。"),true);storeDraft();
      } finally {if(attempt===run){loading=false;draw();}}
    }
    function selectCandidate(c,reason=""){
      if(!c)return;
      if(attachMode && draft) {
        if(draft.providers.some(p=>p.candidate.id===c.id && p.candidate.provider===c.provider))
          return post("该档案已在当前来源列表中。");
        if(orcid(c) && [draft.candidate,...draft.providers.map(p=>p.candidate)].some(p=>orcid(p) && orcid(p)!==orcid(c)))
          return post("两份档案的 ORCID 不同，请另选候选档案。",true);
        if(!reason){proposed=c;post("请记录关联这两个档案的证据。");return;}
        const reviewNew=!(orcid(c) && orcid(c)===orcid(draft.candidate));
        draft.providers.push({candidate:c,reason,reviewNew,nextCursor:null,coverage:[]});
        candidates=[];attachMode=false;proposed=null;
      } else {
        clearSelection(c,year);
        draft.providers.push({candidate:c,nextCursor:null,coverage:[]});
      }
      readProvider(draft.providers.length-1);
    }
    function readInputs(form,pasted=""){
      const files=Array.from(form.elements.file?.files||[]);
      if(files.length>40||files.reduce((n,f)=>n+f.size,0)>36000000||files.some(f=>f.size>12000000)||pasted.length>12000000)throw Error("每次最多导入 40 份文件，总计 36 MB，每份限 12 MB。");
      return [...files.map(f=>({name:f.name,file:f})),...(pasted?[{name:"粘贴的书目",text:pasted}]:[])];
    }
    async function parseInputs(inputs,expectedId){
      const batches=[];
      let knownId=expectedId;
      for(const input of inputs){
        const value=input.file?await input.file.text():input.text;
        if(/\.html?$/i.test(input.name)||/^\s*(?:<!doctype html|<html)\b/i.test(value)){
          const stamp=input.file?.lastModified;
          const observedAt=Number.isFinite(stamp) && stamp>0 && stamp<=Date.now()?new Date(stamp).toISOString().slice(0,10):"";
          const result=scholarAPI().parseProfileHtml(value,knownId,observedAt);
          knownId=result.authorId;batches.push({...result,label:input.name});
        } else {
          const records=engine().importScholar(value);
          if(!records.length)throw Error(input.name+" 未包含可读取的 Scholar 论文。");
          batches.push({records,label:input.name});
        }
      }
      return batches;
    }
    function applyInputs(d,batches){
      const before=d.records.length;let seen=0,eligible=0;
      for(const batch of batches){
        if(batch.authorId){
          d.scholarProfileId=batch.authorId;scholarUrl=scholarAPI().canonicalProfile(batch.authorId);
          if(d.candidate.scholarPlaceholder){d.name=batch.name;d.candidate.name=batch.name;d.candidate.scholarPlaceholder=false;}
          if(!d.affiliation && batch.affiliation)d.affiliation=batch.affiliation;
        }
        let rows=batch.records.filter(r=>!d.liveYear||String(r.year)===String(d.liveYear));
        rows=rows.map(r=>engine().matchScholarByline?engine().matchScholarByline(r,d.candidate):r);
        d.records=engine().merge(d.records,rows);
        d.scholarImports.push({name:batch.label,count:batch.records.length,date:date(),hasMore:batch.hasMore});
        seen+=batch.records.length;eligible+=rows.length;
      }
      return `读入 ${seen} 条，其中 ${eligible} 条符合年份范围。合并后新增 ${d.records.length-before} 篇，当前共 ${d.records.length} 篇。`;
    }
    function createScholarDraft(id,name,yr,org){
      const scholarPlaceholder=!name;
      const label=name||("Scholar · "+id);
      clearSelection({id:id?"scholar/"+id:"local/"+crypto.randomUUID(),provider:id?"scholar":"manual",name:label,affiliationHint:org||"",scholarPlaceholder},yr);
      draft.source="Google Scholar 书目档案";draft.scholarProfileId=id;
      scholarUrl=id?scholarAPI().canonicalProfile(id):"";
    }
    async function startScholar(form,fromFind=false){
      const raw=(fromFind?form.elements.person:form.elements.profile).value.trim();
      const name=fromFind?"":form.elements.scholarName.value.trim();
      const id=raw?scholarAPI().profileId(raw):"";
      const files=fromFind?[]:readInputs(form);
      if(!id&&!name&&!files.length)return post("请填写 Scholar 主页、学者姓名，或导入已保存的个人主页。",true);
      const attempt=++run;
      scholarBusy=true;tell("正在打开 Scholar 档案。");draw();
      try{
        const list=await parseInputs(files,id);
        if(attempt!==run||!active(root))return;
        const owner=list.find(item=>item.authorId), ownerId=id||owner?.authorId||"", label=name||owner?.name||"";
        if(!ownerId&&!label)throw Error("BibTeX 或 CSV 通常不含主页标识，请同时填写该学者的姓名或主页。");
        const reuse=ownerId && draft && boundScholar(draft)===ownerId && String(draft.liveYear||"")===String(fromFind?form.elements.year.value:"");
        if(!reuse)createScholarDraft(ownerId,label,fromFind?form.elements.year.value:"",fromFind?form.elements.org.value.trim():"");
        if(reuse && label && draft.candidate.scholarPlaceholder){draft.name=label;draft.candidate.name=label;draft.candidate.scholarPlaceholder=false;}
        tell(list.length?applyInputs(draft,list):"已打开 Scholar 档案。可导入主页网页或书目，也可通过服务在线读取。");
        storeDraft();
        if(!fromFind && form.elements.file)form.elements.file.value="";
      }catch(e){if(attempt===run)tell(e.message,true);}
      finally{if(attempt===run){scholarBusy=false;draw();root.querySelector('[data-fs-region="status"]')?.scrollIntoView({block:"nearest"});}}
    }
    async function importBib(form){
      const d=draft, pasted=form.elements.bib.value.trim(), attempt=++run;
      const inputs=readInputs(form,pasted);
      if(!inputs.length)return post("请先选择文件或粘贴书目。",true);
      scholarBusy=true;
      try {
        const batches=await parseInputs(inputs,boundScholar(d));
        if(attempt!==run || !active(root)||d!==draft)return;
        tell(applyInputs(d,batches));importText="";storeDraft();
      }catch(e){if(attempt===run)tell("书目读取失败。"+e.message,true);}
      finally{if(attempt===run){scholarBusy=false;draw();}}
    }
    async function readScholar(form){
      const d=draft, profile=form.elements.scholar.value.trim(), relay=form.elements.relay.value.trim(), id=scholarAPI().profileId(profile);
      const expected=boundScholar(d);
      if(expected && expected!==id)return post("当前档案关联了另一个 Scholar 主页，请另开档案。",true);
      if(!relay)return post("请填写 Scholar 服务地址，或从上方导入保存的主页。",true);
      const previous=d.scholarLive;
      if(previous && previous.nextStart==null)return post("已读到这个 Scholar 主页的最后一页。");
      const maxPages=Number(form.elements.pageLimit?.value)||1;
      if(![1,5,20].includes(maxPages))return post("请选择有效的读取页数。",true);
      scholarUrl=scholarAPI().canonicalProfile(id);relayUrl=relay;scholarBusy=true;liveReading=true;post("");
      const attempt=++run;
      try{
        let offset=previous?.nextStart??0, added=0, received=0;
        for(let pageNo=1;pageNo<=maxPages;pageNo++){
        const result=await scholarAPI().fetchPage(profile,relay,offset);
        if(attempt!==run||d!==draft||!active(root))return;
        if(d.candidate.scholarPlaceholder && result.name){d.name=result.name;d.candidate.name=result.name;d.candidate.scholarPlaceholder=false;}
        if(!d.affiliation&&result.affiliation)d.affiliation=result.affiliation;
        const raw=result.records, rows=raw.filter(r=>!d.liveYear||String(r.year)===String(d.liveYear)).map(r=>engine().matchScholarByline?engine().matchScholarByline(r,d.candidate):r);
        d.records=engine().merge(d.records,rows);d.scholarProfileId=id;
        d.scholarLive={url:scholarUrl,nextStart:result.nextStart??null,count:(d.scholarLive?.count||0)+raw.length};
        added+=rows.length;received+=raw.length;offset=result.nextStart;
        tell(`本次已读取 ${pageNo} 页，返回 ${received} 条，${added} 条符合年份范围。${offset==null?"服务已返回末页。":""}`);storeDraft();draw();
        if(offset==null || pageNo===maxPages)break;
        await new Promise(resolve=>setTimeout(resolve,1600));
        if(attempt!==run||d!==draft||!active(root))return;
        }
      }catch(e){if(attempt===run)tell("Scholar 请求失败。此前成功读取的页已保留。"+(e.message||"请检查服务地址，或导入保存的主页。"),true);}
      finally{if(attempt===run){scholarBusy=false;liveReading=false;draw();}}
    }
    async function enrich(retry){
      const d=draft, attempt=++run;
      loading=true;post("正在用 DOI 或题名、年份核对 Crossref 和 OpenAlex 记录。");
      try{
        const result=await engine().enrichDOIs(d.records,d.candidate,{limit:20,retry});
        if(attempt!==run||d!==draft||!active(root))return;
        d.records=result.records;
        tell(`本批核对 ${result.lookedUp} 篇，补齐 ${result.matched} 篇，尚有 ${result.remaining??0} 篇待核对。`+(result.errors?.length?" 部分来源返回错误。":""));
        storeDraft();
      }catch(e){if(attempt===run)tell("元数据核对失败。"+e.message,true);}
      finally{if(attempt===run){loading=false;draw();}}
    }
    function saveReview(form){
      const r=draft.records[reviewRow], url=http(form.elements.url.value), note=form.elements.note.value.trim(), decision=form.elements.decision.value;
      if(!r||!url||!note)return post("请补充可打开的证据链接和核查说明。",true);
      r.excluded=decision==="no";r.identityPending=decision==="pending";r.identityStatus=r.identityPending?"review":"supported";
      r.identityReview=true;r.identityBasis="manual";r.identityEvidence=note;r.identityEvidenceUrl=url;
      r.review={note,url,date:new Date().toISOString(),identityOnly:true};reviewRow=null;tell("归属判定已更新。");storeDraft();draw();
    }
    function applyBatch(undo=false){
      const keys=["identityPending","identityStatus","identityBasis","identityEvidence","identityEvidenceUrl","identityReview","review"];
      let changed=0;
      if(undo){
        for(const row of draft.records){
          const proof=row.scholarBatchProof;
          if(!proof || proof.date!==row.review?.date)continue;
          for(const key of keys)delete row[key];
          Object.assign(row,proof.before);delete row.scholarBatchProof;changed++;
        }
      }else{
        const stamp=new Date().toISOString(), url=scholarAPI().canonicalProfile(boundScholar(draft)),note="用户核对 Scholar 主页所列清单与逐篇唯一的完整姓名后批量计入。";
        for(const row of batchCandidates()){
          const before=Object.fromEntries(keys.filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
          Object.assign(row,{scholarBatchProof:{before,date:stamp},identityPending:false,identityStatus:"supported",identityBasis:"manual",identityReview:true,identityEvidence:note,identityEvidenceUrl:url,review:{date:stamp,url,note,identityOnly:true}});changed++;
        }
      }
      tell((undo?"已撤回 ":"已确认 ")+changed+" 篇论文的归属。");storeDraft();draw();
    }
    function useScope(){
      if(scope?.mode!=="author"||!Array.isArray(scope.records))return;
      const copy=structuredClone(scope), candidate=copy.candidate||{id:copy.name,name:copy.name,affiliation:copy.affiliation};
      clearSelection(candidate,copy.liveYear||"");
      if(copy.kind==="federated" && Array.isArray(copy.providers)) draft={...draft,...copy};
      else {
        draft.name=copy.name;draft.affiliation=copy.affiliation||"";draft.records=copy.records;
        draft.providers.push({candidate,coverage:[{source:copy.source||"已有档案",status:"imported",scanned:copy.records.length,message:copy.note||"已有档案记录"}],nextCursor:null});
      }
      scholarUrl=boundScholar(draft)?scholarAPI().canonicalProfile(boundScholar(draft)):"";tell("已打开现有档案，可补充书目或其他署名。");storeDraft();draw();
    }
    root.addEventListener("input",e=>{
      if(e.target.name==="scholarName"){dir.href=directory(e.target.value.trim());return;}
      if(e.target.name==="aiPrompt"){aiPrompt=e.target.value;return;}
      if(find.contains(e.target)){
        if(searching){run++;searching=false;}
        if(candidates.length||proposed){candidates=[];proposed=null;}
        if(e.target.name==="person"){query=e.target.value;submittedName="";}
        if(e.target.name==="org")unit=e.target.value;
        if(e.target.name==="year")year=e.target.value;
        tell("");draw();return;
      }
      if(e.target.name==="bib")importText=e.target.value;
      if(e.target.name==="scholar")scholarUrl=e.target.value;
      if(e.target.name==="relay")relayUrl=e.target.value;
    });
    root.addEventListener("change",e=>{
      if(!e.target.matches("[data-fs-filter]"))return;
      filter=e.target.value;page=0;reviewRow=null;draw();
    });
    root.addEventListener("submit",async e=>{
      const form=e.target.closest("[data-fs-form]");if(!form)return;
      e.preventDefault();
      if(loading||scholarBusy||(searching && form.dataset.fsForm!=="start"))return;
      try {
      switch(form.dataset.fsForm){
        case "start":if(searching){run++;searching=false;}return await startScholar(form);
        case "find":return await lookup(form);
        case "attach":{const reason=form.elements.reason.value.trim();if(reason)return selectCandidate(proposed,reason);return post("请填写两份档案的同人依据。",true);}
        case "import":return await importBib(form);
        case "review":return saveReview(form);
        case "batch":return applyBatch();
        case "scholar":return await readScholar(form);
      }
      }catch(e){post(e.message||"请核对输入后重试。",true);}
    });
    root.addEventListener("click",e=>{
      const el=e.target.closest("button");
      if(el?.dataset.fsAction==="stopScholar"&&liveReading){run++;scholarBusy=false;liveReading=false;return post("已停止继续读取，已合并的页保留在当前档案。");}
      if(el?.dataset.fsAction==="manual" && !attachMode && !loading && !scholarBusy){
        const name=find.elements.person.value.trim().normalize("NFKC");
        if(!name||name!==submittedName)return;
        ++run;searching=false;
        clearSelection({id:"local/"+crypto.randomUUID(),provider:"manual",name,affiliationHint:find.elements.org.value.trim()},find.elements.year.value);
        draft.source="用户命名的本地档案";
        submittedName="";tell("已建立本地空白档案。导入的书目均待逐篇核实归属。");storeDraft();draw();
        const section=root.querySelector("[data-fs-scholar]");if(section){section.open=true;section.scrollIntoView({block:"nearest"});}
        return;
      }
      if(!el||loading||searching||scholarBusy||el.disabled)return;
      if(el.hasAttribute("data-fs-candidate"))return selectCandidate(candidates[Number(el.dataset.fsCandidate)]);
      if(el.hasAttribute("data-fs-more"))return readProvider(Number(el.dataset.fsMore));
      if(el.hasAttribute("data-fs-review")){const idx=Number(el.dataset.fsReview);reviewRow=idx===reviewRow?null:idx;draw();return;}
      switch(el.dataset.fsAction) {
        case "saved":return useScope();
        case "open":if(draft && onOpen){window.AtlasAuthorID?.assign(draft);storeDraft();onOpen(structuredClone(scopeFromDraft()));}return;
        case "ask":if(draft && onOpen){window.AtlasAuthorID?.assign(draft);storeDraft();if(aiPrompt.trim())window.AtlasAIV3?.setDraft?.(aiPrompt.trim());onOpen(structuredClone(scopeFromDraft()),"ai");}return;
        case "enrich":return enrich(false);
        case "enrich-retry":return enrich(true);
        case "undo-batch":return applyBatch(true);
        case "alias":
          attachMode=true;proposed=null;candidates=[];find.elements.person.value=draft.name;
          find.elements.org.value="";find.elements.year.value=draft.liveYear||"";
          post("搜索此人的其他署名或历年单位，核对后可加入当前档案。");find.elements.person.focus();return;
        case "cancelalias":attachMode=false;proposed=null;candidates=[];return post("");
        case "prev":page--;reviewRow=null;draw();return;
        case "next":page++;reviewRow=null;draw();return;
      }
    });
    if(boundScholar(draft) && !scholarUrl)scholarUrl=scholarAPI().canonicalProfile(boundScholar(draft));
    draw();
    return ()=>{if(latestMount===root){latestMount=null;run++;searching=false;loading=false;scholarBusy=false;liveReading=false;}};
  }
  window.AtlasSearchV3={render,mount,syncScope};
})();
