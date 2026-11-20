(() => {
  "use strict";

  const prefix = "byline-atlas/local-author/v1/";
  const memory = new Map();
  const validArchive = id => typeof id === "string" && /^BA-[0-9a-f]{32}$/.test(id);
  const list = value => Array.isArray(value) ? value : [];
  function read(key) {
    try { return window.localStorage.getItem(prefix + key) || memory.get(key) || ""; }
    catch { return memory.get(key) || ""; }
  }
  function write(key, value) {
    memory.set(key, value);
    try { window.localStorage.setItem(prefix + key, value); } catch {}
  }
  function newId() {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return "BA-" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  }
  function orcid(value) {
    const id = String(value || "").trim().replace(/^https?:\/\/orcid\.org\//i, "").replace(/\/$/, "").toUpperCase();
    if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) return "";
    const digits = id.replace(/-/g, "");
    let sum = 0;
    for (const digit of digits.slice(0,15)) sum = (sum + Number(digit)) * 2;
    const check = (12 - sum % 11) % 11;
    return digits[15] === (check === 10 ? "X" : String(check)) ? id : "";
  }
  function anchorCandidates(scope) {
    const primary = scope.candidate;
    // Additional candidates require a recorded, deliberate link by the user.
    return [primary, ...list(scope.providers).filter(p => String(p?.reason || "").trim()).map(p => p.candidate)].filter(Boolean);
  }
  function assign(scope) {
    if (!scope || scope.mode !== "author") return "";
    const anchors = new Set(), strong = new Set(), hints = new Set();
    let conflict = false;
    for (const c of anchorCandidates(scope)) {
      const sourceId = String(c.id || "");
      const observed = new Set([c.orcid, ...list(c.observedOrcids)].map(orcid).filter(Boolean));
      const requested = orcid(c.requestedOrcid);
      const providerOrcid = orcid(sourceId.replace(/^(?:MED\/)?ORCID\//i,""));
      if (requested) strong.add(requested);
      if (providerOrcid && ["orcid","epmc","bibliographic"].includes(c.provider)) strong.add(providerOrcid);
      if (observed.size > 1) {
        // A mixed OpenAlex author cluster cannot act as an identifier for this person.
        if (!(requested && observed.has(requested))) conflict = true;
        continue;
      }
      for (const id of observed) hints.add(id);
      const oa = sourceId.replace(/^https?:\/\/(?:api\.)?openalex\.org\/(?:authors\/)?/i,"").replace(/\/$/,"").toUpperCase();
      if ((!c.provider || c.provider === "openalex") && /^A\d+$/.test(oa) && !["A9999999999","A5317838346"].includes(oa)) anchors.add("oa/" + oa);
    }
    for (const row of list(scope.records)) {
      if (!row || row.excluded || row.identityPending || row.identityStatus !== "supported" || row.identityBasis !== "work-orcid") continue;
      const matches = list(row.byline).filter(a => a?.isTarget);
      if (matches.length > 1) continue;
      const ids = [row.workOrcid, matches[0]?.orcid].map(orcid).filter(Boolean);
      for (const id of ids) strong.add(id);
    }
    if (strong.size > 1 || new Set([...strong,...hints]).size > 1) conflict = true;
    const verified = strong.size === 1 ? [...strong][0] : "";
    if (verified) anchors.add("orcid/" + verified);

    const saved = validArchive(scope.archiveId) ? scope.archiveId : "";
    const existing = new Set([...anchors].map(key => read(key)).filter(validArchive));
    if (existing.size > 1 || (saved && !scope.archiveIdConflict && existing.size && !existing.has(saved))) conflict = true;
    const registered = existing.values().next().value || "";
    const previous = read("verified/" + (registered || saved));
    if (previous && [...strong,...hints].some(id => id !== previous)) conflict = true;
    if (conflict) {
      if (!saved || !scope.archiveIdConflict) scope.archiveId = newId();
      scope.archiveIdConflict = true;
      return scope.archiveId;
    }
    const id = registered || saved || newId();
    for (const key of anchors) write(key, id);
    if (verified) write("verified/" + id, verified);
    scope.archiveId = id;
    scope.archiveIdConflict = false;
    return id;
  }
  window.AtlasAuthorID = Object.freeze({assign});
})();
