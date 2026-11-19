(() => {
  "use strict";
  function readCSV(input) {
    const text = String(input || "").replace(/^\uFEFF/, "");
    if (text.length > 12000000) throw Error("文件超过 12 MB，请分批导入。");
    const rows = [];
    let row = [], field = "", quoted = false, closed = false;
    function endField() { row.push(field.trim()); field = ""; closed = false; }
    function endRow() { endField(); if (row.some(Boolean)) rows.push(row); row = []; }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c !== '"') field += c;
        else if (text[i+1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else if (c === ",") endField();
      else if (c === "\n" || c === "\r") {
        endRow(); if (c === "\r" && text[i+1] === "\n") i++;
      } else if (closed) {
        if (!/\s/.test(c)) throw Error("CSV 引号后出现了多余字符。");
      } else if (c === '"') {
        if (field.trim()) throw Error("CSV 字段中的引号应成对转义。");
        field = ""; quoted = true;
      } else field += c;
    }
    if (quoted) throw Error("CSV 有未闭合的引号。");
    endRow(); return rows;
  }
  function parse(input) {
    const [head, ...rows] = readCSV(input);
    if (!head) throw Error("CSV 文件为空。");
    const names = head.map(v => v.toLowerCase());
    if (new Set(names).size !== names.length) throw Error("CSV 列名重复。");
    const fields = ["issn","year","jif","source"].map(k => {
      const i = names.indexOf(k);
      if (i < 0) throw Error("缺少 CSV 列 " + k);
      return i;
    });
    const out = new Map();
    rows.forEach((line,i) => {
      const fail = m => { throw Error("CSV 第 " + (i+2) + " 条记录：" + m); };
      if (line.length !== head.length) fail("列数与表头不匹配。");
      const [raw,y,n,source] = fields.map(k => line[k]);
      const issn = window.AtlasImport.normalizeIssn(raw), year = Number(y), jif = Number(n);
      if (!issn) fail("无效 ISSN 或校验位。");
      if (!/^\d{4}$/.test(y) || year < 1975 || year > new Date().getFullYear()) fail("年份无效。");
      if (!/^\d+(?:\.\d+)?$/.test(n) || !Number.isFinite(jif)) fail("JIF 应为非负数，缺失数据请跳过。");
      let u;
      try { u = new URL(source); } catch { fail("请填写 HTTPS 来源。"); }
      if (u.protocol !== "https:" || !u.hostname || u.username || u.password) fail("请填写不含凭据的 HTTPS 来源。");
      const key = issn + "|" + year, previous = out.get(key);
      if (previous && previous.jif !== jif) fail("同 ISSN 和年份的 JIF 冲突。");
      if (!previous) out.set(key,{issn,year,jif,jifSource:u.href});
    });
    return [...out.values()];
  }
  function lookup(record,year,entries) {
    const raw = record?.issn || [];
    const ids = new Set((Array.isArray(raw) ? raw : String(raw).split(/[,;|]/)).map(window.AtlasImport.normalizeIssn).filter(Boolean));
    const matches = (Array.isArray(entries) ? entries : []).filter(x => x && x.year === Number(year) && ids.has(x.issn) && Number.isFinite(x.jif));
    return matches.length && matches.every(x => x.jif === matches[0].jif) ? matches[0] : null;
  }
  window.AtlasJournalImports = Object.freeze({parse,lookup});
})();