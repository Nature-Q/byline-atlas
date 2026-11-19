# 署名图谱 · Byline Atlas

将本目录原样部署在支持 HTTPS 的静态站点，网站入口是 index.html。可在本目录运行 `python -m http.server 8080` 本地查看。内置钟志豪档案无需联网。实时检索和文献原文链接依赖相应外部服务。

## 扩展

- `contributions.js` 维护科研贡献指标清单，每个条目定义计算方法、分母、证据和显示名称。`contributions.css` 管理布局。
- `zhong.js` 保存已核对的作者、论文和年度期刊信息。引用证据来自出版商与高校知识库。论文归属取发表时的署名。
- `retrieval.js` 和 `biomedical.js` 是检索数据源。`imports.js` 和 `journal-imports.js` 实现本地导入。样本文件均保存在同目录。
- 期刊影响因子 CSV 包含 issn,year,jif,source 四列。year 为指标年。完整分区表可在工作台的数据导入页加载。用户导入的数据保存在当前浏览器。
