
(() => {
  'use strict';

  const tvst = ['Translational Vision Science & Technology', '2164-2591'];
  const nature = ['Nature', '0028-0836', '1476-4687'];
  const natureMedicine = ['Nature Medicine', '1078-8956', '1546-170X'];

  function publication(title, doi, journalInfo, year, firstUnit, source, evidenceUrl, evidence, workType = 'article') {
    const [journal, ...issn] = journalInfo;
    return {
      id: doi, title, doi, journal, issn, year, firstUnit, source, evidenceUrl, evidence, workType,
      url: `https://doi.org/${doi}`, roles: [], roleUnknown: true
    };
  }

  window.AtlasOrgSample = {
    name: 'University College London',
    affiliation: '英国伦敦 · 精选论文',
    note: '选录 2020–2025 年 5 篇有 UCL 作者参与的眼科论文。第一单位按首位作者的首条署名认定，联合中心的归属单列待核。',
    source: '期刊原文、PubMed 与 UCL Discovery',
    records: [
      publication(
        'Building the world’s first truly global medical foundation model',
        '10.1038/s41591-025-03859-5', natureMedicine, 2025, false, '期刊原文',
        'https://www.nature.com/articles/s41591-025-03859-5',
        '首位作者 Yih Chung Tham 的第一单位是新加坡国立大学医学院眼科。UCL 眼科研究所列于 Paul Nderitu、Yukun Zhou 等合作者的署名中。', 'letter'
      ),
      publication(
        'Retinal Microvascular Biomarker Assessment With Automated Algorithm and Semiautomated Software in the Montrachet Dataset',
        '10.1167/tvst.14.3.13', tvst, 2025, false, 'PubMed 署名',
        'https://pubmed.ncbi.nlm.nih.gov/40072417/',
        '首位作者 Pétra Eid 的第一单位是法国第戎大学医院眼科。Pearse Andrew Keane、Yukun Zhou 与 Siegfried Wagner 均列 UCL 眼科研究所为署名单位之一。'
      ),
      publication(
        'A foundation model for generalizable disease detection from retinal images',
        '10.1038/s41586-023-06555-x', nature, 2023, true, '期刊原文',
        'https://www.nature.com/articles/s41586-023-06555-x.pdf',
        '首位作者 Yukun Zhou 的署名依次标有 1、2、3。地址 1 为 UCL 医学图像计算中心，地址 2 为 Moorfields 的 NIHR 研究中心。'
      ),
      publication(
        'AutoMorph: Automated Retinal Vascular Morphology Quantification Via a Deep Learning Pipeline',
        '10.1167/tvst.11.7.12', tvst, 2022, true, 'UCL 收录的期刊原文',
        'https://discovery.ucl.ac.uk/10152499/1/Keane_i2164-2591-11-7-12_1657702188.55649.pdf',
        '首位作者 Yukun Zhou 的首条地址是 UCL 医学图像计算中心。Moorfields 与 UCL 眼科研究所的联合中心列在第二条。'
      ),
      publication(
        'Insights into Systemic Disease through Retinal Imaging-Based Oculomics',
        '10.1167/tvst.9.2.6', tvst, 2020, null, 'PubMed 署名',
        'https://pubmed.ncbi.nlm.nih.gov/32704412/',
        '首位作者 Siegfried K Wagner 的唯一地址把 Moorfields Eye Hospital NHS Foundation Trust 和 UCL Institute of Ophthalmology 同列为 NIHR 联合中心。按单一第一单位口径，需确认联合中心的认定规则。', 'review'
      )
    ]
  };
})();

