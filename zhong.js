(() => {
  "use strict";

  // Values from the same JCR data year are comparable across these three records.
  const year = 2025;
  const cardiff = "Cardiff University";
  const orca = "https://orca.cardiff.ac.uk/view/cardiffauthors/A2665745X.html";
  const journals = [
    {
      journal: "Journal of Manufacturing Processes",
      issn: ["1526-6125", "2212-4616"], year, jif: 7.8,
      jifSource: "https://www.sci365.cn/journals/journal-of-manufacturing-processes-15266125/",
      cas: {year, category: "工程技术（大类）", quartile: 1, source: "https://www.booksci.cn/journal/16148.htm"},
      jcr: [{category: "制造工程", quartile: 1}],
      jcrSource: "https://www.sci365.cn/journals/journal-of-manufacturing-processes-15266125/"
    },
    {
      journal: "Engineering with Computers",
      issn: ["0177-0667", "1435-5663"], year, jif: 4.1,
      jifSource: "https://link.springer.com/journal/366",
      cas: {year, category: "工程技术（大类）", quartile: 2, source: "https://www.booksci.cn/journal/11696.htm"},
      jcr: [{category: "机械工程", quartile: 1}, {category: "计算机跨学科应用", quartile: 2}],
      jcrSource: "https://www.sci365.cn/journals/engineering-with-computers-01770667/"
    },
    {
      journal: "The International Journal of Advanced Manufacturing Technology",
      issn: ["0268-3768", "1433-3015"], year, jif: 3.7,
      jifSource: "https://link.springer.com/journal/170",
      cas: {year, category: "工程技术（大类）", quartile: 3, source: "https://www.booksci.cn/journal/50345.htm"},
      jcr: [{category: "制造工程", quartile: 2}, {category: "自动化与控制系统", quartile: 2}],
      jcrSource: "https://www.sci365.cn/journals/international-journal-of-advanced-manufacturing-technology-02683768/"
    }
  ];
  const normalTitle = value => String(value || "").normalize("NFKC").toLowerCase().trim().replace(/^the\s+/, "").replace(/\s+/g, " ");
  const normalIssn = value => String(value || "").replace(/[-\s]/g, "").toUpperCase();
  function lookup(record, edition = year) {
    if (!record || Number(edition) !== year) return null;
    const supplied = Array.isArray(record.issn) ? record.issn : String(record.issn || "").split(/[,;|]+/);
    const ids = new Set(supplied.map(normalIssn).filter(Boolean));
    const title = normalTitle(record.journal);
    const matches = journals.filter(j => j.issn.some(id => ids.has(normalIssn(id))));
    const byTitle = journals.find(j => normalTitle(j.journal) === title);
    if (!ids.size) return byTitle || null;
    return matches.length === 1 && (!byTitle || byTitle === matches[0]) ? matches[0] : null;
  }
  const rankRows = journals.flatMap(journal => [
    {system: "CAS", ...journal.cas}, ...journal.jcr.map(q => ({system: "JCR", year, source: journal.jcrSource, ...q}))
  ].map(q => ({...q, journal: journal.journal, issn: journal.issn[0]})));
  window.AtlasJournals = {lookup, year, journals, ranks: rankRows};

  const authors = ["Zhihao Zhong", "Sivakumar Kulasegaram", "Emmanuel Brousseau"];
  const commonCredits = ["研究构思", "方法设计", "软件开发", "正式分析", "初稿撰写"];
  function paper({title, short, doi, year: publicationYear, journalIndex, corresponding, evidenceUrl, credits}) {
    const journal = journals[journalIndex];
    return {
      id: doi, title, short, doi, url: "https://doi.org/" + doi, journal: journal.journal,
      year: publicationYear, issn: [...journal.issn], jif: journal.jif, jifYear: journal.year, jifSource: journal.jifSource,
      workType: "article", roles: ["first"], roleUnknown: false, firstUnit: true,
      authors: [...authors], correspondingAuthors: [corresponding], firstInstitution: cardiff,
      source: "期刊原文与 Cardiff ORCA", evidenceUrl,
      evidence: "钟志豪列第一位。唯一通讯作者为 " + corresponding + "。三位作者的唯一署名单位均为 Cardiff University 工程学院。原文列出的钟志豪贡献包括" + credits.join("、") + "。",
      identityStatus: "supported", identityPending: false, identityBasis: "publication",
      identityEvidence: "Cardiff ORCA 作者目录、原文单位、合作者及研究方向相符。", identityEvidenceUrl: orca,
      contribution: {coauthors: authors.slice(1), institutions: [cardiff], soleCorresponding: false,
        mentorCoauthored: true, mentorEvidenceUrl: "https://profiles.cardiff.ac.uk/staff/kulasegarams",
        conceptualization: true, methodology: true, credits: [...credits], evidenceUrl}
    };
  }
  const records = [
    paper({year: 2026, journalIndex: 2, short: "激光抛光后的表面粗糙度预测",
      title: "A robust and effective roughness prediction model for laser polishing", doi: "10.1007/s00170-026-18356-3",
      corresponding: authors[1], evidenceUrl: "https://link.springer.com/article/10.1007/s00170-026-18356-3#author-information",
      credits: [...commonCredits, "可视化"]}),
    paper({year: 2026, journalIndex: 0, short: "熔池与凝固微结构的耦合模拟",
      title: "An integrated mesh-free computational framework for coupled melt pool dynamics and solidification microstructure in single-track LPBF",
      doi: "10.1016/j.jmapro.2026.04.011", corresponding: authors[2],
      evidenceUrl: "https://orca.cardiff.ac.uk/id/eprint/186493/1/1-s2.0-S1526612526003683-main.pdf",
      credits: [...commonCredits, "可视化"]}),
    paper({year: 2025, journalIndex: 1, short: "激光加工中的熔池动力学",
      title: "A novel smooth particle hydrodynamics framework for modelling melting pool dynamics in laser processing",
      doi: "10.1007/s00366-025-02178-0", corresponding: authors[1],
      evidenceUrl: "https://link.springer.com/article/10.1007/s00366-025-02178-0#author-information",
      credits: [...commonCredits, "可视化"]}),
    paper({year: 2024, journalIndex: 0, short: "铝的脉冲激光烧蚀建模",
      title: "An enhanced meshless numerical methodology for modelling pulsed laser ablation of aluminium",
      doi: "10.1016/j.jmapro.2024.10.011", corresponding: authors[2],
      evidenceUrl: "https://orca.cardiff.ac.uk/id/eprint/172726/3/Zhong%20at%20al%20%282024%29.pdf",
      credits: [...commonCredits, "验证", "研究实施"]})
  ];
  window.AtlasZhong = {
    name: authors[0], chineseName: "钟志豪", affiliation: "Cardiff University 博士 · 哈尔滨工业大学（深圳）",
    institution: cardiff, institutionSource: "https://nanjixiong.com/data/attachment/forum/202608/18/102626zmb8f9l8pzz8bs9m.webp",
    source: "Cardiff ORCA 与出版商原文", sourceUrl: orca,
    note: "Cardiff 作者目录中有 4 篇期刊论文和 1 篇博士学位论文。此处统计 4 篇期刊论文，均以 Cardiff 为唯一署名单位。哈工大（深圳）见 2026 年 8 月 26 日会议议程。",
    records, ranks: rankRows
  };
})();