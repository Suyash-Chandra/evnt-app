class EventBookingApp {
  constructor() {
    this.currentUser = null;
    this.isLoggedIn = false;
    this.currentEventDetail = null;
    this.categories = [];
    this.eventsOffset = 0;
    this.init();
  }

  async init() {
    await this.checkAuthStatus();
    await this.loadCategories();
    this.setupListeners();
    this.loadEvents();
    this.setDefaultDateTime();
    this.initTickets();
    this.initTypewriter();
  }

  initTypewriter() {
    const el = document.getElementById('hero-typewriter');
    if (!el) return;
    const text = "showing up for";
    el.textContent = '';
    el.style.borderRight = '2px solid var(--accent)';
    el.style.paddingRight = '4px';
    let i = 0;
    
    // Wait for the fade-up of the previous text (approx 0.8s) before starting typing
    setTimeout(() => {
      const type = () => {
        if (i < text.length) {
          el.textContent += text.charAt(i);
          i++;
          setTimeout(type, 60 + Math.random() * 40); // random typing speed
        } else {
          // Remove cursor after typing is done
          setTimeout(() => {
            el.style.borderRight = 'none';
          }, 800); // Leave it for a brief moment before hiding
        }
      };
      type();
    }, 800);
  }

  async api(endpoint, opts = {}) {
    try {
      const res = await fetch(endpoint, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    } catch (e) { throw e; }
  }

  async checkAuthStatus() {
    try {
      const data = await this.api('/api/auth/me');
      if (data?.user) this.applyAuth(data.user);
    } catch {}
  }

  applyAuth(user) {
    this.currentUser = user;
    this.isLoggedIn = true;
    const signInBtn = document.querySelector('.btn-ghost[onclick*="auth"]');
    if (signInBtn) signInBtn.style.display = 'none';
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = 'block';
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = user.initials || user.first_name?.[0]?.toUpperCase() || 'U';
    const du = document.getElementById('dropdown-username');
    if (du) du.textContent = `${user.first_name} ${user.last_name || ''}`.trim();
    const dh = document.getElementById('dashboard-header-name');
    if (dh) dh.textContent = `Good evening, ${user.first_name}`;
  }

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('signin-submit-btn');
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    if (!email || !password) return this.showToast('Please fill in all fields', 'error');
    btn.textContent = 'Signing in...'; btn.disabled = true;
    try {
      const data = await this.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      this.applyAuth(data.user);
      this.closeModal('auth');
      this.showToast(`Welcome back, ${data.user.first_name}!`, 'success');
      this.loadEvents();
    } catch (err) {
      this.showToast(err.message || 'Login failed', 'error');
    } finally { btn.textContent = 'Sign in'; btn.disabled = false; }
  }

  async handleSignup(e) {
    e.preventDefault();
    const btn = document.getElementById('signup-submit-btn');
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const firstName = document.getElementById('signup-firstname').value.trim();
    const lastName = document.getElementById('signup-lastname').value.trim();
    if (!email || !password || !firstName) return this.showToast('Please fill in all required fields', 'error');
    if (password.length < 6) return this.showToast('Password must be at least 6 characters', 'error');
    btn.textContent = 'Creating...'; btn.disabled = true;
    try {
      await this.api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, firstName, lastName }) });
      this.showToast('Account created! Please sign in.', 'success');
      this.switchAuthTab('signin');
      document.getElementById('signin-email').value = email;
    } catch (err) {
      this.showToast(err.message || 'Signup failed', 'error');
    } finally { btn.textContent = 'Create account'; btn.disabled = false; }
  }

  async handleLogout() {
    try { await this.api('/api/auth/logout', { method: 'POST' }); } catch {}
    window.location.reload();
  }

  async loadEvents(filters = {}) {
    const grid = document.getElementById('events-grid');
    if (grid && this.eventsOffset === 0) grid.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
    try {
      const params = new URLSearchParams(filters);
      const events = await this.api(`/api/events?${params}&offset=${this.eventsOffset}&limit=9`);
      if (this.eventsOffset === 0) { this.renderEvents(events); } else { this.appendEvents(events); }
      const cnt = document.getElementById('events-count');
      if (cnt) cnt.textContent = `Showing ${(document.querySelectorAll('.event-card') || []).length} events`;
    } catch (err) { console.error(err); }
  }

  renderEvents(events) {
    const grid = document.getElementById('events-grid');
    if (!grid) return;
    if (!events.length) { grid.innerHTML = '<div class="empty-state"><h3>No events found</h3><p>Try adjusting your filters.</p></div>'; return; }
    // Sort: upcoming first, ended last
    const now = new Date();
    const sorted = [...events].sort((a, b) => {
      const aEnded = new Date(a.date_end) < now;
      const bEnded = new Date(b.date_end) < now;
      if (aEnded !== bEnded) return aEnded ? 1 : -1; // ended cards go to end
      return new Date(a.date_start) - new Date(b.date_start); // upcoming sorted by start date asc
    });
    grid.innerHTML = sorted.map(e => this.createEventCard(e)).join('');
  }

  appendEvents(events) {
    const grid = document.getElementById('events-grid');
    if (!grid || !events.length) return;
    grid.insertAdjacentHTML('beforeend', events.map(e => this.createEventCard(e)).join(''));
  }

  createEventCard(event) {
    const cat = this.categories.find(c => c.name === event.category);
    const color = cat?.color || '#6366f1';
    const gradients = ['135deg,#667eea,#764ba2','135deg,#f093fb,#f5576c','135deg,#4facfe,#00f2fe','135deg,#43e97b,#38f9d7','135deg,#fa709a,#fee140','135deg,#a18cd1,#fbc2eb'];
    const grad = gradients[event.id % gradients.length];

    // ── Status flags ───────────────────────────────────────────
    const now = new Date();
    const isPast = new Date(event.date_end) < now;
    const spotsLeft = event.capacity ? Math.max(0, event.capacity - event.attendee_count) : null;
    const isSoldOut = event.capacity && spotsLeft === 0 && !isPast;

    // Status badge sits inside the image div, bottom-right corner
    let statusBadgeHtml = '';
    if (isPast) {
      statusBadgeHtml = `<div class="event-status-badge past">Event Ended</div>`;
    } else if (isSoldOut) {
      statusBadgeHtml = `<div class="event-status-badge soldout">Sold Out</div>`;
    }

    // Featured badge (top-right) — only if not ended
    const featuredBadgeHtml = (!isPast && event.is_featured)
      ? `<div class="featured-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Featured</div>`
      : '';

    // Image block — badge and category are children of the image wrapper
    const imgStyle = event.image_url
      ? `background-image:url('${event.image_url}')`
      : `background:linear-gradient(${grad})`;

    const price = event.price > 0 ? `<span class="price">₹${parseFloat(event.price).toFixed(2)}</span>` : '<span class="price free">Free</span>';
    const spots = (!isPast && spotsLeft !== null && !isSoldOut)
      ? `<span class="spots-left">${spotsLeft} spots left</span>` : '';

    const cardClass = isPast ? 'event-card event-card--past' : 'event-card';

    return `<div class="${cardClass}" onclick="app.showEventDetail(${event.id})">
      <div class="event-card-image" style="${imgStyle}">
        <div class="event-card-category" style="background:${color}">${cat?.name || event.category || 'event'}</div>
        ${featuredBadgeHtml}
        ${statusBadgeHtml}
      </div>
      <div class="event-card-content">
        <h3 class="event-card-title">${event.title}</h3>
        <p class="event-card-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${this.formatDate(event.date_start)}</p>
        <p class="event-card-location"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${event.location || 'Online'}</p>
        <div class="event-card-meta"><span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>${event.attendee_count} attending</span>${spots}</div>
        <div class="event-card-actions">${price}<button class="btn ${isPast || isSoldOut ? 'btn-outline' : 'btn-primary'} btn-sm">${isSoldOut ? 'Sold Out' : 'View Details'}</button></div>
      </div>
    </div>`;
  }

  async showEventDetail(eventId) {
    try {
      const event = await this.api(`/api/events/${eventId}`);
      this.currentEventDetail = event;
      this.renderEventDetail(event);
      this.openModal('event-detail');
    } catch { this.showToast('Event not found', 'error'); }
  }

  renderEventDetail(event) {
    const body = document.querySelector('#modal-event-detail .modal-body');
    if (!body) return;
    const cat = this.categories.find(c => c.name === event.category);
    const color = cat?.color || '#6366f1';
    const gradients = ['135deg,#667eea,#764ba2','135deg,#f093fb,#f5576c','135deg,#4facfe,#00f2fe'];
    const grad = gradients[event.id % gradients.length];
    const img = event.image_url
      ? `style="background-image:url('${event.image_url}')"`
      : `style="background:linear-gradient(${grad})"`;

    // ── Derive state ───────────────────────────────────────────────
    const now = new Date();
    const isPast = new Date(event.date_end) < now;
    const spotsLeft = event.capacity ? Math.max(0, event.capacity - event.attendee_count) : null;
    const isSoldOut = event.capacity && spotsLeft === 0 && !isPast;

    let btnLabel, btnDisabled, btnStyle;
    if (isPast) {
      btnLabel = 'Event Has Ended';
      btnDisabled = true;
      btnStyle = 'background:var(--surface-2);color:var(--text-3);cursor:not-allowed;border:1px solid var(--border);';
    } else if (isSoldOut) {
      btnLabel = 'Sold Out';
      btnDisabled = true;
      btnStyle = 'background:var(--surface-2);color:var(--text-3);cursor:not-allowed;border:1px solid var(--border);';
    } else {
      btnLabel = this.isLoggedIn ? 'Register to attend' : 'Sign in to register';
      btnDisabled = false;
      btnStyle = '';
    }

    const spotsInfo = !isPast && spotsLeft !== null
      ? ` · <span style="color:${spotsLeft <= 5 ? '#ef4444' : 'inherit'}">${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left</span>`
      : '';

    body.innerHTML = `<div class="event-detail-modal-inner">
      <div class="event-detail-img" ${img}><span class="event-detail-cat" style="background:${color}">${cat?.name || event.category}</span>${isPast ? '<span style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.6);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;letter-spacing:.05em;">ENDED</span>' : ''}</div>
      <div class="event-detail-content">
        <h2>${event.title}</h2>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${this.formatDate(event.date_start)} · ${this.formatTime(event.date_start)}–${this.formatTime(event.date_end)}</div>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${event.location || 'Online'}${event.address ? ' · '+event.address : ''}</div>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>Hosted by ${event.organizer_name}</div>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>${event.attendee_count} attending${spotsInfo}</div>
        ${event.description ? `<div class="detail-desc"><h4>About</h4><p>${event.description}</p></div>` : ''}
        <div class="detail-actions">
          <span class="detail-price">${event.price > 0 ? '₹'+parseFloat(event.price).toFixed(2) : 'Free'}</span>
          <button id="rsvp-modal-btn" class="btn btn-primary btn-lg" onclick="app.handleRSVP()" ${btnDisabled ? 'disabled' : ''} style="${btnStyle}">
            ${btnLabel}
          </button>
        </div>
      </div>
    </div>`;
  }

  async handleRSVP() {
    if (!this.isLoggedIn) { this.closeModal('event-detail'); return this.openModal('auth'); }
    const event = this.currentEventDetail;
    if (!event) return;

    // ── Client-side guards (mirrors server checks) ─────────────────
    if (new Date(event.date_end) < new Date())
      return this.showToast('This event has already ended', 'error');
    if (event.capacity && Math.max(0, event.capacity - event.attendee_count) === 0)
      return this.showToast('This event is fully booked', 'error');

    // If it's a paid event, show payment modal instead of registering directly
    if (parseFloat(event.price) > 0) {
      this.closeModal('event-detail');
      const price = parseFloat(event.price).toFixed(2);
      const nameEl = document.getElementById('payment-event-name');
      const badgeEl = document.getElementById('payment-amount-badge');
      const btnAmtEl = document.getElementById('payment-btn-amount');
      if (nameEl) nameEl.textContent = event.title;
      if (badgeEl) badgeEl.textContent = `₹${price}`;
      if (btnAmtEl) btnAmtEl.textContent = `₹${price}`;
      // Reset form
      const form = document.getElementById('payment-form');
      if (form) form.reset();
      document.getElementById('card-preview-name').textContent = 'YOUR NAME';
      document.getElementById('card-preview-number').textContent = '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022';
      document.getElementById('card-preview-expiry').textContent = 'MM/YY';
      this.openModal('payment');
      return;
    }

    // Free event — register directly
    const btn = document.getElementById('rsvp-modal-btn');
    if (btn) { btn.textContent = 'Registering...'; btn.disabled = true; }
    try {
      const res = await this.api(`/api/events/${event.id}/register`, { method: 'POST' });

      if (res.waitlisted) {
        // Added to waitlist
        this.showToast("Event is full — you've been added to the waitlist!", 'info');
        if (btn) { btn.textContent = 'On Waitlist'; btn.style.background = '#f59e0b'; }
      } else if (res.pending) {
        // Requires organizer approval
        this.showToast('Registration submitted! Pending organizer approval.', 'info');
        if (btn) { btn.textContent = 'Awaiting Approval'; btn.style.background = '#6366f1'; }
      } else {
        this.showToast("You're registered!", 'success');
        if (btn) { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>Registered'; btn.style.background = '#1a7a4a'; }
      }
      this.loadEvents();
    } catch (err) {
      this.showToast(err.message || 'Registration failed', 'error');
      if (btn) { btn.textContent = 'Register to attend'; btn.disabled = false; }
    }
  }

  async handlePaymentSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('payment-submit-btn');
    const cardNum = document.getElementById('pay-card')?.value.replace(/\s/g, '');
    const expiry = document.getElementById('pay-expiry')?.value;
    const cvv = document.getElementById('pay-cvv')?.value;
    const name = document.getElementById('pay-name')?.value.trim();

    // Basic validation
    if (!name) return this.showToast('Please enter the cardholder name', 'error');
    if (!cardNum || cardNum.length < 13) return this.showToast('Please enter a valid card number', 'error');
    if (!expiry || expiry.length < 5) return this.showToast('Please enter a valid expiry date', 'error');
    if (!cvv || cvv.length < 3) return this.showToast('Please enter a valid CVV', 'error');

    if (btn) {
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px;animation:spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Processing...';
      btn.disabled = true;
    }

    // Simulate payment processing delay
    await new Promise(r => setTimeout(r, 1800));

    try {
      await this.api(`/api/events/${this.currentEventDetail.id}/register`, { method: 'POST' });
      this.closeModal('payment');
      this.showToast('\uD83C\uDF89 Payment successful! You\'re registered for the event.', 'success');
      this.loadEvents();
      // Refresh profile if open
      if (document.getElementById('page-profile')?.classList.contains('active')) {
        this.loadRegisteredEvents();
      }
    } catch (err) {
      this.showToast(err.message || 'Payment failed. Please try again.', 'error');
    } finally {
      if (btn) {
        const amtEl = document.getElementById('payment-btn-amount');
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Pay ${amtEl?.textContent || ''}`;
        btn.disabled = false;
      }
    }
  }

  formatCardNumber(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) parts.push(v.substring(i, i + 4));
    input.value = parts.join(' ');
    // Update preview
    const preview = document.getElementById('card-preview-number');
    if (preview) {
      const padded = v.padEnd(16, '\u2022');
      preview.textContent = `${padded.substring(0,4)} ${padded.substring(4,8)} ${padded.substring(8,12)} ${padded.substring(12,16)}`;
    }
  }

  formatExpiry(input) {
    let v = input.value.replace(/\D/g, '').substring(0, 4);
    if (v.length > 2) v = v.substring(0, 2) + '/' + v.substring(2);
    input.value = v;
    const preview = document.getElementById('card-preview-expiry');
    if (preview) preview.textContent = v || 'MM/YY';
  }

  async handleCreateEvent(e) {
    e.preventDefault();
    if (!this.isLoggedIn) return this.openModal('auth');
    const btn = e.target.querySelector('[type=submit]');
    const title = document.getElementById('ev-title')?.value?.trim();
    const startDate = document.getElementById('ev-start')?.value;
    const endDate = document.getElementById('ev-end')?.value;
    const category = document.getElementById('ev-category')?.value;
    const capacityRaw = document.getElementById('ev-capacity')?.value;

    // ── Required fields ───────────────────────────────────────
    if (!title || !startDate || !endDate || !category)
      return this.showToast('Please fill in all required fields (title, dates, category)', 'error');

    // ── Date validations ────────────────────────────────────
    const start = new Date(startDate);
    const end   = new Date(endDate);
    const now   = new Date();

    if (start <= now)
      return this.showToast('Start date must be in the future — you cannot create a past event', 'error');
    if (end <= start)
      return this.showToast('End date must be after the start date', 'error');

    // ── Capacity validation ─────────────────────────────────
    const capacity = capacityRaw !== '' && capacityRaw !== undefined && capacityRaw !== null
      ? parseInt(capacityRaw) : null;
    if (capacity !== null && capacity < 1)
      return this.showToast('Capacity must be at least 1 — set it to blank for unlimited', 'error');

    // ── Price validation ──────────────────────────────────────
    const priceRaw = parseFloat(document.getElementById('ev-price')?.value);
    const price = isNaN(priceRaw) ? 0 : priceRaw;
    if (price < 0)
      return this.showToast('Ticket price cannot be negative. Use 0 for a free event.', 'error');

    // ── Read first ticket type name ───────────────────────────
    const firstTicketNameInput = document.querySelector('#ticket-list .ticket-row input[type="text"]');
    const ticketName = firstTicketNameInput?.value?.trim() || null;

    if (btn) { btn.textContent = 'Publishing...'; btn.disabled = true; }
    try {
      const body = {
        title, category,
        description: document.getElementById('ev-desc')?.value,
        type: document.getElementById('ev-type')?.value || 'in-person',
        startDate, endDate,
        location: document.getElementById('ev-venue')?.value,
        address: document.getElementById('ev-address')?.value,
        capacity,
        price,
        ticketName,
        imageUrl: this.currentUploadedImage || null,
        requireApproval: document.getElementById('toggle-approval')?.classList.contains('on'),
        sendReminders: document.getElementById('toggle-reminders')?.classList.contains('on'),
        enableWaitlist: document.getElementById('toggle-waitlist')?.classList.contains('on')
      };
      const res = await this.api('/api/events', { method: 'POST', body: JSON.stringify(body) });
      this.showToast(`"​${title}" published!`, 'success');
      this.currentUploadedImage = null;
      document.getElementById('create-event-form').reset();
      const upload = document.querySelector('.cover-upload');
      if (upload) upload.style.backgroundImage = 'none';
      setTimeout(() => { this.showPage('home'); this.loadEvents(); }, 1000);
    } catch (err) {
      this.showToast(err.message || 'Failed to create event', 'error');
      if (btn) { btn.textContent = 'Publish event'; btn.disabled = false; }
    }
  }

  async saveDraft() {
    this.showToast('Draft saved (coming soon)', 'info');
  }

  async loadDashboard() {
    if (!this.isLoggedIn) { this.showPage('home'); this.openModal('auth'); return; }
    const hdr = document.getElementById('dashboard-header-name');
    const hr = new Date().getHours();
    const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    if (hdr) hdr.textContent = `${greeting}, ${this.currentUser?.first_name || ''}`;
    try {
      const data = await this.api('/api/user/dashboard');
      const s = data.stats;
      const te = document.getElementById('stat-total-events');
      const ta = document.getElementById('stat-total-attendees');
      const up = document.getElementById('stat-upcoming');
      const at = document.getElementById('stat-attending');
      if (te) te.textContent = s.totalEvents;
      if (ta) ta.textContent = s.totalAttendees;
      if (up) up.textContent = s.upcomingEvents;
      if (at) at.textContent = s.attending;
      this.renderDashboardTable(data.myEvents);
    } catch (err) { console.error('Dashboard error', err); }
  }

  renderDashboardTable(events) {
    const tbody = document.getElementById('dashboard-events-table');
    if (!tbody) return;
    if (!events?.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:24px">No events yet. <a onclick="showPage(\'create\')" style="cursor:pointer;color:var(--accent)">Create one!</a></td></tr>'; return; }
    tbody.innerHTML = events.map(e => {
      const status = new Date(e.date_start) > new Date() ? 'upcoming' : 'past';
      return `<tr style="cursor:pointer" onclick="app.showOrganizerEventDetail(${e.id})">
        <td><strong>${e.title}</strong></td>
        <td>${this.formatDate(e.date_start)}</td>
        <td>${e.attendee_count || 0}${e.capacity ? '/'+e.capacity : ''}</td>
        <td><span class="status-badge ${status}">${status}</span></td>
        <td>${e.price > 0 ? '₹'+parseFloat(e.price).toFixed(2) : 'Free'}</td>
        <td>
          <button class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #fca5a5; padding: 4px 8px; font-size: 12px; border-radius: 4px;" onclick="event.stopPropagation(); app.deleteEvent(${e.id})">Delete</button>
        </td>
      </tr>`;
    }).join('');
  }

  async deleteEvent(eventId) {
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await this.api(`/api/events/${eventId}`, { method: 'DELETE' });
      this.showToast('Event deleted successfully', 'success');
      this.loadDashboard();
      this.loadEvents(); // refresh public grid just in case
    } catch (err) {
      this.showToast(err.message || 'Failed to delete event', 'error');
    }
  }

  async showOrganizerEventDetail(eventId) {
    try {
      // Fetch event detail and all attendees
      const [event, allAttendees] = await Promise.all([
        this.api(`/api/events/${eventId}`),
        this.api('/api/user/attendees')
      ]);
      const eventAttendees = allAttendees.filter(a => a.event_id == eventId);
      
      document.getElementById('org-detail-title').textContent = event.title;
      document.getElementById('org-detail-attendees').textContent = eventAttendees.length;
      document.getElementById('org-detail-revenue').textContent = '₹' + (eventAttendees.length * event.price).toFixed(2);
      document.getElementById('org-detail-status').textContent = new Date(event.date_start) > new Date() ? 'Upcoming' : 'Past';
      
      const tbody = document.getElementById('org-detail-participants-body');
      if (eventAttendees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding:16px;text-align:center;color:var(--text-3)">No participants yet.</td></tr>';
      } else {
        tbody.innerHTML = eventAttendees.map(a => `
          <tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 12px 8px;">${a.first_name} ${a.last_name || ''}</td>
            <td style="padding: 12px 8px; color: var(--text-2);">${a.email}</td>
            <td style="padding: 12px 8px; color: var(--text-2);">${new Date(a.registered_at).toLocaleDateString()}</td>
          </tr>
        `).join('');
      }
      this.openModal('organizer-event');
    } catch (err) {
      this.showToast('Failed to load event details', 'error');
    }
  }

  async openExportModal() {
    try {
      const data = await this.api('/api/user/dashboard');
      const select = document.getElementById('export-event-select');
      if (select) {
        select.innerHTML = '<option value="all">All Events</option>';
        data.myEvents.forEach(e => {
          select.innerHTML += `<option value="${e.id}">${e.title}</option>`;
        });
      }
      this.openModal('export');
    } catch (e) {
      this.showToast(e.message, 'error');
    }
  }

  async exportAttendees() {
    try {
      const btn = document.querySelector('#modal-export .btn-primary');
      const originalText = btn.innerHTML;
      btn.innerHTML = 'Generating...';
      const selectedEventId = document.getElementById('export-event-select')?.value || 'all';
      const attendees = await this.api('/api/user/attendees');
      const filteredAttendees = selectedEventId === 'all' ? attendees : attendees.filter(a => a.event_id == selectedEventId);
      if (!filteredAttendees || filteredAttendees.length === 0) throw new Error('No attendees found for selection');

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text('Event Attendees List', 14, 20);
      doc.setFontSize(12);
      doc.text("Generated on " + new Date().toLocaleDateString(), 14, 30);

      const tableData = filteredAttendees.map(a => [
        a.event_title,
        (a.first_name + ' ' + (a.last_name || '')).trim(),
        a.email,
        new Date(a.registered_at).toLocaleDateString(),
        a.payment_status === 'free' ? 'FREE' : 'Payment Successful'
      ]);

      doc.autoTable({
        startY: 40,
        head: [['Event', 'Attendee Name', 'Email', 'Registered Date', 'Payment Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [26, 25, 22] }
      });

      doc.save("attendees_" + selectedEventId + "_" + new Date().getTime() + ".pdf");
      this.closeModal('export');
      btn.innerHTML = originalText;
      this.showToast('PDF Exported Successfully!', 'success');
    } catch (e) {
      this.showToast(e.message, 'error');
      const btn = document.querySelector('#modal-export .btn-primary');
      if (btn) btn.innerHTML = 'Download PDF';
    }
  }
  async loadProfile() {
    if (!this.isLoggedIn) return;
    try {
      const data = await this.api('/api/user/profile');
      const nd = document.getElementById('profile-name-display');
      if (nd) nd.textContent = `${data.first_name} ${data.last_name || ''}`.trim();
      const ph = document.getElementById('profile-handle');
      if (ph) ph.textContent = `@${data.email?.split('@')[0]} · Member since ${new Date(data.created_at).toLocaleDateString('en-US',{month:'short',year:'numeric'})}`;
      const bio = document.getElementById('profile-bio');
      if (bio) bio.textContent = data.bio || '';
      const av = document.getElementById('profile-avatar-display');
      if (av) av.textContent = data.initials || data.first_name?.[0]?.toUpperCase() || 'U';
      // Real stats from API
      const hostedEl = document.getElementById('profile-stat-hosted');
      const attendEl = document.getElementById('profile-stat-attended');
      if (hostedEl) hostedEl.textContent = data.hosted_count ?? 0;
      if (attendEl) attendEl.textContent = data.attending_count ?? 0;
    } catch {}
    // Load registered events by default (first tab)
    this.loadRegisteredEvents();
  }

  async loadRegisteredEvents() {
    const upGrid = document.getElementById('profile-upcoming-grid');
    const pastGrid = document.getElementById('profile-past-grid');
    if (!upGrid || !pastGrid) return;
    upGrid.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';
    pastGrid.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';
    try {
      const data = await this.api('/api/user/registered-events');
      const upcoming = data.upcoming || [];
      const past = data.past || [];
      upGrid.innerHTML = upcoming.length
        ? upcoming.map(e => this.createTicketCard(e, false)).join('')
        : '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:12px"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><h3>No upcoming events</h3><p>Register for events to see them here.</p></div>';
      pastGrid.innerHTML = past.length
        ? past.map(e => this.createTicketCard(e, true)).join('')
        : '<div class="empty-state" style="padding:20px 0"><p style="color:var(--text-3)">No past events yet.</p></div>';
    } catch (err) {
      upGrid.innerHTML = '<div class="empty-state"><p style="color:var(--text-3)">Could not load events.</p></div>';
      pastGrid.innerHTML = '';
    }
  }

  // ── Compact ticket card shown in profile grids ──────────────────────────
  createTicketCard(event, isPast) {
    const cat = this.categories.find(c => c.name === event.category);
    const color = cat?.color || '#6366f1';
    const gradients = ['135deg,#667eea,#764ba2','135deg,#f093fb,#f5576c','135deg,#4facfe,#00f2fe','135deg,#43e97b,#38f9d7','135deg,#fa709a,#fee140','135deg,#a18cd1,#fbc2eb'];
    const grad = gradients[event.id % gradients.length];
    const imgStyle = event.image_url
      ? `background-image:url('${event.image_url}');background-size:cover;background-position:center`
      : `background:linear-gradient(${grad})`;
    const payBadge = event.payment_status === 'paid'
      ? `<span class="ticket-card-badge paid">Paid</span>`
      : `<span class="ticket-card-badge free">Free</span>`;
    const dateStr = this.formatDate(event.date_start);
    const timeStr = this.formatTime(event.date_start);
    // Store event in registry so onclick can retrieve it safely by ID
    if (!this._ticketRegistry) this._ticketRegistry = {};
    this._ticketRegistry[event.id + '_' + (event.registration_id || 0)] = event;
    const regKey = event.id + '_' + (event.registration_id || 0);

    return `<div class="ticket-card-item${isPast ? ' ticket-card-item--past' : ''}" onclick="app.showTicketById('${regKey}')">
      <div class="ticket-card-banner" style="${imgStyle}">
        <span class="ticket-card-cat" style="background:${color}">${cat?.name || event.category || 'event'}</span>
        ${isPast ? '<span class="ticket-card-ended">Ended</span>' : ''}
        <div class="ticket-card-perforation"></div>
      </div>
      <div class="ticket-card-body">
        <div class="ticket-card-title">${event.title.replace(/</g,'&lt;')}</div>
        <div class="ticket-card-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          ${dateStr} &nbsp;&middot;&nbsp;
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${timeStr}
        </div>
        <div class="ticket-card-meta">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          ${(event.location || 'Online').replace(/</g,'&lt;')}
        </div>
        <div class="ticket-card-footer">
          ${payBadge}
          <span style="font-size:11px;color:var(--text-3)">Click to view pass</span>
        </div>
      </div>
    </div>`;
  }

  showTicketById(key) {
    const event = this._ticketRegistry && this._ticketRegistry[key];
    if (!event) { this.showToast('Could not load ticket', 'error'); return; }
    this.showTicket(event);
  }

  // ── Full ticket / boarding-pass modal ────────────────────────────────
  showTicket(event) {
    this._currentTicketEvent = event;
    const cat = this.categories.find(c => c.name === event.category);
    const color = cat?.color || '#6366f1';
    const gradients = ['135deg,#667eea,#764ba2','135deg,#f093fb,#f5576c','135deg,#4facfe,#00f2fe','135deg,#43e97b,#38f9d7','135deg,#fa709a,#fee140','135deg,#a18cd1,#fbc2eb'];
    const grad = gradients[event.id % gradients.length];
    const imgStyle = event.image_url
      ? `background-image:url('${event.image_url}');background-size:cover;background-position:center`
      : `background:linear-gradient(${grad})`;
    const isPast = new Date(event.date_end) < new Date();
    const ticketNum = `EVT-${String(event.registration_id || event.id).padStart(6,'0')}`;
    const registeredOn = event.registered_at
      ? new Date(event.registered_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
      : 'N/A';
    const payLabel = event.payment_status === 'free' ? 'Free Entry' : 'Paid';
    const payColor = event.payment_status === 'free' ? 'var(--text-2)' : 'var(--green)';

    const content = document.getElementById('ticket-content');
    if (!content) return;

    content.innerHTML = `
    <div class="ticket-pass" id="ticket-pass-printable">
      <!-- Header banner -->
      <div class="ticket-pass-banner" style="${imgStyle}">
        <div class="ticket-pass-banner-overlay">
          <span class="ticket-pass-cat" style="background:${color}">${cat?.name || event.category || 'Event'}</span>
          ${isPast ? '<span class="ticket-pass-ended">ENDED</span>' : '<span class="ticket-pass-live">CONFIRMED</span>'}
        </div>
        <div class="ticket-pass-title-block">
          <div class="ticket-pass-ticket-type">${event.ticket_name || (event.payment_status === 'free' ? 'Free Entry' : 'General Admission')}</div>
          <h2 class="ticket-pass-event-title">${event.title}</h2>
          <div class="ticket-pass-org">Hosted by ${event.organizer_name}</div>
        </div>
      </div>

      <!-- Perforation tear line -->
      <div class="ticket-tear">
        <div class="ticket-tear-circle left"></div>
        <div class="ticket-tear-line"></div>
        <div class="ticket-tear-circle right"></div>
      </div>

      <!-- Ticket body -->
      <div class="ticket-pass-body">
        <div class="ticket-pass-grid">
          <div class="ticket-pass-field">
            <div class="ticket-pass-label">Date</div>
            <div class="ticket-pass-value">${this.formatDate(event.date_start)}</div>
          </div>
          <div class="ticket-pass-field">
            <div class="ticket-pass-label">Time</div>
            <div class="ticket-pass-value">${this.formatTime(event.date_start)} – ${this.formatTime(event.date_end)}</div>
          </div>
          <div class="ticket-pass-field">
            <div class="ticket-pass-label">Venue</div>
            <div class="ticket-pass-value">${event.location || 'Online'}${event.address ? '<br><span style="font-size:11px;color:var(--text-3)">' + event.address + '</span>' : ''}</div>
          </div>
          <div class="ticket-pass-field">
            <div class="ticket-pass-label">Attendee</div>
            <div class="ticket-pass-value">${event.attendee_name || this.currentUser?.first_name || 'You'}</div>
          </div>
          <div class="ticket-pass-field">
            <div class="ticket-pass-label">Registered On</div>
            <div class="ticket-pass-value">${registeredOn}</div>
          </div>
          <div class="ticket-pass-field">
            <div class="ticket-pass-label">Entry</div>
            <div class="ticket-pass-value" style="color:${payColor};font-weight:700">${payLabel}</div>
          </div>
        </div>

        <!-- Ticket number + barcode strip -->
        <div class="ticket-pass-barcode-section">
          <div class="ticket-pass-barcode">
            ${Array.from({length:28}, (_,i) =>
              `<div class="barcode-bar" style="height:${28 + (i*7+event.id*3+13)%26}px;width:${i%3===0?3:2}px"></div>`
            ).join('')}
          </div>
          <div class="ticket-pass-number">${ticketNum}</div>
        </div>
      </div>
    </div>`;

    this.openModal('ticket');
  }

  downloadTicket() {
    this.showToast('Tip: Use your browser\'s Print → Save as PDF to save this ticket.', 'info');
    window.print();
  }

  async loadHostedEvents() {
    const grid = document.getElementById('profile-hosted-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-grid"><div class="skeleton"></div><div class="skeleton"></div></div>';
    try {
      const data = await this.api('/api/user/dashboard');
      const events = data.myEvents || [];
      grid.innerHTML = events.length
        ? events.map(e => this.createEventCard(e)).join('')
        : '<div class="empty-state"><h3>No events hosted yet</h3><p>Create your first event!</p></div>';
    } catch { grid.innerHTML = '<div class="empty-state"><p>Could not load events.</p></div>'; }
  }

  switchProfileTab(btn, tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    // Hide all tab panels
    ['registered', 'hosted'].forEach(id => {
      const el = document.getElementById(`profile-tab-${id}`);
      if (el) el.style.display = 'none';
    });
    const active = document.getElementById(`profile-tab-${tab}`);
    if (active) active.style.display = 'block';
    if (tab === 'registered') this.loadRegisteredEvents();
    else if (tab === 'hosted') this.loadHostedEvents();
  }

  async loadCategories() {
    try {
      this.categories = await this.api('/api/categories');
      this.populateCategoryFilters();
    } catch {}
  }

  populateCategoryFilters() {
    const f = document.getElementById('category-filter');
    if (f) f.innerHTML = '<option value="">All Categories</option>' + this.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const s = document.getElementById('ev-category');
    if (s) s.innerHTML = '<option value="">Select category</option>' + this.categories.map(c => `<option value="${c.name}">${c.name[0].toUpperCase()+c.name.slice(1)}</option>`).join('');
  }

  setDefaultDateTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const nowStr = now.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"

    const si = document.getElementById('ev-start');
    if (si) {
      si.min   = nowStr;              // browser blocks past-date selection
      si.value = nowStr;
      // update end-date min whenever start changes
      si.addEventListener('change', () => {
        const ei = document.getElementById('ev-end');
        if (ei) {
          ei.min = si.value;          // end can't be before start
          if (ei.value && ei.value <= si.value) {
            const newEnd = new Date(si.value);
            newEnd.setHours(newEnd.getHours() + 2);
            newEnd.setMinutes(newEnd.getMinutes() - newEnd.getTimezoneOffset());
            ei.value = newEnd.toISOString().slice(0, 16);
          }
        }
      }, { once: false });
    }

    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const ei = document.getElementById('ev-end');
    if (ei) {
      ei.min   = nowStr;              // end also can't be in the past
      ei.value = end.toISOString().slice(0, 16);
    }
  }

  initTickets() {
    const list = document.getElementById('ticket-list');
    if (list && list.children.length === 0) this.addTicket();
  }

  addTicket() {
    const list = document.getElementById('ticket-list');
    if (!list) return;
    const id = Date.now();
    list.insertAdjacentHTML('beforeend', `<div class="ticket-row" id="tk-${id}">
      <input type="text" class="form-input" placeholder="Ticket name (e.g. General)" style="flex:2"/>
      <input type="number" class="form-input" placeholder="Price (0=Free)" min="0" step="0.01" style="flex:1"/>
      <input type="number" class="form-input" placeholder="Qty" min="1" style="flex:1"/>
      <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('tk-${id}').remove()" title="Remove" style="padding:4px 8px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`);
  }

  toggleSetting(btn) { btn.classList.toggle('on'); }

  handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      this.currentUploadedImage = e.target.result;
      const upload = document.querySelector('.cover-upload');
      if (upload) upload.style.backgroundImage = `url(${e.target.result})`;
    };
    reader.readAsDataURL(file);
  }

  loadMoreEvents() {
    this.eventsOffset += 9;
    const cat = document.getElementById('category-filter')?.value;
    const type = document.getElementById('type-filter')?.value;
    const search = document.getElementById('search-input')?.value;
    const filters = {};
    if (cat) filters.category = cat;
    if (type) filters.type = type;
    if (search) filters.search = search;
    this.loadEvents(filters);
  }

  handleShare() {
    if (navigator.share && this.currentEventDetail) {
      navigator.share({ title: this.currentEventDetail.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.showToast('Link copied!', 'success');
    }
  }

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pg = document.getElementById(`page-${pageId}`);
    if (pg) pg.classList.add('active');
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    const nl = document.getElementById(`nav-${pageId}`);
    if (nl) nl.classList.add('active');
    window.scrollTo(0,0);
    if (pageId === 'dashboard') this.loadDashboard();
    else if (pageId === 'home') { this.eventsOffset = 0; this.loadEvents(); }
    else if (pageId === 'profile') this.loadProfile();
  }

  openModal(id) {
    const m = document.getElementById(`modal-${id}`);
    if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }

  closeModal(id) {
    const m = document.getElementById(`modal-${id}`);
    if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
  }

  switchAuthTab(tab) {
    // Hide all auth panels
    ['form-signin','form-signup','form-forgot','form-reset'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    // Hide the forgot-result box and reset the forgot form
    const fr = document.getElementById('forgot-result');
    if (fr) fr.style.display = 'none';
    // Show tabs only for signin/signup
    document.getElementById('tab-signin').className = `modal-tab${tab==='signin'?' active':''}`;
    document.getElementById('tab-signup').className = `modal-tab${tab==='signup'?' active':''}`;
    const target = document.getElementById(`form-${tab}`);
    if (target) target.style.display = 'block';
  }

  showForgotPassword() {
    ['form-signin','form-signup','form-forgot','form-reset'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.getElementById('tab-signin').className = 'modal-tab';
    document.getElementById('tab-signup').className = 'modal-tab';
    const forgot = document.getElementById('form-forgot');
    if (forgot) forgot.style.display = 'block';
    // Reset the form state
    const result = document.getElementById('forgot-result');
    if (result) result.style.display = 'none';
    document.getElementById('forgot-email').value = '';
  }

  async handleForgotPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('forgot-submit-btn');
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) return this.showToast('Please enter your email', 'error');
    btn.textContent = 'Sending...'; btn.disabled = true;
    try {
      const data = await this.api('/api/auth/forgot-password', {
        method: 'POST', body: JSON.stringify({ email })
      });
      // Store the token for use in the reset step
      this._resetToken = data.token || null;
      // Show the result box
      const result = document.getElementById('forgot-result');
      if (result) result.style.display = 'block';
      if (!data.token) {
        // Email not found — show generic message without revealing that
        result.innerHTML = `<p style="font-size:13px;color:var(--text-2);">${data.message}</p>`;
      }
    } catch (err) {
      this.showToast(err.message || 'Something went wrong', 'error');
    } finally {
      btn.textContent = 'Send reset link'; btn.disabled = false;
    }
  }

  showResetPassword() {
    ['form-signin','form-signup','form-forgot','form-reset'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.getElementById('tab-signin').className = 'modal-tab';
    document.getElementById('tab-signup').className = 'modal-tab';
    const reset = document.getElementById('form-reset');
    if (reset) reset.style.display = 'block';
    document.getElementById('reset-password').value = '';
    document.getElementById('reset-password-confirm').value = '';
  }

  async handleResetPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('reset-submit-btn');
    const newPassword = document.getElementById('reset-password').value;
    const confirm = document.getElementById('reset-password-confirm').value;
    if (newPassword.length < 6) return this.showToast('Password must be at least 6 characters', 'error');
    if (newPassword !== confirm) return this.showToast('Passwords do not match', 'error');
    if (!this._resetToken) return this.showToast('No reset token found. Please start again.', 'error');
    btn.textContent = 'Updating...'; btn.disabled = true;
    try {
      const data = await this.api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: this._resetToken, newPassword })
      });
      this._resetToken = null;
      this.showToast('Password updated! Please sign in.', 'success');
      this.switchAuthTab('signin');
      // Pre-fill the email field if we have it
      const emailEl = document.getElementById('signin-email');
      if (emailEl && document.getElementById('forgot-email').value)
        emailEl.value = document.getElementById('forgot-email').value;
    } catch (err) {
      this.showToast(err.message || 'Failed to reset password', 'error');
    } finally {
      btn.textContent = 'Update password'; btn.disabled = false;
    }
  }

  toggleDropdown() {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.toggle('open');
  }

  closeDropdown() {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.classList.remove('open');
  }

  showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const iconSvg = type === 'success'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : type === 'error'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    t.innerHTML = `<span style="display:inline-flex;align-items:center;margin-right:6px">${iconSvg}</span>${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; setTimeout(() => t.remove(), 400); }, 3500);
  }

  formatDate(d) {
    return new Date(d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  }
  formatTime(d) {
    return new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
  }

  setupListeners() {
    document.getElementById('create-event-form')?.addEventListener('submit', e => this.handleCreateEvent(e));
    const si = document.getElementById('search-input');
    if (si) {
      let t;
      si.addEventListener('input', e => {
        clearTimeout(t);
        t = setTimeout(() => { this.eventsOffset = 0; this.loadEvents(e.target.value ? { search: e.target.value } : {}); }, 300);
      });
    }
    document.getElementById('category-filter')?.addEventListener('change', e => { this.eventsOffset = 0; this.loadEvents(e.target.value ? { category: e.target.value } : {}); });
    document.getElementById('type-filter')?.addEventListener('change', e => { this.eventsOffset = 0; this.loadEvents(e.target.value ? { type: e.target.value } : {}); });
    document.getElementById('ev-type')?.addEventListener('change', e => {
      const g = document.getElementById('online-link-group');
      if (g) g.style.display = ['online','hybrid'].includes(e.target.value) ? 'block' : 'none';
    });
    document.addEventListener('click', e => {
      if (e.target.classList.contains('modal-overlay')) {
        const id = e.target.id.replace('modal-','');
        this.closeModal(id);
      }
      if (!e.target.closest('#user-dropdown')) this.closeDropdown();
    });
  }
}

const app = new EventBookingApp();
window.showPage = id => app.showPage(id);
window.openModal = id => app.openModal(id);
window.closeModal = id => app.closeModal(id);
window.switchAuthTab = t => app.switchAuthTab(t);
window.handleLogout = () => app.handleLogout();
window.handleRSVP = () => app.handleRSVP();
window.handlePaymentSubmit = e => app.handlePaymentSubmit(e);
window.handleShare = () => app.handleShare();
window.loadMoreEvents = () => app.loadMoreEvents();
window.addTicket = () => app.addTicket();
window.toggleSetting = btn => app.toggleSetting(btn);
window.toggleDropdown = () => app.toggleDropdown();
window.closeDropdown = () => app.closeDropdown();
window.handleImageUpload = el => app.handleImageUpload(el);
window.switchProfileTab = (btn, tab) => app.switchProfileTab(btn, tab);
window.saveDraft = () => app.saveDraft();
window.formatCardNumber = el => app.formatCardNumber(el);
window.formatExpiry = el => app.formatExpiry(el);
window.showForgotPassword = () => app.showForgotPassword();
window.showResetPassword = () => app.showResetPassword();
window.showTicketById = (key) => app.showTicketById(key);






