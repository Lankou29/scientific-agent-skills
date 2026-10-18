---
name: mtz-worldwide-search
description: Searches the article metadata of MTZ worldwide, Springer's English-language engine-technology journal (the international edition of MTZ - Motortechnische Zeitschrift), and optionally the German MTZ edition, through the key-free Crossref REST API. Finds articles by topic, author, year, volume or issue, checks whether a DOI is an MTZ article, and exports results as a table, JSON, CSV or BibTeX. Use for literature searches on internal combustion engines, hydrogen engines, e-fuels, powertrains, turbochargers, exhaust aftertreatment, thermal management and electrified drives as covered by MTZ.
license: MIT
compatibility: Requires Python 3.10+ (standard library only) and network access to api.crossref.org. No API key. Full text on link.springer.com is mostly behind a Springer subscription.
metadata:
  version: "1.0"
  skill-author: lankou29
  upstream-api: Crossref REST API
  last-reviewed: "2026-10-18"
---

# MTZ worldwide search

## When to use

Use this skill when the user wants articles from **MTZ worldwide** (ISSN 2192-9114,
Springer Vieweg / Springer Fachmedien Wiesbaden) — the English edition of
*MTZ - Motortechnische Zeitschrift* — or from the German edition (ISSN 2192-8843,
print 0024-8525). Typical requests:

- "Find MTZ worldwide articles on hydrogen combustion engines since 2020."
- "List the contents of MTZ worldwide volume 87, issue 6."
- "What has author X published in MTZ?"
- "Is DOI 10.1007/s38313-... an MTZ article? Give me its BibTeX."

For cross-journal literature searches (SAE, Elsevier, etc.) use a general literature
skill instead; this one is deliberately scoped to the two MTZ editions.

## What the data can and cannot tell you

Checked against Crossref on 2026-10-18:

| Edition | ISSN used | DOIs in Crossref | Years |
| --- | --- | --- | --- |
| MTZ worldwide (`--edition worldwide`, default) | 2192-9114 | ~3 060 | 2002 – today |
| MTZ - Motortechnische Zeitschrift (`--edition de`) | 2192-8843 | ~4 030 | 1998 – today |

- Crossref holds **bibliographic metadata only** for MTZ: title, authors, date, volume,
  issue, pages, DOI, Springer links. **No abstracts, no affiliations, no keywords,
  no full text.** Never present an abstract or a result as coming from this search.
- Relevance ranking is computed on titles and author names only, so a topic search
  misses articles whose title does not use the searched words. Run synonyms
  (`"H2 engine"`, `"hydrogen internal combustion"`) and English terms for the
  worldwide edition, German terms (`"Wasserstoffmotor"`) for `--edition de`.
- Most MTZ worldwide articles are translations of MTZ articles: the same work often
  appears in both editions with different DOIs. Cite the edition actually read.
- Editorials, interviews and news items are also typed `journal-article`; check the
  page count and title before treating a hit as a technical paper.
- Full text on link.springer.com usually requires an institutional subscription.
  Do not claim to have read an article you only found in the metadata.

## Workflow

1. Turn the request into one or more searches (topic words, `--author`, years,
   volume/issue). Prefer several focused queries over one long one.
2. Run `scripts/mtz_search.py` (examples below). Set `CROSSREF_MAILTO` to a contact
   e-mail to use Crossref's "polite pool" (faster, more stable); this is optional.
3. Read the `-> ... matching works` line: it is Crossref's total, the listed records
   are only the top `--rows`.
4. Check the hits (title relevance, page range, year). Discard off-topic ones.
5. Report results with title, authors, year, volume(issue), pages and DOI link, and
   state the search limits above. Export with `--format bibtex` or `csv` if asked.

## Examples

All commands run from the skill directory. The output below is the script's
rendering of a live Crossref response captured on 2026-10-18 (trimmed).

```bash
python scripts/mtz_search.py "hydrogen combustion engine" --rows 3
```

```text
-> MTZ worldwide: 696 matching works in Crossref
[1] Zero-emission Hydrogen Combustion Engine with Argon Closed Cycle
    Bernd Niethammer, Eric Olofsson, Lukas Kniestedt et al. - 2026-02-13
    MTZ worldwide 87(2-3), 16-23
    https://doi.org/10.1007/s38313-025-2160-0
[2] Combustion Strategy and Emission Concept for a High-performance Hydrogen Engine
    ...
```

"696 matching works" counts every article sharing at least one word with the query,
ranked by score; only the top hits are relevant.

```bash
# Author search restricted to a period, newest first
python scripts/mtz_search.py --author "Virnich" --from-year 2020 --sort published

# Table of contents of one issue (volume/issue are filtered locally;
# --from-year/--until-year make the walk much shorter)
python scripts/mtz_search.py --volume 87 --issue 6 --from-year 2026 --until-year 2026 --rows 50

# Both editions, German terms, exported as BibTeX
python scripts/mtz_search.py "Wasserstoff" --edition both --format bibtex > mtz.bib

# Verify a DOI belongs to MTZ and get structured metadata
python scripts/mtz_search.py --doi 10.1007/s38313-023-1503-y --format json
```

Options: `--rows` (1–1000 per edition, default 20), `--sort relevance|published`,
`--order desc|asc`, `--format table|json|csv|bibtex`, `--all-types` to include
non-article record types. Exit code 0 on success (zero hits included), 1 on a
network or API error, 2 on bad arguments.

JSON records carry: `doi`, `title`, `authors`, `year`, `date`, `volume`, `issue`,
`pages`, `journal`, `edition`, `type`, `doi_url`, `springer_url`.

## Without the script

The same query as a plain HTTP call, if Python is unavailable:

```text
https://api.crossref.org/journals/2192-9114/works?query.bibliographic=hydrogen+engine&filter=from-pub-date:2020,type:journal-article&rows=20&select=DOI,title,author,issued,volume,issue,page
```

See `references/crossref-mtz.md` for the parameters, rate limits and edge cases.

## Validation checks

- Every record you cite must have a DOI that resolves (`https://doi.org/<doi>`).
- Use `--doi` to confirm an article is really MTZ before attributing it to the journal.
- If a search returns `[FAIL] cannot reach Crossref`, report the failure; do not
  substitute remembered article titles.
