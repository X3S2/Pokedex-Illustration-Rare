"""
Add Black White Rare + special Rare-above-set cards from Black Bolt (zsv10pt5)
and White Flare (rsv10pt5) sets. New rarity tag: BWR.

Black Bolt = zsv10pt5 (released 2025-07-18)
White Flare = rsv10pt5 (released 2025-07-18)

Missing:
  zsv10pt5-172 Zekrom ex  [Black White Rare]
  rsv10pt5-173 Reshiram ex [Black White Rare]
  zsv10pt5-171 Victini     [Rare, #>printedTotal -> special card]
  rsv10pt5-172 Victini     [Rare, #>printedTotal -> special card]
"""
import json, os, subprocess, time
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

SET_MAP = {
    "zsv10pt5": ("Black Bolt",   "Black Bolt"),
    "rsv10pt5": ("White Flare",  "White Flare"),
}

# Rarities to fetch from these sets (that we haven't included before)
TARGET_RARITIES = {"Black White Rare", "Rare"}

def api_url_to_local_path(api_url):
    if not api_url or "pokemontcg.io" not in api_url:
        return None
    suffix = api_url.replace("https://images.pokemontcg.io/", "")
    return f"images/cards/{suffix.replace('/', '-')}"

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

to_download = []
added = 0

for set_id, (set_de, pack) in SET_MAP.items():
    print(f"\nFetching {set_id} ({set_de})...")

    # Get set info to find printed total
    r = subprocess.run(["curl", "-s", f"https://api.pokemontcg.io/v2/sets/{set_id}"], capture_output=True)
    set_info = json.loads(r.stdout).get("data", {})
    printed_total = set_info.get("printedTotal", 0)
    set_en = set_info.get("name", set_de)
    print(f"  printedTotal: {printed_total}")

    # Fetch all cards
    r2 = subprocess.run(["curl", "-s", f"https://api.pokemontcg.io/v2/cards?q={quote('set.id:'+set_id)}&pageSize=250"],
                        capture_output=True)
    cards = json.loads(r2.stdout).get("data", [])

    for card in cards:
        card_id = card["id"]
        if card_id in existing_ids:
            continue

        rarity_api = card.get("rarity", "")
        if rarity_api not in TARGET_RARITIES:
            continue

        # For "Rare" rarity: only include cards numbered above the printed total
        if rarity_api == "Rare":
            try:
                num = int(card["number"])
            except ValueError:
                continue
            if num <= printed_total:
                continue  # regular Rare within set, skip

        api_url = card.get("images", {}).get("small", "")
        img_path = api_url_to_local_path(api_url) or f"images/cards/{card_id}.png"
        api_hires = card.get("images", {}).get("large", "")
        img_hires = api_url_to_local_path(api_hires) or img_path

        entry = {
            "id":        card_id,
            "name":      card["name"],
            "number":    card["number"],
            "rarity":    "BWR",
            "set_id":    set_id,
            "set_en":    set_en,
            "set_de":    set_de,
            "pack":      pack,
            "img":       img_path,
            "img_hires": img_hires,
        }

        dex_nums = card.get("nationalPokedexNumbers") or []
        placed = False
        for dex in dex_nums:
            if dex in dex_map:
                dex_map[dex]["cards"].append(entry)
                existing_ids.add(card_id)
                placed = True
                added += 1
                if api_url:
                    to_download.append((api_url, img_path))
                print(f"  Added {card_id} '{card['name']}' [{rarity_api}] -> dex#{dex}")
                break
        if not placed:
            data["trainer_cards"].append(entry)
            existing_ids.add(card_id)
            added += 1
            if api_url:
                to_download.append((api_url, img_path))
            print(f"  Added {card_id} '{card['name']}' [{rarity_api}] -> trainer_cards")

print(f"\nAdded: {added}")

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
print(f"\nTotal cards: {len(all_cards)}, BWR: {by_r.get('BWR',0)}")
