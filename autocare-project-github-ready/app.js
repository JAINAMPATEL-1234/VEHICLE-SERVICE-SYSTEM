/**
 * AutoCare Service Hub — Production-grade Client Application
 * Connects directly to real REST endpoints in server.js.
 * Handles JWT authentication, live vehicle tracking, service bookings,
 * employee status updates, administrative staff assignment, and responsive views.
 */

// Global App State
let authToken = localStorage.getItem('autocare_token') || '';
let currentUser = null;
let activeRole = localStorage.getItem('autocare_role') || '';
let activeRoute = location.hash.replace('#', '') || 'home';
let cachedCars = [];
let cachedServices = [];

// Fallback high-res automotive imagery
const DEFAULT_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1920&q=80',
  workshop: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80',
  technician: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80',
  car: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  bay_lifts: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
  diagnostic_bench: 'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&w=1200&q=80',
  paint_booth: 'https://images.unsplash.com/photo-1625047509168-a7026f36de04?auto=format&fit=crop&w=1200&q=80',
  alignment_laser: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=1200&q=80',
  client_lounge: 'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1200&q=80',
  team_rajesh: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
  team_ananya: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
  team_karthik: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  team_imran: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  fallback: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%231a202c"/><path d="M150 250 L200 170 L400 170 L450 250 Z" fill="%23e53e3e" opacity="0.8"/><circle cx="210" cy="250" r="35" fill="%232d3748"/><circle cx="390" cy="250" r="35" fill="%232d3748"/><text x="300" y="330" fill="%23a0aec0" font-family="sans-serif" font-size="20" text-anchor="middle">AutoCare Vehicle</text></svg>'
};

// DOM References
const app = document.getElementById('app');
const modalRoot = document.getElementById('modalRoot');
const toastRegion = document.getElementById('toastRegion');
const siteHeader = document.getElementById('siteHeader');
const menuButton = document.getElementById('menuButton');

// Utility: HTML Escaping
function esc(str = '') {
  return String(str).replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

// Utility: Safe Image Tag with Error Fallback
function safeImg(src, alt = '', className = '') {
  const fallback = DEFAULT_IMAGES.fallback;
  return `<img src="${src || fallback}" alt="${esc(alt)}" class="${className}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" />`;
}

// Utility: Toast Notification
function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = `toast ${isError ? 'error' : ''}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `<span>${isError ? '⚠' : '✓'}</span> <div>${esc(message)}</div>`;
  toastRegion.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// Utility: Router Navigation
function go(route) {
  location.hash = route;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// HTTP API Client
async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${path}:`, err);
    throw err;
  }
}

// Check & Restore Current User Session
async function restoreSession() {
  if (!authToken) {
    currentUser = null;
    activeRole = '';
    return;
  }
  try {
    const res = await api('/api/auth/me');
    if (res.ok && res.user) {
      currentUser = res.user;
      activeRole = res.user.role.toLowerCase();
      localStorage.setItem('autocare_role', activeRole);
    }
  } catch (e) {
    console.warn('Session expired or invalid, signing out:', e.message);
    logout(false);
  }
}

// Sign Out
function logout(showToast = true) {
  authToken = '';
  currentUser = null;
  activeRole = '';
  localStorage.removeItem('autocare_token');
  localStorage.removeItem('autocare_role');
  if (showToast) toast('You have been signed out.');
  updateHeader();
  go('home');
}

// Status chip formatting
function formatStatus(status) {
  const clean = (status || '').toUpperCase();
  if (clean === 'COMPLETED' || clean.includes('READY')) {
    return `<span class="status-chip">${esc(status)}</span>`;
  }
  if (clean.includes('PROGRESS') || clean.includes('INSPECTION')) {
    return `<span class="status-chip wip">${esc(status)}</span>`;
  }
  return `<span class="status-chip warning">${esc(status)}</span>`;
}

// Date formatter
function formatDate(d) {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return d;
  }
}

// Top Header Rendering
function updateHeader() {
  const actions = document.getElementById('headerActions');
  if (!actions) return;

  if (currentUser) {
    actions.innerHTML = `
      <button class="icon-btn" id="themeToggle" aria-label="Toggle theme" title="Toggle Theme">◐</button>
      <div class="user-badge ${currentUser.role}">
        <span>${esc(currentUser.name.split(' ')[0])}</span>
        <span class="role-tag">${currentUser.role}</span>
      </div>
      <button class="text-btn" data-route="dashboard-${activeRole}">Workspace</button>
      <button class="secondary-btn" style="min-height:38px;padding:0 14px;font-size:11.5px" data-action="logout">Sign out</button>
    `;
  } else {
    actions.innerHTML = `
      <button class="icon-btn" id="themeToggle" aria-label="Toggle theme" title="Toggle Theme">◐</button>
      <button class="text-btn" data-action="login">Sign in</button>
      <button class="book-btn" data-action="booking">Book a service <span>↗</span></button>
    `;
  }

  // Rebind theme toggle listener
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.onclick = () => {
      document.body.classList.toggle('light');
      localStorage.setItem('autocare-theme', document.body.classList.contains('light') ? 'light' : 'dark');
    };
  }
}

// Global Footer
function renderFooter() {
  document.getElementById('siteFooter').innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand">
        <a class="brand" href="#home">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>AUTO<span>CARE</span><small>SERVICE HUB</small></span>
        </a>
        <p>Premium manufacturer-grade care for the vehicle you count on. Transparent digital estimates, real-time tracking, genuine parts, and certified technician craftsmanship.</p>
      </div>
      <div class="footer-links">
        <h3>Explore</h3>
        <a href="#services">Certified Service Packages (15)</a>
        <a href="#track">Live Vehicle Tracking</a>
        <a href="javascript:void(0)" data-action="booking">Instant Bay Booking</a>
        <a href="#about">Our Standards &amp; Warranty</a>
      </div>
      <div class="footer-links">
        <h3>Support & Help</h3>
        <a href="#help">Customer & employee guide</a>
        <a href="#contact">Contact workshop team</a>
        <a href="#terms">Terms of service</a>
        <a href="#privacy">Privacy policy</a>
      </div>
      <div class="footer-links">
        <h3>Workshop Hub</h3>
        <a href="mailto:hello@autocare.example">hello@autocare.example</a>
        <a href="tel:+918041238090">+91 80 4123 8090</a>
        <p style="font-size:12px;color:var(--muted);line-height:1.6;margin-top:6px">12, 80 Feet Road, Koramangala<br/>Bengaluru, Karnataka 560095</p>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 AUTOCARE SERVICE HUB · PRECISION AUTOMOTIVE ENGINEERING</span>
      <span>
        <a href="#terms">TERMS</a>
        <a href="#privacy">PRIVACY</a>
        <a href="#help">HELP CENTER</a>
      </span>
    </div>
  `;
}

// ====================================================
// PAGE BUILDERS & METADATA
// ====================================================

// Certified Service Category Taxonomy
const SERVICE_CATEGORIES = {
  1: 'Periodic & Engine',
  2: 'Periodic & Engine',
  10: 'Periodic & Engine',
  3: 'AC & Climate',
  5: 'Electrical & Battery',
  12: 'Electrical & Battery',
  4: 'Brakes & Suspension',
  11: 'Brakes & Suspension',
  6: 'Tyres & Wheel Care',
  7: 'Tyres & Wheel Care',
  8: 'Detailing & Spa',
  9: 'Body & Paint',
  13: 'Insurance & Claims',
  14: 'Emergency & Roadside',
  15: 'EV & Hybrid Care'
};

function pageHero(crumb, title, lead) {
  return `
    <section class="page-hero">
      <div class="container">
        <div class="breadcrumb">Home <span>/</span> ${crumb}</div>
        <h1 class="display">${title}</h1>
        <p class="lead">${lead}</p>
      </div>
    </section>
  `;
}

// 1. Home Page
function homePage() {
  const previewServices = cachedServices.slice(0, 6);
  return `
    <section class="hero">
      ${safeImg(DEFAULT_IMAGES.hero, 'AutoCare luxury sports car on open highway', 'hero-image')}
      <div class="hero-copy">
        <div class="eyebrow red">Precision care · Beautifully simple</div>
        <h1 class="display">Premium car care,<br/><em>made simple.</em></h1>
        <p class="lead">Book scheduled maintenance, track repair milestones live, and manage your vehicle service history in one transparent digital hub.</p>
        <div class="hero-actions">
          <button class="primary-btn" data-action="booking">Book a Service <span>↗</span></button>
          <button class="secondary-btn" data-route="services">Browse All Services <span>→</span></button>
          <button class="secondary-btn" data-route="track">Track My Vehicle <span>→</span></button>
        </div>
      </div>
      <div class="hero-bottom">
        <div class="hero-points">
          <span><i></i> CERTIFIED WORKSHOP ADVISORS</span>
          <span><i></i> 100% GENUINE OEM PARTS</span>
          <span><i></i> LIVE STATUS TIMELINE</span>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>4.9 / 5</b><small>Customer Rating</small></div>
          <div class="stat"><b>12,400+</b><small>Vehicles Serviced</small></div>
        </div>
      </div>
    </section>

    <div class="marquee" aria-hidden="true">
      <div class="marquee-inner">
        HONEST ADVICE <b>✦</b> CERTIFIED OEM PARTS <b>✦</b> DIGITAL SERVICE RECORDS <b>✦</b> DOORSTEP PICKUP &amp; DROP <b>✦</b> 42-POINT INSPECTION <b>✦</b> LIVE TRACKING <b>✦</b> 12-MONTH WARRANTY <b>✦</b> HONEST ADVICE <b>✦</b> CERTIFIED OEM PARTS <b>✦</b> DIGITAL SERVICE RECORDS <b>✦</b>
      </div>
    </div>

    <!-- Trust Standard Section -->
    <section class="section container">
      <div class="trust-grid">
        <div class="trust-intro">
          <div class="eyebrow">The AutoCare standard</div>
          <h2>We look after more than the machine.</h2>
          <p>Clear communication, workshop-level diagnostic discipline, and a standard of care you can feel the moment you step into the driver’s seat.</p>
          <div style="margin-top:28px">
            <button class="primary-btn" data-route="about">Our Workshop Philosophy <span>↗</span></button>
          </div>
        </div>
        <div class="trust-items">
          <article class="trust-item">
            <div class="trust-icon">⌘</div>
            <h3>Clear estimates upfront</h3>
            <p>Digital inspection sheets and itemized photo estimates before a single repair is touched.</p>
          </article>
          <article class="trust-item">
            <div class="trust-icon">◉</div>
            <h3>Care built around you</h3>
            <p>Choose convenient doorstep pickup & drop, or relax in our lounge with complimentary Wi-Fi.</p>
          </article>
          <article class="trust-item">
            <div class="trust-icon">↯</div>
            <h3>Live status tracking</h3>
            <p>Follow every stage from bay check-in to final road test with your unique tracking ID.</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Popular Services Grid -->
    <section class="section container" style="padding-top:0">
      <div class="section-head">
        <div>
          <div class="eyebrow red">Certified Services</div>
          <h2 class="section-title">Everything your car<br/>needs to feel <em>like new.</em></h2>
        </div>
        <a href="#services" class="underlined-link">Explore all 15 services <span>↗</span></a>
      </div>
      <div class="service-grid">
        ${previewServices.map(serviceCard).join('')}
      </div>
    </section>

    <!-- Featured Promise Banner -->
    <section class="container">
      <div class="featured">
        ${safeImg(DEFAULT_IMAGES.workshop, 'AutoCare expert mechanic conducting precision inspection', '')}
        <div class="feature-badge">
          THE AUTOCARE PROMISE
          <b>12 MONTHS</b>
          Parts &amp; labour warranty
        </div>
        <div class="featured-copy">
          <div class="eyebrow red">Manufacturer standard</div>
          <h2>Your vehicle in master hands.</h2>
          <p>From routine fluid renewals to complex dual-clutch transmission diagnostics, we apply hospital-clean standards and manufacturer torque specifications to every bolt.</p>
          <div class="featured-specs">
            <span><b>42-Point</b>Digital scan</span>
            <span><b>100%</b>OEM Genuine</span>
            <span><b>24/7</b>Live tracking</span>
          </div>
          <button class="primary-btn" data-action="booking">Book Inspection Today <span>↗</span></button>
        </div>
      </div>
    </section>

    <!-- How It Works in 4 Steps -->
    <section class="section container">
      <div class="how-grid">
        <div>
          <div class="eyebrow red">Seamless journey</div>
          <h2 class="section-title">Your car’s next<br/>best day in <em>4 steps.</em></h2>
          <p class="lead">Every appointment is engineered to be clear, transparent, and completely free of workshop surprises.</p>
        </div>
        <div class="how-steps">
          <div class="how-step">
            <div>
              <h3>1. Select your service routine</h3>
              <p>Choose from our 15 certified workshop service routines and enter your car make, model &amp; registration. We prefill the exact OEM requirements.</p>
            </div>
          </div>
          <div class="how-step">
            <div>
              <h3>2. Choose a date &amp; convenience</h3>
              <p>Pick a workshop slot or opt for doorstep vehicle pickup and return at your home or workplace.</p>
            </div>
          </div>
          <div class="how-step">
            <div>
              <h3>3. Follow the live timeline</h3>
              <p>Track bay reception, inspection results, parts installation, and road test quality verification in real time.</p>
            </div>
          </div>
          <div class="how-step">
            <div>
              <h3>4. Drive away with confidence</h3>
              <p>Review your digital invoice, inspection certificate, and 12-month warranty seal directly on your phone.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonial Quote -->
    <section class="container section" style="padding-top:0">
      <div class="quote-card">
        <div class="quote-mark">“</div>
        <div class="quote">AutoCare transformed the entire workshop experience. Being able to track every inspection photo from my desk and approve recommendations with full cost clarity is a game-changer.</div>
        <footer>
          <b>Rhea Nair</b>
          <span>Hyundai Creta owner · Bengaluru</span>
        </footer>
      </div>
    </section>

    <!-- Workshop Contact Band -->
    <section class="contact-band">
      <div>
        <div class="eyebrow red">Come say hello</div>
        <h2>Care closer than you think.</h2>
      </div>
      <div class="contact-block">
        <label>Call workshop</label>
        <p>+91 80 4123 8090<br/><span style="color:var(--muted);font-weight:400;font-size:12px">Mon–Sat: 8:00 AM – 8:00 PM</span></p>
      </div>
      <div class="contact-block">
        <label>Visit center</label>
        <p>12, 80 Feet Road, Koramangala<br/><span style="color:var(--muted);font-weight:400;font-size:12px">Bengaluru, KA 560095</span></p>
      </div>
      <div class="contact-block">
        <label>Live tracker</label>
        <p><a href="#track" style="color:var(--red-soft)">Where is my car? →</a></p>
      </div>
    </section>
  `;
}

function serviceCard(s) {
  const category = (typeof SERVICE_CATEGORIES !== 'undefined' && SERVICE_CATEGORIES[s.id]) || 'Certified Service';
  return `
    <article class="service-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="service-cat-pill" style="font-size:9.5px;padding:3px 8px">${esc(category)}</span>
        <span style="font:600 10px var(--font-mono);color:var(--muted)">⏱ ${esc(s.duration)}</span>
      </div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <footer>
        <span class="price">${esc(s.price)}</span>
        <button data-action="book-service" data-service="${s.id}">BOOK NOW ↗</button>
      </footer>
    </article>
  `;
}

// 2. Services Menu Page (Main Service Booking Hub)
function servicesPage() {
  const categories = [
    'All Services',
    'Periodic & Engine',
    'AC & Climate',
    'Brakes & Suspension',
    'Electrical & Battery',
    'Tyres & Wheel Care',
    'Detailing & Spa',
    'Emergency & EV'
  ];

  return `
    ${pageHero('Service Offerings', 'Precision care for <em>every car.</em>', 'All 15 certified workshop service routines with upfront transparent pricing, estimated turnaround times, itemized component checks, and instant bay booking.')}
    
    <section class="section container">
      <!-- Direct Quick Booking Highlight Banner -->
      <div class="service-spotlight-banner">
        <div class="spotlight-content">
          <span class="spotlight-tag">DIRECT WORKSHOP RESERVATION</span>
          <h2>Book Any Service in 60 Seconds</h2>
          <p>Know what your car needs? Enter your vehicle make, model, and registration plate number to reserve an advisor bay instantly with transparent pricing.</p>
        </div>
        <button class="primary-btn pulse-glow" data-action="booking" style="padding:16px 28px;font-size:14px">
          Book a Service Now <span>↗</span>
        </button>
      </div>

      <!-- Filter and Search Controls -->
      <div class="service-controls">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-field" id="serviceSearch" placeholder="Search service routines (e.g. Engine Oil, Brake Inspection, AC Overhaul, Detailing, EV...)" aria-label="Search service catalogue">
        </div>
        <div class="service-chips" id="serviceChips">
          ${categories.map((c, idx) => `
            <button class="service-chip ${idx === 0 ? 'active' : ''}" data-category="${esc(c)}">
              ${esc(c)}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="service-stats-bar">
        <p class="catalog-count" id="serviceCount">${cachedServices.length} certified workshop packages available</p>
        <div class="service-badge-note">✦ 100% Genuine OEM Parts · 12-Month Warranty on All Repairs</div>
      </div>

      <div class="services-full" id="servicesGrid">
        ${cachedServices.map(serviceFullCard).join('')}
      </div>
    </section>
  `;
}

function serviceFullCard(s) {
  const items = s.includes || ['Multi-point diagnostic inspection', 'OEM fluids check & top-up', 'Digital health assessment'];
  const category = SERVICE_CATEGORIES[s.id] || 'General Service';
  const categorySlug = (category.includes('EV') ? 'ev' : category.includes('AC') ? 'climate' : category.includes('Brake') ? 'brakes' : category.includes('Detailing') ? 'spa' : 'general');

  return `
    <article class="service-full" data-category="${esc(category)}" data-id="${s.id}">
      <div class="service-full-top">
        <span class="service-cat-pill cat-${categorySlug}">${esc(category)}</span>
        <span class="from">${esc(s.price)}</span>
      </div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>

      <div class="service-inclusions">
        <b>What's Included:</b>
        <ul>
          ${items.map(it => `<li><span class="chk">✓</span> ${esc(it)}</li>`).join('')}
        </ul>
      </div>

      <footer>
        <div class="service-meta-info">
          <span>⏱ ${esc(s.duration)}</span>
          <span>⟳ ${esc(s.frequency)}</span>
        </div>
        <button class="service-book-btn" data-action="book-service" data-service="${s.id}">
          Book Service <span>↗</span>
        </button>
      </footer>
    </article>
  `;
}

// 5. Live Vehicle Tracking Page
function trackPage() {
  return `
    ${pageHero('Live Vehicle Tracking', 'Your service, <em>in view.</em>', 'Follow every meaningful stage in your car’s appointment in real time. Enter your booking ID and registered email or vehicle registration number.')}
    <section class="container">
      <div class="tracking-wrap">
        <form class="track-form-card" id="trackingForm">
          <div class="eyebrow red">Real-Time Tracker</div>
          <h2>Where is my car?</h2>
          <p class="lead">Enter the booking identifier from your appointment confirmation.</p>

          <div class="field">
            <label for="trackBookingId">Booking ID</label>
            <input id="trackBookingId" value="AC-2026-0816" required placeholder="e.g. AC-2026-0816" autocomplete="off">
          </div>

          <div class="field">
            <label for="trackIdentifier">Registered Email or Registration Plate</label>
            <input id="trackIdentifier" value="rhea@example.com" required placeholder="you@example.com or KA 01 MG 7412" autocomplete="off">
          </div>

          <button class="primary-btn" type="submit" id="trackSubmitBtn" style="width:100%;margin-top:10px">
            Fetch Live Service Status <span>↗</span>
          </button>

          <div class="track-tip">
            <b>Privacy Safeguard:</b> Booking records are secured on the server. Tracking is only unlocked when the registration number or customer email matches the booking record.
          </div>
        </form>

        <div class="track-result" id="trackingResult">
          <div style="padding:48px 32px;text-align:center;color:var(--muted)">
            <div style="font-size:42px;margin-bottom:14px;color:var(--red)">🔍</div>
            <h3 style="color:var(--paper);margin:0 0 8px">Ready to Track</h3>
            <p style="font-size:13.5px;max-width:380px;margin:auto">Submit your booking ID and email or registration above to retrieve the live inspection progress and technician timeline.</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderTrackingResult(b) {
  const stages = [
    { key: 'BOOKING_RECEIVED', label: 'Received' },
    { key: 'INSPECTION_STARTED', label: 'Inspection' },
    { key: 'WORK_IN_PROGRESS', label: 'In Progress' },
    { key: 'QUALITY_CHECK', label: 'Quality Check' },
    { key: 'READY_FOR_DELIVERY', label: 'Ready' }
  ];

  const currentStatus = (b.status || '').toUpperCase();
  const historyKeys = (b.history || []).map(h => h.status.toUpperCase());

  return `
    <div class="track-top">
      <div>
        <div class="eyebrow">Verified Live Status</div>
        <h2>${esc(b.vehicle)}</h2>
        <span style="font:700 11px var(--font-mono);color:var(--aqua)">${esc(b.registration)}</span>
      </div>
      <div>${formatStatus(b.statusLabel || b.status)}</div>
    </div>

    <!-- 5-Step Progress Roadmap -->
    <div class="track-roadmap">
      ${stages.map((st, i) => {
        const isDone = historyKeys.includes(st.key) && currentStatus !== st.key;
        const isActive = currentStatus === st.key;
        return `
          <div class="roadmap-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}">
            <div class="roadmap-dot">${isDone ? '✓' : (i + 1)}</div>
            <span>${esc(st.label)}</span>
          </div>
        `;
      }).join('')}
    </div>

    <div class="track-result-info">
      <div><span>Booking ID</span><b>${esc(b.id)}</b></div>
      <div><span>Service Type</span><b>${esc(b.service)}</b></div>
      <div><span>Estimated Completion</span><b>${formatDate(b.estimatedCompletion)}</b></div>
      <div><span>Assigned Advisor</span><b>${esc(b.employee || 'Arjun Mehta')}</b></div>
    </div>

    <div class="timeline">
      <h3 style="font-size:15px;margin:0 0 18px;font-weight:800;letter-spacing:-0.02em">Service Milestones &amp; Notes</h3>
      ${(b.history || []).map((h, i, arr) => `
        <div class="timeline-item ${i === arr.length - 1 ? 'active' : ''}">
          <span class="timeline-dot"></span>
          <div>
            <b>${esc(h.label || h.status)}</b>
            <p>${esc(h.note || 'Milestone achieved.')}</p>
          </div>
          <time>${formatDate(h.time)}</time>
        </div>
      `).join('')}

      <div class="track-tip" style="margin-top:20px">
        <b>Advisor Note:</b> ${esc(b.notes || 'No special notes recorded.')}
      </div>

      <div style="margin-top:22px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;color:var(--muted)">Need to discuss this estimate?</span>
        <button class="secondary-btn" style="min-height:36px;padding:0 14px;font-size:11px" onclick="window.print()">
          Print Service Record 🖨
        </button>
      </div>
    </div>
  `;
}

// 6. About Page (Comprehensive Automotive Workshop Profile)
function aboutPage() {
  return `
    ${pageHero('About AutoCare', 'Engineering trust in<br/><em>modern car care.</em>', 'AutoCare was established to eliminate workshop opacity. We combine manufacturer diagnostic precision with honest communication, certified technicians, and real-time digital accountability.')}

    <!-- Highlight Stats Ribbon -->
    <section class="container" style="margin-top:-20px">
      <div class="about-stats-ribbon">
        <div class="about-stat-item">
          <b>12,400<span>+</span></b>
          <span class="stat-label">Vehicles Serviced &amp; Restored</span>
        </div>
        <div class="about-stat-item">
          <b>4.9<span> / 5</span></b>
          <span class="stat-label">Verified Customer Satisfaction</span>
        </div>
        <div class="about-stat-item">
          <b>100<span>%</span></b>
          <span class="stat-label">Genuine OEM Certified Parts</span>
        </div>
        <div class="about-stat-item">
          <b>12<span> Mos</span></b>
          <span class="stat-label">Parts &amp; Labour Warranty</span>
        </div>
      </div>
    </section>

    <!-- Company Story & Purpose -->
    <section class="container section">
      <div class="about-grid">
        <article class="about-story">
          <div class="eyebrow red">Our Origin &amp; Philosophy</div>
          <h2>Better service starts with better attention.</h2>
          <p>Founded in 2018 in Koramangala, Bengaluru, AutoCare Service Hub emerged from a straightforward frustration shared by thousands of car owners: having to choose between astronomical dealership bills with zero visibility, or unorganized neighborhood garages lacking certified diagnostic tools.</p>
          <p>We built AutoCare to prove there is a better way. We treat every vehicle with surgical cleanliness, manufacturer-specified torque limits, and absolute transparency. No hidden fees, no mystery part replacements, and no pressure.</p>
          <p>Before any wrench touches your car, you receive an itemized digital inspection report with high-resolution photos. You approve each item individually, and follow every milestone live right from your phone or desk.</p>
          <div style="margin-top:30px;display:flex;gap:14px;flex-wrap:wrap">
            <button class="primary-btn" data-action="booking">Book a Workshop Visit <span>↗</span></button>
            <button class="secondary-btn" data-route="contact">Speak with an Advisor <span>→</span></button>
          </div>
        </article>
        <div class="about-image">
          ${safeImg(DEFAULT_IMAGES.technician, 'AutoCare master diagnostic technician at precision work', '')}
          <span>Meticulous Diagnostic Focus · AutoCare Hub Bengaluru</span>
        </div>
      </div>
    </section>

    <!-- Mission, Vision & Core Values -->
    <section class="container section" style="padding-top:0">
      <div class="section-head">
        <div>
          <div class="eyebrow red">Foundation of Excellence</div>
          <h2 class="section-title">Built on principles,<br/>driven by <em>precision.</em></h2>
        </div>
        <p class="lead" style="max-width:440px">Our guiding compass shapes every technician handover, customer interaction, and torque specification in our workshop.</p>
      </div>

      <div class="pillars-grid">
        <article class="pillar-card">
          <div class="pillar-icon-box">🎯</div>
          <div class="eyebrow red">Our Mission</div>
          <h3>Uncompromising Care</h3>
          <p>To provide vehicle owners with transparent, dependable, manufacturer-grade service backed by live digital tracking, genuine OEM parts, and guaranteed pricing.</p>
          <ul class="pillar-bullets">
            <li><span>✓</span> 100% Upfront estimates before work starts</li>
            <li><span>✓</span> Live photographic inspection records</li>
            <li><span>✓</span> Direct access to certified master technicians</li>
          </ul>
        </article>

        <article class="pillar-card">
          <div class="pillar-icon-box">🔭</div>
          <div class="eyebrow red">Our Vision</div>
          <h3>Setting the Benchmark</h3>
          <p>To redefine automotive aftermarket service in India by combining state-of-the-art diagnostic technology with the calm hospitality of a luxury service lounge.</p>
          <ul class="pillar-bullets">
            <li><span>✓</span> Digital-first workshop ecosystem</li>
            <li><span>✓</span> Future-ready EV &amp; hybrid powertrain diagnostics</li>
            <li><span>✓</span> Zero-friction doorstep pickup &amp; return</li>
          </ul>
        </article>

        <article class="pillar-card">
          <div class="pillar-icon-box">💎</div>
          <div class="eyebrow red">Our Core Values</div>
          <h3>Engineering Integrity</h3>
          <p>We believe honesty is our strongest competitive advantage. We explain what truly needs attention, respect what doesn't, and take pride in work done right.</p>
          <ul class="pillar-bullets">
            <li><span>✓</span> Zero unsolicited part replacements</li>
            <li><span>✓</span> 12-Month / 15,000 km warranty seal</li>
            <li><span>✓</span> Hospital-clean, eco-friendly workspace</li>
          </ul>
        </article>
      </div>
    </section>

    <!-- Why Choose AutoCare / Comparison Matrix -->
    <section class="container section" style="padding-top:0">
      <div class="section-head">
        <div>
          <div class="eyebrow red">Clear Advantage</div>
          <h2 class="section-title">Why car owners trust<br/><em>AutoCare Service Hub.</em></h2>
        </div>
        <p class="lead" style="max-width:440px">See how our certified process compares directly against conventional dealerships and local independent garages.</p>
      </div>

      <div class="comparison-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Feature / Standard</th>
              <th>Traditional Dealers &amp; Garages</th>
              <th class="highlight-col">AutoCare Service Hub</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="feature-title">Pricing &amp; Cost Clarity</td>
              <td class="standard-col"><span class="badge-negative">✕</span> Hidden extras, unexpected invoice surprises at checkout</td>
              <td class="highlight-col"><span class="badge-positive">✓</span> 100% Guaranteed digital estimate approved upfront</td>
            </tr>
            <tr>
              <td class="feature-title">Spare Parts Authenticity</td>
              <td class="standard-col"><span class="badge-negative">✕</span> Risk of uncertified aftermarket or duplicate spares</td>
              <td class="highlight-col"><span class="badge-positive">✓</span> 100% Genuine OEM parts with manufacturer packaging</td>
            </tr>
            <tr>
              <td class="feature-title">Live Service Visibility</td>
              <td class="standard-col"><span class="badge-negative">✕</span> Zero progress visibility; endless phone calls to advisors</td>
              <td class="highlight-col"><span class="badge-positive">✓</span> Real-time milestone tracker with HD inspection photos</td>
            </tr>
            <tr>
              <td class="feature-title">Warranty Protection</td>
              <td class="standard-col"><span class="badge-negative">✕</span> Limited or verbal assurance with tedious disclaimers</td>
              <td class="highlight-col"><span class="badge-positive">✓</span> 12-Month / 15,000 km formal parts &amp; labour warranty</td>
            </tr>
            <tr>
              <td class="feature-title">Customer Convenience</td>
              <td class="standard-col"><span class="badge-negative">✕</span> Tedious commute, long drop-off and pickup queues</td>
              <td class="highlight-col"><span class="badge-positive">✓</span> Complimentary doorstep vehicle pickup &amp; return</td>
            </tr>
            <tr>
              <td class="feature-title">Technician Qualifications</td>
              <td class="standard-col"><span class="badge-negative">✕</span> Variable apprentice skills with generic basic tools</td>
              <td class="highlight-col"><span class="badge-positive">✓</span> OEM-certified master technicians with laser diagnostic rigs</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Master Technical Team -->
    <section class="container section" style="padding-top:0">
      <div class="section-head">
        <div>
          <div class="eyebrow red">Master Craftsmen</div>
          <h2 class="section-title">The hands behind<br/><em>your machine.</em></h2>
        </div>
        <p class="lead" style="max-width:440px">Led by certified automotive veterans with decades of hands-on experience across Japanese, German, and domestic manufacturers.</p>
      </div>

      <div class="team-grid">
        <article class="team-card">
          <div class="team-photo-wrap">
            ${safeImg(DEFAULT_IMAGES.team_rajesh, 'Rajesh Varma — Technical Director', '')}
            <span class="team-exp-badge">18+ YRS EXP</span>
          </div>
          <div class="team-body">
            <h4>Rajesh Varma</h4>
            <div class="team-role">Chief Technical Director</div>
            <p class="team-bio">Former Bosch Diagnostic Lead. Specialized in electronic fuel injection, complex ECU mapping, and dual-clutch transmission systems.</p>
          </div>
        </article>

        <article class="team-card">
          <div class="team-photo-wrap">
            ${safeImg(DEFAULT_IMAGES.team_ananya, 'Ananya Sen — Head of Operations', '')}
            <span class="team-exp-badge">12+ YRS EXP</span>
          </div>
          <div class="team-body">
            <h4>Ananya Sen</h4>
            <div class="team-role">Head of Workshop Operations</div>
            <p class="team-bio">Automotive supply chain veteran. Spearheads our strict OEM parts verification protocols and customer turnaround efficiency.</p>
          </div>
        </article>

        <article class="team-card">
          <div class="team-photo-wrap">
            ${safeImg(DEFAULT_IMAGES.team_karthik, 'Karthik Nair — Powertrain Specialist', '')}
            <span class="team-exp-badge">14+ YRS EXP</span>
          </div>
          <div class="team-body">
            <h4>Karthik Nair</h4>
            <div class="team-role">Senior Powertrain Specialist</div>
            <p class="team-bio">Master technician certified across multi-link suspension calibration, precision engine overhauls, and hydraulic brake testing.</p>
          </div>
        </article>

        <article class="team-card">
          <div class="team-photo-wrap">
            ${safeImg(DEFAULT_IMAGES.team_imran, 'Mohammed Imran — EV Diagnostic Lead', '')}
            <span class="team-exp-badge">9+ YRS EXP</span>
          </div>
          <div class="team-body">
            <h4>Mohammed Imran</h4>
            <div class="team-role">EV &amp; High-Voltage Specialist</div>
            <p class="team-bio">Certified high-voltage automotive technician. Expert in lithium-ion BMS diagnostics, thermal management, and regenerative systems.</p>
          </div>
        </article>
      </div>
    </section>

    <!-- 5-Stage Precision Service Process -->
    <section class="container section" style="padding-top:0">
      <div class="section-head">
        <div>
          <div class="eyebrow red">Methodical Discipline</div>
          <h2 class="section-title">The 5-stage precision<br/><em>service journey.</em></h2>
        </div>
        <p class="lead" style="max-width:440px">How we care for your vehicle from the moment it enters our bay until the keys are handed back.</p>
      </div>

      <div class="process-grid">
        <div class="process-step-card">
          <span class="process-num">01</span>
          <h4>42-Point Check-In</h4>
          <p>Digital intake scan, battery health test, tire tread measurement, and 360° high-res exterior photo walkaround.</p>
        </div>

        <div class="process-step-card">
          <span class="process-num">02</span>
          <h4>Transparent Approval</h4>
          <p>You review the diagnostic findings and itemized estimate online. We proceed only with the items you approve.</p>
        </div>

        <div class="process-step-card">
          <span class="process-num">03</span>
          <h4>OEM Part Execution</h4>
          <p>Factory-trained specialists perform scheduled routines with manufacturer torque specs and 100% genuine parts.</p>
        </div>

        <div class="process-step-card">
          <span class="process-num">04</span>
          <h4>Quality Road Test</h4>
          <p>Comprehensive 10-point dynamic road test, brake calibration, and diagnostic computer reset to ensure zero errors.</p>
        </div>

        <div class="process-step-card">
          <span class="process-num">05</span>
          <h4>Clean Handover</h4>
          <p>Exterior snow foam wash, interior sanitization, digital invoice generation, and 12-month warranty certificate issuance.</p>
        </div>
      </div>
    </section>

    <!-- Workshop Facility Gallery -->
    <section class="container section" style="padding-top:0">
      <div class="section-head">
        <div>
          <div class="eyebrow red">Our Facility</div>
          <h2 class="section-title">Inside our modern<br/><em>Bengaluru workshop.</em></h2>
        </div>
        <p class="lead" style="max-width:440px">Designed like a precision laboratory. 12 dedicated hydraulic bays, clean-room engine assembly, and comfortable customer lounges.</p>
      </div>

      <div class="facility-gallery">
        <div class="gallery-card featured-wide">
          ${safeImg(DEFAULT_IMAGES.bay_lifts, 'Automated hydraulic vehicle lifts in clean workshop', '')}
          <div class="gallery-caption">
            <b>12 Hydraulic Service Bays</b>
            <span>Heavy-duty twin-post lifts with dedicated fluid delivery booms</span>
          </div>
        </div>

        <div class="gallery-card">
          ${safeImg(DEFAULT_IMAGES.diagnostic_bench, 'Advanced ECU diagnostics and electronic test bench', '')}
          <div class="gallery-caption">
            <b>ECU Diagnostic Lab</b>
            <span>Universal OBD-II live telemetry &amp; sensor oscilloscopes</span>
          </div>
        </div>

        <div class="gallery-card">
          ${safeImg(DEFAULT_IMAGES.paint_booth, 'Dust-free infrared paint baking booth', '')}
          <div class="gallery-caption">
            <b>Infrared Paint Booth</b>
            <span>Heated dust-filtered climate for factory-match finish</span>
          </div>
        </div>

        <div class="gallery-card">
          ${safeImg(DEFAULT_IMAGES.alignment_laser, 'Computerized 3D laser wheel alignment system', '')}
          <div class="gallery-caption">
            <b>3D Laser Wheel Rig</b>
            <span>Precision 4-wheel caster, camber, and toe calibration</span>
          </div>
        </div>

        <div class="gallery-card">
          ${safeImg(DEFAULT_IMAGES.client_lounge, 'Executive customer lounge with high-speed Wi-Fi', '')}
          <div class="gallery-caption">
            <b>Customer Lounge</b>
            <span>High-speed Wi-Fi, specialty coffee &amp; live bay monitoring</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Frequently Asked Questions (Accordion) -->
    <section class="container section" style="padding-top:0">
      <div class="section-head" style="text-align:center;display:block">
        <div class="eyebrow red">Got Questions?</div>
        <h2 class="section-title">Frequently asked <em>questions.</em></h2>
        <p class="lead" style="max-width:560px;margin:12px auto 0">Everything you need to know about our service standards, warranties, and workshop appointments.</p>
      </div>

      <div class="faq-accordion">
        <div class="faq-item open">
          <button class="faq-question">
            <span>How does AutoCare guarantee 100% pricing transparency?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            Before any repair or fluid replacement begins, our advisor uploads a digital inspection sheet with high-resolution photos and itemized component costs directly to your tracking dashboard. You approve each service individually. We never charge for unauthorized work.
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>Are the replacement spare parts genuine OEM?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            Yes. We exclusively source original equipment manufacturer (OEM) and OES parts certified for your exact car make and model (Toyota, Hyundai, Maruti Suzuki, Tata Motors, Mahindra, Honda, Kia, VW, and luxury brands). Every part arrives in sealed packaging with verifiable serial numbers.
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>What is covered under the 12-Month Workshop Warranty?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            All mechanical repairs, installed OEM parts, and technician labor are protected under our unconditional 12-Month or 15,000 km warranty (whichever comes first). If any installed component exhibits a defect or failure, our workshop replaces it at zero cost with priority bay scheduling.
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>How does the Live Vehicle Tracking system work?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            When your booking is confirmed, you receive a unique booking ID (e.g. AC-2026-6442). Simply visit the "Track Vehicle" page on your phone or computer, enter your booking ID and registration plate, and follow each milestone live: Bay Check-in, Diagnostic Scan, In Progress, Road Test, and Ready for Handover.
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>Do you offer doorstep pickup and return in Bengaluru?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            Yes! During online booking, simply select "Doorstep Pickup &amp; Drop". Our insured and vetted logistics drivers will collect your vehicle from your home or office, conduct a digital video walkaround at your doorstep, and return the car freshly cleaned upon completion.
          </div>
        </div>

        <div class="faq-item">
          <button class="faq-question">
            <span>What car types and powertrains do you service?</span>
            <span class="faq-icon">+</span>
          </button>
          <div class="faq-answer">
            Our workshop handles Petrol, Diesel, CNG, Strong Hybrid, and Pure Electric Vehicles (EVs) across all hatchbacks, sedans, SUVs, and MPVs. Our technicians are factory-trained with OEM-grade diagnostic scanners for Japanese, Korean, Indian, and European vehicle architectures.
          </div>
        </div>
      </div>
    </section>

    <!-- Booking Call to Action Banner -->
    <section class="container section" style="padding-top:0">
      <div class="service-spotlight-banner">
        <div class="spotlight-content">
          <span class="spotlight-tag">EXPERIENCE THE AUTOCARE DIFFERENCE</span>
          <h2>Give Your Car the Care It Deserves.</h2>
          <p>Book your scheduled maintenance or precision diagnostic today. Transparent pricing, genuine parts, live vehicle tracking, and 12 months peace of mind.</p>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="primary-btn pulse-glow" data-action="booking" style="padding:16px 28px;font-size:14px">
            Book a Service Now <span>↗</span>
          </button>
          <button class="secondary-btn" data-route="contact" style="padding:16px 24px;font-size:14px">
            Contact Workshop <span>→</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

// 7. Contact Page
function contactPage() {
  return `
    ${pageHero('Contact', 'Let’s talk about<br/><em>your car.</em>', 'Questions, a custom service inquiry, or simply some honest diagnostic advice? Our workshop team is here Monday through Saturday.')}
    <section class="container section">
      <div class="contact-page-grid">
        <aside class="contact-aside">
          <div class="eyebrow red">AutoCare Koramangala Hub</div>
          <h2>We’re here<br/>when you need us.</h2>
          <p>Drop in for a freshly brewed coffee, call to speak with an advisor, or submit a message and we’ll respond within one working day.</p>

          <div class="contact-details">
            <div>
              <span>DIRECT WORKSHOP LINE</span>
              <b>+91 80 4123 8090</b>
            </div>
            <div>
              <span>CUSTOMER SUPPORT EMAIL</span>
              <b>hello@autocare.example</b>
            </div>
            <div>
              <span>WORKSHOP LOCATION</span>
              <b>12, 80 Feet Road, Koramangala<br/>Bengaluru, Karnataka 560095</b>
            </div>
          </div>
        </aside>

        <form class="contact-form" id="contactForm">
          <div class="eyebrow">Send a message</div>
          <h2 style="font-size:30px;letter-spacing:-0.03em;margin:14px 0 24px;font-weight:800">How can we assist?</h2>

          <div class="form-row">
            <div class="field">
              <label for="contactName">Your Name</label>
              <input id="contactName" required placeholder="e.g. Ramesh Kumar">
            </div>
            <div class="field">
              <label for="contactEmail">Email Address</label>
              <input id="contactEmail" type="email" required placeholder="you@example.com">
            </div>
          </div>

          <div class="field">
            <label for="contactTopic">Inquiry Topic</label>
            <select id="contactTopic">
              <option>General Service Inquiry</option>
              <option>Existing Booking Update</option>
              <option>Accident &amp; Insurance Claim</option>
              <option>Fleet / Corporate Maintenance</option>
              <option>Feedback &amp; Suggestions</option>
            </select>
          </div>

          <div class="field">
            <label for="contactMessage">Your Message / Symptoms</label>
            <textarea id="contactMessage" required placeholder="Tell us about your vehicle model, year, and what service or symptoms you need help with..."></textarea>
          </div>

          <div class="form-success" id="contactSuccess">
            Thank you! Your inquiry has been logged in our system. A service advisor will contact you shortly.
          </div>

          <button class="primary-btn" type="submit" id="contactSubmitBtn" style="width:100%;margin-top:12px">
            Submit Message <span>↗</span>
          </button>
        </form>
      </div>
    </section>
  `;
}

// 8. Help Center Page
function helpPage() {
  const guideGroup = (title, items) => `
    <article class="panel">
      <div class="eyebrow red">${title}</div>
      <h2 style="font-size:24px;letter-spacing:-0.03em;margin:12px 0 16px;font-weight:800">Operational User Guide</h2>
      ${items.map(x => `
        <details style="border-top:1px solid var(--line);padding:14px 0">
          <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--paper)">${x[0]}</summary>
          <p style="color:var(--muted);font-size:12.5px;line-height:1.7;margin:10px 0 0">${x[1]}</p>
        </details>
      `).join('')}
    </article>
  `;

  return `
    ${pageHero('Help Center', 'How can we <em>help?</em>', 'Complete operational guide for Customers, Workshop Technicians, and Service Administrators. Everything you need to get the most out of AutoCare.')}
    <section class="container section">
      <div class="admin-grid">
        ${guideGroup('For Customers', [
          ['Creating an account & logging in', 'Click "Sign in" or "Create a customer account". Enter your name, email, mobile number, and password. Use your email to sign in.'],
          ['Booking a service appointment', 'Click "Book a service" in the header or on any car/service card. Select your car, service type, preferred date, time slot, and doorstep pickup preference.'],
          ['Tracking your vehicle live', 'Go to "Track vehicle", enter your Booking ID (e.g. AC-2026-0816) and matching registered email or registration number. View the 5-step progress and advisor notes.'],
          ['Managing your garage & invoices', 'In your Customer Workspace, view your registered vehicles, add new cars, track service history, and review itemized invoice receipts.']
        ])}

        ${guideGroup('For Workshop Technicians', [
          ['Accessing assigned service jobs', 'Sign in as an Employee (demo: arjun@autocare.example). Your dashboard displays all active service jobs.'],
          ['Publishing status updates & milestones', 'Click "UPDATE" on any assigned job. Choose the new milestone (Inspection, In Progress, Quality Check, Ready), add advisor notes, and update ETA. The customer tracking timeline updates instantly!'],
          ['Reviewing inspection checklists', 'Check off daily diagnostic tasks including 42-point safety scans, brake disc inspections, and fluid leak tests.']
        ])}

        ${guideGroup('For Administrators', [
          ['Operational analytics & KPIs', 'Sign in as Admin (demo: admin@autocare.example). View live computed KPIs: total customers, active jobs, completed services, and revenue.'],
          ['Reassigning service personnel', 'In the Staff Assignment Queue, use the dropdown on any booking to assign technician Arjun Mehta, Riya Shah, or Manav Kapoor. Updates are written directly to the server.'],
          ['Auditing system activity', 'Review the live audit log feed for every registration, login, status update, and customer inquiry.']
        ])}
      </div>
    </section>
  `;
}

// 9. Legal Pages (Terms & Privacy)
function legalPage(type) {
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const lead = isPrivacy
    ? 'How AutoCare Service Hub safeguards vehicle telemetry, customer information, and booking data.'
    : 'The operational terms and conditions governing service bookings, estimates, warranties, and vehicle custody.';

  return `
    ${pageHero(title, `${title.split(' ')[0]} <em>${title.split(' ').slice(1).join(' ')}</em>`, lead)}
    <section class="container section">
      <article class="panel" style="max-width:880px;margin:auto">
        <div class="eyebrow red">Effective Date: October 2026</div>
        <h2 style="font-size:30px;letter-spacing:-0.03em;margin:14px 0;font-weight:800">${title}</h2>
        <div style="color:var(--muted);font-size:13px;line-height:1.9">
          <h3 style="color:var(--paper);font-size:16px;margin:22px 0 8px">1. Vehicle Service Custody &amp; Inspection</h3>
          <p>AutoCare Service Hub performs authorized mechanical, electrical, and detailing services in accordance with OEM manufacturer guidelines. Vehicles taken into custody undergo mandatory 360-degree condition photography upon reception.</p>

          <h3 style="color:var(--paper);font-size:16px;margin:22px 0 8px">2. Estimates and Approvals</h3>
          <p>No repair exceeding the initial estimated scope is executed without prior customer approval via the digital tracking interface or written communication.</p>

          <h3 style="color:var(--paper);font-size:16px;margin:22px 0 8px">3. 12-Month Warranty Coverage</h3>
          <p>All genuine OEM replacement parts supplied and installed by AutoCare carry a 12-month or 10,000 km warranty against manufacturing defects.</p>

          <h3 style="color:var(--paper);font-size:16px;margin:22px 0 8px">4. Data Protection &amp; Confidentiality</h3>
          <p>Customer contact details, vehicle registration numbers, and service history are encrypted and strictly isolated by user role. We never share customer information with unauthorized third parties.</p>
        </div>
      </article>
    </section>
  `;
}

// ====================================================
// DASHBOARDS: Customer, Employee, Admin
// ====================================================

async function dashboardShell(role, tab = 'overview') {
  if (!currentUser) {
    return `
      <section class="container section" style="text-align:center">
        <div class="panel" style="max-width:500px;margin:auto;padding:50px 30px">
          <div style="font-size:48px;color:var(--red);margin-bottom:16px">🔒</div>
          <h2>Authentication Required</h2>
          <p class="lead" style="margin:12px auto 26px">Please sign in with your ${role} credentials to access this workspace.</p>
          <button class="primary-btn" data-action="login">Sign In Now <span>↗</span></button>
        </div>
      </section>
    `;
  }

  const isCustomer = role === 'customer';
  const isEmployee = role === 'employee';
  const isAdmin = role === 'admin';

  let navItems = [];
  if (isCustomer) {
    navItems = [
      ['overview', '⌂', 'Overview'],
      ['vehicles', '▣', 'My Vehicles'],
      ['history', '◌', 'Service History'],
      ['invoices', '◈', 'Invoices']
    ];
  } else if (isEmployee) {
    navItems = [
      ['overview', '⌂', 'My Jobs'],
      ['checklists', '✓', 'Checklists'],
      ['notifications', '✉', 'Notifications']
    ];
  } else {
    navItems = [
      ['overview', '⌂', 'Operations Overview'],
      ['bookings', '◌', 'All Bookings'],
      ['assignments', '◉', 'Staff Assignments'],
      ['audit', '◈', 'Audit & Logs']
    ];
  }

  let contentHtml = '';
  try {
    if (isCustomer) contentHtml = await customerDashboardContent(tab);
    else if (isEmployee) contentHtml = await employeeDashboardContent(tab);
    else contentHtml = await adminDashboardContent(tab);
  } catch (err) {
    contentHtml = `<div class="panel"><p class="lead" style="color:var(--red-soft)">Error loading workspace data: ${esc(err.message)}</p></div>`;
  }

  return `
    <section class="dash-shell">
      <aside class="side-nav">
        <div class="role-label">${currentUser.role} Workspace</div>
        ${navItems.map(n => `
          <button class="nav-item ${tab === n[0] ? 'active' : ''}" data-dash-tab="${n[0]}">
            <span>${n[1]}</span> ${n[2]}
          </button>
        `).join('')}
        <button class="logout-btn" data-action="logout">
          <span>↗</span> Sign out
        </button>
      </aside>

      <main class="dash-content">
        <div class="dash-title-row">
          <div>
            <div class="eyebrow red">${currentUser.role} Portal</div>
            <h1>Welcome back, ${esc(currentUser.name)}.</h1>
            <p class="dash-subtitle">
              ${isCustomer ? 'Manage your registered vehicles and follow live workshop progress.' : isEmployee ? `Logged in as Service Technician (${currentUser.employeeCode || 'AC-EMP'}).` : 'AutoCare Central Operations &amp; Resource Management.'}
            </p>
          </div>
          <div class="user-pill">
            <span class="avatar">${esc(currentUser.name.slice(0, 2).toUpperCase())}</span>
            <span>${esc(currentUser.name)}</span>
          </div>
        </div>

        <div id="dashTabContainer">
          ${contentHtml}
        </div>
      </main>
    </section>
  `;
}

// Customer Dashboard Subviews
async function customerDashboardContent(tab) {
  const [bookingsRes, vehiclesRes] = await Promise.all([
    api('/api/bookings'),
    api('/api/vehicles')
  ]);

  const bookings = bookingsRes.data || [];
  const vehicles = vehiclesRes.data || [];
  const activeBooking = bookings.find(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED') || bookings[0];

  if (tab === 'vehicles') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>My Registered Vehicles (${vehicles.length})</h2>
          <button class="dash-action" data-action="add-vehicle">+ REGISTER VEHICLE</button>
        </div>
        ${vehicles.length ? `
          <div class="table-scroll">
            <table class="dash-table">
              <thead>
                <tr>
                  <th>Vehicle Model</th>
                  <th>Registration</th>
                  <th>Year</th>
                  <th>Fuel</th>
                  <th>Color</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${vehicles.map(v => `
                  <tr>
                    <td><b>${esc(v.brand)} ${esc(v.model)}</b></td>
                    <td><span style="font:700 11px var(--font-mono);color:var(--aqua)">${esc(v.registration)}</span></td>
                    <td>${esc(v.year)}</td>
                    <td>${esc(v.fuel)}</td>
                    <td>${esc(v.color)}</td>
                    <td>
                      <button class="micro-btn" data-action="booking" data-vehicle="${esc(v.brand)} ${esc(v.model)}" data-reg="${esc(v.registration)}">
                        Book Service ↗
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="text-align:center;padding:40px 20px">
            <p class="lead">You haven't registered any vehicles yet.</p>
            <button class="primary-btn" data-action="add-vehicle" style="margin-top:14px">+ Register Your First Car</button>
          </div>
        `}
      </section>
    `;
  }

  if (tab === 'history') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Complete Service History (${bookings.length})</h2>
          <button class="dash-action" data-action="booking">+ BOOK NEW SERVICE</button>
        </div>
        <div class="table-scroll">
          <table class="dash-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Vehicle &amp; Reg</th>
                <th>Service Type</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total Cost</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(b => `
                <tr>
                  <td><b>${esc(b.id)}</b></td>
                  <td><b>${esc(b.vehicle)}</b><br/><span style="font-size:11px;color:var(--muted)">${esc(b.registration)}</span></td>
                  <td>${esc(b.serviceName || b.service)}</td>
                  <td>${formatDate(b.appointmentAt)}</td>
                  <td>${formatStatus(b.statusLabel || b.status)}</td>
                  <td><b>${esc(b.cost)}</b></td>
                  <td>
                    <button class="micro-btn" data-route="track" data-track-id="${esc(b.id)}" data-track-reg="${esc(b.registration)}">
                      Track Live ↗
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  if (tab === 'invoices') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Tax Invoices &amp; Warranty Certificates</h2>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px">
          ${bookings.map(b => `
            <div style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:20px;background:var(--surface-2)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font:700 11px var(--font-mono);color:var(--aqua)">INV-${esc(b.id)}</span>
                <span style="font-size:11px;color:var(--muted)">${formatDate(b.appointmentAt)}</span>
              </div>
              <h3 style="font-size:16px;margin:0 0 6px">${esc(b.vehicle)}</h3>
              <p style="font-size:12.5px;color:var(--muted);margin:0 0 16px">${esc(b.serviceName || b.service)}</p>
              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:12px">
                <b>${esc(b.cost)}</b>
                <button class="micro-btn" onclick="window.print()">Print Receipt 🖨</button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  // Default: Overview Tab
  return `
    <div class="metric-grid">
      <div class="metric">
        <label>My Vehicles</label>
        <b>0${vehicles.length}</b>
        <small style="cursor:pointer" data-action="add-vehicle">+ Add another</small>
      </div>
      <div class="metric">
        <label>Active Bookings</label>
        <b>0${bookings.filter(b => b.status !== 'COMPLETED').length}</b>
        <small>● Live in workshop</small>
      </div>
      <div class="metric">
        <label>Completed Services</label>
        <b>0${bookings.filter(b => b.status === 'COMPLETED').length + 8}</b>
        <small>↑ 100% On-time</small>
      </div>
      <div class="metric">
        <label>Warranty Status</label>
        <b>Active</b>
        <small>12 Months Comprehensive</small>
      </div>
    </div>

    <div class="dash-grid">
      <section class="panel">
        <div class="panel-head">
          <h2>Active Service Appointment</h2>
          ${activeBooking ? `<a href="#track" data-route="track" data-track-id="${esc(activeBooking.id)}" data-track-reg="${esc(activeBooking.registration)}">TRACK LIVE ↗</a>` : ''}
        </div>
        ${activeBooking ? `
          <div class="booking-row">
            ${safeImg(DEFAULT_IMAGES.car, activeBooking.vehicle, 'vehicle-thumb')}
            <div>
              <b>${esc(activeBooking.vehicle)} · ${esc(activeBooking.serviceName || activeBooking.service)}</b>
              <span>${esc(activeBooking.id)} · Scheduled: ${formatDate(activeBooking.appointmentAt)}</span>
            </div>
            ${formatStatus(activeBooking.statusLabel || activeBooking.status)}
          </div>
          <div class="track-tip" style="margin-top:18px">
            <b>Latest Workshop Update:</b><br/>
            <span>${esc(activeBooking.notes || 'Vehicle under scheduled technician care.')}</span>
          </div>
        ` : `
          <p class="lead">No active service appointments right now.</p>
          <button class="primary-btn" data-action="booking" style="margin-top:14px">Book a Service <span>↗</span></button>
        `}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Recent Activity</h2>
          <a href="#help">HELP GUIDE ↗</a>
        </div>
        <div class="activity">
          <i>✓</i>
          <p><b>Vehicle Inspection Diagnostics Passed</b><time>Today · 11:03 AM</time></p>
        </div>
        <div class="activity">
          <i>◌</i>
          <p><b>Vehicle Checked-in at AutoCare Koramangala</b><time>Today · 10:27 AM</time></p>
        </div>
        <div class="activity">
          <i>✉</i>
          <p><b>Appointment Confirmed &amp; Service Bay Allocated</b><time>Today · 09:14 AM</time></p>
        </div>
        <button class="primary-btn" data-action="booking" style="width:100%;margin-top:16px">Book another service <span>↗</span></button>
      </section>
    </div>

    <section class="panel" style="margin-top:20px">
      <div class="panel-head">
        <h2>My Garage (${vehicles.length} Cars)</h2>
        <button class="dash-action" data-action="add-vehicle">+ ADD VEHICLE</button>
      </div>
      <div class="table-scroll">
        <table class="dash-table">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Registration Plate</th>
              <th>Fuel</th>
              <th>Service Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${vehicles.map(v => `
              <tr>
                <td><b>${esc(v.brand)} ${esc(v.model)}</b></td>
                <td><span style="font:700 11px var(--font-mono);color:var(--aqua)">${esc(v.registration)}</span></td>
                <td>${esc(v.fuel)}</td>
                <td><span class="status-chip">Registered</span></td>
                <td>
                  <button class="micro-btn" data-action="booking" data-vehicle="${esc(v.brand)} ${esc(v.model)}" data-reg="${esc(v.registration)}">
                    Book Service ↗
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// Employee Dashboard Subviews
async function employeeDashboardContent(tab) {
  const bookingsRes = await api('/api/bookings');
  const allBookings = bookingsRes.data || [];

  if (tab === 'checklists') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Today's 42-Point Diagnostic Checklists</h2>
        </div>
        <div style="display:grid;gap:12px">
          ${[
            ['Engine Bay & Lubrication', 'Inspect engine oil level, oil filter seal, air filter cleanliness, coolant specific gravity, and brake fluid moisture content.', true],
            ['Underbody & Suspension', 'Check ball joints, steering rack tie-rods, suspension strut bushings, exhaust hangers, and underbody anti-rust protection.', true],
            ['Brake Calipers & Rotors', 'Measure front & rear brake pad thickness with digital caliper (minimum 3.0mm required), inspect rotor runout, and bleed hydraulic lines.', false],
            ['Battery & Alternator Electricals', 'Perform high-rate discharge load test, check cranking voltage, inspect battery terminal corrosion, and scan OBD-II diagnostic trouble codes.', false],
            ['Final Road Test & Wash', '10-minute dynamic steering alignment test, AC cabin vent temperature verification (sub-8°C target), and complimentary foam wash check.', false]
          ].map((item, idx) => `
            <div style="border:1px solid var(--line);border-radius:var(--radius-sm);padding:18px;background:var(--surface-2);display:flex;align-items:flex-start;gap:14px">
              <input type="checkbox" ${item[2] ? 'checked' : ''} style="margin-top:4px;cursor:pointer;accent-color:var(--red)" id="chk_${idx}">
              <div>
                <label for="chk_${idx}" style="font-weight:700;font-size:14px;cursor:pointer;display:block;margin-bottom:4px">${item[0]}</label>
                <p style="font-size:12.5px;color:var(--muted);margin:0">${item[1]}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (tab === 'notifications') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Technician Service Notification Stream</h2>
        </div>
        <div style="display:grid;gap:12px">
          ${[
            ['Status update sent to Rhea Nair for AC-2026-0816', '12 minutes ago'],
            ['New estimate approval received for Tata Nexon front pads', '1 hour ago'],
            ['Quality check scheduled for Honda City (KA 03 DN 4370)', '2 hours ago'],
            ['Doorstep pickup completed by driver for Toyota Fortuner', '3 hours ago']
          ].map(n => `
            <div class="activity">
              <i>✉</i>
              <p><b>${n[0]}</b><time>${n[1]}</time></p>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  // Default: Jobs Tab
  return `
    <div class="metric-grid">
      <div class="metric">
        <label>Assigned Jobs</label>
        <b>0${allBookings.length}</b>
        <small>● Active queue</small>
      </div>
      <div class="metric">
        <label>Work In Progress</label>
        <b>0${allBookings.filter(b => (b.status || '').includes('PROGRESS') || (b.status || '').includes('INSPECTION')).length}</b>
        <small>On service bays</small>
      </div>
      <div class="metric">
        <label>Ready for Delivery</label>
        <b>0${allBookings.filter(b => (b.status || '').includes('READY')).length}</b>
        <small>Quality check complete</small>
      </div>
      <div class="metric">
        <label>Technician ID</label>
        <b>${currentUser.employeeCode || 'AC-EMP-01'}</b>
        <small>Master Certified</small>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head">
        <h2>Assigned Workshop Jobs (${allBookings.length})</h2>
        <a href="#help">EMPLOYEE GUIDE ↗</a>
      </div>

      <div class="dash-filters">
        <select id="empStatusFilter">
          <option value="">All Statuses</option>
          <option value="BOOKING_RECEIVED">Booking Received</option>
          <option value="INSPECTION_STARTED">Inspection Started</option>
          <option value="WORK_IN_PROGRESS">Work In Progress</option>
          <option value="QUALITY_CHECK">Quality Check</option>
          <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <input id="empJobSearch" placeholder="Search booking ID, vehicle, or customer...">
      </div>

      <div class="table-scroll">
        <table class="dash-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Vehicle / Customer</th>
              <th>Service</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="empJobsTableBody">
            ${allBookings.map(b => `
              <tr>
                <td><b>${esc(b.id)}</b><br/><span style="font-size:10px;color:var(--muted)">${formatDate(b.appointmentAt)}</span></td>
                <td><b>${esc(b.vehicle)}</b><br/><span style="color:var(--muted)">${esc(b.customerName || b.customerEmail)}</span></td>
                <td>${esc(b.serviceName || b.service)}</td>
                <td>${formatStatus(b.statusLabel || b.status)}</td>
                <td><span style="font-weight:700;color:${b.priority === 'High' ? 'var(--red-soft)' : 'var(--paper)'}">${esc(b.priority || 'Normal')}</span></td>
                <td>
                  <button class="dash-action" data-action="update-status" data-booking-id="${esc(b.id)}">
                    UPDATE STATUS
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// Admin Dashboard Subviews
async function adminDashboardContent(tab) {
  const [metricsRes, bookingsRes, logsRes, employeesRes] = await Promise.all([
    api('/api/admin/metrics'),
    api('/api/bookings'),
    api('/api/admin/logs'),
    api('/api/admin/employees')
  ]);

  const metrics = metricsRes.data || {};
  const bookings = bookingsRes.data || [];
  const logs = logsRes.data || [];
  const employees = employeesRes.data || [];

  if (tab === 'bookings') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>All Workshop Bookings (${bookings.length})</h2>
          <button class="dash-action" data-action="booking">+ NEW BOOKING</button>
        </div>
        <div class="table-scroll">
          <table class="dash-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Customer</th>
                <th>Vehicle &amp; Reg</th>
                <th>Service</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Cost</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map(b => `
                <tr>
                  <td><b>${esc(b.id)}</b></td>
                  <td><b>${esc(b.customerName)}</b><br/><span style="font-size:10.5px;color:var(--muted)">${esc(b.customerEmail)}</span></td>
                  <td><b>${esc(b.vehicle)}</b><br/><span style="font-size:10.5px;color:var(--aqua)">${esc(b.registration)}</span></td>
                  <td>${esc(b.serviceName || b.service)}</td>
                  <td><b>${esc(b.employeeName || 'Unassigned')}</b></td>
                  <td>${formatStatus(b.statusLabel || b.status)}</td>
                  <td><b>${esc(b.cost)}</b></td>
                  <td>
                    <button class="micro-btn" data-action="update-status" data-booking-id="${esc(b.id)}">Update</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  if (tab === 'assignments') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Staff Assignment Control Queue</h2>
        </div>
        <p class="lead" style="margin-bottom:20px">Reassign primary technician or advisor for active service bays. Changes persist directly to the database.</p>
        <div style="display:grid;gap:12px">
          ${bookings.map(b => `
            <div class="employee-card" style="padding:16px;background:var(--surface-2);border-radius:var(--radius-sm)">
              <div>
                <b style="font-size:14px">${esc(b.id)} · ${esc(b.vehicle)} (${esc(b.registration)})</b>
                <span style="font-size:12px;color:var(--muted);margin-top:4px">${esc(b.serviceName || b.service)} · Customer: ${esc(b.customerName)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:12px">
                <span style="font-size:12px;color:var(--muted)">Assigned:</span>
                <select class="assign-select" data-assign-booking="${esc(b.id)}">
                  ${employees.map(emp => `
                    <option value="${esc(emp.id)}" ${emp.name === b.employeeName ? 'selected' : ''}>
                      ${esc(emp.name)} (${esc(emp.employeeCode || 'TECH')})
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  if (tab === 'audit') {
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>Live System Audit &amp; Activity Log (${logs.length})</h2>
        </div>
        <div style="display:grid;gap:10px">
          ${logs.map(log => `
            <div class="activity" style="background:var(--surface-2);padding:14px;border-radius:var(--radius-sm)">
              <i>◈</i>
              <div>
                <b>${esc(log.action)}: ${esc(log.details)}</b>
                <time>${formatDate(log.time)} · ID: ${esc(log.id)}</time>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  // Default: Overview Tab
  return `
    <div class="metric-grid">
      <div class="metric">
        <label>Total Registered Customers</label>
        <b>${metrics.totalCustomers || 1284}</b>
        <small>↑ 8.4% this month</small>
      </div>
      <div class="metric">
        <label>Active Workshop Jobs</label>
        <b>${metrics.activeBookings || 4}</b>
        <small>Across 6 Service Bays</small>
      </div>
      <div class="metric">
        <label>Completed Services</label>
        <b>${metrics.completedServices || 378}</b>
        <small>100% Quality Inspected</small>
      </div>
      <div class="metric">
        <label>Monthly Service Revenue</label>
        <b>${metrics.totalRevenue || '₹8.4L'}</b>
        <small>↑ 11.6% vs target</small>
      </div>
    </div>

    <div class="dash-grid">
      <section class="panel">
        <div class="panel-head">
          <h2>Monthly Revenue Trend (Lakhs)</h2>
          <button class="micro-btn" onclick="window.print()">Export Summary</button>
        </div>
        <div class="chart">
          <div class="bar" data-label="May" style="height:48%"></div>
          <div class="bar" data-label="Jun" style="height:62%"></div>
          <div class="bar" data-label="Jul" style="height:74%"></div>
          <div class="bar" data-label="Aug" style="height:86%"></div>
          <div class="bar" data-label="Sep" style="height:79%"></div>
          <div class="bar" data-label="Oct" style="height:92%"></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Service Status Overview</h2>
        </div>
        ${[
          ['Work In Progress', metrics.statusCounts?.['Work In Progress'] || 2, 'var(--red)'],
          ['Ready for Delivery', metrics.statusCounts?.['Ready for Delivery'] || 1, 'var(--green)'],
          ['Appointment Confirmed', metrics.statusCounts?.['Appointment Confirmed'] || 1, 'var(--yellow)'],
          ['Completed', metrics.statusCounts?.['Completed'] || 1, 'var(--aqua)']
        ].map(row => `
          <div class="booking-row">
            <span style="color:${row[2]};font-size:22px">●</span>
            <div><b>${row[0]}</b><span>Active vehicle status</span></div>
            <b>0${row[1]}</b>
          </div>
        `).join('')}
      </section>
    </div>

    <div class="admin-grid" style="margin-top:20px">
      <section class="panel">
        <div class="panel-head">
          <h2>Live Assignment Queue</h2>
          <button class="micro-btn" data-dash-tab="assignments">View All →</button>
        </div>
        ${bookings.slice(0, 4).map(b => `
          <div class="employee-card">
            <div>
              <b>${esc(b.id)} · ${esc(b.vehicle)}</b>
              <span>${esc(b.serviceName || b.service)} · ${esc(b.registration)}</span>
            </div>
            <select class="assign-select" data-assign-booking="${esc(b.id)}">
              ${employees.map(emp => `
                <option value="${esc(emp.id)}" ${emp.name === b.employeeName ? 'selected' : ''}>
                  ${esc(emp.name)}
                </option>
              `).join('')}
            </select>
          </div>
        `).join('')}
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Operational Audit Feed</h2>
          <button class="micro-btn" data-dash-tab="audit">View All →</button>
        </div>
        ${logs.slice(0, 4).map(l => `
          <div class="activity">
            <i>◈</i>
            <p><b>${esc(l.details)}</b><time>${formatDate(l.time)}</time></p>
          </div>
        `).join('')}
      </section>
    </div>
  `;
}

// ====================================================
// MODALS: Login, Register, Book, Status, Add Vehicle
// ====================================================

function openModal(content) {
  modalRoot.innerHTML = content;
  modalRoot.classList.add('open');
  modalRoot.setAttribute('aria-hidden', 'false');
  const firstInput = modalRoot.querySelector('input:not([readonly]), select, textarea, button.primary-btn');
  if (firstInput) setTimeout(() => firstInput.focus(), 50);
}

function closeModal() {
  modalRoot.classList.remove('open');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
}

// 1. Login Modal
function loginModal() {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
      <button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>
      <div class="eyebrow red">Welcome Back</div>
      <h2 id="loginTitle">Sign in to AutoCare</h2>
      <p class="intro">Access your customer service records, technician jobs, or admin command hub.</p>

      <div class="role-tabs" id="loginRoleTabs">
        <button class="active" data-demo-role="customer">Customer</button>
        <button data-demo-role="employee">Technician</button>
        <button data-demo-role="admin">Admin</button>
      </div>

      <form id="loginForm">
        <div class="field">
          <label for="loginEmail">Email Address</label>
          <input id="loginEmail" type="email" required value="rhea@example.com" autocomplete="email">
        </div>
        <div class="field">
          <label for="loginPassword">Password</label>
          <input id="loginPassword" type="password" required value="DemoPass123!" autocomplete="current-password">
        </div>

        <button class="primary-btn" type="submit" id="loginSubmitBtn">
          Secure Sign In <span>↗</span>
        </button>
      </form>

      <div class="demo-note">
        <b>Quick Demo Accounts (Password: DemoPass123!):</b><br/>
        • Customer: <code>rhea@example.com</code><br/>
        • Technician: <code>arjun@autocare.example</code><br/>
        • Administrator: <code>admin@autocare.example</code>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:12px;color:var(--muted)">
        <a href="#help" data-action="close-modal">Forgot password?</a>
        <button data-action="register" style="background:transparent;border:0;color:var(--aqua);font-weight:800;font-size:12px">
          Create customer account →
        </button>
      </div>
    </div>
  `;
}

// 2. Register Modal
function registerModal() {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="regTitle">
      <button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>
      <div class="eyebrow red">New Customer</div>
      <h2 id="regTitle">Create your AutoCare Account</h2>
      <p class="intro">Register to manage your vehicle services, track live repair milestones, and store digital inspection history.</p>

      <form id="registerForm">
        <div class="form-row">
          <div class="field">
            <label for="regName">Full Name</label>
            <input id="regName" required placeholder="e.g. Vikram Malhotra">
          </div>
          <div class="field">
            <label for="regMobile">Mobile Number</label>
            <input id="regMobile" required placeholder="+91 98765 43210">
          </div>
        </div>

        <div class="field">
          <label for="regEmail">Email Address</label>
          <input id="regEmail" type="email" required placeholder="you@example.com">
        </div>

        <div class="field">
          <label for="regPassword">Password (6+ characters)</label>
          <input id="regPassword" type="password" minlength="6" required placeholder="Create a secure password">
        </div>

        <button class="primary-btn" type="submit" id="registerSubmitBtn">
          Create &amp; Sign In <span>↗</span>
        </button>
      </form>

      <div style="text-align:center;margin-top:16px;font-size:12px;color:var(--muted)">
        Already have an account? 
        <button data-action="login" style="background:transparent;border:0;color:var(--red-soft);font-weight:800">
          Sign In
        </button>
      </div>
    </div>
  `;
}

// 3. Service Booking Modal
async function bookingModal(serviceId = '', vehicleName = '', regNum = '') {
  let userVehicles = [];
  if (currentUser) {
    try {
      const res = await api('/api/vehicles');
      userVehicles = res.data || [];
    } catch (e) {
      console.warn('Could not fetch user vehicles:', e);
    }
  }

  // Calculate default appointment date as tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bookModalTitle">
      <button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>
      <div class="eyebrow red">Reserve Service Bay</div>
      <h2 id="bookModalTitle">Book a Workshop Visit</h2>
      <p class="intro">Select your vehicle, service routine, and preferred date. We confirm your bay allocation instantly.</p>

      <form id="bookingModalForm">
        <div class="form-row">
          <div class="field">
            <label for="modalBookVehicle">Vehicle</label>
            ${userVehicles.length ? `
              <select id="modalBookVehicle" required>
                ${vehicleName ? `<option value="${esc(vehicleName)}" selected>${esc(vehicleName)}</option>` : ''}
                ${userVehicles.map(v => `<option value="${esc(v.brand)} ${esc(v.model)}">${esc(v.brand)} ${esc(v.model)} · ${esc(v.registration)}</option>`).join('')}
                <option value="custom">Other / Custom Vehicle...</option>
              </select>
            ` : `
              <input id="modalBookVehicle" required value="${esc(vehicleName || 'Hyundai Creta')}" placeholder="e.g. Hyundai Creta, Honda City">
            `}
          </div>

          <div class="field">
            <label for="modalBookReg">Registration Plate Number</label>
            <input id="modalBookReg" required value="${esc(regNum || 'KA 01 MG 7412')}" placeholder="e.g. KA 01 MG 7412" style="text-transform:uppercase">
          </div>
        </div>

        <div class="field">
          <label for="modalBookService">Service Routine</label>
          <select id="modalBookService" required>
            ${cachedServices.map(s => `
              <option value="${s.id}" ${s.id === Number(serviceId) ? 'selected' : ''}>
                ${esc(s.name)} (${esc(s.price)})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="modalBookDate">Preferred Date</label>
            <input id="modalBookDate" type="date" required min="${minDate}" value="${minDate}">
          </div>

          <div class="field">
            <label for="modalBookSlot">Time Slot</label>
            <select id="modalBookSlot">
              <option>09:00–11:00 AM (Morning)</option>
              <option>11:00–01:00 PM (Midday)</option>
              <option>02:00–04:00 PM (Afternoon)</option>
              <option>04:00–06:00 PM (Evening)</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="modalBookPickup">Visit Preference</label>
            <select id="modalBookPickup">
              <option value="false">Workshop Lounge Visit</option>
              <option value="true">Doorstep Pickup &amp; Drop (+ ₹299)</option>
            </select>
          </div>

          <div class="field">
            <label for="modalBookPayment">Payment Preference</label>
            <select id="modalBookPayment">
              <option>Pay at service center</option>
              <option>Card / UPI at completion</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="modalBookNotes">Notes / Symptoms for the Advisor</label>
          <textarea id="modalBookNotes" placeholder="Describe any noises, vibrations, AC performance issues, or specific requests..."></textarea>
        </div>

        <button class="primary-btn" type="submit" id="bookSubmitBtn">
          Confirm Appointment &amp; Reserve Bay <span>↗</span>
        </button>
      </form>
    </div>
  `;
}

// 4. Employee / Admin Status Update Modal
async function statusUpdateModal(bookingId) {
  let booking = null;
  try {
    const res = await api('/api/bookings');
    booking = (res.data || []).find(b => b.id === bookingId);
  } catch (e) {
    console.warn(e);
  }

  if (!booking) {
    booking = { id: bookingId, status: 'WORK_IN_PROGRESS', vehicle: 'Vehicle', notes: '' };
  }

  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="statusModalTitle">
      <button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>
      <div class="eyebrow red">Technician Workspace</div>
      <h2 id="statusModalTitle">Publish Service Milestone</h2>
      <p class="intro">This update updates the live tracking timeline and records an immutable audit log entry.</p>

      <form id="statusUpdateForm" data-booking-id="${esc(bookingId)}">
        <div class="field">
          <label>Booking ID</label>
          <input value="${esc(bookingId)}" readonly style="background:var(--surface-2);color:var(--muted)">
        </div>

        <div class="field">
          <label for="updateNewStatus">New Status Milestone</label>
          <select id="updateNewStatus" required>
            <option value="INSPECTION_STARTED" ${booking.status === 'INSPECTION_STARTED' ? 'selected' : ''}>Inspection Started (Bay Diagnostics)</option>
            <option value="WORK_IN_PROGRESS" ${booking.status === 'WORK_IN_PROGRESS' ? 'selected' : ''}>Work In Progress (Active Service)</option>
            <option value="WAITING_FOR_SPARE_PARTS" ${booking.status === 'WAITING_FOR_SPARE_PARTS' ? 'selected' : ''}>Waiting for Spare Parts (OEM Transit)</option>
            <option value="QUALITY_CHECK" ${booking.status === 'QUALITY_CHECK' ? 'selected' : ''}>Quality Check &amp; Road Test</option>
            <option value="READY_FOR_DELIVERY" ${booking.status === 'READY_FOR_DELIVERY' ? 'selected' : ''}>Ready for Delivery (Wash Complete)</option>
            <option value="COMPLETED" ${booking.status === 'COMPLETED' ? 'selected' : ''}>Completed &amp; Handed Over</option>
          </select>
        </div>

        <div class="field">
          <label for="updateNotes">Customer-Visible Advisor Note</label>
          <textarea id="updateNotes" required placeholder="Detailed notes about parts replaced, inspection findings, and vehicle condition...">${esc(booking.notes || 'Scheduled technician service underway. Quality checks to follow.')}</textarea>
        </div>

        <button class="primary-btn" type="submit" id="statusSubmitBtn">
          Publish Update Live <span>↗</span>
        </button>
      </form>
    </div>
  `;
}

// 5. Add Customer Vehicle Modal
function addVehicleModal() {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="addVehTitle">
      <button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>
      <div class="eyebrow red">Garage Management</div>
      <h2 id="addVehTitle">Register a Vehicle</h2>
      <p class="intro">Save your car details to your AutoCare profile for one-click service bookings and maintenance reminders.</p>

      <form id="addVehicleForm">
        <div class="form-row">
          <div class="field">
            <label for="newVehBrand">Manufacturer Brand</label>
            <select id="newVehBrand" required>
              <option>Toyota</option>
              <option>Hyundai</option>
              <option>Maruti Suzuki</option>
              <option>Tata Motors</option>
              <option>Honda</option>
              <option>Kia</option>
              <option>Other</option>
            </select>
          </div>

          <div class="field">
            <label for="newVehModel">Model Name</label>
            <input id="newVehModel" required placeholder="e.g. Creta, City, Nexon">
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="newVehReg">Registration Number</label>
            <input id="newVehReg" required placeholder="e.g. KA 01 AB 1234" style="text-transform:uppercase">
          </div>

          <div class="field">
            <label for="newVehYear">Manufacturing Year</label>
            <input id="newVehYear" type="number" min="2000" max="2027" value="2023" required>
          </div>
        </div>

        <div class="form-row">
          <div class="field">
            <label for="newVehFuel">Fuel Type</label>
            <select id="newVehFuel">
              <option>Petrol</option>
              <option>Diesel</option>
              <option>CNG</option>
              <option>Electric (EV)</option>
              <option>Hybrid</option>
            </select>
          </div>

          <div class="field">
            <label for="newVehColor">Color</label>
            <input id="newVehColor" placeholder="e.g. Polar White, Phantom Black">
          </div>
        </div>

        <button class="primary-btn" type="submit" id="addVehSubmitBtn">
          Save Vehicle to Garage <span>↗</span>
        </button>
      </form>
    </div>
  `;
}

// ====================================================
// MAIN RENDER DISPATCHER
// ====================================================

async function render() {
  activeRoute = location.hash.replace('#', '') || 'home';
  updateHeader();

  // Render appropriate view
  let html = '';
  try {
    if (activeRoute === 'home') {
      html = homePage();
    } else if (activeRoute === 'services' || activeRoute === 'cars' || activeRoute.startsWith('car-')) {
      html = servicesPage();
    } else if (activeRoute === 'track') {
      html = trackPage();
    } else if (activeRoute === 'about') {
      html = aboutPage();
    } else if (activeRoute === 'contact') {
      html = contactPage();
    } else if (activeRoute === 'help') {
      html = helpPage();
    } else if (activeRoute === 'terms' || activeRoute === 'privacy') {
      html = legalPage(activeRoute);
    } else if (activeRoute.startsWith('dashboard-')) {
      const role = activeRoute.split('-')[1];
      html = await dashboardShell(role, 'overview');
    } else {
      html = homePage();
    }
  } catch (err) {
    html = `
      <section class="container section">
        <div class="panel" style="text-align:center;padding:50px 20px">
          <h2>Something went wrong</h2>
          <p class="lead" style="color:var(--red-soft);margin:12px auto">${esc(err.message)}</p>
          <button class="primary-btn" data-route="home">Return Home</button>
        </div>
      </section>
    `;
  }

  app.innerHTML = `<div class="page">${html}</div>`;

  // Update nav active link state
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === activeRoute);
  });

  // Close mobile drawer on route change
  siteHeader.classList.remove('mobile-open');
  menuButton.setAttribute('aria-expanded', 'false');

  bindPageInteractions();
}

// Event Bindings for In-Page Forms and Controls
function bindPageInteractions() {
  // 1. Services Search & Category Filter
  const serviceSearch = document.getElementById('serviceSearch');
  const serviceChips = document.querySelectorAll('.service-chip');
  if (serviceSearch && serviceChips.length) {
    let activeCat = 'All Services';
    const doServiceFilter = () => {
      const q = serviceSearch.value.trim().toLowerCase();
      const filtered = cachedServices.filter(s => {
        const cat = SERVICE_CATEGORIES[s.id] || '';
        let matchCat = activeCat === 'All Services';
        if (!matchCat) {
          if (activeCat === 'Emergency & EV') {
            matchCat = cat.includes('Emergency') || cat.includes('EV') || cat.includes('Specialized') || cat.includes('Insurance');
          } else {
            matchCat = cat === activeCat;
          }
        }
        const matchQ = !q ||
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q) ||
          (s.includes && s.includes.some(inc => inc.toLowerCase().includes(q)));
        return matchCat && matchQ;
      });

      const grid = document.getElementById('servicesGrid');
      const count = document.getElementById('serviceCount');

      if (grid) {
        if (filtered.length) {
          grid.innerHTML = filtered.map(serviceFullCard).join('');
        } else {
          grid.innerHTML = `
            <div class="no-services-box">
              <h3>No matching service packages found</h3>
              <p>We can still service your vehicle! You can book a custom service or diagnostic visit directly.</p>
              <button class="primary-btn" data-action="booking" style="margin-top:16px">Book Custom Service Visit ↗</button>
            </div>
          `;
        }
      }
      if (count) {
        count.textContent = `${filtered.length} certified workshop package${filtered.length === 1 ? '' : 's'} available`;
      }
    };

    serviceSearch.addEventListener('input', doServiceFilter);

    serviceChips.forEach(chip => {
      chip.addEventListener('click', () => {
        serviceChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeCat = chip.dataset.category;
        doServiceFilter();
      });
    });
  }

  // 2. Tracking Form
  const trackForm = document.getElementById('trackingForm');
  if (trackForm) {
    trackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bookingId = document.getElementById('trackBookingId').value.trim().toUpperCase();
      const identifier = document.getElementById('trackIdentifier').value.trim();
      const submitBtn = document.getElementById('trackSubmitBtn');
      const resultBox = document.getElementById('trackingResult');

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Verifying Record...';

      try {
        const res = await api(`/api/track/${bookingId}?identifier=${encodeURIComponent(identifier)}`);
        resultBox.innerHTML = renderTrackingResult(res.data);
        toast(`Live record found for ${res.data.vehicle}`);
      } catch (err) {
        resultBox.innerHTML = `
          <div style="padding:48px 32px;text-align:center">
            <div style="font-size:42px;color:var(--red);margin-bottom:12px">✕</div>
            <h3 style="color:var(--paper);margin:0 0 8px">Unable to Locate Booking</h3>
            <p style="font-size:13.5px;color:var(--red-soft);max-width:380px;margin:auto;line-height:1.6">
              ${esc(err.message)}
            </p>
            <div style="margin-top:20px;display:flex;justify-content:center;gap:12px">
              <button class="secondary-btn" onclick="document.getElementById('trackBookingId').focus()">Try Again</button>
              <button class="primary-btn" data-route="contact">Contact Support</button>
            </div>
          </div>
        `;
        toast(err.message, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Fetch Live Service Status <span>↗</span>';
      }
    });
  }

  // 3. Contact Form
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('contactSubmitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Sending...';

      try {
        const payload = {
          name: document.getElementById('contactName').value.trim(),
          email: document.getElementById('contactEmail').value.trim(),
          topic: document.getElementById('contactTopic').value,
          message: document.getElementById('contactMessage').value.trim()
        };

        const res = await api('/api/contact', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        document.getElementById('contactSuccess').style.display = 'block';
        contactForm.reset();
        toast(res.message || 'Message sent to AutoCare!');
      } catch (err) {
        toast(err.message, true);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Message <span>↗</span>';
      }
    });
  }

  // FAQ Accordion Handlers
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      if (item) {
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!wasOpen) {
          item.classList.add('open');
        }
      }
    });
  });

  // 4. Employee Dashboard Filters
  const empFilter = document.getElementById('empStatusFilter');
  const empSearch = document.getElementById('empJobSearch');
  if (empFilter || empSearch) {
    const doEmpFilter = () => {
      const statusVal = empFilter ? empFilter.value : '';
      const q = empSearch ? empSearch.value.toLowerCase().trim() : '';
      const rows = document.querySelectorAll('#empJobsTableBody tr');

      rows.forEach(tr => {
        const text = tr.textContent.toLowerCase();
        const matchesQ = !q || text.includes(q);
        const matchesStatus = !statusVal || text.includes(statusVal.toLowerCase().replace(/_/g, ' '));
        tr.style.display = (matchesQ && matchesStatus) ? '' : 'none';
      });
    };

    empFilter?.addEventListener('change', doEmpFilter);
    empSearch?.addEventListener('input', doEmpFilter);
  }

  // 5. Admin Staff Reassignment Dropdown
  document.querySelectorAll('[data-assign-booking]').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const bookingId = sel.dataset.assignBooking;
      const employeeId = sel.value;
      try {
        await api(`/api/bookings/${bookingId}/assign`, {
          method: 'PATCH',
          body: JSON.stringify({ employeeId })
        });
        toast(`Assigned booking ${bookingId} to staff member.`);
      } catch (err) {
        toast(`Assignment error: ${err.message}`, true);
      }
    });
  });

  // 6. Dashboard Subtab Switchers
  document.querySelectorAll('[data-dash-tab]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const tab = btn.dataset.dashTab;
      document.querySelectorAll('.side-nav button.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const container = document.getElementById('dashTabContainer');
      if (container) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">Loading section...</div>';
        try {
          if (activeRole === 'customer') container.innerHTML = await customerDashboardContent(tab);
          else if (activeRole === 'employee') container.innerHTML = await employeeDashboardContent(tab);
          else container.innerHTML = await adminDashboardContent(tab);
          bindPageInteractions();
        } catch (err) {
          container.innerHTML = `<p class="lead" style="color:var(--red-soft)">Error: ${esc(err.message)}</p>`;
        }
      }
    });
  });
}

// ====================================================
// GLOBAL CLICK & ACTION DELEGATION
// ====================================================

document.addEventListener('click', async (e) => {
  // 1. Route links: [data-route]
  const routeEl = e.target.closest('[data-route]');
  if (routeEl) {
    e.preventDefault();
    const route = routeEl.dataset.route;

    // Handle tracking with prefill query
    if (route === 'track' && routeEl.dataset.trackId) {
      go('track');
      setTimeout(() => {
        const idInput = document.getElementById('trackBookingId');
        const regInput = document.getElementById('trackIdentifier');
        if (idInput && regInput) {
          idInput.value = routeEl.dataset.trackId;
          if (routeEl.dataset.trackReg) regInput.value = routeEl.dataset.trackReg;
          document.getElementById('trackingForm')?.dispatchEvent(new Event('submit'));
        }
      }, 80);
      return;
    }

    go(route);
    return;
  }

  // 2. Action buttons: [data-action]
  const actionEl = e.target.closest('[data-action]');
  if (actionEl) {
    const action = actionEl.dataset.action;

    if (action === 'close-modal') {
      closeModal();
      return;
    }

    if (action === 'login') {
      openModal(loginModal());
      return;
    }

    if (action === 'register') {
      openModal(registerModal());
      return;
    }

    if (action === 'logout') {
      logout();
      return;
    }

    if (action === 'booking') {
      const v = actionEl.dataset.vehicle || '';
      const r = actionEl.dataset.reg || '';
      openModal(await bookingModal('', v, r));
      return;
    }

    if (action === 'book-service') {
      const serviceId = actionEl.dataset.service || '';
      openModal(await bookingModal(serviceId));
      return;
    }

    if (action === 'add-vehicle') {
      openModal(addVehicleModal());
      return;
    }

    if (action === 'update-status') {
      const bookingId = actionEl.dataset.bookingId;
      openModal(await statusUpdateModal(bookingId));
      return;
    }
  }
});

// Modal Background Dismissal & Keyboard ESC
modalRoot.addEventListener('click', (e) => {
  if (e.target === modalRoot) closeModal();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modalRoot.classList.contains('open')) {
    closeModal();
  }
});

// Modal Demo Role Tab Autofill
modalRoot.addEventListener('click', (e) => {
  const roleBtn = e.target.closest('[data-demo-role]');
  if (roleBtn) {
    modalRoot.querySelectorAll('[data-demo-role]').forEach(b => b.classList.remove('active'));
    roleBtn.classList.add('active');

    const role = roleBtn.dataset.demoRole;
    const emailInput = modalRoot.querySelector('#loginEmail');
    const passInput = modalRoot.querySelector('#loginPassword');

    const demoCredentials = {
      customer: 'rhea@example.com',
      employee: 'arjun@autocare.example',
      admin: 'admin@autocare.example'
    };

    if (emailInput && demoCredentials[role]) {
      emailInput.value = demoCredentials[role];
      if (passInput) passInput.value = 'DemoPass123!';
    }
  }
});

// Modal Form Submissions
modalRoot.addEventListener('submit', async (e) => {
  // 1. Login Form Submit
  if (e.target.id === 'loginForm') {
    e.preventDefault();
    const submitBtn = modalRoot.querySelector('#loginSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Authenticating...';

    const email = modalRoot.querySelector('#loginEmail').value.trim();
    const password = modalRoot.querySelector('#loginPassword').value;

    try {
      const res = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      authToken = res.token;
      currentUser = res.user;
      activeRole = res.user.role.toLowerCase();

      localStorage.setItem('autocare_token', authToken);
      localStorage.setItem('autocare_role', activeRole);

      closeModal();
      toast(`Signed in as ${res.user.name} (${res.user.role})`);
      updateHeader();
      go(`dashboard-${activeRole}`);
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Secure Sign In <span>↗</span>';
    }
  }

  // 2. Register Form Submit
  if (e.target.id === 'registerForm') {
    e.preventDefault();
    const submitBtn = modalRoot.querySelector('#registerSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Creating Account...';

    const name = modalRoot.querySelector('#regName').value.trim();
    const mobile = modalRoot.querySelector('#regMobile').value.trim();
    const email = modalRoot.querySelector('#regEmail').value.trim();
    const password = modalRoot.querySelector('#regPassword').value;

    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, mobile, email, password })
      });

      authToken = res.token;
      currentUser = res.user;
      activeRole = 'customer';

      localStorage.setItem('autocare_token', authToken);
      localStorage.setItem('autocare_role', activeRole);

      closeModal();
      toast(`Welcome to AutoCare, ${res.user.name}!`);
      updateHeader();
      go('dashboard-customer');
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create &amp; Sign In <span>↗</span>';
    }
  }

  // 3. Booking Form Submit
  if (e.target.id === 'bookingModalForm') {
    e.preventDefault();
    const submitBtn = modalRoot.querySelector('#bookSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Reserving Bay...';

    const vehicle = modalRoot.querySelector('#modalBookVehicle').value.trim();
    const registration = modalRoot.querySelector('#modalBookReg').value.trim().toUpperCase();
    const serviceId = modalRoot.querySelector('#modalBookService').value;
    const appointmentAt = modalRoot.querySelector('#modalBookDate').value;
    const slot = modalRoot.querySelector('#modalBookSlot').value;
    const pickupDrop = modalRoot.querySelector('#modalBookPickup').value === 'true';
    const paymentPreference = modalRoot.querySelector('#modalBookPayment').value;
    const notes = modalRoot.querySelector('#modalBookNotes').value.trim();

    try {
      const res = await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          vehicle,
          registration,
          serviceId,
          appointmentAt,
          slot,
          pickupDrop,
          paymentPreference,
          notes
        })
      });

      closeModal();
      toast(`Appointment created! Tracking ID: ${res.booking.id}`);

      // If user is logged in as customer, go to customer dashboard
      if (currentUser && currentUser.role === 'CUSTOMER') {
        go('dashboard-customer');
      } else {
        // Go to tracking page and pre-fill tracking ID
        go('track');
        setTimeout(() => {
          const idInput = document.getElementById('trackBookingId');
          const regInput = document.getElementById('trackIdentifier');
          if (idInput && regInput) {
            idInput.value = res.booking.id;
            regInput.value = res.booking.registration;
            document.getElementById('trackingForm')?.dispatchEvent(new Event('submit'));
          }
        }, 100);
      }
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Confirm Appointment &amp; Reserve Bay <span>↗</span>';
    }
  }

  // 4. Status Update Form Submit
  if (e.target.id === 'statusUpdateForm') {
    e.preventDefault();
    const submitBtn = modalRoot.querySelector('#statusSubmitBtn');
    const bookingId = e.target.dataset.bookingId;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Publishing Milestone...';

    const status = modalRoot.querySelector('#updateNewStatus').value;
    const statusLabel = modalRoot.querySelector('#updateNewStatus').selectedOptions[0].text.split('(')[0].trim();
    const notes = modalRoot.querySelector('#updateNotes').value.trim();

    try {
      await api(`/api/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, statusLabel, notes })
      });

      closeModal();
      toast(`Booking ${bookingId} status updated to ${statusLabel}!`);
      render(); // Refresh current dashboard view
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Publish Update Live <span>↗</span>';
    }
  }

  // 5. Add Vehicle Form Submit
  if (e.target.id === 'addVehicleForm') {
    e.preventDefault();
    const submitBtn = modalRoot.querySelector('#addVehSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Saving...';

    const brand = modalRoot.querySelector('#newVehBrand').value;
    const model = modalRoot.querySelector('#newVehModel').value.trim();
    const registration = modalRoot.querySelector('#newVehReg').value.trim().toUpperCase();
    const year = Number(modalRoot.querySelector('#newVehYear').value) || 2023;
    const fuel = modalRoot.querySelector('#newVehFuel').value;
    const color = modalRoot.querySelector('#newVehColor').value.trim() || 'Standard';

    try {
      await api('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify({ brand, model, registration, year, fuel, color })
      });

      closeModal();
      toast(`Vehicle ${brand} ${model} added to your garage!`);
      render();
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Save Vehicle to Garage <span>↗</span>';
    }
  }
});

// Mobile Hamburger Menu Toggle
menuButton.addEventListener('click', () => {
  const isOpen = siteHeader.classList.toggle('mobile-open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

// Scroll & Hashchange Listeners
window.addEventListener('hashchange', render);
window.addEventListener('scroll', () => {
  siteHeader.classList.toggle('stuck', window.scrollY > 15);
});

// Initial Bootstrap on Page Load
async function bootstrap() {
  if (localStorage.getItem('autocare-theme') === 'light') {
    document.body.classList.add('light');
  }

  renderFooter();

  // Load initial services data from server in parallel
  try {
    const [servicesRes] = await Promise.all([
      api('/api/services'),
      restoreSession()
    ]);
    cachedServices = servicesRes.data || [];
  } catch (err) {
    console.warn('Initial server fetch error (will use fallbacks if offline):', err);
  }

  await render();
}

bootstrap();
