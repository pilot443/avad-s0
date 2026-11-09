"""Локальный сервер 3D-просмотра краба Авад S-0: отдаёт эту папку на http://127.0.0.1:<порт>/ (по умолчанию 8768).

  python serve.py [порт]

Свой сервер вместо `python -m http.server`: на Windows реестр иногда отдаёт .js как text/plain, и модули three.js не грузятся.
"""
import functools
import http.server
import sys
from pathlib import Path

ПАПКА = Path(__file__).resolve().parent


class Обработчик(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".json": "application/json", ".css": "text/css",
                      ".bin": "application/octet-stream", ".html": "text/html; charset=utf-8", ".png": "image/png"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    порт = int(sys.argv[1]) if len(sys.argv) > 1 else 8768
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("127.0.0.1", порт), functools.partial(Обработчик, directory=str(ПАПКА))) as s:
        print(f"Авад S-0, 3D-просмотр: http://127.0.0.1:{порт}/  (закрыть — Ctrl+C или это окно)")
        s.serve_forever()
