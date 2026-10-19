# Crossref REST API for MTZ — reference

Checked against the live API on 2026-10-18. Official documentation:
<https://www.crossref.org/documentation/retrieve-metadata/rest-api/> and
<https://api.crossref.org/swagger-ui/index.html>.

## Journal identifiers

| Journal | Electronic ISSN | Print ISSN | DOI prefix pattern |
| --- | --- | --- | --- |
| MTZ worldwide | 2192-9114 | — (not in Crossref) | `10.1007/s38313-YYY-NNNN-X` |
| MTZ - Motortechnische Zeitschrift | 2192-8843 | 0024-8525 | `10.1007/s35146-...` (older: `10.1007/BF03...`) |
| Sonderprojekte ATZ/MTZ worldwide (special issues, 2016 only, 14 DOIs) | 2509-4688 | 2509-467X | — |

Journal record: `https://api.crossref.org/journals/2192-9114` (counts, coverage, DOIs
per year). The DOI patterns are observations, not guarantees: use the ISSN, not the
prefix, to decide whether a work is MTZ.

## Endpoints used

| Purpose | Request |
| --- | --- |
| Search one journal | `GET /journals/{issn}/works?query.bibliographic=...` |
| One DOI | `GET /works/{doi}` — check `ISSN` contains an MTZ ISSN |

## Parameters

| Parameter | Use |
| --- | --- |
| `query.bibliographic` | Free text matched against title, authors, year, journal |
| `query.author` | Author names only |
| `filter=from-pub-date:2020,until-pub-date:2024` | Year range (also accepts `YYYY-MM-DD`) |
| `filter=type:journal-article` | Excludes other record types |
| `sort=relevance` / `sort=published&order=desc` | Ranking |
| `rows` (≤1000), `offset` (≤10 000) | Paging; use `cursor=*` for deeper walks |
| `select=DOI,title,author,...` | Smaller responses |
| `mailto=you@example.org` | "Polite pool" identification |

There is no server-side filter for volume or issue on this route, which is why
`mtz_search.py` filters them locally after fetching up to 1000 records. Narrowing with
a year range first keeps that walk short and complete.

## Field coverage for MTZ worldwide (Crossref coverage report, 2026-10-18)

| Field | Coverage |
| --- | --- |
| Abstracts | 0 % |
| Affiliations, ORCID, funders | 0 % |
| References list | ~37 % overall, 0 % for current content |
| Licence and Springer full-text links | ~95 % |

Consequences: topic search effectively runs on titles; citation counts
(`is-referenced-by-count`) are typically 0 and are not a measure of impact; no
abstract can be retrieved from this source.

## Rate limits and errors

- Crossref returns HTTP 429 when throttled; the script retries 429/5xx with
  exponential backoff (2 s, 4 s, 8 s) and then exits with code 1.
- Public pool limits change; current values are announced in the
  `x-rate-limit-limit` / `x-rate-limit-interval` response headers.
- A DOI unknown to Crossref yields HTTP 404 (`[FAIL] Crossref returned 404`).
