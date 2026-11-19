
(function () {
  "use strict";

  const tidy = value => String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  const folded = value => tidy(value).toLocaleLowerCase("en-US");
  const cleanHeader = value => folded(value).replace(/[\s_\-]+/g, "");
  const currentYear = () => new Date().getFullYear();

  function checkedText(input) {
    const text = String(input ?? "").replace(/^\uFEFF/, "").trim();
    if (!text) throw new Error("文件为空。");
    if (text.length > 12_000_000) throw new Error("单个文件超过 12 MB，请分批导入。");
    return text;
  }

  function csvTable(input) {
    const text = checkedText(input);
    const firstLine = text.split(/\r?\n/, 1)[0];
    const delimiter = firstLine.includes(",") ? "," : firstLine.includes("\t") ? "\t" : ";";
    const rows = [];
    let row = [], field = "", quoted = false, closed = false;
    function finishField() {
      row.push(field.trim());
      field = "";
      closed = false;
    }
    function finishRow() {
      finishField();
      if (row.some(Boolean)) rows.push(row);
      row = [];
    }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c !== '"') field += c;
        else if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else if (c === delimiter) finishField();
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        finishRow();
      } else if (c === '"' && !field.trim() && !closed) {
        field = "";
        quoted = true;
      } else if ((closed && c.trim()) || c === '"') {
        throw new Error("CSV 引号格式有误，请从表格软件另存为 UTF-8 CSV。");
      } else field += c;
    }
    if (quoted) throw new Error("CSV 存在未闭合的引号。");
    finishRow();
    if (rows.length < 2) throw new Error("CSV 需要表头和至少一行数据。");
    const [header, ...body] = rows;
    const names = header.map(cleanHeader);
    if (new Set(names).size !== names.length) throw new Error("CSV 表头存在同名列。");
    return {
      names,
      rows: body.map((cells, index) => {
        if (cells.length !== names.length) throw new Error("CSV 第 " + (index + 2) + " 行列数与表头不同。");
        return Object.fromEntries(names.map((name, i) => [name, cells[i]]));
      })
    };
  }

  function chooseColumn(names, aliases, required) {
    const found = names.find(name => aliases.map(cleanHeader).includes(name));
    if (!found && required) throw new Error("CSV 缺少列 " + aliases[0] + "。");
    return found;
  }

  function normalizeIssn(input) {
    const value = tidy(input).toUpperCase().replace(/[-\s]/g, "");
    if (!/^\d{7}[0-9X]$/.test(value) || value === "00000000") return "";
    const sum = [...value].reduce((n, c, i) => n + (c === "X" ? 10 : Number(c)) * (8 - i), 0);
    return sum % 11 === 0 ? value.slice(0, 4) + "-" + value.slice(4) : "";
  }

  function quartileNumber(value) {
    const match = tidy(value).toUpperCase().match(/^(?:Q\s*)?([1-4一二三四])(?:\s*区)?$/);
    if (!match) return null;
    return Number(match[1]) || "一二三四".indexOf(match[1]) + 1;
  }

  function parseRankCSV(input) {
    const { names, rows } = csvTable(input);
    const fields = Object.fromEntries(Object.entries({
      issn: ["issn", "刊号"], year: ["year", "edition_year", "edition", "版本年", "版本年份", "年份"],
      system: ["system", "体系", "分区体系"], category: ["category", "学科", "类别", "学科类别"],
      quartile: ["quartile", "partition", "分区", "区位"], journal: ["journal", "期刊", "刊名", "期刊名称"]
    }).map(([key, aliases]) => [key, chooseColumn(names, aliases, key !== "journal")]));
    const entries = new Map();
    rows.forEach((row, index) => {
      const fail = message => { throw new Error("CSV 第 " + (index + 2) + " 行：" + message); };
      const raw = key => tidy(row[fields[key]]);
      const issn = normalizeIssn(raw("issn"));
      if (!issn) fail("ISSN 格式或校验位无效，每行限填一个 ISSN。");
      const systemValue = raw("system").toUpperCase();
      const system = ["CAS", "中科院", "中科院分区", "中科院历史版"].includes(systemValue) ? "CAS" : systemValue;
      if (!["CAS", "JCR"].includes(system)) fail("体系请填写 CAS 或 JCR。");
      const year = Number(raw("year"));
      if (!/^\d{4}$/.test(raw("year")) || year < 1900 || year > currentYear()) fail("请填写有效的四位版本年份。");
      if (system === "CAS" && year >= 2026) fail("中科院文献情报中心自 2026 年起停更，请填入原版年份。");
      const category = raw("category");
      if (!category) fail("缺少学科类别，请保留原始学科口径。");
      const quartile = quartileNumber(raw("quartile"));
      if (!quartile) fail("分区应为 Q1 至 Q4，或 1 至 4 区。");
      const journal = raw("journal");
      const key = [issn, system, year, folded(category)].join("|");
      const previous = entries.get(key);
      if (previous && previous.quartile !== quartile) fail("同一 ISSN、体系、年份和学科出现两个分区。");
      if (!previous) entries.set(key, {issn, year, system, category, quartile, journal});
    });
    return [...entries.values()];
  }

  function template() {
    return "\uFEFFissn,year,system,category,quartile,journal\r\n";
  }

  // Google Scholar exports braced and quoted fields, often with nested braces in titles.
  function parseBibTeX(text) {
    const entries = [], macros = new Map();
    let pos = 0;
    const fail = message => { throw new Error("BibTeX 第 " + text.slice(0, pos).split("\n").length + " 行：" + message); };
    function space() {
      while (pos < text.length) {
        if (/\s/.test(text[pos])) pos++;
        else if (text[pos] === "%") { while (pos < text.length && text[pos] !== "\n") pos++; }
        else break;
      }
    }
    function identifier() {
      const start = pos;
      while (pos < text.length && /[a-z0-9_:.\-/]/i.test(text[pos])) pos++;
      if (start === pos) fail("缺少字段名称或值。");
      return text.slice(start, pos);
    }
    function group(open, close) {
      const start = ++pos;
      let depth = 0;
      for (; pos < text.length; pos++) {
        const c = text[pos];
        if (c === "\\") { pos++; continue; }
        if (c === close && depth === 0) {
          const result = text.slice(start, pos);
          pos++;
          return result;
        }
        if (c === (open === '"' ? "{" : open)) depth++;
        if (c === (open === '"' ? "}" : close) && depth) depth--;
      }
      fail("引号或括号未闭合。");
    }
    function atom() {
      if (text[pos] === "{") return group("{", "}");
      if (text[pos] === '"') return group('"', '"');
      const token = identifier();
      return macros.get(folded(token)) ?? token;
    }
    function value() {
      let val = atom();
      space();
      while (text[pos] === "#") { pos++; space(); val += atom(); space(); }
      return val;
    }
    while (pos < text.length) {
      space();
      if (pos >= text.length) break;
      if (text[pos] !== "@") {
        while (pos < text.length && text[pos] !== "\n" && text[pos] !== "@") pos++;
        continue;
      }
      pos++;
      const type = identifier().toLowerCase();
      space();
      const open = text[pos], close = open === "{" ? "}" : ")";
      if (!["{", "("].includes(open)) fail("记录缺少起始括号。");
      if (type === "comment" || type === "preamble") { group(open, close); continue; }
      pos++; space();
      if (type !== "string") {
        while (pos < text.length && text[pos] !== "," && text[pos] !== close) pos++;
        if (text[pos] !== ",") fail("文献条目缺少字段。");
        pos++; space();
      }
      const fields = Object.create(null);
      while (pos < text.length && text[pos] !== close) {
        const key = identifier().toLowerCase();
        space();
        if (text[pos++] !== "=") fail("字段缺少等号。");
        space();
        fields[key] = value();
        if (text[pos] === ",") { pos++; space(); }
        else if (text[pos] !== close) fail("字段之间需要逗号。");
      }
      if (text[pos++] !== close) fail("文献条目未闭合。");
      if (type === "string") Object.entries(fields).forEach(([k, v]) => macros.set(k, v));
      else entries.push({...fields, type});
    }
    return entries;
  }

  function humanText(value) {
    // Retain unknown TeX commands instead of silently deleting scientific notation.
    return tidy(String(value || "").replace(/[{}]/g, "").replace(/\\([&#%$_])/g, "$1").replace(/~/g, " "));
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function doiValue(value) {
    const doi = tidy(value).replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*:\s*)/i, "");
    return /^10\.\d{4,9}\/[^\s<>"]+$/i.test(doi) ? doi.toLowerCase() : "";
  }

  function bibliographyCSV(text) {
    const {names, rows} = csvTable(text);
    const fields = Object.fromEntries(Object.entries({
      title: ["title", "题名", "标题", "篇名", "论文题目"],
      journal: ["publication", "journal", "source title", "期刊", "出版物", "刊名"],
      year: ["year", "年份", "年", "发表年份"], doi: ["doi"], issn: ["issn", "刊号"],
      url: ["url", "link", "链接"], author: ["authors", "author", "作者"]
    }).map(([key, aliases]) => [key, chooseColumn(names, aliases, key === "title")]));
    return rows.map(row => Object.fromEntries(Object.entries(fields).map(([key, col]) => [key, row[col] || ""])));
  }

  function parseBibliography(input) {
    const text = checkedText(input);
    const bib = /^\s*(?:%[^\n]*(?:\n|$)\s*)*@/i.test(text);
    const entries = bib ? parseBibTeX(text) : bibliographyCSV(text);
    if (!entries.length) throw new Error("没有找到文献，请导入 Google 学术导出的 BibTeX 或 CSV 文件。");
    const result = [], seen = new Set(), usedIDs = new Set();
    entries.forEach((entry, i) => {
      const title = humanText(entry.title), journal = humanText(entry.journal || entry.booktitle);
      if (!title) throw new Error("第 " + (i + 1) + " 条文献缺少题名。");
      const yearValue = Number(tidy(entry.year));
      const year = Number.isInteger(yearValue) && yearValue >= 1000 && yearValue <= currentYear() + 1 ? yearValue : null;
      const doi = doiValue(entry.doi) || doiValue(entry.url);
      const url = doi ? "https://doi.org/" + doi : safeUrl(entry.url);
      const issn = [...new Set((String(entry.issn || "").match(/\b\d{4}[- ]?\d{3}[\dX]\b/gi) || []).map(normalizeIssn).filter(Boolean))];
      const identity = doi || JSON.stringify([folded(title), year, folded(journal), folded(humanText(entry.author))]);
      if (seen.has(identity)) return;
      seen.add(identity);
      // Keep imported text and DOI punctuation out of DOM element identifiers.
      let h1 = 2166136261, h2 = 5381;
      for (const c of identity) {
        h1 = Math.imul(h1 ^ c.codePointAt(0), 16777619);
        h2 = (Math.imul(h2, 33) ^ c.codePointAt(0));
      }
      const base = "import-" + (h1 >>> 0).toString(36) + "-" + (h2 >>> 0).toString(36);
      let id = base;
      for (let suffix = 2; usedIDs.has(id); suffix++) id = base + "-" + suffix;
      usedIDs.add(id);
      result.push({
        id, title, journal, year, doi, url, issn,
        workType: entry.type || "unknown", roles: [], roleUnknown: true, firstUnit: null,
        source: bib ? "书目导入 · BibTeX" : "书目导入 · CSV",
        evidence: "文件提供题名等书目信息，尚待核对作者身份、等贡献声明、通讯标记及第一单位。"
      });
    });
    return result;
  }

  // Selected exact titles from Nature Portfolio, the AAAS Science family, and Cell Press.
  // Out-of-catalog journals remain unknown. 'other' is also a deliberate exact-title list.
  const catalogue = [
    ["flagship", "Nature", "0028-0836 1476-4687"],
    ["flagship", "Science", "0036-8075 1095-9203"],
    ["flagship", "Cell", "0092-8674 1097-4172"],
    ["family", "Nature Communications", "2041-1723"],
    ["family", "Nature Medicine", "1078-8956 1546-170X"],
    ["family", "Nature Biotechnology", "1087-0156 1546-1696"],
    ["family", "Nature Biomedical Engineering", "2157-846X"],
    ["family", "Nature Methods", "1548-7091 1548-7105"],
    ["family", "Nature Genetics", "1061-4036 1546-1718"],
    ["family", "Nature Machine Intelligence", "2522-5839"],
    ["family", "Nature Cancer", "2662-1347"],
    ["family", "Nature Health", ""],
    ["family", "Scientific Reports", "2045-2322"],
    ["family", "Scientific Data", "2052-4463"],
    ["family", "Science Advances", "2375-2548"],
    ["family", "Science Translational Medicine", "1946-6234 1946-6242"],
    ["family", "Science Immunology", "2470-9468"],
    ["family", "Science Robotics", "2470-9476"],
    ["family", "Science Signaling", "1945-0877 1937-9145"],
    ["family", "Cell Reports", "2211-1247"],
    ["family", "Cell Reports Medicine", "2666-3791"],
    ["family", "Cell Stem Cell", "1934-5909 1875-9777"],
    ["family", "Cell Metabolism", "1550-4131 1932-7420"],
    ["other", "Medical Image Analysis", "1361-8415 1361-8423"],
    ["other", "Biomedical Signal Processing and Control", "1746-8094 1746-8108"],
    ["other", "IEEE Transactions on Medical Imaging", "0278-0062 1558-254X"],
    ["other", "The Lancet", "0140-6736 1474-547X"],
    ["other", "The New England Journal of Medicine", "0028-4793 1533-4406"],
    ["other", "JAMA", "0098-7484 1538-3598"],
    ["other", "PLOS ONE", "1932-6203"]
  ];
  const titleIndex = new Map(), issnIndex = new Map();
  catalogue.forEach(([group, title, ids]) => {
    const item = {group, title};
    titleIndex.set(folded(title), item);
    ids.split(" ").filter(Boolean).forEach(id => issnIndex.set(id, item));
  });

  function classifyJournal(record) {
    const match = titleIndex.get(folded(record?.journal));
    const ids = Array.isArray(record?.issn) ? record.issn : String(record?.issn || "").split(/[,;| ]+/);
    const matches = new Set(ids.map(normalizeIssn).map(id => issnIndex.get(id)).filter(Boolean));
    if (match) matches.add(match);
    if (matches.size !== 1) return "unknown";
    return [...matches][0].group;
  }

  window.AtlasImport = {parseRankCSV, template, parseBibliography, classifyJournal, normalizeIssn,
    journalCatalogue: catalogue.map(([group, title]) => ({group, title}))};
})();

