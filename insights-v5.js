(() => {
  "use strict";
  const edition = 2025;
  const list = x => Array.isArray(x) ? x : [];
  const norm = x => String(x || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  function url(x) {
    try { const u = new URL(x); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
  }
  function link(href, label) {
    return url(href) ? '<a href="'+esc(url(href))+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>' : esc(label);
  }
  const categories = ["中国科学院院士","中国工程院院士","国家杰出青年科学基金获得者","美国国家科学院院士","其他国家科学院或工程院院士"];
  const dbKey = "atlas-coauthor-evidence-v5";
  function readEvidence() {
    try { return list(JSON.parse(localStorage.getItem(dbKey) || "[]")); } catch { return []; }
  }
  function paperKey(p) { return norm(p.doi).replace(/^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)/,"") || p.id || [norm(p.title),p.year].join("|"); }
  function scopeRows(records) {
    const seen = new Set();
    return list(records).filter(r => {
      if(!r || r.excluded || r.identityPending || r.identityStatus==="review" || !r.title) return false;
      const k=paperKey(r);
      if(seen.has(k)) return false;
      seen.add(k); return true;
    });
  }
  function leading(p) {
    return list(p.roles).some(r=>["first","cofirst","corresponding","cocorresponding"].includes(r)) ? true :
      p.roleUnknown===false && Array.isArray(p.roles) ? false : null;
  }
  function triAnd(a,b) { return a===false || b===false ? false : a===true && b===true ? true : null; }
  function component(label,weight,values) {
    const yes=values.filter(v=>v===true).length, known=values.filter(v=>typeof v==="boolean").length;
    return {label,weight,yes,known,n:values.length};
  }
  function score(parts) {
    if(parts.some(p=>!p.n) || !parts.some(p=>p.known))return {text:"待补证据"};
    const lo=parts.reduce((n,p)=>n+p.weight*p.yes/p.n,0),hi=parts.reduce((n,p)=>n+p.weight*(p.yes+p.n-p.known)/p.n,0);
    const f=n=>n.toFixed(1).replace(/\.0$/,"");
    return {lo,hi,text:Math.abs(hi-lo)<1e-7?f(lo):f(lo)+"–"+f(hi)};
  }
  function authorNames(p) {
    if(Array.isArray(p.contribution?.coauthors))return [...new Set(p.contribution.coauthors.filter(x=>typeof x==="string" && x.trim()))];
    const aa=list(p.byline);
    if(aa.filter(a=>a.isTarget).length!==1) return [];
    return [...new Set(aa.filter(a=>!a.isTarget && a.name).map(a=>a.name.trim()))];
  }
  function team(p) {
    const c=p.contribution || {}, aa=list(p.byline);
    const names=authorNames(p);
    const complete=p.is_authors_truncated!==true && p.bylineComplete!==false &&
      (Array.isArray(c.coauthors) || (aa.filter(a=>a.isTarget).length===1 && aa.every(a=>Boolean(a.name)) &&
      (aa.some(a=>a.position==="last") || p.bylineComplete===true)));
    const size=complete ? names.length+1 : null;
    // On partially indexed bylines two identified institutions establish a positive lower bound.
    const unitKeys=aa.map(a=>list(a.institutions).map(i=>norm(typeof i==="string"? i:i.name||i.display_name)).filter(Boolean));
    const knownUnits=Array.isArray(c.institutions)&&c.institutions.length ? new Set(c.institutions.map(norm).filter(Boolean)).size : null;
    const institutions=new Set(unitKeys.flat()).size;
    const fullByline=complete && aa.length===size;
    const multi=knownUnits>=2 || institutions>=2 ? true :
      fullByline && unitKeys.every(u=>u.length) && institutions===1 ? false : null;
    const countryKeys=aa.map(a=>list(a.countries).map(norm).filter(Boolean));
    const countries=new Set(countryKeys.flat()).size;
    const crossBorder=countries>=2 ? true : fullByline && countryKeys.every(u=>u.length) && countries===1 ? false : null;
    return {names,complete,size,multi,crossBorder};
  }
  function verifiedEntry(e,r) {
    return e && categories.includes(e.category) && authorNames(r).some(n=>norm(n)===norm(e.name)) &&
      Number.isInteger(+e.year) && +e.year>=1850 && +e.year<=new Date().getFullYear() &&
      url(e.source) && url(e.identitySource) && url(e.bylineSource);
  }
  function analyze(records,scope={},local=readEvidence()) {
    const rows=scopeRows(records), ranked=window.AtlasRanksV5?.makeLookup?.();
    const details=rows.map(p=>{
      const c=p.contribution||{}, lead=leading(p);
      const design=triAnd(c.conceptualization,c.methodology);
      const beyond=triAnd(lead,typeof c.mentorCoauthored==="boolean" ? !c.mentorCoauthored:null);
      let sole=typeof c.soleCorresponding==="boolean"?c.soleCorresponding:null;
      if(sole===null && (list(p.roles).includes("cocorresponding") || (p.roleUnknown===false && !list(p.roles).includes("corresponding"))))sole=false;
      const strengths=[...list(p.distinctions).map(x=>({...x,manual:false})),...local.filter(x=>x.paper===paperKey(p) && x.subject===norm(scope.name)).map(x=>({...x,manual:true}))].filter(e=>verifiedEntry(e,p));
      return {p,lead,design,beyond,sole,team:team(p),strengths,rank:ranked?.(p,edition)||{},type:norm(p.workType)};
    });
    const ind=[["构思与方法均有本人贡献",40,"design"],["本人唯一通讯",30,"sole"],["本人主导且博士导师均未联署",30,"beyond"]].map(([s,w,k])=>component(s,w,details.map(d=>d[k])));
    const journals=details.filter(d=>["article","review","journal-article","journal article","期刊论文","综述"].includes(d.type));
    function top(d) {
      const r=d.rank;
      if(r.cas===1) return true;
      if(r.cas===2 && typeof r.top==="boolean")return r.top;
      return r.cas>2 ? false : null;
    }
    const publication=[component("中科院一区或二区 Top 的期刊论文",100,journals.map(d=>triAnd(d.lead,top(d))))];
    const resources=[component("跨机构署名",55,details.map(d=>d.team.multi)),component("跨国或地区署名",20,details.map(d=>d.team.crossBorder)),component("本人主导的跨机构署名",25,details.map(d=>triAnd(d.lead,d.team.multi)))];
    return {details,journals,ind,publication,resources,indScore:score(ind),pubScore:score(publication),resourceScore:score(resources)};
  }
  const tf=x=>x===true?"是":x===false?"否":"未知";
  function feature(title,result,parts,extra) {
    return '<article class="ins5-card"><h3>'+title+'</h3><strong>'+esc(result.text)+'</strong><small> / 100</small><ul>'+parts.map(x=>'<li>'+x.label+' · '+x.weight+'%<br><small>符合 '+x.yes+' 篇，已判定 '+x.known+'/'+x.n+' 篇</small></li>').join("")+'</ul><p>'+extra+'</p></article>';
  }
  function distinctionTable(d) {
    const rows=d.details.flatMap(row=>row.strengths.map(e=>'<li>'+esc(e.name)+' · '+esc(e.category)+'（'+esc(e.year)+' 年） · '+link(e.bylineSource,row.p.short||row.p.title)+' · '+link(e.source,"当选或获资助公告")+' · '+link(e.identitySource,"身份匹配依据")+' · '+(!row.p.year?"论文年份待核":+row.p.year>+e.year?"发表年已获称号":+row.p.year===+e.year?"与论文同年，先后待核":"发表早于获称号年份")+(e.manual?' · 本机人工登记 <button type="button" class="outline" data-ins5-remove="'+esc(JSON.stringify([e.subject,e.paper,norm(e.name),e.category]))+'">撤销登记</button>':'')+'</li>'));
    return rows.length?'<ul>'+rows.join("")+'</ul>':'<p>暂无已关联的院士或杰青共同署名证据，实际合作情况未知。</p>';
  }
  function paperRanks(journals) {
    const cells=journals.map(d=>{const r=d.rank;return '<tr><th>'+link(d.p.evidenceUrl||d.p.url,d.p.short||d.p.title)+'</th><td>'+tf(d.lead)+'</td><td>'+link(r.casSource,r.cas?r.cas+"区":"未知")+'</td><td>'+link(r.topSource,tf(r.top))+'</td><td>'+list(r.jcr).map(j=>link(j.source,(j.category||"类别未列")+" Q"+j.quartile)).join("、")+'</td></tr>';}).join("");
    return '<div class="ins5-scroll"><table><thead><tr><th>期刊论文</th><th>本人主导</th><th>中科院大类</th><th>Top</th><th>JCR 学科分区</th></tr></thead><tbody>'+cells+'</tbody></table></div>';
  }
  function form(d) {
    const candidates=d.details.filter(x=>x.team.names.length && url(x.p.evidenceUrl||x.p.url));
    if(!candidates.length)return '<p>有可识别的共同作者和论文原文链接后，可关联称号。</p>';
    return '<details><summary>关联院士或杰青共同署名证据</summary><form class="ins5-form"><label>共同署名论文<select name="paper">'+candidates.map(x=>'<option value="'+esc(paperKey(x.p))+'">'+esc(x.p.short||x.p.title)+'</option>').join("")+'</select></label><label>合作者<select name="name"></select></label><label>公开身份<select name="category">'+categories.map(c=>'<option>'+c+'</option>').join("")+'</select></label><label>当选或获资助年份<input required type="number" name="year" min="1850" max="'+new Date().getFullYear()+'"></label><label>公布称号的机构公告网址<input required type="url" name="source" placeholder="https://…"></label><label>能核对同名身份的机构主页或履历网址<input required type="url" name="identitySource" placeholder="https://…"></label><label><input required type="checkbox"> 我已核对论文、公告与履历为同一位合作者。</label><button class="outline" type="submit">保存至本浏览器</button><span aria-live="polite"></span></form></details>';
  }
  function render(records,scope={}) {
    if(scope.mode==="institution")return "";
    const d=analyze(records,scope), n=d.details.length;
    const complete=d.details.filter(x=>x.team.complete), freq=new Map(),spellings=new Map();
    for(const x of complete){
      for(const name of x.team.names)spellings.set(norm(name),name);
      for(const name of new Set(x.team.names.map(norm)))freq.set(name,(freq.get(name)||0)+1);
    }
    const sorted=[...freq].sort((a,b)=>b[1]-a[1]), top=sorted[0];
    const ties=top?sorted.filter(x=>x[1]===top[1]).map(x=>spellings.get(x[0])):[];
    const j=d.journals;
    const summary=[[1,null,"一区"],[1,true,"一区 Top"],[2,null,"二区"],[2,true,"二区 Top"]].map(([q,t,name])=>{const items=j.filter(x=>x.rank.cas===q && (t===null||x.rank.top===t));return name+" "+items.length+" 篇（本人主导 "+items.filter(x=>x.lead===true).length+" 篇）";}).join("，");
    return '<section class="panel ins5" aria-label="学术能力证据"><h2>学术能力与合作证据</h2><p>当前档案 '+n+' 篇已归属成果 · 固定口径 v1.0。分数区间表示缺失证据分别取否或是时的边界。小样本应逐篇阅读。</p><div class="ins5-grid">'+
      feature("学术独立性（论文贡献）",d.indScore,d.ind,"三个分项均按当前成果计算。主导包括第一、共同第一、通讯及共同通讯作者。")+
      feature("高分区主导发表率",d.pubScore,d.publication,"分母为已归属的期刊论文和综述，统一对照 "+edition+" 版目录。")+
      feature("学术资源整合（跨机构合作）",d.resourceScore,d.resources,"用联署单位和作者角色描述可观察合作。双聘作者亦可能产生跨机构署名。经费、设备及数据获取能力需另行调查。")+
      '</div><details><summary>一区、二区 Top 与 JCR 逐篇明细</summary><p>'+summary+'。Top 为相应分区的子集；JCR 按学科分别列出。当前 '+j.length+' 篇期刊成果中，'+j.filter(x=>x.rank.cas).length+' 篇已匹配中科院大类。</p>'+paperRanks(j)+'</details>'+
      '<details><summary>独立性逐篇依据</summary><ul>'+d.details.map(x=>'<li>'+link(x.p.contribution?.evidenceUrl||x.p.contribution?.creditSourceUrl||x.p.evidenceUrl||x.p.url,x.p.short||x.p.title)+' · 构思和方法 '+tf(x.design)+' · 唯一通讯 '+tf(x.sole)+' · 导师未联署且本人主导 '+tf(x.beyond)+(x.p.contribution?.mentorEvidenceUrl?' · '+link(x.p.contribution.mentorEvidenceUrl,"导师依据"):'')+'</li>').join("")+'</ul></details>'+
      '<details open><summary>团队规模、伙伴集中度与院士／杰青合作</summary><p>完整作者名单 '+complete.length+'/'+n+' 篇。'+(complete.length?'其中十人及以上团队 '+complete.filter(x=>x.team.size>=10).length+' 篇。':'团队规模未知。')+(top?'最常出现的合作者 '+esc(ties.slice(0,5).join("、"))+(ties.length>5?' 等 '+ties.length+' 位':'')+'，分别共同署名 '+top[1]+'/'+complete.length+' 篇。':'')+'按署名拼写归并，可能存在同名与拼写变体。公开联署只能支持论文合作。团队规模及称号均不参与加分。</p>'+distinctionTable(d)+'</details>'+form(d)+'</section>';
  }
  function mount(main,records,scope={}) {
    const root=main.querySelector(".ins5"); if(!root)return;
    root.querySelectorAll("[data-ins5-remove]").forEach(btn=>{btn.onclick=()=>{
      const key=btn.dataset.ins5Remove;
      const kept=readEvidence().filter(e=>JSON.stringify([e.subject,e.paper,norm(e.name),e.category])!==key);
      try{localStorage.setItem(dbKey,JSON.stringify(kept));}catch{btn.textContent="本机保存失败";return;}
      root.outerHTML=render(records,scope);mount(main,records,scope);
    };});
    const f=root.querySelector(".ins5-form"); if(!f||f.dataset.ready)return;
    f.dataset.ready="1";
    const byKey=new Map(scopeRows(records).map(p=>[paperKey(p),p]));
    function authors() {const p=byKey.get(f.elements.paper.value);f.elements.name.innerHTML=p?authorNames(p).map(a=>'<option>'+esc(a)+'</option>').join(""):"";}
    authors();f.elements.paper.onchange=authors;
    f.onsubmit=event=>{
      event.preventDefault();
      const p=byKey.get(f.elements.paper.value);
      if(!p)return;
      const e={...Object.fromEntries(new FormData(f)),paper:paperKey(p),subject:norm(scope.name),bylineSource:p.evidenceUrl||p.url};
      if(!verifiedEntry(e,p)){f.querySelector("span").textContent="请核对年份并填写两个可访问的 HTTPS 来源。";return;}
      const kept=readEvidence().filter(x=>!(x.paper===e.paper&&x.subject===e.subject&&x.category===e.category&&norm(x.name)===norm(e.name)));
      try{localStorage.setItem(dbKey,JSON.stringify([...kept,e]));}catch{f.querySelector("span").textContent="本机保存失败。";return;}
      root.outerHTML=render(records,scope);mount(main,records,scope);
    };
  }
  window.AtlasInsightsV5=Object.freeze({render,mount,analyze});
})();
