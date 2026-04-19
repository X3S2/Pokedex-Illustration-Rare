"""
Add the 15 missing SVP promo cards that pokemontcg.io API doesn't have.
Card names sourced from limitlesstcg.com; images from scrydex.com.
"""
import json, os, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

SET_DE = "SV Black Star Promos"
SET_EN = "SV Black Star Promos"

# Known missing SVP cards: number -> (name, dex_number or None)
# dex_number=None -> goes to trainer_cards
MISSING_SVP = {
    175: ("Espeon ex",                196),   # Espeon
    176: ("Umbreon ex",               197),   # Umbreon
    190: (None, None),  # unknown
    191: (None, None),  # unknown
    192: (None, None),  # unknown
    204: ("Cynthia's Garchomp ex",    445),   # Garchomp
    205: ("Team Rocket's Mewtwo ex",  150),   # Mewtwo
    208: ("Victini",                  494),   # Victini
    209: ("Thundurus",                642),   # Thundurus
    210: ("Tornadus",                 641),   # Tornadus
    211: ("Gothitelle",               576),   # Gothitelle
    212: ("Reuniclus",                579),   # Reuniclus
    213: (None, None),  # unknown
    214: (None, None),  # unknown
    215: (None, None),  # unknown
}

def dl(args):
    url, path = args
    for _ in range(3):
        subprocess.run(["curl", "-s", "-L", "-o", path, url], capture_output=True)
        if os.path.exists(path) and os.path.getsize(path) > 2000:
            return True
    return False

# ── Load state ────────────────────────────────────────────────────────────────

with open("data/pokemon_data.json", encoding="utf-8") as f:
    data = json.load(f)

dex_map = {p["id"]: p for p in data["pokemon"]}
existing_ids = {c["id"] for p in data["pokemon"] for c in p["cards"]}
existing_ids |= {c["id"] for c in data["trainer_cards"]}
print(f"Start: {len(existing_ids)} existing cards")

# Name → dex number map (for unknown cards)
name_to_dex = {}
for p in data["pokemon"]:
    name_to_dex[p["name_en"].lower()] = p["id"]

to_download = []
added = 0
skipped = 0

for num, (name, dex) in MISSING_SVP.items():
    card_id = f"svp-{num:03d}"
    if card_id in existing_ids:
        print(f"  Skip {card_id} (already exists)")
        skipped += 1
        continue

    if name is None:
        print(f"  Skip {card_id} (name unknown, not yet indexed anywhere)")
        continue

    img_path = f"images/cards/{card_id}.png"
    scrydex_url = f"https://images.scrydex.com/pokemon/{card_id}/small"

    entry = {
        "id":        card_id,
        "name":      name,
        "number":    str(num),
        "rarity":    "PRX",
        "set_id":    "svp",
        "set_en":    SET_EN,
        "set_de":    SET_DE,
        "pack":      SET_DE,
        "img":       img_path,
        "img_hires": img_path,
    }

    placed = False
    if dex and dex in dex_map:
        dex_map[dex]["cards"].append(entry)
        existing_ids.add(card_id)
        placed = True
    else:
        data["trainer_cards"].append(entry)
        existing_ids.add(card_id)

    to_download.append((scrydex_url, img_path))
    added += 1
    print(f"  Added {card_id} '{name}' -> dex#{dex if dex else 'trainer'}")

print(f"\nAdded: {added}, Skipped: {skipped}")

# ── Save ──────────────────────────────────────────────────────────────────────

with open("data/pokemon_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print("Saved data/pokemon_data.json")

# ── Download images ───────────────────────────────────────────────────────────

to_dl = [(url, path) for url, path in to_download if not os.path.exists(path)]
print(f"\nImages to download: {len(to_dl)}")

done = failed = 0
with ThreadPoolExecutor(max_workers=8) as exe:
    futures = {exe.submit(dl, a): a for a in to_dl}
    for fut in as_completed(futures):
        ok = fut.result()
        done += 1
        if not ok:
            failed += 1
            print(f"  FAILED: {futures[fut][1]}")

print(f"Downloads: {done} done, {failed} failed")

all_cards = [c for p in data["pokemon"] for c in p["cards"]] + data["trainer_cards"]
by_r = {}
for c in all_cards:
    by_r[c.get("rarity","?")] = by_r.get(c.get("rarity","?"),0) + 1
print(f"\nTotal cards: {len(all_cards)}, PRX: {by_r.get('PRX',0)}")
