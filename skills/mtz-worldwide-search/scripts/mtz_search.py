#!/usr/bin/env python3
"""Search MTZ worldwide (and its German edition) through the Crossref REST API.

Standard library only. MTZ worldwide is Springer's English edition of
MTZ - Motortechnische Zeitschrift; both editions deposit article metadata with
Crossref, so a journal-scoped `works` query is a key-free way to find articles
by topic, author, year, volume or issue.

Crossref holds bibliographic metadata only for these journals: no abstracts,
no affiliations, no full text. The script reports exactly what Crossref
returns and never fills gaps.

Examples:
    python mtz_search.py "hydrogen combustion engine" --rows 10
    python mtz_search.py --author "Virnich" --from-year 2020
    python mtz_search.py --volume 87 --issue 6 --sort published --order asc
    python mtz_search.py "e-fuels" --edition both --format bibtex
    python mtz_search.py --doi 10.1007/s38313-023-1503-y --format json

Exit codes: 0 success (including zero hits), 1 network/API error,
2 bad arguments.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

API = "https://api.crossref.org"

#: Electronic ISSN used for the journal route, and journal title, as registered
#: with Crossref (checked 2026-10-18).
EDITIONS = {
    "worldwide": ("2192-9114", "MTZ worldwide"),
    "de": ("2192-8843", "MTZ - Motortechnische Zeitschrift"),
}
#: Every ISSN a DOI of each edition may carry (the German edition also has print 0024-8525).
ISSNS = {"worldwide": {"2192-9114"}, "de": {"2192-8843", "0024-8525"}}

SELECT = "DOI,title,subtitle,author,issued,volume,issue,page,container-title,type,URL,link"
MAX_ROWS = 1000  # Crossref caps one page at 1000; we also cap the whole walk.
PAGE = 100
TIMEOUT = 30

_WS = re.compile(r"\s+")
_TAG = re.compile(r"<[^>]+>")


class ApiError(Exception):
    """Crossref was unreachable or answered with something unusable."""


def clean(text: str | None) -> str:
    """Strip JATS/HTML tags and collapse whitespace in third-party text."""
    if not text:
        return ""
    return _WS.sub(" ", _TAG.sub("", text)).strip()


def build_params(args: argparse.Namespace, offset: int, rows: int) -> dict[str, str]:
    """Translate CLI arguments into Crossref `works` query parameters."""
    params: dict[str, str] = {"rows": str(rows), "offset": str(offset), "select": SELECT}
    if args.query:
        params["query.bibliographic"] = args.query
    if args.author:
        params["query.author"] = args.author
    filters = ["type:journal-article"] if not args.all_types else []
    if args.from_year:
        filters.append(f"from-pub-date:{args.from_year}")
    if args.until_year:
        filters.append(f"until-pub-date:{args.until_year}")
    if filters:
        params["filter"] = ",".join(filters)
    if args.sort == "published":
        params["sort"] = "published"
        params["order"] = args.order
    elif args.query or args.author:
        params["sort"] = "relevance"
    else:
        # Relevance is meaningless without a query; fall back to newest first.
        params["sort"] = "published"
        params["order"] = args.order
    if args.mailto:
        params["mailto"] = args.mailto  # Crossref "polite pool"
    return params


def fetch_json(url: str, retries: int = 3) -> dict[str, Any]:
    """GET a Crossref URL, retrying on 429/5xx with exponential backoff."""
    request = urllib.request.Request(
        url, headers={"User-Agent": "mtz-worldwide-search/1.0 (agent skill)"}
    )
    delay = 2.0
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                raise ApiError(f"Crossref returned 404 for {url}") from exc
            if exc.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            raise ApiError(f"Crossref HTTP {exc.code} for {url}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt < retries:
                time.sleep(delay)
                delay *= 2
                continue
            raise ApiError(f"cannot reach Crossref: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise ApiError(f"Crossref answered with non-JSON content for {url}") from exc
    raise ApiError("unreachable")  # pragma: no cover


def normalize(item: dict[str, Any], edition: str) -> dict[str, Any]:
    """Flatten one Crossref work into the record this skill emits."""
    parts = (item.get("issued") or {}).get("date-parts") or [[None]]
    date = [p for p in parts[0] if p is not None]
    authors = [
        clean(" ".join(x for x in (a.get("given"), a.get("family")) if x))
        or clean(a.get("name"))
        for a in item.get("author") or []
    ]
    # Older records deposit the English and German titles as two entries;
    # keep the first (the edition's own language) instead of gluing them.
    title = clean((item.get("title") or [""])[0])
    subtitle = clean((item.get("subtitle") or [""])[0])
    landing = next(
        (
            link["URL"]
            for link in item.get("link") or []
            if link.get("content-type") == "text/html"
        ),
        "",
    )
    doi = item.get("DOI", "")
    return {
        "doi": doi,
        "title": f"{title}: {subtitle}" if subtitle and subtitle not in title else title,
        "authors": [a for a in authors if a],
        "year": date[0] if date else None,
        "date": "-".join(f"{p:02d}" if i else str(p) for i, p in enumerate(date)),
        "volume": item.get("volume", ""),
        "issue": item.get("issue", ""),
        "pages": item.get("page", ""),
        "journal": clean(" ".join(item.get("container-title") or [])) or EDITIONS[edition][1],
        "edition": edition,
        "type": item.get("type", ""),
        "doi_url": item.get("URL") or (f"https://doi.org/{doi}" if doi else ""),
        "springer_url": landing,
    }


def keep(record: dict[str, Any], args: argparse.Namespace) -> bool:
    """Client-side volume/issue filter (Crossref has no such server filter)."""
    if args.volume and record["volume"] != str(args.volume):
        return False
    if args.issue:
        # Double issues are deposited as "2-3"; match either half.
        issues = re.split(r"[-/]", record["issue"])
        if str(args.issue) not in issues and record["issue"] != str(args.issue):
            return False
    return True


def search(args: argparse.Namespace) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Run the search on each requested edition; return records and hit totals."""
    editions = ["worldwide", "de"] if args.edition == "both" else [args.edition]
    records: list[dict[str, Any]] = []
    totals: dict[str, int] = {}
    # Volume/issue filtering happens locally, so walk more pages to find them.
    budget = MAX_ROWS if (args.volume or args.issue) else args.rows
    for edition in editions:
        issn = EDITIONS[edition][0]
        found: list[dict[str, Any]] = []
        offset = 0
        while offset < budget and len(found) < args.rows:
            rows = min(PAGE, budget - offset)
            query = urllib.parse.urlencode(build_params(args, offset, rows))
            message = fetch_json(f"{API}/journals/{issn}/works?{query}")["message"]
            totals[edition] = int(message.get("total-results", 0))
            items = message.get("items") or []
            found.extend(r for r in (normalize(i, edition) for i in items) if keep(r, args))
            offset += len(items)
            if len(items) < rows or offset >= totals[edition]:
                break
        records.extend(found[: args.rows])
    return records, totals


def lookup_doi(doi: str) -> dict[str, Any]:
    """Fetch one DOI and confirm it belongs to an MTZ edition."""
    doi = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:)", "", doi.strip(), flags=re.I)
    message = fetch_json(f"{API}/works/{urllib.parse.quote(doi, safe='/')}")["message"]
    issns = set(message.get("ISSN") or [])
    for edition, known in ISSNS.items():
        if known & issns:
            return normalize(message, edition)
    raise ApiError(f"{doi} is not registered under an MTZ ISSN (found: {sorted(issns)})")


def bibtex(record: dict[str, Any]) -> str:
    """Render one record as a BibTeX @article entry."""
    first = (record["authors"][0].split()[-1] if record["authors"] else "mtz").lower()
    key = re.sub(r"[^a-z0-9]", "", first) + str(record["year"] or "")
    fields = {
        "author": " and ".join(record["authors"]),
        "title": "{" + record["title"] + "}",
        "journal": record["journal"],
        "year": str(record["year"] or ""),
        "volume": record["volume"],
        "number": record["issue"],
        "pages": record["pages"].replace("-", "--"),
        "doi": record["doi"],
        "url": record["doi_url"],
    }
    body = ",\n".join(f"  {k} = {{{v}}}" for k, v in fields.items() if v)
    return f"@article{{{key},\n{body}\n}}"


def render(records: list[dict[str, Any]], totals: dict[str, int], fmt: str) -> str:
    """Format records for output."""
    if fmt == "json":
        return json.dumps({"totals": totals, "records": records}, ensure_ascii=False, indent=2)
    if fmt == "bibtex":
        return "\n\n".join(bibtex(r) for r in records)
    if fmt == "csv":
        buffer = io.StringIO()
        columns = ["doi", "title", "authors", "year", "volume", "issue", "pages", "journal", "doi_url"]
        writer = csv.DictWriter(buffer, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for r in records:
            writer.writerow({**r, "authors": "; ".join(r["authors"])})
        return buffer.getvalue().rstrip("\n")
    lines = [f"-> {EDITIONS[e][1]}: {n} matching works in Crossref" for e, n in totals.items()]
    for i, r in enumerate(records, 1):
        authors = ", ".join(r["authors"][:3]) + (" et al." if len(r["authors"]) > 3 else "")
        where = f"{r['journal']} {r['volume']}({r['issue']}), {r['pages']}".strip()
        lines += [
            f"[{i}] {r['title']}",
            f"    {authors or '(no author deposited)'} - {r['date'] or 'n.d.'}",
            f"    {where}",
            f"    {r['doi_url']}",
        ]
    if not records:
        lines.append("[OK] no records matched")
    return "\n".join(lines)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search MTZ worldwide / MTZ (Springer) article metadata via Crossref."
    )
    parser.add_argument("query", nargs="?", help="free-text topic, title words, keywords")
    parser.add_argument("--author", help="author name (Crossref query.author)")
    parser.add_argument("--doi", help="look up one DOI and check it is an MTZ article")
    parser.add_argument("--edition", choices=["worldwide", "de", "both"], default="worldwide",
                        help="worldwide = English edition (default), de = German MTZ")
    parser.add_argument("--from-year", type=int, help="earliest publication year")
    parser.add_argument("--until-year", type=int, help="latest publication year")
    parser.add_argument("--volume", type=int, help="volume (filtered locally)")
    parser.add_argument("--issue", help="issue number (filtered locally)")
    parser.add_argument("--rows", type=int, default=20, help="max records per edition (1-1000)")
    parser.add_argument("--sort", choices=["relevance", "published"], default="relevance")
    parser.add_argument("--order", choices=["asc", "desc"], default="desc")
    parser.add_argument("--all-types", action="store_true",
                        help="include non-article types (editorials are articles too)")
    parser.add_argument("--format", choices=["table", "json", "csv", "bibtex"], default="table")
    parser.add_argument("--mailto", default=os.environ.get("CROSSREF_MAILTO"),
                        help="contact e-mail for Crossref's polite pool (or CROSSREF_MAILTO)")
    args = parser.parse_args(argv)
    if not 1 <= args.rows <= MAX_ROWS:
        parser.error(f"--rows must be between 1 and {MAX_ROWS}")
    if args.from_year and args.until_year and args.from_year > args.until_year:
        parser.error("--from-year is later than --until-year")
    if not (args.doi or args.query or args.author or args.volume or args.from_year):
        parser.error("give a query, --author, --doi, --volume or --from-year")
    return args


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
    except SystemExit as exc:
        return int(exc.code or 0)
    try:
        if args.doi:
            record = lookup_doi(args.doi)
            records, totals = [record], {record["edition"]: 1}
        else:
            records, totals = search(args)
    except ApiError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1
    print(render(records, totals, args.format))
    return 0


if __name__ == "__main__":
    sys.exit(main())
