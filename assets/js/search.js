/* ================================================================
   Lapsum Criativo — Search Engine
   Dependências: lunr.js (carregado antes deste script)
   Arquivo search.json deve estar na raiz do site
   ================================================================ */

(function () {
  "use strict";

  const SEARCH_JSON = "/search.json";
  const HIGHLIGHT_RE = (words) =>
    new RegExp(
      `(${words
        .filter((w) => w.length > 1)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})`,
      "gi"
    );

  let products = [];
  let lunrIndex = null;
  let activeFilter = "all";
  let indexReady = false;
  let pendingQuery = null;

  /* ── DOM refs ── */
  const overlay    = document.getElementById("searchOverlay");
  const trigger    = document.getElementById("searchTrigger");
  const input      = document.getElementById("searchInput");
  const clearBtn   = document.getElementById("searchClear");
  const closeBtn   = document.getElementById("searchClose");
  const filtersEl  = document.getElementById("searchFilters");
  const resultsEl  = document.getElementById("searchResults");
  const initialEl  = document.getElementById("searchInitial");
  const noResEl    = document.getElementById("searchNoResults");
  const loadingEl  = document.getElementById("searchLoading");
  const totalEl    = document.getElementById("searchTotal");
  const queryEl    = document.getElementById("searchQuery");

  if (!overlay) return; // include não presente nesta página

  /* ── Carregar dados ── */
  function loadIndex() {
    if (indexReady || loadingEl.style.display !== "none") return;

    showState("loading");

    fetch(SEARCH_JSON)
      .then((r) => r.json())
      .then((data) => {
        products = data;
        if (totalEl) totalEl.textContent = products.length;

        // Montar filtros dinâmicos de categoria
        const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
        cats.forEach((cat) => addFilterBtn(cat));
        addFilterBtn("Grátis");

        // Construir índice Lunr
        lunrIndex = lunr(function () {
          this.ref("id");
          this.field("title",       { boost: 10 });
          this.field("category",    { boost: 5  });
          this.field("description", { boost: 2  });
          this.field("tags",        { boost: 3  });
          products.forEach((p) => {
            this.add({
              id:          p.id,
              title:       p.title       || "",
              category:    p.category    || "",
              description: p.description || "",
              tags:        Array.isArray(p.tags) ? p.tags.join(" ") : (p.tags || ""),
            });
          });
        });

        indexReady = true;
        showState("initial");

        // Se havia busca aguardando
        if (pendingQuery) {
          input.value = pendingQuery;
          pendingQuery = null;
          handleSearch();
        }
      })
      .catch(() => {
        showState("initial");
      });
  }

  /* ── Filtros ── */
  function addFilterBtn(label) {
    const btn = document.createElement("button");
    btn.className = "search-filter-btn";
    btn.textContent = label;
    btn.dataset.filter = label.toLowerCase();
    btn.addEventListener("click", () => {
      document.querySelectorAll(".search-filter-btn").forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      handleSearch();
    });
    filtersEl.appendChild(btn);
  }

  /* ── Busca ── */
  function handleSearch() {
    const q = input.value.trim();
    clearBtn.style.display = q ? "inline-flex" : "none";

    if (!indexReady) {
      pendingQuery = q;
      return;
    }

    if (!q) {
      showState("initial");
      resultsEl.style.display = "none";
      return;
    }

    let matched;
    try {
      const terms = q.trim().split(/\s+/).filter(Boolean);
      const lunrHits = lunrIndex.query(function (query) {
        terms.forEach(function (term) {
          query.term(term, { wildcard: lunr.Query.wildcard.TRAILING, boost: 10 });
          if (term.length > 3) {
            query.term(term, { editDistance: 1, boost: 3 });
          }
        });
      });
      const lunrIds = new Set(lunrHits.map((h) => Number(h.ref)));

      const lower = q.toLowerCase();
      const searchFields = (p) =>
        [p.title, p.category, p.description, ...(Array.isArray(p.tags) ? p.tags : [])]
          .join(" ").toLowerCase();
      const subIds = new Set(
        products.filter((p) => searchFields(p).includes(lower)).map((p) => p.id)
      );

      const allIds = new Set([...lunrIds, ...subIds]);
      matched = products.filter((p) => allIds.has(p.id));
      matched.sort((a, b) => (lunrIds.has(a.id) ? 0 : 1) - (lunrIds.has(b.id) ? 0 : 1));
    } catch (_) {
      const lower = q.toLowerCase();
      matched = products.filter(
        (p) =>
          (p.title       || "").toLowerCase().includes(lower) ||
          (p.category    || "").toLowerCase().includes(lower) ||
          (p.description || "").toLowerCase().includes(lower)
      );
    }

    // Aplicar filtro de categoria
    if (activeFilter && activeFilter !== "all") {
      matched = matched.filter((p) => {
        if (activeFilter === "grátis") return p.free;
        return (p.category || "").toLowerCase() === activeFilter;
      });
    }

    renderResults(matched, q);
  }

  /* ── Renderização ── */
  function highlight(text, words) {
    if (!words.length) return text;
    try {
      return text.replace(HIGHLIGHT_RE(words), "<mark>$1</mark>");
    } catch (_) {
      return text;
    }
  }

  function renderResults(list, q) {
    const words = q.trim().split(/\s+/).filter((w) => w.length > 1);
    initialEl.style.display = "none";
    loadingEl.style.display = "none";

    if (list.length === 0) {
      resultsEl.style.display = "none";
      noResEl.style.display   = "block";
      if (queryEl) queryEl.textContent = q;
      return;
    }

    noResEl.style.display   = "none";
    resultsEl.style.display = "grid";

    const lang = document.documentElement.lang || "pt";

    resultsEl.innerHTML = list
      .map((p) => {
        const price = lang === "pt" ? (p["price-br"] || "") : (p["price-us"] || "");

        const bannerHtml = p.banner
          ? `<div class="card-image">
               <figure class="image is-16by9">
                 <img src="${p.banner}" alt="${p.title}" loading="lazy" style="max-width:100%;height:auto;">
               </figure>
             </div>`
          : "";

        const starsHtml = p.rating
          ? `<span class="search-result-stars">${"★".repeat(Math.round(p.rating))}${"☆".repeat(5 - Math.round(p.rating))}</span>`
          : "";

        return `
          <a href="${p.url}" class="category-product search-result-card">
            <div class="card">
              ${bannerHtml}
              <div class="card-content">
                <p class="title is-5">${highlight(p.title || "", words)}</p>
                <div class="is-flex is-align-items-center is-justify-content-space-between">
                  <div class="is-flex-grow-1">${starsHtml}</div>
                  <div class="is-flex-grow-1">
                    <p class="title is-6 has-text-right mb-0" style="color:#C8102E">${price}</p>
                  </div>
                </div>
              </div>
            </div>
          </a>
        `;
      })
      .join("");
  }

  /* ── Estados da UI ── */
  function showState(state) {
    initialEl.style.display  = state === "initial"  ? "block" : "none";
    loadingEl.style.display  = state === "loading"  ? "block" : "none";
    noResEl.style.display    = state === "no-res"   ? "block" : "none";
    resultsEl.style.display  = state === "results"  ? "grid"  : "none";
  }

  /* ── Abrir / Fechar ── */
  function openSearch() {
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    input.focus();
    loadIndex();
  }

  function closeSearch() {
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    input.value = "";
    clearBtn.style.display = "none";
    showState("initial");
    resultsEl.style.display = "none";
    activeFilter = "all";
    document.querySelectorAll(".search-filter-btn").forEach((b, i) => {
      b.classList.toggle("active", i === 0);
    });
  }

  /* ── Event listeners ── */
  if (trigger) {
    trigger.addEventListener("click", openSearch);
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openSearch();
    });
  }

  closeBtn.addEventListener("click", closeSearch);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeSearch();
  });

  input.addEventListener("input", handleSearch);

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.style.display = "none";
    showState("initial");
    resultsEl.style.display = "none";
    input.focus();
  });

  // Atalho de teclado: "/" para abrir, Escape para fechar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) {
      closeSearch();
      return;
    }
    if (
      e.key === "/" &&
      !overlay.classList.contains("is-open") &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      e.preventDefault();
      openSearch();
    }
  });

  // Fechar com swipe down no mobile
  let touchStartY = 0;
  overlay.addEventListener("touchstart", (e) => {
    touchStartY = e.touches[0].clientY;
  });
  overlay.addEventListener("touchend", (e) => {
    if (e.changedTouches[0].clientY - touchStartY > 80) closeSearch();
  });
})();
