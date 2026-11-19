(() => {
  "use strict";

  const root = document.getElementById("zhong-byline-panel");
  const papers = new Map(window.AtlasZhong.records.map(record => [record.url, record]));
  const rows = Array.from(root.querySelectorAll("details[data-year]"));
  const year = root.querySelector("[data-filter=year]");
  const zone = root.querySelector("[data-filter=zone]");
  const unit = root.querySelector("[data-filter=unit]");
  const modeButtons = root.querySelectorAll("[data-mode]");
  let mode = "author";

  function render() {
    const visible = rows.filter(row => {
      const info = row.dataset;
      const matches = (!year.value || info.year === year.value) &&
        (!zone.value || info.zone === zone.value) && (!unit.value || info.unit === unit.value);
      row.hidden = !matches;
      const roleLabel = info.unit === "Cardiff" ? "Cardiff 第一单位" : "哈工大第一单位";
      row.querySelector("i").textContent = mode === "org" ? roleLabel : "第一作者";
      return matches;
    });
    const records = visible.map(row => papers.get(row.querySelector('a[href^="https://doi.org/"]').href));
    const count = predicate => visible.filter(row => predicate(row.dataset)).length;
    const metrics = mode === "author" ? [
      ["期刊论文", visible.length],
      ["一作含共一", count(info => info.first === "1")],
      ["通讯作者", count(info => info.corr === "1")],
      ["一作或通讯", count(info => info.first === "1" || info.corr === "1")]
    ] : [
      ["期刊论文", visible.length],
      ["Cardiff 第一单位", count(info => info.unit === "Cardiff")],
      ["哈工大第一单位", count(info => info.unit === "HIT")],
      ["单位待核", count(info => !info.unit)]
    ];
    root.querySelectorAll(".metrics div").forEach((cell, index) => {
      cell.querySelector("span").textContent = metrics[index][0];
      cell.querySelector("b").textContent = metrics[index][1] + " 篇";
    });
    root.querySelector("[data-empty]").hidden = visible.length > 0;
    root.querySelector("[data-research]").innerHTML = window.AtlasContributions.render(
      records, {mode: mode === "org" ? "institution" : "author"}
    );
    modeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  }

  modeButtons.forEach(button => button.addEventListener("click", () => {
    mode = button.dataset.mode;
    render();
  }));
  root.querySelectorAll("select").forEach(select => select.addEventListener("change", render));
  render();
})();
