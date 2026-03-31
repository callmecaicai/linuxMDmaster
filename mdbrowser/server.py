"""HTTP server for MDBrowser."""
import gzip
import os
import sys
import urllib.parse
import webbrowser
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

from .config import EXTRA_ROOTS, GZIP_THRESHOLD, PORT
from .routes import (
    route_404,
    route_error,
    route_load,
    route_main,
    route_raw,
    route_read,
    route_refresh,
    route_root,
    set_allowed_roots,
    route_static,
    route_subdirs,
)


class Server(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    request_queue_size = 64


class Handler(BaseHTTPRequestHandler):
    server_version = "MDBrowser/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)

        try:
            if u.path == "/":
                content, ctype, status = route_root()
                self._send(content, ctype, status)
            elif u.path == "/main":
                content, ctype, status = route_main()
                self._send(content, ctype, status)
            elif u.path == "/subdirs":
                root = q.get("root", [""])[0] or "."
                content, ctype, status = route_subdirs(root)
                self._send(content, ctype, status)
            elif u.path == "/load":
                raw = q.get("dirs", [])
                content, ctype, status = route_load(raw)
                self._send(content, ctype, status)
            elif u.path == "/read":
                fp = q.get("path", [""])[0]
                roots = q.get("dirs", [])
                content, ctype, status = route_read(fp, roots)
                self._send(content, ctype, status)
            elif u.path == "/refresh":
                raw = q.get("dirs", [])
                content, ctype, status = route_refresh(raw)
                self._send(content, ctype, status)
            elif u.path == "/raw":
                fp = q.get("path", [""])[0]
                roots = q.get("dirs", [])
                content, ctype, status = route_raw(fp, roots)
                if status != 200:
                    self._send(content, ctype, status)
                    return
                try:
                    with open(content, "rb") as f:
                        fsize = f.seek(0, 2)
                        f.seek(0)
                        self.send_response(200)
                        self.send_header("Content-Type", ctype)
                        self.send_header("Content-Length", fsize)
                        self.send_header("Cache-Control", "max-age=300")
                        self.send_header("Connection", "keep-alive")
                        self.end_headers()
                        while True:
                            chunk = f.read(65536)
                            if not chunk:
                                break
                            self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
            elif u.path.startswith("/static/"):
                name = u.path[len("/static/"):]
                content, ctype, status = route_static(name)
                self._send(content, ctype, status)
            else:
                content, ctype, status = route_404()
                self._send(content, ctype, status)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return
        except Exception as e:
            content, ctype, status = route_error(e)
            self._send(content, ctype, status)

    def _send(self, content, ctype, status=200):
        is_text = ctype.startswith("text/") or ctype in {"application/json", "text/javascript"}
        raw = content.encode("utf-8") if isinstance(content, str) else content
        accept = self.headers.get("Accept-Encoding", "")
        try:
            if len(raw) > GZIP_THRESHOLD and "gzip" in accept:
                body = gzip.compress(raw, compresslevel=4)
                self.send_response(status)
                self.send_header("Content-Type", ctype + ("; charset=utf-8" if is_text else ""))
                self.send_header("Content-Encoding", "gzip")
            else:
                body = raw
                self.send_response(status)
                self.send_header("Content-Type", ctype + ("; charset=utf-8" if is_text else ""))
            self.send_header("Content-Length", len(body))
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            return


def main(argv=None):
    argv = sys.argv if argv is None else argv
    default_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    root = os.path.abspath(argv[1]) if len(argv) > 1 else default_root
    if not os.path.isdir(root):
        print("错误: %s 不是有效目录" % root)
        sys.exit(1)

    url = "http://localhost:%d/?root=%s" % (PORT, urllib.parse.quote(root))
    set_allowed_roots([root] + EXTRA_ROOTS)
    srv = Server(("0.0.0.0", PORT), Handler)
    print("\n  MD Browser v1.0")
    print("  根目录: %s" % root)
    print("  访问: %s" % url)
    print("  Ctrl+C 停止\n")

    threading.Thread(target=lambda: webbrowser.open(url), daemon=True).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\n  已停止")
        srv.shutdown()


if __name__ == "__main__":
    main()
