"""
Add SWSH and SM Black Star special promo cards as PRX rarity.
Covers: swshp (V/VMAX/VSTAR promos), smp (GX promos)
"""
import json, os, subprocess, time
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor, as_completed

SPECIAL_SUBTYPES = {'ex', 'V', 'VMAX', 'VSTAR', 'GX', 'EX', 'BREAK', 'TAG TEAM'}

SET_MAP = {
    "swshp": ("SWSH Black Star Promos", "SWSH Black Star Promos"),
    "smp":   ("SM Black Star Promos",   "SM Black Star Promos"),
}

def api_url_to_local_path(api_url):
    if not api_url or "pokemontcg.io" not in api_url:
        return None
    suffix = api_url.replace("https://images.pokemontcg.io/", "")
    return f"images/cards/{suffix.replace('/', '-')}"

def dl(args):
    api_url, local_path = args
    for _ in range(3):
        subprocess.run(["curl", "-s", "-L", "-o", local_path, api_url], capture_output=True)
        if os.path.exists(local_path) and os.path.getsize(local_path) > 2000:
            return True
    return False

# ── Load state ────────────────────────────────────────────────────────────────

with open("data/pokemon_data.json", encoding="utf-8") as f:
    data = json.load(f)

dex_map = {p["id"]: p for p in data["pokemon"]}
existing_ids = {c["id"] for p in data["pokemon"] for c in p["cards"]}
existing_ids |= {c["id"] for c in data["trainer_cards"]}
print(f"Start: {len(existing_ids)} existing cards")

# ── Fetch promos ──────────────────────────────────────────────────────────────

to_download = []
added = 0

for set_id in ["swshp", "smp"]:
    print(f"\nFetching {set_id} promos...")
    page = 1
    all_cards = []
    while True:
        q = f"set.id:{set_id}"
        url = f"https://api.pokemontcg.io/v2/cards?q={quote(q)}&pageSize=250&page={page}"
        r = subprocess.run(["curl", "-s", url], capture_output=True)
        d = json.loads(r.stdout)
        batch = d.get("data", [])
        all_cards.extend(batch)
        if len(batch) < 250:
            break
        page += 1

    special = [c for c in all_cards if any(s in c.get("subtypes", []) for s in SPECIAL_SUBTYPES)]
    print(f"  Total: {len(all_cards)}, Special: {len(special)}")

    set_de, pack = SET_MAP[set_id]

    for card in special:
        card_id = card["id"]
        if card_id in existing_ids:
            continue

        set_en  = card["set"]["name"]
        api_url = card.get("images", {}).get("small", "")
        img_path = api_url_to_local_path(api_url) or f"images/cards/{card_id}.png"

        entry = {
            "id":        card_id,
            "name":      card["name"],
            "number":    card["number"],
            "rarity":    "PRX",
            "set_id":    set_id,
            "set_en":    set_en,
            "set_de":    set_de,
            "pack":      pack,
            "img":       img_path,
            "img_hires": img_path,
        }

        dex_nums = card.get("nationalPokedexNumbers") or []
        placed = False
        for dex in dex_nums:
            if dex in dex_map:
                dex_map[dex]["cards"].append(entry)
                existing_ids.add(card_id)
                added += 1
                placed = True
                if api_url:
                    to_download.append((api_url, img_path))
                break
        if not placed:
            data["trainer_cards"].append(entry)
            existing_ids.add(card_id)
            added += 1
            if api_url:
                to_download.append((api_url, img_path))

        print(f"  Added {card_id} {card['name']}")

print(f"\nNew PRX cards added: {added}")

# ── Save ──────────────────────────────────────────────────────────────────────

with open("data/pokemon_data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
print("Saved data/pokemon_data.json")

# ── Download images ───────────────────────────────────────────────────────────

to_dl = [(url, path) for url, path in to_download if url and not os.path.exists(path)]
print(f"\nImages to download: {len(to_dl)}")

done = failed = 0
with ThreadPoolExecutor(max_workers=15) as exe:
    futures = {exe.submit(dl, a): a for a in to_dl}
    for fut in as_completed(futures):
        ok = fut.result()
        done += 1
        if not ok: failed += 1

print(f"Downloads: {done} done, {failed} failed")

all_cards = [c for p in data["pokemon"] for c in p["cards"]] + data["trainer_cards"]
by_rarity = {}
for c in all_cards:
    r = c.get("rarity", "?")
    by_rarity[r] = by_rarity.get(r, 0) + 1
print(f"\nTotal cards: {len(all_cards)}")
print(f"PRX count: {by_rarity.get('PRX', 0)}")
