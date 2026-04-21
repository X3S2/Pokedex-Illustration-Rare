"""
Add missing MEGA_ATTACK_RARE cards from me2pt5 (Ascended Heroes / ASC).
These were missed because the set has 295 cards (> 250 per page) and
we only fetched page 1. Images from scrydex.com.

Cards (all 7):
  me2pt5-265  Mega Froslass ex   dex=478
  me2pt5-266  Mega Eelektross ex dex=604
  me2pt5-267  Mega Diancie ex    dex=719
  me2pt5-268  Mega Hawlucha ex   dex=701
  me2pt5-269  Mega Gengar ex     dex=94
  me2pt5-270  Mega Scrafty ex    dex=560
  me2pt5-271  Mega Dragonite ex  dex=149
"""
import json, os, subprocess
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

def dl(args):
    url, path = args
    for _ in range(3):
        subprocess.run(["curl", "-s", "-L", "-o", path, url], capture_output=True)
        if os.path.exists(path) and os.path.getsize(path) > 2000:
            return True
    return False

with open("data/pokemon_data.json", encoding="utf-8") as f:
    data = json.load(f)

dex_map = {p["id"]: p for p in data["pokemon"]}
existing_ids = {c["id"] for p in data["pokemon"] for c in p["cards"]}
existing_ids |= {c["id"] for c in data["trainer_cards"]}
print(f"Start: {len(existing_ids)} existing cards")

# Get all me2pt5 cards (need page 2 for the missing ones)
all_cards = []
for page in [1, 2]:
    r = subprocess.run(["curl", "-s",
        f"https://api.pokemontcg.io/v2/cards?q={quote('set.id:me2pt5')}&pageSize=250&page={page}"],
        capture_output=True)
    all_cards.extend(json.loads(r.stdout).get("data", []))

# Get set info
r_set = subprocess.run(["curl", "-s", "https://api.pokemontcg.io/v2/sets/me2pt5"], capture_output=True)
set_info = json.loads(r_set.stdout).get("data", {})
set_en = set_info.get("name", "Ascended Heroes")
set_de = "Ascended Heroes"

to_download = []
added = 0

for card in all_cards:
    card_id = card["id"]
    if card_id in existing_ids:
        continue
    if card.get("rarity") != "MEGA_ATTACK_RARE":
        continue

    # Images come from scrydex for Meisterwerk sets
    img_path = f"images/cards/{card_id}.png"
    scrydex_url = f"https://images.scrydex.com/pokemon/{card_id}/small"

    # Try to get hires from scrydex too
    img_hires_path = img_path  # use same for now

    entry = {
        "id":        card_id,
        "name":      card["name"],
        "number":    card["number"],
        "rarity":    "MAR",
        "set_id":    "me2pt5",
        "set_en":    set_en,
        "set_de":    set_de,
        "pack":      set_de,
        "img":       img_path,
        "img_hires": img_hires_path,
    }

    dex_nums = card.get("nationalPokedexNumbers") or []
    placed = False
    for dex in dex_nums:
        if dex in dex_map:
            dex_map[dex]["cards"].append(entry)
            existing_ids.add(card_id)
            placed = True
            added += 1
            to_download.append((scrydex_url, img_path))
            print(f"  Added {card_id} '{card['name']}' -> dex#{dex}")
            break
    if not placed:
        data["trainer_cards"].append(entry)
        existing_ids.add(card_id)
        added += 1
        to_download.append((scrydex_url, img_path))
        print(f"  Added {card_id} '{card['name']}' -> trainer_cards")

print(f"\nAdded: {added}")

with open("data/pokemon_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print("Saved data/pokemon_data.json")

to_dl = [(url, path) for url, path in to_download if not os.path.exists(path)]
print(f"Images to download: {len(to_dl)}")

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

all_cards_db = [c for p in data["pokemon"] for c in p["cards"]] + data["trainer_cards"]
by_r = {}
for c in all_cards_db:
    by_r[c.get("rarity","?")] = by_r.get(c.get("rarity","?"),0)+1
print(f"\nTotal: {len(all_cards_db)}, MAR: {by_r.get('MAR',0)}")
