(() => {
  const navbar = document.querySelector('#navbar');
  const menu = document.querySelector('.nav-menu');
  const toggle = document.querySelector('.navbar-toggler');
  const setMenu = (open) => {
    navbar.classList.toggle('show', open);
    menu.classList.toggle('menu-is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setMenu(!navbar.classList.contains('show')));
  const links = [...navbar.querySelectorAll('a[href^="#"]')];
  links.forEach(link => link.addEventListener('click', event => {
    setMenu(false);
    if (link.getAttribute('href') === '#home') { event.preventDefault(); window.scrollTo({ top: 0 }); }
  }));
  document.querySelector('.navbar-brand').addEventListener('click', event => {
    event.preventDefault(); setMenu(false); window.scrollTo({ top: 0 });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { setMenu(false); toggle.focus(); }
  });
  const tabs = [...document.querySelectorAll('[data-toggle="tab"]')];
  const activateTab = (tab) => {
    tabs.forEach(item => {
      const active = item === tab;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.querySelector(item.getAttribute('href')).classList.toggle('active', active);
      document.querySelector(item.getAttribute('href')).classList.toggle('show', active);
    });
  };
  tabs.forEach((tab, index) => {
    const pane = document.querySelector(tab.getAttribute('href'));
    tab.id = `service-tab-${index}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', pane.id);
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', event => { event.preventDefault(); activateTab(tab); });
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activateTab(tabs[next]); tabs[next].focus();
    });
  });
  activateTab(tabs[0]);
  const updateScroll = () => {
    menu.classList.toggle('is-scrolling', window.scrollY > 50);
    let selected = links[0];
    links.forEach(link => {
      if (document.querySelector(link.getAttribute('href')).getBoundingClientRect().top <= menu.offsetHeight + 45) selected = link;
    });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10) selected = links[links.length - 1];
    links.forEach(link => {
      link.classList.toggle('active', link === selected);
      if (link === selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  window.addEventListener('scroll', updateScroll, { passive: true });
  updateScroll();
})();
