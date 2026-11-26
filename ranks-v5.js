(() => {
  "use strict";
  const workspaceKey = "byline-atlas-ranks-v1";
  const tops2025 = new Map([
    ["1526-6125", [true, "https://www.booksci.cn/journal/16148.htm"]],
    ["0177-0667", [true, "https://www.sci365.cn/journals/engineering-with-computers-01770667/"]],
    ["0268-3768", [false, "https://www.booksci.cn/journal/50345.htm"]]
  ]);
  const normalized = value => String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const issn = value => window.AtlasImport.normalizeIssn(value);
  const rank = value => [1,2,3,4].includes(Number(value)) ? Number(value) : null;
  function paperIds(paper) {
    const raw = paper.issn || [];
    return (Array.isArray(raw) ? raw : String(raw).split(/[,;|]/)).map(issn).filter(Boolean);
  }
  let lastRaw, storedRows = [];
  function workspaceRows() {
    try {
      const raw = localStorage.getItem(workspaceKey);
      if (raw !== lastRaw) {
        lastRaw = raw;
        storedRows = [];
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data)) storedRows = data;
        }
      }
    } catch { return []; }
    return storedRows;
  }
  function categoryScope(row) {
    if (row.scope) return row.scope;
    if (/大类/.test(row.category)) return "major";
    if (/小类/.test(row.category)) return "minor";
    return "";
  }
  function safeSource(value) {
    try {
      const u = new URL(value);
      if (u.protocol === "https:" && !u.username && !u.password) return u.href;
    } catch {}
    return "";
  }
  // Build the institution's catalogue index once even when hundreds of papers share one edition.
  const indexByCatalogue = new WeakMap();
  function index(rows) {
    if (indexByCatalogue.has(rows)) return indexByCatalogue.get(rows);
    const byId = new Map();
    for (const row of rows) {
      if (!row || !rank(row.quartile)) continue;
      const key = issn(row.issn) + "|" + row.year;
      if (!byId.has(key)) byId.set(key, []);
      byId.get(key).push(row);
    }
    indexByCatalogue.set(rows, byId);
    return byId;
  }
  function makeLookup(importedRows = workspaceRows()) {
    const catalogue = index(Array.isArray(importedRows) ? importedRows : []);
    return function resolve(paper, edition = 2025) {
      const year = Number(edition);
      const out = {year,cas:null,top:null,jcr:[],casSource:"",topSource:"",casCategory:"",conflict:false};
      if (!paper) return out;
      const builtin = window.AtlasJournals?.lookup(paper, year);
      const suppliedIds = paperIds(paper);
      if (!builtin && window.AtlasJournals && year === window.AtlasJournals.year) {
        const idMatches = window.AtlasJournals.journals.filter(j => j.issn.some(id => suppliedIds.includes(id)));
        // A recognised ISSN and a contradictory recognised title (or two conflicting ISSNs) require review.
        if (idMatches.length) { out.conflict = true; return out; }
      }
      const ids = new Set([...suppliedIds, ...(builtin?.issn || [])]);
      const rows = [...ids].flatMap(id => catalogue.get(id + "|" + year) || []);
      const topEntry = builtin && year === 2025 && tops2025.get(builtin.issn[0]);
      if (builtin) {
        rows.push({...builtin.cas,scope:"major",system:"CAS",top:topEntry?.[0],topSource:topEntry?.[1]});
        rows.push(...builtin.jcr.map(r => ({...r,system:"JCR",source:builtin.jcrSource})));
      }
      const major = rows.filter(r => r.system === "CAS" && categoryScope(r) === "major");
      const zones = new Set(major.map(r => rank(r.quartile)));
      const topRows = major.filter(r => typeof r.top === "boolean");
      const tops = new Set(topRows.map(r => r.top));
      if (zones.size === 1) {
        out.cas = [...zones][0];
        out.casCategory = major[0].category;
        out.casSource = major.map(r => safeSource(r.source)).find(Boolean) || "";
        if (tops.size === 1) {
          out.top = [...tops][0];
          out.topSource = topRows.map(r => safeSource(r.topSource || r.source)).find(Boolean) || "";
        }
      }
      out.conflict = zones.size > 1 || tops.size > 1;
      const categories = new Map();
      for (const row of rows.filter(r => r.system === "JCR")) {
        const name = normalized(row.category);
        if (!categories.has(name)) categories.set(name, []);
        categories.get(name).push(row);
      }
      for (const group of categories.values()) {
        const quartiles = new Set(group.map(r => rank(r.quartile)));
        if (quartiles.size > 1) { out.conflict = true; continue; }
        out.jcr.push({category:group[0].category,quartile:[...quartiles][0],source:group.map(r=>safeSource(r.source)).find(Boolean)||""});
      }
      return out;
    };
  }
  window.AtlasRanksV5 = Object.freeze({
    makeLookup,
    lookup(paper, edition = 2025, rows) { return makeLookup(rows)(paper,edition); }
  });
})();
