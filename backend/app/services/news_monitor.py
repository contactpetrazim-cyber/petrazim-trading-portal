"""
News Monitor — per-symbol headlines + SEC filings
====================================================

Watches a symbol's Yahoo Finance headline RSS and SEC EDGAR 8-K filings,
flags the ones that cover a materially important 8-K item (earnings,
restructuring, a going-concern note, a leadership change, etc.), and tags
each headline with a rough topic keyword (earnings/analyst/legal/deal/...).

Parsing logic (the RSS/Atom field extraction, the 8-K item labels, the topic
keyword patterns) is ported from the MIT-licensed trader-news skill
(github.com/Jakeschincariol/day-trader-skill), adapted to fetch async
(aiohttp) and return plain dicts for a FastAPI response instead of a CLI
report. No local state/dedup tracking in v1 (the plugin's own `seen` file is
for a long-running chat session; this is a stateless on-demand API) -- a
request always returns whatever's currently in the lookback window.

Sources, one request each per symbol:
  - Yahoo Finance headline RSS: feeds.finance.yahoo.com/rss/2.0/headline
  - SEC EDGAR 8-K Atom feed: www.sec.gov/cgi-bin/browse-edgar (needs a real
    User-Agent identifying the requester -- SEC's own fair-access policy)
"""

from __future__ import annotations

import datetime as _dt
import email.utils
import re
from typing import Any, Dict, List, Optional
import xml.etree.ElementTree as ET

import aiohttp
import structlog

logger = structlog.get_logger(__name__)

YAHOO_RSS = "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%s&region=US&lang=en-US"
SEC_FEED = (
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=%s&type=%s"
    "&dateb=&owner=include&count=%d&output=atom"
)
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_USER_AGENT = "Petrazim Trading Portal contact.petrazim@gmail.com"
BROWSER_UA = "Mozilla/5.0 (compatible; PetrazimTradingPortal/1.0; +https://trade.petrazim.online)"

ITEMS_8K = {
    "1.01": "material agreement", "1.02": "agreement ended", "1.03": "bankruptcy",
    "1.05": "cybersecurity incident", "2.01": "acquisition or sale of assets",
    "2.02": "earnings results", "2.03": "new debt", "2.04": "debt acceleration",
    "2.05": "restructuring costs", "2.06": "impairment", "3.01": "delisting notice",
    "3.02": "unregistered share sale", "3.03": "shareholder rights change",
    "4.01": "auditor change", "4.02": "past financials no longer reliable",
    "5.01": "change in control", "5.02": "director or officer change",
    "5.03": "bylaws or fiscal year change", "5.07": "shareholder vote results",
    "7.01": "Regulation FD disclosure", "8.01": "other events", "9.01": "exhibits",
}
IMPORTANT_ITEMS = {"1.03", "1.05", "2.02", "2.04", "2.06", "3.01", "4.02", "5.01", "5.02"}
KEYWORDS = [
    ("earnings", r"\bearnings\b|\bresults\b|\bEPS\b|\bguidance\b|\bforecast\b"),
    ("analyst", r"\bupgrade[sd]?\b|\bdowngrade[sd]?\b|price target|\boutperform\b|\bunderperform\b"),
    ("legal", r"\blawsuit\b|\bsued\b|\bprobe\b|\binvestigation\b|\bSEC charges\b|\bantitrust\b|\bjudge\b|\bcourt\b"),
    ("deal", r"\bacqui(?:re|res|red|sition)\b|\bmerger\b|\bbuyout\b|\btakeover\b|\bdeal\b"),
    ("capital", r"\bdividend\b|\bbuyback\b|\brepurchase\b|\bstock split\b|\boffering\b"),
    ("people", r"\bCEO\b|\bCFO\b|\bresign|\bsteps down\b|\bappoint"),
    ("risk", r"\brecall\b|\bbankrupt|\bdefault\b|\bdelist|\bhack|\bbreach\b|\boutage\b"),
    ("halt", r"\bhalt(?:s|ed)?\b|\btrading (?:pause|suspen)"),
    ("regulatory", r"\bFDA\b|\bapproval\b|\bapproves\b|\bclinical\b|\bFTC\b|\bDOJ\b"),
    ("macro", r"\bFed\b|\bFOMC\b|\bCPI\b|\binflation\b|\bjobs report\b|\bpayrolls\b|\btariffs?\b|\bfutures\b"),
]


class NewsMonitorError(Exception):
    pass


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _text(el, name: str) -> str:
    for c in el.iter():
        if _local(c.tag) == name:
            return (c.text or "").strip()
    return ""


def _parse_time(value: Optional[str]) -> Optional[str]:
    """RFC 822 (RSS) or ISO 8601 (Atom) -> ISO UTC string, or None."""
    value = (value or "").strip()
    if not value:
        return None
    d = None
    try:
        d = email.utils.parsedate_to_datetime(value)
    except (TypeError, ValueError, IndexError):
        pass
    if d is None:
        try:
            d = _dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=_dt.timezone.utc)
    return d.astimezone(_dt.timezone.utc).isoformat()


def _tag(title: str, summary: str) -> List[str]:
    text = f"{title} {summary}"
    return [name for name, pattern in KEYWORDS if re.search(pattern, text, re.I)]


def _parse_rss(data: bytes, ticker: str) -> List[Dict[str, Any]]:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise NewsMonitorError(f"RSS for {ticker} is not valid XML: {exc}") from exc
    out = []
    for it in root.iter("item"):
        title, summary = _text(it, "title"), _text(it, "description")
        out.append({
            "id": "rss:" + (_text(it, "guid") or _text(it, "link")),
            "source": "Yahoo Finance", "kind": "headline", "ticker": ticker,
            "title": title, "summary": summary, "link": _text(it, "link"),
            "time": _parse_time(_text(it, "pubDate")), "important": False,
            "topics": _tag(title, summary),
        })
    return out


def _parse_sec_atom(data: bytes, ticker: str) -> List[Dict[str, Any]]:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise NewsMonitorError(f"SEC feed for {ticker} is not valid XML: {exc}") from exc
    company = ""
    for el in root.iter():
        if _local(el.tag) == "conformed-name":
            company = (el.text or "").strip()
            break
    out = []
    for entry in root.iter():
        if _local(entry.tag) != "entry":
            continue
        form = _text(entry, "filing-type")
        acc = _text(entry, "accession-number")
        items = re.findall(r"\d+\.\d+", _text(entry, "items-desc"))
        labels = [ITEMS_8K.get(i, f"item {i}") for i in items if i != "9.01"]
        link = ""
        for c in entry.iter():
            if _local(c.tag) == "link":
                link = c.get("href", "")
        title = f"{company or ticker} filed a {form}"
        if labels:
            title += ": " + ", ".join(labels)
        out.append({
            "id": "sec:" + acc, "source": "SEC EDGAR", "kind": "filing", "form": form,
            "ticker": ticker, "title": title, "summary": _text(entry, "form-name"),
            "items": items, "important": bool(set(items) & IMPORTANT_ITEMS),
            "link": link, "time": _parse_time(_text(entry, "updated")), "topics": [],
        })
    return out


async def _fetch(session: aiohttp.ClientSession, url: str, *, sec: bool = False) -> bytes:
    headers = {"User-Agent": SEC_USER_AGENT if sec else BROWSER_UA}
    try:
        async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=20)) as resp:
            if resp.status != 200:
                raise NewsMonitorError(f"HTTP {resp.status} for {url}")
            return await resp.read()
    except aiohttp.ClientError as exc:
        raise NewsMonitorError(f"could not reach {url}: {exc}") from exc


async def get_symbol_news(symbol: str, *, include_sec: bool = True, sec_form: str = "8-K") -> Dict[str, Any]:
    ticker = symbol.strip().upper()
    if not ticker:
        raise NewsMonitorError("symbol is required")

    items: List[Dict[str, Any]] = []
    errors: List[str] = []

    async with aiohttp.ClientSession() as session:
        try:
            rss_data = await _fetch(session, YAHOO_RSS % ticker)
            items += _parse_rss(rss_data, ticker)
        except NewsMonitorError as exc:
            errors.append(f"headlines: {exc}")

        if include_sec:
            try:
                tickers_data = await _fetch(session, SEC_TICKERS_URL, sec=True)
                import json
                cik_map: Dict[str, str] = {}
                for v in json.loads(tickers_data).values():
                    cik_map.setdefault(v["ticker"].upper().replace("-", "."), str(v["cik_str"]).zfill(10))
                cik = cik_map.get(ticker)
                if cik:
                    sec_data = await _fetch(session, SEC_FEED % (cik, sec_form, 10), sec=True)
                    items += _parse_sec_atom(sec_data, ticker)
                else:
                    errors.append(f"SEC: no CIK found for {ticker}")
            except NewsMonitorError as exc:
                errors.append(f"SEC: {exc}")

    items.sort(key=lambda it: it["time"] or "", reverse=True)
    return {"symbol": ticker, "items": items, "errors": errors}
