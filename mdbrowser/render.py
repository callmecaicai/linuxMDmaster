"""Markdown rendering helpers."""
import html
import re
import threading

try:
    import markdown as _markdown
except Exception:
    _markdown = None

_MD_EXTENSIONS = ["tables", "fenced_code"]
_TABLE_OPEN = "<table>"
_TABLE_WRAPPED_OPEN = '<div class="md-table-wrap"><table>'

_render_lock = threading.Lock()


def _wrap_tables(rendered):
    if _TABLE_OPEN not in rendered:
        return rendered
    return rendered.replace(_TABLE_OPEN, _TABLE_WRAPPED_OPEN).replace("</table>", "</table></div>")


if _markdown is not None:
    _MD_RENDERER = _markdown.Markdown(
        extensions=_MD_EXTENSIONS,
        output_format="html5",
    )
else:
    _MD_RENDERER = None

_RE_H = re.compile(r"^(#{1,6})\s+(.*)")
_RE_HR = re.compile(r"^-{3,}\s*$")
_RE_UL = re.compile(r"^(\s*)[-*+]\s+(.*)")
_RE_OL = re.compile(r"^(\s*)\d+\.\s+(.*)")
_RE_BQ = re.compile(r"^>\s?(.*)")
_RE_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_RE_INL = [
    (re.compile(r"`([^`]+)`"), r"<code>\1</code>"),
    (re.compile(r"\*\*(.+?)\*\*"), r"<strong>\1</strong>"),
    (re.compile(r"__(.+?)__"), r"<strong>\1</strong>"),
    (re.compile(r"\*(.+?)\*"), r"<em>\1</em>"),
    (re.compile(r"_(.+?)_"), r"<em>\1</em>"),
    (re.compile(r"~~(.+?)~~"), r"<del>\1</del>"),
]


def _safe_href(url):
    raw = html.unescape(url).strip()
    low = raw.lower()
    if low.startswith(("http://", "https://", "mailto:")):
        return url
    if raw.startswith(("/", "./", "../", "#")):
        return url
    return ""


def _inline(text):
    t = html.escape(text)
    for pat, repl in _RE_INL:
        t = pat.sub(repl, t)
    t = _RE_LINK.sub(
        lambda m: '<a href="%s">%s</a>' % (_safe_href(m.group(2)), m.group(1))
        if _safe_href(m.group(2))
        else m.group(1),
        t,
    )
    return t


def _render_md_legacy(txt):
    lines = txt.splitlines()
    out = []
    in_code = False
    in_ul = False
    in_ol = False

    def flush():
        nonlocal in_ul, in_ol
        if in_ul:
            out.append("</ul>")
            in_ul = False
        if in_ol:
            out.append("</ol>")
            in_ol = False

    for ln in lines:
        if ln.startswith("```"):
            flush()
            if not in_code:
                lang = html.escape(ln[3:].strip())
                in_code = True
                out.append('<pre><code class="lang-%s">' % lang if lang else "<pre><code>")
            else:
                in_code = False
                out.append("</code></pre>")
            continue
        if in_code:
            out.append(html.escape(ln))
            continue

        m = _RE_H.match(ln)
        if m:
            flush()
            lv = len(m.group(1))
            out.append("<h%d>%s</h%d>" % (lv, _inline(m.group(2)), lv))
            continue

        if _RE_HR.match(ln.strip()):
            flush()
            out.append("<hr>")
            continue

        m = _RE_UL.match(ln)
        if m:
            if in_ol:
                flush()
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append("<li>%s</li>" % _inline(m.group(2)))
            continue

        m = _RE_OL.match(ln)
        if m:
            if in_ul:
                flush()
            if not in_ol:
                out.append("<ol>")
                in_ol = True
            out.append("<li>%s</li>" % _inline(m.group(2)))
            continue

        flush()
        s = ln.strip()
        if not s:
            continue

        m = _RE_BQ.match(s)
        if m:
            out.append("<blockquote>%s</blockquote>" % _inline(m.group(1)))
            continue

        out.append("<p>%s</p>" % _inline(s))

    flush()
    if in_code:
        out.append("</code></pre>")
    return "\n".join(out)


def render_md(txt):
    if _MD_RENDERER is not None:
        with _render_lock:
            _MD_RENDERER.reset()
            return _wrap_tables(_MD_RENDERER.convert(txt or ""))
    return _render_md_legacy(txt or "")
