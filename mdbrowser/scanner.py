"""Directory scanning helpers."""
import os
import re
from pathlib import Path

MAX_DEPTH = 3
PROBE_DEPTH = 2
EXT_MD = {".md"}
DOC_HINTS = {
    "book",
    "books",
    "doc",
    "docs",
    "guide",
    "guides",
    "handbook",
    "kb",
    "knowledge",
    "manual",
    "markdown",
    "md",
    "note",
    "notes",
    "readme",
    "reference",
    "references",
    "spec",
    "specs",
    "tutorial",
    "tutorials",
    "wiki",
}
IGNORED_DIR_NAMES = {
    "__pycache__",
    "bin",
    "boot",
    "build",
    "cache",
    "dev",
    "dist",
    "env",
    "etc",
    "lib",
    "lib64",
    "logs",
    "lost+found",
    "node_modules",
    "opt",
    "proc",
    "run",
    "sbin",
    "site-packages",
    "sys",
    "target",
    "tmp",
    "usr",
    "var",
    "venv",
}


def _split_name(name):
    return [part for part in re.split(r"[^a-z0-9]+", name.lower()) if part]


def _is_ignored_dir_name(name):
    low = name.lower()
    return (
        low.startswith(".")
        or low in IGNORED_DIR_NAMES
        or low.endswith(".egg-info")
        or low.endswith(".dist-info")
        or low.startswith("venv")
    )


def _has_doc_hint(name):
    parts = _split_name(name)
    return any(part in DOC_HINTS for part in parts)


def _probe_doc_signals(path, depth=0):
    md_count = 0
    doc_dirs = 0
    try:
        with os.scandir(path) as it:
            entries = list(it)
    except (PermissionError, OSError):
        return 0, 0

    for entry in entries:
        try:
            if entry.is_symlink():
                continue
            if entry.is_file(follow_symlinks=False):
                ext = os.path.splitext(entry.name)[1].lower()
                if ext in EXT_MD:
                    md_count += 1
            elif entry.is_dir(follow_symlinks=False):
                if _is_ignored_dir_name(entry.name):
                    continue
                if _has_doc_hint(entry.name):
                    doc_dirs += 1
                if depth < PROBE_DEPTH:
                    sub_md, sub_doc_dirs = _probe_doc_signals(entry.path, depth + 1)
                    md_count += sub_md
                    doc_dirs += sub_doc_dirs
            if md_count >= 6 or doc_dirs >= 1:
                break
        except OSError:
            continue
    return md_count, doc_dirs


def list_subdirs(root):
    try:
        with os.scandir(root) as it:
            entries = sorted(it, key=lambda x: x.name.lower())
            useful = []
            optional = []
            for e in entries:
                try:
                    if e.is_symlink():
                        continue
                    if not e.is_dir(follow_symlinks=False):
                        continue
                    if _is_ignored_dir_name(e.name):
                        continue
                    item = {"name": e.name, "path": e.path, "recommended": False}
                    md_count, doc_dirs = _probe_doc_signals(e.path)
                    if _has_doc_hint(e.name):
                        is_useful = md_count >= 1 or doc_dirs >= 1
                    else:
                        is_useful = doc_dirs >= 1 or md_count >= 6
                    if is_useful:
                        item["recommended"] = True
                        useful.append(item)
                    elif md_count > 0:
                        optional.append(item)
                except OSError:
                    continue
            return useful + optional
    except (PermissionError, OSError):
        return []


def scan_dirs(dirs):
    """Scan multiple directories sequentially."""
    if not dirs:
        return [], []

    results = []

    def scan_one(d):
        trees = []
        files = []
        seen = set()

        def build(p, depth):
            if depth > MAX_DEPTH:
                return None
            rp = str(p.resolve())
            if rp in seen:
                return None
            seen.add(rp)
            try:
                with os.scandir(p) as it:
                    entries = sorted(it, key=lambda x: (not x.is_dir(), x.name.lower()))
            except (PermissionError, OSError):
                return None
            has_md = False
            children = []
            for e in entries:
                try:
                    if e.is_symlink():
                        continue
                    ext = os.path.splitext(e.name)[1].lower()
                    if e.is_file(follow_symlinks=False) and ext in EXT_MD:
                        files.append({"name": e.name, "path": e.path, "type": "md"})
                        has_md = True
                    elif e.is_dir(follow_symlinks=False):
                        if _is_ignored_dir_name(e.name):
                            continue
                        sub = build(Path(e.path), depth + 1)
                        if sub:
                            children.append(sub)
                            has_md = True
                except OSError:
                    continue
            if not has_md:
                return None
            return {"path": str(p), "name": p.name, "depth": depth, "children": children}

        dp = Path(d)
        if dp.is_dir():
            t = build(dp, 0)
            if t:
                trees.append(t)
        results.append((trees, files))

    for d in dirs:
        scan_one(d)

    all_trees = []
    all_files = []
    for r in results:
        if r:
            all_trees.extend(r[0])
            all_files.extend(r[1])
    return all_trees, all_files
