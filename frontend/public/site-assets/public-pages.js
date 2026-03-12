document.querySelectorAll('.site-menu-toggle').forEach((button) => {
  const header = button.closest('.site-header');
  const icon = button.querySelector('[data-menu-icon]');
  const closeText = button.dataset.closeLabel || 'Close navigation';
  const openText = button.dataset.openLabel || 'Open navigation';

  if (!header) {
    return;
  }

  const sync = () => {
    const expanded = header.classList.contains('menu-open');
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('aria-label', expanded ? closeText : openText);
    if (icon) {
      icon.textContent = expanded ? 'close' : 'menu';
    }
  };

  button.addEventListener('click', () => {
    header.classList.toggle('menu-open');
    sync();
  });

  header.querySelectorAll('.site-nav a, .site-header-cta').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        header.classList.remove('menu-open');
        sync();
      }
    });
  });

  window.addEventListener('resize', () => {
    if (!window.matchMedia('(max-width: 760px)').matches) {
      header.classList.remove('menu-open');
      sync();
    }
  });

  sync();
});
