// Gallery — lightbox
(function () {
  'use strict';

  const items = Array.from(document.querySelectorAll('.masonry-item img'));
  const lightbox = document.getElementById('lightbox');
  if (!lightbox || !items.length) return;

  const lbImage = lightbox.querySelector('.lightbox-image');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');

  let current = 0;

  function open(index) {
    current = index;
    lbImage.src = items[current].src;
    lbImage.alt = items[current].alt;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function navigate(delta) {
    current = (current + delta + items.length) % items.length;
    lbImage.src = items[current].src;
    lbImage.alt = items[current].alt;
  }

  items.forEach(function (img, i) {
    img.parentElement.addEventListener('click', function () { open(i); });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', function (e) { e.stopPropagation(); navigate(-1); });
  nextBtn.addEventListener('click', function (e) { e.stopPropagation(); navigate(1); });

  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox || e.target === lbImage) close();
  });

  document.addEventListener('keydown', function (e) {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
})();
