#!/usr/bin/env python3
import http.server, os, json, re

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

    def is_path_forbidden(self):
        translated = self.translate_path(self.path)
        serving_dir = getattr(self, 'directory', None) or os.getcwd()
        try:
            rel = os.path.relpath(translated, serving_dir)
            parts = rel.split(os.sep)
            for part in parts:
                if part.startswith('.') and part not in ('.', '..'):
                    return True
        except Exception:
            return True
        return False

    def do_GET(self):
        if self.path == '/api/config':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            api_key = ''
            try:
                env_path = os.path.join(os.path.dirname(__file__), '.env')
                with open(env_path) as f:
                    for line in f:
                        m = re.match(r'MISTRAL_API_KEY=(.+)', line.strip())
                        if m:
                            api_key = m.group(1)
                            break
            except Exception:
                pass
            self.wfile.write(json.dumps({'MISTRAL_API_KEY': api_key}).encode())
            return
        if self.is_path_forbidden():
            self.send_error(403, "Access denied")
            return
        super().do_GET()

    def do_HEAD(self):
        if self.is_path_forbidden():
            self.send_error(403, "Access denied")
            return
        super().do_HEAD()

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

if __name__ == '__main__':
    with http.server.HTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print('Serving Chess Coach at http://127.0.0.1:' + str(PORT))
        httpd.serve_forever()
