"""
branch_analyzer.py
Analyzes repertoire PGN move trees, classifies branches, and detects target plies (e.g. 6th Black move).
"""

import re

def tokenize_pgn(pgn_text):
    body = re.sub(r'\[.*?\]', '', pgn_text).strip()
    body = re.sub(r'(\*|1-0|0-1|1/2-1/2)\s*$', '', body).strip()
    token_pattern = re.compile(r'(\()|(\))|(\{[\s\S]*?\})|(\$\d+)|([0-9]+\.+)|([a-zA-Z0-9+#=_-]+)')
    tokens = []
    for match in token_pattern.finditer(body):
        if match.group(1): tokens.append({'type': 'open_paren'})
        elif match.group(2): tokens.append({'type': 'close_paren'})
        elif match.group(3): tokens.append({'type': 'comment', 'val': match.group(3)})
        elif match.group(6): tokens.append({'type': 'san', 'val': match.group(6)})
    return tokens

class TreeNode:
    def __init__(self, san=None, parent=None, ply=0):
        self.san = san
        self.parent = parent
        self.children = []
        self.ply = ply

def build_tree(tokens):
    root = TreeNode("START", None, 0)
    stack = [root]
    for token in tokens:
        curr = stack[-1]
        if token['type'] == 'open_paren':
            stack.append(curr.parent if curr.parent else root)
        elif token['type'] == 'close_paren':
            if len(stack) > 1: stack.pop()
        elif token['type'] == 'san':
            node = TreeNode(token['val'], curr, curr.ply + 1)
            curr.children.append(node)
            stack[-1] = node
    return root

def extract_lines(root):
    lines = []
    def dfs(node, path):
        if not node.children:
            if path: lines.append(path)
            return
        for c in node.children:
            dfs(c, path + [c])
    dfs(root, [])
    return lines

def get_6th_black_move(line):
    black_moves = [n for n in line if n.ply % 2 == 0]
    if len(black_moves) >= 6:
        return black_moves[5], 6
    elif black_moves:
        return black_moves[-1], len(black_moves)
    return line[-1], 1

if __name__ == "__main__":
    sample = "1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nxd4 5. Qxd4 d6 6. Nc3 Nf6 7. Bf4 Be7 8. O-O-O O-O *"
    toks = tokenize_pgn(sample)
    root = build_tree(toks)
    lines = extract_lines(root)
    for i, line in enumerate(lines):
        target, num = get_6th_black_move(line)
        print(f"Line {i+1} target Black move #{num}: {target.san} (Ply {target.ply})")
