/* Pokémon Illustration Rare Finder – App JS */

(function () {
  'use strict';

  /* ── State ── */
  let allPokemon = [];
  let trainerCards = [];
  let generations = [];
  let currentGen = 'all';
  let currentRarity = 'all';
  let searchQuery = '';
  let modalCard = null;

  /* ── DOM refs ── */
  const mainContent  = document.getElementById('mainContent');
  const loadingState = document.getElementById('loadingState');
  const statsText    = document.getElementById('statsText');
  const searchInput  = document.getElementById('searchInput');
  const searchClear  = document.getElementById('searchClear');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose   = document.getElementById('modalClose');
  const modalInner   = document.getElementById('modalInner');

  /* ── Generation colors ── */
  const GEN_COLORS = {
    1: { cls: 'gen-1', name: 'Kanto',  emoji: '🔴' },
    2: { cls: 'gen-2', name: 'Johto',  emoji: '🟡' },
    3: { cls: 'gen-3', name: 'Hoenn',  emoji: '🔵' },
    4: { cls: 'gen-4', name: 'Sinnoh', emoji: '🟣' },
    5: { cls: 'gen-5', name: 'Einall', emoji: '⚫' },
    6: { cls: 'gen-6', name: 'Kalos',  emoji: '🟢' },
    7: { cls: 'gen-7', name: 'Alola',  emoji: '🟠' },
    8: { cls: 'gen-8', name: 'Galar',  emoji: '🔷' },
    9: { cls: 'gen-9', name: 'Paldea', emoji: '🎯' },
  };

  /* ── Placeholder SVG ── */

  /* ── Load data ── */
  async function loadData() {
    try {
      const resp = await fetch('data/pokemon_data.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allPokemon  = data.pokemon;
      trainerCards = data.trainer_cards;
      generations = data.generations;
      init();
    } catch (err) {
      mainContent.innerHTML = `<div class="no-results">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <h2>Fehler beim Laden</h2>
        <p>Daten konnten nicht geladen werden.</p>
      </div>`;
      console.error(err);
    }
  }

  /* ── Init ── */
  function init() {
    const allCards = allPokemon.flatMap(p => p.cards).concat(trainerCards);
    const byTag = { IR: 0, SIR: 0, TG: 0, SR: 0, SUR: 0, CC: 0, UR: 0, HR: 0, ACE: 0, RU: 0, RR: 0, RS: 0, AR: 0, RD: 0, RSH: 0, SHG: 0, PRX: 0 };
    allCards.forEach(c => { byTag[c.rarity] = (byTag[c.rarity] || 0) + 1; });
    const withCards = allPokemon.filter(p => p.cards.length > 0).length;
    statsText.innerHTML = `
      <strong>${allCards.length.toLocaleString('de')}</strong> Karten ·
      <span class="stat-ir">IR: ${byTag.IR}</span> ·
      <span class="stat-sir">SIR: ${byTag.SIR}</span> ·
      <span class="stat-ur">UR: ${byTag.UR}</span> ·
      <span class="stat-ru">FA: ${byTag.RU}</span> ·
      <span class="stat-tg">TG: ${byTag.TG}</span> ·
      <span class="stat-sr">SR: ${byTag.SR}</span> ·
      <span class="stat-sur">SUR: ${byTag.SUR}</span> ·
      <span class="stat-hr">HR: ${byTag.HR}</span> ·
      <span class="stat-rr">RR: ${byTag.RR}</span> ·
      <span class="stat-rs">Secret: ${byTag.RS}</span> ·
      <span class="stat-ace">ACE: ${byTag.ACE}</span> ·
      <span class="stat-cc">CC: ${byTag.CC}</span> ·
      <span class="stat-ar">AR: ${byTag.AR}</span> ·
      <span class="stat-rd">RD: ${byTag.RD}</span> ·
      <span class="stat-rsh">RSH: ${byTag.RSH}</span> ·
      <span class="stat-shg">SHG: ${byTag.SHG}</span> ·
      <span class="stat-prx">Promo: ${byTag.PRX}</span> ·
      <strong>${withCards}</strong> von ${allPokemon.length} Pokémon
    `;
    renderAll();
  }

  /* ── Format dex number ── */
  function padNum(n) { return '#' + String(n).padStart(4, '0'); }

  /* ── Escape HTML ── */
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  /* ── Highlight search term ── */
  function highlight(text, query) {
    if (!query) return esc(text);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return esc(text).replace(
      new RegExp(escaped.replace(/[a-z]/gi, c => `[${c.toUpperCase()}${c.toLowerCase()}]`), 'gi'),
      m => `<mark class="highlight">${m}</mark>`
    );
  }

  /* ── Normalize string for search ── */
  function norm(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[äÄ]/g,'a').replace(/[öÖ]/g,'o').replace(/[üÜ]/g,'u').replace(/ß/g,'ss');
  }

  /* ── Matches search ── */
  function matchesSearch(poke, q) {
    if (!q) return true;
    const n = norm(q);
    return norm(poke.name_de).includes(n) || norm(poke.name_en).includes(n);
  }

  function matchesTrainer(card, q) {
    if (!q) return true;
    return norm(card.name).includes(norm(q));
  }

  /* ── Rarity badge label ── */
  const RARITY_LABEL = { IR: 'IR', SIR: 'SIR', TG: 'TG', SR: 'SR', SUR: 'SUR', CC: 'CC', UR: 'UR', HR: 'HR', ACE: 'ACE', RU: 'FA', RR: 'RR', RS: 'Secret', AR: 'AR', RD: 'RD', RSH: 'RSH', SHG: 'SHG', PRX: 'Promo' };
  const RARITY_CLASS = { IR: 'badge-ir', SIR: 'badge-sir', TG: 'badge-tg', SR: 'badge-sr', SUR: 'badge-sur', CC: 'badge-cc', UR: 'badge-ur', HR: 'badge-hr', ACE: 'badge-ace', RU: 'badge-ru', RR: 'badge-rr', RS: 'badge-rs', AR: 'badge-ar', RD: 'badge-rd', RSH: 'badge-rsh', SHG: 'badge-shg', PRX: 'badge-prx' };

  /* ── Build IR thumbnail HTML ── */
  function buildIRThumb(card) {
    const tag = card.rarity || 'IR';
    return `
      <div class="ir-thumb" data-card-id="${esc(card.id)}"
           title="${esc(card.name)} · ${esc(card.set_de)} [${tag}]">
        <img src="${esc(card.img)}"
             alt="${esc(card.name)}"
             loading="lazy"
             width="70"
             onerror="this.onerror=null;this.src='images/placeholder.svg'">
        <span class="ir-rarity-badge ${RARITY_CLASS[tag] || 'badge-ir'}">${tag}</span>
        <span class="ir-set-badge">${esc(card.set_de)}</span>
      </div>`;
  }

  /* ── Build placeholder HTML ── */
  function buildPlaceholder() {
    return `
      <div class="ir-placeholder" title="Keine Karten verfügbar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
          <circle cx="16" cy="16" r="2" stroke-dasharray="3 2"/>
        </svg>
        <span>Keine Karten</span>
      </div>`;
  }

  /* ── Build single Pokémon entry HTML ── */
  function buildPokeEntry(poke, query) {
    const isMatch = matchesSearch(poke, query);
    const visibleCards = currentRarity === 'all'
      ? poke.cards
      : poke.cards.filter(c => c.rarity === currentRarity);
    const hasCards = visibleCards.length > 0;

    // Hide if rarity filter active and no matching cards
    if (currentRarity !== 'all' && !hasCards) return '';

    const dimClass = query && !isMatch ? ' hidden' : '';
    const hlClass  = query && isMatch ? ' highlighted' : '';

    const cardsHtml = hasCards
      ? visibleCards.map(c => buildIRThumb(c)).join('')
      : buildPlaceholder();

    return `
      <div class="poke-entry${dimClass}${hlClass}" data-id="${poke.id}">
        <div class="poke-header">
          <span class="poke-num">${padNum(poke.id)}</span>
          <div class="poke-names">
            <div class="poke-name-de">${highlight(poke.name_de, query)}</div>
            <div class="poke-name-en">${highlight(poke.name_en, query)}</div>
          </div>
        </div>
        <div class="ir-cards-row">${cardsHtml}</div>
      </div>`;
  }

  /* ── Build trainer entry HTML ── */
  function buildTrainerEntry(card, query) {
    const isMatch = matchesTrainer(card, query);
    const dimClass = query && !isMatch ? ' hidden' : '';
    const hlClass  = query && isMatch  ? ' highlighted' : '';
    return `
      <div class="trainer-entry${dimClass}${hlClass}">
        <div class="trainer-card-header">
          <div class="trainer-card-name">${highlight(card.name, query)}</div>
        </div>
        <div class="ir-cards-row">
          ${buildIRThumb(card)}
        </div>
      </div>`;
  }

  /* ── Render all generations ── */
  function renderAll() {
    loadingState && loadingState.remove();
    mainContent.innerHTML = '';

    const query = searchQuery;
    const genFilter = currentGen;

    generations.forEach(gen => {
      const genId = String(gen.id);
      if (genFilter !== 'all' && genFilter !== 'trainer' && genFilter !== genId) return;
      if (genFilter === 'trainer') return; // rendered separately

      const pokemonInGen = allPokemon.filter(p => p.generation === gen.id);
      // With rarity filter: only count Pokémon that have a card of that rarity
      const visibleByRarity = currentRarity === 'all'
        ? pokemonInGen
        : pokemonInGen.filter(p => p.cards.some(c => c.rarity === currentRarity));
      const visible = visibleByRarity.filter(p => matchesSearch(p, query));

      // Skip entire section if rarity filter hides all Pokémon
      if (currentRarity !== 'all' && visibleByRarity.length === 0) return;

      const genInfo = GEN_COLORS[gen.id] || { cls: 'gen-1', name: '' };
      const withCardsCount = pokemonInGen.filter(p => p.cards.length > 0).length;
      const matchCount = visible.length;

      const section = document.createElement('details');
      section.className = 'gen-section';
      section.id = `gen-${gen.id}`;
      if (!query || visible.length > 0) section.open = (genFilter !== 'all');

      let visLabel;
      if (currentRarity === 'all') {
        visLabel = query
          ? `${matchCount} Treffer / ${pokemonInGen.length} Pokémon · ${withCardsCount} mit Karten`
          : `${pokemonInGen.length} Pokémon · ${withCardsCount} mit Karten`;
      } else {
        const rarityLabel = RARITY_LABEL[currentRarity] || currentRarity;
        visLabel = query
          ? `${matchCount} Treffer / ${visibleByRarity.length} mit ${rarityLabel}`
          : `${visibleByRarity.length} mit ${rarityLabel}`;
      }

      section.innerHTML = `
        <summary class="gen-summary">
          <div class="gen-summary-left">
            <span class="gen-badge ${genInfo.cls}">${gen.name.split('–')[0].trim()}</span>
            <span class="gen-title">${esc(gen.name)}</span>
            <span class="gen-count">${visLabel}</span>
          </div>
          <svg class="gen-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </summary>
        <div class="gen-body" id="gen-body-${gen.id}"></div>`;

      mainContent.appendChild(section);

      const body = section.querySelector('.gen-body');
      pokemonInGen.forEach(poke => {
        const html = buildPokeEntry(poke, query);
        if (html) body.insertAdjacentHTML('beforeend', html);
      });
    });

    /* Trainer section */
    if (genFilter === 'all' || genFilter === 'trainer') {
      const visTrainersByRarity = currentRarity === 'all'
        ? trainerCards
        : trainerCards.filter(c => c.rarity === currentRarity);
      const visTrainers = visTrainersByRarity.filter(c => matchesTrainer(c, query));

      if (visTrainersByRarity.length > 0 || currentRarity === 'all') {
        const trainerSection = document.createElement('details');
        trainerSection.className = 'gen-section';
        trainerSection.id = 'gen-trainer';
        if (genFilter === 'trainer' || !query) trainerSection.open = (genFilter !== 'all');

        trainerSection.innerHTML = `
          <summary class="gen-summary">
            <div class="gen-summary-left">
              <span class="gen-badge gen-tr">Trainer</span>
              <span class="gen-title">Trainer-Karten</span>
              <span class="gen-count">${query ? `${visTrainers.length} Treffer / ` : ''}${visTrainersByRarity.length} Karten</span>
            </div>
            <svg class="gen-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </summary>
          <div class="gen-body" id="gen-body-trainer"></div>`;

        mainContent.appendChild(trainerSection);

        const tbody = trainerSection.querySelector('.gen-body');
        visTrainersByRarity.forEach(card => {
          tbody.insertAdjacentHTML('beforeend', buildTrainerEntry(card, query));
        });
      }
    }

    if (mainContent.children.length === 0) {
      mainContent.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <h2>Keine Ergebnisse</h2>
          <p>Keine Karten gefunden${query ? ` für "<strong>${esc(query)}</strong>"` : ''}.</p>
        </div>`;
    }

    /* Attach click handlers to all IR thumbs */
    attachCardClicks();

    /* When searching: hide entire sections with no matches, open those with matches */
    if (query) {
      mainContent.querySelectorAll('details.gen-section').forEach(d => {
        const hasMatch = d.querySelector('.poke-entry.highlighted, .trainer-entry.highlighted');
        if (hasMatch) {
          d.open = true;
          d.classList.remove('hidden');
        } else {
          d.classList.add('hidden');
        }
      });
    } else {
      mainContent.querySelectorAll('details.gen-section').forEach(d => {
        d.classList.remove('hidden');
      });
    }
  }

  /* ── Attach click events to IR thumbnails ── */
  function attachCardClicks() {
    mainContent.querySelectorAll('.ir-thumb').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const cardId = el.dataset.cardId;
        // Find card in data
        let card = null;
        for (const p of allPokemon) {
          card = p.cards.find(c => c.id === cardId);
          if (card) break;
        }
        if (!card) card = trainerCards.find(c => c.id === cardId);
        if (card) openModal(card);
      });
    });
  }

  /* ── Modal ── */
  function openModal(card) {
    modalCard = card;

    // Find Pokémon name
    let pokeName = '';
    for (const p of allPokemon) {
      if (p.cards.some(c => c.id === card.id)) {
        pokeName = `${p.name_de} / ${p.name_en}`;
        break;
      }
    }

    modalInner.innerHTML = `
      <img class="modal-card-img"
           src="${esc(card.img_hires || card.img)}"
           alt="${esc(card.name)}"
           onerror="this.onerror=null;this.src='images/placeholder.svg'">

      <h2 class="modal-title">${esc(card.name)} <span class="modal-rarity-tag ${RARITY_CLASS[card.rarity]||'badge-ir'}">${card.rarity||'IR'}</span></h2>

      <div class="modal-details">
        ${pokeName ? `
        <div class="modal-row">
          <div class="modal-row-icon" style="color:var(--accent)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15 15 0 0 0 0 20M12 2a15 15 0 0 1 0 20"/>
            </svg>
          </div>
          <div class="modal-row-content">
            <div class="modal-row-label">Pokémon</div>
            <div class="modal-row-value">${esc(pokeName)}</div>
          </div>
        </div>` : ''}

        <div class="modal-row">
          <div class="modal-row-icon" style="color:var(--blue)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
          </div>
          <div class="modal-row-content">
            <div class="modal-row-label">Karten-Nr.</div>
            <div class="modal-row-value">${esc(card.number)}</div>
          </div>
        </div>

        <div class="modal-row">
          <div class="modal-row-icon" style="color:var(--green)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div class="modal-row-content">
            <div class="modal-row-label">Set</div>
            <div class="modal-row-value">${esc(card.set_de)}</div>
            <div class="modal-row-sub">${esc(card.set_en)}</div>
          </div>
        </div>
      </div>

      <div class="modal-pack-highlight">
        <div class="pack-label">Zu finden in</div>
        <div class="pack-name">${esc(card.pack)}</div>
      </div>
    `;

    modalOverlay.setAttribute('aria-hidden', 'false');
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.setAttribute('aria-hidden', 'true');
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
    modalCard = null;
  }

  /* ── Event listeners ── */

  // Search
  let searchTimer;
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.classList.toggle('visible', searchQuery.length > 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderAll, 200);
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    searchInput.focus();
    renderAll();
  });

  // Generation filter
  document.querySelectorAll('.gen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gen-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGen = btn.dataset.gen;
      renderAll();
    });
  });

  // Rarity filter
  document.querySelectorAll('.rarity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rarity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRarity = btn.dataset.rarity;
      renderAll();
    });
  });

  // Modal close
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modalCard) closeModal();
  });

  // Keyboard search shortcut
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  /* ── Start ── */
  loadData();

})();
