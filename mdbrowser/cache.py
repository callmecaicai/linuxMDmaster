"""Thread-safe caches used by the server."""
import threading
from collections import OrderedDict

_lock = threading.Lock()
_cache = OrderedDict()
_scan_cache = OrderedDict()
_CACHE_LIMIT = 128
_SCAN_CACHE_LIMIT = 32


def _cache_put_lru(store, key, val, limit):
    store[key] = val
    store.move_to_end(key)
    while len(store) > limit:
        store.popitem(last=False)


def cache_get(key):
    with _lock:
        val = _cache.get(key)
        if val is not None:
            _cache.move_to_end(key)
        return val


def cache_put(key, val):
    with _lock:
        _cache_put_lru(_cache, key, val, _CACHE_LIMIT)


def scan_cache_get(key):
    with _lock:
        val = _scan_cache.get(key)
        if val is not None:
            _scan_cache.move_to_end(key)
        return val


def scan_cache_put(key, val):
    with _lock:
        _cache_put_lru(_scan_cache, key, val, _SCAN_CACHE_LIMIT)


def cache_clear_scan():
    """Only clear directory/file scan cache and keep rendered content."""
    with _lock:
        _scan_cache.clear()


def cache_clear_all():
    with _lock:
        _cache.clear()
        _scan_cache.clear()
