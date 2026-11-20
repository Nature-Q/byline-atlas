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
  async function fetchPage(profile, endpoint, start = 0) {
    const authorId = profileId(profile);
    let relay;
    try { relay = new URL(endpoint); } catch { throw new Error("请填写已配置的 Scholar 服务地址。"); }
    const loopback = ["127.0.0.1","localhost","[::1]"].includes(relay.hostname);
    if ((relay.protocol !== "https:" && !(loopback && relay.protocol === "http:")) || relay.username || relay.password || relay.search || relay.hash) throw new Error("服务需使用 HTTPS 地址，或本机 HTTP 地址。");
    const response = await fetch(relay.href, {method:"POST", headers:{"Content-Type":"application/json"}, credentials:"omit", referrerPolicy:"no-referrer", signal:AbortSignal.timeout(32000), body:JSON.stringify({authorId,start})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(result.articles)) throw new Error(result.error || "Google Scholar 服务未返回有效结果。");
    const sourceUrl = "https://scholar.google.com/citations?user=" + authorId;
    const records = result.articles.filter(a => typeof a.title === "string" && a.title.trim()).map(a => {
      const citationId = typeof a.citation_id === "string" && a.citation_id.startsWith(authorId + ":") ? a.citation_id : "";
      const url = citationId ? "https://scholar.google.com/citations?view_op=view_citation&citation_for_view=" + encodeURIComponent(citationId) : sourceUrl;
      const year = /^\d{4}$/.test(a.year) ? Number(a.year) : null;
      const id = "gs:" + (citationId || [authorId,a.title,year,a.authors].join("|"));
      return {id,title:a.title.trim(),doi:"",year,url,issn:[],journal:"",workType:"unknown",roles:[],roleUnknown:true,firstUnit:null,
        identityPending:true,identityStatus:"review",identityEvidence:"来自指定 Scholar 主页，尚待独立确认作者归属。",identityEvidenceUrl:sourceUrl,
        importAuthorText:String(a.authors || ""),byline:[],source:"Google Scholar",sources:["Google Scholar"],provenance:[{source:"Google Scholar",id:citationId || id,url}],
        evidence:[a.authors,a.publication].filter(Boolean).join(" · "),...(Number.isInteger(a.citedBy) && a.citedBy >= 0 ? {citedByCount:a.citedBy}: {})};
    });
    return {records,nextStart:Number.isSafeInteger(result.nextStart) && result.nextStart > start ? result.nextStart : null,sourceUrl,total:null};
  }
  window.AtlasScholarLive = {fetchPage,profileId};
})();
