/* Browser-local, institution/year publication review. */
(() => {
  'use strict';
  const base = 'byline-atlas/claims/v3/';
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = s => String(s ?? '').normalize('NFKC').trim().replace(/\s+/g,' ');
  const norm = s => clean(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const names = s => String(s || '').split('|').map(clean).filter(Boolean);
  const id = s => String(s || '').replace(/^https?:\/\/(?:www\.)?openalex.org\//i,'').toUpperCase();
  const safeLink = s => {try {const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  const nanfang = ['南方医院','南方醫院','南方医科大学南方医院','Nanfang Hospital','Nan Fang Hospital'];
  const isNanfang = s => nanfang.some(n=>norm(n)===norm(s));
  function aliases(org) {return [...new Set([org.name,...(nanfang.some(a=>phrase(org.name,a))?nanfang:[])].map(norm).filter(Boolean))];}
  function phrase(address,target) {
    const a=norm(address), t=norm(target);
    if(!t) return false;
    return /[\u3400-\u9fff]/.test(t) ? a.includes(t) : (' '+a+' ').includes(' '+t+' ');
  }
  function orcid(value) {
    const s=clean(value).replace(/^https?:\/\/orcid\.org\//i,'').toUpperCase();
    if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s)) return '';
    const d=s.replace(/-/g,''), sum=[...d.slice(0,15)].reduce((a,b)=>(a+Number(b))*2,0);
    return '0123456789X'[(12-sum%11)%11]===d[15]?s:'';
  }
  function addressProof(author,org) {
    const address=(author.affiliations||[]).find(a=>aliases(org).some(n=>phrase(a,n)));
    if(address) return '作者原始地址 · '+address;
    const mapped=(author.institutions||[]).find(x=>id(x.id)===id(org.id));
    return mapped?'作者行机构标识 · '+(mapped.name||org.name)+' ('+id(mapped.id)+')':'';
  }
  function institutionMatch(person,org) {
    return !person.institution || names(person.institution).some(x=>id(x)===id(org.id)||aliases(org).includes(norm(x)));
  }
  function candidates(author,year,org,roster) {
    const published=orcid(author.orcid), n=norm(author.name), pool=new Map();
    for(const p of roster) {
      if(p.from && year<p.from || p.to && year>p.to || !institutionMatch(p,org)) continue;
      if(published && p.orcid && published!==p.orcid) continue;
      const exact=Boolean(published && published===p.orcid);
      if(!exact && !p.names.some(name=>norm(name)===n)) continue;
      const basis=exact?'作者行 ORCID 与名册一致':'署名与名册姓名或别名一致';
      if(!pool.has(p.key)||exact)pool.set(p.key,{key:p.key,name:p.name,basis,exact});
    }
    return [...pool.values()];
  }
  function tableCSV(text) {
    const s=String(text).replace(/^\uFEFF/,''), result=[];
    let row=[],field='',quoted=false,closed=false;
    function cell(){row.push(clean(field));field='';closed=false;}
    function line(){cell();if(row.some(Boolean))result.push(row);row=[];}
    for(let i=0;i<s.length;i++){
      const c=s[i];
      if(quoted){
        if(c!=='"')field+=c;
        else if(s[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}
      }else if(c===',')cell();
      else if(c==='\n'||c==='\r'){line();if(c==='\r'&&s[i+1]==='\n')i++;}
      else if(c==='"'&&!field&&!closed)quoted=true;
      else if(c==='"'||closed&&c.trim())throw Error('CSV 引号格式错误。');
      else field+=c;
    }
    if(quoted)throw Error('CSV 引号没有闭合。');
    line();return result;
  }
  function parseRoster(text) {
    const [header,...rows]=tableCSV(text);
    const h=(header||[]).map(k=>k.toLowerCase());
    if(!h.includes('name')||!rows.length||new Set(h).size!==h.length)throw Error('名册需要 name 列、无重复表头且至少有一条记录。');
    return rows.map((r,index)=>{
      const get=k=>r[h.indexOf(k)]||'';
      const no=index+2, name=get('name'), oid=orcid(get('orcid'));
      const a=get('from'),b=get('to'), valid=y=>!y||/^\d{4}$/.test(y)&&+y>=1500&&+y<=2200;
      if(r.length!==h.length||!name||get('orcid')&&!oid||!valid(a)||!valid(b)||a&&b&&+a>+b)throw Error('名册第 '+no+' 行的列数、姓名、ORCID 或年份有误。');
      const key=get('staff_id')?'工号 '+get('staff_id'):oid?'ORCID '+oid:'未编号 '+name+' · 名册行 '+no;
      return {name,key,orcid:oid,from:+a||0,to:+b||0,names:[name,...names(get('aliases'))],institution:get('institution')};
    });
  }
  function download(file,rows) {
    const encode=v=>{let s=String(v??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const a=document.createElement('a'), u=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(encode).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    a.href=u;a.download=file;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
  }
  function read(key,fallback){try{return JSON.parse(localStorage.getItem(base+key))??fallback;}catch{return fallback;}}
  let roster=read('roster',[]), recent=read('recent',[]), last=read('last',''), dataset=last?read('work/'+last,null):null;
  if(!Array.isArray(roster))roster=[];
  if(!Array.isArray(recent))recent=[];
  let ui=null, choices=[], active=false, token=0, notice='', saveError='', method='all', page=0, reviewing=null;
  let query=dataset?.org.name||'', chosenYear=dataset?.year||new Date().getFullYear();
  const datasetKey=d=>(d.org.workspace||d.org.id)+'/'+d.year;
  function write(key,value){try{localStorage.setItem(base+key,JSON.stringify(value));return true;}catch{saveError='浏览器存储不足或不可用。当前结果仅留在本页，请及时导出。';return false;}}
  function persist() {
    if(!dataset)return;
    const key=datasetKey(dataset);
    const {records,...saved}=dataset;
    if(!write('work/'+key,saved))return;
    recent=[{key,title:dataset.org.name+' · '+dataset.year},...recent.filter(r=>r.key!==key)];
    write('recent',recent);write('last',key);
  }
  function workKey(r) {return r.doi?'doi:'+doiOf(r.doi):r.pmid?'pmid:'+pmidOf(r.pmid):r.id;}
  function linesFor(r,org) {
    const seen=new Map();
    return (r.byline||[]).map(author=>{
      const identity=orcid(author.orcid)||author.openAlexId||norm(author.name), instance=(seen.get(identity)||0)+1;seen.set(identity,instance);
      const proof=addressProof(author,org);
      const keys=author.keys||[JSON.stringify([workKey(r),identity,instance])];
      return {author,proof,key:keys.find(k=>dataset?.decisions?.[k])||keys[0]};
    }).filter(x=>x.proof);
  }
  function classify(r,org) {
    const lines=linesFor(r,org);
    const claims=lines.filter(l=>dataset.decisions[l.key]?.action==='确认');
    return {r,lines,claims,unit:r.firstUnit===true?'第一单位':r.firstUnit===false?'参与单位':'第一单位待核'};
  }
  function render() {return '<div id="claims-v3" class="claims-v3"></div>';}
  function mount(container) {
    ui=container.matches?.('#claims-v3')?container:container.querySelector('#claims-v3');
    if(!ui)return;
    ui.onclick=click;ui.onchange=change;ui.onsubmit=submit;
    draw();
  }
  function draw() {
    if(!ui?.isConnected)return;
    const header='<div class="page-head"><div><h1>机构年度认领</h1><p>按发表时作者地址核查机构成果，匹配名册并记录人工确认。</p></div></div>';
    const search='<form class="claim-picker panel" data-cform="search"><label>机构名称或 OpenAlex 机构 ID<input name="org" required value="'+esc(query)+'" placeholder="例如：南方医院"></label><label>发表年份<input name="year" type="number" required min="1500" max="2100" value="'+esc(chosenYear)+'"></label><button class="solid" '+(active?'disabled':'')+'>查找 OpenAlex 机构</button><button value="epmc" class="outline" '+(active?'disabled':'')+'>按地址查 Europe PMC</button></form>';
    const options=choices.length?'<div class="panel claim-list"><h3>选择署名机构</h3>'+choices.map((c,i)=>'<button class="outline" data-inst="'+i+'">'+esc(c.name)+' · '+esc(c.affiliation||c.id)+'</button>').join(' ')+'</div>':'';
    const recentMenu='<section class="claim-tools"><button class="outline" data-c="roster">导入人员名册 CSV</button><button class="linkbtn" data-c="template">下载名册模板</button>'+(recent.length?'<label>恢复年度记录 <select data-c="restore"><option value="">选择…</option>'+recent.map((r,i)=>'<option value="'+i+'">'+esc(r.title)+'</option>').join('')+'</select></label>':'')+'<input hidden data-c="file" type="file" accept=".csv,text/csv"></section>';
    const noticeBox='<p role="status" class="claim-note">'+esc(notice)+(saveError?'<strong> '+esc(saveError)+'</strong>':'')+'</p>';
    ui.innerHTML=header+search+recentMenu+'<p class="claim-help">名册 '+roster.length+' 行，仅保存在本浏览器。每段任职可独占一行，复用同一 staff_id，填写机构、起止年份和署名别名。Europe PMC 可直接用英文机构地址检索，支持输入“南方医院”。仅同校或同城不足以确认医院署名。</p>'+options+noticeBox+(dataset?results():'')+(active?'<button class="outline" data-c="stop">停止本次请求</button>':'');
  }
  function results() {
    const d=dataset, rows=d.records.map(r=>classify(r,d.org)), linked=rows.filter(x=>x.lines.length), picked=rows.filter(x=>x.claims.length), first=linked.filter(x=>x.r.firstUnit===true), nonfirst=linked.filter(x=>x.r.firstUnit===false);
    const ordered=rows.filter(x=>method==='all'||method==='confirmed'&&x.claims.length||method==='address'&&!x.lines.length||method==='unclaimed'&&x.lines.length&&!x.claims.length);
    const per=12,pages=Math.max(1,Math.ceil(ordered.length/per));
    page=Math.min(page,pages-1);
    const summary=[['已加载去重',rows.length],['匹配作者地址',linked.length],['已认领论文',picked.length],['地址待核',rows.length-linked.length]];
    const split=linked.length?'第一单位 '+first.length+' 篇 · 其他参与 '+nonfirst.length+' 篇 · 顺序待核 '+(linked.length-first.length-nonfirst.length)+' 篇':'暂无已匹配作者地址';
    const cards=summary.map(([label,count])=>'<div><span>'+label+'</span><b>'+count+'<small> 篇</small></b></div>').join('');
    const list=ordered.slice(page*per,(page+1)*per).map(w=>{
      const link=safeLink(w.r.url);
      return '<details class="claim-paper" '+(reviewing&&w.lines.some(l=>l.key===reviewing)?'open':'')+'><summary><strong>'+esc(w.r.title)+'</strong><span>'+esc(w.lines.length?w.unit:'地址待核')+' · '+w.claims.length+' 人已认领</span></summary>'+
        '<p>'+esc(w.r.journal)+' · '+esc(w.r.sources.map(s=>providerNames[s]).join('、'))+' · '+(link?'<a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">论文原文</a>':'')+'</p>'+
        (w.lines.length?w.lines.map(l=>lineUI(l)).join(''):'<p>来源命中了该机构，但逐位作者的地址和机构标识均未明确匹配。此篇暂不进入认领统计。</p>')+'</details>';
    }).join('');
    return '<section class="claim-results panel"><h2>'+esc(d.org.name)+' · '+d.year+'</h2><p>年度期刊论文及综述。'+Object.entries(d.providers).map(([key,s])=>providerNames[key]+' 已读 '+s.scanned+' / '+s.total+' 条').join('；')+'。按 DOI、PMID 去重。'+(d.complete?'已读完所选来源。':'已加载部分记录。')+' '+esc(split)+'</p><div class="claim-stats">'+cards+'</div>'+
       '<div class="claim-tools"><label>显示 <select data-c="filter">'+[['all','全部论文'],['unclaimed','地址匹配、待认领'],['confirmed','有已确认认领'],['address','机构地址待核']].map(([v,t])=>'<option value="'+v+'" '+(v===method?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
       providerControls(d)+'<button class="linkbtn" data-c="summary">导出年度汇总</button><button class="linkbtn" data-c="export">导出认领明细</button><button class="linkbtn" data-c="audit">导出操作记录</button></div>'+
       (list||'<p>当前范围暂无记录。</p>')+'<div class="claim-tools"><button class="outline" data-c="back" '+(!page?'disabled':'')+'>上一页</button><span>'+(page+1)+' / '+pages+'</span><button class="outline" data-c="forward" '+(page+1>=pages?'disabled':'')+'>下一页</button></div></section>';
  }
  function lineUI(line) {
    const key=esc(line.key), current=dataset.decisions[line.key], matches=candidates(line.author,dataset.year,dataset.org,roster);
    const people=matches.map(x=>x.name+'（'+x.key+'）').join('、');
    const match=matches.length?(matches.length>1?'多名候选':matches[0].basis)+' · '+people:'暂无名册匹配';
    const eligible=roster.filter(p=>(!p.from||dataset.year>=p.from)&&(!p.to||dataset.year<=p.to)&&institutionMatch(p,dataset.org)&&(!orcid(line.author.orcid)||!p.orcid||orcid(line.author.orcid)===p.orcid));
    const menu=[...new Map(eligible.map(p=>[p.key,p])).values()].sort((a,b)=>Number(matches.some(x=>x.key===b.key))-Number(matches.some(x=>x.key===a.key)));
    const form=reviewing!==line.key?'':'<form class="claim-review" data-cform="review"><label>核对名册人员<select name="staff"><option value="">选择人员</option>'+menu.map(p=>'<option value="'+esc(p.key)+'">'+esc(p.name+' · '+p.key)+'</option>').join('')+'</select></label><label>核查说明<input required name="note" maxlength="500" placeholder="例如：原文署名、医院地址和人员档案一致"></label><button type="submit" value="确认" class="solid">确认认领</button><button type="submit" value="排除" class="outline">排除该署名</button>'+(current?'<button type="submit" value="撤回" class="outline">撤回决定</button>':'')+'</form>';
    return '<article class="claim-author"><b>'+esc(line.author.name)+'</b> '+(line.author.orcid?esc(line.author.orcid):'')+'<p>'+esc(line.proof)+'</p><p>'+esc(match)+'</p><p>'+esc(current?current.action+' · '+(current.person||'')+' · '+current.note:'待人工确认')+'　<button class="linkbtn" data-review="'+key+'">'+(reviewing===line.key?'收起核查':'核对署名')+'</button></p>'+form+'</article>';
  }
  function invalidate() {token++;active=false;}
  async function lookup() {
    const serial=++token;active=true;notice='正在查找机构…';choices=[];draw();
    try {
      let list=await window.ScholarSource.search('institution',isNanfang(query)?'Nanfang Hospital':query);
      if(serial!==token)return;
      if(isNanfang(query))list=list.filter(c=>[c.name,...(c.aliases||[])].some(a=>nanfang.some(n=>phrase(a,n))));
      choices=list.slice(0,40);
      notice=choices.length?'请选择具体署名机构以获取 '+chosenYear+' 年论文。':'未找到对应机构。可用英文正式名按地址查 Europe PMC，南方医院也支持中文。';
    }catch(e){if(serial===token)notice='OpenAlex · '+e.message+' 可直接按地址查 Europe PMC。';}
    finally{if(serial===token){active=false;draw();}}
  }
  const providerNames={oa:'OpenAlex',epmc:'Europe PMC'};
  function textOrg(name) {
    const en=isNanfang(name)?'Nanfang Hospital':clean(name);
    if(!en||!/[a-z]{2}/i.test(en)||/^(?:university|hospital|institute|china|I\d+)$/i.test(en)||en.length>180)return null;
    return {id:'AFF-'+norm(en),name:en};
  }
  function pmidOf(value) {
    const m=clean(value).match(/^(?:(?:https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/)|(?:PMID:?)|(?:MED\/))?(\d+)\/?$/i);
    return m?m[1]:'';
  }
  const array=v=>Array.isArray(v)?v:[];
  const doiOf=v=>clean(v).toLowerCase().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,'');
  function compactRecord(r,org) {
    const {id,title,journal,url,firstUnit,year}=r, doi=doiOf(r.doi),pmid=pmidOf(r.pmid);
    const byline=array(r.byline).filter(a=>addressProof(a,org)).map(({name,orcid,openAlexId,affiliations,institutions})=>({name,orcid,openAlexId,affiliations,institutions}));
    return {id,doi,pmid,title,journal,url,firstUnit,year,byline};
  }
  function fromEpmc({paper:p,byline},org) {
    const pmid=pmidOf(p.pmid||(p.source==='MED'?p.id:'')),id=clean(p.source)+'/'+clean(p.id);
    const first=byline[0], addresses=array(first?.affiliations);
    const firstUnit=addresses.length===1&&aliases(org).includes(norm(addresses[0]))?true:null;
    return {id,doi:p.doi,pmid,title:p.title,journal:p.journalInfo?.journal?.title||p.journalTitle,
      year:Number(p.pubYear||p.firstPublicationDate?.slice(0,4)),url:'https://europepmc.org/article/'+encodeURIComponent(p.source)+'/'+encodeURIComponent(p.id),
      byline,firstUnit};
  }
  function sourceAuthors(r) {
    const seen=new Map(), key=workKey(r);
    return r.byline.map(a=>{
      const identity=orcid(a.orcid)||a.openAlexId||norm(a.name), n=(seen.get(identity)||0)+1;
      seen.set(identity,n);return {...a,keys:[JSON.stringify([key,identity,n])]};
    });
  }
  function joinBylines(left,right) {
    const out=left.map(a=>({...a,keys:[...a.keys]})), used=new Set();
    for(const b of right) {
      const same=a=>(a.orcid&&b.orcid&&a.orcid===b.orcid)||(norm(a.name)===norm(b.name)&&!(a.orcid&&b.orcid&&a.orcid!==b.orcid));
      const matches=left.map((a,i)=>same(a)?i:-1).filter(i=>i>=0);
      if(matches.length!==1||right.filter(a=>sameNameOrID(a,b)).length!==1||used.has(matches[0])){out.push(b);continue;}
      const n=matches[0],a=out[n];used.add(n);
      out[n]={...a,orcid:a.orcid||b.orcid,affiliations:[...new Set([...array(a.affiliations),...array(b.affiliations)])],
        institutions:[...array(a.institutions),...array(b.institutions)],keys:[...new Set([...a.keys,...b.keys])]};
    }
    return out;
  }
  function sameNameOrID(a,b) {
    return a.orcid&&b.orcid?a.orcid===b.orcid:norm(a.name)===norm(b.name);
  }
  function mergeRecords(providers) {
    const records=[], index=new Map();
    for(const [name,p] of Object.entries(providers)){
      for(const r of p.records){
        const keys=[r.doi&&'doi:'+r.doi,r.pmid&&'pmid:'+r.pmid,r.id&&name+':'+r.id].filter(Boolean);
        const positions=new Set(keys.flatMap(k=>index.has(k)?[index.get(k)]:[]));
        let wh=positions.size===1?[...positions][0]:undefined, old=records[wh];
        if(old&&(r.doi&&old.doi&&r.doi!==old.doi||r.pmid&&old.pmid&&r.pmid!==old.pmid)){wh=undefined;old=null;}
        if(wh===undefined){wh=records.length;records.push({...r,byline:sourceAuthors(r),firstObserved:[r.firstUnit],sources:[name]});}
        else{
          const flags=[...old.firstObserved,r.firstUnit], known=new Set(flags.filter(v=>typeof v==='boolean'));
          records[wh]={...old,doi:old.doi||r.doi,pmid:old.pmid||r.pmid,byline:joinBylines(old.byline,sourceAuthors(r)),firstObserved:flags,
            firstUnit:known.size===1?[...known][0]:null,sources:[...new Set([...old.sources,name])]};
        }
        keys.forEach(k=>{if(!index.has(k))index.set(k,wh);});
      }
    }
    return records;
  }
  function hydrate(d) {
    if(!d)return null;
    if(!d.providers)d.providers={oa:{records:d.records||[],total:d.total,scanned:d.scanned,next:d.next,complete:d.complete}};
    const states=Object.values(d.providers);
    d.records=mergeRecords(d.providers);d.total=states.reduce((n,s)=>n+s.total,0);d.complete=states.every(s=>s.complete);
    return d;
  }
  function providerControls(d) {
    const keys=/^I\d+$/i.test(id(d.org.id))?['oa','epmc']:['epmc'];
    return keys.map(p=>{
      const name=providerNames[p],s=d.providers[p],attr=' data-provider="'+p+'" '+(active?'disabled':'');
      if(!s)return '<button class="outline" data-c="add"'+attr+'>补查 '+name+'</button>';
      let buttons='<button class="outline" data-c="refresh"'+attr+'>刷新 '+name+'</button>';
      if(s.next)buttons+='<button class="outline" data-c="more"'+attr+'>继续获取 '+name+'</button>';
      else if(!s.complete&&p==='oa')buttons+='<small>继续获取 OpenAlex 需要可用的 API Key。</small>';
      return buttons;
    }).join('');
  }
  async function fetchYear(selected,year,more=false,p='oa') {
    const serial=++token;active=true;choices=[];notice='正在读取 '+providerNames[p]+' 年度论文…';reviewing=null;draw();
    const sameYear=dataset?.year===+year, same=sameYear&&(selected.id===dataset.org.id||aliases(dataset.org).includes(norm(selected.name))&&(selected.id.startsWith('AFF-')||dataset.org.id.startsWith('AFF-')));
    const org=same?(selected.id.startsWith('AFF-')?dataset.org:{...selected,workspace:dataset.org.workspace||dataset.org.id}):selected;
    const key=datasetKey({org,year}), stored=same?dataset:hydrate(read('work/'+key,null));
    const prior=stored?.providers[p];
    try {
      let rows,total,cursor;
      if(p==='epmc'){
        const target=textOrg(org.name);
        if(!target)throw Error('Europe PMC 需要机构英文名称。南方医院可直接使用中文。');
        const res=await window.PmcSource.institutionPage(target.name,String(year),{cursor:more?prior.next:undefined,scanned:more?prior.scanned:0});
        rows=res.items.map(item=>fromEpmc(item,org));total=res.hits;cursor=res.nextCursor;
      }else{
        const res=await window.ScholarSource.load('institution',org,{year:String(year),...(more?{cursor:prior.next}:{})});
        rows=res.records;total=res.total;cursor=res.nextCursor;
      }
      if(serial!==token)return;
      const records=new Map((more?prior.records:[]).map(r=>[workKey(r),r]));
      for(const raw of rows){
        const r=compactRecord(raw,org);
        if(Number(r.year)===Number(year)&&workKey(r))records.set(workKey(r),r);
      }
      const scanned=(more?prior.scanned:0)+rows.length;
      const providers={...stored?.providers,[p]:{records:[...records.values()],total,scanned,next:scanned<total?cursor:null,complete:scanned>=total}};
      dataset=hydrate({org,year:+year,providers,decisions:stored?.decisions||{},audit:stored?.audit||[]});
      notice=providerNames[p]+' 本批读取 '+rows.length+' 条。';query=org.name;chosenYear=+year;method='all';page=0;persist();
    }catch(e){if(serial===token)notice=e.message+' 已有年度记录保留。';}
    finally{if(serial===token){active=false;draw();}}
  }
  function exportSummary() {
    const d=dataset, items=d.records.map(r=>classify(r,d.org));
    const matched=items.filter(w=>w.lines.length), first=matched.filter(w=>w.r.firstUnit===true).length, other=matched.filter(w=>w.r.firstUnit===false).length;
    const claimed=matched.filter(w=>w.claims.length), signed=claimed.flatMap(w=>w.claims.map(l=>d.decisions[l.key].person));
    download(d.org.id+'-'+d.year+'-summary.csv',[
      ['机构','机构标识','发表年','来源','原始命中','已加载去重','完整性','作者地址匹配','第一单位','其他参与','顺序待核','地址待核','已认领论文','已确认署名','认领人数'],
      [d.org.name,d.org.id,d.year,Object.keys(d.providers).map(k=>providerNames[k]).join(' + ')+' 期刊论文及综述',d.total,items.length,d.complete?'已读完':'部分',matched.length,first,other,matched.length-first-other,items.length-matched.length,claimed.length,signed.length,new Set(signed).size],
    ]);
  }
  function exportRows(audit) {
    const d=dataset, head=['机构','发表年','收录来源','PMID','DOI 或来源 ID','论文题名','机构顺位','作者署名','作者 ORCID','作者机构依据','建议人员','认领状态','已确认人员','核查说明','核查时间','论文链接'];
    let rows;
    if(audit)rows=[['机构','发表年','记录标识','论文','署名人','决定','人员','核查说明','记录时间'],...d.audit.map(a=>[d.org.name,d.year,a.key,a.title,a.author,a.action,a.person,a.note,a.time])];
    else{
      rows=[head];for(const r of d.records){
        const w=classify(r,d.org),baseRow=[d.org.name,d.year,r.sources.map(k=>providerNames[k]).join(' + '),r.pmid||'',r.doi||r.id,r.title,w.lines.length?w.unit:'地址待核'];
        if(!w.lines.length)rows.push([...baseRow,'','','','','地址待核','','','',r.url]);
        for(const l of w.lines){const dec=d.decisions[l.key];rows.push([...baseRow,l.author.name,l.author.orcid,l.proof,candidates(l.author,d.year,d.org,roster).map(p=>p.name+' · '+p.key).join(' | '),dec?.action||'待核',dec?.person||'',dec?.note||'',dec?.time||'',r.url]);}
      }
    }
    download(d.org.id+'-'+d.year+(audit?'-audit':'-claims')+'.csv',rows);
  }
  function click(e) {
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-review')){reviewing=reviewing===b.dataset.review?null:b.dataset.review;draw();return;}
    if(b.hasAttribute('data-inst')){const c=choices[Number(b.dataset.inst)];if(c&&!active)fetchYear(c,chosenYear);return;}
    switch(b.dataset.c){
      case 'template':download('人员名册模板.csv',[['staff_id','name','orcid','aliases','institution','from','to'],['示例001','示例姓名','','Example Name|Name Example','Nanfang Hospital','2022','']]);break;
      case 'roster':ui.querySelector('[data-c=file]').click();break;
      case 'more':if(!active&&dataset.providers[b.dataset.provider]?.next)fetchYear(dataset.org,dataset.year,true,b.dataset.provider);break;
      case 'add':case 'refresh':if(!active)fetchYear(dataset.org,dataset.year,false,b.dataset.provider);break;
      case 'stop':invalidate();notice='已停止，当前已加载的记录仍可查看。';draw();break;
      case 'summary':exportSummary();break;
      case 'export':exportRows(false);break;
      case 'audit':exportRows(true);break;
      case 'back':page--;reviewing=null;draw();break;
      case 'forward':page++;reviewing=null;draw();break;
    }
  }
  function submit(e) {
    const form=e.target.closest('form[data-cform]');if(!form)return;e.preventDefault();
    const fd=new FormData(form);
    if(form.dataset.cform==='search'){query=clean(fd.get('org'));chosenYear=Number(fd.get('year'));if(!active&&query){if(e.submitter?.value==='epmc'){const org=textOrg(query);if(org)fetchYear(org,chosenYear,false,'epmc');else{notice='请输入机构英文全名，南方医院也支持中文名称。';draw();}}else lookup();}return;}
    if(form.dataset.cform!=='review'||!reviewing||!dataset)return;
    const action=e.submitter?.value, person=fd.get('staff'), note=clean(fd.get('note'));
    if(!['确认','排除','撤回'].includes(action)||!note)return;
    if(action==='确认'&&!person){notice='请选择一位名册人员再确认认领。';draw();return;}
    for(const r of dataset.records){
      const line=linesFor(r,dataset.org).find(x=>x.key===reviewing);
      if(!line)continue;
      const previous=dataset.decisions[reviewing];
      const item={key:reviewing,title:r.title,author:line.author.name,action,person:action==='确认'?person:'',note,time:new Date().toISOString()};
      if(action==='撤回'){if(!previous)return;delete dataset.decisions[reviewing];}else dataset.decisions[reviewing]=item;
      dataset.audit.push(item);notice='已记录人工'+action+'。';break;
    }
    reviewing=null;persist();draw();
  }
  async function change(e) {
    const el=e.target;
    if(el.dataset.c==='restore'&&el.value!==''){
      const r=recent[Number(el.value)], old=r&&hydrate(read('work/'+r.key,null));
      if(old){invalidate();dataset=old;query=old.org.name;chosenYear=old.year;page=0;choices=[];method='all';reviewing=null;notice='已恢复本机年度记录。';write('last',r.key);draw();}
    }
    if(el.dataset.c==='filter'){method=el.value;page=0;reviewing=null;draw();}
    if(el.dataset.c==='file'&&el.files[0]){
      try{const file=el.files[0];if(file.size>5e6)throw Error('人员名册超过 5 MB，请分院系处理。');
        const next=parseRoster(await file.text());roster=next;write('roster',roster);notice='已加载 '+roster.length+' 行名册。人员建议随当前名册重新匹配。';}
      catch(err){notice=err.message;}
      draw();
    }
  }
  if(dataset)dataset=hydrate(dataset);
  window.AtlasClaimsV3=Object.freeze({render,mount});
})();
