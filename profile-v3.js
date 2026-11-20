/* Researcher profiles use only the selected, deduplicated bibliography. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const clean = v => typeof v === 'string' ? v.normalize('NFKC').trim().replace(/\s+/g, ' ') : '';
  const key = v => clean(v).toLowerCase();
  const list = v => Array.isArray(v) ? v : [];
  const unique = a => [...new Set(a)];
  const now = () => new Date().getFullYear();
  const weightsKey = 'byline-atlas-profile-weights-v1';
  const cache = new Map();
  const views = new Map();
  let nextView = 0;
  const dimensions = [
    ['independence','独立性','唯一通讯、导师未联署的主导论文、构思与方法双重贡献。对有证据的分项比例取等权平均。'],
    ['potential','潜力线索','近三个日历年（含本年）本人主导论文占比。主导包括一作、共一、通讯和共通；仅纳入可判定的论文。此项描述近期活动。'],
    ['foresight','前瞻性线索','回顾性指标。比较发表前两年和后两年的年度平均主题发文量，后期增加至少 25% 记为符合。仅纳入发表后两个年度均已结束的论文。'],
    ['frontier','前沿性线索','比较发表前一年与前两年的主主题年发文量，增幅至少 25% 记为符合。统计此类论文的占比。'],
    ['impact','学术影响','在发表已跨两个完整年度且有指定来源引文计数的论文中，计算获得至少一次引用的比例。学科和出版年份会影响此值。']
  ];

  function accepted(records) {
    const seen = new Set();
    return list(records).filter(r => {
      if (!r || r.excluded || r.identityPending || r.identityStatus === 'review') return false;
      const id = key(r.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//,'') || clean(r.id);
      if (id && seen.has(id)) return false;
      if (id) seen.add(id);
      return true;
    });
  }
  function safeUrl(s) {
    try { const url = new URL(s); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  }
  function ref(r) {
    const url = safeUrl(r.evidenceUrl) || safeUrl(r.url);
    const name = esc(r.short || r.title || r.doi || '论文');
    return url ? '<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+name+'</a>' : name;
  }
  function refs(rows) {
    return '<ul class="pv-refs">'+rows.map(r=>'<li>'+ref(r)+'</li>').join('')+'</ul>';
  }
  function countryName(v) {
    if (!/^[A-Z]{2}$/.test(v)) return v;
    try { return new Intl.DisplayNames(['zh-CN'], {type:'region'}).of(v); } catch { return v; }
  }
  function ownUnits(r) {
    const mine = list(r.byline).filter(a=>a?.isTarget === true);
    if (mine.length>1) return [];
    const explicit = list(r.authorAffiliations).concat(mine.flatMap(a=>list(a.institutions)));
    const structured = explicit.map(i=>typeof i === 'string' ? {name:i,raw:true} : i).filter(i=>i && clean(i.name || i.display_name));
    if (structured.length) return structured;
    return mine.flatMap(a=>list(a.affiliations)).filter(s=>clean(s)).map(name=>({name, raw:true}));
  }
  function yearOf(r) { const y = Number(r.year); return Number.isInteger(y) && y >= 1500 && y <= now()+1 ? y : null; }
  function affiliations(rows) {
    const observations = [];
    for (const row of rows) {
      const year = yearOf(row);
      if (!year) continue;
      for (const unit of ownUnits(row)) {
        const name = clean(unit.name || unit.display_name);
        const ids = [clean(unit.ror).replace(/^https?:\/\/ror\.org\//i,''), clean(unit.id).replace(/^https?:\/\/openalex\.org\//i,'')].filter(Boolean);
        const country = clean(unit.countryCode || unit.country_code || unit.country);
        observations.push({row, year, name, ids, country, raw:unit.raw === true});
      }
    }
    // A row that carries both identifiers bridges the OpenAlex and ROR names.
    const parent = new Map();
    function find(x) {
      if (!parent.has(x)) parent.set(x,x);
      let root=x;
      while (root!==parent.get(root)) root=parent.get(root);
      parent.set(x,root);
      return root;
    }
    for(const o of observations) for(const id of o.ids) parent.set(find(id),find(o.ids[0]));
    const byName = new Map();
    for (const o of observations.filter(o=>o.ids.length)) {
      const label=key(o.name); if(!byName.has(label)) byName.set(label,new Set());
      byName.get(label).add(find(o.ids[0]));
    }
    const history = new Map();
    for (const o of observations) {
      const alternatives=byName.get(key(o.name));
      const id=o.ids.length ? find(o.ids[0]) : alternatives?.size===1 ? [...alternatives][0] : 'name:'+key(o.name)+'|'+o.country;
      if (!history.has(o.year)) history.set(o.year,new Map());
      const year=history.get(o.year);
      if (!year.has(id)) year.set(id,{name:o.name, countries:new Set(), rows:new Set(), raw:o.raw});
      const item=year.get(id);
      item.rows.add(o.row);
      if(o.country) item.countries.add(countryName(o.country));
      if(!o.raw)item.raw=false;
    }
    return {history, assessed:new Set(observations.map(o=>o.row)).size};
  }

  const dictionary = [
    [/\blaser\b|激光/i,'激光技术'], [/\bmelt(?:ing)? pool\b|熔池/i,'熔池'],
    [/\bmesh[ -]?(?:free|less)\b|无网格/i,'无网格数值方法'], [/\blaser polishing\b|激光抛光/i,'激光抛光'],
    [/\b(?:lpbf|powder bed fusion)\b|粉末床熔融/i,'粉末床熔融'],
    [/\b(?:fundus|retin(?:a|al|opathy))\b|眼底|视网膜/i,'眼底与视网膜'],
    [/\b(?:embryo\w*|in vitro fertili[sz]ation|ivf)\b|胚胎|体外受精/i,'胚胎与辅助生殖'],
    [/\blow back pain\b|下?腰痛/i,'腰痛'], [/\b(?:transformer|transformers)\b/i,'Transformer'],
    [/\b(?:deep learning|neural networks?)\b|深度学习|神经网络/i,'深度学习'],
    [/\b(?:computed tomography|ct imaging)\b|计算机断层扫描/i,'计算机断层成像']
  ];
  function keywords(rows) {
    const map = new Map();
    let assessed=0;
    for (const row of rows) {
      const terms = new Map();
      const add = (term,source) => {
        const t=clean(term), s=clean(source);
        if (!t || t.length>160) return;
        const k=key(t); if (!terms.has(k)) terms.set(k,{title:t,sources:new Set()});
        terms.get(k).sources.add(s || '书目关键词');
      };
      for(const e of list(row.keywordEvidence)) {
        const source=clean(e?.source), kind=clean(e?.kind);
        add(e?.term,safeUrl(source) ? kind || '原文' : [source,kind].filter(Boolean).join(' · '));
      }
      if(topicOf(row) && row.primaryTopicName) add(row.primaryTopicName,'OpenAlex · 主主题');
      for(const e of [...list(row.keywords),...list(row.topics)]) {
        const t=typeof e==='string'?e:e?.display_name || e?.name;
        if(!terms.has(key(t))) add(t,e?.source || row.source || '书目关键词');
      }
      if (!terms.size) for (const [rule,term] of dictionary) if(rule.test(row.title||'')) add(term,'题名词典匹配');
      if (terms.size) assessed++;
      for (const [k,t] of terms) {
        if(!map.has(k))map.set(k,{title:t.title,rows:[],sourceCounts:new Map()});
        const entry=map.get(k); entry.rows.push(row);
        for (const s of t.sources) entry.sourceCounts.set(s,(entry.sourceCounts.get(s)||0)+1);
      }
    }
    return {assessed,terms:[...map.values()].sort((a,b)=>b.rows.length-a.rows.length || a.title.localeCompare(b.title,'zh-CN'))};
  }
  function topicOf(r) {
    const raw=clean(r.primaryTopicId || r.primary_topic?.id).replace(/^https?:\/\/openalex\.org\//i,'').toUpperCase();
    return /^T\d+$/.test(raw) ? raw : '';
  }
  function referencesFor(rows) {
    const counts=new Map();
    for (const r of rows) {
      const id=topicOf(r);
      if(!id || !yearOf(r))continue;
      if(!counts.has(id))counts.set(id,{id,count:0,title:r.primaryTopicName || r.primary_topic?.display_name || id});
      counts.get(id).count++;
    }
    return [...counts.values()].sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id)).slice(0,5);
  }
  function lead(r) {
    if(list(r.roles).some(k=>['first','cofirst','corresponding','cocorresponding'].includes(k)))return true;
    return r.roleUnknown===false ? false : null;
  }
  function observations(rows, test) {
    return rows.map(row=>{
      const result=test(row);
      return typeof result==='object' && result!==null ? {row,...result} : {row,yes:result};
    }).filter(e=>typeof e.yes==='boolean');
  }
  function ratio(evidence, detail='') {
    const n=evidence.filter(e=>e.yes).length;
    return {score:evidence.length ? 100*n/evidence.length : null, assessed:evidence.length,
      detail:(evidence.length ? n+' / '+evidence.length+' 篇' : '缺少可判定论文')+(detail?' · '+detail:''),
      evidence:evidence.map(e=>({row:e.row,note:[e.yes?'符合':'未达到',e.detail].filter(Boolean).join(' · '),url:e.url}))};
  }
  function citeSource(row) {
    return list(row.citationEvidence).filter(e=>Number.isFinite(e.count)&&e.count>=0&&e.source);
  }
  function measures(rows, asof=now(), baseline=cache) {
    const contrib=window.AtlasContributions?.evaluate(rows,{mode:'author'})||[];
    const parts=contrib.filter(c=>['sole-correspondence','beyond-mentorship','design-methods'].includes(c.id) && c.assessed>0);
    const independenceEvidence=parts.flatMap(c=>c.evidence.map(e=>({...e,note:c.label+' · '+e.note})));
    const independence={score:parts.length ? parts.reduce((sum,c)=>sum+c.evidence.filter(e=>e.note==='符合').length/c.assessed,0)*100/parts.length : null,
      assessed:new Set(independenceEvidence.map(e=>e.row)).size, detail:parts.length+' / 3 个分项有证据',
      evidence:independenceEvidence};
    const potential=ratio(observations(rows.filter(r=>yearOf(r)>=asof-2&&yearOf(r)<=asof),lead),(asof-2)+'–'+asof);
    function growth(r, subsequent) {
      const y=yearOf(r), topic=topicOf(r), snapshot=r.topicAnnualBaseline;
      let series=baseline.get(topic);
      if(!series && topic && snapshot?.id===topic && snapshot.to<=asof-1 && snapshot.url &&
        Array.isArray(snapshot.annualCounts) && snapshot.annualCounts.length===snapshot.to-snapshot.from+1 &&
        snapshot.annualCounts.every(n=>Number.isSafeInteger(n)&&n>=0)) {
        series={...snapshot, counts:new Map(snapshot.annualCounts.map((n,i)=>[snapshot.from+i,n]))};
      }
      if(!y || !series || y-2<series.from || (subsequent ? y+2 : y-1)>series.to)return null;
      const n=yr=>series.counts.get(yr)||0;
      const base=subsequent ? (n(y-2)+n(y-1))/2 : n(y-2);
      if(base<20)return null;
      const end=subsequent ? (n(y+1)+n(y+2))/2 : n(y-1);
      const periods=subsequent ? (y-2)+'–'+(y-1)+' 与 '+(y+1)+'–'+(y+2)+' 年均' : (y-2)+' 与 '+(y-1)+' 年';
      return {yes:end/base>=1.25,detail:periods+'发文量 '+base+' → '+end+' 篇'+(series.observedAt?'，取数 '+series.observedAt:''), url:series.url || 'https://openalex.org/'+topic};
    }
    const foresight=ratio(observations(rows,r=>growth(r,true)),'以完整年度做事后比较');
    const frontier=ratio(observations(rows,r=>growth(r,false)),'发表当时已可观察');
    const mature=rows.filter(r=>yearOf(r)&&yearOf(r)<=asof-3);
    const frequencies=new Map();
    for (const row of mature) for (const s of unique(citeSource(row).map(e=>e.source))) frequencies.set(s,(frequencies.get(s)||0)+1);
    const source=[...frequencies].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];
    const impact=ratio(observations(mature,r=>{
      const entry=citeSource(r).filter(e=>e.source===source).sort((a,b)=>String(b.observedAt||'').localeCompare(String(a.observedAt||'')))[0];
      return entry ? {yes:entry.count>0,detail:source+' 引用 '+entry.count+' 次'+(entry.observedAt?'，取数 '+String(entry.observedAt).slice(0,10):''),url:entry.url} : null;
    }),source || '等待同一来源的引文计数');
    return {independence,potential,foresight,frontier,impact};
  }

  function publicationPeriods(history) {
    const institutions=new Map();
    for(const [year,orgs] of history) for(const [id,unit] of orgs) {
      if(!institutions.has(id))institutions.set(id,{name:unit.name,years:[]});
      institutions.get(id).years.push(year);
    }
    return [...institutions.values()].sort((a,b)=>Math.min(...a.years)-Math.min(...b.years)).map(unit=>{
      const runs=[];
      for(const y of unit.years.sort((a,b)=>a-b)) {
        const last=runs[runs.length-1];
        if(last && last[1]===y-1)last[1]=y;
        else runs.push([y,y]);
      }
      const years=runs.map(([first,last])=>first===last?first:first+'–'+last).join('、');
      return '<li><b>'+esc(unit.name)+'</b> '+esc(years)+'</li>';
    }).join('');
  }
  function conferenceAffiliation(scope) {
    const zhong=window.AtlasZhong;
    if(!zhong || scope.kind!=='case' || scope.name!==zhong.name)return '';
    const url=safeUrl(zhong.institutionSource);
    if(!url)return '';
    return '<aside class="pv-external"><b>补充线索 · 会议署名</b><p>2026 年 8 月 26 日的会议议程将钟志豪的单位列为哈尔滨工业大学（深圳），中国。该条仅记录会议当日的署名，另列于论文统计之外。具体入职日期待独立来源核实。 <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">查看会议议程</a></p></aside>';
  }
  function mobilityHTML(rows,scope) {
    const {history,assessed}=affiliations(rows);
    const lines=[...history].sort((a,b)=>b[0]-a[0]).map(([year,orgs])=>{
      const values=[...orgs.values()];
      return values.map(v=>'<tr><th scope="row">'+year+'</th><td><details><summary>'+esc(v.name)+' · '+v.rows.size+' 篇'+(v.raw?'（原始地址）':'')+'</summary>'+refs([...v.rows])+'</details></td><td>'+esc([...v.countries].join('、') || '待核')+'</td></tr>').join('');
    }).join('');
    return '<section class="panel pv-panel"><h2>署名单位时间线</h2><p>按本人在每篇论文中的署名地址统计，覆盖 '+assessed+' / '+rows.length+' 篇。仅合并连续有论文的年份。同年可有多个署名单位，任职起止日期需另行核实。</p>'+
      (lines?'<ul class="pv-periods" aria-label="各单位有论文的年份">'+publicationPeriods(history)+'</ul><table><thead><tr><th>发表年</th><th>机构及论文依据</th><th>国家或地区</th></tr></thead><tbody>'+lines+'</tbody></table>':'<p class="pv-empty">当前论文缺少与本人直接关联的署名地址。</p>')+conferenceAffiliation(scope)+'</section>';
  }
  function topicsHTML(rows) {
    const {assessed,terms}=keywords(rows);
    return '<section class="panel pv-panel"><h2>研究领域与关键词</h2><p>覆盖 '+assessed+' / '+rows.length+' 篇，按涉及的论文数排序。仅有题名时采用词典匹配，展开可见提取依据。</p>'+
      (terms.length?'<div class="pv-tags">'+terms.slice(0,12).map(t=>'<details><summary><span>'+esc(t.title)+'</span><b>'+t.rows.length+' 篇</b>'+bar(t.rows.length*100/rows.length)+'</summary><p>'+esc([...t.sourceCounts].map(([s,n])=>s+' '+n+' 篇').join('、'))+'</p>'+refs(t.rows)+'</details>').join('')+'</div>':'<p class="pv-empty">当前记录没有可识别的主题词。</p>')+'</section>';
  }
  function bar(n) {
    return '<span class="pv-track" aria-hidden="true"><i style="width:'+Math.max(0,Math.min(100,n)).toFixed(1)+'%"></i></span>';
  }
  function loadWeights() {
    try { return JSON.parse(localStorage.getItem(weightsKey)) || {}; } catch { return {}; }
  }
  function weightValue(raw) { return Number.isFinite(raw) && raw>=0 && raw<=100 ? raw : 20; }
  function summary(scores,weights) {
    const active=dimensions.filter(([id])=>weightValue(weights[id])>0);
    const covered=active.filter(([id])=>scores[id].score!=null);
    if(!active.length)return '请选择至少一个评价维度。';
    if(active.length!==covered.length)return '参考分待补 · '+covered.length+' / '+active.length+' 个启用维度有证据';
    const mass=active.reduce((v,[id])=>v+weightValue(weights[id]),0);
    const val=active.reduce((v,[id])=>v+scores[id].score*weightValue(weights[id]),0)/mass;
    return '自定义参考分 '+val.toFixed(1)+' / 100';
  }
  function scoresHTML(rows) {
    const scores=measures(rows), weights=loadWeights(), topics=referencesFor(rows);
    const cards=dimensions.map(([id,name,method])=>{
      const m=scores[id];
      const listing=m.evidence.length?'<ol class="pv-refs">'+m.evidence.map(e=>{
        const url=safeUrl(e.url);
        return '<li>'+ref(e.row)+' · '+esc(e.note)+(url?' <a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">数据来源</a>':'')+'</li>';
      }).join('')+'</ol>':'';
      return '<div class="pv-score" data-score="'+(m.score==null?'':m.score)+'" data-dim="'+id+'"><details><summary><b>'+name+'</b><strong>'+(m.score==null?'待补':m.score.toFixed(1))+'</strong>'+(m.score==null?'':bar(m.score))+'</summary><p>'+esc(method)+'</p>'+listing+'</details><small>'+esc(m.detail)+' · 覆盖 '+m.assessed+' / '+rows.length+' 篇</small><label>权重 <input type="number" min="0" max="100" step="1" value="'+weightValue(weights[id])+'" data-pv-weight="'+id+'" aria-label="'+name+'权重"></label></div>';
    }).join('');
    const info=topics.length?'<p>最多取当前论文中出现最多的 5 个 OpenAlex 主主题；基准年均至少 20 篇。每个主题请求一次年度分布。</p><button type="button" class="outline" data-pv-baseline>读取主题年度基线</button>':'<p>当前记录缺少 OpenAlex 主主题 ID，暂无法比较领域年度发文增幅。</p>';
    return '<section class="panel pv-panel"><h2>自定义学术评价</h2><p>每项按本次书目给出 0–100 的描述性分值，展开可查算法和证据。调整个人权重后按权重求平均，权重为 0 的维度退出计算。分数随职业阶段、学科和收录范围变化。</p><div class="pv-scores">'+cards+'</div><output class="pv-total" aria-live="polite">'+esc(summary(scores,weights))+'</output>'+info+'<p data-pv-status role="status"></p>'+citationsHTML(rows)+'</section>';
  }
  function citationsHTML(rows) {
    const reported=rows.filter(r=>citeSource(r).length);
    if(!reported.length)return '';
    const lines=reported.map(r=>'<tr><td>'+ref(r)+'</td><td>'+citeSource(r).map(e=>{
      const url=safeUrl(e.url), label=esc(e.source)+' · '+e.count+' 次';
      return (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':label)+(e.observedAt?' · '+esc(String(e.observedAt).slice(0,10)):'');
    }).join('<br>')+'</td></tr>').join('');
    return '<h3>逐篇引用记录</h3><p>有引文记录 '+reported.length+' / '+rows.length+' 篇。新近论文可在此查看已收录的引用。不同数据库的计数分别列出。</p><table class="pv-cites"><thead><tr><th>论文</th><th>数据库、次数及取数日期</th></tr></thead><tbody>'+lines+'</tbody></table>';
  }
  function render(records, scope={}) {
    if(scope.mode==='institution')return '';
    const rows=accepted(records), id=String(++nextView);
    views.set(id,rows);
    if(views.size>12) views.delete(views.keys().next().value);
    return '<div class="pv-root" data-pv-view="'+id+'">'+mobilityHTML(rows,scope)+topicsHTML(rows)+scoresHTML(rows)+'</div>';
  }
  function updateWeights(root) {
    const weights={}, scores={};
    for(const card of root.querySelectorAll('[data-dim]')) {
      const field=card.querySelector('[data-pv-weight]');
      if(!field.value.trim()||!field.checkValidity()) {
        root.querySelector('.pv-total').textContent='权重需为 0–100 的整数。'; return;
      }
      weights[card.dataset.dim]=Number(field.value);
      scores[card.dataset.dim]={score:card.dataset.score===''?null:Number(card.dataset.score)};
    }
    try { localStorage.setItem(weightsKey,JSON.stringify(weights)); } catch {}
    root.querySelector('.pv-total').textContent=summary(scores,weights);
  }
  async function loadBaselines(root,button) {
    const rows=views.get(root.dataset.pvView); if(!rows)return;
    const get=window.ScholarSource?.topicYearCounts;
    const status=root.querySelector('[data-pv-status]');
    if (!get) {status.textContent='当前数据源未启用年度比较。';return;}
    const to=now()-1, years=rows.map(yearOf).filter(Boolean);
    if(!years.length)return;
    const from=Math.max(to-49,Math.min(...years)-2);
    const topics=referencesFor(rows), failures=[];
    button.disabled=true; status.textContent='正在读取 OpenAlex 主题年度分布…';
    for(const topic of topics) {
      if(cache.get(topic.id)?.from<=from && cache.get(topic.id)?.to>=to)continue;
      try {
        const bins=await get(topic.id,from,to);
        if(!Array.isArray(bins))throw Error('年度分布格式异常');
        const counts=new Map();
        for(const b of bins) {
          const y=Number(b.key), n=b.count;
          if(!Number.isInteger(y)||!Number.isInteger(n)||n<0)throw Error('年度分布不完整');
          counts.set(y,n);
        }
        const query=new URLSearchParams({filter:'primary_topic.id:'+topic.id+',from_publication_date:'+from+'-01-01,to_publication_date:'+to+'-12-31',group_by:'publication_year',per_page:'100'});
        cache.set(topic.id,{from,to,counts,observedAt:new Date().toISOString().slice(0,10),url:'https://api.openalex.org/works?'+query});
      } catch(e) { failures.push(topic.title+'：'+(e.message||'请求失败')); }
    }
    if(!root.isConnected)return;
    button.closest('.pv-panel').outerHTML=scoresHTML(rows);
    root.querySelector('[data-pv-status]').textContent=failures.length ? '部分主题待补。'+failures.join('；') : '年度基线已读取至 '+to+' 年。';
  }
  if(typeof document!=='undefined') {
    document.addEventListener('input',e=>{if(e.target.matches?.('[data-pv-weight]'))updateWeights(e.target.closest('.pv-root'));});
    document.addEventListener('click',e=>{const b=e.target.closest?.('[data-pv-baseline]');if(b)loadBaselines(b.closest('.pv-root'),b);});
  }
  window.AtlasProfileV3=Object.freeze({render,keywords,affiliations,measures});
})();
