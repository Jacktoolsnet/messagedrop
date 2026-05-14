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

  header.querySelectorAll('.site-nav a').forEach((link) => {
    link.addEventListener('click', () => {
      header.classList.remove('menu-open');
      sync();
    });
  });

  sync();
});

const faqItems = Array.from(document.querySelectorAll('details.faq-item'));
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) {
      return;
    }
    faqItems.forEach((other) => {
      if (other !== item && other.getAttribute('name') === item.getAttribute('name')) {
        other.open = false;
      }
    });
  });
});
