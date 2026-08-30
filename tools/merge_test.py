"""
merge_test.py
Automated test suite verifying non-conflicting PGN merging,
comment overwriting on identical paths, and recursive PGN tree serialization.
"""

import re
import chess

class TreeNode:
    def __init__(self, san=None, parent=None, ply=0, fen="", comment="", from_sq=None, to_sq=None):
        self.san = san
        self.parent = parent
        self.children = []
        self.comment = comment
        self.ply = ply
        self.fen = fen
        self.from_sq = from_sq
        self.to_sq = to_sq

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

def merge_tokens_into_tree(root, tokens):
    stack = [root]
    for token in tokens:
        curr = stack[-1]
        if token['type'] == 'open_paren':
            stack.append(curr.parent if curr.parent else root)
        elif token['type'] == 'close_paren':
            if len(stack) > 1: stack.pop()
        elif token['type'] == 'comment' and token.get('val'):
            if curr:
                # Update existing comment to latest note
                curr.comment = token['val'].strip('{}').strip()
        elif token['type'] == 'san':
            san_move = token['val'].replace('0-0-0', 'O-O-O').replace('0-0', 'O-O')
            board = chess.Board(curr.fen)
            try:
                m = board.parse_san(san_move)
                board.push(m)
                matching = next((c for c in curr.children if c.san == m.uci() or c.san == san_move), None)
                if matching:
                    stack[-1] = matching
                else:
                    new_node = TreeNode(san_move, curr, curr.ply + 1, board.fen(), "", m.from_square, m.to_square)
                    curr.children.append(new_node)
                    stack[-1] = new_node
            except Exception as e:
                matching = next((c for c in curr.children if c.san == san_move), None)
                if matching:
                    stack[-1] = matching
                else:
                    new_node = TreeNode(san_move, curr, curr.ply + 1, curr.fen)
                    curr.children.append(new_node)
                    stack[-1] = new_node

def serialize_tree_to_pgn(root):
    def node_to_pgn(node):
        parts = []
        for i, child in enumerate(node.children):
            move_str = ""
            ply = child.ply
            move_num = (ply + 1) // 2
            if ply % 2 == 1:
                move_str = f"{move_num}. {child.san}"
            else:
                move_str = f"{child.san}" if i == 0 else f"{move_num}... {child.san}"
            
            if child.comment:
                move_str += f" {{{child.comment}}}"
            
            sub_pgn = node_to_pgn(child)
            if sub_pgn:
                move_str += f" {sub_pgn}"
            
            if i == 0:
                parts.append(move_str)
            else:
                parts.append(f"({move_str})")
        return " ".join(parts)
    
    return node_to_pgn(root) + " *"

if __name__ == "__main__":
    initial_board = chess.Board()
    root = TreeNode("START", None, 0, initial_board.fen())

    # 1. First PGN: Scotch Line
    pgn1 = "1. e4 {e4 move} e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nxd4 5. Qxd4 *"
    merge_tokens_into_tree(root, tokenize_pgn(pgn1))
    print(f"After PGN 1: Root has {len(root.children)} children (e4)")
    assert len(root.children) == 1
    assert root.children[0].san == "e4"
    assert root.children[0].comment == "e4 move"

    # 2. Second PGN: Scandinavian Line (Different 1... response, non-conflicting!)
    pgn2 = "1. e4 {Updated e4 note} d5 2. exd5 Qxd5 3. Nc3 Qa5 *"
    merge_tokens_into_tree(root, tokenize_pgn(pgn2))
    
    # 1. e4 should now have 2 children: e5 and d5!
    e4_node = root.children[0]
    print(f"e4 node has {len(e4_node.children)} responses: {[c.san for c in e4_node.children]}")
    assert len(e4_node.children) == 2
    assert set(c.san for c in e4_node.children) == {"e5", "d5"}
    assert e4_node.comment == "Updated e4 note"

    # 3. Third PGN: French Defense (1. e4 e6)
    pgn3 = "1. e4 e6 2. d4 d5 *"
    merge_tokens_into_tree(root, tokenize_pgn(pgn3))
    print(f"e4 node now has {len(e4_node.children)} responses: {[c.san for c in e4_node.children]}")
    assert len(e4_node.children) == 3
    assert set(c.san for c in e4_node.children) == {"e5", "d5", "e6"}

    # 4. Serialize full tree to PGN
    full_pgn = serialize_tree_to_pgn(root)
    print("\nSerialized Full Merged Repertoire PGN:\n", full_pgn)
    assert "e5" in full_pgn and "d5" in full_pgn and "e6" in full_pgn
    print("\n[SUCCESS] ALL MERGE & SERIALIZATION TESTS PASSED!")
