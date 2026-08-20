document.addEventListener('DOMContentLoaded', async () => {

  /* ── MOBILE NAV TOGGLE ── */
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close the mobile menu after tapping a link
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── NAVBAR SHADOW ON SCROLL ── */
  const navbar = document.querySelector('.navbar');
  const setNavbarState = () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 12);
  };
  setNavbarState();
  window.addEventListener('scroll', setNavbarState, { passive: true });

  /* ── ACTIVE NAV LINK (multi-page) ── */
  const navAnchors = document.querySelectorAll('.nav-links a[href]');
  const currentPage = (window.location.pathname.split('/').pop() || 'index.html');

  navAnchors.forEach((a) => {
    const linkPage = a.getAttribute('href');
    a.classList.toggle('active', linkPage === currentPage);
  });

  /* ── SCROLL REVEAL ANIMATIONS ── */
  const revealSelectors = [
    '.problem-list li',
    '.alt-card',
    '.solution-item',
    '.channel-pill',
    '.advantage-list li',
    '.price-card',
    '.adopter-card',
    '.metric-block',
    '.cta-section .section-inner > *',
  ];

  const revealEls = document.querySelectorAll(revealSelectors.join(','));

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    revealEls.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${(i % 6) * 60}ms`;
      revealObserver.observe(el);
    });
  } else {
    // No IntersectionObserver support: just show everything
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  /* ── ANIMATED COUNTERS ── */
  const countEls = document.querySelectorAll('[data-count-to]');

  const animateCount = (el) => {
    const target = parseFloat(el.getAttribute('data-count-to'));
    const prefix = el.getAttribute('data-count-prefix') || '';
    const suffix = el.getAttribute('data-count-suffix') || '';
    const duration = 1200;
    const start = performance.now();

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(target * eased);
      el.textContent = `${prefix}${current}${suffix}`;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = `${prefix}${target}${suffix}`;
      }
    };

    requestAnimationFrame(step);
  };

  if (countEls.length) {
    if ('IntersectionObserver' in window) {
      const countObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              animateCount(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.6 }
      );
      countEls.forEach((el) => countObserver.observe(el));
    } else {
      countEls.forEach(animateCount);
    }
  }

  /* ── SHARED MODAL ── */
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const modalIcon = document.querySelector('.modal-icon');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  let lastFocused = null;

  const openModal = ({ icon, title, message }) => {
    if (!modalOverlay || !modalTitle || !modalMessage) return;
    lastFocused = document.activeElement;
    if (modalIcon) modalIcon.textContent = icon || '🚀';
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalOverlay.hidden = false;
    modalClose.focus();
  };

  const closeModal = () => {
    if (!modalOverlay) return;
    modalOverlay.hidden = true;
    if (lastFocused) lastFocused.focus();
  };

  if (modalClose) modalClose.addEventListener('click', closeModal);

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay && !modalOverlay.hidden) closeModal();
  });

  /* ── COMING SOON TRIGGERS (all channel pills) ── */
  document.querySelectorAll('[data-coming-soon]').forEach((el) => {
    el.addEventListener('click', () => {
      const label = el.getAttribute('data-coming-soon');
      openModal({
        icon: '🚀',
        title: 'Coming Soon',
        message: `${label} is on its way — check back soon.`,
      });
    });
  });

  /* ── PRICING DETAIL CARDS ── */
  const priceCards = document.querySelectorAll('.price-card[data-price-title]');
  priceCards.forEach((card) => {
    const trigger = () => {
      openModal({
        icon: '💡',
        title: card.getAttribute('data-price-title'),
        message: card.getAttribute('data-price-desc'),
      });
    };
    card.addEventListener('click', trigger);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger();
      }
    });
  });

  /* ── SOLUTION EXAMPLES ── */
  const solutionItems = document.querySelectorAll('.solution-item[data-example-title]');
  solutionItems.forEach((item) => {
    const trigger = () => {
      openModal({
        icon: '💡',
        title: item.getAttribute('data-example-title'),
        message: item.getAttribute('data-example-desc'),
      });
    };
    item.addEventListener('click', trigger);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger();
      }
    });
  });

  /* ── WAITLIST FORM ── */
  const form = document.getElementById('waitlist-form');
  const emailInput = document.getElementById('waitlist-email');
  const formNote = document.getElementById('form-note');
  const successBox = document.getElementById('waitlist-success');

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  if (form && emailInput && formNote && successBox) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = emailInput.value;

      if (!isValidEmail(value)) {
        emailInput.classList.add('invalid');
        formNote.textContent = 'Please enter a valid email address.';
        emailInput.focus();
        return;
      }

      emailInput.classList.remove('invalid');
      formNote.textContent = '';

      // Simulate a successful sign-up (no backend attached to this static page)
      form.hidden = true;
      successBox.hidden = false;
      successBox.setAttribute('tabindex', '-1');
      successBox.focus();
    });

    emailInput.addEventListener('input', () => {
      if (emailInput.classList.contains('invalid') && isValidEmail(emailInput.value)) {
        emailInput.classList.remove('invalid');
        formNote.textContent = '';
      }
    });
  }

  /* ── AUTH (backed by the Node/Express API in /server.js) ──
     Accounts, password hashes, and subscription plans now live in a real
     SQLite database on the server. The browser just talks to /api/*. */
  const PLAN_LABELS = { free: 'Free', monthly: 'Monthly', annual: 'Annual' };

  const api = async (url, options = {}) => {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  };

  let currentUser = null;
  try {
    const data = await api('/api/me');
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  /* ── NAV AUTH STATE ── */
  const navGuest = document.getElementById('nav-auth-guest');
  const navUser = document.getElementById('nav-auth-user');
  if (navGuest && navUser) {
    navGuest.hidden = !!currentUser;
    navUser.hidden = !currentUser;
  }

  /* ── REGISTER FORM ── */
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const nameInput = document.getElementById('reg-name');
    const rEmailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm');
    const note = document.getElementById('register-note');

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      const email = rEmailInput.value.trim();
      const password = passInput.value;
      const confirm = confirmInput.value;

      if (!name) { note.textContent = 'Please enter your name.'; return; }
      if (!isValidEmail(email)) { note.textContent = 'Please enter a valid email address.'; return; }
      if (password.length < 6) { note.textContent = 'Password must be at least 6 characters.'; return; }
      if (password !== confirm) { note.textContent = 'Passwords do not match.'; return; }

      const params = new URLSearchParams(window.location.search);
      const requestedPlan = params.get('plan');
      const plan = PLAN_LABELS[requestedPlan] ? requestedPlan : 'free';

      try {
        await api('/api/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, plan }),
        });
        window.location.href = 'account.html';
      } catch (err) {
        note.textContent = err.message;
      }
    });
  }

  /* ── LOGIN FORM ── */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    const lEmailInput = document.getElementById('login-email');
    const lPassInput = document.getElementById('login-password');
    const note = document.getElementById('login-note');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = lEmailInput.value.trim();
      const password = lPassInput.value;

      try {
        await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        window.location.href = 'account.html';
      } catch (err) {
        note.textContent = err.message;
      }
    });
  }

  /* ── ACCOUNT PAGE ── */
  const accountGuest = document.getElementById('account-guest');
  const accountMember = document.getElementById('account-member');

  if (accountGuest && accountMember) {
    if (currentUser) {
      accountGuest.hidden = true;
      accountMember.hidden = false;
      document.getElementById('account-name').textContent = currentUser.name;
      document.getElementById('account-plan').textContent = PLAN_LABELS[currentUser.plan] || 'Free';

      document.querySelectorAll('.account-plans .plan-choose-btn[data-plan]').forEach((btn) => {
        const btnPlan = btn.getAttribute('data-plan');
        const isCurrent = btnPlan === currentUser.plan;
        btn.classList.toggle('current', isCurrent);
        btn.textContent = isCurrent ? 'Current Plan' : `Switch to ${PLAN_LABELS[btnPlan]}`;
        btn.disabled = isCurrent;

        btn.addEventListener('click', async () => {
          try {
            await api('/api/subscribe', {
              method: 'POST',
              body: JSON.stringify({ plan: btnPlan }),
            });
            window.location.reload();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    } else {
      accountGuest.hidden = false;
      accountMember.hidden = true;
    }
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api('/api/logout', { method: 'POST' });
      } finally {
        window.location.href = 'index.html';
      }
    });
  }

  /* ── CHOOSE PLAN BUTTONS ON PRICING PAGE ── */
  document.querySelectorAll('.price-card .plan-choose-btn[data-plan]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const plan = btn.getAttribute('data-plan');

      if (currentUser) {
        try {
          await api('/api/subscribe', {
            method: 'POST',
            body: JSON.stringify({ plan }),
          });
          window.location.href = 'account.html';
        } catch (err) {
          alert(err.message);
        }
      } else {
        window.location.href = `register.html?plan=${plan}`;
      }
    });
  });
});
