#!/usr/bin/env python3
"""
finish_build.py - Graphify Finalizer & Visualizer
Builds NetworkX graph, performs community clustering (Louvain), labels modules,
runs integrity diagnostics, generates GRAPH_REPORT.md, and exports graph.html.
"""

import sys
import json
import os
from pathlib import Path

def main():
    print("==================================================")
    print("  Graphify: Finalizing Graph, Report & Visualizer")
    print("==================================================")
    
    out_dir = Path("graphify-out")
    if not (out_dir / ".graphify_extract.json").exists():
        print("ERROR: graphify-out/.graphify_extract.json not found.")
        print("Please run extraction step first or run graphify.py directly.")
        sys.exit(1)

    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.analyze import god_nodes, surprising_connections, suggest_questions
    from graphify.report import generate
    from graphify.export import to_json
    from graphify.diagnostics import diagnose_extraction, format_diagnostic_report

    extraction = json.loads((out_dir / ".graphify_extract.json").read_text(encoding="utf-8"))
    
    root_str = "."
    if (out_dir / ".graphify_root").exists():
        root_str = (out_dir / ".graphify_root").read_text(encoding="utf-8").strip()

    detection = {}
    if (out_dir / ".graphify_detect.json").exists():
        detection = json.loads((out_dir / ".graphify_detect.json").read_text(encoding="utf-8"))

    print(f"\n[1/4] Building graph from {len(extraction.get('nodes', []))} nodes, {len(extraction.get('edges', []))} edges...")
    G = build_from_json(extraction, root=root_str, directed=False)
    if G.number_of_nodes() == 0:
        print("ERROR: Graph is empty.")
        sys.exit(1)

    print(f"\n[2/4] Running community clustering & cohesion scoring...")
    communities = cluster(G)
    cohesion = score_all(G, communities)
    tokens = {"input": extraction.get("input_tokens", 0), "output": extraction.get("output_tokens", 0)}
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)

    # Community labeling
    labels = {}
    for cid, nodes in communities.items():
        sample_names = [n.split('/')[-1].split('.')[0] for n in nodes[:5]]
        clean = [c for c in sample_names if c]
        labels[cid] = f"Cluster {cid} ({', '.join(clean[:2])})" if clean else f"Cluster {cid}"

    questions = suggest_questions(G, communities, labels)

    # Save graph.json
    to_json(G, communities, str(out_dir / "graph.json"))
    
    # Save GRAPH_REPORT.md
    report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, root_str, suggested_questions=questions)
    (out_dir / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    (out_dir / ".graphify_labels.json").write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8")

    analysis = {
        "communities": {str(k): v for k, v in communities.items()},
        "cohesion": {str(k): v for k, v in cohesion.items()},
        "gods": gods,
        "surprises": surprises,
        "questions": questions,
    }
    (out_dir / ".graphify_analysis.json").write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  Graph ready: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")

    # Diagnostics
    print(f"\n[3/4] Integrity Diagnostics:")
    summary = diagnose_extraction(extraction, directed=False, root=root_str)
    print(format_diagnostic_report(summary))

    # HTML Export
    print(f"\n[4/4] Exporting interactive visualizer (graph.html)...")
    try:
        from graphify.cli import export_html
        export_html(graph_file=str(out_dir / "graph.json"), output_file=str(out_dir / "graph.html"))
        print(f"  Interactive graph exported to: {out_dir / 'graph.html'}")
    except Exception as e:
        print(f"  Running CLI export: graphify export html")
        os.system("graphify export html")

    print("\n==================================================")
    print("  Build Finished! Open graphify-out/graph.html")
    print("==================================================")

if __name__ == "__main__":
    main()
