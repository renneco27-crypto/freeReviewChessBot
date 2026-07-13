#!/usr/bin/env python3
import http.server

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        super().end_headers()

if __name__ == '__main__':
    http.server.test(HandlerClass=Handler, port=PORT)
