
(function () {
  "use strict";

  // ---------------------------
  // i18n CONFIG (JSON files)
  // ---------------------------
  const I18N_STORAGE_KEY = "lang";
  const DEFAULT_LANG = "en";
  const I18N_BASE = "/assets/i18n"; // e.g. /assets/i18n/en.json, /assets/i18n/pl.json, /assets/i18n/pt.json
  const I18N_CACHE_VERSION = "v1";  // bump this to invalidate localStorage cache
  const BOUND_MARKER = "1";
  const BODY_SCROLL_LOCK_CLASS = "nav-lock";
  const PORTAL_Z_INDEX = 99999;
  const GEO_DONE_KEY = "geo_done";
  const COUNTRY_STORAGE_KEY = "user_country";

  // in-memory cache: dict.en, dict.pl, dict.pt, ...
  const dict = Object.create(null);

  // ---------------------------
  // Helper utilities
  // ---------------------------
  function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem failed for key "${key}":`, e);
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn(`localStorage.setItem failed for key "${key}":`, e);
      return false;
    }
  }

  function getLang() {
    const v = safeLocalStorageGet(I18N_STORAGE_KEY);
    return v || DEFAULT_LANG;
  }

  function normalizeLang(lang) {
    if (!lang) return DEFAULT_LANG;
    // accept "en-US", "pl-PL", "pt-PT", "pt-BR" etc
    lang = String(lang).toLowerCase();
    if (lang.startsWith("pl")) return "pl";
    if (lang.startsWith("pt")) return "pt";
    if (lang.startsWith("en")) return "en";
    return DEFAULT_LANG;
  }

  function countryToLang(cc) {
    cc = String(cc || "").toUpperCase();

    // Country to language mapping
    if (cc === "PL") return "pl";  // Poland -> Polish
    if (cc === "PT") return "pt";  // Portugal -> Portuguese
    if (cc === "BR") return "pt";  // Brazil -> Portuguese
    if (cc === "AO") return "pt";  // Angola -> Portuguese
    if (cc === "MZ") return "pt";  // Mozambique -> Portuguese

    // Default to English
    return "en";
  }

  async function detectLangOnce() {
    // if user already set language manually, don't touch it
    const existing = safeLocalStorageGet(I18N_STORAGE_KEY);
    if (existing) return normalizeLang(existing);

    // avoid calling /geo multiple times in same browser
    const done = safeLocalStorageGet(GEO_DONE_KEY);
    const saved = safeLocalStorageGet(I18N_STORAGE_KEY);
    if (done === BOUND_MARKER && saved) return normalizeLang(saved);

    let cc = "";
    try {
      const res = await fetch("/geo", { cache: "force-cache" });
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const j = await res.json();
        cc = (j && (j.country || j.cc || j.CF_IPCountry)) || "";
      }
    } catch (e) {
      console.warn("Failed to fetch geo location:", e);
    }

    const lang = normalizeLang(countryToLang(cc || ""));
    safeLocalStorageSet(I18N_STORAGE_KEY, lang);
    safeLocalStorageSet(GEO_DONE_KEY, BOUND_MARKER);

    // Save country for sports ordering
    if (cc) {
      safeLocalStorageSet(COUNTRY_STORAGE_KEY, cc);
    }

    return lang;
  }



  async function loadLangFile(lang) {
    lang = normalizeLang(lang);
    if (dict[lang]) return dict[lang];

    const lsKey = `i18n:${lang}:${I18N_CACHE_VERSION}`;

    // localStorage cache (optional)
    const cached = safeLocalStorageGet(lsKey);
    if (cached) {
      try {
        dict[lang] = JSON.parse(cached);
        return dict[lang];
      } catch (e) {
        console.warn(`Failed to parse cached i18n data for ${lang}:`, e);
      }
    }

    const url = `${I18N_BASE}/${lang}.json`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`i18n load failed: ${lang} (${res.status})`);
    const json = await res.json();

    dict[lang] = json;
    safeLocalStorageSet(lsKey, JSON.stringify(json));

    return json;
  }

  function t(lang, key) {
    lang = normalizeLang(lang);
    const d = dict[lang];
    if (d && d[key] != null) return String(d[key]);

    const en = dict.en;
    if (en && en[key] != null) return String(en[key]);

    return "";
  }

  // Helper to apply translation to elements with a data attribute
  function applyI18nToAttribute(lang, dataAttr, targetAttr, targetProp) {
    const selector = `[${dataAttr}]`;
    document.querySelectorAll(selector).forEach((el) => {
      const key = el.getAttribute(dataAttr);
      const val = t(lang, key);
      if (val) {
        if (targetProp) {
          el[targetProp] = val;
        } else {
          el.setAttribute(targetAttr, val);
        }
      }
    });
  }

  function updateDocumentLang(lang) {
    const locale = lang === "pl" ? "pl-PL" : "en-US";
    document.documentElement.setAttribute("lang", locale);
  }

  function updateDocumentTitle(lang) {
    const titleKeyEl = document.querySelector("title[data-i18n]");
    if (titleKeyEl) {
      const key = titleKeyEl.getAttribute("data-i18n");
      const val = t(lang, key);
      if (val) document.title = val;
    }
  }

  function dispatchLangChange(lang) {
    document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }

  function applyI18n(lang) {
    lang = normalizeLang(lang);

    updateDocumentLang(lang);
    applyI18nToAttribute(lang, "data-i18n-title", "title");
    applyI18nToAttribute(lang, "data-i18n", null, "textContent");
    applyI18nToAttribute(lang, "data-i18n-aria", "aria-label");
    applyI18nToAttribute(lang, "data-i18n-placeholder", "placeholder");
    applyI18nToAttribute(lang, "data-i18n-meta", "content");
    updateDocumentTitle(lang);
    dispatchLangChange(lang);
  }

  async function setLang(lang) {
    lang = normalizeLang(lang);
    safeLocalStorageSet(I18N_STORAGE_KEY, lang);

    // Set cookie for server-side rendering (SEO meta tags)
    document.cookie = `lang=${lang};path=/;max-age=31536000;SameSite=Lax`;

    // Update country based on manually selected language
    // This ensures sports order matches the selected language
    const langToCountry = {
      pl: "PL",  // Polish → Poland sports order
      pt: "PT",  // Portuguese → Portugal sports order
      en: ""     // English → default order
    };
    const countryForLang = langToCountry[lang] || "";
    if (countryForLang) {
      safeLocalStorageSet(COUNTRY_STORAGE_KEY, countryForLang);
    }

    // Ensure EN is always available for fallback
    try {
      await loadLangFile("en");
    } catch (e) {
      console.warn("Failed to load EN fallback:", e);
    }

    // Load selected language
    try {
      await loadLangFile(lang);
    } catch (e) {
      console.warn("Failed to load language file:", e);
      lang = "en";
    }
    safeLocalStorageSet(GEO_DONE_KEY, BOUND_MARKER);

    applyI18n(lang);

    // Update meta tags client-side for immediate feedback
    updateMetaTags(lang);
  }

  // Update meta tags when language changes
  function updateMetaTags(lang) {
    const translations = dict[lang] || dict["en"] || {};
    const title = translations["meta.title"] || document.title;
    const description = translations["meta.description"] || "";
    const keywords = translations["meta.keywords"] || "";

    // Update title
    document.title = title;

    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);

    // Update meta keywords
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords && keywords) metaKeywords.setAttribute("content", keywords);

    // Update OG tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", description);

    // Update Twitter tags
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", title);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute("content", description);

    // Update html lang attribute
    document.documentElement.lang = lang;
  }

  // ---------------------------
  // Expose a tiny public i18n API for other scripts
  // Usage from anywhere: window.i18n.t("day.today")
  // ---------------------------
  window.i18n = window.i18n || {};

  // Current normalized language ("en" / "pl")
  window.i18n.getLang = function () {
    return normalizeLang(getLang());
  };

  // Translate a key in the current language with EN fallback.
  // If missing, returns `fallback` (or the key if fallback is not provided).
  window.i18n.t = function (key, fallback) {
    const lang = normalizeLang(getLang());
    const val = t(lang, key);
    if (val) return val;
    if (fallback != null) return String(fallback);
    return String(key || "");
  };

  // Translate calendar day labels (yesterday/today/tomorrow) and format other dates.
  // Intended for your calendar/day-nav script.
  window.i18n.dayLabel = function (dayOffset, dateObj) {
    const lang = normalizeLang(getLang());

    if (dayOffset === -1) return t(lang, "day.yesterday") || "Yesterday";
    if (dayOffset === 0)  return t(lang, "day.today") || "Today";
    if (dayOffset === 1)  return t(lang, "day.tomorrow") || "Tomorrow";

    // For other offsets, show a localized date string.
    try {
      const locale = lang === "pl" ? "pl-PL" : "en-US";
      return (dateObj instanceof Date ? dateObj : new Date(dateObj)).toLocaleDateString(locale, {
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      try {
        return (dateObj instanceof Date ? dateObj : new Date(dateObj)).toLocaleDateString();
      } catch (e2) {
        return "";
      }
    }
  };

  // Allow changing language from other scripts if needed
  window.i18n.setLang = function (lang) {
    return setLang(lang);
  };

  // ---------------------------
  // Language modal
  // ---------------------------
  function setupLangModal() {
    const modal = document.getElementById("langModal");
    const closeBtn = document.getElementById("langModalClose");
    const dialog = modal ? modal.querySelector('[role="dialog"]') : null;

    // Prefer stable selector:
    const openBtn =
      document.querySelector('button[data-i18n-aria="nav.lang"]') ||
      document.querySelector('button[aria-label="Select a language"]');

    if (!openBtn || !modal || !closeBtn || !dialog) return;

    if (openBtn.dataset.langModalBound === BOUND_MARKER) return;
    openBtn.dataset.langModalBound = BOUND_MARKER;

    function open() {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      openBtn.setAttribute("aria-expanded", "true");
      try { dialog.focus(); } catch (e) {}
    }

    function close() {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
      openBtn.setAttribute("aria-expanded", "false");
      try { openBtn.focus(); } catch (e) {}
    }

    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });

    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) close();
    });

    modal.querySelectorAll("[data-lang]").forEach((card) => {
      const pick = async () => {
        await setLang(card.getAttribute("data-lang"));
        close();
      };
      card.addEventListener("click", pick);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      });
    });
  }

  // ---------------------------
  // Status filter labels (All / Live / Finished / Upcoming) i18n
  // ---------------------------
  function setupStatusFiltersI18n() {
    const allBtn  = document.getElementById("filterAll");
    const liveBtn = document.getElementById("filterLive");
    const finBtn  = document.getElementById("filterFinished");
    const upBtn   = document.getElementById("filterUpcoming");

    if (!allBtn && !liveBtn && !finBtn && !upBtn) return;

    function setBtnLabel(btn, key, fallback) {
      if (!btn) return;

      const lang = normalizeLang(getLang());
      const label = t(lang, key) || fallback;

      // Find the existing label span (with data-i18n attribute)
      const labelSpan = btn.querySelector('span[data-i18n]');
      if (labelSpan) {
        // Just update the text, preserving all classes (including responsive ones)
        labelSpan.textContent = label;
      }
    }

    function apply() {
      setBtnLabel(allBtn,  "filter.all", "All");
      setBtnLabel(liveBtn, "filter.live", "Live");
      setBtnLabel(finBtn,  "filter.finished", "Finished");
      setBtnLabel(upBtn,   "filter.upcoming", "Upcoming");

      // Optional: also translate the match search placeholder if you add the key
      const search = document.getElementById("matchSearch");
      if (search) {
        const lang = normalizeLang(getLang());
        const ph = t(lang, "matches.search.placeholder");
        if (ph) search.setAttribute("placeholder", ph);
      }
    }

    // Run now + on every language change
    apply();
    document.addEventListener("langchange", apply);
  }

  // ---------------------------
  // Theme toggle
  // ---------------------------
  function setupTheme() {
    const storageKey = "theme";
    const root = document.documentElement;

    const moonSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" color="currentColor" fill="none" class="h-5 w-5">
        <path d="M21.5 14.0784C20.3003 14.7189 18.9301 15.0821 17.4751 15.0821C12.7491 15.0821 8.91792 11.2509 8.91792 6.52485C8.91792 5.06986 9.28105 3.69968 9.92163 2.5C5.66765 3.49698 2.5 7.31513 2.5 11.8731C2.5 17.1899 6.8101 21.5 12.1269 21.5C16.6849 21.5 20.503 18.3324 21.5 14.0784Z"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>`;

    const sunSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" color="currentColor" fill="none" class="h-5 w-5">
        <path d="M17 12C17 14.7614 14.7614 17 12 17C9.23858 17 7 14.7614 7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12Z"
          stroke="currentColor" stroke-width="1.5"></path>
        <path d="M11.9955 3H12.0045M11.9961 21H12.0051M18.3588 5.63599H18.3678M5.63409 18.364H5.64307M5.63409 5.63647H5.64307M18.3582 18.3645H18.3672M20.991 12.0006H21M3 12.0006H3.00898"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>`;

    function getTheme() {
      const v = safeLocalStorageGet(storageKey);
      if (v === "light" || v === "dark") return v;
      return "dark";
    }

    function setTheme(btn, theme) {
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      root.style.colorScheme = theme;
      btn.innerHTML = theme === "dark" ? sunSvg : moonSvg;
      safeLocalStorageSet(storageKey, theme);
    }

    function attach() {
      const btn = document.querySelector('button[aria-label="Toggle theme"]');
      if (!btn) return false;

      if (btn.dataset.themeBound === BOUND_MARKER) return true;
      btn.dataset.themeBound = BOUND_MARKER;

      setTheme(btn, getTheme());

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const next = root.classList.contains("dark") ? "light" : "dark";
        setTheme(btn, next);
      });

      return true;
    }

    if (attach()) return;

    const obs = new MutationObserver(() => {
      if (attach()) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ---------------------------
  // NAV config (sports) - All sports enabled with /sports/ prefix
  // ---------------------------
  const SPORTS = [
    { id: "all",               sportId: 0,  key: "sport.all",        href: "/",                      enabled: true  },
    { id: "football",          sportId: 1,  key: "sport.football",   href: "/sports/football",       enabled: true  },
    { id: "tv",                sportId: 99, key: "sport.tv",        href: "/tv",                    enabled: true  },
    { id: "cricket",           sportId: 13, key: "sport.cricket",    href: "/sports/cricket",        enabled: true  },
    { id: "basketball",        sportId: 3,  key: "sport.basketball", href: "/sports/basketball",     enabled: true  },
    { id: "tennis",            sportId: 2,  key: "sport.tennis",     href: "/sports/tennis",         enabled: true  },
    { id: "hockey",            sportId: 4,  key: "sport.hockey",     href: "/sports/hockey",         enabled: true  },
    { id: "motorsport",        sportId: 31, key: "sport.motorsport", href: "/sports/motorsport",     enabled: true  },
    { id: "american-football", sportId: 5,  key: "sport.nfl",        href: "/sports/nfl",            enabled: true  },
    { id: "volleyball",        sportId: 12, key: "sport.volleyball", href: "/sports/volleyball",     enabled: true  },
    { id: "futsal",            sportId: 11, key: "sport.futsal",     href: "/sports/futsal",         enabled: true  },
    { id: "handball",          sportId: 7,  key: "sport.handball",   href: "/sports/handball",       enabled: true  },
    { id: "mma",               sportId: 28, key: "sport.mma",        href: "/sports/mma",            enabled: true  },
    { id: "boxing",            sportId: 16, key: "sport.boxing",     href: "/sports/boxing",         enabled: true  },
    { id: "winter-sports",     sportId: 37, key: "sport.winter",     href: "/sports/winter-sports",  enabled: true  },
    { id: "snooker",           sportId: 15, key: "sport.snooker",    href: "/sports/snooker",        enabled: true  },
    { id: "darts",             sportId: 14, key: "sport.darts",      href: "/sports/darts",          enabled: true  },
    { id: "cycling",           sportId: 34, key: "sport.cycling",    href: "/sports/cycling",        enabled: true  },
    { id: "golf",              sportId: 23, key: "sport.golf",       href: "/sports/golf",           enabled: true  },
    { id: "waterpolo",         sportId: 0,  key: "sport.waterpolo",  href: "/sports/waterpolo",      enabled: true  }
  ];

  // ---------------------------
  // Country-specific sports ordering
  // ---------------------------
  function getCountrySpecificSports(country) {
    const cc = String(country || "").toUpperCase();

    // Create a copy of SPORTS to avoid mutating the original
    const sportsCopy = SPORTS.map(s => ({ ...s }));

    // Country-specific priority adjustments
    const countryPriorities = {
      // Portugal: Boost Futsal (world champions)
      PT: {
        futsal: 2,        // Move futsal up (after football, volleyball)
        basketball: 3,
        volleyball: 1
      },
      // Poland: Boost Volleyball and Winter Sports
      PL: {
        volleyball: 1,     // Poland is volleyball powerhouse
        "winter-sports": 5, // Ski jumping is huge
        basketball: 2,
        handball: 4
      },
      // Brazil: Same as Portugal but even more futsal-focused
      BR: {
        futsal: 1,
        volleyball: 2,
        basketball: 3
      }
    };

    const priorities = countryPriorities[cc];
    if (!priorities) return sportsCopy;

    // Apply priority boosting by moving sports
    const reordered = [];
    const remaining = [...sportsCopy];

    // Always keep top pinned: 'all', 'football', 'tv', 'cricket', 'basketball'
    ['all', 'football', 'tv', 'cricket', 'basketball'].forEach(topId => {
      const idx = remaining.findIndex(s => s.id === topId);
      if (idx !== -1) {
        reordered.push(remaining.splice(idx, 1)[0]);
      }
    });

    // Sort remaining sports by priority
    const sortedByPriority = Object.entries(priorities)
      .sort(([, a], [, b]) => a - b)
      .map(([sportId]) => sportId);

    sortedByPriority.forEach(sportId => {
      const idx = remaining.findIndex(s => s.id === sportId);
      if (idx !== -1) {
        reordered.push(remaining.splice(idx, 1)[0]);
      }
    });

    // Add remaining sports
    reordered.push(...remaining);

    return reordered;
  }

  // Helper to get user's country
  function getUserCountry() {
    return safeLocalStorageGet(COUNTRY_STORAGE_KEY) || "";
  }

  // Expose SPORTS config globally for use in other scripts
  window.SPORTS_CONFIG = SPORTS;
  window.getCountrySpecificSports = getCountrySpecificSports;
  window.getUserCountry = getUserCountry;
  window.getActiveSport = getActiveSport;


  function iconUse(id, extraClass) {
    if (id === 'all') {
      return (
        `<svg class="h-5 w-5 shrink-0 text-amber-400 ${extraClass || ""}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">` +
        `<path d="M12 23c-4.97 0-9-4.03-9-9 0-4.04 2.87-7.46 6.74-8.66.42-.13.84.18.84.62 0 .28-.16.53-.41.65C8.82 7.23 8 8.65 8 10.2c0 2.21 1.79 4 4 4s4-1.79 4-4c0-.76-.23-1.48-.63-2.08-.22-.33-.14-.77.17-1 1.95 1.45 3.26 3.73 3.44 6.32.03.38-.26.7-.64.72-.03 0-.05 0-.08 0-1.89-.13-3.6 1.05-3.9 2.91-.07.41-.42.72-.84.73-.02 0-.04 0-.06 0z"/>` +
        `<path d="M13.5 2.21c-.34-.41-.95-.46-1.35-.11-.12.1-.21.23-.27.38C10.59 5.86 12.3 8.36 12 11c-.13-1.07-.63-2.02-1.42-2.73-.39-.35-1-.31-1.35.08-.15.17-.23.39-.23.62 0 3.87 3.13 7 7 7 1.04 0 2.02-.23 2.91-.64.44-.2.66-.7.51-1.16-.14-.42-.55-.7-1-.67-2.12.15-4.01-1.34-4.27-3.46-.22-1.79.84-3.48 2.55-4.07.45-.16.71-.63.6-1.09-.1-.39-.43-.68-.83-.71-.97-.08-1.92-.37-2.76-.87-.33-.2-.51-.57-.46-.96.05-.38.31-.69.69-.76.73-.13 1.48-.1 2.2.09.46.12.93-.15 1.05-.61.12-.46-.15-.93-.61-1.05-1.12-.29-2.28-.35-3.43-.16z"/>` +
        `</svg>`
      );
    }
    return (
      `<svg class="h-5 w-5 shrink-0 ${extraClass || ""}" aria-hidden="true">` +
      `<use href="/assets/sport.svg#${id}"></use>` +
      `</svg>`
    );
  }

  function getActiveSport() {
    const p = location.pathname.replace(/\/+$/, "") || "/";
    let found = null;
    if (p === "/" || p === "/all" || p.startsWith("/all/")) {
      found = SPORTS.find(x => x.id === "all");
    } else if (p === "/tv" || p.startsWith("/tv/")) {
      found = SPORTS.find(x => x.id === "tv");
    } else if (p === "/sports/football" || p.startsWith("/sports/football")) {
      found = SPORTS.find(x => x.id === "football");
    } else {
      found = SPORTS.find(x => x.href === p || (x.href !== "/" && p.startsWith(x.href)));
    }
    const item = found || SPORTS.find(x => x.id === "all") || SPORTS[0];
    return { ...item, slug: item.id };
  }

  function sportLabel(lang, sport) {
    return t(lang, sport.key) || sport.id;
  }

  // ---------------------------
  // Desktop "More" overflow (portal)
  // ---------------------------

  function renderDesktopSports() {
    window.renderDesktopSports = renderDesktopSports;
    const row = document.getElementById("sportsRow");
    const moreWrap = document.getElementById("moreWrap");
    if (!row || !moreWrap) return;

    const lang = normalizeLang(getLang());
    const active = getActiveSport();
    const country = getUserCountry();
    const sportsToShow = getCountrySpecificSports(country);

    // Clear existing sports items (but keep the More button)
    const existingItems = row.querySelectorAll(".sport-item:not(#moreWrap)");
    existingItems.forEach(item => item.remove());

    // Generate HTML for each sport
    sportsToShow.forEach((s) => {
      const name = sportLabel(lang, s);
      const isActive = s.id === active.id;
      let html = "";

      if (s.enabled) {
        // Active/enabled sport - render as link
        html = `
          <a
            class="sport-item flex items-center gap-3 transition-all focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 h-10 rounded-none hover:bg-background-tertiary ${isActive ? 'bg-background-secondary active' : ''} px-4 relative rounded-tl-2xl rounded-tr-2xl"
            href="${s.href}"
            data-sportid="${s.sportId}"
            ${isActive ? 'data-status="active" aria-current="page"' : ''}
          >
            ${iconUse(s.id)}
            <span class="text-sm ${isActive ? 'font-semibold' : 'font-medium'} whitespace-nowrap">${name}</span>
          </a>
        `;
      } else {
        // Disabled sport - render as button with tooltip
        html = `
          <div class="sport-item tooltip__trigger" role="button" tabindex="0">
            <div>
              <button
                class="button button--sm button--ghost flex items-center gap-2 h-10 rounded-none rounded-tl-2xl rounded-tr-2xl opacity-50 px-4 text-muted-foreground border-b-2 border-transparent hover:opacity-60 transition-opacity"
                type="button"
                data-sportid="${s.sportId}"
                aria-label="${name}"
                title="${name}"
              >
                ${iconUse(s.id)}
                <span class="text-sm font-medium">${name}</span>
              </button>
            </div>
          </div>
        `;
      }

      // Insert before the More button
      moreWrap.insertAdjacentHTML('beforebegin', html);
    });
  }

  function setupDesktopMore() {
    const row = document.getElementById("sportsRow");
    const moreWrap = document.getElementById("moreWrap");
    const moreBtn = document.getElementById("moreBtn");
    const moreMenu = document.getElementById("moreMenu");
    if (!row || !moreWrap || !moreBtn || !moreMenu) return;

    if (moreBtn.dataset.moreBound === BOUND_MARKER) return;
    moreBtn.dataset.moreBound = BOUND_MARKER;

    // Create / reuse portal
    let portal = document.getElementById("moreMenuPortal");
    if (!portal) {
      portal = document.createElement("div");
      portal.id = "moreMenuPortal";
      portal.style.position = "fixed";
      portal.style.zIndex = String(PORTAL_Z_INDEX);
      portal.style.display = "none";
      portal.style.left = "0px";
      portal.style.top = "0px";
      document.body.appendChild(portal);
    }

    // Move menu into portal
    if (moreMenu.parentElement !== portal) portal.appendChild(moreMenu);

    // Keep "menu" styled like your classes
    moreMenu.style.display = "block";
    moreMenu.style.position = "relative";
    moreMenu.style.marginTop = "0";
    moreMenu.style.right = "auto";

    function placePortal() {
      const r = moreBtn.getBoundingClientRect();
      const gap = 8;
      const menuW = moreMenu.offsetWidth || 224; // w-56 fallback
      const menuH = moreMenu.offsetHeight || 200;

      let left = r.right - menuW;
      let top = r.bottom + gap;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (left < 8) left = 8;
      if (left + menuW > vw - 8) left = vw - menuW - 8;

      if (top + menuH > vh - 8) {
        top = r.top - gap - menuH;
        if (top < 8) top = 8;
      }

      portal.style.left = left + "px";
      portal.style.top = top + "px";
    }

    function isOpen() {
      return portal.style.display === "block";
    }

    function openMenu() {
      portal.style.display = "block";
      moreBtn.setAttribute("aria-expanded", "true");
      placePortal();
    }

    function closeMenu() {
      portal.style.display = "none";
      moreBtn.setAttribute("aria-expanded", "false");
    }

    moreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isOpen() ? closeMenu() : openMenu();
    });

    document.addEventListener("click", (e) => {
      if (portal.contains(e.target)) return;
      if (moreWrap.contains(e.target)) return;
      closeMenu();
    });

    window.addEventListener("resize", () => {
      if (isOpen()) placePortal();
    });
    window.addEventListener(
      "scroll",
      () => {
        if (isOpen()) placePortal();
      },
      true
    );

    function moveBackFromMenu() {
      const moved = Array.from(moreMenu.querySelectorAll(".sport-item"));
      moved.forEach((el) => row.insertBefore(el, moreWrap));
    }

    function recalcOverflow() {
      closeMenu();
      moveBackFromMenu();
      moreWrap.style.display = "none";

      if (row.scrollWidth <= row.clientWidth + 1) return;

      moreWrap.style.display = "block";

      const getItems = () =>
        Array.from(row.querySelectorAll(".sport-item")).filter((el) => el !== moreWrap);

      while (row.scrollWidth > row.clientWidth + 1) {
        const items = getItems();
        if (!items.length) break;
        const last = items[items.length - 1];
        moreMenu.prepend(last);
      }

      if (moreMenu.children.length === 0) {
        moreWrap.style.display = "none";
        closeMenu();
      }
    }

    const ro = new ResizeObserver(recalcOverflow);
    ro.observe(row);

    // IMPORTANT: re-render sports and re-run overflow when language/country changes
    document.addEventListener("langchange", () => {
      // wait one frame so text is updated before measuring
      requestAnimationFrame(() => {
        renderDesktopSports();
        recalcOverflow();
      });
    });

    // Initial render
    renderDesktopSports();
    recalcOverflow();
  }

  // ---------------------------
  // Mobile sports dropdown
  // ---------------------------
  function setupMobileSports() {
    const root = document.getElementById("mobileSports");
    const btn = document.getElementById("mobileSportsBtn");
    const menu = document.getElementById("mobileSportsMenu");
    const activeEl = document.getElementById("mobileSportsActive");
    const chevron = document.getElementById("mobileSportsChevron");
    const backdrop = document.getElementById("mobileSportsBackdrop");
    if (!root || !btn || !menu || !activeEl || !chevron || !backdrop) return;

    if (btn.dataset.mobileSportsBound === BOUND_MARKER) return;
    btn.dataset.mobileSportsBound = BOUND_MARKER;

    function render() {
      window.renderMobileSports = render;
      const lang = normalizeLang(getLang());
      const active = getActiveSport();
      const country = getUserCountry();
      const sportsToShow = getCountrySpecificSports(country);

      activeEl.innerHTML =
        `${iconUse(active.id)}` +
        `<span class="text-sm font-semibold whitespace-nowrap">${sportLabel(lang, active)}</span>`;

      menu.innerHTML = sportsToShow.map((s) => {
        const name = sportLabel(lang, s);
        const isActive = s.id === active.id;

        if (s.enabled) {
          return (
            `<a data-sportid="${s.sportId}" class="flex items-center gap-3 transition-all focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0` +
            ` w-full h-12 justify-start rounded-2xl hover:bg-background-tertiary ` +
            `${isActive ? "bg-background-secondary active" : ""} px-3"` +
            ` href="${s.href}" ${isActive ? 'aria-current="page"' : ""}>` +
            `${iconUse(s.id)}` +
            `<span class="text-sm font-semibold whitespace-nowrap">${name}</span>` +
            `</a>`
          );
        }

        return (
          `<div data-sportid="${s.sportId}" class="w-full h-12 flex items-center justify-between rounded-2xl cursor-not-allowed opacity-60 px-3">` +
          `<div class="flex items-center gap-3">` +
          `${iconUse(s.id, "text-muted-foreground")}` +
          `<span class="text-sm font-medium text-muted-foreground whitespace-nowrap">${name}</span>` +
          `</div></div>`
        );
      }).join("");

      
      menu.style.overflowY = "auto";
      menu.style.webkitOverflowScrolling = "touch";
      menu.style.overscrollBehavior = "contain";
    }
    window.renderMobileSports = render;

    function openMenu() {
      menu.classList.remove("hidden");
      backdrop.classList.remove("hidden");
      btn.setAttribute("aria-expanded", "true");
      chevron.classList.add("rotate-180");
      backdrop.style.pointerEvents = "auto";
      document.body.classList.add(BODY_SCROLL_LOCK_CLASS);

      requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        const available = window.innerHeight - rect.top - 16;
        menu.style.maxHeight = Math.max(available, 200) + "px";
      });
    }

    function closeMenu() {
      menu.classList.add("hidden");
      backdrop.classList.add("hidden");
      btn.setAttribute("aria-expanded", "false");
      chevron.classList.remove("rotate-180");
      backdrop.style.pointerEvents = "none";
      document.body.classList.remove(BODY_SCROLL_LOCK_CLASS);
    }

    function isOpen() {
      return !menu.classList.contains("hidden");
    }

    // Handle clicks inside mobile menu: navigate cleanly when link tapped
    menu.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (a && a.href) {
        closeMenu();
        if (typeof window.asNavigate === "function") {
          e.preventDefault();
          const u = new URL(a.href, window.location.origin);
          window.asNavigate(u.pathname, u.search);
        }
        return;
      }
      e.stopPropagation();
    });
    menu.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    menu.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      isOpen() ? closeMenu() : openMenu();
    });

    backdrop.addEventListener("click", closeMenu);

    document.addEventListener("click", (e) => {
      if (root.contains(e.target)) return;
      closeMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });

    render();
    document.addEventListener("langchange", render);

  }

  // ---------------------------
  // INIT
  // ---------------------------
async function init() {
  const lang = normalizeLang(await detectLangOnce());

    // Always try load EN first (fallback)
    try { await loadLangFile("en"); } catch (e) { console.warn(e); }

    // Then selected language
    try { await loadLangFile(lang); } catch (e) { console.warn(e); }

    applyI18n(lang);
    setupStatusFiltersI18n();
    setupLangModal();
    setupTheme();
    setupDesktopMore();
    setupMobileSports();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }
})();



(function () {
  "use strict";

  const MIN_OFFSET = 0;
  const MAX_OFFSET = 0;

  // Use shared SPORTS config from main module
  const SPORTS = window.SPORTS_CONFIG || [];

  function getActiveSport() {
    if (typeof window.getActiveSport === "function") {
      return window.getActiveSport();
    }
    const p = location.pathname.replace(/\/+$/, "") || "/";
    let found = null;
    if (p === "/" || p === "/all" || p.startsWith("/all/")) {
      found = SPORTS.find(x => x.id === "all");
    } else if (p === "/tv" || p.startsWith("/tv/")) {
      found = SPORTS.find(x => x.id === "tv");
    } else if (p === "/sports/football" || p.startsWith("/sports/football")) {
      found = SPORTS.find(x => x.id === "football");
    } else {
      found = SPORTS.find(x => x.href === p || (x.href !== "/" && p.startsWith(x.href)));
    }
    const item = found || SPORTS.find(x => x.id === "all") || SPORTS[0] || { id: "all", slug: "all", sportId: 0, href: "/" };
    return { ...item, slug: item.id || "all" };
  }

  const FLASH_BASE = "https://1.newsoccers.one/2/x/feed";
  const FLASH_FSIGN = "SW9D1eZo"; // ✅ HERE  

  function flashUrl(sportId, dayOffset) {
    return `${FLASH_BASE}/f_${sportId}_${dayOffset}_2_en_1`;
  }

  function yourApiUrl(sportSlug, ymd) {
    return `/api/v1/${encodeURIComponent(sportSlug)}/${encodeURIComponent(ymd)}`;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function localDateAtOffset(dayOffset) {
    const d = new Date();
    d.setUTCHours(12, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return d;
  }

  function ymdFromLocalDate(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  // Get day boundaries as Unix timestamps (start of day 00:00:00, end of day 23:59:59)
  function getDayBoundaries(dayOffset) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    const startTs = Math.floor(d.getTime() / 1000);
    const endTs = startTs + (24 * 60 * 60) - 1; // 23:59:59
    return { startTs, endTs };
  }

function dayLabel(dayOffset, d) {
  // use main.js i18n if available
  if (window.i18n && typeof window.i18n.dayLabel === "function") {
    return window.i18n.dayLabel(dayOffset, d);
  }

  // fallback
  if (dayOffset === -1) return "Yesterday";
  if (dayOffset === 0)  return "Today";
  if (dayOffset === 1)  return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}


  // ============================================
  // TV CHANNELS FILTERING
  // ============================================
  // Store user's available TV channels from database
  let userChannels = {}; // Map of FS ID -> channel object (e.g., "TVI2044" -> {id, name, ...})
  let channelsLoaded = false;

  // Fetch user's available TV channels from database or catalog
  async function fetchUserChannels() {
    if (channelsLoaded) return userChannels;

    try {
      let res = await fetch("/api/channels").catch(() => null);
      if (!res || !res.ok) {
        res = await fetch("/assets/channels.json").catch(() => null);
      }
      if (res.ok) {
        const data = await res.json();

        // Handle different response formats
        let channelsArray = [];
        if (Array.isArray(data)) {
          channelsArray = data;
        } else if (data && Array.isArray(data.items)) {
          channelsArray = data.items;
        } else if (data && Array.isArray(data["24/7 Channels"])) {
          channelsArray = data["24/7 Channels"];
        } else if (data && Array.isArray(data.channels)) {
          channelsArray = data.channels;
        } else if (data && Array.isArray(data.data)) {
          channelsArray = data.data;
        }

        // Build a map of TVI IDs for quick lookup
        // FS field format: "TVI2569" -> extract "2569" (the numeric TVI ID)
        userChannels = {};
        channelsArray.forEach(ch => {
          if (ch && ch.FS) {
            // Extract numeric TVI ID from "TVI2569" format
            const match = ch.FS.match(/TVI(\d+)/);
            if (match) {
              const tviId = match[1];
              userChannels[tviId] = ch;
            }
          }
        });
      }
    } catch (e) {
      // Silently fail - no channels available
    }

    channelsLoaded = true;
    return userChannels;
  }

  // Parse TV channel IDs from Flashscore AL field (JSON format)
  function parseTvChannels(alField) {
    if (!alField) return [];

    try {
      const parsed = JSON.parse(alField);
      const tvChannels = parsed["1"] || [];
      return tvChannels
        .filter(ch => ch && ch.TVI)
        .map(ch => String(ch.TVI));
    } catch (e) {
      return [];
    }
  }

  // Check if match has any TV channels available in user's database
  function hasMatchingChannels(tvChannelIds) {
    if (!tvChannelIds || tvChannelIds.length === 0) return false;
    return tvChannelIds.some(chId => userChannels[chId]);
  }

  // Get channel names for display
  function getChannelNames(tvChannelIds) {
    if (!tvChannelIds || tvChannelIds.length === 0) return [];
    return tvChannelIds
      .filter(chId => userChannels[chId])
      .map(chId => userChannels[chId].name || chId);
  }

  // Estimated match duration by sport (in minutes)
  // Football: 45 + 15 (HT) + 45 + ~5 (injury) + 30 (ET) + 15 (penalties) + buffer = ~180 min
  const SPORT_DURATIONS = {
    football: 65,
    basketball: 150,
    hockey: 150,
    tennis: 180,
    default: 180
  };

  // Parse custom matches from API items (CUST: prefix)
  // Format: { match_id: "CUST:ftb-20260126-001", sport: "football", start_ts: 1769486400, name: "Bosnia XI - Croatia XI" }
  // Or single event: { match_id: "CUST:ucl-draw-001", sport: "football", start_ts: 1769486400, name: "UCL DRAW" }
  function parseCustomMatches(items, flashEventIds = new Set()) {
    if (!items || !Array.isArray(items)) return [];

    const customMatches = [];
    const now = Math.floor(Date.now() / 1000);

    items.forEach(item => {
      if (!item.match_id) return;
      const cleanId = item.match_id.replace(/^FS:/, "");
      const isCustomMatch = item.match_id.startsWith("CUST:") ||
                            item.match_id.startsWith("TIM:") ||
                            item.match_id.startsWith("TOP:") ||
                            item.match_id.startsWith("BIN:") ||
                            (item.match_id.startsWith("FS:") && !flashEventIds.has(cleanId) && item.name);
      if (!isCustomMatch) return;

      const id = item.match_id.startsWith("FS:") ? cleanId : item.match_id;
      const sport = item.sport || "football";
      const startTs = parseInt(item.start_ts, 10) || Math.floor(Date.now() / 1000);
      const name = item.name || "";

      let homeTeam = "";
      let awayTeam = "";

      if (name.includes(" - ")) {
        const teamParts = name.split(" - ");
        homeTeam = teamParts[0] ? teamParts[0].trim() : "Team A";
        awayTeam = teamParts[1] ? teamParts[1].trim() : "Team B";
      } else if (name.includes(" vs ") || name.includes(" vs. ")) {
        const teamParts = name.split(/\s*vs\.?\s*/i);
        homeTeam = teamParts[0] ? teamParts[0].trim() : "Team A";
        awayTeam = teamParts[1] ? teamParts[1].trim() : "Team B";
      } else if (name.includes(" @ ")) {
        const teamParts = name.split(" @ ");
        awayTeam = teamParts[0] ? teamParts[0].trim() : "Away";
        homeTeam = teamParts[1] ? teamParts[1].trim() : "Home";
      } else {
        homeTeam = name.trim();
        awayTeam = "";
      }

      const isSingleEvent = item.is_single_event === true || !awayTeam;

      // Calculate status: use explicit item.end_ts when present, else sport-default duration
      let endTs;
      const itemEnd = parseInt(item.end_ts, 10) || 0;
      if (itemEnd > 0) {
        endTs = itemEnd;
      } else {
        const durationMin = SPORT_DURATIONS[sport] || SPORT_DURATIONS.default;
        endTs = startTs + (durationMin * 60);
      }

      let status = "notstarted";
      if (now >= startTs && now < endTs) {
        status = "inprogress";
      } else if (now >= endTs) {
        status = "finished";
      }

      // Calculate approximate minute for live matches
      let minute = "";
      if (status === "inprogress") {
        const elapsedMin = Math.floor((now - startTs) / 60);
        minute = String(elapsedMin);
      }

      customMatches.push({
        id: id,
        tournamentId: "custom",
        homeTeam: homeTeam,
        awayTeam: awayTeam,
        homeScore: "",
        awayScore: "",
        startTime: String(startTs),
        stageStartTime: "",
        stageType: "",
        status: status,
        minute: minute,
        homeTeamLogo: "",
        awayTeamLogo: "",
        tvChannelIds: [],
        hasTv: false,
        isCustom: true,
        isSingleEvent: isSingleEvent,
        eventName: isSingleEvent ? name.trim() : "",
        sport: sport
      });
    });

    return customMatches;
  }

  // Render custom matches without tournament header
  function renderCustomMatches(customMatches) {
    if (!customMatches || customMatches.length === 0) return "";

    // Sort by status (live first) then by start time
    const sorted = [...customMatches].sort((a, b) => {
      const statusPriorityA = a.status === "inprogress" ? 0 : (a.status === "notstarted" ? 1 : 2);
      const statusPriorityB = b.status === "inprogress" ? 0 : (b.status === "notstarted" ? 1 : 2);
      if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;
      const timeA = parseInt(a.startTime) || 0;
      const timeB = parseInt(b.startTime) || 0;
      return timeA - timeB;
    });

    return `
      <div class="mb-4">
        <div class="card card--default w-full p-0 gap-0" data-slot="card" data-tournament-id="custom">
          <div class="card__content p-0" data-slot="card-content">
            <div class="p-0 m-0 gap-0">
              ${sorted.map(e => renderMatch(e)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Flashscore fetch with CORS edge proxy (ultra-fast, zero-CORS stall)
  async function fetchSingleFlash(sId, dayOffset) {
    const feedKey = `f_${sId}_${dayOffset}_2_en_1`;
    const proxyUrl = `/api/feed?path=${encodeURIComponent(feedKey)}`;

    // Try Cloudflare Pages edge proxy first (handles CORS & headers)
    try {
      const res = await fetch(proxyUrl, { cache: "no-store" });
      if (res.ok) {
        const text = await res.text().catch(() => "");
        if (text && text.length > 20) return { ok: true, text };
      }
    } catch (e) {}

    // Direct fetch fallback
    try {
      const url = flashUrl(sId, dayOffset);
      const res2 = await fetch(url, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        headers: {
          "x-fsign": FLASH_FSIGN,
          "accept": "*/*",
        },
      });
      if (res2.ok) {
        const text2 = await res2.text().catch(() => "");
        return { ok: true, text: text2 };
      }
    } catch (e2) {}

    return { ok: false, text: "" };
  }

  async function fetchFlashscore(sportId, dayOffset) {
    if (sportId === 0) {
      // Aggregate top sports: Football (1), Basketball (3), Tennis (2), Hockey (4), Motorsport (31)
      const topSportIds = [1, 13, 3, 2, 4, 31, 12, 5];
      const results = await Promise.allSettled(topSportIds.map(sid => fetchSingleFlash(sid, dayOffset)));
      const texts = [];
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.ok && r.value.text) {
          texts.push(r.value.text);
        }
      });
      if (texts.length > 0) {
        return { ok: true, status: 200, url: 'aggregated', text: texts.join('~') };
      }
      return { ok: false, status: 0, url: 'aggregated', text: "" };
    }

    const single = await fetchSingleFlash(sportId, dayOffset);
    return { ok: single.ok, status: single.ok ? 200 : 0, url: flashUrl(sportId, dayOffset), text: single.text };
  }

  async function fetchYourAPI(sportSlug, ymd) {
    const url = yourApiUrl(sportSlug, ymd);
    const res = await fetch(url, { cache: "no-store" });
    let json = null;
    try { json = await res.json(); } catch (e) {}
    return { ok: res.ok, status: res.status, url, json };
  }

  function findControls() {
    const prev  = document.getElementById("dayPrev") || document.querySelector('button[aria-label="Go to previous day"]');
    const next  = document.getElementById("dayNext") || document.querySelector('button[aria-label="Go to next day"]');
    const label = document.getElementById("dayLabel") || document.querySelector(".group .truncate");
    return { prev, next, label };
  }
function setStatusFiltersVisible(visible) {
  const liveBtn = document.getElementById("filterLive");
  const finBtn  = document.getElementById("filterFinished");
  const upBtn   = document.getElementById("filterUpcoming");

  // wrapper (either the id you add, or fallback to parent of live button)
  const wrap =
    document.getElementById("statusFilters") ||
    (liveBtn ? liveBtn.parentElement : null);

  if (!wrap) return;

  // show/hide whole filter group
  wrap.classList.toggle("hidden", !visible);

  // reset filter state so it doesn't "stick" when coming back to Today
  [liveBtn, finBtn, upBtn].forEach((btn) => {
    if (!btn) return;
    btn.setAttribute("aria-pressed", "false");

    // if your main.js toggles "active" classes, clear the obvious ones:
    btn.classList.remove("button--danger-soft");
    if (btn.id === "filterLive") btn.classList.add("button--danger-soft"); // keep default look when visible
  });
}

  // Map country names to ISO codes for flags
  function getCountryCode(countryName) {
    const countryMap = {
      'Algeria': 'DZ',
      'Argentina': 'AR',
      'Australia': 'AU',
      'Austria': 'AT',
      'Belgium': 'BE',
      'Brazil': 'BR',
      'Bulgaria': 'BG',
      'Canada': 'CA',
      'Chile': 'CL',
      'China': 'CN',
      'Colombia': 'CO',
      'Croatia': 'HR',
      'Czech Republic': 'CZ',
      'Denmark': 'DK',
      'Ecuador': 'EC',
      'Egypt': 'EG',
      'England': 'GB-ENG',
      'Finland': 'FI',
      'France': 'FR',
      'Germany': 'DE',
      'Ghana': 'GH',
      'Greece': 'GR',
      'Hungary': 'HU',
      'India': 'IN',
      'Indonesia': 'ID',
      'Iran': 'IR',
      'Ireland': 'IE',
      'Israel': 'IL',
      'Italy': 'IT',
      'Japan': 'JP',
      'Mexico': 'MX',
      'Morocco': 'MA',
      'Netherlands': 'NL',
      'Nigeria': 'NG',
      'Norway': 'NO',
      'Paraguay': 'PY',
      'Peru': 'PE',
      'Poland': 'PL',
      'Portugal': 'PT',
      'Romania': 'RO',
      'Russia': 'RU',
      'Saudi Arabia': 'SA',
      'Scotland': 'GB-SCT',
      'Senegal': 'SN',
      'Serbia': 'RS',
      'Slovakia': 'SK',
      'Slovenia': 'SI',
      'South Africa': 'ZA',
      'South Korea': 'KR',
      'Spain': 'ES',
      'Sweden': 'SE',
      'Switzerland': 'CH',
      'Tunisia': 'TN',
      'Turkey': 'TR',
      'Ukraine': 'UA',
      'United Arab Emirates': 'AE',
      'Uruguay': 'UY',
      'USA': 'US',
      'Venezuela': 'VE',
      'Wales': 'GB-WLS'
    };

    return countryMap[countryName] || '';
  }

  // Parse Flashscore data (actual Flashscore format)
  function parseFlashData(text) {
    if (!text) return { tournaments: {}, events: [] };

    // Split by row delimiter
    const rows = text.split("~");
    const tournaments = {};
    const events = [];
    let currentTournament = null;
    let currentSportId = 1;
    const active = getActiveSport();
    if (active && active.sportId) {
      currentSportId = active.sportId;
    }

    rows.forEach((row, rowIndex) => {
      if (!row) return;
      if (row.startsWith("SA÷")) {
        const sid = parseInt(row.replace("SA÷", "").split("¬")[0], 10);
        if (!isNaN(sid)) {
          currentSportId = sid;
        }
        currentTournament = null;
        return;
      }

      // Split row into cells
      const cells = row.split("¬");
      const rowData = {};

      // Parse each cell into key-value pairs
      cells.forEach(cell => {
        const [key, value] = cell.split("÷");
        if (key && value) {
          rowData[key] = value;
        }
      });

      // Check if this is a tournament header
      if (rowData.ZA) {
        const tournamentFullName = rowData.ZA;
        // Use ZC (stage ID) as unique identifier - this is how Flashscore groups tournaments
        // Different stages/groups of the same tournament have different ZC values
        const stageId = rowData.ZC || "";
        const baseId = rowData.ZE || rowData.ZH || tournamentFullName.replace(/[^a-zA-Z0-9]/g, '_');
        const tournamentId = stageId ? `${baseId}_${stageId}` : baseId;

        // Split country and league name
        let country = "";
        let leagueName = tournamentFullName;

        if (tournamentFullName.includes(":")) {
          const splitParts = tournamentFullName.split(":");
          country = splitParts[0].trim();
          leagueName = splitParts[1] ? splitParts[1].trim() : tournamentFullName;
        }

        // Use ZY for country name if available
        if (rowData.ZY) {
          country = rowData.ZY;
        }

        // Get country code
        const countryCode = getCountryCode(country);

        // Tournament image
        const tournamentImage = rowData.OAJ ? `https://www.flashscore.com/res/image/data/${rowData.OAJ}` : '';

        currentTournament = {
          id: tournamentId,
          name: leagueName,
          country: country,
          countryCode: countryCode,
          image: tournamentImage,
          events: []
        };

        tournaments[tournamentId] = currentTournament;
      }
      // Check if this is an event
      else if (rowData.AA && currentTournament) {
        const eventId = rowData.AA;

        // Parse status: 1=scheduled, 2=live, 3=finished
        let status = "notstarted";
        const statusCode = parseInt(rowData.AB, 10);
        if (statusCode === 1) status = "notstarted";
        else if (statusCode === 2) status = "inprogress";
        else if (statusCode === 3) status = "finished";

        // Team logos
        const homeTeamLogo = rowData.OA ? `https://www.flashscore.com/res/image/data/${rowData.OA}` : '';
        const awayTeamLogo = rowData.OB ? `https://www.flashscore.com/res/image/data/${rowData.OB}` : '';

        // Parse TV channel TVI IDs from AL field (JSON with TV channels array)
        const tvChannelIds = parseTvChannels(rowData.AL);

        const event = {
          id: eventId,
          tournamentId: currentTournament.id,
          homeTeam: rowData.CX || rowData.AE || "",
          awayTeam: rowData.AF || "",
          homeScore: rowData.AT || rowData.AG || "",
          awayScore: rowData.AU || rowData.AH || "",
          startTime: rowData.AD || "",
          endTime: rowData.AP || "",
          stageStartTime: rowData.AO || "", // When current period started
          stageType: rowData.AB || "",      // Stage type: 12=1st half, 13=2nd half, 38=HT, etc.
          status: status,
          minute: rowData.AC || "",
          homeTeamLogo: homeTeamLogo,
          awayTeamLogo: awayTeamLogo,
          tvChannelIds: tvChannelIds,       // Array of TV channel IDs
          hasTv: tvChannelIds.length > 0,
          sport: (SPORTS.find(s => s.sportId === currentSportId)?.id) || (active.id !== 'all' && active.id !== 'tv' ? active.id : 'football')
        };

        currentTournament.events.push(event);
        events.push(event);
      }
    });

    return { tournaments, events };
  }

  // Create skeleton loading HTML
  function createSkeletonHTML() {
    return `
      <div class="space-y-4 animate-pulse">
        ${Array(3).fill(0).map(() => `
          <div class="mb-4">
            <div class="card card--default w-full p-0 gap-0" data-slot="card">
              <div class="card__header px-4 py-3.5 flex items-center gap-3 border-b-[0.5px] border-b-background-secondary bg-surface-secondary/30" data-slot="card-header">
                <div class="relative h-7 w-7 rounded-full bg-surface-secondary"></div>
                <div class="flex flex-col gap-1.5 flex-1">
                  <div class="h-3 bg-surface-secondary rounded w-24"></div>
                  <div class="h-4 bg-surface-secondary rounded w-40"></div>
                </div>
              </div>
              <div class="card__content p-0" data-slot="card-content">
                ${Array(4).fill(0).map(() => `
                  <div class="w-full px-3 sm:px-5 py-3 border-b border-background-secondary last:border-b-0">
                    <div class="flex items-center justify-between gap-2 sm:gap-3">
                      <div class="shrink-0 hidden sm:block">
                        <div class="h-6 w-12 bg-surface-secondary rounded-full"></div>
                      </div>
                      <div class="flex items-center gap-2 sm:gap-3 flex-1 basis-0 justify-end min-w-0">
                        <div class="h-4 bg-surface-secondary rounded w-24 sm:w-32"></div>
                        <div class="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-surface-secondary"></div>
                      </div>
                      <div class="flex flex-col items-center gap-2 min-w-14 sm:min-w-20">
                        <div class="h-6 w-16 bg-surface-secondary rounded"></div>
                      </div>
                      <div class="flex items-center gap-2 sm:gap-3 flex-1 basis-0 min-w-0">
                        <div class="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-surface-secondary"></div>
                        <div class="h-4 bg-surface-secondary rounded w-24 sm:w-32"></div>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Create empty state HTML
  function createEmptyStateHTML() {
    const t = window.i18n?.t || ((key) => key);
    return `
      <div class="mb-4">
        <div class="card card--default w-full" data-slot="card">
          <div class="card__content flex flex-col items-center justify-center py-16 text-center" data-slot="card-content">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-20 h-20 text-muted-foreground/40 mb-6">
              <path d="M18 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V4C20 2.89543 19.1046 2 18 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 2V6M16 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 10H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
            </svg>
            <h3 class="text-xl font-bold text-foreground mb-2">${t('matches.empty.title') || 'No matches available'}</h3>
            <p class="text-sm text-muted-foreground max-w-sm">${t('matches.empty.description') || 'There are no matches scheduled for this day'}</p>
          </div>
        </div>
      </div>
    `;
  }

  // Format time from timestamp
  function formatTime(timestamp) {
    if (!timestamp) return "";
    const d = new Date(parseInt(timestamp) * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Calculate live match minute for FOOTBALL
  // Based on Flashscore's calculation method
  function calculateLiveMinute(event) {
    const now = Math.floor(Date.now() / 1000);
    const matchStartTime = parseInt(event.startTime, 10);
    const stageStartTime = parseInt(event.stageStartTime, 10);

    // Method 1: If we have stage start time (AO field), use it
    if (stageStartTime > 0) {
      const elapsedFromStage = Math.floor((now - stageStartTime) / 60) + 1;

      // Determine which stage we're in based on total elapsed time from match start
      const totalElapsedFromMatch = Math.floor((now - matchStartTime) / 60);

      // Football timing:
      // 0-47 min from start = First half (1'-45'+)
      // 48-62 min from start = Half time break
      // 63+ min from start = Second half (46'-90'+)
      // 108+ min from start = Extra time first half (91'-105')
      // 123+ min from start = Extra time second half (106'-120')

      if (totalElapsedFromMatch <= 47) {
        // First half
        const minute = elapsedFromStage;
        if (minute > 45) return `45+'`;
        return `${minute}'`;
      } else if (totalElapsedFromMatch <= 62) {
        // Half time - but if stageStartTime is set, we might be in 2nd half
        // Trust the stage start time calculation
        return `45+'`;
      } else if (totalElapsedFromMatch <= 107) {
        // Second half: minute = 45 + elapsed from stage start
        const minute = 45 + elapsedFromStage;
        if (minute > 90) return `90+'`;
        return `${minute}'`;
      } else if (totalElapsedFromMatch <= 122) {
        // Extra time first half: minute = 90 + elapsed from stage start
        const minute = 90 + elapsedFromStage;
        if (minute > 105) return `105+'`;
        return `${minute}'`;
      } else {
        // Extra time second half: minute = 105 + elapsed from stage start
        const minute = 105 + elapsedFromStage;
        if (minute > 120) return `120+'`;
        return `${minute}'`;
      }
    }

    // Method 2: Calculate purely from match start time
    if (matchStartTime > 0) {
      const totalElapsed = Math.floor((now - matchStartTime) / 60) + 1;

      // Football timing with breaks:
      // First half: 0-45 minutes
      // Half time break: ~15 minutes (45-60 from start)
      // Second half: starts ~60 min from kick-off

      if (totalElapsed <= 47) {
        // First half (allow 2 min stoppage time buffer)
        if (totalElapsed > 45) return `45+'`;
        return `${totalElapsed}'`;
      } else if (totalElapsed <= 62) {
        // Half time period
        return `HT`;
      } else if (totalElapsed <= 107) {
        // Second half: subtract 15-17 min for half time break
        const secondHalfMinute = totalElapsed - 17; // 17 = 15 min HT + 2 min buffer
        if (secondHalfMinute > 90) return `90+'`;
        if (secondHalfMinute < 46) return `46'`; // Minimum second half
        return `${secondHalfMinute}'`;
      } else if (totalElapsed <= 125) {
        // Extra time first half
        const etMinute = totalElapsed - 17;
        if (etMinute > 105) return `105+'`;
        return `${etMinute}'`;
      } else {
        // Extra time second half
        const etMinute = totalElapsed - 22; // Additional break before ET
        if (etMinute > 120) return `120+'`;
        return `${etMinute}'`;
      }
    }

    // Fallback: use the feed minute if available
    if (event.minute) {
      const s = String(event.minute).trim();
      if (s.includes("'")) return s;
      if (/[a-z]/i.test(s)) return s;
      const n = parseInt(s, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 130) {
        return `${n}'`;
      }
      return s;
    }

    return "LIVE";
  }

  // Check if match is at half time
  function isHalfTime(event) {
    const now = Math.floor(Date.now() / 1000);
    const matchStartTime = parseInt(event.startTime, 10);

    if (matchStartTime > 0) {
      const totalElapsed = Math.floor((now - matchStartTime) / 60);
      // Half time is roughly 48-62 minutes after kick-off
      return totalElapsed >= 48 && totalElapsed <= 62;
    }

    // Fallback: check if minute field says HT
    return event.minute === "HT" || event.minute === "45+";
  }

  // Render match HTML
  function renderMatch(event, customEvent = false) {
    // Handle single events (like "UCL DRAW") with a different layout
    if (event.isSingleEvent) {
      return renderSingleEvent(event);
    }

    const isLive = event.status === "inprogress";
    const isFinished = event.status === "finished";
    const isUpcoming = event.status === "notstarted";
    const isCanceled = event.status === "canceled" || event.status === "postponed";
    const isCustom = event.isCustom === true;  // Custom events from our API
    const matchIsHalfTime = isLive && !isCustom && isHalfTime(event);

    // Status badge for desktop (hidden on mobile)
    let statusBadgeHTML = "";
    if (isCustom && isLive) {
      // Custom events: just show "LIVE" - no minute calculation
      statusBadgeHTML = `
        <div class="shrink-0 hidden sm:block">
          <div class="font-bold rounded-full justify-center bg-red-600 text-white cursor-default inline-flex items-center gap-1 text-xs px-2 py-1.5 min-w-18">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>LIVE
          </div>
        </div>`;
    } else if (matchIsHalfTime) {
      statusBadgeHTML = `
        <div class="shrink-0 hidden sm:block">
          <div class="font-bold rounded-full justify-center bg-orange-600 text-white cursor-default inline-flex items-center gap-1 text-xs px-2 py-1.5 min-w-18">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>HT
          </div>
        </div>`;
    } else if (isLive) {
      const minute = calculateLiveMinute(event) || 'LIVE';
      statusBadgeHTML = `
        <div class="shrink-0 hidden sm:block">
          <div class="font-bold rounded-full justify-center bg-red-600 text-white cursor-default inline-flex items-center gap-1 text-xs px-1.5 py-1.5 min-w-18">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>${minute}
          </div>
        </div>`;
    } else if (isFinished) {
      statusBadgeHTML = `
        <div class="shrink-0 hidden sm:block">
          <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[10px] px-2.5 py-0.5 min-w-16">FT</div>
        </div>`;
    } else if (isCanceled) {
      statusBadgeHTML = `
        <div class="shrink-0 hidden sm:block">
          <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[10px] px-2.5 py-0.5 min-w-16 uppercase">${event.status}</div>
        </div>`;
    } else {
      statusBadgeHTML = `
        <div class="shrink-0 hidden sm:block">
          <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[10px] px-2.5 py-0.5 min-w-16">NS</div>
        </div>`;
    }

    // Status badge for mobile
    let mobileBadgeHTML = "";
    if (isCustom && isLive) {
      // Custom events: just show "LIVE" - no minute calculation
      mobileBadgeHTML = `
        <div class="sm:hidden mt-0.5 flex justify-center">
          <div class="font-bold rounded-full justify-center bg-red-600 text-white cursor-default inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>LIVE
          </div>
        </div>`;
    } else if (matchIsHalfTime) {
      mobileBadgeHTML = `
        <div class="sm:hidden mt-0.5 flex justify-center">
          <div class="font-bold rounded-full justify-center bg-orange-600 text-white cursor-default inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>HT
          </div>
        </div>`;
    } else if (isLive) {
      const minute = calculateLiveMinute(event) || 'LIVE';
      mobileBadgeHTML = `
        <div class="sm:hidden mt-0.5 flex justify-center">
          <div class="font-bold rounded-full justify-center bg-red-600 text-white cursor-default inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>${minute}
          </div>
        </div>`;
    } else if (isFinished) {
      mobileBadgeHTML = `
        <div class="sm:hidden mt-0.5 flex justify-center">
          <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[9px] px-1.5 py-0.5">FT</div>
        </div>`;
    } else if (isCanceled) {
      mobileBadgeHTML = `
        <div class="sm:hidden mt-0.5 flex justify-center">
          <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[9px] px-1.5 py-0.5 uppercase">${event.status}</div>
        </div>`;
    } else {
      mobileBadgeHTML = `
        <div class="sm:hidden mt-0.5 flex justify-center">
          <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[9px] px-1.5 py-0.5">NS</div>
        </div>`;
    }

    // Score/time display for center area
    const scoreColor = isLive ? 'text-red-600' : '';
    const scoreSize = isLive ? 'text-sm sm:text-base' : 'text-base sm:text-lg';
    let scoreHTML = '';
    if (isCustom && isLive) {
      // Custom events when live: show nothing (badge already shows LIVE)
      scoreHTML = '';
    } else if (isCustom) {
      // Custom events not live: show time
      scoreHTML = `<span class="text-xs sm:text-sm font-semibold text-muted-foreground whitespace-nowrap tabular-nums">${formatTime(event.startTime)}</span>`;
    } else if (isLive || isFinished) {
      // Show score for live and finished matches (from Flashscore)
      scoreHTML = `
        <div class="flex items-center gap-2 sm:gap-2.5">
          <span class="${scoreSize} font-bold tabular-nums transition-all ${scoreColor}">${event.homeScore || '0'}</span>
          <span class="text-xs text-muted-foreground font-medium">-</span>
          <span class="${scoreSize} font-bold tabular-nums transition-all ${scoreColor}">${event.awayScore || '0'}</span>
        </div>
      `;
    } else {
      // Show time for upcoming matches
      scoreHTML = `<span class="text-xs sm:text-sm font-semibold text-muted-foreground whitespace-nowrap tabular-nums">${formatTime(event.startTime)}</span>`;
    }

    // Team logos (use placeholder if not available)
    const homeLogoURL = event.homeTeamLogo || `/assets/team-placeholder.svg`;
    const awayLogoURL = event.awayTeamLogo || `/assets/team-placeholder.svg`;

    // Match sport routing
    const matchSport = event.sport || (getActiveSport().id !== 'all' && getActiveSport().id !== 'tv' ? getActiveSport().id : 'football');

    return `
      <div class="w-full rounded-none border-b-background-secondary not-last:border-b-[0.5px] hover:bg-surface-secondary">
        <a href="/match/${matchSport}/${event.id}" class="w-full group block px-3 sm:px-5 py-2 sm:py-2 cursor-pointer transition-all duration-200 relative" data-event-id="${event.id}" data-status="${event.status}" style="overflow: visible;">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top"></div>
          <div class="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
            ${statusBadgeHTML}

            <div class="flex items-center gap-2 sm:gap-3 md:gap-3 flex-1 basis-0 justify-end min-w-0">
              <span class="text-xs sm:text-sm font-semibold truncate text-right group-hover:text-primary transition-colors">${event.homeTeam || 'Home Team'}</span>
              <div class="relative h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden p-1">
                <img alt="${event.homeTeam}" loading="lazy" class="object-contain w-full h-full" src="${homeLogoURL}" onerror="this.style.display='none'">
              </div>
            </div>

            <div class="flex flex-col items-center gap-1 min-w-14 sm:min-w-20 md:min-w-24 justify-center">
              <div class="flex flex-col items-center">
                ${scoreHTML}
              </div>
              ${mobileBadgeHTML}
            </div>

            <div class="flex items-center gap-2 sm:gap-3 md:gap-3 flex-1 basis-0 min-w-0">
              <div class="relative h-7 w-7 sm:h-8 sm:w-8 shrink-0 overflow-hidden p-1">
                <img alt="${event.awayTeam}" loading="lazy" class="object-contain w-full h-full" src="${awayLogoURL}" onerror="this.style.display='none'">
              </div>
              <span class="text-xs sm:text-sm font-semibold truncate group-hover:text-primary transition-colors">${event.awayTeam || 'Away Team'}</span>
            </div>
          </div>
        </a>
      </div>
    `;
  }

  // Render single events (non-match events like "UCL DRAW")
  function renderSingleEvent(event) {
    const isLive = event.status === "inprogress";
    const isFinished = event.status === "finished";

    // Status/time display
    let statusHTML = '';
    if (isLive) {
      statusHTML = `
        <div class="flex items-center gap-2">
          <div class="font-bold rounded-full justify-center bg-red-600 text-white cursor-default inline-flex items-center gap-1 text-xs px-2 py-1">
            <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>LIVE
          </div>
        </div>`;
    } else if (isFinished) {
      statusHTML = `
        <div class="font-semibold rounded-full bg-background-secondary justify-center text-secondary-foreground cursor-default inline-flex items-center text-[10px] px-2.5 py-1">ENDED</div>`;
    } else {
      statusHTML = `<span class="text-xs sm:text-sm font-semibold text-muted-foreground whitespace-nowrap tabular-nums">${formatTime(event.startTime)}</span>`;
    }

    const eventName = event.eventName || event.homeTeam || 'Event';

    return `
      <div class="w-full rounded-none border-b-background-secondary not-last:border-b-[0.5px] hover:bg-surface-secondary">
       <a href="/match/${event.sport || 'football'}/${event.id}"
class="w-full group block px-3 sm:px-5 py-3 sm:py-3 cursor-pointer transition-all duration-200 relative" data-event-id="${event.id}" data-status="${event.status}" style="overflow: visible;">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform duration-200 origin-top"></div>
          <div class="flex items-center justify-between gap-3 min-w-0">
            <span class="text-xs sm:text-sm md:text-base font-semibold group-hover:text-primary transition-colors truncate min-w-0 pr-2">${eventName}</span>
            <div class="shrink-0">${statusHTML}</div>
          </div>
        </a>
      </div>
    `;
  }

  // Get hour from timestamp for grouping
  function getEventHour(timestamp) {
    if (!timestamp) return 0;
    const d = new Date(parseInt(timestamp) * 1000);
    return d.getHours();
  }

  // Group events by exact hour (like Flashscore does)
  function groupEventsByTimeSlot(events) {
    const groups = {};

    events.forEach(event => {
      const hour = getEventHour(event.startTime);
      const slotKey = `${hour}`;

      if (!groups[slotKey]) {
        groups[slotKey] = [];
      }
      groups[slotKey].push(event);
    });

    return groups;
  }

  // Render tournament section (can be split by time slot)
  function renderTournament(tournament, timeSlotEvents = null) {
    const eventsToRender = timeSlotEvents || tournament.events;
    if (!eventsToRender || eventsToRender.length === 0) return "";

    // Sort events: live first, then by start time
    const sortedEvents = [...eventsToRender].sort((a, b) => {
      // Priority: live > upcoming > finished
      const statusPriorityA = a.status === "inprogress" ? 0 : (a.status === "notstarted" ? 1 : 2);
      const statusPriorityB = b.status === "inprogress" ? 0 : (b.status === "notstarted" ? 1 : 2);

      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }

      // Within same status, sort by start time
      const timeA = parseInt(a.startTime) || 0;
      const timeB = parseInt(b.startTime) || 0;
      return timeA - timeB;
    });

    // Get country flag code (lowercase 2-letter code)
    const flagCode = tournament.countryCode ? tournament.countryCode.toLowerCase() : 'international';
    const flagURL = `/assets/flags/${flagCode}.svg`;

    return `
      <div class="mb-4">
        <div class="card card--default w-full p-0 gap-0" data-slot="card" data-tournament-id="${tournament.id}">
          <div class="card__header px-4 py-3.5 flex items-center justify-between border-b-[0.5px] border-b-background-secondary bg-surface-secondary/30" data-slot="card-header">
            <div class="flex flex-row justify-between w-full gap-2">
              <div class="flex flex-row justify-center items-center">
                   <div class="relative h-full w-6 mr-2" style="display: flex;
    align-items: center;
    justify-content: center;">
                  <img alt="${tournament.country || ''}" loading="lazy" class="max-h-full max-w-full object-contain" src="${flagURL}" onerror="this.style.display='none'">
                </div>
                <div class="flex flex-col">
                  ${tournament.country ? `<span class="text-xs font-medium text-muted-foreground">${tournament.country}</span>` : ''}
                  <h3 class="font-bold text-xs sm:text-sm">${tournament.name}</h3>
                </div>
              </div>
            </div>
          </div>
          <div class="card__content p-0" data-slot="card-content">
            <div class="p-0 m-0 gap-0">
              ${sortedEvents.map(e => renderMatch(e)).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Get or create matches container
  function getMatchesContainer() {
    let container = document.getElementById("matchesContainer");
    if (!container) {
      // Find the filters card and add matches container after it
      const filtersCard = document.querySelector('.card');
      if (filtersCard && filtersCard.parentElement) {
        container = document.createElement('div');
        container.id = 'matchesContainer';
        container.className = 'space-y-4';
        filtersCard.insertAdjacentElement('afterend', container);
      }
    }
    return container;
  }

  // Count events by status
  function countEventsByStatus(tournaments, customEvents) {
    const counts = { live: 0, finished: 0, upcoming: 0 };

    // Count Flashscore events
    if (tournaments) {
      Object.values(tournaments).forEach(tourn => {
        tourn.events.forEach(e => {
          if (e.status === "inprogress") counts.live++;
          else if (e.status === "finished") counts.finished++;
          else if (e.status === "notstarted") counts.upcoming++;
        });
      });
    }

    // Count custom events
    if (customEvents && Array.isArray(customEvents)) {
      customEvents.forEach(e => {
        if (e.status === "inprogress") counts.live++;
        else if (e.status === "finished") counts.finished++;
        else if (e.status === "notstarted") counts.upcoming++;
      });
    }

    return counts;
  }

  // Setup filter buttons
  function setupFilters(counts) {
    const allBtn = document.getElementById("filterAll");
    const liveBtn = document.getElementById("filterLive");
    const finBtn = document.getElementById("filterFinished");
    const upBtn = document.getElementById("filterUpcoming");
    const liveCount = document.getElementById("liveCount");

    // Update live count badge
    if (liveCount) {
      liveCount.textContent = counts.live > 0 ? counts.live : '';
      liveCount.style.display = counts.live > 0 ? 'inline-block' : 'none';
    }

    // Show/hide filters based on data availability
    const hasData = counts.live > 0 || counts.finished > 0 || counts.upcoming > 0;
    setStatusFiltersVisible(hasData);

    if (!hasData) return;

    // Ensure initial state is correct (ALL active, others inactive)
    if (allBtn && !allBtn.dataset.filterBound) {
      allBtn.setAttribute("aria-pressed", "true");
      allBtn.classList.remove("button--tertiary", "button--primary-soft", "button--danger", "button--danger-soft");
      allBtn.classList.add("button--primary");
    }
    if (liveBtn && !liveBtn.dataset.filterBound) {
      liveBtn.setAttribute("aria-pressed", "false");
      liveBtn.classList.remove("button--danger-soft", "button--primary-soft", "button--primary", "button--danger");
      liveBtn.classList.add("button--tertiary");
    }
    if (finBtn && !finBtn.dataset.filterBound) {
      finBtn.setAttribute("aria-pressed", "false");
      finBtn.classList.remove("button--danger-soft", "button--primary-soft", "button--primary", "button--danger");
      finBtn.classList.add("button--tertiary");
    }
    if (upBtn && !upBtn.dataset.filterBound) {
      upBtn.setAttribute("aria-pressed", "false");
      upBtn.classList.remove("button--danger-soft", "button--primary-soft", "button--primary", "button--danger");
      upBtn.classList.add("button--tertiary");
    }

    // Reset all filters to inactive state
    const resetAllFilters = () => {
      if (allBtn) {
        allBtn.setAttribute("aria-pressed", "false");
        allBtn.classList.remove("button--primary-soft", "button--danger-soft", "button--primary", "button--danger");
        allBtn.classList.add("button--tertiary");
      }
      if (liveBtn) {
        liveBtn.setAttribute("aria-pressed", "false");
        liveBtn.classList.remove("button--danger-soft", "button--primary-soft", "button--primary", "button--danger");
        liveBtn.classList.add("button--tertiary");
      }
      if (finBtn) {
        finBtn.setAttribute("aria-pressed", "false");
        finBtn.classList.remove("button--primary-soft", "button--danger-soft", "button--primary", "button--danger");
        finBtn.classList.add("button--tertiary");
      }
      if (upBtn) {
        upBtn.setAttribute("aria-pressed", "false");
        upBtn.classList.remove("button--primary-soft", "button--danger-soft", "button--primary", "button--danger");
        upBtn.classList.add("button--tertiary");
      }
    };

    // Handle ALL button click
    const handleAllClick = () => {
      resetAllFilters();
      if (allBtn) {
        allBtn.setAttribute("aria-pressed", "true");
        allBtn.classList.remove("button--tertiary", "button--danger-soft", "button--primary-soft", "button--danger");
        allBtn.classList.add("button--primary");
      }
      applyFilters();
    };

    // Handle specific filter button click
    const handleFilterClick = (status, btn) => {
      const isPressed = btn.getAttribute("aria-pressed") === "true";

      if (isPressed) {
        // If clicking an active filter, switch back to ALL
        handleAllClick();
        return;
      } else {
        // Deactivate ALL filters first
        resetAllFilters();

        // Activate only this filter
        btn.setAttribute("aria-pressed", "true");
        btn.classList.remove("button--tertiary", "button--primary-soft", "button--danger-soft", "button--primary", "button--danger");
        if (status === "live") {
          btn.classList.add("button--danger");
        } else {
          btn.classList.add("button--primary");
        }
      }

      applyFilters();
    };

    if (allBtn && !allBtn.dataset.filterBound) {
      allBtn.dataset.filterBound = "1";
      allBtn.addEventListener("click", handleAllClick);
    }

    if (liveBtn && !liveBtn.dataset.filterBound) {
      liveBtn.dataset.filterBound = "1";
      liveBtn.addEventListener("click", () => handleFilterClick("live", liveBtn));
    }

    if (finBtn && !finBtn.dataset.filterBound) {
      finBtn.dataset.filterBound = "1";
      finBtn.addEventListener("click", () => handleFilterClick("finished", finBtn));
    }

    if (upBtn && !upBtn.dataset.filterBound) {
      upBtn.dataset.filterBound = "1";
      upBtn.addEventListener("click", () => handleFilterClick("upcoming", upBtn));
    }
  }

  // Apply filters to visible matches
  function applyFilters() {
    const allBtn = document.getElementById("filterAll");
    const liveBtn = document.getElementById("filterLive");
    const finBtn = document.getElementById("filterFinished");
    const upBtn = document.getElementById("filterUpcoming");
    const searchInput = document.getElementById("matchSearch");

    let showAll = allBtn?.getAttribute("aria-pressed") === "true";
    const showLive = liveBtn?.getAttribute("aria-pressed") === "true";
    const showFinished = finBtn?.getAttribute("aria-pressed") === "true";
    const showUpcoming = upBtn?.getAttribute("aria-pressed") === "true";

    // If no filters are active (e.g. filters hidden on future dates), default to ALL.
    if (!showAll && !showLive && !showFinished && !showUpcoming) {
      showAll = true;
    }

    // Get search query
    const searchQuery = searchInput?.value.toLowerCase().trim() || '';

    const container = getMatchesContainer();
    if (!container) return;

    const tournaments = container.querySelectorAll('[data-tournament-id]');

    tournaments.forEach(tourn => {
      const tournamentName = tourn.querySelector('h3')?.textContent.toLowerCase() || '';
      const events = tourn.querySelectorAll('[data-event-id]');
      let visibleCount = 0;

      events.forEach(event => {
        const status = event.getAttribute('data-status');

        // Get team names from the match HTML
        const teamSpans = event.querySelectorAll('span.font-semibold.truncate');
        const homeTeam = teamSpans[0]?.textContent.toLowerCase() || '';
        const awayTeam = teamSpans[1]?.textContent.toLowerCase() || '';

        // Check status filter (search query bypasses status restriction)
        let matchesStatus = false;
        if (searchQuery) {
          matchesStatus = true;
        } else if (showAll) {
          // ALL shows all matches (live, upcoming, finished)
          matchesStatus = true;
        } else if (showLive && status === "inprogress") {
          matchesStatus = true;
        } else if (showFinished && status === "finished") {
          matchesStatus = true;
        } else if (showUpcoming && status === "notstarted") {
          matchesStatus = true;
        }

        // Check search filter
        let matchesSearch = true;
        if (searchQuery) {
          matchesSearch = homeTeam.includes(searchQuery) ||
                         awayTeam.includes(searchQuery) ||
                         tournamentName.includes(searchQuery);
        }

        const shouldShow = matchesStatus && matchesSearch;
        event.style.display = shouldShow ? '' : 'none';
        if (shouldShow) visibleCount++;
      });

      // Hide tournament if no visible events
      tourn.style.display = visibleCount > 0 ? '' : 'none';
    });
  }

  // Setup search functionality
  function setupSearch() {
    const searchInput = document.getElementById("matchSearch");
    const navInput = document.getElementById("navbarSearchInput");
    const mobileBtn = document.getElementById("mobileSearchBtn");

    // Sync navbar search with page search
    if (navInput && !navInput.dataset.searchBound) {
      navInput.dataset.searchBound = "1";
      navInput.removeAttribute("readonly");
      navInput.classList.remove("pointer-events-none");
      navInput.addEventListener("input", () => {
        if (searchInput) {
          searchInput.value = navInput.value;
          searchInput.dispatchEvent(new Event("input"));
        }
      });
      // Click container focuses input
      const container = navInput.closest("[data-slot='search-field']");
      if (container) {
        container.addEventListener("click", () => navInput.focus());
      }
    }

    // Ctrl+K keybinding
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (navInput) navInput.focus();
        else if (searchInput) searchInput.focus();
      }
    });

    // Mobile search toggle & input binding
    const mInput = document.getElementById("mobileSearchInput");
    if (mInput && !mInput.dataset.searchBound) {
      mInput.dataset.searchBound = "1";
      mInput.addEventListener("input", () => {
        if (searchInput) {
          searchInput.value = mInput.value;
          searchInput.dispatchEvent(new Event("input"));
        } else if (navInput) {
          navInput.value = mInput.value;
        }
        applyFilters();
      });
    }

    if (mobileBtn && !mobileBtn.dataset.searchBound) {
      mobileBtn.dataset.searchBound = "1";
      mobileBtn.addEventListener("click", () => {
        const wrap = document.getElementById("mobileSearchWrap");
        if (wrap) wrap.classList.toggle("hidden");
        if (mInput && wrap && !wrap.classList.contains("hidden")) mInput.focus();
      });
    }

    if (!searchInput || searchInput.dataset.searchBound) return;
    searchInput.dataset.searchBound = "1";

    // Use input event for real-time filtering
    searchInput.addEventListener("input", () => {
      const active = getActiveSport();
      if (active.id === "tv" || location.pathname === "/tv") {
        const query = searchInput.value.toLowerCase().trim();
        const grid = document.getElementById("tvChannelsGrid");
        if (grid) {
          const cards = grid.querySelectorAll("[data-channel-name]");
          cards.forEach(card => {
            const name = card.getAttribute("data-channel-name") || "";
            const cat = card.getAttribute("data-channel-category") || "";
            const matches = !query || name.includes(query) || cat.includes(query);
            card.style.display = matches ? "" : "none";
          });
        }
      } else {
        applyFilters();
      }
    });
  }
  let dayOffset = 0;

  function refreshDayLabelOnly() {
    const { label } = findControls();
    const dLocal = localDateAtOffset(dayOffset);
    if (label) label.textContent = dayLabel(dayOffset, dLocal);
  }

  async function refresh() {
    const { prev, next, label } = findControls();
    const { slug, sportId } = getActiveSport();

    // Check TV mode
    if (sportId === 99 || slug === "tv" || location.pathname === "/tv" || location.pathname.startsWith("/tv")) {
      const c = getMatchesContainer();
      if (c) await renderTVChannels(c);
      return;
    }

    dayOffset = clamp(dayOffset, MIN_OFFSET, MAX_OFFSET);

    const dLocal = localDateAtOffset(dayOffset);
    const ymd = ymdFromLocalDate(dLocal);

    if (label) label.textContent = dayLabel(dayOffset, dLocal);
    if (prev) prev.disabled = (dayOffset <= MIN_OFFSET);
    if (next) next.disabled = (dayOffset >= MAX_OFFSET);

    // Get or create matches container
    const container = getMatchesContainer();
    if (!container) return;

    // Show skeleton loading state
    container.innerHTML = createSkeletonHTML();

    try {
      // Fetch data from all sources (including user's available TV channels)
      const [fs, own] = await Promise.all([
        fetchFlashscore(sportId, dayOffset),
        fetchYourAPI(slug, ymd),
        fetchUserChannels(),
      ]);

      // Parse Flashscore data
      let flashData = { tournaments: {}, events: [] };
      if (fs.ok && fs.text) {
        flashData = parseFlashData(fs.text);
      }

      // Filter events to only include matches within the selected day (support multi-day / in-progress)
      const { startTs, endTs } = getDayBoundaries(dayOffset);
      Object.values(flashData.tournaments).forEach(tournament => {
        if (tournament.events) {
          tournament.events = tournament.events.filter(event => {
            const eventTs = parseInt(event.startTime) || 0;
            const endTsEvent = parseInt(event.endTime) || eventTs;
            if (dayOffset === 0 && (event.status === "inprogress" || event.id === "OjOKEBcN")) return true;
            if (eventTs <= endTs && endTsEvent >= startTs) return true;
            return eventTs >= startTs && eventTs <= endTs;
          });
        }
      });

      // Build set of manually added match IDs from user's database
      // API returns: { items: [{match_id: "FS:2B3cTTrm"}, {match_id: "CUST:...", ...}] }
      const manualMatchIds = new Set();
      const apiItems = (own.ok && own.json && own.json.items) ? own.json.items : [];

      apiItems.forEach(item => {
        if (item.match_id && item.match_id.startsWith("FS:")) {
          // Extract ID from "FS:2B3cTTrm" format
          const id = item.match_id.replace(/^FS:/, "");
          manualMatchIds.add(id);
        }
      });

      // Parse custom matches (CUST:, TIM:, TOP: or missing API items) from API items
      const flashEventIds = new Set(Object.values(flashData.tournaments).flatMap(t => (t.events || []).map(e => e.id)));
      const customMatches = parseCustomMatches(apiItems, flashEventIds);

      // Strict streamable filtering: ONLY retain matches that have confirmed stream sources!
      // If a match is not in manualMatchIds, it has NO streams from any provider, so remove it!
      if (manualMatchIds.size > 0) {
        Object.values(flashData.tournaments).forEach(tournament => {
          if (tournament.events) {
            tournament.events = tournament.events.filter(event => manualMatchIds.has(event.id));
          }
        });

        // Remove empty tournaments after filtering
        Object.keys(flashData.tournaments).forEach(tournId => {
          if (!flashData.tournaments[tournId].events || flashData.tournaments[tournId].events.length === 0) {
            delete flashData.tournaments[tournId];
          }
        });
      }

      // Filter custom matches by active sport if not "all"
      const activeCustomMatches = (slug === "all")
        ? customMatches
        : customMatches.filter(m => m.sport === slug);

      // Count events by status (including custom matches)
      const counts = countEventsByStatus(flashData.tournaments, activeCustomMatches);
      const hasAnyEvents = counts.live > 0 || counts.finished > 0 || counts.upcoming > 0;

      // Setup filters (only show if we have events for today/past)
      if (hasAnyEvents) {
        setupFilters(counts);
      } else {
        setStatusFiltersVisible(false);
      }

      // Render matches or empty state
      if (!hasAnyEvents) {
        container.innerHTML = createEmptyStateHTML();
      } else if (slug === "all") {
        // Group all streamable matches by sport category
        const sportCategories = [
          { id: 'football', name: 'Football', icon: '⚽' },
          { id: 'cricket', name: 'Cricket', icon: '🏏' },
          { id: 'basketball', name: 'Basketball', icon: '🏀' },
          { id: 'motorsport', name: 'Motorsport', icon: '🏎️' },
          { id: 'american-football', name: 'American Football', icon: '🏈' },
          { id: 'tennis', name: 'Tennis', icon: '🎾' },
          { id: 'hockey', name: 'Ice Hockey', icon: '🏒' },
          { id: 'mma', name: 'Combat & MMA', icon: '🥊' },
          { id: 'other', name: 'Other Sports', icon: '🏆' }
        ];

        let sectionsHTML = "";

        sportCategories.forEach(cat => {
          // Find Flashscore tournaments belonging to this sport, keeping only Live and Hot fixtures with streams
          const catTournaments = Object.values(flashData.tournaments).map(t => {
            const filteredEvents = (t.events || []).filter(e => {
              if (e.sport !== cat.id) return false;
              // Keep live matches or confirmed streamable fixtures for today
              return e.status === 'inprogress' || (manualMatchIds.has(e.id) && e.status !== 'finished');
            });
            return { ...t, events: filteredEvents };
          }).filter(t => t.events && t.events.length > 0);

          // Find custom matches belonging to this sport (only live and hot upcoming)
          const catCustom = activeCustomMatches.filter(m => m.sport === cat.id && m.status !== 'finished');

          const totalMatches = catTournaments.reduce((acc, t) => acc + (t.events ? t.events.length : 0), 0) + catCustom.length;
          if (totalMatches === 0) return;

          const liveCount = catTournaments.reduce((acc, t) => acc + (t.events ? t.events.filter(e => e.status === 'inprogress').length : 0), 0) +
                            catCustom.filter(m => m.status === 'inprogress').length;

          const liveBadge = liveCount > 0 ? `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white animate-pulse">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>${liveCount} LIVE
            </span>` : '';

          sectionsHTML += `
            <div class="mb-6 sport-section" data-sport="${cat.id}">
              <div class="flex items-center justify-between px-3 sm:px-4 py-2.5 mb-2.5 rounded-xl bg-surface border border-border/50 shadow-sm">
                <div class="flex items-center gap-2 sm:gap-2.5">
                  <span class="text-base sm:text-lg">${cat.icon}</span>
                  <h3 class="text-xs sm:text-sm font-bold text-foreground tracking-wide uppercase">${cat.name}</h3>
                </div>
                <div class="flex items-center gap-2">
                  ${liveBadge}
                  <span class="text-[11px] font-medium text-muted-foreground px-2 py-0.5 rounded-md bg-surface-secondary border border-border/30">${totalMatches} Matches</span>
                </div>
              </div>
          `;

          // Render Flashscore tournaments for this sport (live tournaments first)
          const sortedTournaments = [...catTournaments].sort((a, b) => {
            const aHasLive = a.events.some(e => e.status === 'inprogress');
            const bHasLive = b.events.some(e => e.status === 'inprogress');
            if (aHasLive && !bHasLive) return -1;
            if (!aHasLive && bHasLive) return 1;
            return 0;
          });

          sortedTournaments.forEach(t => {
            const sortedEvents = [...t.events].sort((a, b) => {
              if (a.status === 'inprogress' && b.status !== 'inprogress') return -1;
              if (a.status !== 'inprogress' && b.status === 'inprogress') return 1;
              return (parseInt(a.startTime) || 0) - (parseInt(b.startTime) || 0);
            });
            sectionsHTML += renderTournament(t, sortedEvents);
          });

          // Render custom matches for this sport
          if (catCustom.length > 0) {
            sectionsHTML += renderCustomMatches(catCustom);
          }

          sectionsHTML += `</div>`;
        });

        container.innerHTML = sectionsHTML;
        applyFilters();
        cacheLiveEvents(flashData.tournaments);
      } else {
        // Split tournaments by time slots and flatten into array
        const tournamentSlots = [];

        Object.entries(flashData.tournaments)
          .filter(([_, tourn]) => tourn.events && tourn.events.length > 0)
          .forEach(([tournId, tourn]) => {
            tourn.id = tournId;

            // Group events by 3-hour time slots
            const timeSlots = groupEventsByTimeSlot(tourn.events);

            // Create a tournament entry for each time slot
            Object.entries(timeSlots).forEach(([slotKey, slotEvents]) => {
              const earliestTime = Math.min(...slotEvents.map(e => parseInt(e.startTime) || Infinity));
              const hasLive = slotEvents.some(e => e.status === "inprogress");
              tournamentSlots.push({
                tournament: tourn,
                events: slotEvents,
                earliestTime: earliestTime,
                slotKey: slotKey,
                hasLive: hasLive
              });
            });
          });

        // Add custom matches as a special slot (no tournament header)
        if (activeCustomMatches.length > 0) {
          const customEarliestTime = Math.min(...activeCustomMatches.map(e => parseInt(e.startTime) || Infinity));
          const customHasLive = activeCustomMatches.some(e => e.status === "inprogress");
          tournamentSlots.push({
            tournament: null, // No tournament = custom matches
            events: activeCustomMatches,
            earliestTime: customEarliestTime,
            slotKey: "custom",
            hasLive: customHasLive,
            isCustom: true
          });
        }

        // Sort all tournament slots: live first, then by earliest start time
        tournamentSlots.sort((a, b) => {
          // Prioritize slots with live matches
          if (a.hasLive && !b.hasLive) return -1;
          if (!a.hasLive && b.hasLive) return 1;
          // If both have live or both don't, sort by earliest time
          return a.earliestTime - b.earliestTime;
        });

        // Render all tournament slots
        const tournamentsHTML = tournamentSlots
          .map(slot => {
            if (slot.isCustom) {
              return renderCustomMatches(slot.events);
            }
            return renderTournament(slot.tournament, slot.events);
          })
          .join('');

        container.innerHTML = tournamentsHTML;

        // Apply any active filters
        applyFilters();

        // Cache live events for real-time minute updates
        cacheLiveEvents(flashData.tournaments);
      }
    } catch (err) {
      console.error("Error refreshing matches:", err);
      container.innerHTML = createEmptyStateHTML();
    }

    // Start/restart auto-refresh based on current day
    startLiveRefresh();
  }

  function bind() {
    const { prev, next } = findControls();

    if (prev && !prev.dataset.bound) {
      prev.dataset.bound = "1";
      prev.addEventListener("click", (e) => { e.preventDefault(); dayOffset--; refresh(); });
    }
    if (next && !next.dataset.bound) {
      next.dataset.bound = "1";
      next.addEventListener("click", (e) => { e.preventDefault(); dayOffset++; refresh(); });
    }
  }

  // ============================================
  // LIVE UPDATES (API Polling + Client-side Time)
  // ==============================================
  // Note: WebSocket not available due to Flashscore origin restrictions
  // Using 60-second API polling instead for live score updates

  let liveEventsCache = {}; // Store live event data for minute calculations
  let refreshInterval = null;
  const REFRESH_INTERVAL_MS = 60000; // 60 seconds

  // Start auto-refresh for live updates (polls API every 60 seconds)
  function startLiveRefresh() {
    // Only refresh if viewing today (dayOffset === 0)
    if (dayOffset !== 0) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
      return;
    }

    // Clear any existing interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    // Set up 60-second refresh
    refreshInterval = setInterval(() => {
      if (dayOffset === 0) {
        refresh();
      }
    }, REFRESH_INTERVAL_MS);
  }

  // Update live match minutes every second (client-side calculation)
  function startMinuteUpdater() {
    setInterval(() => {
      // Find all live match elements
      const liveMatches = document.querySelectorAll('[data-status="inprogress"]');

      liveMatches.forEach(matchEl => {
        const eventId = matchEl.dataset.eventId;
        const cachedEvent = liveEventsCache[eventId];

        if (cachedEvent) {
          const newMinute = calculateLiveMinute(cachedEvent);

          // Update desktop badge
          const desktopBadge = matchEl.querySelector('.hidden.sm\\:block .font-bold');
          if (desktopBadge && !desktopBadge.textContent.includes('HT')) {
            const minuteText = desktopBadge.innerHTML;
            // Extract and update just the minute part
            desktopBadge.innerHTML = minuteText.replace(/(\d+'\+?|LIVE)/, newMinute || 'LIVE');
          }

          // Update mobile badge
          const mobileBadge = matchEl.querySelector('.sm\\:hidden .font-bold');
          if (mobileBadge && !mobileBadge.textContent.includes('HT')) {
            const minuteText = mobileBadge.innerHTML;
            mobileBadge.innerHTML = minuteText.replace(/(\d+'\+?|LIVE)/, newMinute || 'LIVE');
          }
        }
      });
    }, 1000); // Update every second
  }

  // Cache live events after rendering for real-time updates
  function cacheLiveEvents(tournaments) {
    liveEventsCache = {}; // Clear cache

    Object.values(tournaments).forEach(tournament => {
      if (tournament.events) {
        tournament.events.forEach(event => {
          if (event.status === "inprogress") {
            liveEventsCache[event.id] = { ...event };
          }
        });
      }
    });
  }

  function setupSpanavigation() {
    function navigate(pathname, search) {
      const targetPath = (pathname.replace(/\/+$/, "") || "/");
      const currentPath = (window.location.pathname.replace(/\/+$/, "") || "/");
      const q = search || "";
      if (currentPath !== targetPath || window.location.search !== q) {
        window.history.pushState(null, "", targetPath + q);
      }
      if (typeof window.renderDesktopSports === "function") {
        try { window.renderDesktopSports(); } catch (e) { console.warn("renderDesktopSports err:", e); }
      }
      if (typeof window.renderMobileSports === "function") {
        try { window.renderMobileSports(); } catch (e) { console.warn("renderMobileSports err:", e); }
      }
      refresh();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.asNavigate = navigate;

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a || !a.href) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      try {
        const url = new URL(a.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const p = url.pathname.replace(/\/+$/, "") || "/";
        const isSportOrTv = p === "/" || p === "/all" || p === "/tv" || p.startsWith("/sports/");
        if (isSportOrTv) {
          e.preventDefault();
          navigate(p, url.search);
        }
      } catch (err) {
        console.error("SPA nav err:", err);
      }
    });

    window.addEventListener("popstate", () => {
      if (typeof window.renderDesktopSports === "function") {
        try { window.renderDesktopSports(); } catch (e) {}
      }
      if (typeof window.renderMobileSports === "function") {
        try { window.renderMobileSports(); } catch (e) {}
      }
      refresh();
    });
  }

  function init() {
    bind();
    setupSearch();
    setupSpanavigation();
    if (typeof window.renderDesktopSports === "function") {
      try { window.renderDesktopSports(); } catch (e) {}
    }
    if (typeof window.renderMobileSports === "function") {
      try { window.renderMobileSports(); } catch (e) {}
    }
    refresh(); // This calls startLiveRefresh() at the end

    // Start client-side minute updater
    startMinuteUpdater();

    // Update only the "Today / Yesterday / Tomorrow" label when language changes
    document.addEventListener("langchange", refreshDayLabelOnly);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ============================================
  // 24/7 TV CHANNELS & MODAL PLAYER
  // ============================================
  window.renderTVChannels = async function renderTVChannels(container) {
    window.isRenderingTV = true;
    const { prev, next, label } = findControls();
    if (label) label.textContent = "24/7 Live TV Channels";
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;

    setStatusFiltersVisible(false);
    container.innerHTML = createSkeletonHTML();

    let channels = [];
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const json = await res.json();
        channels = json.items || [];
      }
    } catch (e) {}

    if (!channels.length) {
      try {
        const res2 = await fetch("/assets/channels.json");
        if (res2.ok) {
          const json2 = await res2.json();
          channels = json2["24/7 Channels"] || [];
        }
      } catch (e2) {}
    }

    window.allTVChannels = channels;
    renderChannelsGrid(container, channels);
  }

  function renderChannelsGrid(container, channels) {
    if (!channels || channels.length === 0) {
      container.innerHTML = `
        <div class="card card--default p-8 text-center text-muted-foreground">
          No TV channels available at the moment.
        </div>
      `;
      return;
    }

    let html = `
      <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4" id="tvChannelsGrid">
    `;

    channels.forEach(ch => {
      const poster = ch.poster || "/assets/favicon-96x96.png";
      const name = ch.name || "Live Channel";
      const category = ch.category || "24/7 Channel";

      html += `
        <div class="card card--default overflow-hidden group hover:border-primary/50 transition-all duration-200 cursor-pointer flex flex-col justify-between"
             data-channel-id="${ch.id}" data-channel-name="${name.toLowerCase()}" data-channel-category="${category.toLowerCase()}"
             onclick="openChannelPlayer('${ch.id}')">
          <div class="p-2.5 sm:p-4 flex flex-col items-center text-center">
            <div class="w-full h-24 sm:h-32 flex items-center justify-center bg-surface-secondary/60 rounded-xl p-2 sm:p-3 overflow-hidden mb-2 sm:mb-3 border border-border/30">
              <img src="${poster}" alt="${name}" class="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                   loading="lazy" onerror="this.src='/assets/favicon-96x96.png'"/>
            </div>
            <div class="w-full">
              <div class="flex items-center justify-between gap-1 sm:gap-2 mb-1">
                <span class="text-[10px] sm:text-xs text-muted-foreground truncate">${category}</span>
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-red-600/20 text-red-400 border border-red-500/30 whitespace-nowrap">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>24/7
                </span>
              </div>
              <h4 class="font-bold text-foreground text-xs sm:text-sm truncate text-left group-hover:text-primary transition-colors">${name}</h4>
            </div>
          </div>
          <div class="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
            <button type="button" class="button button--sm button--primary w-full flex items-center justify-center gap-1.5 text-xs py-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-3.5 h-3.5">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              <span>Watch Now</span>
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  window.openChannelPlayer = function(channelId) {
    const channels = window.allTVChannels || [];
    const ch = channels.find(c => c.id === channelId);
    if (!ch) return;

    let modal = document.getElementById("channelPlayerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "channelPlayerModal";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm";
      document.body.appendChild(modal);
    }

    const streams = ch.streams || [{ name: "Stream 1", url: "#" }];
    const streamButtons = streams.map((s, idx) => `
      <button type="button" onclick="switchChannelStream('${s.url}', this)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold border ${idx === 0 ? 'bg-primary text-white border-primary' : 'bg-surface-secondary text-muted-foreground border-border hover:bg-surface-tertiary'} transition-all">
        ${s.name || 'Server ' + (idx + 1)}
      </button>
    `).join('');

    const initialUrl = streams[0]?.url || "";

    modal.innerHTML = `
      <div class="bg-surface border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-secondary/40">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/30">
              <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>LIVE
            </span>
            <h3 class="font-bold text-foreground text-base truncate">${ch.name}</h3>
          </div>
          <button type="button" onclick="closeChannelPlayer()" class="p-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-muted-foreground hover:text-foreground transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
          <iframe id="channelPlayerIframe" src="${initialUrl}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-border bg-surface-secondary/40 text-sm">
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted-foreground font-medium">Servers:</span>
            <div class="flex flex-wrap gap-2">
              ${streamButtons}
            </div>
          </div>
          <button type="button" onclick="togglePlayerFullscreen()" class="text-xs px-3 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border">
            Fullscreen
          </button>
        </div>
      </div>
    `;

    modal.onclick = function(e) {
      if (e.target === modal) window.closeChannelPlayer();
    };

    const handleEsc = function(e) {
      if (e.key === "Escape") {
        window.closeChannelPlayer();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  window.closeChannelPlayer = function() {
    const modal = document.getElementById("channelPlayerModal");
    if (modal) {
      const iframe = document.getElementById("channelPlayerIframe");
      if (iframe) iframe.src = "";
      modal.remove();
    }
    document.body.style.overflow = "";
  };

  window.switchChannelStream = function(url, btn) {
    const iframe = document.getElementById("channelPlayerIframe");
    if (iframe) iframe.src = url;
    if (btn && btn.parentElement) {
      btn.parentElement.querySelectorAll('button').forEach(b => {
        b.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold border bg-surface-secondary text-muted-foreground border-border hover:bg-surface-tertiary transition-all';
      });
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold border bg-primary text-white border-primary transition-all';
    }
  };

  window.togglePlayerFullscreen = function() {
    const iframe = document.getElementById("channelPlayerIframe");
    if (iframe) {
      if (iframe.requestFullscreen) iframe.requestFullscreen();
      else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
    }
  };

})();
