(function biomedical(){
"use strict";
const clean=v=>String(v??"").replace(/\s+/g," ").trim(), arr=v=>Array.isArray(v)?v:(v?[v]:[]);
const norm=v=>clean(v).normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const quote=v=>'"'+clean(v).replace(/["\\]/g,"\\$&")+'"';
function parseID(v){const s=clean(v).replace(/^https?:\/\/orcid.org\//i,"").replace(/\/$/,"").toUpperCase();if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(s))return "";const d=s.replace(/-/g,"");let sum=0;for(const c of d.slice(0,15))sum=(sum+Number(c))*2;const chk=(12-sum%11)%11;return (chk===10?"X":String(chk))===d[15]?s:"";}
const ids=a=>[...new Set(arr(a?.authorId).filter(v=>clean(v.type).toUpperCase()==="ORCID").map(v=>parseID(v.value)).filter(Boolean))];
const authors=p=>arr(p.authorList?.author);
const addresses=a=>arr(a?.authorAffiliationDetailsList?.authorAffiliation).map(v=>clean(v.affiliation)).filter(Boolean);
// Keep raw byline observations available for review even when a book of names cannot
// support a count of distinct persons or distinct institutions.
function paperByline(p, mine) {
 const list = authors(p);
 const byline = list.map(a => ({
   name: clean([a.firstName,a.lastName].filter(Boolean).join(" ") || a.fullName || a.collectiveName),
   orcid: ids(a).length === 1 ? ids(a)[0] : "",
   affiliations: addresses(a),
   isTarget: a === mine
 }));
 const contribution = {};
 const completeFlag = clean(p.authorList?.completeYN).toUpperCase() === "Y";
 const knownCount = Number.isInteger(p.authorCount) && list.length === p.authorCount;
 if (mine && list.length && (completeFlag || knownCount) &&
     clean(p.authorList?.completeYN).toUpperCase() !== "N" && !/\bet al\b/i.test(p.authorString || "")) {
   const others = list.filter(a => a !== mine);
   const keys = others.map(a => ids(a).length === 1 ? ids(a)[0] : "");
   if (keys.every(Boolean) && new Set(keys).size === keys.length &&
       !keys.includes(ids(mine)[0]) && others.every(a => !a.collectiveName && a.lastName)) {
     contribution.coauthors = keys.map(key => "orcid:" + key);
   }
 }
 return {byline, contribution};
}
const ownName=(a,n)=>{const g=norm(a.firstName),s=norm(a.lastName);return g&&s&&[g+" "+s,s+" "+g].includes(norm(n));};
const aligned=(a,h)=>addresses(a).find(v=>(" "+norm(v)+" ").includes(" "+norm(h)+" "))||"";
const orgs={"北京大学":"Peking University","北大":"Peking University","卡迪夫大学":"Cardiff University","cardiff":"Cardiff University","复旦大学":"Fudan University","清华大学":"Tsinghua University"};
function query(n,aff,id){
 if(id)return "AUTHORID:"+quote(id);
 const t=n.replace(/,/g," ").split(/\s+/).filter(Boolean);
 if(n.length>100||!/^[\p{Script=Latin}\p{M} .,'’-]+$/u.test(n)||t.filter(s=>norm(s).length>1).length<2||t.length>7)throw Error("Europe PMC 请使用完整英文署名或有效 ORCID。");
 if(aff&&(aff.length>180||norm(aff).length<3||!/[\p{Script=Latin}]/u.test(aff)||/^(university|hospital|china|institute)$/i.test(aff)))throw Error("请填写具体机构的英文名称。");
 const names=[t.join(" "),t.at(-1)+" "+t.slice(0,-1).map(w=>w[0]).join(""),t[0]+" "+t.slice(1).map(w=>w[0]).join("")];
 return "("+[...new Set(names)].map(v=>"AUTH:"+quote(v)).join(" OR ")+")"+(aff?" AND AFF:"+quote(aff):"");
}
const cache=new Map();
async function retrieve(q,year){
 if(year&&!/^\d{4}$/.test(String(year)))throw Error("请输入四位发表年。");
 const k=q+' AND SRC:MED AND (PUB_TYPE:"journal article" OR PUB_TYPE:"review")'+(year?" AND PUB_YEAR:"+year:"")+" sort_date:y";
 const prev=cache.get(k);if(prev&&Date.now()-prev.at<180000)return prev.data;
 const u=new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");for(const [key,val] of Object.entries({query:k,resultType:"core",format:"json",pageSize:100}))u.searchParams.set(key,val);
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),16000);try{const res=await fetch(u.href,{signal:ac.signal,credentials:"omit",referrerPolicy:"no-referrer"});if(!res.ok)throw Error("Europe PMC 返回 HTTP "+res.status+"。");const json=await res.json();if(!Number.isInteger(json.hitCount)||!Array.isArray(json.resultList?.result))throw Error("Europe PMC 数据格式不完整。");const data={items:json.resultList.result,hits:json.hitCount};if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(k,{at:Date.now(),data});return data;}catch(e){if(e.name==="AbortError"||e instanceof TypeError)throw Error("Europe PMC 连接失败或响应超时。");throw e;}finally{clearTimeout(timer);}
}
const profile=(id,a)=>({provider:"epmc",id:"MED/ORCID/"+id,name:a?[a.firstName,a.lastName].filter(Boolean).join(" ")||id:id,orcid:id,requestedOrcid:id,affiliation:addresses(a)[0]||"署名单位待核",detail:"Europe PMC · ORCID "+id});
async function search(mode,value,hint){
 if(mode!=="author")throw Error("Europe PMC 入口仅支持学者。");
 const n=clean(value),aff=orgs[clean(hint).toLowerCase()]||clean(hint),id=parseID(n),d=await retrieve(query(n,aff,id));
 if(id)return d.hits?[profile(id,d.items.flatMap(authors).find(a=>ids(a).length===1&&ids(a)[0]===id))]:[];
 const groups=new Map();let ambiguous=0;
 for(const p of d.items){const a=authors(p).filter(x=>ownName(x,n)&&(!aff||aligned(x,aff)));if(a.length!==1)continue;const authorIds=ids(a[0]);if(authorIds.length===1){groups.set(authorIds[0],profile(authorIds[0],a[0]));}else ambiguous++;}
 const result=[...groups.values()];
 if(aff&&ambiguous)result.push({id:"MED/NAME/"+norm(n)+"/"+norm(aff),provider:"epmc",name:n,affiliation:aff,clue:aff,detail:"完整姓名与本人署名地址相符，缺少唯一 ORCID；逐篇核查后计入。"});
 if(!result.length&&!aff&&d.hits)throw Error("同名论文不足以唯一定位。请补充英文机构或 ORCID。");return result;
}
async function load(mode,c,opts={}){
 if(mode!=="author"||c?.provider!=="epmc")throw Error("请重新选择 Europe PMC 候选。");
 const id=parseID(c.orcid),hint=c.clue||"";if(!id&&!hint)throw Error("缺少 ORCID 或单位。");
 const d=await retrieve(query(c.name,hint,id),opts.year),records=new Map();
 for(const p of d.items){const aa=authors(p),matched=aa.filter(a=>id?ids(a).length===1&&ids(a)[0]===id:ownName(a,c.name)&&aligned(a,hint)&&ids(a).length!==1);
 if(!id&&matched.length!==1)continue;const mine=matched.length===1?matched[0]:null;const wait=!id||!mine;const pmid=clean(p.pmid||p.id);if(!/^\d+$/.test(pmid))continue;
 const j=p.journalInfo?.journal||{},doi=clean(p.doi).toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,"");const doiOK=/^10\.\d{4,9}\/[^\s"<>]+$/.test(doi)?doi:"";const link="https://pubmed.ncbi.nlm.nih.gov/"+pmid+"/",evidence=wait?(mine?"姓名与该作者本人的地址吻合，尚缺唯一 ORCID。":"文献检索命中，无法在作者表中唯一定位此 ORCID。"):"该作者署名行的 ORCID 与所选候选一致："+id+"。";const pos=mine?aa.indexOf(mine):-1;const types=arr(p.pubTypeList?.pubType).map(norm);const row={id:"MED/"+pmid,title:clean(p.title)||"题名待核",doi:doiOK,journal:clean(j.title||j.medlineAbbreviation||p.journalTitle)||"期刊待核",issn:[...new Set([j.ISSN,j.ESSN,j.issn,j.essn,p.journalIssn].filter(Boolean))],workType:types.some(t=>t.includes("review"))?"review":types.includes("letter")?"letter":"article",url:doiOK?"https://doi.org/"+doiOK:link,year:/^\d{4}$/.test(String(p.pubYear))?Number(p.pubYear):null,firstUnit:null,roles:pos===0?["first"]:[],roleUnknown:true,pmcid:/^PMC\d+$/.test(p.pmcid||"")?p.pmcid:"",workOrcid:mine&&id?id:"",rawAuthorName:mine?[mine.firstName,mine.lastName].filter(Boolean).join(" "):"",evidenceUrl:link,source:"Europe PMC · PubMed 书目",identityPending:wait,identityStatus:wait?"review":"supported",identityBasis:wait?"review":"work-orcid",identityEvidence:evidence,identityEvidenceUrl:link,evidence:(pos>=0?"署名顺位 "+(pos+1)+"。":"作者位置待核。")+"通讯、共一和共通请核对原文。"};
 Object.assign(row,paperByline(p,mine));
 const key=doiOK||row.id;if(!records.has(key)||records.get(key).identityPending&&!wait)records.set(key,row);}
 const rows=[...records.values()];return {records:rows,total:rows.length,sourceHits:d.hits,scanned:d.items.length,source:"Europe PMC · PubMed 期刊论文及综述",limited:false,nextCursor:null,note:"源查询命中 "+d.hits+" 条；按发表日期读取 "+d.items.length+" 条（上限 100）。逐篇匹配与去重后保留 "+rows.length+" 篇，其中身份待核 "+rows.filter(r=>r.identityPending).length+" 篇。"};
}
window.PmcSource=Object.freeze({search,load});
})();