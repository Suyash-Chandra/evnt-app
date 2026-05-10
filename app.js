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
    grid.innerHTML = events.map(e => this.createEventCard(e)).join('');
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
    const img = event.image_url
      ? `<div class="event-card-image" style="background-image:url('${event.image_url}')"></div>`
      : `<div class="event-card-image" style="background:linear-gradient(${grad})"></div>`;
    const price = event.price > 0 ? `<span class="price">$${parseFloat(event.price).toFixed(2)}</span>` : '<span class="price free">Free</span>';
    const spots = event.capacity ? `<span class="spots-left">${Math.max(0, event.capacity - event.attendee_count)} spots left</span>` : '';
    return `<div class="event-card" onclick="app.showEventDetail(${event.id})">
      ${img}
      <div class="event-card-category" style="background:${color}">${cat?.name || event.category || 'event'}</div>
      ${event.is_featured ? `<div class="featured-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:3px"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Featured</div>` : ''}
      <div class="event-card-content">
        <h3 class="event-card-title">${event.title}</h3>
        <p class="event-card-date"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${this.formatDate(event.date_start)}</p>
        <p class="event-card-location"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${event.location || 'Online'}</p>
        <div class="event-card-meta"><span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>${event.attendee_count} attending</span>${spots}</div>
        <div class="event-card-actions">${price}<button class="btn btn-primary btn-sm">View Details</button></div>
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
    body.innerHTML = `<div class="event-detail-modal-inner">
      <div class="event-detail-img" ${img}><span class="event-detail-cat" style="background:${color}">${cat?.name || event.category}</span></div>
      <div class="event-detail-content">
        <h2>${event.title}</h2>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${this.formatDate(event.date_start)} · ${this.formatTime(event.date_start)}–${this.formatTime(event.date_end)}</div>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${event.location || 'Online'}${event.address ? ' · '+event.address : ''}</div>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>Hosted by ${event.organizer_name}</div>
        <div class="detail-meta-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:6px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>${event.attendee_count} attending${event.capacity ? ' · '+Math.max(0,event.capacity-event.attendee_count)+' spots left' : ''}</div>
        ${event.description ? `<div class="detail-desc"><h4>About</h4><p>${event.description}</p></div>` : ''}
        <div class="detail-actions">
          <span class="detail-price">${event.price > 0 ? '$'+parseFloat(event.price).toFixed(2) : 'Free'}</span>
          <button id="rsvp-modal-btn" class="btn btn-primary btn-lg" onclick="app.handleRSVP()">
            ${this.isLoggedIn ? 'Register to attend' : 'Sign in to register'}
          </button>
        </div>
      </div>
    </div>`;
  }

  async handleRSVP() {
    if (!this.isLoggedIn) { this.closeModal('event-detail'); return this.openModal('auth'); }
    const event = this.currentEventDetail;
    if (!event) return;

    // If it's a paid event, show payment modal instead of registering directly
    if (parseFloat(event.price) > 0) {
      this.closeModal('event-detail');
      const price = parseFloat(event.price).toFixed(2);
      const nameEl = document.getElementById('payment-event-name');
      const badgeEl = document.getElementById('payment-amount-badge');
      const btnAmtEl = document.getElementById('payment-btn-amount');
      if (nameEl) nameEl.textContent = event.title;
      if (badgeEl) badgeEl.textContent = `$${price}`;
      if (btnAmtEl) btnAmtEl.textContent = `$${price}`;
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
      await this.api(`/api/events/${event.id}/register`, { method: 'POST' });
      this.showToast('You\'re registered!', 'success');
      if (btn) { btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;vertical-align:middle;margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>Registered'; btn.style.background = '#1a7a4a'; }
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
    if (!title || !startDate || !endDate || !category) return this.showToast('Please fill in all required fields', 'error');
    if (btn) { btn.textContent = 'Publishing...'; btn.disabled = true; }
    try {
      const body = {
        title, category,
        description: document.getElementById('ev-desc')?.value,
        type: document.getElementById('ev-type')?.value || 'in-person',
        startDate, endDate,
        location: document.getElementById('ev-venue')?.value,
        address: document.getElementById('ev-address')?.value,
        capacity: parseInt(document.getElementById('ev-capacity')?.value) || null,
        price: parseFloat(document.getElementById('ev-price')?.value) || 0,
        requireApproval: document.getElementById('toggle-approval')?.classList.contains('on'),
        showAttendees: document.getElementById('toggle-attendees')?.classList.contains('on'),
        sendReminders: document.getElementById('toggle-reminders')?.classList.contains('on'),
        enableWaitlist: document.getElementById('toggle-waitlist')?.classList.contains('on')
      };
      const res = await this.api('/api/events', { method: 'POST', body: JSON.stringify(body) });
      this.showToast(`"${title}" published!`, 'success');
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
      this.renderRecentSignups(data.recentSignups);
    } catch (err) { console.error('Dashboard error', err); }
  }

  renderDashboardTable(events) {
    const tbody = document.getElementById('dashboard-events-table');
    if (!tbody) return;
    if (!events?.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:24px">No events yet. <a onclick="showPage(\'create\')" style="cursor:pointer;color:var(--accent)">Create one!</a></td></tr>'; return; }
    tbody.innerHTML = events.map(e => {
      const status = new Date(e.date_start) > new Date() ? 'upcoming' : 'past';
      return `<tr>
        <td><strong>${e.title}</strong></td>
        <td>${this.formatDate(e.date_start)}</td>
        <td>${e.attendee_count || 0}${e.capacity ? '/'+e.capacity : ''}</td>
        <td><span class="status-badge ${status}">${status}</span></td>
        <td>${e.price > 0 ? '$'+parseFloat(e.price).toFixed(2) : 'Free'}</td>
      </tr>`;
    }).join('');
  }

  renderRecentSignups(signups) {
    const el = document.getElementById('recent-signups');
    if (!el) return;
    if (!signups?.length) { el.innerHTML = '<p style="color:var(--text-3);font-size:13px">No signups yet</p>'; return; }
    el.innerHTML = signups.map(s => `<div class="signup-row">
      <div class="signup-avatar">${s.user?.initials || 'U'}</div>
      <div><div style="font-weight:600;font-size:13px">${s.user?.first_name || ''} ${s.user?.last_name || ''}</div>
      <div style="font-size:11px;color:var(--text-3)">${s.event?.title || ''}</div></div>
    </div>`).join('');
  }

  renderMiniChart(events) {
    const el = document.getElementById('mini-chart');
    if (!el) return;
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const vals = days.map(() => Math.floor(Math.random() * 20) + 1);
    const max = Math.max(...vals);
    el.innerHTML = vals.map((v,i) => `<div class="bar-wrap" title="${days[i]}: ${v}"><div class="bar" style="height:${(v/max)*100}%"></div></div>`).join('');
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
        ? upcoming.map(e => this.createEventCard(e)).join('')
        : '<div class="empty-state"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:12px"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg><h3>No upcoming events</h3><p>Register for events to see them here.</p></div>';
      pastGrid.innerHTML = past.length
        ? past.map(e => this.createEventCard(e)).join('')
        : '<div class="empty-state" style="padding:20px 0"><p style="color:var(--text-3)">No past events yet.</p></div>';
    } catch (err) {
      upGrid.innerHTML = '<div class="empty-state"><p style="color:var(--text-3)">Could not load events.</p></div>';
      pastGrid.innerHTML = '';
    }
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
    const si = document.getElementById('ev-start');
    if (si) si.value = now.toISOString().slice(0,16);
    const end = new Date(now.getTime() + 2*60*60*1000);
    const ei = document.getElementById('ev-end');
    if (ei) ei.value = end.toISOString().slice(0,16);
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
    document.getElementById('form-signin').style.display = tab === 'signin' ? 'block' : 'none';
    document.getElementById('form-signup').style.display = tab === 'signup' ? 'block' : 'none';
    document.getElementById('tab-signin').className = `modal-tab${tab==='signin'?' active':''}`;
    document.getElementById('tab-signup').className = `modal-tab${tab==='signup'?' active':''}`;
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
