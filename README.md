# 署名图谱 · Byline Atlas

进入[公开工作台](https://nature-q.github.io/byline-atlas/)。可直接查看[钟志豪的论文署名卡](https://nature-q.github.io/byline-atlas/zhong.html)及[学者画像](https://nature-q.github.io/byline-atlas/#zhong)。

## 使用

1. 在多源检索中输入英文姓名或 ORCID。单位可填曾经工作过的机构。打开候选人后，各来源分别显示已读取范围和错误。可继续翻页，或把同一人的其他署名档案加入当前工作区。
2. 通过 Google Scholar 导出的 BibTeX 或 CSV 补入记录。使用自己的 SerpApi 服务时也可读取公开主页。[配置 Scholar 本机服务](server/scholar-relay/README.md)
3. 核对待确认记录后打开画像。单位轨迹按论文关联到本人的署名地址和发表年呈现。指标注明计算规则、证据和缺失项。手动权重仅作用于个人工作区。论文列表支持影响因子、JCR 和历史中科院分区筛选。年度影响因子 CSV 的列为 issn,year,jif,source，year 为指标年。
4. 在机构年度认领中选择机构、年份，导入有权使用的人员名册，在待核队列内核对实际署名、确认或撤回认领并导出年度 CSV。人员名册和认领记录保存在本浏览器。
5. AI 解读在用户确认后将所选书目信息发送至配置的接口。公共站支持本次调用使用个人 DeepSeek API 密钥。自托管时可接入同源登录会话与计量服务。[运行 AI 本机服务或对接账号后端](server/ai-relay/README.md)

## 部署与扩展

仓库根目录可直接部署在支持 HTTPS 的静态主机。开发时可在该目录运行 `python -m http.server 8080`。默认公开工作台无需登录。浏览器的本地工作区之间独立，用于协作认领的中心数据库、人员权限、审计留存和支付需部署服务端。

| 模块 | 职责 |
|---|---|
| federation.js、search-v3.js | 作者候选、分来源分批读取、跨库去重、证据冲突及人工核查 |
| retrieval.js、biomedical.js、evidence-v3.js | OpenAlex 与 Europe PMC 的逐作者元数据、地址及主题证据 |
| profile-v3.js、contributions.js | 署名单位轨迹、研究方向、合作指标与五项评价维度 |
| claims-v3.js | 机构年度工作台、名册匹配、认领审计与导出 |
| scholar-live.js、server/scholar-relay | 通过已有配额读取 Google Scholar 公开作者主页 |
| ai-v3.js、server/ai-relay | AI 证据包、逐篇引用、用量显示及账号接口 |
| imports.js、journal-imports.js、zhong.js | 书目导入、年度期刊数据、自带核查样本 |

当前个人原型使用公开数据接口。若运营收费产品，ORCID 要求另行安排适用的数据来源或会员接口。部署前可在 federation.js 载入前指定 `window.AtlasFederationConfig = {publicOrcidEnabled: false}` 来关闭 ORCID Public API。JIF、JCR 和历史中科院分区的全表展示与分发也需使用具备相应权限的数据。[ORCID Public API 使用说明](https://info.orcid.org/documentation/integration-guide/registering-a-public-api-client/)
