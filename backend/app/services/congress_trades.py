"""
Congress trade tracker — House STOCK Act Periodic Transaction Reports (PTRs)
=============================================================================

Reads the House Clerk's public financial disclosure index and, for each
matching filing, the actual PTR -- the form a member of the House (or their
spouse/dependent child) files within 30-45 days of buying or selling a stock.
Public, no authentication, no inside information: a PTR is a disclosure
that arrives well after the trade and gives an AMOUNT RANGE, never an exact
price.

Parsing logic (the index XML shape, the PTR row grammar, the column-header/
footer noise to skip) is ported from the MIT-licensed trader-pelosi skill
(github.com/Jakeschincariol/day-trader-skill), adapted here to: fetch async
(aiohttp, matching this codebase's own convention) instead of urllib, extract
PDF text with pdfplumber's layout-preserving mode instead of shelling out to
the `pdftotext` binary (Render's Python runtime has no poppler installed, so
a subprocess call would fail in production even though it works on a dev
machine that happens to have it) and return plain dicts for a FastAPI
response model instead of printing a CLI report.

Sources:
  - Index: https://disclosures-clerk.house.gov/public_disc/financial-pdfs/<YEAR>FD.zip
    (a ZIP with <YEAR>FD.xml: one <Member> per filing, FilingType P = PTR)
  - Each PTR: https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/<YEAR>/<DocID>.pdf
"""

from __future__ import annotations

import datetime as _dt
import io
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any, Dict, List, Optional

import aiohttp
import structlog

logger = structlog.get_logger(__name__)

INDEX_URL = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs/%dFD.zip"
PTR_URL = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/%d/%s.pdf"
UA = "PetrazimTradingPortal/1.0 (+https://trade.petrazim.online; contact.petrazim@gmail.com)"
FILING_TYPES = {
    "P": "Periodic Transaction Report", "O": "Annual report", "A": "Amendment",
    "C": "Candidate report", "X": "Extension", "T": "Termination report",
    "W": "Waiver", "D": "Disclosure (new member or candidate)", "H": "New filer report",
}
TXN_TYPES = {"P": "purchase", "S": "sale", "S (partial)": "partial sale", "E": "exchange"}
OWNERS = {"SP": "spouse", "JT": "joint", "DC": "dependent child", "": "self"}
LATE_DAYS = 45


class CongressTradesError(Exception):
    pass


def _iso(mdy: Optional[str]) -> Optional[str]:
    """'8/21/2026' or '08/21/2026' -> '2026-08-21' (two-digit years -> 20xx)."""
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{2,4})\s*$", mdy or "")
    if not m:
        return None
    month, day, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if year < 100:
        year += 2000
    try:
        return _dt.date(year, month, day).isoformat()
    except ValueError:
        return None


async def _download(session: aiohttp.ClientSession, url: str, timeout: int = 30) -> bytes:
    try:
        async with session.get(url, headers={"User-Agent": UA}, timeout=aiohttp.ClientTimeout(total=timeout)) as resp:
            if resp.status != 200:
                raise CongressTradesError(f"HTTP {resp.status} for {url}")
            return await resp.read()
    except aiohttp.ClientError as exc:
        raise CongressTradesError(f"could not reach {url}: {exc}") from exc


def _read_index_bytes(data: bytes) -> bytes:
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".xml")]
            if not names:
                raise CongressTradesError(f"no XML inside the ZIP (files: {', '.join(z.namelist())})")
            return z.read(names[0])
    return data


def _parse_index(xml_bytes: bytes, year: int) -> List[Dict[str, Any]]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise CongressTradesError(f"index is not valid XML: {exc}") from exc
    out: List[Dict[str, Any]] = []
    for m in root.iter("Member"):
        f = {c.tag: (c.text or "").strip() for c in m}
        doc = f.get("DocID", "")
        kind = f.get("FilingType", "")
        y = int(f.get("Year") or year)
        name = " ".join(x for x in (f.get("Prefix"), f.get("First"), f.get("Last"), f.get("Suffix")) if x)
        out.append({
            "doc_id": doc, "type": kind, "type_name": FILING_TYPES.get(kind, kind),
            "last": f.get("Last", ""), "first": f.get("First", ""), "name": name,
            "district": f.get("StateDst", ""), "year": y,
            "filed": _iso(f.get("FilingDate", "")),
            "url": PTR_URL % (y, doc) if kind == "P" else None,
        })
    out.sort(key=lambda r: (r["filed"] or "", r["doc_id"]), reverse=True)
    return out


def _member_match(row: Dict[str, Any], member: str) -> bool:
    member = (member or "").strip().lower()
    if not member:
        return True
    if "," in member:
        last, first = [x.strip() for x in member.split(",", 1)]
    else:
        parts = member.split()
        last, first = parts[-1], " ".join(parts[:-1])
    if row["last"].lower() != last:
        return False
    return not first or row["first"].lower().startswith(first)


# ---------------------------------------------------------------- parsing a PTR

_TXN = re.compile(
    r"^\s*(?:(?P<owner>SP|JT|DC)\s+)?(?P<asset>.*?)\s+(?P<type>S \(partial\)|P|S|E)\s+"
    r"(?P<date>\d{2}/\d{2}/\d{4})\s+(?P<notified>\d{2}/\d{2}/\d{4})\s+(?P<amount>\S.*?)\s*$"
)
_LABELS = [
    ("status", re.compile(r"^\s*F(?:ILING)?\s+S(?:TATUS)?\s*:\s*(.*)$", re.I)),
    ("description", re.compile(r"^\s*D(?:ESCRIPTION)?\s*:\s*(.*)$", re.I)),
    ("account", re.compile(r"^\s*S(?:UBHOLDING)?\s+O(?:F)?\s*:\s*(.*)$", re.I)),
    ("location", re.compile(r"^\s*L(?:OCATION)?\s*:\s*(.*)$", re.I)),
]
_PAGE_HEADER = re.compile(r"^\s*(ID\s+Owner\s+Asset|Type\s+Date\b|Type$|Date$|Gains >$|\$200\?$)", re.I)
_END = re.compile(r"^\s*(\* For the complete|I CERTIFY|Digitally Signed|Filing ID #)", re.I)
_AMOUNT = re.compile(r"\$([\d,]+)")
_SHARES = re.compile(r"(?:purchased|sold|bought)\s+([\d,]+)\s+shares", re.I)


def _amount(text: str) -> tuple[Optional[int], Optional[int]]:
    nums = [int(x.replace(",", "")) for x in _AMOUNT.findall(text or "")]
    return (nums[0] if nums else None), (nums[1] if len(nums) > 1 else None)


def _finish(row: Dict[str, Any], filed: Optional[str]) -> Dict[str, Any]:
    asset = " ".join(row.pop("_asset").split())
    tick = re.findall(r"\(([A-Z][A-Z0-9.\-/]{0,9})\)", asset)
    row["ticker"] = tick[-1] if tick else None
    name = re.sub(r"\s*\[[A-Z]{2}\]", "", asset)
    if tick:
        name = re.sub(r"\s*\(%s\)" % re.escape(tick[-1]), "", name)
    row["asset"] = name.strip(" -")
    row["amount"] = " ".join(row["amount"].split())
    row["amount_low"], row["amount_high"] = _amount(row["amount"])
    row["description"] = " ".join(row.get("description", "").split()) or None
    sh = _SHARES.search(row["description"] or "")
    if sh:
        row["shares"] = int(sh.group(1).replace(",", ""))
    if filed and row["date"]:
        days = (_dt.date.fromisoformat(filed) - _dt.date.fromisoformat(row["date"])).days
        row["days_to_disclose"] = days
        row["late"] = days > LATE_DAYS
    return row


def _parse_ptr_text(text: str, filed: Optional[str] = None) -> Dict[str, Any]:
    """Rows from layout-preserving PDF text of a House PTR."""
    head: Dict[str, Any] = {"name": None, "status": None, "district": None, "doc_id": None, "filed": filed}
    rows: List[Dict[str, Any]] = []
    cur: Optional[Dict[str, Any]] = None
    mode: Optional[str] = None
    amount_open = False
    for raw in text.splitlines():
        line = raw.rstrip()
        s = line.strip()
        m = re.match(r"^Name:\s+(.*)$", s)
        if m and not head["name"]:
            head["name"] = m.group(1).strip()
            continue
        m = re.match(r"^Status:\s+(.*)$", s)
        if m and not head["status"]:
            head["status"] = m.group(1).strip()
            continue
        m = re.match(r"^State/District:\s*(\S+)", s)
        if m:
            head["district"] = m.group(1)
            continue
        m = re.search(r"Filing ID #(\d+)", s)
        if m:
            head["doc_id"] = m.group(1)
            continue
        m = re.match(r"^Digitally Signed:.*?,\s*(\d{2}/\d{2}/\d{4})", s)
        if m:
            head["filed"] = head["filed"] or _iso(m.group(1))
            continue
        t = _TXN.match(line)
        if t and _iso(t.group("date")):
            if cur:
                rows.append(cur)
            owner = t.group("owner") or ""
            cur = {
                "owner": owner, "owner_name": OWNERS.get(owner, owner),
                "_asset": t.group("asset"), "type": t.group("type"),
                "type_name": TXN_TYPES.get(t.group("type"), t.group("type")),
                "date": _iso(t.group("date")), "notified": _iso(t.group("notified")),
                "amount": t.group("amount"), "status": None, "account": None,
            }
            amount_open = cur["amount"].endswith("-")
            mode = "asset"
            continue
        if cur is None:
            continue
        if not s:
            if mode in ("description", "asset"):
                mode = "labels" if mode == "description" or "[" in cur["_asset"] else mode
            continue
        if _PAGE_HEADER.match(s):
            continue
        if _END.match(s):
            mode = "labels"
            continue
        label = next(((k, rx.match(line)) for k, rx in _LABELS if rx.match(line)), None)
        if label:
            key, lm = label
            value = lm.group(1).strip()
            if key == "description":
                cur["description"] = value
                mode = "description"
            elif key in ("status", "account"):
                cur[key] = value
                mode = "labels"
            else:
                mode = "labels"
            continue
        if mode == "asset":
            parts = re.split(r"\s{2,}", s)
            if amount_open and re.fullmatch(r"\$[\d,]+", parts[-1]):
                cur["amount"] += " " + parts.pop()
                amount_open = False
            if parts and parts[0]:
                cur["_asset"] += " " + " ".join(parts)
        elif mode == "description":
            cur["description"] = cur.get("description", "") + " " + s
    if cur:
        rows.append(cur)
    head["rows"] = [_finish(r, head["filed"]) for r in rows]
    return head


def _pdf_to_text(pdf_bytes: bytes) -> Optional[str]:
    """Layout-preserving text extraction, the pure-Python equivalent of
    `pdftotext -layout` the row parser above expects. Returns None (never
    raises) on any extraction failure -- a filing that can't be parsed
    degrades to "view the PDF" rather than a 500."""
    try:
        import pdfplumber
    except ImportError:
        logger.warning("congress_trades.pdfplumber_missing")
        return None
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = "\n".join((page.extract_text(layout=True) or "") for page in pdf.pages)
            # Some House PTR PDFs use a font whose column-filler glyphs
            # decode as NUL bytes rather than spaces -- confirmed directly
            # against a real filing (e.g. doc 20035669). The row parser's
            # label regexes below all rely on `\s+`, which does not match
            # `\x00`, so a label like "F\x00\x00S\x00\x00: New" silently
            # fails to match and the whole line gets swallowed into the
            # previous row's asset text instead. Normalizing every control
            # character to a space keeps this parser's `\s`-based regexes
            # working regardless of which filler character a given PDF's
            # font happens to use.
            return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", text)
    except Exception:
        logger.warning("congress_trades.pdf_parse_failed", exc_info=True)
        return None


async def get_recent_ptrs(
    *, ticker: Optional[str] = None, member: Optional[str] = None, limit: int = 15, read_pdfs: int = 8,
) -> Dict[str, Any]:
    """Recent House PTR filings, newest first, optionally filtered to a
    ticker or member. `read_pdfs` caps how many matching PTRs get their
    actual transaction rows parsed (each is a separate PDF fetch+parse) --
    the index itself is cheap, reading PDFs is not, so this is bounded
    regardless of `limit`."""
    year = _dt.date.today().year
    async with aiohttp.ClientSession() as session:
        try:
            data = await _download(session, INDEX_URL % year)
            rows = _parse_index(_read_index_bytes(data), year)
        except CongressTradesError:
            # Early in a year the current year's index may not exist yet.
            data = await _download(session, INDEX_URL % (year - 1))
            rows = _parse_index(_read_index_bytes(data), year - 1)

        picked = [r for r in rows if r["type"] == "P"]
        if member:
            picked = [r for r in picked if _member_match(r, member)]
        picked = picked[: max(limit, read_pdfs)]

        read_count = 0
        for r in picked:
            if read_count >= read_pdfs or not r.get("url"):
                continue
            read_count += 1
            try:
                pdf_bytes = await _download(session, r["url"])
                text = _pdf_to_text(pdf_bytes)
                r["report"] = _parse_ptr_text(text, filed=r["filed"]) if text else None
            except CongressTradesError:
                r["report"] = None

    if ticker:
        want = ticker.strip().upper()
        picked = [
            r for r in picked
            if r.get("report") and any((row.get("ticker") or "") == want for row in r["report"]["rows"])
        ]

    return {
        "source": "disclosures-clerk.house.gov",
        "note": "Public STOCK Act disclosures, filed up to 45 days after the trade. Amounts are ranges, never exact prices. Not inside information.",
        "year": year,
        "filings": picked[:limit],
    }
