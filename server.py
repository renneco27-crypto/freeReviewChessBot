#!/usr/bin/env python3
import http.server, os

PORT = 8080

MIME_MAP = {
    '.onnx': 'application/octet-stream',
    '.wasm': 'application/wasm',
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in MIME_MAP:
            return MIME_MAP[ext]
        return super().guess_type(path)

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

if __name__ == '__main__':
    with http.server.HTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print('Serving Chess Coach at http://127.0.0.1:' + str(PORT))
        httpd.serve_forever()
