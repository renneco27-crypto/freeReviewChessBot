"""
piece_generator.py
Generates, validates, and outputs high-visibility, crisp SVG base64 URIs
for all 12 chess pieces (White & Black).
"""

import base64

# Standard cburnett White King SVG:
wk_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/>
    <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fff" stroke-linecap="butt" stroke-linejoin="miter"/>
    <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#fff"/>
    <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/>
  </g>
</svg>'''

# Standard cburnett White Queen SVG:
wq_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 9a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/>
    <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" stroke-linecap="butt"/>
    <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
    <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/>
  </g>
</svg>'''

# Standard cburnett White Rook SVG:
wr_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="#fff" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12z"/>
    <path d="M12 9h4v2h5V9h5v2h5V9h4v5H11z" stroke-linecap="butt"/>
    <path d="M34 14l-3 3H14l-3-3"/>
    <path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/>
    <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
    <path d="M11 14h23" fill="none" stroke-linejoin="miter"/>
  </g>
</svg>'''

# Standard cburnett White Bishop SVG:
wb_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g fill="#fff" stroke-linecap="butt">
      <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
      <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
    </g>
    <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="currentColor" stroke-linejoin="miter"/>
  </g>
</svg>'''

# Standard cburnett White Knight SVG:
wn_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#fff"/>
    <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#fff"/>
    <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#000"/>
  </g>
</svg>'''

# Standard cburnett White Pawn SVG:
wp_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
</svg>'''

# High Visibility Black King SVG:
bk_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/>
    <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#000" stroke-linecap="butt" stroke-linejoin="miter"/>
    <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#000"/>
    <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="#ececec"/>
    <path d="M20 8h5" stroke="#ececec" stroke-linejoin="miter"/>
    <path d="M22.5 6v5.63" stroke="#ececec" stroke-linejoin="miter"/>
    <path d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5l.01 2.1-.01-2.1C20 18 9.906 14 6.997 19.85c-2.497 5.65 4.853 9 4.853 9" stroke="#ececec"/>
  </g>
</svg>'''

# High Visibility Black Queen SVG:
bq_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="none" fill="#000">
      <circle cx="6" cy="12" r="2.75"/>
      <circle cx="14" cy="9" r="2.75"/>
      <circle cx="22.5" cy="8" r="2.75"/>
      <circle cx="31" cy="9" r="2.75"/>
      <circle cx="39" cy="12" r="2.75"/>
    </g>
    <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z" stroke-linecap="butt"/>
    <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
    <circle cx="6" cy="12" r="1.5" fill="#ececec" stroke="none"/>
    <circle cx="14" cy="9" r="1.5" fill="#ececec" stroke="none"/>
    <circle cx="22.5" cy="8" r="1.5" fill="#ececec" stroke="none"/>
    <circle cx="31" cy="9" r="1.5" fill="#ececec" stroke="none"/>
    <circle cx="39" cy="12" r="1.5" fill="#ececec" stroke="none"/>
    <path d="M11 38.5a35 35 1 0 0 23 0" fill="none" stroke="#ececec" stroke-width="1"/>
    <path d="M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0" fill="none" stroke="#ececec"/>
  </g>
</svg>'''

# High Visibility Black Rook SVG:
br_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="#000" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 39h27v-3H9v3zm3.5-7l1.5-2.5h17l1.5 2.5h-20zm-.5 4v-4h21v4H12z" stroke-linecap="butt"/>
    <path d="M11 9v5h4v-2h5v2h5v-2h5v2h4V9H11z" stroke-linecap="butt" stroke-linejoin="miter"/>
    <path d="M14 29.5v-13h17v13H14z" stroke-linecap="butt" stroke-linejoin="miter"/>
    <path d="M14 16.5L11 14h23l-3 2.5H14z"/>
    <path d="M12 35.5h21m-20-4h19m-18-2h17m-17-13h17M11 14h23" fill="none" stroke="#ececec" stroke-width="1" stroke-linejoin="miter"/>
  </g>
</svg>'''

# High Visibility Black Bishop SVG:
bb_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <g fill="#000" stroke-linecap="butt">
      <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
      <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
      <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/>
    </g>
    <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="#ececec" stroke-linejoin="miter"/>
  </g>
</svg>'''

# High Visibility Black Knight SVG:
bn_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <g fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#000"/>
    <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#000"/>
    <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0zm5.433-9.75a.5 1.5 30 1 1-.866-.5.5 1.5 30 1 1 .866.5z" fill="#ececec" stroke="#ececec"/>
    <path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" fill="#ececec" stroke="none"/>
  </g>
</svg>'''

# High Visibility Black Pawn SVG:
bp_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="45" height="45">
  <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#000" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M22.5 10c-1.65 0-3 1.34-3 3 0 .67.22 1.28.59 1.78.36.49.8 1.13.91 2.22.11 1.08-.22 2-.91 2.69C18.67 21.11 17.5 22.89 17.5 25c0 1.52.7 2.88 1.8 3.77-2.25.8-5.55 4.16-5.55 10.1h17.5c0-5.94-3.3-9.3-5.55-10.1 1.1-.89 1.8-2.25 1.8-3.77 0-2.11-1.17-3.89-2.59-5.31-.69-.69-1.02-1.61-.91-2.69.11-1.09.55-1.73.91-2.22.37-.5.59-1.11.59-1.78 0-1.66-1.35-3-3-3z" fill="none" stroke="#ececec" stroke-width="1"/>
</svg>'''

def to_data_uri(svg):
    return "data:image/svg+xml;base64," + base64.b64encode(svg.strip().encode('utf-8')).decode('ascii')

PIECE_SVGS = {
    'w': {'p': to_data_uri(wp_svg), 'n': to_data_uri(wn_svg), 'b': to_data_uri(wb_svg), 'r': to_data_uri(wr_svg), 'q': to_data_uri(wq_svg), 'k': to_data_uri(wk_svg)},
    'b': {'p': to_data_uri(bp_svg), 'n': to_data_uri(bn_svg), 'b': to_data_uri(bb_svg), 'r': to_data_uri(br_svg), 'q': to_data_uri(bq_svg), 'k': to_data_uri(bk_svg)}
}

if __name__ == "__main__":
    print("Validating all 12 pieces...")
    for color in ['w', 'b']:
        for piece in ['p', 'n', 'b', 'r', 'q', 'k']:
            data = PIECE_SVGS[color][piece]
            raw = base64.b64decode(data.split(',')[1]).decode('utf-8')
            assert len(raw) > 50
            print(f"  ✓ {color}_{piece}: OK ({len(raw)} bytes)")
