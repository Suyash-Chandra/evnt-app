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
    if (dh) dh.textContent = `Good evening, ${user.first_name} ??`;
  }

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('signin-submit-btn');
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    if (!email || !password) return this.showToast('Please fill in all fields', 'error');
    btn.textContent = 'Signing in…'; btn.disabled = true;
    try {
      const data = await this.api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      this.applyAuth(data.user);
      this.closeModal('auth');
      this.showToast(`Welcome back, ${data.user.first_name}! ??`, 'success');
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
    btn.textContent = 'Creating…'; btn.disabled = true;
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
      ${event.is_featured ? '<div class="featured-badge">? Featured</div>' : ''}
      <div class="event-card-content">
        <h3 class="event-card-title">${event.title}</h3>
        <p class="event-card-date">?? ${this.formatDate(event.date_start)}</p>
        <p class="event-card-location">?? ${event.location || 'Online'}</p>
        <div class="event-card-meta"><span>?? ${event.attendee_count} attending</span>${spots}</div>
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
        <div class="detail-meta-row">?? ${this.formatDate(event.date_start)} · ${this.formatTime(event.date_start)}–${this.formatTime(event.date_end)}</div>
        <div class="detail-meta-row">?? ${event.location || 'Online'}${event.address ? ' · '+event.address : ''}</div>
        <div class="detail-meta-row">?? Hosted by ${event.organizer_name}</div>
        <div class="detail-meta-row">?? ${event.attendee_count} attending${event.capacity ? ' · '+Math.max(0,event.capacity-event.attendee_count)+' spots left' : ''}</div>
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
    const btn = document.getElementById('rsvp-modal-btn');
    if (btn) { btn.textContent = 'Registering…'; btn.disabled = true; }
    try {
      await this.api(`/api/events/${this.currentEventDetail.id}/register`, { method: 'POST' });
      this.showToast('Registered successfully! ??', 'success');
      if (btn) { btn.textContent = '? Registered'; btn.style.background = '#1a7a4a'; }
      this.loadEvents();
    } catch (err) {
      this.showToast(err.message || 'Registration failed', 'error');
      if (btn) { btn.textContent = 'Register to attend'; btn.disabled = false; }
    }
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
    if (btn) { btn.textContent = 'Publishing…'; btn.disabled = true; }
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
      this.showToast(`"${title}" published! ??`, 'success');
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
    if (hdr) hdr.textContent = `${greeting}, ${this.currentUser?.first_name || ''} ??`;
    try {
      const data = await this.api('/api/user/dashboard');
      const s = data.stats;
      const vals = document.querySelectorAll('.stat-card-value');
      if (vals[0]) vals[0].textContent = s.totalEvents;
      if (vals[1]) vals[1].textContent = s.totalAttendees;
      if (vals[2]) vals[2].textContent = s.upcomingEvents;
      if (vals[3]) vals[3].textContent = s.attending;
      this.renderDashboardTable(data.myEvents);
      this.renderRecentSignups(data.recentSignups);
      this.renderMiniChart(data.myEvents);
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
      <div class="signup-avatar">${s.user?.initials || '?'}</div>
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
      if (bio) bio.textContent = data.bio || 'No bio yet.';
      const av = document.getElementById('profile-avatar-display');
      if (av) av.textContent = data.initials || data.first_name?.[0]?.toUpperCase() || 'U';
      const stats = document.querySelectorAll('.profile-stat strong');
      if (stats[0]) stats[0].textContent = data.hosted_count || 0;
      if (stats[1]) stats[1].textContent = data.attending_count || 0;
    } catch {}
  }

  switchProfileTab(btn, tab) {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
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
      <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('tk-${id}').remove()">?</button>
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
    const m = document.querySelector('.dropdown-menu');
    if (m) m.classList.toggle('open');
  }

  closeDropdown() {
    const m = document.querySelector('.dropdown-menu');
    if (m) m.classList.remove('open');
  }

  showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'success' ? '?' : type === 'error' ? '?' : '?';
    t.innerHTML = `<span>${icon}</span> ${msg}`;
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
      if (!e.target.closest('.dropdown')) this.closeDropdown();
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
window.handleShare = () => app.handleShare();
window.loadMoreEvents = () => app.loadMoreEvents();
window.addTicket = () => app.addTicket();
window.toggleSetting = btn => app.toggleSetting(btn);
window.toggleDropdown = () => app.toggleDropdown();
window.closeDropdown = () => app.closeDropdown();
window.handleImageUpload = el => app.handleImageUpload(el);
window.switchProfileTab = (btn, tab) => app.switchProfileTab(btn, tab);
window.saveDraft = () => app.saveDraft();
