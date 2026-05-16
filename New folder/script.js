// ── STATE ──
let customers = [];
let leads = [];
let invoices = [];
let activityLog = [];
let invoiceCounter = 1;
let dashCharts = {};
let reportCharts = {};

// ── UTILS ──
function genId() { return Date.now() + '-' + Math.random().toString(36).substr(2,6); }
function fmt(n) { return '$' + (parseFloat(n)||0).toFixed(2); }
function today() { return new Date().toISOString().split('T')[0]; }
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(ts) {
  const d = Math.floor((Date.now()-ts)/1000);
  if(d<60) return 'just now';
  if(d<3600) return Math.floor(d/60)+'m ago';
  if(d<86400) return Math.floor(d/3600)+'h ago';
  return Math.floor(d/86400)+'d ago';
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ── TOAST ──
function showToast(msg, type='success') {
  const t = document.getElementById('toastBox');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.className='toast'; }, 3000);
}

// ── NAVIGATION ── (see full definition in Feedback Module below)

// ── ACTIVITY LOG ──
function logAction(msg, icon='fa-circle-check', color='green') {
  activityLog.unshift({ id:genId(), msg, icon, color, ts:Date.now() });
  if(activityLog.length>100) activityLog.pop();
}
function renderActivityLog() {
  const el = document.getElementById('activityTimeline');
  const em = document.getElementById('activityEmpty');
  if(!el) return;
  if(!activityLog.length) { el.innerHTML=''; if(em) em.style.display='block'; return; }
  if(em) em.style.display='none';
  const colorMap = { green:'rgba(16,185,129,0.12)', blue:'rgba(14,165,233,0.12)', red:'rgba(239,68,68,0.12)', orange:'rgba(245,158,11,0.12)', purple:'rgba(139,92,246,0.12)' };
  const txtMap   = { green:'#059669', blue:'#0284c7', red:'#dc2626', orange:'#d97706', purple:'#7c3aed' };
  el.innerHTML = activityLog.map(a=>`
    <div class="activity-item">
      <div class="activity-icon" style="background:${colorMap[a.color]||colorMap.green};color:${txtMap[a.color]||txtMap.green}">
        <i class="fa-solid ${a.icon}"></i>
      </div>
      <div class="activity-body">
        <div class="activity-msg">${escHtml(a.msg)}</div>
        <div class="activity-time">${timeAgo(a.ts)}</div>
      </div>
    </div>`).join('');
}
function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  if(!el) return;
  const recent = activityLog.slice(0,5);
  if(!recent.length) { el.innerHTML='<p class="empty-state">No recent activity.</p>'; return; }
  const colorMap = { green:'#059669', blue:'#0284c7', red:'#dc2626', orange:'#d97706', purple:'#7c3aed' };
  el.innerHTML = recent.map(a=>`
    <div class="activity-list-item">
      <i class="fa-solid ${a.icon}" style="color:${colorMap[a.color]||colorMap.green};width:18px;text-align:center"></i>
      <span style="flex:1">${escHtml(a.msg)}</span>
      <span style="color:var(--muted);font-size:11px">${timeAgo(a.ts)}</span>
    </div>`).join('');
}
function clearActivityLog() {
  if(!confirm('Clear all activity logs?')) return;
  activityLog = [];
  renderActivityLog();
  showToast('Activity log cleared.');
}

// ── STATS ──
function updateStats() {
  const totalRev = customers.reduce((s,c)=>s+(c.amount||0),0);
  const pipVal   = leads.filter(l=>l.stage!=='lost').reduce((s,l)=>s+(l.value||0),0);
  const set = (id,v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('stat-customers', customers.length);
  set('stat-revenue',   fmt(totalRev));
  set('stat-invoices',  invoices.length);
  set('stat-pipeline',  fmt(pipVal));
  set('customerCount',  customers.length);
  // invoice counts
  ['draft','sent','paid','overdue'].forEach(s=>{
    const el = document.getElementById('inv-'+s);
    if(el) el.textContent = invoices.filter(i=>i.status===s).length;
  });
}

// ── CUSTOMERS ──
function openCustomerModal(id) {
  document.getElementById('editCustomerId').value = id||'';
  document.getElementById('customerModalTitle').textContent = id ? 'Edit Customer' : 'Add Customer';
  if(id) {
    const c = customers.find(x=>x.id===id);
    if(!c) return;
    document.getElementById('custName').value    = c.name;
    document.getElementById('custEmail').value   = c.email;
    document.getElementById('custPhone').value   = c.phone||'';
    document.getElementById('custAmount').value  = c.amount||0;
    document.getElementById('custStatus').value  = c.status||'active';
  } else {
    ['custName','custEmail','custPhone','custAmount'].forEach(id=>{ document.getElementById(id).value=''; });
    document.getElementById('custStatus').value = 'active';
  }
  document.getElementById('customerModal').classList.add('active');
}
function closeCustomerModal() { document.getElementById('customerModal').classList.remove('active'); }

function saveCustomer() {
  const name   = document.getElementById('custName').value.trim();
  const email  = document.getElementById('custEmail').value.trim();
  const phone  = document.getElementById('custPhone').value.trim();
  const amount = parseFloat(document.getElementById('custAmount').value)||0;
  const status = document.getElementById('custStatus').value;
  const editId = document.getElementById('editCustomerId').value;

  if(!name)  { showToast('Name is required.','error'); return; }
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Valid email required.','error'); return; }

  if(editId) {
    const idx = customers.findIndex(c=>c.id===editId);
    if(idx>-1) { customers[idx]={...customers[idx],name,email,phone,amount,status}; }
    logAction('Customer updated: '+name,'fa-user-pen','blue');
    showToast('Customer updated!');
  } else {
    const newC = { id:genId(), name, email, phone, amount, status, date:today() };
    customers.push(newC);
    logAction('New customer added: '+name,'fa-user-plus','green');
    showToast('Customer added!');
    triggerAutoFeedbackEmails(newC, 'customer');
  }
  closeCustomerModal();
  renderCustomers();
  updateStats();
}

function deleteCustomer(id) {
  const c = customers.find(x=>x.id===id);
  if(!c || !confirm('Delete '+c.name+'?')) return;
  customers = customers.filter(x=>x.id!==id);
  logAction('Customer deleted: '+c.name,'fa-user-minus','red');
  showToast('Customer deleted.','error');
  renderCustomers();
  updateStats();
}

function renderCustomers(list) {
  const tbody = document.getElementById('customerTableBody');
  const empty = document.getElementById('customerEmpty');
  if(!tbody) return;
  const data = list !== undefined ? list : customers;
  if(!data.length) {
    tbody.innerHTML='';
    if(empty) empty.style.display='block';
    return;
  }
  if(empty) empty.style.display='none';
  tbody.innerHTML = data.map((c,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><b>${escHtml(c.name)}</b></td>
      <td>${escHtml(c.email)}</td>
      <td>${escHtml(c.phone||'—')}</td>
      <td><b>${fmt(c.amount)}</b></td>
      <td><span class="status-badge status-${c.status}">${c.status}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn-edit" onclick="openCustomerModal('${c.id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-delete" onclick="deleteCustomer('${c.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

function searchCustomers() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderCustomers(customers.filter(c=>
    c.name.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q)
  ));
}

function exportCSV() {
  if(!customers.length) { showToast('No customers to export.','error'); return; }
  const header = ['Name','Email','Phone','Amount','Status','Date'];
  const rows = customers.map(c=>[c.name,c.email,c.phone||'',c.amount,c.status,c.date||''].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));
  const csv = [header.join(','),...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'customers.csv';
  a.click();
  logAction('Exported customers CSV','fa-download','blue');
  showToast('CSV exported!');
}

// ── PIPELINE / KANBAN ──
const STAGES = [
  { key:'lead',      label:'New Lead',       },
  { key:'contacted', label:'Contacted',      },
  { key:'proposal',  label:'Proposal Sent',  },
  { key:'won',       label:'Won ✓',          },
  { key:'lost',      label:'Lost ✗',         },
];

function openLeadModal() {
  ['leadTitle','leadContact','leadValue'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('leadStage').value='lead';
  document.getElementById('leadModal').classList.add('active');
}
function closeLeadModal() { document.getElementById('leadModal').classList.remove('active'); }

function saveLead() {
  const title   = document.getElementById('leadTitle').value.trim();
  const contact = document.getElementById('leadContact').value.trim();
  const value   = parseFloat(document.getElementById('leadValue').value)||0;
  const stage   = document.getElementById('leadStage').value;
  if(!title)   { showToast('Deal title required.','error'); return; }
  if(!contact) { showToast('Contact name required.','error'); return; }
  const newL = { id:genId(), title, contact, value, stage, date:today() };
  leads.push(newL);
  logAction('New lead added: '+title,'fa-filter','purple');
  showToast('Lead added!');
  // Auto-schedule feedback emails for the lead contact
  const leadPerson = { id:newL.id, name:contact, email: contact.toLowerCase().replace(/\s+/g,'.') + '@lead.example.com', company:'—' };
  triggerAutoFeedbackEmails(leadPerson, 'lead');
  closeLeadModal();
  renderKanban();
  updateStats();
}

function deleteLead(id) {
  const l = leads.find(x=>x.id===id);
  if(!l) return;
  leads = leads.filter(x=>x.id!==id);
  logAction('Lead removed: '+l.title,'fa-filter','red');
  showToast('Lead removed.','error');
  renderKanban();
  updateStats();
}

let dragId = null;
function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if(!board) return;
  board.innerHTML = STAGES.map(s=>{
    const cards = leads.filter(l=>l.stage===s.key);
    const total = cards.reduce((sum,l)=>sum+(l.value||0),0);
    return `
    <div class="kanban-col col-${s.key}" 
         ondragover="event.preventDefault();this.classList.add('drag-over')"
         ondragleave="this.classList.remove('drag-over')"
         ondrop="dropLead(event,'${s.key}',this)">
      <div class="kanban-col-header">
        <h3>${s.label}</h3>
        <span class="kanban-col-count">${cards.length}</span>
      </div>
      <div class="kanban-col-value">Total: <b>${fmt(total)}</b></div>
      <div class="kanban-cards">
        ${cards.map(c=>`
          <div class="kanban-card" draggable="true"
               ondragstart="dragId='${c.id}';this.classList.add('dragging')"
               ondragend="this.classList.remove('dragging')">
            <div class="kanban-card-title">${escHtml(c.title)}</div>
            <div class="kanban-card-contact"><i class="fa-solid fa-user" style="margin-right:5px"></i>${escHtml(c.contact)}</div>
            <div class="kanban-card-footer">
              <span class="kanban-card-value">${fmt(c.value)}</span>
              <button class="kanban-card-del" onclick="deleteLead('${c.id}')"><i class="fa-solid fa-xmark"></i></button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

function dropLead(e, stage, col) {
  e.preventDefault();
  col.classList.remove('drag-over');
  if(!dragId) return;
  const lead = leads.find(l=>l.id===dragId);
  if(lead && lead.stage!==stage) {
    const oldStage = lead.stage;
    lead.stage = stage;
    logAction(`Lead "${lead.title}" moved: ${oldStage} → ${stage}`,'fa-arrows-up-down','orange');
    renderKanban();
    updateStats();
  }
  dragId = null;
}

// ── INVOICES ──
function openInvoiceModal() {
  ['invCustomer','invAmount','invDesc'].forEach(id=>{ document.getElementById(id).value=''; });
  document.getElementById('invDate').value = today();
  document.getElementById('invDue').value  = '';
  document.getElementById('invStatus').value = 'draft';
  document.getElementById('invoiceModal').classList.add('active');
}
function closeInvoiceModal() { document.getElementById('invoiceModal').classList.remove('active'); }

function saveInvoice() {
  const customer = document.getElementById('invCustomer').value.trim();
  const amount   = parseFloat(document.getElementById('invAmount').value)||0;
  const date     = document.getElementById('invDate').value || today();
  const due      = document.getElementById('invDue').value;
  const status   = document.getElementById('invStatus').value;
  const desc     = document.getElementById('invDesc').value.trim();
  if(!customer) { showToast('Customer name required.','error'); return; }
  if(!amount)   { showToast('Amount required.','error'); return; }
  const no = 'INV-' + String(invoiceCounter++).padStart(3,'0');
  invoices.push({ id:genId(), no, customer, amount, date, due, status, desc });
  logAction('Invoice '+no+' created for '+customer,'fa-file-invoice','blue');
  showToast('Invoice created!');
  closeInvoiceModal();
  renderInvoices();
  updateStats();
}

function markPaid(id) {
  const inv = invoices.find(i=>i.id===id);
  if(!inv) return;
  inv.status = 'paid';
  logAction('Invoice '+inv.no+' marked as paid','fa-circle-check','green');
  showToast('Marked as paid!');
  renderInvoices();
  updateStats();
}

function deleteInvoice(id) {
  const inv = invoices.find(i=>i.id===id);
  if(!inv || !confirm('Delete '+inv.no+'?')) return;
  invoices = invoices.filter(i=>i.id!==id);
  logAction('Invoice '+inv.no+' deleted','fa-file-circle-xmark','red');
  showToast('Invoice deleted.','error');
  renderInvoices();
  updateStats();
}

function renderInvoices() {
  const tbody = document.getElementById('invoiceTableBody');
  const empty = document.getElementById('invoiceEmpty');
  if(!tbody) return;
  updateStats();
  if(!invoices.length) {
    tbody.innerHTML='';
    if(empty) empty.style.display='block';
    return;
  }
  if(empty) empty.style.display='none';
  tbody.innerHTML = invoices.map(inv=>`
    <tr>
      <td><b>${escHtml(inv.no)}</b></td>
      <td>${escHtml(inv.customer)}</td>
      <td><b>${fmt(inv.amount)}</b></td>
      <td>${inv.date||'—'}</td>
      <td>${inv.due||'—'}</td>
      <td><span class="status-badge status-${inv.status}">${inv.status}</span></td>
      <td style="display:flex;gap:6px">
        ${inv.status!=='paid'?`<button class="btn-edit" onclick="markPaid('${inv.id}')" title="Mark Paid"><i class="fa-solid fa-check"></i></button>`:''}
        <button class="btn-delete" onclick="deleteInvoice('${inv.id}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join('');
}

// ── REPORTS ──
function renderTopCustomers() {
  const tbody = document.getElementById('topCustomersBody');
  if(!tbody) return;
  const sorted = [...customers].sort((a,b)=>(b.amount||0)-(a.amount||0)).slice(0,5);
  tbody.innerHTML = sorted.map((c,i)=>`
    <tr>
      <td><b>#${i+1}</b></td>
      <td>${escHtml(c.name)}</td>
      <td><b>${fmt(c.amount)}</b></td>
    </tr>`).join('');
}

// ── CHARTS ──
function destroyChart(key, store) { if(store[key]) { store[key].destroy(); delete store[key]; } }

function initDashCharts() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  const revenueData = [12000,18500,14200,21000,16800,24500];

  destroyChart('revenue', dashCharts);
  const rc = document.getElementById('revenueChart');
  if(rc) dashCharts.revenue = new Chart(rc, {
    type:'line',
    data:{
      labels:months,
      datasets:[{ label:'Revenue', data:revenueData, borderColor:'#4f46e5', backgroundColor:'rgba(79,70,229,0.08)', fill:true, tension:0.4, pointBackgroundColor:'#4f46e5', pointRadius:4 }]
    },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ grid:{ display:false } } } }
  });

  destroyChart('status', dashCharts);
  const statusCounts = ['active','inactive','lead','vip'].map(s=>customers.filter(c=>c.status===s).length);
  const sc = document.getElementById('statusChart');
  if(sc) dashCharts.status = new Chart(sc, {
    type:'doughnut',
    data:{
      labels:['Active','Inactive','Lead','VIP'],
      datasets:[{ data:statusCounts.some(x=>x>0)?statusCounts:[1,0,0,0], backgroundColor:['#10b981','#64748b','#0ea5e9','#f59e0b'], borderWidth:0 }]
    },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ padding:16, font:{ size:12 } } } }, cutout:'68%' }
  });
}

function initReportCharts() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun'];

  destroyChart('monthly', reportCharts);
  const mc = document.getElementById('monthlyRevenueChart');
  if(mc) reportCharts.monthly = new Chart(mc, {
    type:'bar',
    data:{
      labels:months,
      datasets:[{ label:'Revenue', data:[12000,18500,14200,21000,16800,24500], backgroundColor:'rgba(79,70,229,0.8)', borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, grid:{ color:'rgba(0,0,0,0.05)' } }, x:{ grid:{ display:false } } } }
  });

  destroyChart('pipeline', reportCharts);
  const pc = document.getElementById('pipelineChart');
  const stageCounts = STAGES.map(s=>leads.filter(l=>l.stage===s.key).length);
  if(pc) reportCharts.pipeline = new Chart(pc, {
    type:'bar',
    data:{
      labels:STAGES.map(s=>s.label),
      datasets:[{ label:'Leads', data:stageCounts, backgroundColor:['#0ea5e9','#f59e0b','#8b5cf6','#10b981','#ef4444'], borderRadius:8, borderSkipped:false }]
    },
    options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } }, x:{ grid:{ display:false } } } }
  });

  destroyChart('invStatus', reportCharts);
  const ic = document.getElementById('invoiceStatusChart');
  const invCounts = ['draft','sent','paid','overdue'].map(s=>invoices.filter(i=>i.status===s).length);
  if(ic) reportCharts.invStatus = new Chart(ic, {
    type:'doughnut',
    data:{
      labels:['Draft','Sent','Paid','Overdue'],
      datasets:[{ data:invCounts.some(x=>x>0)?invCounts:[1,0,0,0], backgroundColor:['#64748b','#0ea5e9','#10b981','#ef4444'], borderWidth:0 }]
    },
    options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ padding:16, font:{ size:12 } } } }, cutout:'60%' }
  });
}

// ── SETTINGS ──
function saveSettings() {
  const company = document.getElementById('settingCompany').value.trim();
  if(company) {
    document.querySelector('.sidebar-logo span').textContent = company;
    document.title = company;
  }
  logAction('Settings saved','fa-gear','blue');
  showToast('Settings saved!');
}

function setAccent(primary, hover, btn) {
  document.documentElement.style.setProperty('--primary', primary);
  document.documentElement.style.setProperty('--primary-h', hover);
  document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  const btn = document.getElementById('darkModeBtn');
  if(btn) btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i><span>Light Mode</span>' : '<i class="fa-solid fa-moon"></i><span>Dark Mode</span>';
  const chk = document.getElementById('darkModeCheck');
  if(chk) chk.checked = isDark;
}

// ── DATA ──
function loadSampleData() {
  customers = [
    { id:genId(), name:'Zara Tariq',   email:'zara@example.com',   phone:'+92-300-1111111', amount:4500,  status:'vip',      date:'2024-01-10' },
    { id:genId(), name:'Ali Hassan',   email:'ali@example.com',    phone:'+92-301-2222222', amount:1500,  status:'active',   date:'2024-01-15' },
    { id:genId(), name:'Sara Khan',    email:'sara@example.com',   phone:'+92-302-3333333', amount:3200,  status:'active',   date:'2024-01-20' },
    { id:genId(), name:'Usman Malik',  email:'usman@example.com',  phone:'+92-303-4444444', amount:750,   status:'inactive', date:'2024-01-25' },
    { id:genId(), name:'Ayesha Noor',  email:'ayesha@example.com', phone:'+92-304-5555555', amount:2800,  status:'lead',     date:'2024-02-01' },
  ];
  leads = [
    { id:genId(), title:'Website Redesign',  contact:'Zara Tariq',  value:5000,  stage:'contacted', date:'2024-01-15' },
    { id:genId(), title:'Mobile App Dev',    contact:'Ali Hassan',  value:12000, stage:'proposal',  date:'2024-01-20' },
    { id:genId(), title:'SEO Campaign',      contact:'Sara Khan',   value:2500,  stage:'lead',      date:'2024-01-25' },
    { id:genId(), title:'E-commerce Store',  contact:'Usman Malik', value:8000,  stage:'won',       date:'2024-02-01' },
    { id:genId(), title:'Brand Identity',    contact:'Ayesha Noor', value:3500,  stage:'lost',      date:'2024-02-05' },
  ];
  invoices = [
    { id:genId(), no:'INV-001', customer:'Zara Tariq',  amount:4500, date:'2024-01-10', due:'2024-01-25', status:'paid',    desc:'Web development' },
    { id:genId(), no:'INV-002', customer:'Ali Hassan',  amount:1500, date:'2024-01-15', due:'2024-01-30', status:'sent',    desc:'Consulting' },
    { id:genId(), no:'INV-003', customer:'Sara Khan',   amount:3200, date:'2024-01-20', due:'2024-02-05', status:'overdue', desc:'Design services' },
    { id:genId(), no:'INV-004', customer:'Ayesha Noor', amount:2800, date:'2024-02-01', due:'2024-02-16', status:'draft',   desc:'Marketing campaign' },
  ];
  invoiceCounter = 5;
  activityLog = [];
  campaignHistory = [];
  logAction('Sample data loaded','fa-database','blue');
  renderCustomers();
  renderKanban();
  renderInvoices();
  renderActivityLog();
  updateStats();
  seedCampaignHistory();
  showToast('Sample data loaded!');
}

function clearAllData() {
  if(!confirm('Clear ALL data? This cannot be undone.')) return;
  customers=[]; leads=[]; invoices=[]; activityLog=[]; invoiceCounter=1;
  renderCustomers(); renderKanban(); renderInvoices(); renderActivityLog();
  updateStats();
  showToast('All data cleared.','error');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', ()=>{
  loadSampleData();
  // Close modals on overlay click
  ['customerModal','leadModal','invoiceModal'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', e=>{ if(e.target===el) el.classList.remove('active'); });
  });
  // Navigate to dashboard
  navigate('dashboard');
  // Run auto-send scheduler on load, then every 60 seconds
  setTimeout(runAutoSendScheduler, 1500);
  setInterval(runAutoSendScheduler, 60000);
});

// ══════════════════════════════════════
//  FEEDBACK MODULE
// ══════════════════════════════════════
let feedbackRecords = [];
let feedbackFilter  = 'all'; // 'all' | 'weekly' | 'monthly'

// ── Helpers ──
function fbStars(r) {
  if(!r) return '<span class="fb-stars none">— no rating —</span>';
  return '<span class="fb-stars">' + '⭐'.repeat(Number(r)) + '</span>';
}

const FB_STATUS_ICON = {
  pending:   'fa-clock',
  sent:      'fa-paper-plane',
  responded: 'fa-comment-check',
  positive:  'fa-face-smile',
  negative:  'fa-face-frown',
  'no-reply':'fa-ban'
};
const FB_STATUS_LABEL = {
  pending:   'Pending',
  sent:      'Sent',
  responded: 'Responded',
  positive:  'Positive',
  negative:  'Negative',
  'no-reply':'No Reply'
};
const EMAIL_TYPE_ICON = {
  weekly:    'fa-envelope',
  monthly:   'fa-calendar-days',
  feedback:  'fa-star',
  '7-day':   'fa-clock',
  '1-month': 'fa-calendar-check'
};
const EMAIL_TYPE_LABEL = {
  weekly:    'Weekly',
  monthly:   'Monthly',
  feedback:  'Feedback',
  '7-day':   '7-Day Follow-up',
  '1-month': '1-Month Follow-up'
};

// ── Auto-trigger 3 emails when a new customer/lead is created ──
function triggerAutoFeedbackEmails(person, entityType) {
  const { id, name, email, company } = person;
  const base = today();

  // 1. Feedback email — sent IMMEDIATELY upon customer creation
  const fbRecId = genId();
  feedbackRecords.push({
    id: fbRecId, customerId: id, name, email, company: company||'—',
    emailType: 'feedback', sentDate: base, scheduledDate: base,
    status: 'sent', rating: '', notes: 'Welcome feedback email sent immediately on signup.',
    entityType, autoGenerated: true
  });
  // Mirror in engagement campaign history (sent immediately)
  campaignHistory.unshift({
    id: genId(), feedbackRecordId: fbRecId,
    name: '👋 Welcome Feedback — ' + name,
    type: 'feedback',
    subject: 'Welcome to the family! How has your experience been?',
    recipients: 1, sentAt: base + ' (sent immediately)',
    templateKey: 'welcomeFeedback',
    opened: 1, clicked: 0, converted: 0,
    scheduled: false, autoGenerated: true
  });
  logAction('Welcome feedback email sent to ' + name, 'fa-paper-plane', 'blue');

  // 2. Weekly engagement email — pending, auto-sends after 7 days
  const weeklyRecId = genId();
  const weeklyDate  = addDays(base, 7);
  feedbackRecords.push({
    id: weeklyRecId, customerId: id, name, email, company: company||'—',
    emailType: '7-day', sentDate: null, scheduledDate: weeklyDate,
    status: 'pending', rating: '', notes: 'Scheduled: weekly engagement email (7 days after signup).',
    entityType, autoGenerated: true
  });
  // Mirror in engagement campaign history (scheduled)
  campaignHistory.unshift({
    id: genId(), feedbackRecordId: weeklyRecId,
    name: '📅 Weekly Check-In — ' + name,
    type: 'weekly',
    subject: '👋 Checking in — how are things going with you?',
    recipients: 1, sentAt: weeklyDate + ' 09:00',
    templateKey: 'checkin',
    opened: 0, clicked: 0, converted: 0,
    scheduled: true, autoGenerated: true
  });

  // 3. Monthly engagement email — pending, auto-sends after 30 days
  const monthlyRecId = genId();
  const monthlyDate  = addDays(base, 30);
  feedbackRecords.push({
    id: monthlyRecId, customerId: id, name, email, company: company||'—',
    emailType: '1-month', sentDate: null, scheduledDate: monthlyDate,
    status: 'pending', rating: '', notes: 'Scheduled: monthly engagement email (30 days after signup).',
    entityType, autoGenerated: true
  });
  // Mirror in engagement campaign history (scheduled)
  campaignHistory.unshift({
    id: genId(), feedbackRecordId: monthlyRecId,
    name: '📆 Monthly Re-Engage — ' + name,
    type: 'monthly',
    subject: "We miss you! 🎁 An exclusive offer is waiting just for you",
    recipients: 1, sentAt: monthlyDate + ' 09:00',
    templateKey: 'reengage',
    opened: 0, clicked: 0, converted: 0,
    scheduled: true, autoGenerated: true
  });

  logAction('Engagement emails scheduled for ' + entityType + ': ' + name + ' (7-day & 1-month)', 'fa-calendar-check', 'purple');

  // Refresh both pages if visible
  if(document.getElementById('page-feedback')?.classList.contains('active')) {
    renderFeedbackTable(); updateFeedbackStats();
  }
  if(document.getElementById('page-engagement')?.classList.contains('active')) {
    renderCampaignHistory(); updateEngStats();
  }
}

// ── Auto-send scheduler: fires pending emails whose scheduled date has passed ──
function runAutoSendScheduler() {
  const now = today();
  let dispatched = 0;
  feedbackRecords.forEach(r => {
    if(r.status === 'pending' && r.autoGenerated && r.scheduledDate && r.scheduledDate <= now) {
      r.status   = 'sent';
      r.sentDate = now;
      dispatched++;
      logAction(`Auto-sent ${EMAIL_TYPE_LABEL[r.emailType]||r.emailType} email to ${r.name}`, 'fa-paper-plane', 'blue');
      // Update the matching campaign history entry → flip from scheduled to sent
      const camp = campaignHistory.find(c => c.feedbackRecordId === r.id);
      if(camp) {
        camp.scheduled  = false;
        camp.sentAt     = now + ' 09:00';
        camp.opened     = 1;
        camp.clicked    = Math.random() > 0.4 ? 1 : 0;
        camp.converted  = Math.random() > 0.7 ? 1 : 0;
      }
    }
  });
  if(dispatched > 0) {
    showToast(`📧 ${dispatched} scheduled email${dispatched > 1 ? 's' : ''} auto-sent!`, 'success');
    if(document.getElementById('page-feedback')?.classList.contains('active')) {
      renderFeedbackTable(); updateFeedbackStats();
    }
    if(document.getElementById('page-engagement')?.classList.contains('active')) {
      renderCampaignHistory(); updateEngStats();
    }
    renderRecentActivity();
  }
}

// ── Seed sample feedback records from customers ──
function seedFeedbackRecords() {
  const allTypes   = ['weekly','monthly','feedback','7-day','1-month'];
  const statuses   = ['positive','responded','pending','negative','no-reply','responded','positive','pending'];
  const ratings    = ['5','4','','3','','5','4','2'];
  const sentDates  = ['2024-01-08','2024-01-15','2024-02-01','2024-02-10','2024-01-22','2024-02-14','2024-01-31','2024-02-07'];
  const schedDates = ['2024-01-15','2024-01-22','2024-02-08','2024-02-17','2024-01-29','2024-02-21','2024-02-07','2024-02-14'];
  const notes = [
    'Excellent service, very satisfied.',
    'Happy with the support team.',
    'Auto-generated welcome feedback email.',
    'Had issues with the delivery.',
    'No response from customer.',
    'Looking forward to the next update!',
    'Product exceeded expectations.',
    '',
  ];

  feedbackRecords = [];
  // One record per email type per customer (rich seed)
  customers.forEach((c, i) => {
    allTypes.forEach((etype, j) => {
      const idx = (i + j) % statuses.length;
      feedbackRecords.push({
        id:            genId(),
        customerId:    c.id,
        name:          c.name,
        email:         c.email,
        company:       c.company || '—',
        emailType:     etype,
        sentDate:      etype === '7-day' || etype === '1-month' ? null : sentDates[idx],
        scheduledDate: schedDates[idx],
        status:        statuses[idx],
        rating:        ratings[idx],
        notes:         notes[idx],
        autoGenerated: etype === 'feedback' || etype === '7-day' || etype === '1-month',
      });
    });
  });
}

// ── Seed sample campaign history ──
function seedCampaignHistory() {
  campaignHistory = [
    {
      id: genId(), name: 'Re-Engage & Win Back', type: 'monthly',
      subject: "We miss you! 🎁 An exclusive offer is waiting just for you",
      recipients: customers.length, sentAt: '2024-02-14 09:00',
      templateKey: 'reengage',
      opened: Math.floor(customers.length * 0.72),
      clicked: Math.floor(customers.length * 0.45),
      converted: Math.floor(customers.length * 0.18),
      scheduled: false
    },
    {
      id: genId(), name: 'Weekly Check-In', type: 'weekly',
      subject: "👋 Checking in — how are things going with you?",
      recipients: customers.length, sentAt: '2024-02-07 09:00',
      templateKey: 'checkin',
      opened: Math.floor(customers.length * 0.65),
      clicked: Math.floor(customers.length * 0.38),
      converted: Math.floor(customers.length * 0.12),
      scheduled: false
    },
    {
      id: genId(), name: 'Loyalty Reward — Feb', type: 'monthly',
      subject: "🏆 Your loyalty deserves a reward — here's yours!",
      recipients: customers.length, sentAt: '2024-02-01 10:00',
      templateKey: 'loyalty',
      opened: Math.floor(customers.length * 0.80),
      clicked: Math.floor(customers.length * 0.52),
      converted: Math.floor(customers.length * 0.22),
      scheduled: false
    },
    {
      id: genId(), name: 'Summer Re-engagement', type: 'monthly',
      subject: "🌟 Our biggest seasonal sale is here — don't miss out!",
      recipients: customers.length, sentAt: '2024-05-15 09:00',
      templateKey: 'seasonal',
      opened: 0, clicked: 0, converted: 0, scheduled: true
    },
  ];
}

// ── Update Feedback Stats ──
function updateFeedbackStats() {
  const weekly    = feedbackRecords.filter(r => r.emailType === 'weekly').length;
  const monthly   = feedbackRecords.filter(r => r.emailType === 'monthly').length;
  const responded = feedbackRecords.filter(r => ['responded','positive','negative'].includes(r.status)).length;
  const pending   = feedbackRecords.filter(r => r.status === 'pending' || r.status === 'no-reply').length;
  const autoSched = feedbackRecords.filter(r => r.autoGenerated && r.status === 'pending').length;

  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('fb-weekly-count',    weekly);
  set('fb-monthly-count',   monthly);
  set('fb-responded-count', responded);
  set('fb-pending-count',   pending);
  set('fb-auto-count',      autoSched);

  // Summary progress bar
  const total = feedbackRecords.length;
  const pct   = total ? Math.round((responded / total) * 100) : 0;
  const bar   = document.getElementById('feedbackSummaryBar');
  if(bar) {
    bar.innerHTML = `
      <span class="fb-progress-label">Response Rate</span>
      <div class="fb-progress-wrap"><div class="fb-progress-fill" style="width:${pct}%"></div></div>
      <span class="fb-progress-pct">${pct}%</span>
      <span class="fb-progress-label" style="margin-left:8px">${responded} of ${total} emails responded &nbsp;|&nbsp; <b>${autoSched}</b> auto-scheduled pending</span>`;
  }
}

// ── Filter helper ──
function filterFeedback(type, btn) {
  feedbackFilter = type;
  document.querySelectorAll('.fb-tab').forEach(t => t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderFeedbackTable();
}

// ── Render Table ──
function renderFeedbackTable() {
  const tbody = document.getElementById('feedbackTableBody');
  const empty = document.getElementById('feedbackEmpty');
  if(!tbody) return;

  const q = (document.getElementById('feedbackSearch')?.value || '').toLowerCase();

  let data = feedbackRecords;
  if(feedbackFilter !== 'all') data = data.filter(r => r.emailType === feedbackFilter);
  if(q) data = data.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.email.toLowerCase().includes(q)
  );

  if(!data.length) {
    tbody.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  tbody.innerHTML = data.map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td><b>${escHtml(r.name)}</b>${r.autoGenerated ? ' <span style="font-size:10px;color:#7c3aed;font-weight:700">AUTO</span>' : ''}</td>
      <td style="color:var(--muted);font-size:12px">${escHtml(r.email)}</td>
      <td>
        <span class="email-type-badge email-type-${r.emailType}">
          <i class="fa-solid ${EMAIL_TYPE_ICON[r.emailType]||'fa-envelope'}"></i>
          ${EMAIL_TYPE_LABEL[r.emailType]||r.emailType}
        </span>
      </td>
      <td style="color:var(--muted);font-size:12px">${r.sentDate||'—'}</td>
      <td style="color:var(--muted);font-size:12px">${r.scheduledDate||'—'}</td>
      <td>
        <span class="fb-status-badge fb-status-${r.status}">
          <i class="fa-solid ${FB_STATUS_ICON[r.status]||'fa-clock'}"></i>
          ${FB_STATUS_LABEL[r.status]||r.status}
        </span>
      </td>
      <td>${fbStars(r.rating)}</td>
      <td>
        <button class="btn-edit" onclick="openFeedbackModal('${r.id}')" title="Update Status">
          <i class="fa-solid fa-pen"></i>
        </button>
      </td>
    </tr>`).join('');

  updateFeedbackStats();
}

// ── Navigate (include feedback) ──
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const pg = document.getElementById('page-'+page);
  if(pg) pg.classList.add('active');
  const lk = document.querySelector('[data-page="'+page+'"]');
  if(lk) lk.classList.add('active');
  if(page==='dashboard') { updateStats(); renderRecentActivity(); initDashCharts(); }
  if(page==='customers') { renderCustomers(); }
  if(page==='pipeline')  { renderKanban(); }
  if(page==='invoices')  { renderInvoices(); }
  if(page==='activity')  { renderActivityLog(); }
  if(page==='reports')   { updateStats(); initReportCharts(); renderTopCustomers(); }
  if(page==='engagement'){ renderEngTemplates(currentEngTab); renderEmailTracking(); renderCampaignHistory(); updateEngStats(); }
}

// ── Email Tracking Table ──
let _emailTrackingFilter = 'all';

function filterEmailTracking(type, btn) {
  _emailTrackingFilter = type;
  document.querySelectorAll('#page-engagement .fb-tab').forEach(t => t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderEmailTracking();
}

function renderEmailTracking() {
  const tbody = document.getElementById('emailTrackingBody');
  const empty = document.getElementById('emailTrackingEmpty');
  const countEl = document.getElementById('emailTrackingCount');
  if(!tbody) return;

  const q = (document.getElementById('emailTrackingSearch')?.value || '').toLowerCase();

  // Map email types to the 3 display categories
  const typeGroup = r => {
    if(r.emailType === 'feedback') return 'feedback';
    if(r.emailType === '7-day'  || r.emailType === 'weekly')  return 'weekly';
    if(r.emailType === '1-month'|| r.emailType === 'monthly') return 'monthly';
    return 'other';
  };

  let data = [...feedbackRecords];
  if(_emailTrackingFilter !== 'all') data = data.filter(r => typeGroup(r) === _emailTrackingFilter);
  if(q) data = data.filter(r =>
    r.name.toLowerCase().includes(q) ||
    r.email.toLowerCase().includes(q)
  );
  // Sort: pending first, then by scheduledDate desc
  data.sort((a,b) => {
    if(a.status==='pending' && b.status!=='pending') return -1;
    if(a.status!=='pending' && b.status==='pending') return  1;
    return (b.scheduledDate||'').localeCompare(a.scheduledDate||'');
  });

  if(countEl) countEl.textContent = data.length;

  if(!data.length) {
    tbody.innerHTML = '';
    if(empty) empty.style.display = 'block';
    return;
  }
  if(empty) empty.style.display = 'none';

  const typeLabel = { feedback:'Feedback', 'weekly':'Weekly', 'monthly':'Monthly', '7-day':'Weekly (7-day)', '1-month':'Monthly (1-month)' };
  const typeIcon  = { feedback:'fa-star', 'weekly':'fa-calendar-week', 'monthly':'fa-calendar-days', '7-day':'fa-calendar-week', '1-month':'fa-calendar-days' };
  const typeColor = { feedback:'#d97706', weekly:'#0284c7', monthly:'#7c3aed', '7-day':'#0284c7', '1-month':'#7c3aed' };

  const sendStatusBadge = r => {
    if(r.status === 'pending') return `<span class="et-badge et-pending"><i class="fa-solid fa-clock"></i> Pending</span>`;
    if(r.status === 'sent')    return `<span class="et-badge et-sent"><i class="fa-solid fa-paper-plane"></i> Sent</span>`;
    return `<span class="et-badge et-sent"><i class="fa-solid fa-paper-plane"></i> Sent</span>`;
  };

  const responseStatusBadge = r => {
    const s = r.status;
    if(s === 'pending')   return `<span class="et-badge et-no-response">—</span>`;
    if(s === 'sent')      return `<span class="et-badge et-awaiting"><i class="fa-solid fa-hourglass-half"></i> Awaiting</span>`;
    if(s === 'responded') return `<span class="et-badge et-responded"><i class="fa-solid fa-comment-dots"></i> Responded</span>`;
    if(s === 'positive')  return `<span class="et-badge et-positive"><i class="fa-solid fa-face-smile"></i> Positive</span>`;
    if(s === 'negative')  return `<span class="et-badge et-negative"><i class="fa-solid fa-face-frown"></i> Negative</span>`;
    if(s === 'no-reply')  return `<span class="et-badge et-no-response"><i class="fa-solid fa-ban"></i> No Reply</span>`;
    return `<span class="et-badge et-no-response">${s}</span>`;
  };

  tbody.innerHTML = data.map((r, i) => {
    const grp   = typeGroup(r);
    const color = typeColor[r.emailType] || '#64748b';
    const sentDisplay = r.sentDate
      ? r.sentDate + (r.emailType === 'feedback' ? ' · Immediate' : ' · 09:00')
      : '—';
    return `
    <tr>
      <td>${i+1}</td>
      <td>
        <div style="font-weight:700">${escHtml(r.name)}</div>
        <div style="font-size:11px;color:var(--muted)">${escHtml(r.email)}</div>
      </td>
      <td>
        <span class="email-type-badge" style="background:${color}18;color:${color}">
          <i class="fa-solid ${typeIcon[r.emailType]||'fa-envelope'}"></i>
          ${typeLabel[r.emailType]||r.emailType}
        </span>
      </td>
      <td>${sendStatusBadge(r)}</td>
      <td style="font-size:12px;color:var(--muted);white-space:nowrap">${escHtml(sentDisplay)}</td>
      <td style="font-size:12px;color:var(--muted)">${r.scheduledDate||'—'}</td>
      <td>${responseStatusBadge(r)}</td>
    </tr>`;
  }).join('');
}

// ── Modal ──
function openFeedbackModal(id) {
  const r = feedbackRecords.find(x => x.id === id);
  if(!r) return;
  document.getElementById('feedbackEditId').value  = id;
  document.getElementById('fbCustomerName').value  = r.name;
  document.getElementById('fbStatus').value        = r.status;
  document.getElementById('fbRating').value        = r.rating || '';
  document.getElementById('fbNotes').value         = r.notes  || '';
  document.getElementById('feedbackModal').classList.add('active');
}
function closeFeedbackModal() { document.getElementById('feedbackModal').classList.remove('active'); }

function saveFeedbackStatus() {
  const id     = document.getElementById('feedbackEditId').value;
  const status = document.getElementById('fbStatus').value;
  const rating = document.getElementById('fbRating').value;
  const notes  = document.getElementById('fbNotes').value.trim();

  const r = feedbackRecords.find(x => x.id === id);
  if(!r) return;
  r.status = status;

  logAction(`Feedback updated for ${r.name}: ${FB_STATUS_LABEL[status]}`,'fa-comment-dots','purple');
  showToast('Feedback status updated!');
  closeFeedbackModal();
  renderFeedbackTable();
}

// ── Export Feedback CSV ──
function exportFeedbackCSV() {
  if(!feedbackRecords.length) { showToast('No feedback records to export.','error'); return; }
  const header = ['Name','Email','Email Type','Sent Date','Feedback Status','Rating','Notes'];
  const rows = feedbackRecords.map(r => [
    r.name, r.email, r.emailType, r.sentDate,
    FB_STATUS_LABEL[r.status]||r.status, r.rating ? r.rating+'/5' : '', r.notes||''
  ].map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'feedback_report.csv';
  a.click();
  logAction('Exported feedback CSV','fa-download','blue');
  showToast('Feedback CSV exported!');
}

// ── Bulk Send Email (simulation) ──
function sendBulkEmail() {
  const type = feedbackFilter === 'monthly' ? 'monthly' : 'weekly';
  const count = feedbackRecords.filter(r => r.status === 'pending' || r.status === 'no-reply').length;
  if(!count) { showToast('No pending customers to email.','info'); return; }
  showToast(`📧 ${count} ${type} email${count>1?'s':''} queued successfully!`,'success');
  logAction(`Bulk ${type} emails sent to ${count} customers`,'fa-paper-plane','blue');
  renderFeedbackTable();
}

// ══════════════════════════════════════
//  ENGAGEMENT EMAIL TEMPLATES & CAMPAIGNS
// ══════════════════════════════════════

let campaignHistory = [];
let currentEngTab   = 'weekly';
let previewTemplate = null;

const ENGAGEMENT_TEMPLATES = {
  feedbackRequest: {
    label: 'Request Feedback',
    icon:  'fa-comment-dots',
    type:  'feedback',
    tags:  ['feedback','survey'],
    subject: "How did we do? Share your thoughts & get 10% off!",
    description: "Ask customers for their valuable feedback and reward them for their time.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#f59e0b,#d97706)">
        <div class="ep-hero-icon">⭐</div>
        <div class="ep-hero-title">We Value Your Opinion, ${name}!</div>
        <div class="ep-hero-sub">Help us improve by sharing your experience</div>
      </div>
      <div class="ep-content">
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">We're constantly striving to improve and provide the best experience possible. We'd love to hear your thoughts on your recent interaction with us.</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-clock"></i> <div>Takes less than 2 minutes to complete</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-gift"></i> <div>Get a <strong>10% discount code</strong> upon completion</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-lightbulb"></i> <div>Help shape our future products</div></div>
        </div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#f59e0b;box-shadow:0 4px 14px rgba(245,158,11,0.3)">📝 Take The Short Survey</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  welcomeFeedback: {
    label: 'Welcome & Feedback',
    icon:  'fa-hand-wave',
    type:  'feedback',
    tags:  ['welcome','feedback'],
    subject: "Welcome to the family! How has your experience been?",
    description: "Welcome new customers and ask for their initial thoughts.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#10b981,#059669)">
        <div class="ep-hero-icon">👋</div>
        <div class="ep-hero-title">Welcome Aboard, ${name}!</div>
        <div class="ep-hero-sub">We're thrilled to have you with us</div>
      </div>
      <div class="ep-content">
        <div class="ep-greeting">Welcome, ${name}!</div>
        <p class="ep-body">Thank you for choosing us. We want to ensure you're getting the most out of our services from day one.</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-check"></i> <div>Is everything working exactly as expected?</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-question-circle"></i> <div>Do you need help getting started?</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-comment"></i> <div>How can we make your experience better?</div></div>
        </div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#10b981;box-shadow:0 4px 14px rgba(16,185,129,0.3)">💬 Share Your Initial Thoughts</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you recently joined us.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  reengage: {
    label: 'Re-Engage & Win Back',
    icon:  'fa-rocket',
    type:  'monthly',
    tags:  ['monthly','promo'],
    subject: "We miss you! 🎁 An exclusive offer is waiting just for you",
    description: "Warm re-engagement email with a special discount to win back inactive customers and encourage repeat purchases.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,var(--primary),#8b5cf6)">
        <div class="ep-hero-icon">🚀</div>
        <div class="ep-hero-title">We Miss You, ${name}!</div>
        <div class="ep-hero-sub">It's been a while — here's something special to welcome you back</div>
      </div>
      <div class="ep-content">
        <div class="ep-urgency"><i class="fa-solid fa-clock"></i> <div>Limited Time: Offer expires in 7 days — don't miss out!</div></div>
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">We noticed you haven't been around lately and we truly value your support. To show how much we appreciate you, we've prepared an <strong>exclusive 20% discount</strong> just for you.</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-check"></i> <div>New products have just arrived</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-check"></i> <div>Improved features you'll love</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-check"></i> <div>Same great service you trust</div></div>
        </div>
        <div class="ep-code-box">Use code <br><strong>WELCOME20</strong><br> at checkout for 20% OFF</div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta">🛒 Shop Now &amp; Save 20%</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  winback: {
    label: 'Win-Back Offer',
    icon:  'fa-gift',
    type:  'monthly',
    tags:  ['monthly','promo'],
    subject: "A special gift is waiting for you — come back and claim it!",
    description: "Re-engage inactive customers with an exclusive discount offer.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#ec4899,#f43f5e)">
        <div class="ep-hero-icon">🎁</div>
        <div class="ep-hero-title">A Gift Just For You, ${name}!</div>
        <div class="ep-hero-sub">Claim your exclusive welcome-back offer today</div>
      </div>
      <div class="ep-content">
        <div class="ep-urgency" style="background:rgba(244,63,94,0.08);border-color:#f43f5e;color:#f43f5e"><i class="fa-solid fa-gift"></i> <div>Your gift is waiting — claim before it expires!</div></div>
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">We'd love to have you back. As a valued customer, here's an exclusive deal crafted just for you:</p>
        <div class="ep-code-box" style="background:rgba(244,63,94,0.04);border-color:#f43f5e">Use code <br><strong style="color:#f43f5e">COMEBACK15</strong><br> for 15% OFF your next order</div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#f43f5e;box-shadow:0 4px 14px rgba(244,63,94,0.3)">🎁 Claim My Discount</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  newproduct: {
    label: 'New Product Launch',
    icon:  'fa-bag-shopping',
    type:  'monthly',
    tags:  ['monthly','news'],
    subject: "✨ Exciting news — our latest products just dropped!",
    description: "Announce new products and drive repeat purchases.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa)">
        <div class="ep-hero-icon">✨</div>
        <div class="ep-hero-title">New Arrivals Are Here, ${name}!</div>
        <div class="ep-hero-sub">Be the first to explore our latest collection</div>
      </div>
      <div class="ep-content">
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">We've just launched exciting new products and as a valued customer, you get <strong>early access</strong> before the public!</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-star"></i> <div>Brand new product line — just launched</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-bolt"></i> <div>Early access — exclusive to loyal customers</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-truck"></i> <div>Free shipping on your first new-arrival order</div></div>
        </div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#8b5cf6;box-shadow:0 4px 14px rgba(139,92,246,0.3)">✨ Explore New Products</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  loyalty: {
    label: 'Loyalty Reward',
    icon:  'fa-award',
    type:  'monthly',
    tags:  ['monthly','loyalty'],
    subject: "🏆 Your loyalty deserves a reward — here's yours!",
    description: "Reward long-term customers and encourage continued engagement.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#10b981,#34d399)">
        <div class="ep-hero-icon">🏆</div>
        <div class="ep-hero-title">You've Earned It, ${name}!</div>
        <div class="ep-hero-sub">Thank you for being an amazing loyal customer</div>
      </div>
      <div class="ep-content">
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">Your continued trust and loyalty means the world to us. As our way of saying thank you, here's your exclusive loyalty reward:</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-gift"></i> <div><strong>FREE gift</strong> with your next purchase</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-headset"></i> <div><strong>Priority support</strong> — skip the queue</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-gem"></i> <div><strong>VIP early access</strong> to all new products</div></div>
        </div>
        <div class="ep-code-box" style="background:rgba(16,185,129,0.04);border-color:#10b981">Use code <br><strong style="color:#10b981">LOYAL2024</strong><br> to redeem your FREE gift at checkout</div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#10b981;box-shadow:0 4px 14px rgba(16,185,129,0.3)">🏆 Redeem My Reward</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  checkin: {
    label: 'Weekly Check-In',
    icon:  'fa-handshake',
    type:  'weekly',
    tags:  ['weekly'],
    subject: "👋 Checking in — how are things going with you?",
    description: "Stay top-of-mind with a friendly weekly check-in.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#0ea5e9,#38bdf8)">
        <div class="ep-hero-icon">👋</div>
        <div class="ep-hero-title">Hi ${name}, How Are Things?</div>
        <div class="ep-hero-sub">Your satisfaction is always our #1 priority</div>
      </div>
      <div class="ep-content">
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">We just wanted to stop by and check in — how is everything going? Whether you have questions, feedback, or just want to say hi, our team is always here for you.</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-headphones"></i> <div><strong>24/7 Support</strong> — reach us anytime</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-book"></i> <div><strong>Knowledge Base</strong> — step-by-step guides</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-user-tie"></i> <div><strong>Dedicated Account Manager</strong> — just for you</div></div>
        </div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#0ea5e9;box-shadow:0 4px 14px rgba(14,165,233,0.3)">Get In Touch</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  tips: {
    label: 'Pro Tips & Tricks',
    icon:  'fa-lightbulb',
    type:  'weekly',
    tags:  ['weekly'],
    subject: "💡 This week's pro tips to get more value from us",
    description: "Educate and engage customers with actionable weekly tips.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#f59e0b,#fbbf24)">
        <div class="ep-hero-icon">💡</div>
        <div class="ep-hero-title">This Week's Tips For You, ${name}!</div>
        <div class="ep-hero-sub">Maximize the value you get from our products</div>
      </div>
      <div class="ep-content">
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">Here are <strong>3 power tips</strong> our top customers swear by this week:</p>
        <div class="ep-tips-list">
          <div class="ep-tip"><div class="ep-tip-num">1</div><div><strong>Use Dashboard Shortcuts</strong><br>Save 20+ minutes a day with our quick-action toolbar.</div></div>
          <div class="ep-tip"><div class="ep-tip-num">2</div><div><strong>Browse the Knowledge Base</strong><br>100+ guides and video walkthroughs at your fingertips.</div></div>
          <div class="ep-tip"><div class="ep-tip-num">3</div><div><strong>Book a Free Consultation</strong><br>Our experts will optimize your setup at no cost.</div></div>
        </div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:#f59e0b;box-shadow:0 4px 14px rgba(245,158,11,0.3)">Explore All Tips</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  },
  seasonal: {
    label: 'Seasonal Promo',
    icon:  'fa-star',
    type:  'monthly',
    tags:  ['monthly','promo'],
    subject: "🌟 Our biggest seasonal sale is here — don't miss out!",
    description: "Drive seasonal purchases with time-limited promotional offers.",
    body: (name) => `
    <div class="ep-container">
      <div class="ep-header">
        <div class="ep-header-logo"><i class="fa-solid fa-chart-line"></i></div>
      </div>
      <div class="ep-hero" style="background:linear-gradient(135deg,#f59e0b,#ef4444)">
        <div class="ep-hero-icon">🌟</div>
        <div class="ep-hero-title">Seasonal Sale Just For You, ${name}!</div>
        <div class="ep-hero-sub">Limited time — our biggest sale of the season is LIVE</div>
      </div>
      <div class="ep-content">
        <div class="ep-urgency" style="background:rgba(239,68,68,0.08);border-color:#ef4444;color:#dc2626"><i class="fa-solid fa-fire"></i> <div>Hurry! Stock is limited — sale ends Sunday at midnight!</div></div>
        <div class="ep-greeting">Hi ${name},</div>
        <p class="ep-body">Our biggest seasonal sale is live right now. Enjoy up to <strong>30% OFF</strong> on selected products — don't miss out!</p>
        <div class="ep-features">
          <div class="ep-feature-item"><i class="fa-solid fa-tag"></i> <div>Up to <strong>30% OFF</strong> selected products</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-box-open"></i> <div>Free shipping on orders over $50</div></div>
          <div class="ep-feature-item"><i class="fa-solid fa-rotate-left"></i> <div>Hassle-free 30-day returns</div></div>
        </div>
        <div class="ep-cta-wrap">
          <a href="#" class="ep-cta" style="background:linear-gradient(90deg,#f59e0b,#ef4444);box-shadow:0 4px 14px rgba(239,68,68,0.3)">🛍️ Shop The Sale Now</a>
        </div>
      </div>
      <div class="ep-footer">
        <p style="margin-bottom:8px">You're receiving this because you're a valued customer.</p>
        <a href="#" style="color:var(--muted);text-decoration:underline;">Unsubscribe</a> · <a href="#" style="color:var(--muted);text-decoration:underline;">Manage Preferences</a>
      </div>
    </div>`
  }
};

// ── Engagement Tab Switch ──
function switchEngTab(type, btn) {
  currentEngTab = type;
  document.querySelectorAll('.eng-tab').forEach(t => t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderEngTemplates(type);
}

// ── Render Template Cards ──
function renderEngTemplates(type) {
  const grid = document.getElementById('engTemplatesGrid');
  if(!grid) return;
  const filtered = Object.entries(ENGAGEMENT_TEMPLATES).filter(([,t]) => t.type === type);
  grid.innerHTML = filtered.map(([key, t]) => `
    <div class="eng-template-card ${type}">
      <div class="eng-card-header">
        <div class="eng-card-icon" style="background:rgba(79,70,229,0.1);color:var(--primary)">
          <i class="fa-solid ${t.icon}"></i>
        </div>
        <div>
          <div class="eng-card-title">${t.label}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${escHtml(t.subject)}</div>
        </div>
      </div>
      <p class="eng-card-desc">${t.description}</p>
      <div class="eng-card-meta">
        ${t.tags.map(g => `<span class="eng-card-tag ${g}">${g}</span>`).join('')}
      </div>
      <div class="eng-card-actions">
        <button class="btn-primary" onclick="openEmailPreview('${key}','${type}')">
          <i class="fa-solid fa-paper-plane"></i> Send
        </button>
        <button class="btn-secondary" onclick="openEmailPreview('${key}','${type}',true)">
          <i class="fa-solid fa-eye"></i> Preview
        </button>
      </div>
    </div>`).join('');
  updateEngStats();
}

// ── Build unified email list (campaigns + individual feedback record emails) ──
let _engHistoryFilter = 'all'; // 'all' | 'feedback' | 'weekly' | 'monthly'

function getUnifiedEmailList() {
  // IDs of feedbackRecords already mirrored in campaignHistory
  const mirroredIds = new Set(
    campaignHistory.filter(c => c.feedbackRecordId).map(c => c.feedbackRecordId)
  );
  // Convert un-mirrored feedbackRecords into campaign-like entries
  const fbEntries = feedbackRecords
    .filter(r => !mirroredIds.has(r.id))
    .map(r => {
      const typeMap = { feedback:'feedback', 'weekly':'weekly', 'monthly':'monthly', '7-day':'weekly', '1-month':'monthly' };
      const nameMap = {
        feedback: '👋 Welcome Feedback',
        'weekly':  '📅 Weekly Check-In',
        'monthly': '📆 Monthly Re-Engage',
        '7-day':   '📅 Weekly Check-In',
        '1-month': '📆 Monthly Re-Engage'
      };
      const subjectMap = {
        feedback:  'Welcome to the family! How has your experience been?',
        'weekly':  '👋 Checking in — how are things going with you?',
        'monthly': "We miss you! 🎁 An exclusive offer is waiting just for you",
        '7-day':   '👋 Checking in — how are things going with you?',
        '1-month': "We miss you! 🎁 An exclusive offer is waiting just for you"
      };
      const isSent = (r.status !== 'pending');
      return {
        _fromFeedback: true,
        id:          r.id,
        feedbackRecordId: r.id,
        name:        (nameMap[r.emailType] || '📧 Email') + ' — ' + r.name,
        type:        typeMap[r.emailType] || r.emailType,
        subject:     subjectMap[r.emailType] || r.notes || '',
        recipients:  1,
        sentAt:      r.sentDate
                       ? r.sentDate + (r.emailType==='feedback' ? ' (sent immediately)' : ' 09:00')
                       : (r.scheduledDate ? r.scheduledDate + ' 09:00' : '—'),
        opened:      isSent ? 1 : 0,
        clicked:     0,
        converted:   0,
        scheduled:   !isSent,
        autoGenerated: true
      };
    });
  // Merge and sort newest first
  return [...campaignHistory, ...fbEntries]
    .sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
}

// ── Filter engagement history ──
function filterEngHistory(type, btn) {
  _engHistoryFilter = type;
  document.querySelectorAll('.eng-history-tab').forEach(t => t.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderCampaignHistory();
}

// ── Update Engagement Stats ──
function updateEngStats() {
  const all       = getUnifiedEmailList();
  const sent      = all.length;
  const opened    = all.filter(c => c.opened > 0).length;
  const clicked   = all.filter(c => c.clicked > 0).length;
  const converted = all.filter(c => c.converted > 0).length;
  const rate      = sent ? Math.round((converted / sent) * 100) : 0;
  const s = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  s('engStatSent',      sent);
  s('engStatOpened',    opened);
  s('engStatClicked',   clicked);
  s('engStatConverted', converted);
  s('engStatRate',      rate + '%');
}

// ── Email Preview ──
let _previewKey = null, _previewType = null, _previewSendOnly = false;
function openEmailPreview(key, type, previewOnly) {
  const t = ENGAGEMENT_TEMPLATES[key];
  if(!t) return;
  _previewKey = key; _previewType = type; _previewSendOnly = !!previewOnly;
  const sampleName = customers.length ? customers[0].name : 'Valued Customer';
  const recips = customers.length + ' customers';
  document.getElementById('previewSubject').textContent    = t.subject;
  document.getElementById('previewType').textContent       = EMAIL_TYPE_LABEL[type] || type;
  document.getElementById('previewRecipients').textContent = recips;
  document.getElementById('previewBody').innerHTML         = t.body(sampleName);
  const sendBtn = document.getElementById('previewSendBtn');
  if(sendBtn) sendBtn.style.display = previewOnly ? 'none' : '';
  document.getElementById('emailPreviewModal').classList.add('active');
}
function closeEmailPreview() { document.getElementById('emailPreviewModal').classList.remove('active'); }
function sendPreviewedEmail() {
  if(!_previewKey) return;
  const t = ENGAGEMENT_TEMPLATES[_previewKey];
  const count = customers.length;
  if(!count) { showToast('No customers to send to.','error'); return; }
  const camp = {
    id: genId(), name: t.label, type: _previewType,
    subject: t.subject, recipients: count,
    sentAt: new Date().toLocaleString(), templateKey: _previewKey,
    opened: Math.floor(count*0.6), clicked: Math.floor(count*0.35), converted: Math.floor(count*0.15)
  };
  campaignHistory.unshift(camp);
  logAction(`Campaign "${t.label}" sent to ${count} customers`, 'fa-paper-plane', 'blue');
  showToast(`✅ Campaign sent to ${count} customers!`, 'success');
  closeEmailPreview();
  renderCampaignHistory();
  updateEngStats();
}

// ── Campaign History ──
function renderCampaignHistory() {
  const list  = document.getElementById('campaignHistoryList');
  const empty = document.getElementById('campaignHistoryEmpty');
  if(!list) return;

  // Inject filter tabs if not already present
  const tabsId = 'engHistoryTabs';
  if(!document.getElementById(tabsId)) {
    const tabsHtml = `
      <div id="${tabsId}" class="eng-history-filter-tabs" style="margin-bottom:14px;display:flex;gap:4px;flex-wrap:wrap">
        <button class="eng-history-tab active" onclick="filterEngHistory('all',this)">All Emails</button>
        <button class="eng-history-tab" onclick="filterEngHistory('feedback',this)">👋 Feedback</button>
        <button class="eng-history-tab" onclick="filterEngHistory('weekly',this)">📅 Weekly</button>
        <button class="eng-history-tab" onclick="filterEngHistory('monthly',this)">📆 Monthly</button>
        <button class="eng-history-tab" onclick="filterEngHistory('bulk',this)">📣 Bulk Campaigns</button>
      </div>`;
    list.insertAdjacentHTML('beforebegin', tabsHtml);
  }

  let all = getUnifiedEmailList();
  // Apply active filter
  if(_engHistoryFilter === 'feedback') {
    all = all.filter(c => c.type === 'feedback');
  } else if(_engHistoryFilter === 'weekly') {
    all = all.filter(c => c.type === 'weekly');
  } else if(_engHistoryFilter === 'monthly') {
    all = all.filter(c => c.type === 'monthly');
  } else if(_engHistoryFilter === 'bulk') {
    all = all.filter(c => !c.autoGenerated);
  }

  if(!all.length) {
    list.innerHTML = '';
    if(empty) { empty.style.display = 'block'; empty.textContent = 'No emails match this filter.'; }
    return;
  }
  if(empty) empty.style.display = 'none';

  list.innerHTML = all.map(c => {
    const openRate  = c.recipients ? Math.round((c.opened  / c.recipients) * 100) : 0;
    const clickRate = c.recipients ? Math.round((c.clicked / c.recipients) * 100) : 0;
    const convRate  = c.recipients ? Math.round((c.converted / c.recipients) * 100) : 0;
    const typeColor = { feedback:'#d97706', weekly:'#0284c7', monthly:'#7c3aed' };
    const statusBadge = c.scheduled
      ? `<span class="camp-badge scheduled">📅 Scheduled</span>`
      : `<span class="camp-badge sent">✅ Sent</span>`;
    const autoBadge = c.autoGenerated
      ? `<span class="camp-badge auto-badge">⚡ Auto</span>` : '';
    const recipientLabel = c.recipients === 1
      ? `<i class="fa-solid fa-user" style="font-size:10px"></i> 1 recipient`
      : `<i class="fa-solid fa-users" style="font-size:10px"></i> ${c.recipients} recipients`;
    return `
    <div class="campaign-history-item">
      <div class="camp-icon ${c.scheduled ? 'scheduled' : c.type}">
        <i class="fa-solid ${c.scheduled ? 'fa-calendar-clock' : 'fa-paper-plane'}"></i>
      </div>
      <div class="camp-info">
        <div class="camp-name">
          ${escHtml(c.name)}
          <span class="camp-type-tag ${c.type}" style="background:${typeColor[c.type]||'#64748b'}18;color:${typeColor[c.type]||'#64748b'}">${EMAIL_TYPE_LABEL[c.type] || c.type}</span>
        </div>
        <div class="camp-meta">${escHtml(c.subject)}</div>
        <div class="camp-meta" style="margin-top:3px;opacity:0.7">📤 ${escHtml(c.sentAt||'—')} &nbsp;·&nbsp; ${recipientLabel}</div>
      </div>
      <div class="camp-badges">
        ${autoBadge}
        ${statusBadge}
        ${!c.scheduled ? `
          <span class="camp-badge completed">👁 ${openRate}%</span>
          <span class="camp-badge completed">🖱 ${clickRate}%</span>
          <span class="camp-badge sent">🛒 ${convRate}%</span>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}
function clearCampaignHistory() {
  if(!confirm('Clear all campaign & email history?')) return;
  campaignHistory = [];
  // Also clear auto-generated feedback records from history
  feedbackRecords.forEach(r => { r._historyClear = true; });
  renderCampaignHistory();
  updateEngStats();
  showToast('Email history cleared.');
}

// ── Schedule Modal ──
function openScheduleModal() {
  document.getElementById('schedDate').value = today();
  document.getElementById('scheduleModal').classList.add('active');
}
function closeScheduleModal() { document.getElementById('scheduleModal').classList.remove('active'); }
function saveScheduledCampaign() {
  const name     = document.getElementById('schedName').value.trim();
  const type     = document.getElementById('schedType').value;
  const template = document.getElementById('schedTemplate').value;
  const audience = document.getElementById('schedAudience').value;
  const date     = document.getElementById('schedDate').value;
  const time     = document.getElementById('schedTime').value;
  if(!name) { showToast('Campaign name required.','error'); return; }
  const tpl = ENGAGEMENT_TEMPLATES[template];
  let targets = [...customers];
  if(audience !== 'all') targets = targets.filter(c => c.status === audience);
  const camp = {
    id: genId(), name, type, subject: tpl ? tpl.subject : name,
    recipients: targets.length, sentAt: date + ' ' + time,
    templateKey: template, opened: 0, clicked: 0, converted: 0, scheduled: true
  };
  campaignHistory.unshift(camp);
  // Schedule feedback records
  targets.forEach(c => {
    feedbackRecords.push({
      id: genId(), customerId: c.id, name: c.name, email: c.email, company: c.company||'—',
      emailType: type, sentDate: null, scheduledDate: date,
      status: 'pending', rating: '', notes: `Scheduled campaign: ${name}`, autoGenerated: false
    });
  });
  logAction(`Campaign "${name}" scheduled for ${date} (${targets.length} recipients)`, 'fa-calendar-check', 'orange');
  showToast(`📅 Campaign scheduled for ${date}!`, 'success');
  closeScheduleModal();
  renderCampaignHistory();
  updateEngStats();
  renderFeedbackTable();
  updateFeedbackStats();
}

// Initialize engagement templates on feedback page load
(function patchNavigate() {
  const _orig = navigate;
  window.navigate = function(page) {
    _orig(page);
    if(page === 'feedback') {
      renderEngTemplates(currentEngTab);
      renderCampaignHistory();
      updateEngStats();
    }
  };
})();