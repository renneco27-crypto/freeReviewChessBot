"""
sync_repos.py
Synchronizes index.html, graphify, and tools across:
1. C:\\Users\\corte\\Desktop\\New folder
2. C:\\Users\\corte\\Desktop\\New folder (4)\\chess-app
3. C:\\Users\\corte\\Documents\\do not delete second brain
"""

import shutil
import os

BASE_DIR = r"C:\Users\corte\Desktop\New folder"
CHESS_APP_DIR = r"C:\Users\corte\Desktop\New folder (4)\chess-app"
SECOND_BRAIN_DIR = r"C:\Users\corte\Documents\do not delete second brain"

def sync():
    index_html = os.path.join(BASE_DIR, "index.html")
    
    # 1. Sync to chess-app
    if os.path.exists(CHESS_APP_DIR):
        dst_html = os.path.join(CHESS_APP_DIR, "public", "repertoire_builder.html")
        shutil.copy2(index_html, dst_html)
        print(f"Synced {index_html} -> {dst_html}")
        
        # sync graphify & tools
        for folder in ["graphify", "tools"]:
            src = os.path.join(BASE_DIR, folder)
            dst = os.path.join(CHESS_APP_DIR, folder)
            if os.path.exists(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
                print(f"Synced folder {src} -> {dst}")

    # 2. Sync to second brain
    if os.path.exists(SECOND_BRAIN_DIR):
        dst_html = os.path.join(SECOND_BRAIN_DIR, "repertoire_builder_webapp.html")
        shutil.copy2(index_html, dst_html)
        print(f"Synced {index_html} -> {dst_html}")
        
        for folder in ["tools"]:
            src = os.path.join(BASE_DIR, folder)
            dst = os.path.join(SECOND_BRAIN_DIR, folder)
            if os.path.exists(src):
                shutil.copytree(src, dst, dirs_exist_ok=True)
                print(f"Synced folder {src} -> {dst}")

    print("All sync operations completed successfully!")

if __name__ == "__main__":
    sync()
