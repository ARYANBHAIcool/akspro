
(function () {
  "use strict";

  // ---------------------------
  // i18n CONFIG (JSON files)
  // ---------------------------
  const I18N_STORAGE_KEY = "lang";
  const DEFAULT_LANG = "en";
  const I18N_BASE = "/assets/i18n";
  const I18N_CACHE_VERSION = "v1";
  const BOUND_MARKER = "1";
  const BODY_SCROLL_LOCK_CLASS = "nav-lock";
  const PORTAL_Z_INDEX = 99999;
  const GEO_DONE_KEY = "geo_done";
  const COUNTRY_STORAGE_KEY = "user_country";

  // Flashscore API config
  const FLASH_BASE = "https://1.newsoccers.one/2/x/feed";
  const FLASH_GRAPHQL = "https://2.ds.lsapp.eu/pq_graphql";
  const FLASH_FSIGN = "SW9D1eZo";
  const FLASH_IMAGE_BASE = "https://static.flashscore.com/res/image/data";

  // Sport durations in minutes (for auto-calculating custom event status)
  const SPORT_DURATIONS = {
    football: 120,
    basketball: 150,
    hockey: 150,
    tennis: 180,
    volleyball: 120,
    handball: 90,
    futsal: 60,
    "american-football": 180,
    cricket: 240,
    darts: 90,
    snooker: 240,
    mma: 220,
    boxing: 60,
    motorsport: 150,
    "winter-sports": 90,
    cycling: 300,
    golf: 240,
    waterpolo: 90,
    default: 120
  };

  // in-memory cache
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
    lang = String(lang).toLowerCase();
    if (lang.startsWith("pl")) return "pl";
    if (lang.startsWith("pt")) return "pt";
    if (lang.startsWith("en")) return "en";
    return DEFAULT_LANG;
  }

  function countryToLang(cc) {
    cc = String(cc || "").toUpperCase();
    if (cc === "PL") return "pl";
    if (cc === "PT") return "pt";
    if (cc === "BR") return "pt";
    if (cc === "AO") return "pt";
    if (cc === "MZ") return "pt";
    return "en";
  }

  async function detectLangOnce() {
    const existing = safeLocalStorageGet(I18N_STORAGE_KEY);
    if (existing) return normalizeLang(existing);

    const done = safeLocalStorageGet(GEO_DONE_KEY);
    const saved = safeLocalStorageGet(I18N_STORAGE_KEY);
    if (done === BOUND_MARKER && saved) return normalizeLang(saved);

    let cc = "";
    try {
      const res = await fetch("/geo", { cache: "force-cache" });
      if (res.ok) {
        const j = await res.json();
        cc = (j && (j.country || j.cc || j.CF_IPCountry)) || "";
      }
    } catch (e) {
      console.warn("Failed to fetch geo location:", e);
    }

    const lang = normalizeLang(countryToLang(cc || ""));
    safeLocalStorageSet(I18N_STORAGE_KEY, lang);
    safeLocalStorageSet(GEO_DONE_KEY, BOUND_MARKER);

    if (cc) {
      safeLocalStorageSet(COUNTRY_STORAGE_KEY, cc);
    }

    return lang;
  }

  async function loadLangFile(lang) {
    lang = normalizeLang(lang);
    if (dict[lang]) return dict[lang];

    const lsKey = `i18n:${lang}:${I18N_CACHE_VERSION}`;

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
    const locale = lang === "pl" ? "pl-PL" : lang === "pt" ? "pt-PT" : "en-US";
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

    const langToCountry = {
      pl: "PL",
      pt: "PT",
      en: ""
    };
    const countryForLang = langToCountry[lang] || "";
    if (countryForLang) {
      safeLocalStorageSet(COUNTRY_STORAGE_KEY, countryForLang);
    }

    try {
      await loadLangFile("en");
    } catch (e) {
      console.warn("Failed to load EN fallback:", e);
    }

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
  // Expose i18n API
  // ---------------------------
  window.i18n = window.i18n || {};

  window.i18n.getLang = function () {
    return normalizeLang(getLang());
  };

  window.i18n.t = function (key, fallback) {
    const lang = normalizeLang(getLang());
    const val = t(lang, key);
    if (val) return val;
    if (fallback != null) return String(fallback);
    return String(key || "");
  };

  window.i18n.dayLabel = function (dayOffset, dateObj) {
    const lang = normalizeLang(getLang());

    if (dayOffset === -1) return t(lang, "day.yesterday") || "Yesterday";
    if (dayOffset === 0)  return t(lang, "day.today") || "Today";
    if (dayOffset === 1)  return t(lang, "day.tomorrow") || "Tomorrow";

    try {
      const locale = lang === "pl" ? "pl-PL" : lang === "pt" ? "pt-PT" : "en-US";
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
  // NAV config (sports)
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
  // Detect current sport from URL path
  // ---------------------------
  function getCurrentSportFromURL() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";

    // Check for match page pattern: /match/{sport}/{id}
    const matchPattern = path.match(/^\/match\/([^\/]+)/);
    if (matchPattern) {
      const sportName = matchPattern[1];
      const sport = SPORTS.find(s => s.id === sportName);
      if (sport) return sport;
    }

    // Try exact match
    let sport = SPORTS.find(s => s.href === path);
    if (sport) return sport;

    // Try /sports/sportname pattern
    const sportsMatch = path.match(/^\/sports\/([^\/]+)/);
    if (sportsMatch) {
      const sportName = sportsMatch[1];
      sport = SPORTS.find(s => s.id === sportName || s.href === `/sports/${sportName}`);
      if (sport) return sport;
    }

    // Fallback
    sport = SPORTS.find(s => s.href !== "/" && path.startsWith(s.href));
    if (sport) return sport;

    return SPORTS[0];
  }

  const CURRENT_SPORT = getCurrentSportFromURL();

  // ---------------------------
  // Country-specific sports ordering
  // ---------------------------
  function getCountrySpecificSports(country) {
    const cc = String(country || "").toUpperCase();
    const sportsCopy = SPORTS.map(s => ({ ...s }));

    const countryPriorities = {
      PT: { futsal: 2, basketball: 3, volleyball: 1 },
      PL: { volleyball: 1, "winter-sports": 5, basketball: 2, handball: 4 },
      BR: { futsal: 1, volleyball: 2, basketball: 3 }
    };

    const priorities = countryPriorities[cc];
    if (!priorities) return sportsCopy;

    const reordered = [];
    const remaining = [...sportsCopy];

    // Always keep top pinned: 'all', 'football', 'tv', 'cricket', 'basketball'
    ['all', 'football', 'tv', 'cricket', 'basketball'].forEach(topId => {
      const idx = remaining.findIndex(s => s.id === topId);
      if (idx !== -1) {
        reordered.push(remaining.splice(idx, 1)[0]);
      }
    });

    const sortedByPriority = Object.entries(priorities)
      .sort(([, a], [, b]) => a - b)
      .map(([sportId]) => sportId);

    sortedByPriority.forEach(sportId => {
      const idx = remaining.findIndex(s => s.id === sportId);
      if (idx !== -1) {
        reordered.push(remaining.splice(idx, 1)[0]);
      }
    });

    reordered.push(...remaining);
    return reordered;
  }

  function getUserCountry() {
    return safeLocalStorageGet(COUNTRY_STORAGE_KEY) || "";
  }

  // Expose globals
  window.SPORTS_CONFIG = SPORTS;
  window.CURRENT_SPORT = CURRENT_SPORT;
  window.getCountrySpecificSports = getCountrySpecificSports;
  window.getUserCountry = getUserCountry;

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
    return CURRENT_SPORT;
  }

  function sportLabel(lang, sport) {
    return t(lang, sport.key) || sport.id;
  }

  // ---------------------------
  // Desktop "More" overflow
  // ---------------------------
  function renderDesktopSports() {
    const row = document.getElementById("sportsRow");
    const moreWrap = document.getElementById("moreWrap");
    if (!row || !moreWrap) return;

    const lang = normalizeLang(getLang());
    const active = getActiveSport();
    const country = getUserCountry();
    const sportsToShow = getCountrySpecificSports(country);

    const existingItems = row.querySelectorAll(".sport-item:not(#moreWrap)");
    existingItems.forEach(item => item.remove());

    sportsToShow.forEach((s) => {
      const name = sportLabel(lang, s);
      const isActive = s.id === active.id;
      let html = "";

      if (s.enabled) {
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

    if (moreMenu.parentElement !== portal) portal.appendChild(moreMenu);

    moreMenu.style.display = "block";
    moreMenu.style.position = "relative";
    moreMenu.style.marginTop = "0";
    moreMenu.style.right = "auto";

    function placePortal() {
      const r = moreBtn.getBoundingClientRect();
      const gap = 8;
      const menuW = moreMenu.offsetWidth || 224;
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
    window.addEventListener("scroll", () => { if (isOpen()) placePortal(); }, true);

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

    document.addEventListener("langchange", () => {
      requestAnimationFrame(() => {
        renderDesktopSports();
        recalcOverflow();
      });
    });

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

    menu.addEventListener("click", (e) => e.stopPropagation());
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

  // ===========================================================================
  // MATCH PAGE - Flashscore Integration
  // ===========================================================================

  // Extract match ID from URL
  // Primary pattern: /match/{sport}/{id}
  function getMatchIDFromURL() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    // Pattern: /match/{sport}/{id} (e.g., /match/football/ABC123)
    if (parts[0] === 'match' && parts.length >= 3) {
      return parts[2];
    }

    // Fallback: /match/{id}
    if (parts[0] === 'match' && parts.length >= 2) {
      return parts[1];
    }

    return null;
  }

  // Extract sport from URL
  // Pattern: /match/{sport}/{id}
  function getSportFromURL() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);

    // Pattern: /match/{sport}/{id}
    if (parts[0] === 'match' && parts.length >= 2) {
      const sportName = parts[1];
      const sport = SPORTS.find(s => s.id === sportName);
      if (sport) return sport;
    }

    return SPORTS.find(s => s.id === "football") || SPORTS[1]; // Default to football
  }

  // Parse Flashscore response format (key÷value¬)
  function parseFlashscoreResponse(text) {
    const data = {};
    text.split('¬').forEach(item => {
      const [key, value] = item.split('÷');
      if (key && value !== undefined) {
        data[key] = value;
      }
    });
    return data;
  }

  // Format Unix timestamp to readable date/time
  function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const lang = normalizeLang(getLang());
    const locale = lang === "pl" ? "pl-PL" : lang === "pt" ? "pt-PT" : "en-US";

    const timeStr = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
    const dateStr = date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

    return { time: timeStr, date: dateStr, full: `${dateStr} ${timeStr}` };
  }

  // Get status text from DA code
  function getStatusText(da, dc, timestamp) {
    if (da === "2") return "LIVE";
    if (da === "3") return "FT";
    if (da === "1") {
      const dt = formatDateTime(timestamp);
      return dt.time;
    }
    return "—";
  }

  // Get status badge class
  function getStatusBadgeClass(da) {
    if (da === "2") return "bg-[#d3090d] text-white"; // Live - red
    if (da === "3") return "bg-surface-secondary text-secondary-foreground"; // Finished
    return "bg-surface-secondary text-secondary-foreground"; // Not started
  }

  // Store match data globally for refreshing
  let currentMatchData = null;
  let refreshInterval = null;
  let broadcastRefreshInterval = null;
  let preMatchRefreshInterval = null;

  // Helper to check if match ID is custom event
  function isCustomEvent(matchID) {
    if (!matchID) return false;
    return matchID.startsWith("CUST:") ||
           matchID.startsWith("TIM:") ||
           matchID.startsWith("TOP:") ||
           /^[a-z]+-\d{8}-\d+$/i.test(matchID) ||
           /^[a-z0-9]+-\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(matchID);
  }

  // Calculate status for custom event based on start time and either an
  // explicit end_ts (preferred, set in admin form for CUST: events) or
  // a sport-default duration fallback.
  function calculateCustomEventStatus(startTs, sport, endTsOverride) {
    const now = Math.floor(Date.now() / 1000);
    let endTs;
    if (endTsOverride && endTsOverride > 0) {
      endTs = endTsOverride;
    } else {
      const durationMin = SPORT_DURATIONS[sport] || SPORT_DURATIONS.default;
      endTs = startTs + (durationMin * 60);
    }

    if (now < startTs) {
      return "1"; // not started
    } else if (now >= startTs && now < endTs) {
      return "2"; // live
    } else {
      return "3"; // finished
    }
  }

  // Fetch custom event data from our API
  async function fetchCustomEventData(matchID) {
    try {
      const spObj = getSportFromURL();
      const sp = (spObj && spObj.id && spObj.id !== 'all' && spObj.id !== 'tv') ? spObj.id : "";
      const url = `/api/v1/match/${encodeURIComponent(matchID)}${sp ? `?sport=${encodeURIComponent(sp)}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch custom event");

      const data = await response.json();

      // Calculate status based on start time and sport duration
      const status = calculateCustomEventStatus(data.start_ts, data.sport, data.end_ts);

      // Parse the name - might have " - " separator or not
      let homeName = data.name || "Event";
      let awayName = "";
      if (data.name && data.name.includes(" - ")) {
        const parts = data.name.split(" - ");
        homeName = parts[0].trim();
        awayName = parts[1]?.trim() || "";
      }

      return {
        matchID: data.match_id,
        sport: data.sport,
        startTs: data.start_ts,
        name: data.name,
        homeName,
        awayName,
        status,
        channels: data.channels || [],
        customUrls: data.custom_urls || [],
        isCustomEvent: true
      };
    } catch (e) {
      console.error("fetchCustomEventData error:", e);
      return null;
    }
  }

  // Robust Feed fetch with ultra-fast edge proxy first (prevents 10-15s CORS hang)
  async function fetchFlashFeed(path, signal) {
    try {
      const res = await fetch(`/api/feed?path=${encodeURIComponent(path)}`, { signal: signal });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 0) return text;
      }
    } catch (e) {}

    try {
      const res2 = await fetch(`${FLASH_BASE}/${path}`, {
        headers: { "X-Fsign": FLASH_FSIGN },
        signal: signal
      });
      if (res2.ok) return await res2.text();
    } catch (e2) {}

    return null;
  }
  async function fetchMatchData(matchID) {
    try {
      const text = await fetchFlashFeed(`dc_1_${matchID}`);
      if (!text) throw new Error("Failed to fetch match data");
      const data = parseFlashscoreResponse(text);

      return {
        status: data.DA,           // 1=not started, 2=live, 3=finished
        statusCode: data.DC,       // detailed status
        timestamp: data.DC,        // start time (DC=kickoff; DD stale/end)
        homeScore: data.DE || "",  // home score
        awayScore: data.DF || "",  // away score
        raw: data
      };
    } catch (e) {
      console.error("fetchMatchData error:", e);
      return null;
    }
  }

  // Fetch match info (referee, venue, capacity)
  async function fetchMatchInfo(matchID) {
    try {
      const text = await fetchFlashFeed(`df_sui_1_${matchID}`);
      if (!text) return {};

      // Parse MIT÷key¬MIV÷value format
      const keyValueRegex = /MIT÷(.*?)¬MIV÷(.*?)(?=¬|$)/g;
      let match;
      const info = {};
      while ((match = keyValueRegex.exec(text)) !== null) {
        info[match[1]] = match[2];
      }

      return info;
    } catch (e) {
      console.error("fetchMatchInfo error:", e);
      return {};
    }
  }

  // Parse TV channel TVI IDs from Flashscore AL field (same approach as main.js)
  function parseTvChannelIds(alField) {
    if (!alField) return [];
    try {
      const parsed = JSON.parse(alField);
      return (parsed["1"] || [])
        .filter(ch => ch && ch.TVI)
        .map(ch => String(ch.TVI));
    } catch (e) {
      return [];
    }
  }

  // Fetch TV channel TVI IDs from Flashscore endpoint (with timeout to prevent stalls)
  async function fetchFlashscoreTVI(matchID) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const text = await fetchFlashFeed(`df_dos_1_${matchID}_`, controller.signal);
      clearTimeout(timer);
      if (!text) return [];

      // Extract AL field with JSON: AL÷{"1":[{TVI:id, BN:name, ...}]}
      const alMatch = text.match(/AL÷(\{[^¬]+\})/);
      if (!alMatch) return [];

      return parseTvChannelIds(alMatch[1]);
    } catch (e) {
      return [];
    }
  }

  // Fetch local API channels (disabled like Dzeko so dummy non-working rights-holder channels are never shown)
  async function fetchLocalChannels() {
    return [];
  }

  // Fetch match-specific channel overrides from local API
  async function fetchMatchChannelOverrides(matchID) {
    try {
      const spObj = getSportFromURL();
      const sp = (spObj && spObj.id) ? spObj.id : "";
      const url = `/api/v1/match/${encodeURIComponent(matchID)}${sp ? `?sport=${encodeURIComponent(sp)}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) return null;

      const json = await response.json();
      return {
        channels: json.channels || [],
        customUrls: json.custom_urls || []
      };
    } catch (e) {
      console.error("fetchMatchChannelOverrides error:", e);
      return null;
    }
  }

  // Extract TVI number from "TVI1021" or "1021" format
  function extractTviNumber(id) {
    if (!id) return "";
    const str = String(id);
    const match = str.match(/^TVI?(\d+)$/i);
    return match ? match[1] : str;
  }

  // Merge Flashscore TVI IDs with local channels and overrides
  // tvChannelIds: array of TVI IDs from Flashscore (e.g., ["1037", "2569"])
  // localChannels: array from channels (e.g., [{id, FS: "TVI1037", name, alpha2}])
  // matchOverrides: {channels: [{id: "TVI1021", enabled: true/false}], customUrls: [...]}
  function mergeChannels(tvChannelIds, localChannels, matchOverrides) {
    const channels = [];
    const customUrls = [];
    const addedTviIds = new Set();

    // Build map of TVI number -> local channel (extract number from "TVI1037")
    const localChannelByTviId = {};
    for (const ch of localChannels) {
      if (ch.FS) {
        const tviNum = extractTviNumber(ch.FS);
        if (tviNum) {
          localChannelByTviId[tviNum] = ch;
        }
      }
    }

    // Build override lookup by TVI number (extract from "TVI1021" -> "1021")
    const overrideByTviId = {};
    if (matchOverrides?.channels) {
      for (const ch of matchOverrides.channels) {
        const tviNum = extractTviNumber(ch.id);
        if (tviNum) {
          overrideByTviId[tviNum] = ch;
        }
      }
    }

    // Process Flashscore TVI IDs
    for (const tviId of tvChannelIds) {
      const tviNum = extractTviNumber(tviId);
      const localCh = localChannelByTviId[tviNum];
      if (!localCh) continue; // Not in our database

      if (addedTviIds.has(tviNum)) continue; // Already added

      // Check override - if explicitly disabled, skip
      const override = overrideByTviId[tviNum];
      if (override && override.enabled === false) continue;

      addedTviIds.add(tviNum);
      channels.push({
        id: String(localCh.id),
        tviId: tviNum,
        name: localCh.name,
        country: localCh.alpha2 || "",
        source: "flashscore"
      });
    }

    // Add enabled channels from overrides
    if (matchOverrides?.channels) {
      for (const ch of matchOverrides.channels) {
        const tviNum = extractTviNumber(ch.id);
        const localCh = tviNum ? localChannelByTviId[tviNum] : null;

        if (localCh && !addedTviIds.has(tviNum)) {
          addedTviIds.add(tviNum);
          channels.push({
            id: String(localCh.id),
            tviId: tviNum,
            name: localCh.name,
            country: localCh.alpha2 || "",
            streamUrl: ch.streamUrl || null,
            source: "manual"
          });
        } else if (!channels.some(c => c.name.toLowerCase() === ch.name.toLowerCase())) {
          channels.push({
            id: String(ch.id || `ch-${channels.length + 1}`),
            tviId: tviNum || "",
            name: ch.name,
            country: ch.country || "",
            streamUrl: ch.streamUrl || null,
            source: ch.source || "override"
          });
        }
      }
    }

    // Add enabled custom URLs
    if (matchOverrides?.customUrls) {
      for (const url of matchOverrides.customUrls) {
        if (url.enabled !== false) {
          customUrls.push({
            id: url.id,
            name: url.name,
            url: url.url
          });
        }
      }
    }

    // Sort channels by country then name
    channels.sort((a, b) => {
      if (a.country !== b.country) return a.country.localeCompare(b.country);
      return a.name.localeCompare(b.name);
    });

    return { channels, customUrls };
  }

  // Fetch team data via GraphQL
  async function fetchTeamData(matchID) {
    try {
      const url = `${FLASH_GRAPHQL}?_hash=dsof&eventId=${matchID}&projectId=2`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to fetch team data");

      const json = await response.json();
      const event = json.data?.findEventById;

      if (!event) return null;

      const homeParticipant = event.eventParticipants?.find(p => p.type?.side === "HOME");
      const awayParticipant = event.eventParticipants?.find(p => p.type?.side === "AWAY");

      const homeTeam = homeParticipant?.participants?.[0]?.participant;
      const awayTeam = awayParticipant?.participants?.[0]?.participant;

      return {
        home: {
          name: homeParticipant?.name || "Home",
          image: homeTeam?.images?.[1]?.path ? `${FLASH_IMAGE_BASE}/${homeTeam.images[1].path}` : null,
          id: homeTeam?.id
        },
        away: {
          name: awayParticipant?.name || "Away",
          image: awayTeam?.images?.[1]?.path ? `${FLASH_IMAGE_BASE}/${awayTeam.images[1].path}` : null,
          id: awayTeam?.id
        },
        tournament: event.tournament,
        season: event.season
      };
    } catch (e) {
      console.error("fetchTeamData error:", e);
      return null;
    }
  }

  // Slugify helper for URLs
  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Render match page
  function renderMatchPage(container, teamData, matchData, matchInfo) {
    if (!container) return;

    const lang = normalizeLang(getLang());
    const sport = CURRENT_SPORT;
    const sportName = sportLabel(lang, sport);

    const homeName = teamData?.home?.name || "Home Team";
    const awayName = teamData?.away?.name || "Away Team";
    const homeImg = teamData?.home?.image || "/assets/img/team-placeholder.png";
    const awayImg = teamData?.away?.image || "/assets/img/team-placeholder.png";
    const homeId = teamData?.home?.id || "";
    const awayId = teamData?.away?.id || "";

    // Team URLs
    const homeSlug = slugify(homeName);
    const awaySlug = slugify(awayName);
    const homeUrl = homeId ? `/${sport.id}/team/${homeId}/${homeSlug}` : "#";
    const awayUrl = awayId ? `/${sport.id}/team/${awayId}/${awaySlug}` : "#";

    // Tournament/League info
    const tournament = teamData?.tournament;
    const leagueName = tournament?.name || "";
    const countryName = tournament?.category?.name || "";
    const leagueSlug = slugify(leagueName);
    const countrySlug = slugify(countryName);
    const leagueId = tournament?.id || "";
    const leagueUrl = leagueId ? `/${sport.id}/league/${leagueId}/${leagueSlug}` : "#";
    const countryUrl = countrySlug ? `/${sport.id}/country/${countrySlug}` : "#";

    const homeScore = matchData?.homeScore || "";
    const awayScore = matchData?.awayScore || "";
    const status = matchData?.status || "1";
    const timestamp = matchData?.timestamp;

    const statusText = getStatusText(status, matchData?.statusCode, timestamp);
    const statusBadgeClass = getStatusBadgeClass(status);
    const dt = timestamp ? formatDateTime(timestamp) : { time: "", date: "", full: "" };

    // Score display: show scores if finished or live, else show time
    const showScores = status === "2" || status === "3";
    const scoreDisplay = showScores
      ? `<div class="flex items-center gap-1 sm:gap-2 md:gap-4">
           <span class="text-2xl sm:text-3xl md:text-5xl font-bold tabular-nums">${homeScore}</span>
           <span class="text-xl sm:text-2xl md:text-3xl text-muted-foreground font-light">-</span>
           <span class="text-2xl sm:text-3xl md:text-5xl font-bold tabular-nums">${awayScore}</span>
         </div>`
      : `<div class="text-xl sm:text-2xl md:text-4xl font-semibold">${dt.time}</div>`;

    // Match info from API
    const venue = matchInfo?.VEN || "";
    const referee = matchInfo?.REF || "";
    const capacity = matchInfo?.CAP || "";
    const stadium = matchInfo?.STADIUM || venue.split("¬")[0] || "";
    const location = matchInfo?.LOCATION || venue.split("¬")[1] || "";
    const address = matchInfo?.ADDRESS || "";
    const surface = matchInfo?.SURFACE || "";
    const round = matchInfo?.ROUND || "";

    // Translation keys for labels
    const lblStadium = t(lang, "match.stadium") || "Stadium";
    const lblCapacity = t(lang, "match.capacity") || "Capacity";
    const lblDate = t(lang, "match.date") || "Date";
    const lblReferee = t(lang, "match.referee") || "Referee";
    const lblStatus = t(lang, "match.status") || "Status";
    const lblNotStarted = t(lang, "match.notStarted") || "Not Started";
    const lblLive = t(lang, "match.live") || "Live";
    const lblFinished = t(lang, "match.finished") || "Full Time";

    // Build match details items
    const detailItems = [];

    if (stadium) {
      detailItems.push(`
        <div class="flex flex-row items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 mr-3 text-muted-foreground">
            <path d="M7 18C5.17107 18.4117 4 19.0443 4 19.7537C4 20.9943 7.58172 22 12 22C16.4183 22 20 20.9943 20 19.7537C20 19.0443 18.8289 18.4117 17 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
            <path d="M14.5 9C14.5 10.3807 13.3807 11.5 12 11.5C10.6193 11.5 9.5 10.3807 9.5 9C9.5 7.61929 10.6193 6.5 12 6.5C13.3807 6.5 14.5 7.61929 14.5 9Z" stroke="currentColor" stroke-width="1.5"></path>
            <path d="M13.2574 17.4936C12.9201 17.8184 12.4693 18 12.0002 18C11.531 18 11.0802 17.8184 10.7429 17.4936C7.6543 14.5008 3.51519 11.1575 5.53371 6.30373C6.6251 3.67932 9.24494 2 12.0002 2C14.7554 2 17.3752 3.67933 18.4666 6.30373C20.4826 11.1514 16.3536 14.5111 13.2574 17.4936Z" stroke="currentColor" stroke-width="1.5"></path>
          </svg>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-muted-foreground" data-i18n="match.stadium">${lblStadium}</span>
            <span class="text-sm">${stadium}</span>
          </div>
        </div>
      `);
    }

    if (capacity) {
      detailItems.push(`
        <div class="flex flex-row items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 mr-3 text-muted-foreground">
            <path d="M15 8C15 9.65685 13.6569 11 12 11C10.3431 11 9 9.65685 9 8C9 6.34315 10.3431 5 12 5C13.6569 5 15 6.34315 15 8Z" stroke="currentColor" stroke-width="1.5"></path>
            <path d="M13.7143 14H10.2857C7.91876 14 5.99998 15.9188 5.99998 18.2857C5.99998 19.2325 6.76749 20 7.71426 20H16.2857C17.2325 20 18 19.2325 18 18.2857C18 15.9188 16.0812 14 13.7143 14Z" stroke="currentColor" stroke-width="1.5"></path>
          </svg>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-muted-foreground" data-i18n="match.capacity">${lblCapacity}</span>
            <span class="text-sm">${capacity}</span>
          </div>
        </div>
      `);
    }

    if (timestamp) {
      detailItems.push(`
        <div class="flex flex-row items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 mr-3 text-muted-foreground">
            <path d="M16 2V6M8 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
            <path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z" stroke="currentColor" stroke-width="1.5"></path>
            <path d="M3 10H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          </svg>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-muted-foreground" data-i18n="match.date">${lblDate}</span>
            <span class="text-sm">${dt.full}</span>
          </div>
        </div>
      `);
    }

    if (referee) {
      detailItems.push(`
        <div class="flex flex-row items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 mr-3 text-muted-foreground">
            <path d="M17 8.5C17 5.73858 14.7614 3.5 12 3.5C9.23858 3.5 7 5.73858 7 8.5C7 11.2614 9.23858 13.5 12 13.5C14.7614 13.5 17 11.2614 17 8.5Z" stroke="currentColor" stroke-width="1.5"></path>
            <path d="M19 20.5C19 16.634 15.866 13.5 12 13.5C8.13401 13.5 5 16.634 5 20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          </svg>
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-muted-foreground" data-i18n="match.referee">${lblReferee}</span>
            <span class="text-sm">${referee}</span>
          </div>
        </div>
      `);
    }

    // Status
    const statusLabel = status === "1" ? lblNotStarted : status === "2" ? lblLive : lblFinished;
    detailItems.push(`
      <div class="flex flex-row items-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 mr-3 text-muted-foreground">
          <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"></circle>
          <path d="M7.5 8C6.5 9 6 10.5 6 12C6 13.5 6.5 15 7.5 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          <path d="M16.5 16C17.5 15 18 13.5 18 12C18 10.5 17.5 9 16.5 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
        </svg>
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-muted-foreground" data-i18n="match.status">${lblStatus}</span>
          <span class="text-sm">${statusLabel}</span>
        </div>
      </div>
    `);

    const matchDetailsHtml = detailItems.join("");

    // Update page title
    document.title = `${homeName} vs ${awayName} | dzeko11.de`;

    // Tab translations
    const lblOverview = t(lang, "match.tab.overview") || "Overview";
    const lblLineups = t(lang, "match.tab.lineups") || "Lineups";
    const lblTable = t(lang, "match.tab.table") || "Table";
    const lblStatistics = t(lang, "match.tab.statistics") || "Statistics";
    const lblH2H = t(lang, "match.tab.h2h") || "Head to Head";
    const lblBroadcast = t(lang, "match.tab.broadcast") || "TV";
    const lblMatchDetails = t(lang, "match.details") || "Match Details";

    // Show broadcast tab only for non-finished matches (status 1 = scheduled, 2 = live)
    const showBroadcastTab = status === "1" || status === "2";

    // Tab icons
    const tabIcons = {
      overview: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M3.88884 9.66294C4.39329 10 5.09552 10 6.49998 10C7.90445 10 8.60668 10 9.11113 9.66294C9.32951 9.51702 9.51701 9.32952 9.66292 9.11114C9.99998 8.60669 9.99998 7.90446 9.99998 6.5C9.99998 5.09554 9.99998 4.39331 9.66292 3.88886C9.51701 3.67048 9.32951 3.48298 9.11113 3.33706C8.60668 3 7.90445 3 6.49998 3C5.09552 3 4.39329 3 3.88884 3.33706C3.67046 3.48298 3.48296 3.67048 3.33705 3.88886C2.99998 4.39331 2.99998 5.09554 2.99998 6.5C2.99998 7.90446 2.99998 8.60669 3.33705 9.11114C3.48296 9.32952 3.67046 9.51702 3.88884 9.66294Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M14.8888 9.66294C15.3933 10 16.0955 10 17.5 10C18.9044 10 19.6067 10 20.1111 9.66294C20.3295 9.51702 20.517 9.32952 20.6629 9.11114C21 8.60669 21 7.90446 21 6.5C21 5.09554 21 4.39331 20.6629 3.88886C20.517 3.67048 20.3295 3.48298 20.1111 3.33706C19.6067 3 18.9044 3 17.5 3C16.0955 3 15.3933 3 14.8888 3.33706C14.6705 3.48298 14.483 3.67048 14.337 3.88886C14 4.39331 14 5.09554 14 6.5C14 7.90446 14 8.60669 14.337 9.11114C14.483 9.32952 14.6705 9.51702 14.8888 9.66294Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M3.88884 20.6629C4.39329 21 5.09552 21 6.49998 21C7.90445 21 8.60668 21 9.11113 20.6629C9.32951 20.517 9.51701 20.3295 9.66292 20.1111C9.99998 19.6067 9.99998 18.9045 9.99998 17.5C9.99998 16.0955 9.99998 15.3933 9.66292 14.8889C9.51701 14.6705 9.32951 14.483 9.11113 14.3371C8.60668 14 7.90445 14 6.49998 14C5.09552 14 4.39329 14 3.88884 14.3371C3.67046 14.483 3.48296 14.6705 3.33705 14.8889C2.99998 15.3933 2.99998 16.0955 2.99998 17.5C2.99998 18.9045 2.99998 19.6067 3.33705 20.1111C3.48296 20.3295 3.67046 20.517 3.88884 20.6629Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M14.8888 20.6629C15.3933 21 16.0955 21 17.5 21C18.9044 21 19.6067 21 20.1111 20.6629C20.3295 20.517 20.517 20.3295 20.6629 20.1111C21 19.6067 21 18.9045 21 17.5C21 16.0955 21 15.3933 20.6629 14.8889C20.517 14.6705 20.3295 14.483 20.1111 14.3371C19.6067 14 18.9044 14 17.5 14C16.0955 14 15.3933 14 14.8888 14.3371C14.6705 14.483 14.483 14.6705 14.337 14.8889C14 15.3933 14 16.0955 14 17.5C14 18.9045 14 19.6067 14.337 20.1111C14.483 20.3295 14.6705 20.517 14.8888 20.6629Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path></svg>`,
      lineups: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M15 8C15 9.65685 13.6569 11 12 11C10.3431 11 9 9.65685 9 8C9 6.34315 10.3431 5 12 5C13.6569 5 15 6.34315 15 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M16 4C17.6568 4 19 5.34315 19 7C19 8.22309 18.268 9.27523 17.2183 9.7423" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13.7143 14H10.2857C7.91876 14 5.99998 15.9188 5.99998 18.2857C5.99998 19.2325 6.76749 20 7.71426 20H16.2857C17.2325 20 18 19.2325 18 18.2857C18 15.9188 16.0812 14 13.7143 14Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M17.7143 13C20.0812 13 22 14.9188 22 17.2857C22 18.2325 21.2325 19 20.2857 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8 4C6.34315 4 5 5.34315 5 7C5 8.22309 5.73193 9.27523 6.78168 9.7423" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M3.71429 19C2.76751 19 2 18.2325 2 17.2857C2 14.9188 3.91878 13 6.28571 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
      table: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M4 4.5L20 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 14.5L20 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 9.5L20 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 19.5L20 19.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
      statistics: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M3 4V14C3 16.8284 3 18.2426 3.87868 19.1213C4.75736 20 6.17157 20 9 20H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M6 14L9.25 10.75C9.89405 10.1059 10.2161 9.78392 10.5927 9.67766C10.8591 9.60254 11.1409 9.60254 11.4073 9.67766C11.7839 9.78392 12.1059 10.1059 12.75 10.75C13.3941 11.3941 13.7161 11.7161 14.0927 11.8223C14.3591 11.8975 14.6409 11.8975 14.9073 11.8223C15.2839 11.7161 15.6059 11.3941 16.25 10.75L20 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`,
      h2h: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M12 8V12L13.5 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M19.5454 16.4534C21.1818 17.337 22 17.7789 22 18.5C22 19.2211 21.1818 19.663 19.5454 20.5466L18.4311 21.1484C17.1744 21.827 16.5461 22.1663 16.2439 21.9196C15.504 21.3154 16.6567 19.7561 16.9403 19.2037C17.2277 18.644 17.2225 18.3459 16.9403 17.7963C16.6567 17.2439 15.504 15.6846 16.2439 15.0804C16.5461 14.8337 17.1744 15.173 18.4311 15.8516L19.5454 16.4534Z" stroke="currentColor" stroke-width="1.5"></path><path d="M13.0261 21.948C12.6888 21.9824 12.3464 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 12.6849 21.9311 13.3538 21.8 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>`,
      broadcast: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="h-4 w-4"><path d="M2 11C2 7.70017 2 6.05025 3.02513 5.02513C4.05025 4 5.70017 4 9 4H15C18.2998 4 19.9497 4 20.9749 5.02513C22 6.05025 22 7.70017 22 11C22 14.2998 22 15.9497 20.9749 16.9749C19.9497 18 18.2998 18 15 18H9C5.70017 18 4.05025 18 3.02513 16.9749C2 15.9497 2 14.2998 2 11Z" stroke="currentColor" stroke-width="1.5"></path><path d="M16.9 20H7.1C6.53406 20 6.25109 20 6.05132 20.1382C5.89066 20.2496 5.76772 20.4079 5.70027 20.5914C5.61876 20.813 5.6687 21.0894 5.76857 21.6422L5.83399 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M18.166 22L18.2314 21.6422C18.3313 21.0894 18.3812 20.813 18.2997 20.5914C18.2323 20.4079 18.1093 20.2496 17.9487 20.1382C17.7489 20 17.4659 20 16.9 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M11 15V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><path d="M13 15V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>`
    };

    // Get match URL (for reference, not for tab navigation)
    const matchID = getMatchIDFromURL();

    container.innerHTML = `
      <!-- Breadcrumb -->
      <nav aria-label="breadcrumb" class="mb-4">
        <ol class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
          <li class="inline-flex items-center gap-1.5">
            <a href="/" class="hover:text-foreground transition-colors hover:bg-background-tertiary px-2 py-1 rounded-lg" data-i18n="nav.home">Home</a>
          </li>
          <li aria-hidden="true" class="[&>svg]:size-3.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
              <path d="M9 6C9 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </li>
          <li class="inline-flex items-center gap-1.5">
            <a href="${sport.href}" class="hover:text-foreground transition-colors hover:bg-background-tertiary px-2 py-1 rounded-lg">${sportName}</a>
          </li>
          <li aria-hidden="true" class="[&>svg]:size-3.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
              <path d="M9 6C9 6 15 10.4189 15 12C15 13.5812 9 18 9 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </li>
          <li class="inline-flex items-center gap-1.5">
            <span class="text-foreground">${homeName} vs ${awayName}</span>
          </li>
        </ol>
      </nav>

      <!-- Main Grid Layout -->
      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <!-- Main Content Column -->
        <div class="xl:col-span-3 space-y-6">
          <!-- Match Header Card -->
          <div class="card card--default p-0" data-slot="card">
            <div class="card__content p-0" data-slot="card-content">
              <div class="px-3 sm:px-4 md:px-6 py-6 md:py-8">
                <div class="flex items-center justify-between gap-2 sm:gap-4 md:gap-8 max-w-4xl mx-auto">
                  <!-- Home Team -->
                  <div class="flex-1 flex flex-col sm:flex-col md:flex-row items-center gap-1 sm:gap-2 md:gap-3 min-w-0">
                    <div class="order-1 md:order-2 relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 shrink-0">
                      <img alt="${homeName}" class="object-contain w-full h-full" src="${homeImg}" onerror="this.src='/assets/img/team-placeholder.png'">
                    </div>
                    <div class="order-2 md:order-1 text-center sm:text-center md:text-right w-full">
                      <h2 id="home-team-name" class="text-sm sm:text-lg md:text-2xl font-bold">${homeName}</h2>
                    </div>
                  </div>

                  <!-- Score / Time -->
                  <div class="flex flex-col items-center gap-1 sm:gap-2 md:gap-3 min-w-20 sm:min-w-25 md:min-w-35 shrink-0">
                    <div id="match-score" class="text-center">
                      ${scoreDisplay}
                    </div>
                    <div id="match-status" class="font-semibold rounded-full ${statusBadgeClass} cursor-default inline-flex items-center text-xs px-1 py-1 md:text-md md:px-2 md:py-2">
                      ${status === "1" ? lblNotStarted : status === "2" ? lblLive : lblFinished}
                    </div>
                  </div>

                  <!-- Away Team -->
                  <div class="flex-1 flex flex-col sm:flex-col md:flex-row items-center gap-1 sm:gap-2 md:gap-3 min-w-0">
                    <div class="order-1 relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 shrink-0">
                      <img alt="${awayName}" class="object-contain w-full h-full" src="${awayImg}" onerror="this.src='/assets/img/team-placeholder.png'">
                    </div>
                    <div class="order-2 text-center sm:text-center md:text-left w-full">
                      <h2 id="away-team-name" class="text-sm sm:text-lg md:text-2xl font-bold">${awayName}</h2>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Match Info Bar (hidden on mobile) -->
              <div class="px-3 sm:px-6 py-3 sm:py-4 hidden sm:block">
                <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
                  ${leagueName ? `
                    <a href="${leagueUrl}" class="truncate max-w-50 sm:max-w-none hover:rounded-full hover:bg-surface-secondary p-1 px-2">
                      <div class="flex items-center justify-center gap-2">${leagueName}</div>
                    </a>
                  ` : ""}
                  ${stadium ? `
                    <div class="hover:rounded-full hover:bg-surface-secondary p-1 px-2">
                      <div class="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4">
                          <path d="M7 18C5.17107 18.4117 4 19.0443 4 19.7537C4 20.9943 7.58172 22 12 22C16.4183 22 20 20.9943 20 19.7537C20 19.0443 18.8289 18.4117 17 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                          <path d="M14.5 9C14.5 10.3807 13.3807 11.5 12 11.5C10.6193 11.5 9.5 10.3807 9.5 9C9.5 7.61929 10.6193 6.5 12 6.5C13.3807 6.5 14.5 7.61929 14.5 9Z" stroke="currentColor" stroke-width="1.5"></path>
                          <path d="M13.2574 17.4936C12.9201 17.8184 12.4693 18 12.0002 18C11.531 18 11.0802 17.8184 10.7429 17.4936C7.6543 14.5008 3.51519 11.1575 5.53371 6.30373C6.6251 3.67932 9.24494 2 12.0002 2C14.7554 2 17.3752 3.67933 18.4666 6.30373C20.4826 11.1514 16.3536 14.5111 13.2574 17.4936Z" stroke="currentColor" stroke-width="1.5"></path>
                        </svg>
                        ${stadium}
                      </div>
                    </div>
                  ` : ""}
                  <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4">
                      <path d="M16 2V6M8 2V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                      <path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                      <path d="M3 10H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    <span>${dt.date}</span>
                  </div>
                </div>
              </div>

              <!-- Tab Navigation (inside card) -->
              <div class="flex flex-row overflow-x-auto gap-5 justify-start md:justify-center">
                ${showBroadcastTab ? `
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground font-semibold after:content-[''] after:absolute after:bottom-0 after:start-0 after:w-full after:h-0.75 after:bg-(--eclipse) dark:after:bg-(--snow) after:rounded-t-2xl active" data-tab="broadcast" data-status="active" aria-current="page">
                  <span class="mr-2">${tabIcons.broadcast}</span><span data-i18n="match.tab.broadcast">${lblBroadcast}</span>
                </button>
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground/60" data-tab="overview">
                  <span class="mr-2">${tabIcons.overview}</span><span data-i18n="match.tab.overview">${lblOverview}</span>
                </button>
                ` : `
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground font-semibold after:content-[''] after:absolute after:bottom-0 after:start-0 after:w-full after:h-0.75 after:bg-(--eclipse) dark:after:bg-(--snow) after:rounded-t-2xl active" data-tab="overview" data-status="active" aria-current="page">
                  <span class="mr-2">${tabIcons.overview}</span><span data-i18n="match.tab.overview">${lblOverview}</span>
                </button>
                `}
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground/60" data-tab="lineups">
                  <span class="mr-2">${tabIcons.lineups}</span><span data-i18n="match.tab.lineups">${lblLineups}</span>
                </button>
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground/60" data-tab="table">
                  <span class="mr-2">${tabIcons.table}</span><span data-i18n="match.tab.table">${lblTable}</span>
                </button>
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground/60" data-tab="statistics">
                  <span class="mr-2">${tabIcons.statistics}</span><span data-i18n="match.tab.statistics">${lblStatistics}</span>
                </button>
                <button type="button" class="tab-btn relative flex items-center justify-center h-11 px-4 text-xs md:text-sm whitespace-nowrap flex-1 md:flex-none text-surface-foreground/60" data-tab="h2h">
                  <span class="mr-2">${tabIcons.h2h}</span><span data-i18n="match.tab.h2h">${lblH2H}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Tab Content Container -->
          <div id="tabContent">
            <!-- Events Card (Overview Tab) - placeholder for now -->
          </div>
        </div>

        <!-- Sidebar Column -->
        <div class="xl:col-span-1 space-y-6">
          <!-- Match Details Card -->
          <div class="card card--default" data-slot="card">
            <div class="card__header" data-slot="card-header">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-lg bg-surface-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4">
                    <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="1.5"></path>
                    <path d="M12 8V12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                    <path d="M12 15.9883V15.9983" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
                  </svg>
                </div>
                <h4 class="text-base font-semibold" data-i18n="match.details">${lblMatchDetails}</h4>
              </div>
            </div>
            <div class="card__content space-y-3" data-slot="card-content">
              ${matchDetailsHtml || '<p class="text-sm text-muted-foreground">No additional match information available.</p>'}
            </div>
          </div>
        </div>
      </div>
    `;

    // Store data for refresh
    currentMatchData = { teamData, matchData, matchInfo };
  }

  // Render custom event page (simplified - broadcast only)
  function renderCustomEventPage(container, customData) {
    const lang = normalizeLang(getLang());
    const lblNotStarted = t(lang, "match.notStarted") || "Not Started";
    const lblLive = t(lang, "match.live") || "Live";
    const lblFinished = t(lang, "match.finished") || "Full Time";
    const lblDate = t(lang, "match.date") || "Date";
    const lblStatus = t(lang, "match.status") || "Status";
    const lblBroadcast = t(lang, "match.tab.broadcast") || "Broadcast TV";
    const lblLoading = t(lang, "match.broadcast.loading") || "Loading channels...";

    const { matchID, sport, startTs, name, homeName, awayName, status, channels, customUrls } = customData;

    // Format date
    const dateObj = new Date(startTs * 1000);
    const dateStr = dateObj.toLocaleDateString(lang, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const timeStr = dateObj.toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit"
    });

    // Status badge
    const statusBadgeClass = status === "1"
      ? "bg-muted text-muted-foreground"
      : status === "2"
        ? "bg-live text-white animate-pulse"
        : "bg-surface-secondary text-muted-foreground";

    const statusText = status === "1" ? lblNotStarted : status === "2" ? lblLive : lblFinished;

    // Check if it's a team match (has " - " in name) or event
    const isTeamMatch = awayName && awayName.length > 0;

    container.innerHTML = `
      <!-- Main Grid Layout -->
      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <!-- Main Content Column -->
        <div class="xl:col-span-3 space-y-6">
          <!-- Event Header Card -->
          <div class="card card--default p-0" data-slot="card">
            <div class="card__content p-0" data-slot="card-content">
              <div class="px-3 sm:px-4 md:px-6 py-6 md:py-8">
                <div class="flex flex-col items-center justify-center gap-4 max-w-4xl mx-auto">
                  ${isTeamMatch ? `
                    <!-- Team Match Layout -->
                    <div class="flex items-center justify-center gap-4 sm:gap-8 w-full">
                      <div class="flex-1 text-center">
                        <h2 class="text-lg sm:text-xl md:text-2xl font-bold">${homeName}</h2>
                      </div>
                      <div class="flex flex-col items-center gap-2 min-w-20 shrink-0">
                        <div class="text-3xl sm:text-4xl font-bold text-muted-foreground">vs</div>
                        <div class="font-semibold rounded-full ${statusBadgeClass} cursor-default inline-flex items-center text-xs px-2 py-1">
                          ${statusText}
                        </div>
                      </div>
                      <div class="flex-1 text-center">
                        <h2 class="text-lg sm:text-xl md:text-2xl font-bold">${awayName}</h2>
                      </div>
                    </div>
                  ` : `
                    <!-- Event Layout (no teams) -->
                    <div class="text-center">
                      <h2 class="text-xl sm:text-2xl md:text-3xl font-bold mb-3">${name}</h2>
                      <div class="font-semibold rounded-full ${statusBadgeClass} cursor-default inline-flex items-center text-xs px-2 py-1">
                        ${statusText}
                      </div>
                    </div>
                  `}
                </div>
              </div>

              <!-- Event Info Bar -->
              <div class="px-3 sm:px-6 py-3 sm:py-4 border-t border-border/30">
                <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
                  <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4">
                      <path d="M18 2V4M6 2V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                      <path d="M2.5 12.2432C2.5 7.88594 2.5 5.70728 3.75212 4.35364C5.00424 3 7.01949 3 11.05 3H12.95C16.9805 3 18.9958 3 20.2479 4.35364C21.5 5.70728 21.5 7.88594 21.5 12.2432V12.7568C21.5 17.1141 21.5 19.2927 20.2479 20.6464C18.9958 22 16.9805 22 12.95 22H11.05C7.01949 22 5.00424 22 3.75212 20.6464C2.5 19.2927 2.5 17.1141 2.5 12.7568V12.2432Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                      <path d="M3 8H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                    ${dateStr} ${timeStr}
                  </div>
                </div>
              </div>

              ${status !== "3" ? `
              <!-- Broadcast Tab Only (hidden when finished) -->
              <div class="border-t border-border/30">
                <nav class="flex overflow-x-auto scrollbar-hide">
                  <button type="button" data-tab="broadcast"
                          class="tab-btn flex-1 min-w-fit px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium transition-all border-b-2 text-foreground border-primary">
                    <span class="flex items-center justify-center gap-1.5 sm:gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4 hidden sm:block">
                        <path d="M2 11C2 7.70017 2 6.05025 3.02513 5.02513C4.05025 4 5.70017 4 9 4H15C18.2998 4 19.9497 4 20.9749 5.02513C22 6.05025 22 7.70017 22 11C22 14.2998 22 15.9497 20.9749 16.9749C19.9497 18 18.2998 18 15 18H9C5.70017 18 4.05025 18 3.02513 16.9749C2 15.9497 2 14.2998 2 11Z" stroke="currentColor" stroke-width="1.5"></path>
                        <path d="M16.9 20H7.1C6.53406 20 6.25109 20 6.05132 20.1382C5.89066 20.2496 5.76772 20.4079 5.70027 20.5914C5.61876 20.813 5.6687 21.0894 5.76857 21.6422L5.83399 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                        <path d="M18.166 22L18.2314 21.6422C18.3313 21.0894 18.3812 20.813 18.2997 20.5914C18.2323 20.4079 18.1093 20.2496 17.9487 20.1382C17.7489 20 17.4659 20 16.9 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                        <path d="M11 15V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                        <path d="M13 15V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                      </svg>
                      ${lblBroadcast}
                    </span>
                  </button>
                </nav>
              </div>
              ` : ""}
            </div>
          </div>

          ${status !== "3" ? `
          <!-- Broadcast Content (hidden when finished) -->
          <div id="tab-content-broadcast" class="tab-content">
            <div class="card card--default p-6">
              <div class="flex items-center justify-center gap-3">
                <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span class="text-muted-foreground text-sm">${lblLoading}</span>
              </div>
            </div>
          </div>
          ` : ""}
        </div>

        <!-- Sidebar -->
        <div class="xl:col-span-1 space-y-6">
          <!-- Event Info Card -->
          <div class="card card--default" data-slot="card">
            <div class="card__header" data-slot="card-header">
              <h3 class="text-lg font-semibold">Event Info</h3>
            </div>
            <div class="card__content" data-slot="card-content">
              <div class="space-y-4 text-sm">
                <div class="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-muted-foreground">
                    <path d="M18 2V4M6 2V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M2.5 12.2432C2.5 7.88594 2.5 5.70728 3.75212 4.35364C5.00424 3 7.01949 3 11.05 3H12.95C16.9805 3 18.9958 3 20.2479 4.35364C21.5 5.70728 21.5 7.88594 21.5 12.2432V12.7568C21.5 17.1141 21.5 19.2927 20.2479 20.6464C18.9958 22 16.9805 22 12.95 22H11.05C7.01949 22 5.00424 22 3.75212 20.6464C2.5 19.2927 2.5 17.1141 2.5 12.7568V12.2432Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M3 8H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                  </svg>
                  <div>
                    <div class="text-muted-foreground">${lblDate}</div>
                    <div class="font-medium">${dateStr} ${timeStr}</div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-5 h-5 text-muted-foreground">
                    <path d="M12 8V12L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                    <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="1.5"></path>
                  </svg>
                  <div>
                    <div class="text-muted-foreground">${lblStatus}</div>
                    <div class="font-medium">${statusText}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

// Render broadcast content directly for custom events
const broadcastContainer = document.getElementById("tab-content-broadcast");
if (broadcastContainer) {
  // Fetch local channels to get alpha2 (country codes) for flags
  fetchLocalChannels().then(localChannels => {
    // Build lookup map: TVI number -> local channel
    const localChannelByTviId = {};
    for (const ch of localChannels) {
      if (ch.FS) {
        const tviNum = extractTviNumber(ch.FS);
        if (tviNum) {
          localChannelByTviId[tviNum] = ch;
        }
      }
    }

    // Enrich custom event channels with country from local channels
const enabledChannels = channels
  .filter(ch => ch.enabled !== false)
  .map(ch => {
    const tviNum = extractTviNumber(ch.id);
    const localCh = localChannelByTviId[tviNum];
    return {
      id: localCh ? String(localCh.id) : ch.id,  // ✅ Use local channel ID if found
      tviId: tviNum,
      name: ch.name || (localCh?.name || ""),  // Also fallback name from local
      country: localCh?.alpha2 || "",
      source: "custom"
    };
  })
  .filter(ch => {
    // Only include channels that were found in local database
    // (since we need the real ID for the player URL)
    const tviNum = extractTviNumber(ch.tviId);
    return localChannelByTviId[tviNum] !== undefined;
  });

    const enabledUrls = customUrls.filter(u => u.enabled !== false);

    renderBroadcastTab(broadcastContainer, enabledChannels, enabledUrls, lang, startTs, status);
  });
}

    // Store custom data for refresh
    currentMatchData = { customData };
  }

  // Refresh custom event status periodically
  let customRefreshInterval = null;
  function startCustomEventRefresh(matchID) {
    if (customRefreshInterval) clearInterval(customRefreshInterval);

    customRefreshInterval = setInterval(async () => {
      const container = document.getElementById("matchDetailContainer");
      if (!container) {
        clearInterval(customRefreshInterval);
        return;
      }

      const customData = await fetchCustomEventData(matchID);
      if (customData) {
        // Check if status changed
        const oldStatus = sessionStorage.getItem(`status_${matchID}`);
        if (customData.status !== oldStatus) {
          sessionStorage.setItem(`status_${matchID}`, customData.status);
          renderCustomEventPage(container, customData);
          setupTabClickHandlers();

          // Refresh broadcast tab if active (to update link availability)
          const activeTab = document.querySelector(".tab-btn.active");
          if (activeTab?.getAttribute("data-tab") === "broadcast") {
            loadTabContent("broadcast");
          }

          // Stop refresh if finished
          if (customData.status === "3") {
            clearInterval(customRefreshInterval);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Update scores only (for live refresh)
  function updateMatchScores(matchData) {
    const scoreEl = document.getElementById("match-score");
    const statusEl = document.getElementById("match-status");

    if (!scoreEl || !statusEl) return;

    const lang = normalizeLang(getLang());
    const status = matchData?.status || "1";
    const homeScore = matchData?.homeScore || "";
    const awayScore = matchData?.awayScore || "";
    const timestamp = matchData?.timestamp;

    const lblNotStarted = t(lang, "match.notStarted") || "Not Started";
    const lblLive = t(lang, "match.live") || "Live";
    const lblFinished = t(lang, "match.finished") || "Full Time";

    const statusBadgeClass = getStatusBadgeClass(status);
    const showScores = status === "2" || status === "3";
    const dt = timestamp ? formatDateTime(timestamp) : { time: "" };

    if (showScores) {
      scoreEl.innerHTML = `
        <div class="flex items-center gap-1 sm:gap-2 md:gap-4">
          <span class="text-2xl sm:text-3xl md:text-5xl font-bold tabular-nums">${homeScore}</span>
          <span class="text-xl sm:text-2xl md:text-3xl text-muted-foreground font-light">-</span>
          <span class="text-2xl sm:text-3xl md:text-5xl font-bold tabular-nums">${awayScore}</span>
        </div>`;
    } else {
      scoreEl.innerHTML = `<div class="text-xl sm:text-2xl md:text-4xl font-semibold">${dt.time}</div>`;
    }

    statusEl.className = `font-semibold rounded-full ${statusBadgeClass} cursor-default inline-flex items-center text-xs px-1 py-1 md:text-md md:px-2 md:py-2`;
    statusEl.textContent = status === "1" ? lblNotStarted : status === "2" ? lblLive : lblFinished;
  }

  // Start auto-refresh for live matches
  function startLiveRefresh(matchID) {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    refreshInterval = setInterval(async () => {
      const matchData = await fetchMatchData(matchID);
      if (matchData) {
        updateMatchScores(matchData);

        // Update status in session storage
        const oldStatus = sessionStorage.getItem(`status_${matchID}`);
        if (matchData.status !== oldStatus) {
          sessionStorage.setItem(`status_${matchID}`, matchData.status);

          // Refresh broadcast tab if active (to update after match ends)
          const activeTab = document.querySelector(".tab-btn.active");
          if (activeTab?.getAttribute("data-tab") === "broadcast") {
            loadTabContent("broadcast");
          }
        }

        // Stop refreshing if match is finished
        if (matchData.status === "3") {
          clearInterval(refreshInterval);
          refreshInterval = null;
        }
      }
    }, 30000); // Refresh every 30 seconds
  }

  // Start auto-refresh for broadcast tab (checks every 30s to activate links 15 min before kickoff)
  function startBroadcastRefresh(matchID) {
    if (broadcastRefreshInterval) {
      clearInterval(broadcastRefreshInterval);
    }

    broadcastRefreshInterval = setInterval(() => {
      const activeTab = document.querySelector(".tab-btn.active");
      const tabName = activeTab?.getAttribute("data-tab");

      // Only refresh if broadcast tab is active
      if (tabName === "broadcast") {
        const matchTimestamp = sessionStorage.getItem(`time_${matchID}`);
        const matchStatus = sessionStorage.getItem(`status_${matchID}`);

        // If match started (status 2), stop broadcast refresh (live refresh handles it)
        if (matchStatus === "2" || matchStatus === "3") {
          clearInterval(broadcastRefreshInterval);
          broadcastRefreshInterval = null;
          return;
        }

        // Re-render broadcast tab to update link availability
        loadTabContent("broadcast");
      }
    }, 30000); // Check every 30 seconds
  }

  // Start pre-match refresh (checks for status changes before match starts)
  function startPreMatchRefresh(matchID, container) {
    if (preMatchRefreshInterval) {
      clearInterval(preMatchRefreshInterval);
    }

    preMatchRefreshInterval = setInterval(async () => {
      const matchData = await fetchMatchData(matchID);
      if (!matchData) return;

      const oldStatus = sessionStorage.getItem(`status_${matchID}`);

      // If match just went live, update everything
      if (matchData.status === "2" && oldStatus !== "2") {
        sessionStorage.setItem(`status_${matchID}`, matchData.status);

        // Stop pre-match refresh, start live refresh
        clearInterval(preMatchRefreshInterval);
        preMatchRefreshInterval = null;
        startLiveRefresh(matchID);

        // Refresh current tab content
        const activeTab = document.querySelector(".tab-btn.active");
        const tabName = activeTab?.getAttribute("data-tab");
        if (tabName === "broadcast") {
          loadTabContent("broadcast");
        }

        // Update scores display
        updateMatchScores(matchData);
      }
    }, 60000); // Check every 60 seconds
  }

  // Stop all refresh intervals
  function stopAllRefreshIntervals() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    if (broadcastRefreshInterval) {
      clearInterval(broadcastRefreshInterval);
      broadcastRefreshInterval = null;
    }
    if (preMatchRefreshInterval) {
      clearInterval(preMatchRefreshInterval);
      preMatchRefreshInterval = null;
    }
    if (customRefreshInterval) {
      clearInterval(customRefreshInterval);
      customRefreshInterval = null;
    }
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", stopAllRefreshIntervals);

  // Setup tab click handlers (no URL navigation, just switches content)
  function setupTabClickHandlers() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const tabName = btn.getAttribute("data-tab");

        // Remove active state from all tabs
        tabBtns.forEach(b => {
          b.classList.remove("active", "font-semibold", "text-surface-foreground");
          b.classList.add("text-surface-foreground/60");
          b.removeAttribute("data-status");
          b.removeAttribute("aria-current");
          // Remove the underline styles
          b.classList.remove(
            "after:content-['']", "after:absolute", "after:bottom-0",
            "after:start-0", "after:w-full", "after:h-0.75",
            "after:bg-(--eclipse)", "dark:after:bg-(--snow)", "after:rounded-t-2xl"
          );
        });

        // Add active state to clicked tab
        btn.classList.add("active", "font-semibold", "text-surface-foreground");
        btn.classList.remove("text-surface-foreground/60");
        btn.setAttribute("data-status", "active");
        btn.setAttribute("aria-current", "page");
        // Add underline styles
        btn.classList.add(
          "after:content-['']", "after:absolute", "after:bottom-0",
          "after:start-0", "after:w-full", "after:h-0.75",
          "after:bg-(--eclipse)", "dark:after:bg-(--snow)", "after:rounded-t-2xl"
        );

        // Load tab content (for now just overview works)
        loadTabContent(tabName);
      });
    });
  }

  // Load tab content (placeholder - only overview implemented for now)
  async function loadTabContent(tabName) {
    const tabContent = document.getElementById("tabContent");
    if (!tabContent) return;

    const lang = normalizeLang(getLang());
    const matchID = getMatchIDFromURL();

    if (tabName === "overview") {
      tabContent.innerHTML = ""; // Overview content is already in the main card
    } else if (tabName === "broadcast") {
      // Show loading
      tabContent.innerHTML = `
        <div class="card card--default p-6">
          <div class="flex items-center justify-center gap-3">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            <span class="text-muted-foreground text-sm">${t(lang, "match.broadcast.loading") || "Loading channels..."}</span>
          </div>
        </div>
      `;

      try {
        // Determine if custom match (CUST:, TIM:, TOP:) or Flashscore match (FS:)
        const isCustom = isCustomEvent(matchID);
        let apiMatchID = matchID;
        if (!matchID.startsWith("CUST:") && !matchID.startsWith("TIM:") && !matchID.startsWith("TOP:") && !matchID.startsWith("FS:")) {
          apiMatchID = isCustom ? `CUST:${matchID}` : `FS:${matchID}`;
        }

        // Get match timing info from sessionStorage or loaded match data
        const matchTimestamp = sessionStorage.getItem(`time_${matchID}`) || currentMatchData?.matchData?.timestamp;
        const matchStatus = sessionStorage.getItem(`status_${matchID}`) || currentMatchData?.matchData?.status || "2";

        // Fetch data in parallel (skip Flashscore TVI for custom matches)
        const [flashscoreChannels, localChannels, matchOverrides] = await Promise.all([
          isCustom ? Promise.resolve([]) : fetchFlashscoreTVI(matchID),
          fetchLocalChannels(),
          fetchMatchChannelOverrides(apiMatchID)
        ]);

        // Merge channels and custom URLs
        const { channels, customUrls } = mergeChannels(flashscoreChannels, localChannels, matchOverrides);

        // Render broadcast content with timing info
        renderBroadcastTab(tabContent, channels, customUrls, lang, matchTimestamp, matchStatus);
      } catch (e) {
        console.error("Failed to load broadcast data:", e);
        tabContent.innerHTML = `
          <div class="card card--default p-6 text-center">
            <p class="text-muted-foreground">${t(lang, "match.broadcast.error") || "Failed to load channels."}</p>
          </div>
        `;
      }
    } else {
      const lblComingSoon = t(lang, "match.tab.comingSoon") || "Coming soon";
      tabContent.innerHTML = `
        <div class="card card--default p-6 text-center">
          <p class="text-muted-foreground">${lblComingSoon}</p>
        </div>
      `;
    }
  }

  // Dedicated Match Stream Player Controls
  window.switchMatchPlayer = function(btn, explicitName, explicitUrl) {
    if (!btn && !explicitUrl) return;
    const streamUrl = (btn && btn.getAttribute("data-stream-url")) || explicitUrl;
    const streamName = (btn && btn.getAttribute("data-stream-name")) || explicitName || "Live Stream";
    const directUrl = (btn && btn.getAttribute("data-direct-url")) || streamUrl;

    const iframe = document.getElementById("matchPlayerIframe");
    if (iframe && streamUrl) {
      iframe.src = streamUrl;
    }
    const label = document.getElementById("activeStreamLabel");
    if (label && streamName) {
      label.textContent = streamName;
    }
    const theaterBtn = document.getElementById("theaterModeBtn");
    if (theaterBtn && streamUrl) {
      const matchID = getMatchIDFromURL();
      const spObj = getSportFromURL();
      const sp = (spObj && spObj.id) ? spObj.id : "";
      theaterBtn.href = `/watch/?id=${matchID}&sport=${encodeURIComponent(sp)}&src=${encodeURIComponent(streamUrl)}&title=${encodeURIComponent(document.title)}`;
    }
    const popoutBtn = document.getElementById("directPopoutBtn");
    if (popoutBtn && directUrl) {
      popoutBtn.href = directUrl;
    }

    // Update active class on pills
    document.querySelectorAll(".match-server-pill").forEach(p => {
      p.classList.remove("active", "bg-primary", "border-primary");
      p.classList.add("bg-surface-secondary", "text-foreground", "border-border/50");
      const dot = p.querySelector(".indicator-dot");
      if (dot) {
        dot.classList.remove("bg-white");
        dot.classList.add("bg-emerald-400");
      }
    });
    if (btn) {
      btn.classList.add("active", "bg-primary", "border-primary");
      btn.classList.remove("bg-surface-secondary");
      const dot = btn.querySelector(".indicator-dot");
      if (dot) {
        dot.classList.add("bg-white");
        dot.classList.remove("bg-emerald-400");
      }
    }
  };

  window.reloadMatchPlayer = function() {
    const iframe = document.getElementById("matchPlayerIframe");
    if (iframe) {
      const cur = iframe.src;
      iframe.src = "about:blank";
      setTimeout(() => { iframe.src = cur; }, 200);
    }
  };

  window.fullscreenMatchPlayer = function() {
    const iframe = document.getElementById("matchPlayerIframe");
    if (iframe) {
      if (iframe.requestFullscreen) iframe.requestFullscreen();
      else if (iframe.webkitRequestFullscreen) iframe.webkitRequestFullscreen();
      else if (iframe.msRequestFullscreen) iframe.msRequestFullscreen();
    }
  };

  // Render broadcast tab content with dedicated player
  function renderBroadcastTab(container, channels, customUrls, lang, matchTimestamp, matchStatus) {
    const lblNoChannels = t(lang, "match.broadcast.noChannels") || "No TV channels or stream servers available for this match.";
    const lblChannels = t(lang, "match.broadcast.title") || "TV Channels";
    const lblLinks = t(lang, "match.broadcast.links") || "Streaming Servers";
    const lblAvailableSoon = t(lang, "match.broadcast.availableSoon") || "Live streams become available 15 minutes before kickoff";
    const matchID = getMatchIDFromURL();

    // Collect valid streams
    const allStreams = [];
    if (Array.isArray(customUrls)) {
      for (const u of customUrls) {
        if (!u || !u.url) continue;
        if (u.url === '#' || u.url === 'about:blank') continue;
        allStreams.push({
          id: u.id || `srv-${allStreams.length + 1}`,
          name: u.name || `Server ${allStreams.length + 1}`,
          url: u.url
        });
      }
    }

    // Also add any channels that have direct streams
    if (Array.isArray(channels)) {
      for (const ch of channels) {
        if (ch && ch.streamUrl && !allStreams.some(s => s.url === ch.streamUrl)) {
          allStreams.push({
            id: `srv-ch-${allStreams.length + 1}`,
            name: `Server ${allStreams.length + 1}: ${ch.name}`,
            url: ch.streamUrl
          });
        }
      }
    }

    const hasStreams = allStreams.length > 0;
    const hasChannels = Array.isArray(channels) && channels.length > 0;

    // Timing
    const now = Date.now();
    const startTime = matchTimestamp ? parseInt(matchTimestamp, 10) * 1000 : null;
    const isLive = matchStatus === "2";
    const fifteenMinutesMs = 15 * 60 * 1000;
    const timeUntilStart = startTime ? startTime - now : null;
    const isWithin15Min = startTime && timeUntilStart <= fifteenMinutesMs;
    // Always active if we have streams or is live
    const isClickable = isLive || isWithin15Min || hasStreams;
    const minutesUntilAvailable = !isClickable && timeUntilStart
      ? Math.ceil((timeUntilStart - fifteenMinutesMs) / 60000)
      : 0;

    if (!hasStreams && !hasChannels) {
      container.innerHTML = `
        <div class="card card--default p-8 text-center border border-border/40 shadow-sm">
          <div class="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="text-muted-foreground text-sm font-medium">${lblNoChannels}</p>
        </div>
      `;
      return;
    }

    let html = `<div class="space-y-4">`;

    // 1. EMBEDDED DEDICATED STREAM PLAYER (If streams available and clickable)
    if (hasStreams && isClickable) {
      const activeStream = allStreams[0];
      const matchTitle = document.title || 'Live Match';
      const spObj = getSportFromURL();
      const sp = (spObj && spObj.id) ? spObj.id : "";
      const theaterUrl = `/watch/?id=${matchID}&sport=${encodeURIComponent(sp)}&src=${encodeURIComponent(activeStream.url)}&title=${encodeURIComponent(matchTitle)}`;
      const initialDirect = activeStream.direct_url || activeStream.url;

      html += `
        <!-- Main Dedicated Player Stage -->
        <div class="card card--default overflow-hidden border border-border/50 shadow-xl rounded-xl" data-slot="card">
          <div class="card__header flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-surface-secondary/50 border-b border-border/40">
            <div class="flex items-center gap-2.5">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-600/20 text-red-400 border border-red-500/30">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                LIVE
              </span>
              <span id="activeStreamLabel" class="text-sm font-bold text-foreground truncate max-w-[200px] sm:max-w-md">
                ${activeStream.name}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" onclick="window.reloadMatchPlayer()" title="Reload Stream"
                      class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-xs border border-border/50 text-foreground transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span class="hidden sm:inline">Reload</span>
              </button>
              <button type="button" onclick="window.fullscreenMatchPlayer()" title="Fullscreen"
                      class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-xs border border-border/50 text-foreground transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span class="hidden sm:inline">Fullscreen</span>
              </button>
              <a id="directPopoutBtn" href="${initialDirect}" target="_blank" rel="noopener noreferrer" title="Open Stream in New Tab"
                 class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-xs border border-border/50 text-foreground transition-all hover:text-primary">
                <span>Pop-Out ↗</span>
              </a>
              <a id="theaterModeBtn" href="${theaterUrl}" title="Open Full Theater Player"
                 class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-sm transition-all">
                <span>Theater Player</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
          <div class="card__content p-0 bg-black">
            <div class="relative w-full aspect-video bg-black flex items-center justify-center">
              <iframe id="matchPlayerIframe" src="${activeStream.url}"
                      class="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowfullscreen
                      referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
          </div>
        </div>
      `;
    }

    // 2. STREAMING SERVERS LIST (Buttons that switch active stream)
    if (hasStreams) {
      html += `
        <div class="card card--default" data-slot="card">
          <div class="card__header flex items-center justify-between py-3 px-4 border-b border-border/30">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-primary">
                <path d="M13.5 12C13.5 15.18 10.93 17.75 7.75 17.75C4.57 17.75 2 15.18 2 12C2 8.82 4.57 6.25 7.75 6.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M10 12C10 8.69 12.69 6 16 6C19.31 6 22 8.69 22 12C22 15.31 19.31 18 16 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <h4 class="text-sm sm:text-base font-semibold">${lblLinks}</h4>
            </div>
            <span class="text-xs text-muted-foreground font-medium">${allStreams.length} Sources Ready</span>
          </div>
          <div class="card__content p-4">
            <div class="flex flex-wrap gap-2.5">
      `;

      allStreams.forEach((s, idx) => {
        const isFirst = idx === 0;
        const sName = s.name || `Server ${idx + 1}`;
        const escapedName = sName.replace(/"/g, '&quot;');
        const escapedUrl = (s.url || '').replace(/"/g, '&quot;');
        const directUrl = (s.direct_url || s.url || '').replace(/"/g, '&quot;');

        const flagMatch = sName.match(/\b(RS|PT|ES|UK|GB|FR|DE|IT|US|PL|AU|CA|NL|BE|CH|AT|TR|BR|MX|AR)\b/i);
        const flagCode = flagMatch ? flagMatch[1].toLowerCase() : '';

        if (isClickable) {
          html += `
            <div class="inline-flex items-center gap-1">
              <button type="button"
                      onclick="window.switchMatchPlayer(this)"
                      data-stream-url="${escapedUrl}"
                      data-stream-name="${escapedName}"
                      data-direct-url="${directUrl}"
                      class="match-server-pill ${isFirst ? 'active bg-primary border-primary' : 'bg-surface-secondary border-border/50'}">
                <span class="indicator-dot ${isFirst ? 'bg-white' : 'bg-emerald-400'}"></span>
                ${flagCode ? `<img src="https://flagcdn.com/16x12/${flagCode}.png" alt="${flagCode}" class="w-4 h-3 object-cover rounded-sm inline-block" onerror="this.style.display='none'">` : ''}
                <span class="font-bold">${sName}</span>
                <span class="text-[10px] px-1 py-0.2 rounded bg-black/30 text-blue-300 font-mono">HD</span>
              </button>
              <a href="${directUrl}" target="_blank" rel="noopener noreferrer" title="Open Stream in New Tab"
                 class="p-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-muted-foreground hover:text-foreground border border-border/40 text-xs transition-colors">
                &nearr;
              </a>
            </div>
          `;
        } else {
          html += `
            <button type="button" onclick="showBroadcastModal(${minutesUntilAvailable})"
                    class="match-server-pill opacity-60 cursor-not-allowed">
              <span class="indicator-dot bg-muted-foreground"></span>
              <span>${sName}</span>
            </button>
          `;
        }
      });

      html += `
            </div>
          </div>
        </div>
      `;
    }

    // 3. OFFICIAL TV CHANNELS
    if (hasChannels) {
      html += `
        <div class="card card--default" data-slot="card">
          <div class="card__header flex items-center justify-between py-3 px-4 border-b border-border/30">
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-primary">
                <path d="M2 11C2 7.70017 2 6.05025 3.02513 5.02513C4.05025 4 5.70017 4 9 4H15C18.2998 4 19.9497 4 20.9749 5.02513C22 6.05025 22 7.70017 22 11C22 14.2998 22 15.9497 20.9749 16.9749C19.9497 18 18.2998 18 15 18H9C5.70017 18 4.05025 18 3.02513 16.9749C2 15.9497 2 14.2998 2 11Z" stroke="currentColor" stroke-width="1.5"></path>
                <path d="M11 15V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                <path d="M13 15V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
              </svg>
              <h4 class="text-sm sm:text-base font-semibold" data-i18n="match.broadcast.title">${lblChannels}</h4>
            </div>
          </div>
          <div class="card__content p-4">
            <div class="flex flex-wrap gap-2">
      `;

      channels.forEach(ch => {
        const countryCode = (ch.country || "").toLowerCase();
        const safeName = (ch.name || "").replace(/'/g, "\'");

        if (ch.streamUrl && isClickable) {
          html += `
            <button type="button"
                    onclick="window.switchMatchPlayer(null, '${safeName}', '${ch.streamUrl}')"
                    class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary hover:bg-surface-secondary/80 text-xs font-medium border border-border/50 transition-colors cursor-pointer">
              ${countryCode ? `<img src="https://flagcdn.com/16x12/${countryCode}.png" alt="${ch.country}" class="w-4 h-3 object-cover rounded-sm" onerror="this.style.display='none'">` : ""}
              <span class="font-medium">${ch.name}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">STREAM</span>
            </button>
          `;
        } else {
          html += `
            <div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-secondary/60 text-xs text-muted-foreground border border-border/30">
              ${countryCode ? `<img src="https://flagcdn.com/16x12/${countryCode}.png" alt="${ch.country}" class="w-4 h-3 object-cover rounded-sm opacity-60" onerror="this.style.display='none'">` : ""}
              <span>${ch.name}</span>
            </div>
          `;
        }
      });

      html += `
            </div>
          </div>
        </div>
      `;
    }

    // Helper text if not clickable
    if (!isClickable && (hasChannels || hasStreams)) {
      html += `
        <div class="card card--default px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground border border-border/30">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4 flex-shrink-0 text-primary">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="1.5"></path>
            <path d="M12 8V12L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <span data-i18n="match.broadcast.availableSoon">${lblAvailableSoon}</span>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

    // Show modal when user clicks on unavailable broadcast link
  window.showBroadcastModal = function(minutesUntilAvailable) {
    const lang = normalizeLang(getLang());
    const lblNotYetAvailable = t(lang, "match.broadcast.notYetAvailable") || "Not yet available";
    const lblModalText = t(lang, "match.broadcast.modalText") || "Broadcast links become active 15 minutes before the match starts.";
    const lblAvailableIn = t(lang, "match.broadcast.availableIn") || "Available in approximately";
    const lblMinutes = t(lang, "match.broadcast.minutes") || "minutes";
    const lblClose = t(lang, "ui.close") || "Close";

    // Remove existing modal if any
    const existingModal = document.getElementById("broadcastModal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "broadcastModal";
    modal.className = "flex items-center justify-center p-4";
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;z-index:9999;";
    modal.innerHTML = `
      <div class="absolute inset-0 backdrop-blur-sm" style="background:rgba(0,0,0,0.85);" onclick="closeBroadcastModal()"></div>
      <div class="relative bg-surface rounded-xl shadow-2xl max-w-sm w-full p-6 border border-border ring-1 ring-white/20" style="z-index:10000;">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-full bg-amber-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-6 h-6 text-amber-500">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="1.5"></path>
              <path d="M12 8V12L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold">${lblNotYetAvailable}</h3>
        </div>
        <p class="text-muted-foreground text-sm mb-4">${lblModalText}</p>
        ${minutesUntilAvailable > 0 ? `
          <div class="flex items-center gap-2 text-sm bg-surface-secondary rounded-lg px-3 py-2 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" class="w-4 h-4 text-primary">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="1.5"></path>
              <path d="M12 8V12L14.5 14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span>${lblAvailableIn} <strong>${minutesUntilAvailable}</strong> ${lblMinutes}</span>
          </div>
        ` : ""}
        <button type="button" onclick="closeBroadcastModal()"
                class="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
          ${lblClose}
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  };

  window.closeBroadcastModal = function() {
    const modal = document.getElementById("broadcastModal");
    if (modal) modal.remove();
  };

  // Initialize match page
  async function initMatchPage() {
    const container = document.getElementById("matchDetailContainer");
    if (!container) return;

    const matchID = getMatchIDFromURL();
    if (!matchID) {
      container.innerHTML = `
        <div class="card card--default p-6 text-center">
          <p class="text-muted-foreground">Invalid match URL</p>
        </div>
      `;
      return;
    }

    // Show loading state
    container.innerHTML = `
      <div class="card card--default p-6">
        <div class="flex items-center justify-center gap-3">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span class="text-muted-foreground">Loading match data...</span>
        </div>
      </div>
    `;

    try {
      // Check if this is a custom event
      if (isCustomEvent(matchID)) {
        const customData = await fetchCustomEventData(matchID);

        if (!customData) {
          container.innerHTML = `
            <div class="card card--default p-6 text-center">
              <p class="text-muted-foreground">Event not found.</p>
            </div>
          `;
          return;
        }

        // Render custom event page (simplified, broadcast-only)
        renderCustomEventPage(container, customData);
        setupTabClickHandlers();

        // Store for refresh
        sessionStorage.setItem("currentMatchID", matchID);
        sessionStorage.setItem(`time_${matchID}`, String(customData.startTs));
        sessionStorage.setItem(`status_${matchID}`, customData.status);

        // Start live refresh if in progress
        if (customData.status === "2") {
          startCustomEventRefresh(matchID);
        } else if (customData.status === "1") {
          // For not-started custom events: start broadcast refresh
          startBroadcastRefresh(matchID);
        }

        // Re-render on language change
        document.addEventListener("langchange", async () => {
          const refreshedData = await fetchCustomEventData(matchID);
          if (refreshedData) {
            renderCustomEventPage(container, refreshedData);
            setupTabClickHandlers();
          }
        });

        return;
      }

      // Regular Flashscore match - fetch all data in parallel
      const [teamData, matchData, matchInfo] = await Promise.all([
        fetchTeamData(matchID),
        fetchMatchData(matchID),
        fetchMatchInfo(matchID)
      ]);

      // Render the page
      renderMatchPage(container, teamData, matchData, matchInfo);

      // Setup tab click handlers
      setupTabClickHandlers();

      // Immediately activate and load the stream player for live and scheduled matches
      const showBroadcast = matchData?.status === "1" || matchData?.status === "2";
      if (showBroadcast) {
        loadTabContent("broadcast");
      }

      // Start live refresh if match is in progress
      if (matchData?.status === "2") {
        startLiveRefresh(matchID);
      } else if (matchData?.status === "1") {
        // For not-started matches: start pre-match refresh to detect when it goes live
        // and broadcast refresh to update link availability
        startPreMatchRefresh(matchID, container);
        startBroadcastRefresh(matchID);
      }

      // Store match ID for TV channels etc.
      sessionStorage.setItem("currentMatchID", matchID);
      if (matchData?.timestamp) {
        sessionStorage.setItem(`time_${matchID}`, matchData.timestamp);
      }
      if (matchData?.status) {
        sessionStorage.setItem(`status_${matchID}`, matchData.status);
      }

      // Re-render on language change
      document.addEventListener("langchange", () => {
        if (currentMatchData) {
          renderMatchPage(container, currentMatchData.teamData, currentMatchData.matchData, currentMatchData.matchInfo);
          setupTabClickHandlers();
        }
      });

    } catch (e) {
      console.error("Failed to load match:", e);
      container.innerHTML = `
        <div class="card card--default p-6 text-center">
          <p class="text-muted-foreground">Failed to load match data. Please try again later.</p>
        </div>
      `;
    }
  }

  // ---------------------------
  // INIT
  // ---------------------------
  async function init() {
    const lang = normalizeLang(await detectLangOnce());

    try { await loadLangFile("en"); } catch (e) { console.warn(e); }
    try { await loadLangFile(lang); } catch (e) { console.warn(e); }

    applyI18n(lang);
    setupLangModal();
    setupTheme();
    setupDesktopMore();
    setupMobileSports();

    // Initialize match page if we're on a match page
    // Supports: /match/... or /{sport}/match/...
    const path = window.location.pathname;
    if (path.startsWith("/match") || path.match(/^\/[^\/]+\/match\//)) {
      initMatchPage();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init());
  } else {
    init();
  }

  // Modal player for match page
  window.openBroadcastStream = function(url, title) {
    let modal = document.getElementById("broadcastPlayerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "broadcastPlayerModal";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md";
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-surface border border-border rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-secondary/40">
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-red-600/20 text-red-400 border border-red-500/30">
              <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>LIVE
            </span>
            <h3 class="font-bold text-foreground text-base truncate">${title || "Live Stream"}</h3>
          </div>
          <button type="button" onclick="closeBroadcastStream()" class="p-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-muted-foreground hover:text-foreground transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden">
          <iframe id="broadcastPlayerIframe" src="${url}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
        </div>
        <div class="flex items-center justify-between px-5 py-3 border-t border-border bg-surface-secondary/40 text-sm">
          <span class="text-xs text-muted-foreground">Stream provided by high-speed edge CDN</span>
          <a href="${url}" target="_blank" class="text-xs px-3 py-1.5 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-foreground border border-border">
            Open External
          </a>
        </div>
      </div>
    `;

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  };

  window.closeBroadcastStream = function() {
    const modal = document.getElementById("broadcastPlayerModal");
    if (modal) {
      const iframe = document.getElementById("broadcastPlayerIframe");
      if (iframe) iframe.src = "";
      modal.remove();
    }
    document.body.style.overflow = "";
  };

})();
