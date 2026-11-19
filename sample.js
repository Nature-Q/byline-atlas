
(() => {
  "use strict";

  const journals = {
    nature: ["Nature", "0028-0836", "1476-4687"],
    natureMedicine: ["Nature Medicine", "1078-8956", "1546-170X"],
    natureCommunications: ["Nature Communications", "2041-1723"],
    npj: ["npj Digital Medicine", "2398-6352"],
    iovs: ["Investigative Ophthalmology & Visual Science", "0146-0404", "1552-5783"],
    tvst: ["Translational Vision Science & Technology", "2164-2591"],
    ophScience: ["Ophthalmology Science", "2666-9145"],
    british: ["British Journal of Ophthalmology", "0007-1161", "1468-2079"],
    neurology: ["Neurology", "0028-3878", "1526-632X"],
    neurocomputing: ["Neurocomputing", "0925-2312", "1872-8286"],
  };

  function paper({ title, doi, journalKey, year, roles, evidence, source, evidenceUrl, roleUnknown = false, workType = "article" }) {
    const [journal, ...issn] = journals[journalKey];
    return {
      id: doi,
      title, doi, journal, issn, year, roles, evidence, source, roleUnknown, workType,
      url: "https://doi.org/" + doi,
      evidenceUrl,
      firstUnit: null
    };
  }

  const records = [
    paper({
      title: "Understanding pre-training data effects in retinal foundation models using two large fundus cohorts",
      doi: "10.1038/s41467-026-70077-z", journalKey: "natureCommunications", year: 2026,
      roles: ["first", "cofirst", "corresponding", "cocorresponding"],
      source: "期刊原文",
      evidence: "Yukun Zhou 署名第 1。作者注释将他与 Zheyuan Wang、Yilan Wu 并列为同等贡献；通讯栏列有他与 Bin Sheng、Pearse A. Keane，共 3 人。",
      evidenceUrl: "https://www.nature.com/articles/s41467-026-70077-z"
    }),
    paper({
      title: "Time and person sensitive foundation model for disease prediction and risk stratification",
      doi: "10.1038/s41746-026-02524-6", journalKey: "npj", year: 2026,
      roles: ["cofirst"], source: "期刊原文",
      evidence: "Yukun Zhou 署名第 2，与首位 Zheyuan Wang 等 4 名作者共享同等贡献标注。期刊另列通讯作者。",
      evidenceUrl: "https://www.nature.com/articles/s41746-026-02524-6_reference.pdf"
    }),
    paper({
      title: "AI framework for multidisease detection via retinal imaging",
      doi: "10.1038/s41591-026-04359-w", journalKey: "natureMedicine", year: 2026,
      roles: [], source: "期刊原文",
      evidence: "Yukun Zhou 署名第 20，出版方将其列入共同指导者。前 4 名作者为共同第一作者，另有 4 名通讯作者。",
      evidenceUrl: "https://www.nature.com/articles/s41591-026-04359-w"
    }),
    paper({
      title: "Building the world’s first truly global medical foundation model",
      doi: "10.1038/s41591-025-03859-5", journalKey: "natureMedicine", year: 2025,
      roles: ["cofirst"], source: "期刊原文", workType: "letter",
      evidence: "Yukun Zhou 署名第 4，前 5 名作者共享同等贡献标注。此文属于期刊的 Correspondence 栏目，通讯作者另列。",
      evidenceUrl: "https://www.nature.com/articles/s41591-025-03859-5"
    }),
    paper({
      title: "Independent Evaluation of RETFound Foundation Model's Performance on Optic Nerve Analysis Using Fundus Photography",
      doi: "10.1016/j.xops.2025.100720", journalKey: "ophScience", year: 2025,
      roles: [], roleUnknown: true, source: "PubMed 署名",
      evidence: "PubMed 作者表中 Yukun Zhou 署名第 4，列有 Moorfields 和 UCL。此条仅核对署名顺序，共同贡献与通讯标注待核。",
      evidenceUrl: "https://pubmed.ncbi.nlm.nih.gov/40161459/"
    }),
    paper({
      title: "Retinal Microvascular Biomarker Assessment With Automated Algorithm and Semiautomated Software in the Montrachet Dataset",
      doi: "10.1167/tvst.14.3.13", journalKey: "tvst", year: 2025,
      roles: [], roleUnknown: true, source: "PubMed 署名",
      evidence: "PubMed 作者表中 Yukun Zhou 署名第 6，单位为 Moorfields 和 UCL。共同贡献与通讯标注待核。",
      evidenceUrl: "https://pubmed.ncbi.nlm.nih.gov/40072417/"
    }),
    paper({
      title: "Evaluating the Impact of Retinal Vessel Segmentation Metrics on Retest Reliability in a Clinical Setting: A Comparative Analysis Using AutoMorph",
      doi: "10.1167/iovs.65.13.24", journalKey: "iovs", year: 2024,
      roles: [], roleUnknown: true, source: "PubMed 署名",
      evidence: "PubMed 作者表中 Yukun Zhou 署名第 6，并列出 Moorfields 和 UCL 的机构地址。共同贡献与通讯标注待核。",
      evidenceUrl: "https://pubmed.ncbi.nlm.nih.gov/39540861/"
    }),
    paper({
      title: "A New Retest-Stable Tortuosity Metric for Retinal Vessel Analyses",
      doi: "10.1167/iovs.65.12.30", journalKey: "iovs", year: 2024,
      roles: [], roleUnknown: true, source: "PubMed 署名",
      evidence: "PubMed 作者表中 Yukun Zhou 署名第 5，单位列有 Moorfields 和 UCL。共同贡献与通讯标注待核。",
      evidenceUrl: "https://pubmed.ncbi.nlm.nih.gov/39436374/"
    }),
    paper({
      title: "Foundation models in ophthalmology",
      doi: "10.1136/bjo-2024-325459", journalKey: "british", year: 2024,
      roles: [], workType: "review", source: "期刊原文",
      evidence: "这篇综述有 6 名作者，Yukun Zhou 署名第 3。期刊首页将 Pearse A. Keane 列为通讯作者。",
      evidenceUrl: "https://bjo.bmj.com/content/bjophthalmol/early/2024/06/10/bjo-2024-325459.full.pdf"
    }),
    paper({
      title: "A foundation model for generalizable disease detection from retinal images",
      doi: "10.1038/s41586-023-06555-x", journalKey: "nature", year: 2023,
      roles: ["first", "corresponding", "cocorresponding"], source: "期刊原文",
      evidence: "Yukun Zhou 署名第 1。原文首页在他与 Pearse A. Keane 的名字旁均标注通讯符号，并分别给出通讯地址。",
      evidenceUrl: "https://www.nature.com/articles/s41586-023-06555-x.pdf"
    }),
    paper({
      title: "Retinal Optical Coherence Tomography Features Associated With Incident and Prevalent Parkinson Disease",
      doi: "10.1212/WNL.0000000000207727", journalKey: "neurology", year: 2023,
      roles: [], source: "期刊原文",
      evidence: "Yukun Zhou 署名第 6。该文首页列出的通讯作者为 Siegfried Karl Wagner。",
      evidenceUrl: "https://ora.ox.ac.uk/objects/uuid%3Aeb5f8520-b76c-49d6-b449-1f595edee5fc/files/svt150m02z"
    }),
    paper({
      title: "AutoMorph: Automated Retinal Vascular Morphology Quantification Via a Deep Learning Pipeline",
      doi: "10.1167/tvst.11.7.12", journalKey: "tvst", year: 2022,
      roles: ["first"], roleUnknown: true, source: "PubMed 署名",
      evidence: "PubMed 作者名单将 Yukun Zhou 列为第 1，关联 UCL 和 Moorfields。此条仅核对署名顺序。",
      evidenceUrl: "https://pubmed.ncbi.nlm.nih.gov/35833885/"
    }),
    paper({
      title: "A refined equilibrium generative adversarial network for retinal vessel segmentation",
      doi: "10.1016/j.neucom.2020.06.143", journalKey: "neurocomputing", year: 2021,
      roles: ["first"], roleUnknown: true, source: "UCL 机构库",
      evidence: "UCL Discovery 的个人成果与论文条目均列 Zhou 为首位，OpenAlex 的同 DOI 记录给出全名 Yukun Zhou。共同贡献与通讯标注待核。",
      evidenceUrl: "https://discovery.ucl.ac.uk/id/eprint/10137825/"
    })
  ];

  window.AtlasSample = {
    name: "Yukun Zhou",
    affiliation: "University College London · Moorfields Eye Hospital",
    orcid: "0000-0002-0840-6422",
    note: "选录 2021–2026 年 13 篇眼底 AI 相关期刊成果，含一篇通讯来信和一篇综述。统计范围仅限这份示例清单。",
    source: "期刊原文、PubMed 与 UCL Discovery",
    records
  };
})();

