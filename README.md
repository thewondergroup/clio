# Clio Restaurant — Website

Static HTML/CSS/JS website for Clio, a modern Greek restaurant at 66 Chiltern Street, Marylebone, London.

## Pages

- `index.html` — Home
- `about.html` — About the restaurant and team
- `menus.html` — Food, wine, and cocktails (tabbed, with hash deep-links `#wine` and `#drinks`)
- `gallery.html` — Photo gallery with lightbox
- `private-dining.html` — Private dining & events with enquiry form
- `visit.html` — Address, hours, embedded Google Map, directions, FAQs

## Structure

```
clio/
├── index.html
├── about.html
├── menus.html
├── gallery.html
├── private-dining.html
├── visit.html
└── assets/
    ├── css/
    │   ├── main.css        (shared tokens, nav, footer, buttons)
    │   ├── home.css
    │   ├── about.css
    │   ├── menus.css
    │   ├── gallery.css
    │   ├── visit.css
    │   └── private.css
    ├── js/
    │   ├── main.js         (nav toggle, scroll reveals, header scroll state)
    │   ├── menus.js        (tab switching with hash sync)
    │   └── gallery.js      (lightbox)
    └── images/
        ├── logo-green.webp
        ├── logo-white.webp
        ├── logo-white-text.webp
        ├── favicon.webp
        └── [14 food and interior photographs]
```

## Design system

All tokens live in `:root` at the top of `main.css`.

**Colour palette**
- `--clio-green` `#3f4d21` — primary brand colour
- `--clio-green-deep` `#2d381a` — body text, footer, CTA sections
- `--clio-green-soft` `#5a6b35` — accent for italic grape names on wine list
- `--clio-green-wash` `#e8e8d8` — light green-tinted section background
- `--clio-terracotta-wash` `#ede0d0` — warm cream (used on "From the kitchen")
- `--clio-cream` / `--clio-paper` — neutral backgrounds
- `--clio-terracotta` `#b85840` — warm accent for eyebrows on dark backgrounds and a handful of secondary touches
- `--clio-aubergine` `#3e2438` — private dining enquiry section

**Typography**
- Display: Cormorant Garamond
- Body: Inter
- Both loaded from Google Fonts

## Deploy to GitHub Pages

1. Create a repo (e.g. `clio-website`)
2. Drop the entire contents of this folder into the repo root (not the `clio/` folder itself — just what's inside it)
3. Enable GitHub Pages in the repo settings, source branch `main`, folder `/` (root)
4. Add a custom domain in Pages settings if needed

No build step required. All assets are relative and load as pure static files.

## Things to confirm before launch

- [ ] **Opening hours on `visit.html` are placeholder** — confirm the real schedule (currently Tue–Fri lunch + dinner, Sat all-day, Sun lunch, closed Monday)
- [ ] **Email addresses** `hello@cliorestaurant.co.uk` and `events@cliorestaurant.co.uk` — make sure these exist and forward somewhere useful
- [ ] **Private dining pricing** — "from £65 / £85 / £120 per person" figures on `private-dining.html` are placeholder
- [ ] **Private dining capacities** — 14 / 6 / 70 seated / 100 standing numbers are placeholder
- [ ] **Enquiry form on `private-dining.html`** uses a `mailto:` action as a placeholder — swap to Formspree, Basin, or Netlify Forms before going live so submissions actually come through reliably
- [ ] **Meta descriptions** — currently say "in Marylebone"; could include Chiltern Street for SEO

## External services in use

- **Google Fonts** — Cormorant Garamond + Inter, loaded via CDN
- **Google Maps** — embedded iframe on `visit.html`, link opens `maps.app.goo.gl/aXBzYSzXdha7Y4KW9`
- **OpenTable** — booking button links to `https://www.opentable.co.uk/r/clio-restaurant-reservations-london?restref=470940&lang=en-GB&ot_source=Restaurant%20website`
- **Instagram** — footer and gallery page link to `https://www.instagram.com/clio.london/`

## Notes on editing

- Breakpoints: 1100px for dish grid, 900px for most two-column layouts, 700px for carousel swap, 600px for final mobile adjustments
- The homepage header starts transparent over the hero image; all other pages use `.solid` header
- Logo automatically swaps between white and green variants based on header state
- Dish grid on mobile is a scroll-snap horizontal carousel with a "Swipe for more" hint — driven entirely by CSS, no JavaScript
- Menu page tabs support URL hash deep-linking: `menus.html#wine` opens the Wine tab directly
