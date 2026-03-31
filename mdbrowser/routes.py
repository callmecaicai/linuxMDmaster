"""Route handlers for MDBrowser."""
import html
import json
import os
from pathlib import Path

from .cache import cache_get, cache_put, scan_cache_get, scan_cache_put
from .config import MIME_MAP
from .render import render_md
from .scanner import list_subdirs, scan_dirs
from .templates import load_template

_allowed_roots = []


def set_allowed_roots(roots):
    global _allowed_roots
    cleaned = []
    seen = set()
    for root in roots or []:
        if not root:
            continue
        item = os.path.abspath(str(root).strip())
        if not item or item in seen or not os.path.isdir(item):
            continue
        cleaned.append(item)
        seen.add(item)
    _allowed_roots = cleaned


def route_root():
    return load_template("select.html"), "text/html", 200


def route_main():
    return load_template("main.html"), "text/html", 200


def route_subdirs(root):
    if not _allowed_roots:
        return json.dumps([], ensure_ascii=False, separators=(",", ":")), "application/json", 200
    root = os.path.abspath(root or _allowed_roots[0])
    if not any(_path_under_root(root, allowed) for allowed in _allowed_roots):
        root = _allowed_roots[0]
    groups = [{"label": root, "dirs": list_subdirs(root)}]
    for er in _allowed_roots:
        if os.path.realpath(er) != os.path.realpath(root):
            groups.append({"label": er, "dirs": list_subdirs(er)})
    return json.dumps(groups, ensure_ascii=False, separators=(",", ":")), "application/json", 200


def _query_roots(raw_dirs):
    if not raw_dirs:
        return []
    values = raw_dirs if isinstance(raw_dirs, list) else [raw_dirs]
    roots = []
    seen = set()
    for value in values:
        if not value:
            continue
        item = os.path.abspath(str(value).strip())
        if not item or item in seen:
            continue
        if _allowed_roots and not any(_path_under_root(item, allowed) for allowed in _allowed_roots):
            continue
        roots.append(item)
        seen.add(item)
    return roots


def _path_under_root(path, root):
    try:
        path_abs = os.path.realpath(path)
        root_abs = os.path.realpath(root)
        return os.path.commonpath([path_abs, root_abs]) == root_abs
    except Exception:
        return False


def _file_rows(scanned_files):
    files = []
    for item in scanned_files:
        try:
            st = os.stat(item["path"])
            mtime = st.st_mtime
            size = st.st_size
        except OSError:
            mtime = 0
            size = 0
        files.append({
            "name": item["name"],
            "path": item["path"],
            "type": item["type"],
            "title": item["name"],
            "mtime": mtime,
            "size": size,
        })
    return files


def _payload_for_roots(roots, force=False):
    ck = "L:" + ",".join(sorted(roots))
    if not force:
        cached = scan_cache_get(ck)
        if cached is not None:
            return cached
    trees, scanned_files = scan_dirs(roots)
    files = _file_rows(scanned_files)
    payload = {"trees": trees, "files": files, "total": len(files), "indexing": False}
    scan_cache_put(ck, payload)
    return payload


def _assert_path_allowed(path, roots, md_only=False):
    if not path or not os.path.isfile(path):
        return False, 404
    if md_only and os.path.splitext(path)[1].lower() != ".md":
        return False, 404
    if not roots:
        return False, 403
    if not any(_path_under_root(path, root) for root in roots):
        return False, 403
    return True, 200


def _diff_files(old_files, new_files):
    old_map = {item["path"]: (item.get("mtime", 0), item.get("size", 0)) for item in old_files}
    new_map = {item["path"]: (item.get("mtime", 0), item.get("size", 0)) for item in new_files}
    changed = sum(1 for path, meta in new_map.items() if old_map.get(path) != meta)
    deleted = sum(1 for path in old_map if path not in new_map)
    return changed, deleted


def route_load(raw_dirs):
    selected = _query_roots(raw_dirs)
    payload = _payload_for_roots(selected)
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return content, "application/json", 200


def route_read(fp, raw_roots=""):
    roots = _query_roots(raw_roots)
    allowed, status = _assert_path_allowed(fp, roots, md_only=True)
    if not allowed:
        if status == 403:
            return "<p>无权访问该文件</p>", "text/html", 403
        return "<p>文件未找到</p>", "text/html", 404
    try:
        mtime = os.path.getmtime(fp)
    except OSError:
        return "<p>文件读取失败</p>", "text/html", 500
    ck = "R:" + fp
    cached = cache_get(ck)
    if cached and cached[0] == mtime:
        return cached[1], "text/html", 200
    try:
        txt = Path(fp).read_text(encoding="utf-8", errors="replace")
    except Exception:
        return "<p>文件读取失败</p>", "text/html", 500
    rendered = render_md(txt)
    cache_put(ck, (mtime, rendered))
    return rendered, "text/html", 200


def route_refresh(raw_dirs=""):
    selected = _query_roots(raw_dirs)
    ck = "L:" + ",".join(sorted(selected))
    previous = scan_cache_get(ck) or {"trees": [], "files": [], "total": 0, "indexing": False}
    payload = _payload_for_roots(selected, force=True)
    changed, deleted = _diff_files(previous["files"], payload["files"])
    payload = {
        "ok": True,
        "changed": changed,
        "deleted": deleted,
        "trees": payload["trees"],
        "files": payload["files"],
        "total": payload["total"],
        "indexing": False,
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "application/json", 200


def route_raw(fp, raw_roots=""):
    roots = _query_roots(raw_roots)
    allowed, status = _assert_path_allowed(fp, roots, md_only=False)
    if not allowed:
        if status == 403:
            return "Forbidden", "text/plain", 403
        return "Not found", "text/plain", 404
    ext = os.path.splitext(fp)[1].lower()
    return fp, MIME_MAP.get(ext, "application/octet-stream"), 200


def route_static(name):
    root = (Path(__file__).resolve().parent / "ui" / "static").resolve()
    file_path = (root / name).resolve()
    try:
        file_path.relative_to(root)
    except ValueError:
        return "Not found", "text/plain", 404
    if not file_path.is_file():
        return "Not found", "text/plain", 404
    if name.endswith(".js"):
        ctype = "text/javascript"
    elif name.endswith(".css"):
        ctype = "text/css"
    else:
        ctype = "application/octet-stream"
    if ctype.startswith("text/"):
        return file_path.read_text(encoding="utf-8"), ctype, 200
    return file_path.read_bytes(), ctype, 200


def route_404():
    return "404", "text/html", 404


def route_error(exc):
    return "<p>服务器错误: %s</p>" % html.escape(str(exc)), "text/html", 500
