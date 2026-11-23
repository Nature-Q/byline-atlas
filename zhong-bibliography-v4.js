(() => {
  "use strict";

  const catalog = "https://orca.cardiff.ac.uk/view/cardiffauthors/A2665745X.html";
  const thesis = "https://orca.cardiff.ac.uk/id/eprint/188071/";
  const thesisPdf = thesis + "1/PhD_Thesis_Zhihao_Zhong.pdf";
  const forum = "https://formnextasia.gymf.com.cn/list/2041";
  const programme = "https://staticgw.gymf.com.cn/images/20260729/0324ff673effbcb393109e82226f7d7713faf24e.jpg";
  const scholar = "https://scholar.google.com/";
  const observedAt = "2026-11-24";

  // Each count was returned by a DOI-specific request. Column order follows the three named sources.
  const observations = [
    ["10.1007/s00170-026-18356-3","W7162298330","93ec4ea798c30a466cde06fabecb250788694ef9",0,0,0],
    ["10.1016/j.jmapro.2026.04.011","W7154485662","c5db16bf160365f3c1d7a49855fdaec0014e914b",1,1,1],
    ["10.1007/s00366-025-02178-0","W4412461417","2a557f500a35112332b78d474e90445147a7dc0f",6,2,3],
    ["10.1016/j.jmapro.2024.10.011","W4403391544","ea28c02feeccf4c1c175c7cdfd52dded56557ef4",5,4,4]
  ];
  function enrich(records) {
    const byDoi = new Map(records.map(p => [String(p.doi || "").toLowerCase(), p]));
    for (const [doi, oaId, s2Id, openAlex, crossref, semanticScholar] of observations) {
      const row = byDoi.get(doi);
      if (!row) continue;
      const counts = [
        {source:"OpenAlex",count:openAlex,url:"https://api.openalex.org/works/"+oaId,observedAt},
        {source:"Crossref",count:crossref,url:"https://api.crossref.org/works/"+doi,observedAt},
        {source:"Semantic Scholar",count:semanticScholar,url:"https://www.semanticscholar.org/paper/"+s2Id,observedAt}
      ];
      // Maintain a single current observation per source and preserve more recently imported readings.
      const evidence = new Map();
      for (const item of [...(row.citationEvidence || []), ...counts]) {
        const prior = evidence.get(item.source);
        if (!prior || String(item.observedAt || "") >= String(prior.observedAt || "")) evidence.set(item.source, item);
      }
      row.citationEvidence = [...evidence.values()];
      row.citationsBySource = {...row.citationsBySource,...Object.fromEntries(row.citationEvidence.map(item => [item.source,item.count]))};
      row.citationSource = "OpenAlex";
      row.citedByCount = row.citationsBySource.OpenAlex;
    }
  }

  const works = [
    {type:"THES",label:"博士学位论文",title:"Modelling laser-material processing using the smooth particle hydrodynamics method",author:"Zhong, Zhihao",year:2026,venue:"Cardiff University",url:thesis,
     note:"Cardiff 工学院博士论文。扉页标注 2026 年 4 月，7 月 8 日入库。作者在论文第 iv 页列出四篇期刊论文。"},
    {type:"GEN",label:"会议议程报告",title:"基于SPH的激光加工过程仿真：从表面处理到金属3D打印",author:"钟志豪",year:2026,venue:"深圳国际激光与增材制造论坛（分论坛）",url:programme,
     note:"2026 年 8 月 26 日 16:30–16:50。主办方议程列钟志豪为报告人，署名单位为哈尔滨工业大学（深圳）。会议论文集收录情况待核。"}
  ];

  const esc = s => String(s ?? "").replace(/[&<>"']/g,x => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[x]);
  const link = (url,label) => '<a class="anchor" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>';
  function searchTitle(title) {
    return scholar+"scholar?hl=zh-CN&q="+encodeURIComponent('"'+title+'"');
  }
  function exportRis(papers) {
    const articles = papers.map(p=>({type:"JOUR",title:p.title,authors:p.authors,venue:p.journal,year:p.year,doi:p.doi,url:p.url}));
    return [...articles,...works].map(item => {
      const authors = item.authors || [item.author];
      const lines = [["TY",item.type],["TI",item.title],...authors.map(a=>["AU",a]),["PY",item.year],
        [item.type==="JOUR"?"JO":"PB",item.venue],["DO",item.doi],["UR",item.url],["N1",item.note]];
      return lines.filter(([,v])=>v!=null && v!=="").map(([k,v])=>k+"  - "+String(v).replace(/[\r\n]+/g," ")).join("\r\n")+"\r\nER  -";
    }).join("\r\n\r\n")+"\r\n";
  }
  function render() {
    const papers = window.AtlasZhong?.records || [];
    const standardRows = papers.map(p => '<li><b>'+esc(p.short || p.title)+'</b> · '+esc(p.year)+' · '+link(p.url,"DOI")+' · '+link(searchTitle(p.title),"Google Scholar 查题名")+'</li>').join("");
    const supplementaryRows = works.map(item=>'<li><strong>'+esc(item.label)+'</strong><p>'+esc(item.title)+'</p><p>'+esc(item.note)+'</p><p>'+link(item.url,item.type==="THES"?"Cardiff 学位记录":"主办方议程")+' · '+
      (item.type==="THES"?link(thesisPdf+"#page=5","作者自列论文清单")+" · "+link(searchTitle(item.title),"Google Scholar 查题名"):link(forum,"论坛活动页"))+'</p></li>').join("");
    const authorSearch = scholar+"citations?view_op=search_authors&hl=zh-CN&mauthors="+encodeURIComponent("Zhihao Zhong");
    const searchBoth = scholar+"scholar?hl=zh-CN&q="+encodeURIComponent('author:"Z Zhong" author:"S Kulasegaram" laser');
    return '<section class="panel boxpad pv-panel" id="zhong-bibliography"><h2>书目核查与补充成果</h2><p>已核实 '+papers.length+' 篇期刊论文、1 篇博士学位论文，另有 1 项中文会议报告议程。署名论文与被引统计采用期刊论文口径。</p>'+
      '<div class="buttonset">'+link(authorSearch,"Google Scholar 查找作者")+'　'+link(searchBoth,"按合作者检索")+'　'+link(catalog,"Cardiff 作者目录")+'</div>'+
      '<p>Google Scholar 个人主页仍待本人或机构来源确认。可按完整题名逐篇查找，再将导出的书目加入档案。</p>'+
      '<details><summary>四篇期刊论文的 Google Scholar 检索入口</summary><ul>'+standardRows+'</ul></details>'+
      '<h3>学位论文与会议记录</h3><ul class="pv-refs">'+supplementaryRows+'</ul>'+
      '<a class="outline" download="Zhihao-Zhong-research-outputs.ris" href="data:application/x-research-info-systems;charset=utf-8,'+esc(encodeURIComponent(exportRis(papers)))+'">导出核实书目（RIS）</a></section>';
  }
  if (window.AtlasZhong) enrich(window.AtlasZhong.records);
  window.AtlasZhongBibliographyV4 = Object.freeze({render, enrich});
})();
