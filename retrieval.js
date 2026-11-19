/* Public bibliographic data. Search and article review are performed in the visitor's browser. */
(() => {
  'use strict';

  const OA = 'https://api.openalex.org/';
  const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/';
  const MAX_WORKS = 100;
  let apiKey = '';

  const compact = value => String(value || '').trim().replace(/\s+/g, ' ');
  const norm = value => compact(value).normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '');
  const shortId = value => compact(value).replace(/^https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/|institutions\/|works\/)?/i, '').replace(/\/$/, '').toUpperCase();
  const orgMode = mode => ['institution', 'institutions', 'org', 'school', '机构'].includes(mode);
  const unique = values => [...new Set(values.filter(Boolean))];
  const doiValue = value => compact(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'').replace(/^doi:\s*/i,'').toLowerCase();
  const orcidValue = value => compact(value).replace(/^https?:\/\/orcid\.org\//i,'').replace(/\/$/,'').toUpperCase();
  const validOrcid = value => /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value);
  const localOrgs = {
    '北京大学': 'Peking University', '清华大学': 'Tsinghua University', '浙江大学': 'Zhejiang University',
    '上海交通大学': 'Shanghai Jiao Tong University', '复旦大学': 'Fudan University',
    '中山大学': 'Sun Yat-sen University', '南京大学': 'Nanjing University', '武汉大学': 'Wuhan University',
    '中国科学院': 'Chinese Academy of Sciences', '中国科学院大学': 'University of Chinese Academy of Sciences',
    '卡迪夫大学': 'Cardiff University', '香港大学': 'University of Hong Kong',
  };

  async function request(base, path, params = {}, xml = false) {
    const url = new URL(path, base);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const headers = {Accept: xml ? 'application/xml' : 'application/json'};
    if (base === OA && apiKey) headers.Authorization = 'Bearer ' + apiKey;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), xml ? 25000 : 16000);
    const provider = base === OA ? 'OpenAlex' : 'Europe PMC';
    try {
      const response = await fetch(url, {headers, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'});
      if (!response.ok) {
        const messages = {
          400: '数据源无法处理此查询，请检查检索词或标识符。',
          401: '数据源要求有效的 API key。',
          403: '数据源拒绝此次访问，可能与访问额度或授权有关。',
          404: xml ? '暂未提供可读取的开放全文 XML。' : '未找到此标识符的记录。',
          429: '当前访问额度已用完，请稍后再试。',
        };
        const error = new Error(provider + '：' + (messages[response.status] || '服务暂不可用。') + '（HTTP ' + response.status + '）');
        error.status = response.status;
        throw error;
      }
      return xml ? await response.text() : await response.json();
    } catch (error) {
      if (error.status) throw error;
      if (error.name === 'AbortError') throw new Error(provider + ' 响应超时，请重试。');
      throw new Error(provider + ' 连接失败，请检查网络连接后重试。');
    } finally {
      clearTimeout(timer);
    }
  }

  function formatCandidate(entity, isOrg, hint) {
    const recent = (entity.last_known_institutions || []).map(i => i.display_name);
    const history = (entity.affiliations || []).map(a => a.institution?.display_name);
    const names = unique([...recent, ...history]);
    const needle = norm(localOrgs[hint] || hint);
    const matched = needle && names.find(name => norm(name).includes(needle));
    const orcid = orcidValue(entity.orcid);
    const id = shortId(entity.id);
    const area = [entity.geo?.city, entity.country_code].filter(Boolean).join(' · ');
    const detail = [id, isOrg ? entity.type : (validOrcid(orcid) ? 'ORCID ' + orcid : ''), matched ? '单位线索匹配' : ''].filter(Boolean).join(' · ');
    return {
      id, name: entity.display_name || id, affiliation: isOrg ? area : (matched || recent[0] || names[0] || '单位信息待补充'), detail,
      orcid: validOrcid(orcid) ? orcid : '', ror: entity.ror || '', matched: !!matched,
      aliases: isOrg ? unique([entity.display_name, ...(entity.display_name_alternatives || []), entity.international?.display_name?.zh]) : [],
    };
  }

  async function search(mode, query, affiliation = '') {
    const input = compact(query);
    if (!input) throw new Error('请输入姓名、机构名称或学术标识符。');
    if (/^(?:https?:\/\/)?scholar\.google\.[^/]+(?:\/|$)/i.test(input)) {
      throw new Error('Google Scholar 主页链接不能直接解析。请使用主页上的英文署名和单位，或输入 ORCID 识别作者。');
    }
    const isOrg = orgMode(mode);
    const entityType = isOrg ? 'institutions' : 'authors';
    const id = shortId(input);
    const orcid = orcidValue(input);
    const formatted = entity => {
 const c=formatCandidate(entity,isOrg,compact(affiliation));if(isOrg)return c;
 c.affiliationHint=compact(affiliation);c.requestedOrcid=validOrcid(orcid)?orcid:"";c.observedOrcids=[...new Set([entity.orcid,...(entity.observed_orcids||[]),...(entity.ids?.observed_orcids||[])].map(orcidValue).filter(validOrcid))];
 if(c.observedOrcids.length>1)c.detail+=" · 该档案有 "+c.observedOrcids.length+" 个 ORCID，须核实逐篇归属";return c;
};
    let directID = '';
    if (/^[AI]\d+$/.test(id)) {
      if (!id.startsWith(isOrg ? 'I' : 'A')) throw new Error('标识符与当前检索类型不一致，请切换学者或机构。');
      directID = id;
    } else if (validOrcid(orcid)) {
      if (isOrg) throw new Error('ORCID 属于个人标识符，请切换到学者检索。');
      directID = 'https://orcid.org/' + orcid;
    } else if (/^https?:\/\//i.test(input)) {
      throw new Error('支持 OpenAlex 或 ORCID 链接。也可以使用英文署名或机构名称检索。');
    }
    if (directID) {
      try { return [formatted(await request(OA, entityType + '/' + directID))]; }
      catch (error) { if (error.status === 404) return []; throw error; }
    }
    const params = {search: (isOrg && localOrgs[input]) || input, per_page: 40};
    const ordinary = request(OA, entityType, params);
    let preferred = Promise.resolve([]);
    if (!isOrg && compact(affiliation)) {
      // The second search finds current affiliations outside the first page for common names.
      // Preserve ordinary candidates because researchers move and some affiliations are missing.
      preferred = (async () => {
        const institutions = await request(OA, 'institutions', {search: localOrgs[compact(affiliation)] || compact(affiliation), per_page: 2});
        const ids = (institutions.results || []).map(i => shortId(i.id)).filter(i => /^I\d+$/.test(i));
        if (!ids.length) return [];
        const hits = await request(OA, 'authors', {...params, per_page: 12, filter: 'last_known_institutions.id:' + ids.join('|')});
        return hits.results || [];
      })().catch(() => []);
    }
    const [general, narrowed] = await Promise.all([ordinary, preferred]);
    const candidates = [...narrowed, ...(general.results || [])].map(formatted);
    return [...new Map(candidates.map(c => [c.id,c])).values()].sort((a,b) => Number(b.matched) - Number(a.matched));
  }

  function firstAddress(authorship, id) {
    if (!authorship) return {value:null, note:'缺少首位作者记录。'};
    const strings = unique((authorship.raw_affiliation_strings || []).map(compact));
    const rows = authorship.affiliations || [];
    if (strings.length !== 1) return {value:null, note:'首位作者的地址缺失或有多个地址，需要核查原文次序。'};
    const matches = rows.filter(a => compact(a.raw_affiliation_string) === strings[0]);
    const ids = unique(matches.flatMap(a => a.institution_ids || []).map(shortId));
    if (ids.length !== 1) return {value:null, note:'首位作者的原始地址无法唯一映射到机构。'};
    return {value:ids[0] === id, note:'按首位作者唯一原始地址及 OpenAlex 唯一机构映射判断：' + strings[0] + '（' + ids[0] + '）。'};
  }

  function identityFor(work, candidate, authorship) {
 const id=v=>String(v||"").replace(/^https?:\/\/(?:api\.)?openalex\.org\//i,"").toUpperCase();
 const orcid=v=>String(v||"").replace(/^https?:\/\/orcid.org\//i,"").trim().toUpperCase();
 const canon=v=>String(v||"").normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
 const matches=(work.authorships||[]).filter(a=>id(a.author?.id)===id(candidate.id));
 const raw=orcid(authorship?.raw_orcid),target=orcid(candidate.requestedOrcid);
 const observed=[...new Set([...(candidate.observedOrcids||[]),...(authorship?.author?.observed_orcids||[])].map(orcid).filter(Boolean))];
 const result=(pending,basis,evidence)=>({identityPending:pending,identityStatus:pending?"review":"supported",identityBasis:basis,identityEvidence:evidence});
 if(matches.length!==1||!authorship)return result(true,"review","逐篇记录无法唯一定位该作者的署名行。");
 if(raw&&(work.authorships||[]).filter(a=>orcid(a.raw_orcid)===raw).length>1)return result(true,"review","同一篇论文的多个署名行登记了同一个原始 ORCID。");
 if(!target&&raw&&observed.length&&!observed.includes(raw))return result(true,"review","逐篇原始 ORCID 与所选作者档案的标识列表不一致。");
 if(target&&raw&&raw!==target)return result(true,"review","逐篇 ORCID "+raw+" 与检索的 "+target+" 不同。");
 if(target&&raw===target)return result(false,"work-orcid","逐篇原始 ORCID 与检索标识一致："+raw+"。");
 const hint=String(candidate.affiliationHint||"").trim();const needle=canon(localOrgs[hint]||hint);
 const known={cardiff:"cardiff university","卡迪夫":"cardiff university","university of cardiff":"cardiff university","北大":"peking university","ucl":"university college london","卡迪夫大学":"cardiff university"};
 const wanted=known[needle]||needle;
 if(wanted){
  const own=authorship.institutions||[];
  const match=own.find(i=>canon(i.display_name)===wanted||id(i.id)===hint.toUpperCase());
  const address=(authorship.raw_affiliation_strings||[]).find(a=>{const norm=" "+canon(a)+" ";return wanted.length>=5&&wanted.includes(" ")&&norm.includes(" "+wanted+" ");});
  if(match||address)return result(false,"work-affiliation","该作者在本篇的署名单位与检索条件相符："+(match?.display_name||hint)+"。");
  return result(true,"review","该作者本篇署名单位与所填单位未能对应，跨单位任职可人工核对。");
 }
 if(observed.length>1||target)return result(true,"review",target?"未取得可与输入 ORCID 核对的逐篇原始 ORCID。":"同一作者档案收录多个 ORCID，需确认本人单位或逐篇标识。");
 return result(false,"cluster","依据所选 OpenAlex 作者档案归集，尚无独立的身份核查。");
}
  // Count identifiers attached to this publication's byline, never profile-level affiliations.
  // On list endpoints the 100th row can be the last available row of a truncated byline.
  function publicationContribution(work, target, isOrg) {
    const rows = work.authorships || [];
    const total = work.authors_count;
    const complete = rows.length > 0 && !work.is_authors_truncated &&
      (total == null || total === rows.length) &&
      (rows.length < 100 || work.is_authors_truncated === false || total === rows.length);
    const result = {};
    if (!complete) return result;
    const keys = rows.map(a => shortId(a.author?.id));
    const collective = /\b(?:consortium|collaboration|study group|investigators|working group|task force|committee)\b/i;
    const identifiable = rows.every((a,i) => /^A\d+$/.test(keys[i]) &&
      !['A9999999999','A5317838346'].includes(keys[i]) &&
      !collective.test(a.raw_author_name || a.author?.display_name || ''));
    if (!isOrg && identifiable && new Set(keys).size === keys.length && keys.includes(target)) {
      result.coauthors = keys.filter(key => key !== target).map(key => 'oa:' + key);
    }
    const units = new Set();
    // Every raw address must be mapped. An empty or partially resolved byline cannot prove
    // that a paper was written at a single institution.
    for (const a of rows) {
      const raw = unique((a.raw_affiliation_strings || []).map(compact));
      const mappings = a.affiliations || [];
      if (!raw.length || !raw.every(address => mappings.some(m =>
        compact(m.raw_affiliation_string) === address && m.institution_ids?.length))) return result;
      for (const entry of mappings) {
        if (!entry.institution_ids?.length) return result;
        for (const id of entry.institution_ids) {
          const institution = shortId(id);
          if (!/^I\d+$/.test(institution)) return result;
          units.add('oa:' + institution);
        }
      }
    }
    if (units.size) result.institutions = [...units];
    return result;
  }

  function normalizeWork(w, candidate, isOrg) {
    const authors = w.authorships || [];
    const authorId = shortId(candidate.id);
    const ours = a => isOrg ? (a.institutions || []).some(i => shortId(i.id) === authorId) : shortId(a.author?.id) === authorId;
    const matches = authors.filter(ours);
    const first = authors.find(a => a.author_position === 'first');
    const correspondents = new Set([...(w.corresponding_author_ids || []).map(shortId), ...authors.filter(a => a.is_corresponding).map(a => shortId(a.author?.id))].filter(Boolean));
    const roles = [];
    const notes = [];
    if (first && ours(first)) {
      roles.push('first');
      notes.push('OpenAlex 首位署名：' + (first.raw_author_name || first.author?.display_name || '已定位作者') + '。');
    }
    if (matches.some(a => a.is_corresponding || correspondents.has(shortId(a.author?.id))) || (!isOrg && correspondents.has(authorId))) {
      roles.push('corresponding');
      if (correspondents.size > 1) roles.push('cocorresponding');
      notes.push('OpenAlex 标记了' + correspondents.size + '位通讯作者。');
    }
    const unit = isOrg ? firstAddress(first, authorId) : {value:null, note:''};
    if (unit.note) notes.push(unit.note);
    if (!matches.length) notes.push('返回的作者列表未完整定位到此检索对象，需核对原始署名。');
    if (!roles.includes('corresponding')) notes.push('此对象的通讯身份未获元数据确认。');
    notes.push('共同第一作者需查原文贡献声明。');
    const src = w.primary_location?.source || {};
    const doi = doiValue(w.doi);
    const id = shortId(w.id);
    const mine = !isOrg ? matches[0] : null;
    return {
      id, title: compact(w.title || w.display_name) || '题名缺失', journal: compact(src.display_name) || '来源待核',
      year: w.publication_year || null, doi, url: doi ? 'https://doi.org/' + doi : 'https://openalex.org/' + id,
      issn: unique([src.issn_l, ...(src.issn || [])]).map(v => v.toUpperCase()),
      workType: w.type || 'unknown', roles, firstUnit: unit.value, source:'OpenAlex', evidence:notes.join(' '),
      contribution: publicationContribution(w, authorId, isOrg),
      byline: authors.map(a => ({
        name: compact(a.raw_author_name || a.author?.display_name),
        openAlexId: shortId(a.author?.id),
        orcid: orcidValue(a.raw_orcid),
        affiliations: unique((a.raw_affiliation_strings || []).map(compact)),
        isTarget: !isOrg && matches.length === 1 && a === mine
      })),
      // OpenAlex provides no complete shared-first-author field, even for a known first author.
      roleUnknown: true, pmcid: compact(w.ids?.pmcid).match(/PMC\d+/i)?.[0].toUpperCase() || '',
      rawAuthorName: compact(mine?.raw_author_name), workOrcid: orcidValue(mine?.raw_orcid),authorOrcid: orcidValue(mine?.raw_orcid), ...(!isOrg?identityFor(w,candidate,mine):{}),
    };
  }

  async function load(mode, candidate, options = {}) {
    const isOrg = orgMode(mode);
    const id = shortId(candidate?.id);
    if (!(isOrg ? /^I\d+$/ : /^A\d+$/).test(id)) throw new Error('请先选择有效的学者或机构候选人。');
    const field = isOrg ? 'authorships.institutions.id' : 'authorships.author.id';
    const year = compact(options.year);
    if (year && !/^[1-9]\d{3}$/.test(year)) throw new Error('发表年份应为四位数。');
    const keyed = Boolean(apiKey);
    const cursor = compact(options.cursor) || (keyed ? '*' : '');
    if (!keyed && cursor && cursor !== '*') throw new Error('继续获取下一页需要配置 OpenAlex API key 并重新检索。');
    const filters = [field + ':' + id, 'type:article|review', 'primary_location.source.type:journal'];
    if (year) filters.push('publication_year:' + year);
    const params = {
      filter: filters.join(','),
      sort:'publication_date:desc', per_page:MAX_WORKS,
      select:'id,title,publication_year,type,primary_location,doi,ids,authorships,corresponding_author_ids',
    };
    if (keyed) params.cursor = cursor;
    const result = await request(OA, 'works', params);
    if (!Array.isArray(result.results) || !Number.isFinite(result.meta?.count)) throw new Error('OpenAlex 返回的数据不完整，请重试。');
    const records = result.results.map(w => normalizeWork(w, candidate, isOrg));
    const total = result.meta.count;
    const returnedCursor = result.meta.next_cursor;
    const canAdvance = keyed && records.length > 0 && total > records.length;
    const nextCursor = canAdvance && typeof returnedCursor === 'string' && returnedCursor && returnedCursor !== cursor ? returnedCursor : null;
    const source = 'OpenAlex · ' + (year ? year + ' 年' : '') + '期刊论文及综述，按发表日期倒序';
    return {records, total, source, limited:total > records.length, nextCursor};
  }

  const selectAll = (node, selector) => [...node.querySelectorAll(selector)];
  const references = (node, kind) => selectAll(node, 'xref' + (kind ? '[ref-type="' + kind + '"]' : '')).flatMap(x => compact(x.getAttribute('rid')).split(' ').filter(Boolean));

  async function pmcIdentifier(record) {
    if (/^PMC\d+$/.test(record.pmcid || '')) return record.pmcid;
    const doi = doiValue(record.doi);
    if (!/^10\.\d{4,9}\/[^\s"]+$/i.test(doi)) throw new Error('此记录没有可用于匹配开放全文的 DOI 或 PMC 编号。');
    const data = await request(EPMC, 'search', {query:'DOI:"' + doi + '"', format:'json', pageSize:8});
    const hit = (data.resultList?.result || []).find(p => doiValue(p.doi) === doi && /^PMC\d+$/.test(p.pmcid || ''));
    if (!hit) throw new Error('Europe PMC 未找到此 DOI 对应的开放全文。可打开出版商页面人工核对。');
    return hit.pmcid;
  }

  function isSameContributor(node, record, candidate) {
    const candidateOrcid = orcidValue(candidate.requestedOrcid || (candidate.observedOrcids ? '' : candidate.orcid));
    const wantedOrcids = validOrcid(candidateOrcid) ? [candidateOrcid] : [orcidValue(record.workOrcid)].filter(validOrcid);
    const printedIds = selectAll(node, 'contrib-id[contrib-id-type="orcid"]').map(x => orcidValue(x.textContent)).filter(validOrcid);
    if (wantedOrcids.length && printedIds.length) return printedIds.some(id => wantedOrcids.includes(id));
    const surname = compact(node.querySelector('name > surname')?.textContent);
    const given = compact(node.querySelector('name > given-names')?.textContent);
    if (!surname || !given || !given.split(/[\s.-]+/).some(g => g.length > 1)) return false;
    const names = [candidate.name, record.rawAuthorName].filter(Boolean).map(norm);
    return [given + ' ' + surname, surname + ' ' + given].some(name => names.includes(norm(name)));
  }

  function evaluatePrintedUnit(meta, authors, linked, candidate) {
    const addresses = selectAll(meta, 'aff').filter(a => !a.closest('contrib'));
    const aff = addresses.find(a => compact(a.querySelector('label')?.textContent) === '1') || addresses[0];
    const first = authors[0];
    if (!aff || !first) return {value:null, note:'原文未提供可判断的机构次序。'};
    const firstRef = references(first,'aff')[0];
    if (!(firstRef && linked.get(firstRef) === aff) && !(addresses.length === 1 && !firstRef)) {
      return {value:null, note:'原文单位列表第一项与首位作者的第一地址无法同时确认。'};
    }
    const aliases = unique([candidate.name, ...(candidate.aliases || [])]).map(norm);
    const names = selectAll(aff, 'institution').map(x => norm(x.textContent));
    const rors = selectAll(aff,'institution-id[institution-id-type="ror"]').map(x => compact(x.textContent).split('/').pop());
    const ror = compact(candidate.ror).split('/').pop();
    const rorComparable = ror && rors.length > 0;
    const matches = rorComparable ? rors.length === 1 && rors.includes(ror) : names.length === 1 && aliases.includes(names[0]);
    if (matches) {
      return {value:true, note:'原文第一单位与首位作者第一地址一致，机构标识或全名匹配。'};
    }
    return {value:null, note:'原文第一地址未能唯一匹配所选机构，请核查机构名称、院系及附属关系。'};
  }

  function enrichPrintedContribution(record, meta, authors, mine, linked) {
    const result = {...record.contribution};
    if (!authors.length || meta.querySelector('contrib-group etal, contrib-group collab, contrib-group on-behalf-of, contrib-group > contrib:not([contrib-type])')) return result;
    if (!result.coauthors && mine) {
      const keys = authors.filter(a => a !== mine).map(a => {
        const ids = unique(selectAll(a,'contrib-id[contrib-id-type="orcid"]')
          .map(n => orcidValue(n.textContent)).filter(validOrcid));
        return ids.length === 1 && a.querySelector('name') ? ids[0] : '';
      });
      const mineIds = selectAll(mine,'contrib-id[contrib-id-type="orcid"]').map(n => orcidValue(n.textContent));
      if (keys.every(k => k && !mineIds.includes(k)) && new Set(keys).size === keys.length) {
        result.coauthors = keys.map(k => 'orcid:' + k);
      }
    }
    if (result.institutions) return result;
    const addresses = selectAll(meta, 'aff').filter(a => !a.closest('contrib'));
    const units = new Set();
    for (const author of authors) {
      const refs = references(author,'aff');
      const affs = [...selectAll(author, 'aff'), ...refs.map(ref => linked.get(ref))];
      if (!affs.length && addresses.length === 1) affs.push(addresses[0]);
      if (!affs.length) return result;
      for (const aff of affs) {
        if (aff?.localName !== 'aff') return result;
        const rors = selectAll(aff,'institution-id[institution-id-type="ror"]')
          .map(n => compact(n.textContent).toLowerCase().replace(/^https?:\/\/ror\.org\//,''));
        if (!rors.length || !rors.every(id => /^0[0-9a-z]{6}[0-9]{2}$/.test(id))) return result;
        rors.forEach(id => units.add('ror:' + id));
      }
    }
    if (units.size) result.institutions = [...units];
    return result;
  }

  async function verify(record, candidate, mode = 'author') {
    if (!candidate || !record) throw new Error('请先选择一条检索记录。');
    const pmcid = await pmcIdentifier(record);
    const xml = await request(EPMC, pmcid + '/fullTextXML', {}, true);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const meta = doc.querySelector('article > front > article-meta');
    if (!meta || doc.querySelector('parsererror')) throw new Error('开放全文没有可识别的出版商署名表。');
    const printedDoi = doiValue(meta.querySelector('article-id[pub-id-type="doi"]')?.textContent);
    if (printedDoi && record.doi && printedDoi !== doiValue(record.doi)) throw new Error('全文 DOI 与当前论文不一致，已停止自动核验。');
    const authors = selectAll(meta,'contrib-group > contrib[contrib-type="author"]').filter(c => !c.parentElement.closest('contrib'));
    const linked = new Map(selectAll(meta,'[id]').map(n => [n.id || n.getAttribute('id'),n]));
    const verified = {...record, roles:[...record.roles], pmcid, verificationUrl:'https://europepmc.org/articles/' + pmcid};
    let note = '';
    if (orgMode(mode)) {
      const unit = evaluatePrintedUnit(meta, authors, linked, candidate);
      verified.firstUnit = unit.value;
      verified.contribution = enrichPrintedContribution(record, meta, authors, null, linked);
      note = unit.note;
    } else {
      const mine = authors.filter(a => isSameContributor(a, record, candidate));
      if (mine.length !== 1) throw new Error('开放全文中的姓名或 ORCID 无法唯一对应所选作者，请在出版商页面核查。');
      const author = mine[0];
      verified.contribution = enrichPrintedContribution(record, meta, authors, author, linked);
      const notes = [];
      const roles = new Set();
      if (authors[0] === author) { roles.add('first'); notes.push('署名表列为第一位。'); }
      const corr = authors.filter(a => a.getAttribute('corresp') === 'yes' || references(a, 'corresp').some(id => linked.get(id)?.localName === 'corresp'));
      if (corr.includes(author)) {
        roles.add('corresponding');
        if (corr.length > 1) roles.add('cocorresponding');
        notes.push('原文标出' + corr.length + '位通讯作者。');
      }
      // Some footnotes explicitly state shared first authorship, others refer to equal supervision.
      // Treat only a linked, unambiguous first-authorship statement as proof of co-first status.
      const equal = references(author).map(id => linked.get(id)).filter(n => n?.localName === 'fn');
      const firstNote = equal.find(n => {
        const words = compact(n.textContent);
        const participants = authors.filter(a => references(a).includes(n.getAttribute('id')));
        return participants.length >= 2 && participants.includes(authors[0]) &&
          /\b(?:co[- ]?first authors?(?:hip)?|(?:share[ds]?|shared|joint)\s+(?:the\s+)?first authorship|joint first authors?)\b/i.test(words) &&
          !/\b(?:not|do not|did not)\b/i.test(words);
      });
      if (firstNote) {
        roles.add('cofirst');
        const quote = compact(firstNote.textContent);
        notes.push('所链接的贡献脚注：“' + (quote.length > 140 ? quote.slice(0,140) + '…' : quote) + '”。');
      }
      // Preserve separately sourced positive correspondence, but label its provenance explicitly.
      if (!roles.has('corresponding') && record.roles.includes('corresponding')) {
        roles.add('corresponding');
        if (record.roles.includes('cocorresponding')) roles.add('cocorresponding');
        notes.push('通讯身份来自 OpenAlex，全文结构化署名未能另行确认。');
      }
      if (!firstNote) {
        const equalOnly = author.getAttribute('equal-contrib') === 'yes' || equal.some(n => /contribut\w*\s+equally|equal\s+contribut/i.test(n.textContent));
        notes.push(equalOnly ? '原文存在同等贡献标记，具体是否共同第一作者仍需人工核对。' : '未检出指向该作者的明确共同第一作者声明。');
      }
      verified.roles = [...roles];
      // Positive roles can be counted even when another contribution is still unresolved.
      verified.roleUnknown = !roles.has('cofirst') || !roles.has('cocorresponding');
      note = notes.join(' ');
    }
    verified.source = record.source + ' + Europe PMC 原文';
    verified.evidence = pmcid + ' · ' + note + ' 原文：' + verified.verificationUrl;
    return verified;
  }

  window.ScholarSource = Object.freeze({search, load, verify, hasKey() { return Boolean(apiKey); }, setKey(value) { apiKey = compact(value); }});
})();
