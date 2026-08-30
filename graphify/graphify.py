#!/usr/bin/env python3
"""
graphify_runner.py / graphify.py - Standalone Knowledge Graph Pipeline
Automated pipeline that converts any folder of code and docs into a queryable knowledge graph.
"""

import sys
import os

# Prevent self-import collision when script is named graphify.py
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir in sys.path:
    sys.path.remove(current_dir)

import json
import time
import argparse
import multiprocessing
from pathlib import Path
from collections import Counter

def run_graphify(
    target_path: str = ".",
    directed: bool = False,
    obsidian: bool = False,
    obsidian_dir: str = None,
    no_viz: bool = False,
    deep_mode: bool = False
):
    root = Path(target_path).resolve()
    print(f"==================================================")
    print(f"  Graphify Knowledge Graph Pipeline")
    print(f"  Target: {root}")
    print(f"==================================================")

    out_dir = Path("graphify-out")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Save interpreter & root for persistent subcommands
    (out_dir / ".graphify_python").write_text(sys.executable, encoding="utf-8")
    (out_dir / ".graphify_root").write_text(str(root), encoding="utf-8")

    # Step 1: Detect files
    print("\n[1/5] Detecting corpus files...")
    t0 = time.time()
    from graphify.detect import detect
    detection = detect(root)
    (out_dir / ".graphify_detect.json").write_text(json.dumps(detection, indent=2, ensure_ascii=False), encoding="utf-8")
    
    total_files = detection.get("total_files", 0)
    total_words = detection.get("total_words", 0)
    files_map = detection.get("files", {})
    
    print(f"  Corpus: {total_files} files · ~{total_words:,} words (scanned in {time.time()-t0:.2f}s)")
    for cat, flist in files_map.items():
        if flist:
            exts = sorted({Path(f).suffix for f in flist if Path(f).suffix})
            print(f"    - {cat}: {len(flist)} files ({' '.join(exts)})")

    if total_files == 0:
        print("ERROR: No supported files found.")
        return

    # Step 2: Extraction
    print("\n[2/5] Extracting AST & structure...")
    t0 = time.time()
    from graphify.extract import collect_files, extract
    
    code_files = []
    for f in files_map.get("code", []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
        
    if code_files:
        print(f"  Running multi-process AST extraction on {len(code_files)} code files...")
        ast_result = extract(code_files, cache_root=root)
        (out_dir / ".graphify_ast.json").write_text(json.dumps(ast_result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  AST extracted: {len(ast_result.get('nodes', []))} nodes, {len(ast_result.get('edges', []))} edges in {time.time()-t0:.2f}s")
    else:
        ast_result = {"nodes": [], "edges": [], "input_tokens": 0, "output_tokens": 0}
        (out_dir / ".graphify_ast.json").write_text(json.dumps(ast_result, ensure_ascii=False), encoding="utf-8")

    # Semantic placeholder / merge
    (out_dir / ".graphify_semantic.json").write_text(json.dumps({"nodes": [], "edges": [], "hyperedges": [], "input_tokens": 0, "output_tokens": 0}), encoding="utf-8")
    
    # Merge AST + Semantic
    seen_ids = {n["id"] for n in ast_result["nodes"]}
    merged_nodes = list(ast_result["nodes"])
    merged_edges = list(ast_result["edges"])
    
    extract_data = {
        "nodes": merged_nodes,
        "edges": merged_edges,
        "hyperedges": [],
        "input_tokens": 0,
        "output_tokens": 0,
    }
    (out_dir / ".graphify_extract.json").write_text(json.dumps(extract_data, indent=2, ensure_ascii=False), encoding="utf-8")

    # Step 3: Build Graph, Clustering, Analysis
    print("\n[3/5] Building graph, community clustering & cohesion scoring...")
    t0 = time.time()
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json
    from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

    G = build_from_json(extract_data, root=str(root), directed=directed)
    if G.number_of_nodes() == 0:
        print("ERROR: Graph is empty.")
        return

    communities = cluster(G)
    cohesion = score_all(G, communities)
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)
    
    # Generate labels
    labels = {}
    for cid, nodes in communities.items():
        sample_names = [n.split('/')[-1].split('.')[0] for n in nodes[:5]]
        clean = [c for c in sample_names if c]
        labels[cid] = f"Cluster {cid} ({', '.join(clean[:2])})" if clean else f"Cluster {cid}"

    questions = suggest_questions(G, communities, labels)

    to_json(G, communities, str(out_dir / "graph.json"))
    report = generate(G, communities, cohesion, labels, gods, surprises, detection, {"input": 0, "output": 0}, str(root), suggested_questions=questions)
    (out_dir / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    (out_dir / ".graphify_labels.json").write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8")

    print(f"  Graph created: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities in {time.time()-t0:.2f}s")

    # Diagnostics
    diag = diagnose_extraction(extract_data, directed=directed, root=str(root))
    print(format_diagnostic_report(diag))

    # Step 4: Export Visualizations
    print("\n[4/5] Exporting interactive visualizations...")
    if not no_viz:
        try:
            from graphify.cli import export_html
            export_html(graph_file=str(out_dir / "graph.json"), output_file=str(out_dir / "graph.html"))
            print(f"  Interactive graph written to: {out_dir / 'graph.html'}")
        except Exception as e:
            # CLI fallback
            os.system("graphify export html")

    if obsidian:
        print("  Exporting Obsidian vault...")
        obs_path = obsidian_dir or str(out_dir / "obsidian")
        os.system(f"graphify export obsidian --dir \"{obs_path}\"")

    # Step 5: Save manifest & cleanup
    print("\n[5/5] Finalizing manifest and reports...")
    from graphify.detect import save_manifest
    save_manifest(detection.get("files", {}), root=str(root))

    print(f"\n==================================================")
    print(f"  Pipeline Complete! Outputs in: {out_dir.resolve()}")
    print(f"    - graph.html        : Interactive visualizer")
    print(f"    - GRAPH_REPORT.md   : Analysis & audit report")
    print(f"    - graph.json        : Full graph structure data")
    print(f"==================================================\n")

if __name__ == "__main__":
    multiprocessing.freeze_support()
    parser = argparse.ArgumentParser(description="Graphify Knowledge Graph Builder")
    parser.add_argument("path", nargs="?", default=".", help="Directory to graph (default: .)")
    parser.add_argument("--directed", action="store_true", help="Preserve directed edges")
    parser.add_argument("--obsidian", action="store_true", help="Generate Obsidian vault")
    parser.add_argument("--obsidian-dir", help="Custom path for Obsidian vault")
    parser.add_argument("--no-viz", action="store_true", help="Skip HTML visualization")
    parser.add_argument("--mode", default="fast", choices=["fast", "deep"], help="Extraction mode")

    args = parser.parse_args()
    run_graphify(
        target_path=args.path,
        directed=args.directed,
        obsidian=args.obsidian,
        obsidian_dir=args.obsidian_dir,
        no_viz=args.no_viz,
        deep_mode=(args.mode == "deep")
    )
