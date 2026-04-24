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
    "REPLACE_WITH_COCKTAILS_CSV_URL",
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
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows
    .slice(1)
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
 * Cocktails — similar to food menu, with description rendered alongside dish name.
 * Sections: Cocktails, Mocktails, Beers, Dessert cocktails.
 */
function renderCocktails(items, container) {
  const sections = groupBySection(items);
  if (!sections.size) throw new Error("No cocktail items");

  const html = [];
  sections.forEach((drinks, sectionName) => {
    const parts = sectionName.split("·").map((s) => s.trim());
    const eyebrow = parts[0];
    const titleText = parts[1] || parts[0];

    html.push('<div class="menu-section">');
    html.push('<div class="menu-section-head">');
    html.push(`<span class="eyebrow green">${escapeHtml(eyebrow)}</span>`);
    html.push(`<h2 class="display-md">${escapeHtml(titleText)}.</h2>`);
    html.push("</div>");
    html.push('<ul class="menu-list">');
    drinks.forEach((d) => {
      if (!d.name) return;
      const price = d.price ? `<span class="dish-price">${escapeHtml(d.price)}</span>` : "";
      const desc = d.description
        ? `<span class="dish-desc">${escapeHtml(d.description)}</span>`
        : "";
      html.push(
        `<li>
          <div class="dish-details">
            <span class="dish-name">${escapeHtml(d.name)}</span>
            ${desc}
          </div>
          <span class="dish-dots"></span>
          ${price}
        </li>`
      );
    });
    html.push("</ul>");
    html.push("</div>");
  });

  container.innerHTML = html.join("");
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
  const faqs = items.filter((f) => f.question && f.question.trim());
  if (!faqs.length) throw new Error("No FAQs");

  const html = faqs
    .map(
      (f) => `
    <details class="faq reveal">
      <summary><span>${escapeHtml(f.question)}</span><span class="faq-icon">+</span></summary>
      <div class="faq-body"><p>${linkify(escapeHtml(f.answer || ""))}</p></div>
    </details>`
    )
    .join("");

  container.innerHTML = html;
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

/* ---------------------------------------------------------------------------
   Run on DOM ready
   --------------------------------------------------------------------------- */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initFoodMenu();
    initWineList();
    initHours();
    initHoursSummary();
    initFaqs();
    initCocktails();
  });
} else {
  initFoodMenu();
  initWineList();
  initHours();
  initHoursSummary();
  initFaqs();
  initCocktails();
}
