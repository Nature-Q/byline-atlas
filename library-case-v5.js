(() => {
  "use strict";

  const name = "Kaiming He";
  const faculty = "https://www.eecs.mit.edu/people/kaiming-he/";
  const website = "https://people.csail.mit.edu/kaiming/";
  const catalog = website + "publications.html";
  const scholar = "https://scholar.google.com/citations?user=DhtAFkwAAAAJ";
  const verifiedOn = "2026-11-27";

  // The two conference series are a bounded, reproducible subset of the author's own catalog.
  // Columns: conference year, venue, title, ordered authors, paper link from the catalog.
  const papers = [
    [2026,"CVPR","Bidirectional Normalizing Flow: From Data to Noise and Back",["Yiyang Lu","Qiao Sun","Xianbang Wang","Zhicheng Jiang","Hanhong Zhao","Kaiming He"],"https://arxiv.org/abs/2512.10953"],
    [2026,"CVPR","Improved Mean Flows: On the Challenges of Fastforward Generative Models",["Zhengyang Geng","Yiyang Lu","Zongze Wu","Eli Shechtman","J. Zico Kolter","Kaiming He"],"https://arxiv.org/abs/2512.02012"],
    [2026,"CVPR","ARC Is a Vision Problem!",["Keya Hu","Ali Cy","Linlu Qiu","Xiaoman Delores Ding","Runqian Wang","Yeyin Eva Zhu","Jacob Andreas","Kaiming He"],"https://arxiv.org/abs/2511.14761"],
    [2026,"CVPR","Back to Basics: Let Denoising Generative Models Denoise",["Tianhong Li","Kaiming He"],"https://arxiv.org/abs/2511.13720"],
    [2025,"CVPR","Transformers without Normalization",["Jiachen Zhu","Xinlei Chen","Kaiming He","Yann LeCun","Zhuang Liu"],"https://arxiv.org/abs/2503.10622"],
    [2023,"CVPR","Scaling Language-Image Pre-training via Masking",["Yanghao Li","Haoqi Fan","Ronghang Hu","Christoph Feichtenhofer","Kaiming He"],"https://arxiv.org/abs/2212.00794"],
    [2022,"CVPR","Masked Autoencoders Are Scalable Vision Learners",["Kaiming He","Xinlei Chen","Saining Xie","Yanghao Li","Piotr Dollár","Ross Girshick"],"https://arxiv.org/abs/2111.06377"],
    [2021,"ICCV","An Empirical Study of Training Self-Supervised Vision Transformers",["Xinlei Chen","Saining Xie","Kaiming He"],"https://arxiv.org/abs/2104.02057"],
    [2021,"CVPR","A Large-Scale Study on Unsupervised Spatiotemporal Representation Learning",["Christoph Feichtenhofer","Haoqi Fan","Bo Xiong","Ross Girshick","Kaiming He"],"https://arxiv.org/abs/2104.14558"],
    [2021,"CVPR","Exploring Simple Siamese Representation Learning",["Xinlei Chen","Kaiming He"],"https://arxiv.org/abs/2011.10566"],
    [2020,"CVPR","Momentum Contrast for Unsupervised Visual Representation Learning",["Kaiming He","Haoqi Fan","Yuxin Wu","Saining Xie","Ross Girshick"],"https://arxiv.org/abs/1911.05722"],
    [2020,"CVPR","PointRend: Image Segmentation as Rendering",["Alexander Kirillov","Yuxin Wu","Kaiming He","Ross Girshick"],"https://arxiv.org/abs/1912.08193"],
    [2020,"CVPR","A Multigrid Method for Efficiently Training Video Models",["Chao-Yuan Wu","Ross Girshick","Kaiming He","Christoph Feichtenhofer","Philipp Krähenbühl"],"https://arxiv.org/abs/1912.00998"],
    [2020,"CVPR","Designing Network Design Spaces",["Ilija Radosavovic","Raj Prateek Kosaraju","Ross Girshick","Kaiming He","Piotr Dollár"],"https://arxiv.org/abs/2003.13678"],
    [2019,"ICCV","Exploring Randomly Wired Neural Networks for Image Recognition",["Saining Xie","Alexander Kirillov","Ross Girshick","Kaiming He"],"https://arxiv.org/abs/1904.01569"],
    [2019,"ICCV","SlowFast Networks for Video Recognition",["Christoph Feichtenhofer","Haoqi Fan","Jitendra Malik","Kaiming He"],"https://arxiv.org/abs/1812.03982"],
    [2019,"ICCV","Deep Hough Voting for 3D Object Detection in Point Clouds",["Charles R. Qi","Or Litany","Kaiming He","Leonidas J. Guibas"],"https://arxiv.org/abs/1904.09664"],
    [2019,"ICCV","TensorMask: A Foundation for Dense Object Segmentation",["Xinlei Chen","Ross Girshick","Kaiming He","Piotr Dollár"],"https://arxiv.org/abs/1903.12174"],
    [2019,"ICCV","Rethinking ImageNet Pre-training",["Kaiming He","Ross Girshick","Piotr Dollár"],"https://arxiv.org/abs/1811.08883"],
    [2019,"CVPR","Feature Denoising for Improving Adversarial Robustness",["Cihang Xie","Yuxin Wu","Laurens van der Maaten","Alan Yuille","Kaiming He"],"https://arxiv.org/abs/1812.03411"],
    [2019,"CVPR","Long-Term Feature Banks for Detailed Video Understanding",["Chao-Yuan Wu","Christoph Feichtenhofer","Haoqi Fan","Kaiming He","Philipp Krähenbühl","Ross Girshick"],"https://arxiv.org/abs/1812.05038"],
    [2019,"CVPR","Panoptic Feature Pyramid Networks",["Alexander Kirillov","Ross Girshick","Kaiming He","Piotr Dollár"],"https://arxiv.org/abs/1901.02446"],
    [2019,"CVPR","Panoptic Segmentation",["Alexander Kirillov","Kaiming He","Ross Girshick","Carsten Rother","Piotr Dollár"],"https://arxiv.org/abs/1801.00868"],
    [2018,"CVPR","Non-local Neural Networks",["Xiaolong Wang","Ross Girshick","Abhinav Gupta","Kaiming He"],"https://arxiv.org/abs/1711.07971"],
    [2018,"CVPR","Data Distillation: Towards Omni-Supervised Learning",["Ilija Radosavovic","Piotr Dollár","Ross Girshick","Georgia Gkioxari","Kaiming He"],"https://arxiv.org/abs/1712.04440"],
    [2018,"CVPR","Detecting and Recognizing Human-Object Interactions",["Georgia Gkioxari","Ross Girshick","Piotr Dollár","Kaiming He"],"https://arxiv.org/abs/1704.07333"],
    [2018,"CVPR","Learning to Segment Every Thing",["Ronghang Hu","Piotr Dollár","Kaiming He","Trevor Darrell","Ross Girshick"],"https://arxiv.org/abs/1711.10370"],
    [2017,"ICCV","Mask R-CNN",["Kaiming He","Georgia Gkioxari","Piotr Dollár","Ross Girshick"],"https://arxiv.org/abs/1703.06870"],
    [2017,"ICCV","Focal Loss for Dense Object Detection",["Tsung-Yi Lin","Priya Goyal","Ross Girshick","Kaiming He","Piotr Dollár"],"https://arxiv.org/abs/1708.02002"],
    [2017,"ICCV","Transitive Invariance for Self-supervised Visual Representation Learning",["Xiaolong Wang","Kaiming He","Abhinav Gupta"],"https://arxiv.org/abs/1708.02901"],
    [2017,"CVPR","Feature Pyramid Networks for Object Detection",["Tsung-Yi Lin","Piotr Dollár","Ross Girshick","Kaiming He","Bharath Hariharan","Serge Belongie"],"https://arxiv.org/abs/1612.03144"],
    [2017,"CVPR","Aggregated Residual Transformations for Deep Neural Networks",["Saining Xie","Ross Girshick","Piotr Dollár","Zhuowen Tu","Kaiming He"],"https://arxiv.org/abs/1611.05431"],
    [2016,"CVPR","Deep Residual Learning for Image Recognition",["Kaiming He","Xiangyu Zhang","Shaoqing Ren","Jian Sun"],"https://arxiv.org/abs/1512.03385"],
    [2016,"CVPR","Instance-aware Semantic Segmentation via Multi-task Network Cascades",["Jifeng Dai","Kaiming He","Jian Sun"],"https://arxiv.org/abs/1512.04412"],
    [2016,"CVPR","ScribbleSup: Scribble-Supervised Convolutional Networks for Semantic Segmentation",["Di Lin","Jifeng Dai","Jiaya Jia","Kaiming He","Jian Sun"],"https://arxiv.org/abs/1604.05144"],
    [2015,"ICCV","BoxSup: Exploiting Bounding Boxes to Supervise Convolutional Networks for Semantic Segmentation",["Jifeng Dai","Kaiming He","Jian Sun"],"https://arxiv.org/abs/1503.01640"],
    [2015,"ICCV","Delving Deep into Rectifiers: Surpassing Human-Level Performance on ImageNet Classification",["Kaiming He","Xiangyu Zhang","Shaoqing Ren","Jian Sun"],"https://arxiv.org/abs/1502.01852"],
    [2015,"CVPR","Convolutional Neural Networks at Constrained Time Cost",["Kaiming He","Jian Sun"],"https://arxiv.org/abs/1412.1710"],
    [2015,"CVPR","Convolutional Feature Masking for Joint Object and Stuff Segmentation",["Jifeng Dai","Kaiming He","Jian Sun"],"https://arxiv.org/abs/1412.1283"],
    [2015,"CVPR","Efficient and Accurate Approximations of Nonlinear Convolutional Networks",["Xiangyu Zhang","Jianhua Zou","Xiang Ming","Kaiming He","Jian Sun"],"https://arxiv.org/abs/1505.06798"],
    [2015,"CVPR","Sparse Projections for High-Dimensional Binary Codes",["Yan Xia","Kaiming He","Pushmeet Kohli","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/cvpr15spbe.pdf"],
    [2015,"CVPR","A Geodesic-Preserving Method for Image Warping",["Dongping Li","Kaiming He","Jian Sun","Kun Zhou"],"https://people.csail.mit.edu/kaiming/publications/cvpr15warp.pdf"],
    [2014,"CVPR","Product Sparse Coding",["Tiezheng Ge","Kaiming He","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/cvpr14psc.pdf"],
    [2013,"ICCV","Content-Aware Rotation",["Kaiming He","Huiwen Chang","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/iccv13car.pdf"],
    [2013,"ICCV","Joint Inverted Indexing",["Yan Xia","Kaiming He","Fang Wen","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/iccv13jkm.pdf"],
    [2013,"ICCV","Constant Time Weighted Median Filtering for Stereo Matching and Beyond",["Ziyang Ma","Kaiming He","Yichen Wei","Jian Sun","Enhua Wu"],"https://people.csail.mit.edu/kaiming/publications/iccv13wmf.pdf"],
    [2013,"CVPR","Optimized Product Quantization for Approximate Nearest Neighbor Search",["Tiezheng Ge","Kaiming He","Qifa Ke","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/cvpr13opq.pdf"],
    [2013,"CVPR","K-means Hashing: an Affinity-Preserving Quantization Method for Learning Binary Compact Codes",["Kaiming He","Fang Wen","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/cvpr13kmh.pdf"],
    [2012,"CVPR","Computing Nearest-Neighbor Fields via Propagation-Assisted KD-Trees",["Kaiming He","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/cvpr12nnf.pdf"],
    [2011,"CVPR","A Global Sampling Method for Alpha Matting",["Kaiming He","Christoph Rhemann","Carsten Rother","Xiaoou Tang","Jian Sun"],"https://people.csail.mit.edu/kaiming/publications/cvpr11matting.pdf"],
    [2010,"CVPR","Fast Matting using Large Kernel Matting Laplacian Matrices",["Kaiming He","Jian Sun","Xiaoou Tang"],"https://people.csail.mit.edu/kaiming/publications/cvpr10matting.pdf"],
    [2009,"CVPR","Single Image Haze Removal using Dark Channel Prior",["Kaiming He","Jian Sun","Xiaoou Tang"],"https://people.csail.mit.edu/kaiming/publications/cvpr09.pdf"]
  ];

  const warping = "https://people.csail.mit.edu/kaiming/publications/cvpr15warp.pdf";
  const specialties = new Map([
    ["https://arxiv.org/abs/1812.03982", {
      name: "Jitendra Malik", category: "美国国家科学院院士", year: 2015,
      source: "https://news.berkeley.edu/2015/04/28/five-berkeley-scientists-named-to-national-academy/",
      identitySource: "https://people.eecs.berkeley.edu/~malik/malik-cv-full.pdf"
    }],
    [warping, {
      name: "Kun Zhou", category: "国家杰出青年科学基金获得者", year: 2008,
      source: "https://mip.ecnu.edu.cn/a5/7d/c2120a435581/page.htm",
      identitySource: "https://person.zju.edu.cn/kunzhou"
    }]
  ]);

  function record([year, journal, title, orderedAuthors, url]) {
    const authors = [...orderedAuthors];
    const byline = authors.map((author, i) => ({
      name: author,
      position: i === 0 ? "first" : i === authors.length - 1 ? "last" : "middle",
      isTarget: author === name
    }));
    if (url === warping) {
      // The two superscripts on the first page identify affiliations for all four authors.
      for (const person of byline) {
        const atZhejiang = ["Dongping Li", "Kun Zhou"].includes(person.name);
        person.institutions = [{name: atZhejiang ? "Zhejiang University" : "Microsoft Research"}];
      }
    }
    const distinction = specialties.get(url);
    const first = authors[0] === name;
    return {
      id: url, title, year, journal, workType: "conference-paper", authors, byline, url,
      roles: first ? ["first"] : [], roleUnknown: true, firstUnit: null,
      source: "MIT · 作者公开论文目录", evidenceUrl: url,
      evidence: "目录列有完整作者顺序。通讯与共同贡献须逐篇核对原文声明。",
      identityStatus: "supported", identityPending: false, identityBasis: "publication",
      identityEvidence: "MIT EECS 教师页链接至这位作者的主页，论文列在本人公开成果目录内。",
      identityEvidenceUrl: catalog,
      provenance: [{source: "MIT 作者目录", id: title, url: catalog}, {source: "论文原文", id: url, url}],
      contribution: {coauthors: authors.filter(author => author !== name)},
      distinctions: distinction ? [{...distinction, bylineSource: url}] : []
    };
  }

  function scope() {
    const records = papers.map(record);
    return {
      mode: "author", kind: "public-bibliography", name, displayName: "Kaiming He · 何恺明",
      affiliation: "Massachusetts Institute of Technology", records, total: records.length,
      source: "MIT 作者公开论文目录", website, catalog, scholarUrl: scholar, verifiedOn,
      note: "收录作者公开目录中 2009–2026 年的 " + records.length + " 篇 CVPR / ICCV 会议论文。逐篇链接到论文原文或作者稿。其他会议及期刊未纳入此样本。",
      candidate: {id: website, provider: "MIT", name, aliases: [name, "何恺明"], url: faculty, affiliation: "Massachusetts Institute of Technology", scholarId: "DhtAFkwAAAAJ"}
    };
  }
  window.AtlasLibraryCaseV5 = Object.freeze({scope, catalog, faculty, scholar, verifiedOn});
})();
