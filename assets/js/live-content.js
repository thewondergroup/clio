/**
 * Clio — Live content from Google Sheets
 *
 * Fetches CSV data from three published Google Sheets tabs:
 * - Food Menu
 * - Wine List
 * - Hours
 *
 * On success: replaces the hardcoded fallback with live data.
 * On failure (network/timeout/parse error): leaves the hardcoded fallback visible.
 */

const SHEETS = {
  foodMenu:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQnXCsXfVUyRPiVxyLBVAtTr2VCjyiiZ335Ge071E9d--GWjrhDkNNqEtV9AKvHvaRPMpXRTsc9Om/pub?gid=1774257899&single=true&output=csv",
  wineList:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQnXCsXfVUyRPiVxyLBVAtTr2VCjyiiZ335Ge071E9d--GWjrhDkNNqEtV9AKvHvaRPMpXRTsc9Om/pub?gid=1241872791&single=true&output=csv",
  hours:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQnXCsXfVUyRPiVxyLBVAtTr2VCjyiiZ335Ge071E9d--GWjrhDkNNqEtV9AKvHvaRPMpXRTsc9Om/pub?gid=1300062983&single=true&output=csv",
  faqs:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQnXCsXfVUyRPiVxyLBVAtTr2VCjyiiZ335Ge071E9d--GWjrhDkNNqEtV9AKvHvaRPMpXRTsc9Om/pub?gid=1701402900&single=true&output=csv",
  cocktails:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQnXCsXfVUyRPiVxyLBVAtTr2VCjyiiZ335Ge071E9d--GWjrhDkNNqEtV9AKvHvaRPMpXRTsc9Om/pub?gid=1866124573&single=true&output=csv",
  setLunch:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjQnXCsXfVUyRPiVxyLBVAtTr2VCjyiiZ335Ge071E9d--GWjrhDkNNqEtV9AKvHvaRPMpXRTsc9Om/pub?gid=1968464026&single=true&output=csv",
};

// Events Pack lead capture
const EVENTS_PACK = {
  // Paste the Apps Script /exec URL here after deployment
  endpoint: "REPLACE_WITH_APPS_SCRIPT_URL",
  // Path to the downloadable PDF
  pdfUrl: "/assets/downloads/clio-events-pack.pdf",
  // Filename saved on the user's device
  filename: "Clio-Events-Pack.pdf",
};

const FETCH_TIMEOUT_MS = 4000;

/* ---------------------------------------------------------------------------
   CSV parsing — handles quoted fields with commas inside
   --------------------------------------------------------------------------- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (c === "\r") {
        // ignore
      } else {
        field += c;
      }
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  // Find the header row rather than assuming it's row 1 — the team may add
  // blank or title rows above it. Prefer a row containing a known column
  // name; otherwise use the first row with at least two filled cells.
  const KNOWN = ["section", "name", "day", "question"];
  const clean = (r) => r.map((c) => (c || "").trim().toLowerCase());
  let h = rows.findIndex((r) => clean(r).some((c) => KNOWN.includes(c)));
  if (h === -1) h = rows.findIndex((r) => clean(r).filter(Boolean).length >= 2);
  if (h === -1) return [];
  const headers = clean(rows[h]);
  return rows
    .slice(h + 1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (row[i] || "").trim();
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => v !== ""));
}

/* ---------------------------------------------------------------------------
   Fetch with timeout
   --------------------------------------------------------------------------- */
async function fetchCSV(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return rowsToObjects(parseCSV(text));
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ---------------------------------------------------------------------------
   Group items by section, preserving first-seen section order
   --------------------------------------------------------------------------- */
function groupBySection(items) {
  const sections = new Map();
  items.forEach((item) => {
    const section = item.section || "";
    if (!section) return;
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(item);
  });
  return sections;
}

/* ---------------------------------------------------------------------------
   Renderers
   --------------------------------------------------------------------------- */
function renderFoodMenu(items, container) {
  const sections = groupBySection(items);
  if (!sections.size) throw new Error("No food items");

  const html = [];
  sections.forEach((dishes, sectionName) => {
    // Support "Section · Subsection" → use second half as title if present
    const parts = sectionName.split("·").map((s) => s.trim());
    const eyebrow = parts[0];
    const titleText = parts[1] || parts[0];

    html.push('<div class="menu-section">');
    html.push('<div class="menu-section-head">');
    html.push(`<span class="eyebrow green">${escapeHtml(eyebrow)}</span>`);
    html.push(`<h2 class="display-md">${escapeHtml(titleText)}.</h2>`);
    html.push("</div>");
    html.push('<ul class="menu-list">');
    dishes.forEach((d) => {
      if (!d.name) return;
      const price = d.price
        ? `<span class="dish-price">${escapeHtml(d.price)}${
            d.per ? ` <span class="per">${escapeHtml(d.per)}</span>` : ""
          }</span>`
        : "";
      const desc = d.description
        ? `<span class="dish-desc">${escapeHtml(d.description)}</span>`
        : "";
      html.push(
        `<li><span class="dish-name">${escapeHtml(d.name)}${desc}</span><span class="dish-dots"></span>${price}</li>`
      );
    });
    html.push("</ul>");
    html.push("</div>");
  });

  container.innerHTML = html.join("");
}

/**
 * Cocktails — rebuilds the original two-column drinks layout from the sheet.
 *  - First section (Cocktails) on the left
 *  - Mocktails, Beers and any other sections stacked on the right
 *  - Dessert cocktails full width underneath, titled "To finish."
 * Rows with a description get the name/description style; rows without get
 * the name · · · price style. A trailing "4.6%" in a name becomes small ABV text.
 * If every row in a section has the same description (e.g. "330ml") it is
 * shown once under the heading instead of on every row.
 */
const DRINK_TITLES = {
  cocktails: "Cocktails",
  mocktails: "Without alcohol",
  beers: "Beer",
  beer: "Beer",
  "dessert cocktails": "To finish",
};

function renderCocktails(items, container) {
  const sections = groupBySection(items);
  if (!sections.size) throw new Error("No cocktail items");

  const esc = escapeHtml;

  function itemHtml(d, sharedNote) {
    if (!d.name) return "";
    const price = d.price ? `<span class="dish-price">${esc(d.price)}</span>` : "";
    const desc = sharedNote ? "" : (d.description || "").trim();
    if (desc) {
      return `<li><div class="dish-details"><span class="dish-name">${esc(d.name)}</span><span class="dish-desc">${esc(desc)}</span></div>${price}</li>`;
    }
    const m = d.name.match(/^(.*?)\s+(\d+(?:[.,]\d+)?%)$/);
    const name = m
      ? `${esc(m[1])} <span class="abv">${esc(m[2])}</span>`
      : esc(d.name);
    return `<li><span class="dish-name">${name}</span><span class="dish-dots"></span>${price}</li>`;
  }

  function sectionHtml(sectionName, drinks, splitList) {
    const key = sectionName.trim().toLowerCase();
    const title = DRINK_TITLES[key] || sectionName;
    const descs = drinks.map((d) => (d.description || "").trim());
    const shared =
      drinks.length > 1 && descs[0] && descs.every((x) => x === descs[0])
        ? descs[0]
        : "";
    const rows = drinks.map((d) => itemHtml(d, shared));
    let lists;
    if (splitList && rows.length > 4) {
      const half = Math.ceil(rows.length / 2);
      lists = `<div class="menu-section-two-col"><ul class="menu-list">${rows
        .slice(0, half)
        .join("")}</ul><ul class="menu-list">${rows.slice(half).join("")}</ul></div>`;
    } else {
      lists = `<ul class="menu-list">${rows.join("")}</ul>`;
    }
    return `<div class="menu-section">
      <div class="menu-section-head">
        <span class="eyebrow green">${esc(sectionName)}</span>
        <h2 class="display-md">${esc(title)}.</h2>
        ${shared ? `<p class="glass-note small">${esc(shared)}</p>` : ""}
      </div>
      ${lists}
    </div>`;
  }

  const entries = Array.from(sections.entries());
  const isFinish = ([name]) => /dessert|digestiv/i.test(name);
  const main = entries.filter((e) => !isFinish(e));
  const finish = entries.filter(isFinish);

  const html = [];
  if (main.length === 1) {
    html.push(sectionHtml(main[0][0], main[0][1], true));
  } else if (main.length > 1) {
    const [first, ...rest] = main;
    html.push('<div class="menu-section-two-col">');
    html.push(sectionHtml(first[0], first[1], false));
    html.push("<div>" + rest.map(([n, d]) => sectionHtml(n, d, false)).join("") + "</div>");
    html.push("</div>");
  }
  finish.forEach(([n, d]) => html.push(sectionHtml(n, d, true)));

  container.innerHTML = html.join("");
  console.log(`Cocktails loaded from Sheet: ${items.length} rows`);
}

/**
 * Set Lunch — handles special meta rows for headline and pricing, then menu sections.
 * Returns { hasDishes: true/false } so the caller can hide the tab if empty.
 */
function renderSetLunch(items, container) {
  // Separate meta rows from menu rows
  const meta = {};
  const menuRows = [];
  items.forEach((r) => {
    if (!r.section) return;
    if (r.section === "_offer_headline") {
      meta.headline = r.name || "";
      meta.subhead = r.description || "";
    } else if (r.section === "_offer_pricing") {
      meta.pricing = r.name || "";
    } else {
      menuRows.push(r);
    }
  });

  const menuSections = groupBySection(menuRows);
  const hasDishes = menuSections.size > 0;

  if (!hasDishes && !meta.headline) {
    // Nothing to show
    return { hasDishes: false };
  }

  const html = [];

  // Offer header block
  html.push('<div class="set-lunch-header">');
  if (meta.headline) {
    html.push('<div class="menu-section-head">');
    html.push(`<span class="eyebrow green">Offer</span>`);
    html.push(`<h2 class="display-md">${escapeHtml(meta.headline)}.</h2>`);
    if (meta.subhead) {
      html.push(`<p class="set-lunch-availability">${escapeHtml(meta.subhead)}</p>`);
    }
    if (meta.pricing) {
      html.push(`<p class="set-lunch-pricing">${escapeHtml(meta.pricing)}</p>`);
    }
    html.push("</div>");
  }
  html.push("</div>");

  // Menu sections
  menuSections.forEach((dishes, sectionName) => {
    html.push('<div class="menu-section">');
    html.push('<div class="menu-section-head">');
    html.push(`<span class="eyebrow green">${escapeHtml(sectionName)}</span>`);
    html.push("</div>");
    html.push('<ul class="menu-list">');
    dishes.forEach((d) => {
      if (!d.name) return;
      const desc = d.description
        ? `<span class="dish-desc">${escapeHtml(d.description)}</span>`
        : "";
      html.push(
        `<li>
          <div class="dish-details">
            <span class="dish-name">${escapeHtml(d.name)}</span>
            ${desc}
          </div>
        </li>`
      );
    });
    html.push("</ul>");
    html.push("</div>");
  });

  container.innerHTML = html.join("");
  return { hasDishes };
}

function renderWineList(items, container) {
  const sections = groupBySection(items);
  if (!sections.size) throw new Error("No wine items");

  const html = [];
  sections.forEach((wines, sectionName) => {
    const parts = sectionName.split("-").map((s) => s.trim());
    const eyebrow = parts.length > 1 ? `${parts[0]} · ${parts[1]}` : parts[0];
    const titleText = parts.length > 1 ? parts[1] : parts[0];

    html.push('<div class="menu-section">');
    html.push('<div class="menu-section-head">');
    html.push(`<span class="eyebrow green">${escapeHtml(eyebrow)}</span>`);
    html.push(`<h2 class="display-md">${escapeHtml(titleText)}.</h2>`);
    html.push("</div>");
    html.push('<ul class="menu-list wine-list">');
    wines.forEach((w) => {
      if (!w.name) return;
      const meta = [w.region, w.grape].filter(Boolean).join(" · ");
      const price = w.price ? `<span class="wine-price">${escapeHtml(w.price)}</span>` : "";
      const metaHtml = meta ? `<span class="wine-meta">${escapeHtml(meta)}</span>` : "";
      html.push(
        `<li><span class="wine-name">${escapeHtml(w.name)}${metaHtml}</span>${price}</li>`
      );
    });
    html.push("</ul>");
    html.push("</div>");
  });

  container.innerHTML = html.join("");
}

function renderHours(rows, container) {
  if (!rows.length) throw new Error("No hours data");

  // Check if all days have identical lunch + dinner (common case)
  const allSame =
    rows.length > 1 &&
    rows.every(
      (r) => r.lunch === rows[0].lunch && r.dinner === rows[0].dinner
    );

  const html = ['<dl class="hours-list">'];

  if (allSame) {
    const r = rows[0];
    if (r.lunch && r.lunch.toLowerCase() !== "closed") {
      html.push(`<div><dt>Lunch</dt><dd>${escapeHtml(r.lunch)}</dd></div>`);
    }
    if (r.dinner && r.dinner.toLowerCase() !== "closed") {
      html.push(`<div><dt>Dinner</dt><dd>${escapeHtml(r.dinner)}</dd></div>`);
    }
    html.push(`<div><dt>Days</dt><dd>Open every day</dd></div>`);
  } else {
    rows.forEach((r) => {
      if (!r.day) return;
      const lunch = r.lunch && r.lunch.toLowerCase() !== "closed" ? r.lunch : "";
      const dinner = r.dinner && r.dinner.toLowerCase() !== "closed" ? r.dinner : "";

      let times = "Closed";
      if (lunch && dinner) {
        times = `${escapeHtml(lunch)}<br/>${escapeHtml(dinner)}`;
      } else if (lunch) {
        times = escapeHtml(lunch);
      } else if (dinner) {
        times = escapeHtml(dinner);
      }

      html.push(`<div><dt>${escapeHtml(r.day)}</dt><dd>${times}</dd></div>`);
    });
  }

  html.push("</dl>");
  container.innerHTML = html.join("");
}

/**
 * Compact one-paragraph summary for use in the homepage hours block.
 * Chooses a smart phrasing based on whether all days share hours.
 */
function renderHoursSummary(rows, container) {
  if (!rows.length) throw new Error("No hours data");

  const allSame =
    rows.length > 1 &&
    rows.every(
      (r) => r.lunch === rows[0].lunch && r.dinner === rows[0].dinner
    );

  // Shorthand a time string like "12:00 – 15:00" → "12–3pm"
  const shortenTime = (t) => {
    if (!t) return "";
    // Match "12:00 – 15:00" style
    const m = t.match(/^(\d{1,2}):?(\d{0,2})\s*[–-]\s*(\d{1,2}):?(\d{0,2})/);
    if (!m) return t;
    const h1 = parseInt(m[1], 10);
    const h2 = parseInt(m[3], 10);
    const fmt = (h) => {
      if (h === 0 || h === 24) return "12am";
      if (h < 12) return `${h}am`;
      if (h === 12) return "12pm";
      return `${h - 12}pm`;
    };
    return `${fmt(h1)}–${fmt(h2)}`;
  };

  let summaryHtml = "";

  if (allSame) {
    const r = rows[0];
    const lunch = r.lunch && r.lunch.toLowerCase() !== "closed" ? shortenTime(r.lunch) : "";
    const dinner = r.dinner && r.dinner.toLowerCase() !== "closed" ? shortenTime(r.dinner) : "";
    const services = [];
    if (lunch) services.push(`Lunch ${lunch}`);
    if (dinner) services.push(`Dinner ${dinner}`);
    summaryHtml = `<p>Open every day<br/>${services.join(" · ")}</p>`;
  } else {
    // Fallback for varying days: just list the first day's hours and point to visit page
    const openDays = rows.filter(
      (r) =>
        (r.lunch && r.lunch.toLowerCase() !== "closed") ||
        (r.dinner && r.dinner.toLowerCase() !== "closed")
    );
    if (openDays.length === 0) {
      summaryHtml = `<p>Please see our visit page for opening hours</p>`;
    } else {
      const first = openDays[0].day || "";
      const last = openDays[openDays.length - 1].day || "";
      const range = first === last ? first : `${first} – ${last}`;
      summaryHtml = `<p>${escapeHtml(range)}<br/>Lunch · Dinner</p>`;
    }
  }

  container.innerHTML = summaryHtml;
}

/**
 * FAQs — renders question/answer pairs as <details> elements
 * matching the existing .faq markup.
 */
function renderFaqs(items, container) {
  if (!items || !items.length) {
    console.warn("FAQs sheet returned no rows. Keeping fallback.");
    return;
  }

  // Log what columns we actually got, to help diagnose if headers are wrong
  const sampleKeys = Object.keys(items[0] || {});
  if (!sampleKeys.includes("question") || !sampleKeys.includes("answer")) {
    console.warn("FAQs sheet is missing required columns. Got:", sampleKeys, "Expected: question, answer. Keeping fallback.");
    return;
  }

  const faqs = items.filter((f) => f.question && f.question.trim());
  if (!faqs.length) {
    console.warn("FAQs sheet has no valid rows (all question cells empty). Keeping fallback.");
    return;
  }

  const html = faqs
    .map(
      (f) => `
    <details class="faq">
      <summary><span>${escapeHtml(f.question)}</span><span class="faq-icon">+</span></summary>
      <div class="faq-body"><p>${linkify(escapeHtml(f.answer || ""))}</p></div>
    </details>`
    )
    .join("");

  container.innerHTML = html;
  console.log(`FAQs loaded from Sheet: ${faqs.length} items`);
}

/**
 * Very small helper — turns email addresses and URLs in plain text into links.
 * Runs after escapeHtml so HTML is safe.
 */
function linkify(html) {
  return html
    .replace(
      /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/g,
      '<a href="mailto:$1">$1</a>'
    )
    .replace(
      /(\bhttps?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
}

/* ---------------------------------------------------------------------------
   Utility
   --------------------------------------------------------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------------------------------------------------------------------------
   Initialisers — called from page HTML
   --------------------------------------------------------------------------- */
async function initFoodMenu() {
  const container = document.querySelector('[data-live="food-menu"]');
  if (!container) return;
  try {
    const data = await fetchCSV(SHEETS.foodMenu);
    renderFoodMenu(data, container);
  } catch (err) {
    console.warn("Food menu failed to load from Sheet, using fallback:", err);
    // Fallback is already in the HTML — do nothing
  }
}

async function initWineList() {
  const container = document.querySelector('[data-live="wine-list"]');
  if (!container) return;
  try {
    const data = await fetchCSV(SHEETS.wineList);
    renderWineList(data, container);
  } catch (err) {
    console.warn("Wine list failed to load from Sheet, using fallback:", err);
  }
}

async function initHours() {
  const container = document.querySelector('[data-live="hours"]');
  if (!container) return;
  try {
    const data = await fetchCSV(SHEETS.hours);
    renderHours(data, container);
  } catch (err) {
    console.warn("Hours failed to load from Sheet, using fallback:", err);
  }
}

async function initHoursSummary() {
  const container = document.querySelector('[data-live="hours-summary"]');
  if (!container) return;
  try {
    const data = await fetchCSV(SHEETS.hours);
    renderHoursSummary(data, container);
  } catch (err) {
    console.warn("Hours summary failed to load from Sheet, using fallback:", err);
  }
}

async function initFaqs() {
  const container = document.querySelector('[data-live="faqs"]');
  if (!container) return;
  if (!SHEETS.faqs || SHEETS.faqs.startsWith("REPLACE_")) return;
  try {
    const data = await fetchCSV(SHEETS.faqs);
    renderFaqs(data, container);
  } catch (err) {
    console.warn("FAQs failed to load from Sheet, using fallback:", err);
  }
}

async function initCocktails() {
  const container = document.querySelector('[data-live="cocktails"]');
  if (!container) return;
  if (!SHEETS.cocktails || SHEETS.cocktails.startsWith("REPLACE_")) return;
  try {
    const data = await fetchCSV(SHEETS.cocktails);
    renderCocktails(data, container);
  } catch (err) {
    console.warn("Cocktails failed to load from Sheet, using fallback:", err);
  }
}

async function initSetLunch() {
  const container = document.querySelector('[data-live="set-lunch"]');
  const homepagePromo = document.querySelector('[data-live="set-lunch-promo"]');
  const navLinks = document.querySelectorAll('[data-live-nav="set-lunch"]');
  const tabButton = document.querySelector('[data-live-tab="set-lunch"]');
  const tabPanel = document.querySelector('[data-live-panel="set-lunch"]');

  // If nothing on this page cares about Set Lunch, exit early
  if (!container && !homepagePromo && !navLinks.length) return;
  if (!SHEETS.setLunch || SHEETS.setLunch.startsWith("REPLACE_")) return;

  try {
    const data = await fetchCSV(SHEETS.setLunch);

    // Check if there are actual dishes (not just meta rows)
    const dishCount = data.filter(
      (r) => r.section && !r.section.startsWith("_offer_") && r.name
    ).length;

    if (dishCount > 0) {
      // Reveal everything Set Lunch related on this page
      navLinks.forEach((el) => (el.hidden = false));
      if (tabButton) tabButton.hidden = false;
      if (tabPanel) tabPanel.hidden = false;
      if (homepagePromo) homepagePromo.hidden = false;

      // Render into whichever containers exist on this page
      if (container) renderSetLunch(data, container);
      if (homepagePromo) renderSetLunchPromo(data, homepagePromo);

      console.log(`Set Lunch loaded from Sheet: ${dishCount} dishes`);
    } else {
      console.log("Set Lunch sheet is empty; keeping hidden");
    }
  } catch (err) {
    console.warn("Set Lunch failed to load from Sheet:", err);
  }
}

/**
 * Homepage promo — menu-style section with image, headline, availability, pricing, CTA.
 */
function renderSetLunchPromo(items, container) {
  const meta = {};
  items.forEach((r) => {
    if (r.section === "_offer_headline") {
      meta.headline = r.name || "";
      meta.subhead = r.description || "";
    } else if (r.section === "_offer_pricing") {
      meta.pricing = r.name || "";
    }
  });

  if (!meta.headline) return;

  const html = `
    <div class="set-lunch-promo-layout">
      <figure class="set-lunch-promo-image">
        <img src="assets/images/greek-salad.jpg" alt="Fresh Greek salad — tomato, feta, olives" loading="lazy" />
      </figure>
      <div class="set-lunch-promo-text">
        <span class="eyebrow green">Currently on offer</span>
        <h2 class="display-lg">${escapeHtml(meta.headline)}.</h2>
        <hr class="divider" />
        ${meta.pricing ? `<p class="set-lunch-promo-pricing">${escapeHtml(meta.pricing)}</p>` : ""}
        ${meta.subhead ? `<p class="lede">${escapeHtml(meta.subhead)}</p>` : ""}
        <a href="/set-lunch/" class="btn btn-outline" style="margin-top: 1.5rem;">View Set Lunch <span class="arrow">→</span></a>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

/**
 * Events Pack form — handles the download form on the private dining page.
 *
 * Behaviour:
 * 1. On submit, validate email
 * 2. Trigger the PDF download immediately (best UX — user gets what they came for)
 * 3. Send the lead details to Google Apps Script in the background
 * 4. Show a confirmation message
 *
 * The download works even if the Apps Script fails. The email/consent capture
 * is best-effort. This is intentional.
 */
function initEventsPackForm() {
  const form = document.getElementById("events-pack-form");
  if (!form) return;

  const status = form.querySelector(".events-pack-status");
  const submitBtn = form.querySelector(".events-pack-submit");
  const emailInput = form.querySelector("#ep-email");

  function setStatus(text, kind) {
    status.textContent = text;
    status.classList.remove("error", "success");
    if (kind) status.classList.add(kind);
  }

  function triggerDownload() {
    // Create a temporary link and click it to start the download
    const link = document.createElement("a");
    link.href = EVENTS_PACK.pdfUrl;
    link.download = EVENTS_PACK.filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function sendLead(payload) {
    if (!EVENTS_PACK.endpoint || EVENTS_PACK.endpoint.startsWith("REPLACE_")) {
      console.warn("Events pack endpoint not configured; skipping lead capture");
      return;
    }
    try {
      // Note: Apps Script web apps don't require CORS pre-flight when the
      // content-type is text/plain, so we send it that way to avoid an OPTIONS
      // request. The Apps Script parses e.postData.contents as JSON.
      await fetch(EVENTS_PACK.endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      console.log("Lead sent");
    } catch (err) {
      console.warn("Failed to send lead:", err);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email || !email.includes("@") || !email.includes(".")) {
      setStatus("Please enter a valid email address.", "error");
      emailInput.focus();
      return;
    }

    submitBtn.disabled = true;
    setStatus("Preparing your download…");

    const payload = {
      email: email,
      name: form.querySelector("#ep-name").value.trim(),
      phone: form.querySelector("#ep-phone").value.trim(),
      marketing_consent: form.querySelector("#ep-consent").checked,
      user_agent: navigator.userAgent,
    };

    // Trigger the download first — user gets what they came for even if
    // the lead capture fails
    triggerDownload();

    // Send the lead in the background
    await sendLead(payload);

    setStatus(
      "Thanks — your download has started. Any questions, drop us a line at hello@cliorestaurant.co.uk.",
      "success"
    );

    // Re-enable the button after a moment so they can download again if needed
    setTimeout(() => {
      submitBtn.disabled = false;
    }, 2000);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initFoodMenu();
    initWineList();
    initHours();
    initHoursSummary();
    initFaqs();
    initCocktails();
    initSetLunch();
    initEventsPackForm();
  });
} else {
  initFoodMenu();
  initWineList();
  initHours();
  initHoursSummary();
  initFaqs();
  initCocktails();
  initSetLunch();
  initEventsPackForm();
}

/* ---------------------------------------------------------------------------
   Promo pop-up — Xinomavro Day (Sunday 1 November 2026)
   - Shows once per visitor, 2.5 seconds after the page loads
   - Stops appearing automatically after the end date below
   - Add ?promo=1 to any page URL to preview it again
   To reuse for a future offer: change the PROMO settings and the id.
   --------------------------------------------------------------------------- */
(function () {
  const PROMO = {
    id: "xinomavro-day-2026",
    endsAt: Date.UTC(2026, 10, 1, 23, 59), // 1 Nov 2026, 23:59 London (GMT)
    eyebrow: "Sunday 1 November",
    title: "Xinomavro Day.",
    body:
      "Book a table for two or more and order three courses, and we'll bring a bottle of Xinomavro to the table, on us.",
    small: "Sunday 1 November only. One bottle per booking.",
    cta: "Book for 1 November",
    ctaUrl: "https://www.opentable.com/r/clio-restaurant-london",
    image: "/assets/images/interior-bar.jpg",
    imageAlt: "Tables laid with wine glasses in the dining room at Clio",
  };

  const force = /[?&]promo=1\b/.test(location.search);
  if (!force && Date.now() > PROMO.endsAt) return;

  const KEY = "clio-promo-seen-" + PROMO.id;
  try {
    if (!force && localStorage.getItem(KEY)) return;
  } catch (e) {}

  const css = `
  .clio-promo{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;
    background:rgba(29,22,27,.55);opacity:0;transition:opacity .35s ease}
  .clio-promo.open{opacity:1}
  .clio-promo-card{position:relative;display:grid;grid-template-columns:1fr 1fr;max-width:760px;width:100%;
    background:#3e2438;color:#f5ede0;border-radius:4px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);
    transform:translateY(16px);transition:transform .45s cubic-bezier(.2,.7,.2,1)}
  .clio-promo.open .clio-promo-card{transform:none}
  .clio-promo-img{min-height:100%;background:#2d1a28}
  .clio-promo-img img{display:block;width:100%;height:100%;object-fit:cover}
  .clio-promo-text{padding:44px 40px 36px;display:flex;flex-direction:column}
  .clio-promo-eyebrow{font-family:'Inter',sans-serif;font-size:.72rem;letter-spacing:.24em;text-transform:uppercase;color:#d9967f}
  .clio-promo-title{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;font-size:2.9rem;line-height:1;margin:.9rem 0 0;color:#f5ede0}
  .clio-promo-rule{width:48px;height:1px;background:rgba(245,237,224,.4);border:0;margin:1.4rem 0}
  .clio-promo-body{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:1.3rem;line-height:1.45;margin:0;color:#f5ede0}
  .clio-promo-small{font-family:'Inter',sans-serif;font-size:.8rem;line-height:1.5;opacity:.7;margin:1rem 0 0}
  .clio-promo-actions{margin-top:auto;padding-top:1.8rem;display:flex;flex-wrap:wrap;align-items:center;gap:1.1rem}
  .clio-promo-cta{display:inline-flex;align-items:center;gap:.6rem;padding:.95rem 1.6rem;border-radius:999px;background:#f5ede0;color:#3e2438;
    font-family:'Inter',sans-serif;font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;text-decoration:none;transition:background .2s}
  .clio-promo-cta:hover{background:#fff}
  .clio-promo-later{background:none;border:0;padding:0;color:#f5ede0;opacity:.7;cursor:pointer;
    font-family:'Inter',sans-serif;font-size:.8rem;text-decoration:underline;text-underline-offset:3px}
  .clio-promo-later:hover{opacity:1}
  .clio-promo-close{position:absolute;top:12px;right:12px;width:36px;height:36px;border-radius:50%;border:0;cursor:pointer;
    background:rgba(245,237,224,.12);color:#f5ede0;font-size:1.3rem;line-height:1}
  .clio-promo-close:hover{background:rgba(245,237,224,.25)}
  @media (max-width:640px){
    .clio-promo{align-items:flex-end;padding:0}
    .clio-promo-card{grid-template-columns:1fr;border-radius:12px 12px 0 0;max-height:92vh;overflow-y:auto}
    .clio-promo-img{height:180px}
    .clio-promo-text{padding:28px 24px 30px}
    .clio-promo-title{font-size:2.3rem}
    .clio-promo-body{font-size:1.15rem}
  }
  @media (prefers-reduced-motion:reduce){.clio-promo,.clio-promo-card{transition:none}}`;

  function show() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const wrap = document.createElement("div");
    wrap.className = "clio-promo";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "clio-promo-title");
    wrap.innerHTML = `
      <div class="clio-promo-card">
        <div class="clio-promo-img"><img src="${PROMO.image}" alt="${PROMO.imageAlt}" /></div>
        <div class="clio-promo-text">
          <span class="clio-promo-eyebrow">${PROMO.eyebrow}</span>
          <h2 class="clio-promo-title" id="clio-promo-title">${PROMO.title}</h2>
          <hr class="clio-promo-rule" />
          <p class="clio-promo-body">${PROMO.body}</p>
          <p class="clio-promo-small">${PROMO.small}</p>
          <div class="clio-promo-actions">
            <a class="clio-promo-cta" href="${PROMO.ctaUrl}" target="_blank" rel="noopener">${PROMO.cta} <span aria-hidden="true">→</span></a>
            <button type="button" class="clio-promo-later">Maybe later</button>
          </div>
        </div>
        <button type="button" class="clio-promo-close" aria-label="Close">×</button>
      </div>`;
    document.body.appendChild(wrap);

    const lastFocus = document.activeElement;
    function close() {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      wrap.classList.remove("open");
      document.removeEventListener("keydown", onKey);
      setTimeout(() => wrap.remove(), 350);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) { if (e.key === "Escape") close(); }

    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector(".clio-promo-close").addEventListener("click", close);
    wrap.querySelector(".clio-promo-later").addEventListener("click", close);
    wrap.querySelector(".clio-promo-cta").addEventListener("click", () => {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      if (window.dataLayer) window.dataLayer.push({ event: "promo_book_click", promo_id: PROMO.id });
    });
    document.addEventListener("keydown", onKey);

    requestAnimationFrame(() => {
      wrap.classList.add("open");
      wrap.querySelector(".clio-promo-cta").focus({ preventScroll: true });
    });
    if (window.dataLayer) window.dataLayer.push({ event: "promo_view", promo_id: PROMO.id });
  }

  function start() { setTimeout(show, force ? 300 : 2500); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
