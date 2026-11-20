(() => {
  "use strict";

  const list = value => Array.isArray(value) ? value : value == null ? [] : [value];
  const clean = value => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  const unique = values => [...new Set(values.filter(Boolean))];
  const oaId = (value, letter) => {
    const id = clean(value).split("/").filter(Boolean).at(-1) || "";
    return id[0] === letter && /^\w\d+$/.test(id) ? id : "";
  };
  function rorId(value) {
    const match = clean(value).match(/^(?:https?:\/\/ror\.org\/)?(0[0-9a-z]{8})\/?$/i);
    return match ? "https://ror.org/" + match[1].toLowerCase() : "";
  }
  function count(value) {
    if (typeof value !== "number" && !/^\d+$/.test(value)) return null;
    return Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  }
  function setKeywords(row, evidence) {
    const entries = new Map();
    for (const item of [...list(row.keywordEvidence), ...evidence]) {
      const term = clean(item?.term);
      if (term) entries.set([term.toLowerCase(),item.source,item.kind].join("|"), {...item,term});
    }
    row.keywordEvidence = [...entries.values()];
    row.keywords = unique([...list(row.keywords), ...row.keywordEvidence.map(item => item.term)]);
  }
  function setCitation(row, raw, source, url) {
    const value = count(raw);
    if (value === null) return;
    const observedAt = new Date().toISOString().slice(0, 10);
    row.citationEvidence = [...list(row.citationEvidence), {source, count:value, url, observedAt}];
    if (row.citedByCount == null) row.citedByCount = value;
  }
  function openAlex(work, row) {
    const url = "https://openalex.org/" + oaId(work.id, "W");
    row.byline = row.byline.map((entry, index) => {
      const raw = work.authorships[index];
      const institutions = list(raw.institutions).map(org => ({
        id:oaId(org.id, "I"), name:clean(org.display_name), country:clean(org.country_code).toUpperCase(), ror:rorId(org.ror)
      })).filter(org => org.id || org.ror || org.name);
      const profileOrcid = clean(raw.author?.orcid).replace(/^https?:\/\/orcid\.org\//i, "").replace(/\/$/, "");
      return {...entry, institutions, position:clean(raw.author_position), profileOrcid,
        countries:unique([...list(raw.countries).map(code => clean(code).toUpperCase()), ...institutions.map(org => org.country)]),
        affiliations:unique([...entry.affiliations, ...list(raw.affiliations).map(item => clean(item.raw_affiliation_string))])};
    });
    const pmid = String(work.ids?.pmid || "").match(/^(?:https?:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov\/|www\.ncbi\.nlm\.nih\.gov\/pubmed\/))?(\d+)\/?$/i);
    if (pmid) row.pmid = pmid[1];
    row.openAlexId = oaId(work.id, "W");
    setKeywords(row, list(work.keywords).map(item => ({term:item?.display_name, source:"OpenAlex", kind:"数据库关键词"})));
    if (oaId(work.primary_topic?.id, "T")) {
      row.primaryTopicId = oaId(work.primary_topic.id, "T");
      row.primaryTopicName = clean(work.primary_topic.display_name);
    }
    const percentile = work.citation_normalized_percentile?.value;
    if (Number.isFinite(percentile) && percentile >= 0 && percentile <= 1) {
      row.fieldNormalizedCitationPercentile = percentile * 100;
      row.fieldNormalizedCitationPercentileSource = "OpenAlex";
      row.fieldNormalizedCitationPercentileUrl = url;
    }
    setCitation(row, work.cited_by_count, "OpenAlex", url);
    row.citationHistory = list(work.counts_by_year)
      .filter(item => Number.isInteger(item?.year) && item.year > 0 && count(item.cited_by_count) !== null)
      .map(item => ({year:item.year, count:count(item.cited_by_count), source:"OpenAlex"}));
    return row;
  }

  const addressCountries = new Map(Object.entries({
    "china":"CN", "pr china":"CN", "p r china":"CN", "people's republic of china":"CN", "peoples republic of china":"CN",
    "united kingdom":"GB", "uk":"GB", "u k":"GB", "united states":"US", "united states of america":"US", "usa":"US", "u s a":"US",
    "australia":"AU", "austria":"AT", "belgium":"BE", "brazil":"BR", "canada":"CA", "denmark":"DK", "finland":"FI", "france":"FR",
    "germany":"DE", "greece":"GR", "india":"IN", "ireland":"IE", "israel":"IL", "italy":"IT", "japan":"JP", "mexico":"MX",
    "netherlands":"NL", "the netherlands":"NL", "new zealand":"NZ", "norway":"NO", "pakistan":"PK", "poland":"PL", "portugal":"PT",
    "republic of korea":"KR", "south korea":"KR", "singapore":"SG", "south africa":"ZA", "spain":"ES", "sweden":"SE", "switzerland":"CH"
  }));
  function explicitCountry(address) {
    const place = address.split(/[,;]+/).at(-1)?.trim().toLowerCase().replace(/[.'’]/g, c => c==="."?" ":"'").replace(/\s+/g," ").trim();
    return addressCountries.get(place) || "";
  }
  function europePmc(paper, row) {
    row.pmid = String(paper.pmid || paper.id);
    const authors = list(paper.authorList?.author);
    row.byline = row.byline.map((entry, index) => {
      const institutions = [];
      for (const address of list(authors[index]?.authorAffiliationDetailsList?.authorAffiliation)) {
        const identifiers = list(address.affiliationOrgId);
        // A single ROR supplied by the source identifies an entity attached to this address.
        // The complete address is kept verbatim instead of treating a department as a separate organization.
        const rors = unique(identifiers.map(id => rorId(id?.value || id)));
        const name = clean(address.affiliation);
        if (name) institutions.push({id:"", name, ror:rors.length===1?rors[0]:"", country:explicitCountry(name), raw:rors.length!==1});
      }
      const complete = clean(paper.authorList?.completeYN).toUpperCase();
      const knownLast = complete === "Y" || (complete !== "N" && Number.isInteger(paper.authorCount) && authors.length === paper.authorCount);
      const position = index === 0 ? "first" : index < authors.length - 1 ? "middle" : knownLast ? "last" : "";
      return {...entry, institutions, position, countries:unique(institutions.map(org => org.country))};
    });
    const evidence = list(paper.keywordList?.keyword).map(term => ({term, source:"Europe PMC", kind:"条目关键词"}));
    for (const item of list(paper.meshHeadingList?.meshHeading)) {
      const descriptor = item?.descriptorName;
      evidence.push({term:typeof descriptor === "string" ? descriptor : descriptor?.value, source:"Europe PMC", kind:"MeSH 主题词"});
    }
    setKeywords(row, evidence);
    setCitation(row, paper.citedByCount, "Europe PMC", "https://europepmc.org/article/MED/" + row.pmid);
    return row;
  }

  function zhong(row) {
    const institution = row.firstInstitution;
    row.byline = row.authors.map((name, i, authors) => ({
      name, orcid:"", openAlexId:"", isTarget:i === 0, affiliations:[institution],
      institutions:[{id:"", name:institution, country:"GB", ror:""}], countries:["GB"],
      position:i === 0 ? "first" : i === authors.length - 1 ? "last" : "middle"
    }));
    setKeywords(row, list(row.keywords).map(term => ({term, source:row.evidenceUrl.split("#")[0], kind:"期刊原文关键词"})));
    return row;
  }
  window.AtlasEvidenceV3 = Object.freeze({openAlex, europePmc, zhong});
})();
