(() => {
  "use strict";
  const idPattern = /^[a-zA-Z0-9_-]{12}$/;
  function profileId(value) {
    const raw = String(value || "").trim();
    if (idPattern.test(raw)) return raw;
    try {
      const url = new URL(raw);
      const id = url.searchParams.get("user") || "";
      if (url.protocol === "https:" && /^scholar\.google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(url.hostname) && url.pathname === "/citations" && idPattern.test(id)) return id;
    } catch {}
    throw new Error("请输入带 user 参数的 Google Scholar 公开作者主页或 12 位主页 ID。");
  }
  const canonicalProfile = id => "https://scholar.google.com/citations?user=" + profileId(id);
  function workRows(articles, authorId, observedAt) {
    const sourceUrl = canonicalProfile(authorId);
    return articles.filter(a => typeof a.title === "string" && a.title.trim()).map(a => {
      const citationId = typeof a.citation_id === "string" && a.citation_id.startsWith(authorId + ":") ? a.citation_id : "";
      const url = citationId ? "https://scholar.google.com/citations?view_op=view_citation&user="+authorId+"&citation_for_view=" + encodeURIComponent(citationId) : sourceUrl;
      const year = /^\d{4}$/.test(a.year) ? Number(a.year) : null;
      const id = "gs:" + (citationId || [authorId,a.title,year,a.authors].join("|"));
      const visits=Number.isSafeInteger(a.citedBy) && a.citedBy>=0 ? {citedByCount:a.citedBy,citationEvidence:[{source:"Google Scholar",url,count:a.citedBy,observedAt}]}:{};
      return {id,title:a.title.trim(),doi:"",year,url,issn:[],journal:"",workType:"unknown",roles:[],roleUnknown:true,firstUnit:null,
        identityPending:true,identityStatus:"review",identityEvidence:"来自指定 Scholar 主页，待核对本篇作者署名。",identityEvidenceUrl:sourceUrl,
        importAuthorText:String(a.authors || ""),byline:[],source:"Google Scholar",sources:["Google Scholar"],provenance:[{source:"Google Scholar",id:citationId || id,url}],
        evidence:[a.authors,a.publication].filter(Boolean).join(" · "),...visits};
    });
  }
  function parseProfileHtml(html, expectedId="", observedAt="") {
    // A template's content remains inert. No document fragments, URLs, or scripts from the file are mounted.
    const view = document.createElement("template");
    view.innerHTML = html;
    const root=view.content, rows=Array.from(root.querySelectorAll("tr.gsc_a_tr"));
    const text = el => el?.textContent?.replace(/\s+/g," ").trim() || "";
    if (!root.querySelector("#gsc_prf_in") || !rows.length) throw Error("文件没有 Scholar 个人主页的论文表格。请展开所需论文后保存网页。");
    const ids=new Set(), articles=[];
    for(const row of rows) {
      const title=row.querySelector("a.gsc_a_at");
      if(!title || !text(title))continue;
      let citationId="";
      try {
        const u=new URL(title.getAttribute("href"),"https://scholar.google.com");
        const key=(u.searchParams.get("citation_for_view")||"");
        const match=/^([\w-]{12}):([\w-]+)$/.exec(key);
        if(match){ids.add(match[1]);citationId=key;}
      } catch {}
      const meta=Array.from(row.querySelectorAll(".gsc_a_t .gs_gray"),text);
      const cited=text(row.querySelector(".gsc_a_ac")).replace(/[,\s\u202f]/g,"");
      articles.push({title:text(title),authors:meta[0],publication:meta[1],citation_id:citationId,year:text(row.querySelector(".gsc_a_y")),citedBy:/^\d+$/.test(cited)?Number(cited):null});
    }
    if(!articles.length || ids.size!==1) throw Error("无法确认此页对应的唯一 Scholar 主页。请保存包含作者名称及原始论文链接的网页。");
    const id=[...ids][0];
    if(expectedId && id!==profileId(expectedId))throw Error("文件的 Scholar 主页 ID 与所选作者不同，请核对后分别导入。");
    const more=root.querySelector("#gsc_bpf_more");
    const hasMore=more ? !more.hasAttribute("disabled") && more.getAttribute("aria-disabled")!=="true" : null;
    return {authorId:id,name:text(root.querySelector("#gsc_prf_in")),affiliation:text(root.querySelector("#gsc_prf_i .gsc_prf_il")),
      records:workRows(articles,id,observedAt),hasMore};
  }
  async function fetchPage(profile, endpoint, start = 0) {
    const authorId = profileId(profile);
    let relay;
    try { relay = new URL(endpoint); } catch { throw new Error("请填写已配置的 Scholar 服务地址。"); }
    const loopback = ["127.0.0.1","localhost","[::1]"].includes(relay.hostname);
    if ((relay.protocol !== "https:" && !(loopback && relay.protocol === "http:")) || relay.username || relay.password || relay.search || relay.hash) throw new Error("服务需使用 HTTPS 地址，或本机 HTTP 地址。");
    const response = await fetch(relay.href, {method:"POST", headers:{"Content-Type":"application/json"}, credentials:"omit", referrerPolicy:"no-referrer", signal:AbortSignal.timeout(32000), body:JSON.stringify({authorId,start})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.articles)) throw new Error(result.error || "Google Scholar 服务未返回有效结果。");
    const sourceUrl=canonicalProfile(authorId);
    const records=workRows(result.articles,authorId,new Date().toISOString().slice(0,10));
    return {records,name:String(result.author?.name || ""),affiliation:String(result.author?.affiliations || ""),nextStart:Number.isSafeInteger(result.nextStart) && result.nextStart > start ? result.nextStart : null,sourceUrl,total:null};
  }
  window.AtlasScholarLive = {fetchPage,profileId,canonicalProfile,parseProfileHtml};
})();
