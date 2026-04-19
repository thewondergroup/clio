// Menus page — tab switching
(function () {
  'use strict';

  const tabs = document.querySelectorAll('.menu-tab');
  const panels = document.querySelectorAll('.menu-panel');

  // Support #wine / #drinks hash on load
  const hash = (window.location.hash || '').replace('#', '');
  if (hash && document.getElementById(hash)) {
    tabs.forEach(function (t) {
      const match = t.dataset.target === hash;
      t.classList.toggle('active', match);
      t.setAttribute('aria-selected', match ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      p.classList.toggle('active', p.id === hash);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      const target = tab.dataset.target;

      tabs.forEach(function (t) {
        t.classList.toggle('active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });

      panels.forEach(function (p) {
        p.classList.toggle('active', p.id === target);
      });

      // Update hash without triggering scroll
      history.replaceState(null, '', '#' + target);

      // Scroll tabs into view on mobile so the menu starts at top
      const wrap = document.querySelector('.menu-tabs-wrap');
      if (wrap) {
        const top = wrap.getBoundingClientRect().top + window.scrollY - 20;
        if (window.scrollY > top) {
          window.scrollTo({ top: top, behavior: 'smooth' });
        }
      }
    });
  });
})();
