
(function () {
  'use strict';

  const green = '#165946';
  const sage = '#86a98d';
  const apricot = '#e9a473';
  const mist = '#dce1d8';

  function roleFlags(record) {
    const roles = Array.isArray(record.roles) ? record.roles : [];
    return {
      first: roles.includes('first') || roles.includes('cofirst'),
      corresponding: roles.includes('corresponding') || roles.includes('cocorresponding')
    };
  }

  function emptyState(message) {
    return `<div class="ac-empty" role="status" style="display:grid;place-items:center;min-height:138px;color:#66746b;font-size:13px">${message}</div>`;
  }

  function tickStep(maximum) {
    const target = Math.max(1, maximum / 3);
    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
    return [1, 2, 3, 5, 10].find(value => value * magnitude >= target) * magnitude;
  }

  function trend(records, mode) {
    const institution = mode === 'institution';
    const secondary = institution ? '第一单位' : '一作或通讯（含共同）';
    const byYear = new Map();
    for (const row of Array.isArray(records) ? records : []) {
      if (!row) continue;
      const year = Number(row.year);
      if (!Number.isInteger(year) || year < 1000 || year > 9999) continue;
      const counts = byYear.get(year) || { total: 0, leading: 0 };
      counts.total += 1;
      const roles = roleFlags(row);
      if (institution ? row.firstUnit === true : roles.first || roles.corresponding) counts.leading += 1;
      byYear.set(year, counts);
    }
    if (!byYear.size) return emptyState('暂无可按年份统计的论文');

    const years = Array.from(byYear.keys());
    const first = Math.min(...years);
    const last = Math.max(...years);
    const start = Math.max(first, last - 5);
    const series = Array.from({ length: last - start + 1 }, (_, i) => {
      const year = start + i;
      return { year, ...(byYear.get(year) || { total: 0, leading: 0 }) };
    });
    const maximum = Math.max(...series.map(item => item.total));
    const step = tickStep(maximum);
    const ceiling = Math.ceil(maximum / step) * step;
    const left = Math.max(28, String(ceiling).length * 7 + 9);
    const top = 14;
    const bottom = 124;
    const right = 470;
    const band = (right - left) / series.length;
    const width = Math.min(16, band * 0.23);
    const gap = Math.max(3, width * 0.25);
    const valueY = value => bottom - (bottom - top) * value / ceiling;
    const ticks = [];
    for (let value = 0; value <= ceiling; value += step) {
      const y = valueY(value);
      ticks.push(`<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${value ? '#e4e8e1' : '#c1cac0'}" ${value ? 'stroke-dasharray="3 4"' : ''}/><text x="${left - 8}" y="${y + 4}" text-anchor="end" fill="#647369" font-size="11">${value}</text>`);
    }
    const bars = series.map((item, i) => {
      const center = left + band * (i + 0.5);
      const values = [[item.total, center - gap / 2 - width, green], [item.leading, center + gap / 2, apricot]];
      const rectangles = values.filter(entry => entry[0] > 0).map(([value, x, color]) => {
        const y = valueY(value);
        return `<rect x="${x}" y="${y}" width="${width}" height="${bottom - y}" rx="2" fill="${color}"/>`;
      }).join('');
      return `<g><title>${item.year} 年 · 全部论文 ${item.total} 篇，${secondary} ${item.leading} 篇</title><rect x="${left + i * band}" y="${top}" width="${band}" height="${bottom - top}" fill="transparent"/>${rectangles}<text x="${center}" y="146" text-anchor="middle" fill="#546459" font-size="12">${item.year}</text></g>`;
    }).join('');
    const range = first < start ? `<span class="ac-range">仅显示 ${start}–${last} 年</span>` : '';
    const description = series.map(item => `${item.year} 年，全部论文 ${item.total} 篇，${secondary} ${item.leading} 篇`).join('。');
    // Only validated integers and fixed labels enter the SVG and accessible text.
    return `<style>
      .ac-trend{margin:0;min-width:0;font-variant-numeric:tabular-nums}
      .ac-trend svg{display:block;width:100%;height:clamp(130px,14vw,170px);overflow:visible;font-family:inherit}
      .ac-trend figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:5px 17px;color:#4c6054;font-size:12px;line-height:1.5;margin-top:6px}
      .ac-trend figcaption span{display:inline-flex;gap:6px;align-items:center}
      .ac-trend .ac-swatch{width:9px;height:9px;display:inline-block;border-radius:2px;flex:none}
      .ac-trend .ac-range{margin-left:auto;font-size:11px;color:#657166}
    </style><figure class="ac-trend"><svg viewBox="0 0 478 155" role="img" aria-label="${description}。" preserveAspectRatio="xMidYMid meet">${ticks.join('')}${bars}</svg><figcaption><span><i aria-hidden="true" class="ac-swatch" style="background:${green}"></i>全部论文</span><span><i aria-hidden="true" class="ac-swatch" style="background:${apricot}"></i>${secondary}</span>${range}</figcaption></figure>`;
  }

  function composition(records, mode) {
    const rows = Array.isArray(records) ? records.filter(Boolean) : [];
    if (!rows.length) return emptyState('暂无可统计的论文');
    const institution = mode === 'institution';
    const categories = institution
      ? [['第一单位', green], ['非第一单位', sage], ['归属待核', mist]]
      : [['一作兼通讯', green], ['仅一作（含共一）', sage], ['仅通讯（含共通）', apricot], ['其余或待核', mist]];
    const counts = categories.map(() => 0);
    for (const row of rows) {
      if (institution) {
        counts[row.firstUnit === true ? 0 : row.firstUnit === false ? 1 : 2]++;
      } else {
        const {first, corresponding} = roleFlags(row);
        counts[first ? (corresponding ? 0 : 1) : (corresponding ? 2 : 3)]++;
      }
    }

    const total = rows.length;
    let offset = 0;
    const arcs = counts.map((count, i) => {
      if (!count) return '';
      const fraction = count / total * 100;
      const circle = `<circle cx="63" cy="63" r="47" pathLength="100" fill="none" stroke="${categories[i][1]}" stroke-width="15" stroke-dasharray="${fraction} ${100 - fraction}" stroke-dashoffset="${-offset}"/>`;
      offset += fraction;
      return circle;
    }).join('');
    const legend = categories.map(([label, color], index) => `<li><span class="ac-marker" style="background:${color}" aria-hidden="true"></span><span>${label}</span><strong>${counts[index]}</strong><span class="ac-visually-hidden"> 篇</span></li>`).join('');
    const totalFont = Math.min(30, Math.round(95 / String(total).length));
    return `<style>
      .ac-composition{display:flex;align-items:center;justify-content:center;gap:clamp(12px,2vw,30px);margin:0;min-width:0;min-height:146px;font-variant-numeric:tabular-nums}
      .ac-composition .ac-ring{display:block;flex:0 1 138px;width:40%;min-width:74px;max-width:142px;font-family:inherit}
      .ac-composition figcaption{flex:1 1 170px;max-width:270px;min-width:0}
      .ac-composition ul{display:grid;gap:10px;margin:0;padding:0;list-style:none}
      .ac-composition li{display:grid;grid-template-columns:9px 1fr auto;align-items:center;gap:7px;line-height:1.3;font-size:12px;color:#48574c}
      .ac-composition li strong{font-size:14px;font-weight:650;color:#253d30}
      .ac-composition .ac-marker{height:8px;width:8px;border-radius:50%}
      .ac-composition .ac-visually-hidden{position:absolute;clip-path:inset(50%);width:1px;height:1px;overflow:hidden;white-space:nowrap}
    </style><figure class="ac-composition"><svg class="ac-ring" viewBox="0 0 126 126" role="img" aria-label="共 ${total} 篇论文"><g transform="rotate(-90 63 63)">${arcs}</g><text x="63" y="62" text-anchor="middle" font-size="${totalFont}" font-weight="650" fill="#173c2e">${total}</text><text x="63" y="81" text-anchor="middle" font-size="11" fill="#68776a">篇论文</text></svg><figcaption><ul>${legend}</ul></figcaption></figure>`;
  }

  window.AtlasCharts = { trend, composition };
})();

