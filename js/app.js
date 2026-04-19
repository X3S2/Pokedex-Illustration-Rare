/* Pokémon Illustration Rare Finder – App JS */

(function () {
  'use strict';

  /* ── State ── */
  let allPokemon = [];
  let trainerCards = [];
  let generations = [];
  let currentGen = 'all';
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
  const PLACEHOLDER_SVG = `
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="140" rx="8" fill="#1e2330"/>
      <rect x="4" y="4" width="92" height="132" rx="6" fill="none" stroke="#2e3448" stroke-width="1.5"/>
      <circle cx="50" cy="60" r="22" fill="none" stroke="#2e3448" stroke-width="2"/>
      <path d="M28 60h44M50 38v14M50 68v14" stroke="#2e3448" stroke-width="2"/>
      <circle cx="50" cy="60" r="8" fill="#2e3448"/>
      <circle cx="50" cy="60" r="4" fill="#1e2330"/>
      <text x="50" y="115" text-anchor="middle" fill="#555d75" font-size="9" font-family="system-ui">Kein IR</text>
    </svg>`;

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
    const totalCards = allPokemon.reduce((s, p) => s + p.cards.length, 0) + trainerCards.length;
    const withIR = allPokemon.filter(p => p.cards.length > 0).length;
    statsText.innerHTML = `
      <strong>${totalCards.toLocaleString('de')}</strong> Illustration Rare Karten ·
      <strong>${withIR.toLocaleString('de')}</strong> von ${allPokemon.length.toLocaleString('de')} Pokémon haben IRs ·
      <strong>${trainerCards.length}</strong> Trainer-Karten
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

  /* ── Build IR thumbnail HTML ── */
  function buildIRThumb(card, size = '') {
    const imgSize = size === 'small' ? 60 : 70;
    return `
      <div class="ir-thumb" data-card-id="${esc(card.id)}"
           title="${esc(card.name)} · ${esc(card.set_de)}">
        <img src="${esc(card.img)}"
             alt="${esc(card.name)}"
             loading="lazy"
             width="${imgSize}"
             onerror="this.onerror=null;this.src='images/placeholder.svg'">
        <span class="ir-set-badge">${esc(card.set_de)}</span>
      </div>`;
  }

  /* ── Build placeholder HTML ── */
  function buildPlaceholder() {
    return `
      <div class="ir-placeholder" title="Kein Illustration Rare verfügbar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M3 9h18M9 21V9"/>
          <circle cx="16" cy="16" r="2" stroke-dasharray="3 2"/>
        </svg>
        <span>Kein IR verfügbar</span>
      </div>`;
  }

  /* ── Build single Pokémon entry HTML ── */
  function buildPokeEntry(poke, query) {
    const isMatch = matchesSearch(poke, query);
    const hasCards = poke.cards.length > 0;
    const dimClass = query && !isMatch ? ' dimmed' : '';
    const hlClass  = query && isMatch ? ' highlighted' : '';

    const cardsHtml = hasCards
      ? poke.cards.map(c => buildIRThumb(c)).join('')
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
    const dimClass = query && !isMatch ? ' dimmed' : '';
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
      const visible = pokemonInGen.filter(p => matchesSearch(p, query));

      const genInfo = GEN_COLORS[gen.id] || { cls: 'gen-1', name: '' };
      const withIRCount = pokemonInGen.filter(p => p.cards.length > 0).length;
      const matchCount = visible.length;

      const section = document.createElement('details');
      section.className = 'gen-section';
      section.id = `gen-${gen.id}`;
      if (!query || visible.length > 0) section.open = (genFilter !== 'all');

      const visLabel = query
        ? `${matchCount} Treffer / ${pokemonInGen.length} Pokémon · ${withIRCount} mit IR`
        : `${pokemonInGen.length} Pokémon · ${withIRCount} mit IR`;

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
        body.insertAdjacentHTML('beforeend', buildPokeEntry(poke, query));
      });
    });

    /* Trainer section */
    if (genFilter === 'all' || genFilter === 'trainer') {
      const visTrainers = trainerCards.filter(c => matchesTrainer(c, query));
      const trainerSection = document.createElement('details');
      trainerSection.className = 'gen-section';
      trainerSection.id = 'gen-trainer';
      if (genFilter === 'trainer' || !query) trainerSection.open = (genFilter !== 'all');

      trainerSection.innerHTML = `
        <summary class="gen-summary">
          <div class="gen-summary-left">
            <span class="gen-badge gen-tr">Trainer</span>
            <span class="gen-title">Trainer-Karten</span>
            <span class="gen-count">${query ? `${visTrainers.length} Treffer / ` : ''}${trainerCards.length} Karten</span>
          </div>
          <svg class="gen-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </summary>
        <div class="gen-body" id="gen-body-trainer"></div>`;

      mainContent.appendChild(trainerSection);

      const tbody = trainerSection.querySelector('.gen-body');
      trainerCards.forEach(card => {
        tbody.insertAdjacentHTML('beforeend', buildTrainerEntry(card, query));
      });
    }

    if (mainContent.children.length === 0) {
      mainContent.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <h2>Keine Ergebnisse</h2>
          <p>Für "<strong>${esc(query)}</strong>" wurden keine Pokémon gefunden.</p>
        </div>`;
    }

    /* Attach click handlers to all IR thumbs */
    attachCardClicks();

    /* Auto-open first section if searching */
    if (query) {
      mainContent.querySelectorAll('details.gen-section').forEach(d => {
        const hasMatch = d.querySelector('.poke-entry.highlighted, .trainer-entry.highlighted');
        d.open = !!hasMatch;
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

    const deckshopSearch = `https://www.deckshop.de/search?q=${encodeURIComponent(card.name)}`;

    modalInner.innerHTML = `
      <img class="modal-card-img"
           src="${esc(card.img_hires || card.img)}"
           alt="${esc(card.name)}"
           onerror="this.src='${esc(card.img)}'">

      <h2 class="modal-title">${esc(card.name)}</h2>

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

      <a href="${esc(deckshopSearch)}" target="_blank" rel="noopener noreferrer"
         class="modal-btn modal-btn-primary">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        Auf deckshop.de kaufen
      </a>
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
