"""Offline tests for the mtz-worldwide-search script.

No network: `fetch_json` is patched to serve fixtures that are trimmed copies of
real Crossref responses captured on 2026-10-18 (hydrogen-engine query on ISSN
2192-9114, and the record for DOI 10.1007/s38313-023-1503-y).

Run from the repository root:

    python tests/run_all.py --isolated mtz-worldwide-search
"""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import unittest
import urllib.parse
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

import skill_contract

sys.dont_write_bytecode = True

SKILL_ROOT = Path(__file__).resolve().parents[2] / "skills" / "mtz-worldwide-search"
FIXTURES = Path(__file__).resolve().parent / "fixtures"

_spec = importlib.util.spec_from_file_location(
    "mtz_search", SKILL_ROOT / "scripts" / "mtz_search.py"
)
assert _spec and _spec.loader
mtz = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mtz)

CliHelpTests = skill_contract.cli.help_test_case(SKILL_ROOT)


def _fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _run(argv: list[str], fixture: str) -> tuple[int, str, list[str]]:
    urls: list[str] = []

    def fake(url: str, retries: int = 3) -> dict:
        urls.append(url)
        return _fixture(fixture)

    out, err = io.StringIO(), io.StringIO()
    with patch.object(mtz, "fetch_json", side_effect=fake), redirect_stdout(out), redirect_stderr(err):
        code = mtz.main(argv)
    return code, out.getvalue() + err.getvalue(), urls


class QueryBuildingTests(unittest.TestCase):
    def test_search_targets_mtz_worldwide_issn_with_filters(self) -> None:
        code, _, urls = _run(
            ["hydrogen engine", "--from-year", "2020", "--rows", "3"], "works_hydrogen.json"
        )
        self.assertEqual(code, 0)
        parsed = urllib.parse.urlparse(urls[0])
        self.assertEqual(parsed.path, "/journals/2192-9114/works")
        params = urllib.parse.parse_qs(parsed.query)
        self.assertEqual(params["query.bibliographic"], ["hydrogen engine"])
        self.assertEqual(params["filter"], ["type:journal-article,from-pub-date:2020"])
        self.assertEqual(params["sort"], ["relevance"])

    def test_both_editions_query_both_issns(self) -> None:
        _, _, urls = _run(["Wasserstoff", "--edition", "both"], "works_hydrogen.json")
        paths = [urllib.parse.urlparse(u).path for u in urls]
        self.assertEqual(paths, ["/journals/2192-9114/works", "/journals/2192-8843/works"])

    def test_no_query_sorts_by_date(self) -> None:
        _, _, urls = _run(["--from-year", "2026"], "works_hydrogen.json")
        params = urllib.parse.parse_qs(urllib.parse.urlparse(urls[0]).query)
        self.assertEqual(params["sort"], ["published"])

    def test_bad_arguments_exit_2(self) -> None:
        for argv in ([], ["x", "--rows", "0"], ["x", "--from-year", "2024", "--until-year", "2020"]):
            with redirect_stderr(io.StringIO()):
                self.assertEqual(mtz.main(argv), 2, argv)


class OutputTests(unittest.TestCase):
    def test_json_records_are_normalized(self) -> None:
        code, out, _ = _run(["hydrogen", "--format", "json"], "works_hydrogen.json")
        self.assertEqual(code, 0)
        data = json.loads(out)
        self.assertEqual(data["totals"], {"worldwide": 696})
        first = data["records"][0]
        self.assertEqual(first["doi"], "10.1007/s38313-025-2160-0")
        self.assertEqual(first["title"], "Zero-emission Hydrogen Combustion Engine with Argon Closed Cycle")
        self.assertEqual(first["authors"][3], "Martin Tunér")
        self.assertEqual(first["date"], "2026-02-13")
        self.assertEqual(first["journal"], "MTZ worldwide")
        self.assertTrue(first["springer_url"].startswith("https://link.springer.com/article/"))

    def test_issue_filter_matches_double_issue(self) -> None:
        _, out, _ = _run(["x", "--volume", "87", "--issue", "3", "--format", "json"], "works_hydrogen.json")
        records = json.loads(out)["records"]
        self.assertEqual([r["issue"] for r in records], ["2-3"])

    def test_bibtex_and_csv(self) -> None:
        _, bib, _ = _run(["hydrogen", "--format", "bibtex", "--rows", "1"], "works_hydrogen.json")
        self.assertIn("@article{niethammer2026,", bib)
        self.assertIn("pages = {16--23}", bib)
        _, csv_out, _ = _run(["hydrogen", "--format", "csv"], "works_hydrogen.json")
        self.assertEqual(len(csv_out.splitlines()), 4)

    def test_table_reports_crossref_total(self) -> None:
        _, out, _ = _run(["hydrogen"], "works_hydrogen.json")
        self.assertIn("-> MTZ worldwide: 696 matching works in Crossref", out)


class DoiLookupTests(unittest.TestCase):
    def test_mtz_doi_is_accepted_and_prefix_stripped(self) -> None:
        code, out, urls = _run(
            ["--doi", "https://doi.org/10.1007/s38313-023-1503-y", "--format", "json"], "work_doi.json"
        )
        self.assertEqual(code, 0)
        self.assertTrue(urls[0].endswith("/works/10.1007/s38313-023-1503-y"))
        self.assertEqual(json.loads(out)["records"][0]["volume"], "84")

    def test_non_mtz_doi_fails(self) -> None:
        other = _fixture("work_doi.json")
        other["message"]["ISSN"] = ["0000-0000"]
        err = io.StringIO()
        with patch.object(mtz, "fetch_json", return_value=other), redirect_stderr(err), redirect_stdout(io.StringIO()):
            self.assertEqual(mtz.main(["--doi", "10.1/x"]), 1)
        self.assertIn("[FAIL]", err.getvalue())


if __name__ == "__main__":
    unittest.main()
