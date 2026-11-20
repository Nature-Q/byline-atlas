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
  let scholarUrl = "", relayUrl = "", importText = "", scholarBusy = false, submittedName="";
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
    if (draft?.scholarImports?.length) rows.push({source:"Google Scholar · 书目",status:"imported",scanned:draft.scholarImports.reduce((s,i)=>s+i.count,0),message:draft.scholarImports.map(i=>i.name).join("、")});
    if (draft?.scholarLive) {const s=draft.scholarLive;rows.push({source:"Google Scholar · 主页",status:s.nextStart!=null?"partial":"ok",scanned:s.count,more:s.nextStart!=null,message:s.url});}
    if(draft && !draft.scholarImports.length && !draft.scholarLive) rows.push({source:"Google Scholar",status:"manual",scanned:0,message:"可从下方导入作者书目或通过自己的代理读取主页。"});
    return rows;
  }
  function render() {
    return `<section class="fs3" data-federated-search><header class="page-head"><div><h1>跨库学者检索</h1><p>输入学者英文署名或 ORCID，核对身份后汇总论文与历年署名单位。</p></div></header>
    <section class="fs3-panel"><form class="fs3-form" data-fs-form="find">
      <label>姓名或学术标识符<input name="person" autocomplete="off" required maxlength="220" placeholder="例如 Zhihao Zhong 或 ORCID" value="${esc(query)}"></label>
      <label>单位线索（选填）<input name="org" autocomplete="off" maxlength="200" placeholder="现任或曾任单位" value="${esc(unit)}"></label>
      <label>发表年份（选填）<input name="year" type="number" min="1500" max="2099" placeholder="全部年份" value="${esc(year)}"></label>
      <button class="solid" type="submit">查找学者</button></form>
      <div class="fs3-sources">OpenAlex · Europe PMC · Crossref · ORCID · Google Scholar</div></section><div data-fs-region="local"></div>
      <div data-fs-region="saved"></div><div data-fs-region="status" role="status" aria-live="polite"></div>
      <div data-fs-region="candidates"></div><div data-fs-region="result"></div></section>`;
  }
  function active(root){return latestMount===root && root.isConnected;}
  function tell(msg,bad=false){notice=msg;error=bad;}
  function candidateSection(){
    if (!candidates.length) return "";
    const providers={openalex:"OpenAlex",epmc:"Europe PMC",orcid:"ORCID",bibliographic:"署名检索"};
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
    return `<details class="fs3-cover" data-fs-scholar><summary>补充 Google Scholar 论文</summary><p>在 Scholar 作者主页中勾选论文并导出 BibTeX 或 CSV。仅粘贴主页网址时，可通过下面的代理读取。书目会与 ${esc(draft.name)} 的现有记录一起去重。</p>
    <p>${link("https://scholar.google.com/citations?view_op=search_authors&mauthors="+encodeURIComponent(draft.name),"在 Google Scholar 查找此人")} · ${link("https://scholar.google.com/intl/en-US/scholar/citations.html","Google 导出指南")}</p>
    <form data-fs-form="import" class="fs3-proof"><label>书目文件<input name="file" type="file" accept=".bib,.bibtex,.csv,.txt"></label><label>或粘贴 BibTeX / CSV<textarea rows="4" name="bib" maxlength="12000000" placeholder="@article{…}">${esc(importText)}</textarea></label><button type="submit" class="outline">合并书目到此人</button></form>
    ${window.AtlasScholarLive?`<details class="fs3-cover"><summary>通过自己的代理读取 Scholar 主页</summary><form class="fs3-proof" data-fs-form="scholar"><label>Scholar 作者主页<input type="url" required name="scholar" placeholder="https://scholar.google.com/citations?user=…" value="${esc(scholarUrl)}"></label><label>Scholar 代理服务地址<input type="url" required name="relay" placeholder="http://127.0.0.1:8791/scholar" value="${esc(relayUrl)}"></label><p>你的代理将收到 Scholar 主页标识。每次最多读取 100 条，费用按代理服务设置结算。 ${link("https://github.com/Nature-Q/byline-atlas/tree/main/server/scholar-relay","代理配置说明")}</p><label><input type="checkbox" required> 已核对该主页属于 ${esc(draft.name)}，并同意本次请求</label><button type="submit" class="outline" ${scholarBusy?"disabled":""}>${scholarBusy?"正在读取…":live&&live.nextStart!=null?"读取下一批论文":"读取主页论文"}</button></form></details>`:""}</details>`;
  }
  function results(){
    if(!draft)return "";
    const included=draft.records.filter(r=>!r.excluded&&!r.identityPending).length;
    const pending=draft.records.filter(r=>!r.excluded&&r.identityPending).length;
    return `<section class="fs3-panel"><div class="fs3-rowhead"><div><small>当前学者</small><h2>${esc(draft.name)}</h2>${esc(draft.affiliation)}${draft.liveYear?" · "+esc(draft.liveYear)+" 年":""}</div><button class="solid" data-fs-action="open" ${draft.records.length?"":"disabled"}>查看学者画像</button></div>
    <div class="fs3-numbers"><div><strong>${draft.records.length}</strong><span>去重后记录</span></div><div><strong>${included}</strong><span>计入统计</span></div><div><strong>${pending}</strong><span>身份待核</span></div></div>
    ${profileLinks(draft.candidate)}${coverageView()}<div class="fs3-actions">${draft.providers.map((p,i)=>p.nextCursor||p.failed||p.coverage.some(c=>c.status==="error")?`<button class="outline" data-fs-more="${i}" ${loading?"disabled":""}>${p.nextCursor?"继续读取下一批":"重新请求来源"}${draft.providers.length>1?" · "+esc(p.candidate.name):""}</button>`:"").join("")}<button class="outline" data-fs-action="alias" ${loading?"disabled":""}>补充同一人的其他署名或档案</button></div>
    ${scholarView()}${rowsView()}</section>`;
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
  function orcid(c){
    const ids=[c?.requestedOrcid,c?.orcid,...(c?.observedOrcids||[])].map(v=>String(v||"").match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i)?.[0]?.toUpperCase()).filter(Boolean);
    if(new Set(ids).size!==1)return "";
    return ids[0];
  }
  function profileLinks(c){
    const oa=String(c?.id||"").match(/(?:^|\/)(A\d+)$/)?.[1], oid=orcid(c), links=[];
    if(oa)links.push(link("https://openalex.org/"+oa,"OpenAlex 作者档案"));
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
    function localOptions(){
      const name=find.elements.person.value.trim().normalize("NFKC");
      const normalized=name.toLowerCase().replace(/[\s,，]+/g," ").trim();
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
      part("status").innerHTML=(busy||notice||cancel)?`<div class="fs3-status${error?" fs3-error":""}">${esc([busy,notice].filter(Boolean).join(" "))}${cancel}</div>`:"";
      part("candidates").innerHTML=candidateSection();
      part("result").innerHTML=results();
      if(scholarOpen && root.querySelector("[data-fs-scholar]")) root.querySelector("[data-fs-scholar]").open=true;
      if(relayOpen && root.querySelector("[data-fs-scholar] details")) root.querySelector("[data-fs-scholar] details").open=true;
      const submit=find.querySelector('[type="submit"]');submit.disabled=searching||loading||scholarBusy;
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
      if(/scholar\.google\./i.test(query)) {
        scholarUrl=query;
        return post("请先用姓名或 ORCID 选择学者，然后在该学者的 Google Scholar 区域读取这个主页。",true);
      }
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
    async function importBib(form){
      const d=draft,file=form.elements.file.files[0], pasted=form.elements.bib.value.trim();
      if(!file && !pasted)return post("请选择书目文件或粘贴导出的书目。",true);
      if(file && pasted)return post("请分两次提交文件与粘贴的书目，便于分别保留来源。",true);
      if((file?.size||pasted.length)>12000000)return post("请将书目分成每份小于 12 MB 的文件。",true);
      try{
        const raw=await engine().importScholar(file?await file.text():pasted);
        if(!active(root)||d!==draft)return;
        if(!raw.length)return post("未识别到论文。请使用 Scholar 导出的 BibTeX 或 CSV 格式。",true);
        const rows=reviewOnly(raw,"Google Scholar 导入记录，需用原文署名或作者标识核对。").filter(r=>!d.liveYear||String(r.year)===String(d.liveYear));
        const label=file?.name||"粘贴的书目", before=d.records.length;
        d.records=engine().merge(d.records,rows);
        d.scholarImports.push({name:label,count:rows.length,date:date()});importText="";
        tell(`符合当前年份范围的书目 ${rows.length} 条。去重后新增 ${d.records.length-before} 条。`);storeDraft();draw();
      }catch(e){post("书目读取失败。"+(e.message||"请检查格式。"),true);}
    }
    async function readScholar(form){
      const d=draft, profile=form.elements.scholar.value.trim(), relay=form.elements.relay.value.trim();
      if(!window.AtlasScholarLive||!http(profile)||!http(relay))return post("请输入有效的 Scholar 主页和代理服务地址。",true);
      const previous=d.scholarLive, profileId=new URL(profile).searchParams.get("user");
      if(previous && new URL(previous.url).searchParams.get("user")!==profileId)
        return post("当前档案已绑定另一个 Scholar 主页。可将补充书目导出后逐篇核对。",true);
      if(previous && previous.nextStart==null)return post("已读到这个 Scholar 主页的最后一页。");
      scholarUrl=profile;relayUrl=relay;scholarBusy=true;post("");
      const attempt=++run;
      try{
        const result=await window.AtlasScholarLive.fetchPage(profile,relay,previous?.nextStart??0);
        if(attempt!==run||d!==draft||!active(root))return;
        const raw=result.records, rows=reviewOnly(raw,"来自用户提供的 Scholar 主页，请核实论文署名。").filter(r=>!d.liveYear||String(r.year)===String(d.liveYear));
        d.records=engine().merge(d.records,rows);
        d.scholarLive={url:profile,nextStart:result.nextStart??null,count:(previous?.count||0)+raw.length};
        tell(`主页返回 ${raw.length} 条，其中 ${rows.length} 条符合当前年份范围。`);storeDraft();
      }catch(e){if(attempt===run)tell("Scholar 请求失败。"+(e.message||"请检查代理地址，或导入导出的书目。"),true);}
      finally{if(attempt===run){scholarBusy=false;draw();}}
    }
    function saveReview(form){
      const r=draft.records[reviewRow], url=http(form.elements.url.value), note=form.elements.note.value.trim(), decision=form.elements.decision.value;
      if(!r||!url||!note)return post("请补充可打开的证据链接和核查说明。",true);
      r.excluded=decision==="no";r.identityPending=decision==="pending";r.identityStatus=r.identityPending?"review":"supported";
      r.identityReview=true;r.identityBasis="manual";r.identityEvidence=note;r.identityEvidenceUrl=url;
      r.review={note,url,date:new Date().toISOString()};reviewRow=null;tell("归属判定已更新。");storeDraft();draw();
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
      scholarUrl=draft.scholarLive?.url||"";tell("已打开现有档案，可补充书目或其他署名。");storeDraft();draw();
    }
    root.addEventListener("input",e=>{
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
    root.addEventListener("submit",e=>{
      const form=e.target.closest("[data-fs-form]");if(!form)return;
      e.preventDefault();
      if(loading||scholarBusy||searching)return;
      switch(form.dataset.fsForm){
        case "find":return lookup(form);
        case "attach":{const reason=form.elements.reason.value.trim();if(reason)return selectCandidate(proposed,reason);return post("请填写两份档案的同人依据。",true);}
        case "import":return importBib(form);
        case "review":return saveReview(form);
        case "scholar":return readScholar(form);
      }
    });
    root.addEventListener("click",e=>{
      const el=e.target.closest("button");
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
        case "alias":
          attachMode=true;proposed=null;candidates=[];find.elements.person.value=draft.name;
          find.elements.org.value="";find.elements.year.value=draft.liveYear||"";
          post("搜索此人的其他署名或历年单位，核对后可加入当前档案。");find.elements.person.focus();return;
        case "cancelalias":attachMode=false;proposed=null;candidates=[];return post("");
        case "prev":page--;reviewRow=null;draw();return;
        case "next":page++;reviewRow=null;draw();return;
      }
    });
    if(draft?.scholarLive && !scholarUrl)scholarUrl=draft.scholarLive.url;
    draw();
    return ()=>{if(latestMount===root){latestMount=null;run++;searching=false;loading=false;scholarBusy=false;}};
  }
  window.AtlasSearchV3={render,mount};
})();
