/* Observations on the selected bibliography. Unrecorded facts stay unknown. */
(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => (
    {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]
  ));

  // The arrays below are complete lists. A missing array means unknown;
  // an empty coauthor list means an explicitly verified single-author work.
  function keys(value, allowEmpty) {
    if (!Array.isArray(value) || (!allowEmpty && !value.length)) return null;
    if (value.some(k => typeof k !== 'string' || !k.trim())) return null;
    return new Set(value.map(k => k.normalize('NFKC').trim().toLowerCase()));
  }

  function leadStatus(row) {
    if (!Array.isArray(row.roles)) return null;
    if (row.roles.some(v => ['first', 'cofirst', 'corresponding', 'cocorresponding'].includes(v))) return true;
    return row.roleUnknown === false ? false : null;
  }

  function verifiedFact(value) {
    return typeof value === 'boolean' ? value : null;
  }

  function soloCorrespondent(row) {
    const value = verifiedFact(row.contribution?.soleCorresponding);
    if (value !== null) return value;
    if (!Array.isArray(row.roles)) return null;
    if (row.roles.includes('cocorresponding')) return false;
    if (row.roleUnknown !== false) return null;
    return row.roles.includes('corresponding');
  }

  function recordsInScope(rows) {
    const seen = new Set();
    return (Array.isArray(rows) ? rows : []).filter(row => {
      if (!row || row.excluded || row.identityPending || row.identityStatus === 'review') return false;
      const doi = String(row.doi || '').trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, '');
      const key = doi ? 'doi:' + doi : (row.id ? 'id:' + row.id : null);
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
  }

  function percent(n, d) {
    return new Intl.NumberFormat('zh-CN', {style:'percent', maximumFractionDigits:1}).format(n / d);
  }

  function proportion(observations) {
    const assessed = observations.filter(o => typeof o.value === 'boolean');
    const n = assessed.filter(o => o.value).length;
    return {
      value: assessed.length ? percent(n, assessed.length) : '待核',
      detail: assessed.length ? n + ' / ' + assessed.length + ' 篇' : '尚无可计入的分母',
      assessed: assessed.length,
      evidence: assessed.map(o => ({row:o.row, note:o.value ? '符合' : '不符合'}))
    };
  }

  function teamProfile(teams, repeat) {
    const complete = teams.filter(t => t.members !== null);
    const frequencies = new Map();
    for (const t of complete) {
      for (const key of t.members) frequencies.set(key, (frequencies.get(key) || 0) + 1);
    }
    const total = frequencies.size;
    const recurring = [...frequencies.values()].filter(n => n >= 2).length;
    let value = complete.length ? String(total) + ' 人' : '待核';
    let detail = '按合作者去重';
    if (repeat) {
      value = complete.length >= 2 && total ? percent(recurring, total) : '—';
      detail = complete.length < 2 ? '需两篇完整作者名单' : total ? recurring + ' / ' + total + ' 位合作者' : '完整名单中没有合作者';
    }
    return {value, detail, assessed:complete.length,
      evidence:complete.map(t => ({row:t.row, note:t.members.size + ' 位合作者'}))};
  }

  const definitions = [
    {id:'sole-correspondence', group:'独立性与科研主导', label:'唯一通讯作者占比',
      method:'本人为唯一通讯作者的篇数，除以能判定本人是否为唯一通讯的篇数。由他人担任通讯作者的论文计入分母。',
      compute:ctx => proportion(ctx.rows.map(row => ({row, value:soloCorrespondent(row)})))},
    {id:'beyond-mentorship', group:'独立性与科研主导', label:'导师未联署的主导论文占比',
      method:'在本人任一作、共一、通讯或共通的论文中，统计博士导师均未联署的比例。认定导师未联署需核实全部博士导师及完整作者名单。',
      compute:ctx => proportion(ctx.rows.filter(row => leadStatus(row) === true).map(row => {
        const joined = verifiedFact(row.contribution?.mentorCoauthored);
        return {row, value:joined === null ? null : !joined};
      }))},
    {id:'design-methods', group:'独立性与科研主导', label:'构思与方法双重贡献占比',
      method:'按作者贡献声明，计算本人同时承担研究构思（Conceptualization）和方法设计（Methodology）的篇数比例。仅纳入两项归属均有证据的论文。',
      compute:ctx => proportion(ctx.rows.map(row => {
        const design = verifiedFact(row.contribution?.conceptualization);
        const methods = verifiedFact(row.contribution?.methodology);
        return {row, value:design === null || methods === null ? null : design && methods};
      }))},
    {id:'coauthors', group:'合作结构', label:'不同合作者',
      method:'合并完整作者名单，移除本人后按合作者身份去重。数量随当前年份和统计范围变化。',
      compute:ctx => teamProfile(ctx.teams, false)},
    {id:'repeat-partners', group:'合作结构', label:'重复合作伙伴占比',
      method:'在至少两篇入选论文中与本人联署的合作者人数，除以全部可识别合作者人数。同一人在一篇中最多计一次。',
      compute:ctx => teamProfile(ctx.teams, true)},
    {id:'multi-institution', group:'合作结构', label:'多机构署名占比',
      method:'论文出现两个及以上不同机构的篇数，除以机构清单完整的篇数。同一作者署多个单位也会计入。',
      institution:true,
      compute:ctx => proportion(ctx.rows.map(row => {
        const units = keys(row.contribution?.institutions, false);
        return {row, value:units ? units.size >= 2 : null};
      }))}
  ];

  function evaluate(records, scope = {}) {
    const rows = recordsInScope(records);
    const teams = rows.map(row => ({row, members:keys(row.contribution?.coauthors, true)}));
    const ctx = {rows, teams};
    return definitions.filter(m => scope?.mode !== 'institution' || m.institution)
      .map(({compute, ...definition}) => ({...definition, ...compute(ctx), total:rows.length}));
  }

  function httpUrl(raw) {
    try {
      const url = new URL(raw);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function evidenceLine(id, item) {
    const r = item.row;
    const href = httpUrl(r.contribution?.evidenceUrl) || httpUrl(r.evidenceUrl) || httpUrl(r.url);
    const title = esc(r.title || r.doi || '论文');
    const paper = href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' : title;
    const mentor = id === 'beyond-mentorship' && httpUrl(r.contribution?.mentorEvidenceUrl);
    const source = mentor ? ' · <a href="' + esc(mentor) + '" target="_blank" rel="noopener noreferrer">导师依据</a>' : '';
    return '<li>' + paper + ' <span>' + esc(item.note) + '</span>' + source + '</li>';
  }

  function card(metric) {
    const evidence = metric.evidence.map(item => evidenceLine(metric.id, item)).join('');
    return '<details class="contrib-card"><summary><span class="contrib-label">' + esc(metric.label) +
      '</span><strong>' + esc(metric.value) + '</strong><span class="contrib-denom">' + esc(metric.detail) +
      '</span></summary><div class="contrib-evidence"><p>' + esc(metric.method) +
      '</p><p>本项纳入 ' + metric.assessed + ' 篇，当前范围 ' + metric.total + ' 篇。</p>' +
      (evidence ? '<ul>' + evidence + '</ul>' : '') + '</div></details>';
  }

  function render(records, scope) {
    const metrics = evaluate(records, scope);
    const groups = [...new Set(metrics.map(m => m.group))];
    return '<section class="panel contrib-panel" aria-label="科研贡献指标"><div class="contrib-header"><h2>科研贡献指标</h2>' +
      '<span>展开指标查看分母与论文依据</span></div>' + groups.map(group =>
        '<h3>' + group + '</h3><div class="contrib-grid">' +
        metrics.filter(m => m.group === group).map(card).join('') + '</div>'
      ).join('') + '<p class="contrib-foot">指标描述入选论文中的署名、贡献声明与合作情况。学科惯例、职业阶段和记录覆盖范围都会影响解读。</p></section>';
  }

  window.AtlasContributions = Object.freeze({render, evaluate});
})();