import { useState, useEffect, useCallback } from 'react';
import { supabase, logAudit } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Users, DollarSign, Bell, Settings, LogOut, Check, X, Plus,
  RefreshCw, Copy, Download, ChevronDown, ChevronUp, Eye,
  Package, ShoppingCart, Image, Search, Filter
} from 'lucide-react';

export default function AdminPanel() {
  const { session, logout } = useAuth();
  const { event } = session;

  const [tab, setTab] = useState('overview');
  const [merchants, setMerchants] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventForm, setNewEventForm] = useState({ name: '', event_date: '', location: '', organizer_pin: '', min_merchant_pct: 20, max_merchant_pct: 50 });
  const [creatingEvent, setCreatingEvent] = useState(false);

  const fetchData = useCallback(async () => {
    const merchantRes = await supabase.from('fm_merchants').select('*').eq('event_id', event.id).order('created_at');
    const merchantIds = merchantRes.data?.map(m => m.id) || [];

    const [sRes, aRes, iRes] = await Promise.all([
      merchantIds.length
        ? supabase.from('fm_sales').select('*').eq('is_undone', false).in('merchant_id', merchantIds)
        : Promise.resolve({ data: [] }),
      supabase.from('fm_announcements').select('*').eq('event_id', event.id).order('created_at', { ascending: false }),
      merchantIds.length
        ? supabase.from('fm_items').select('*').in('merchant_id', merchantIds).order('name')
        : Promise.resolve({ data: [] }),
    ]);

    if (merchantRes.data) setMerchants(merchantRes.data);
    if (sRes.data) setAllSales(sRes.data);
    if (aRes.data) setAnnouncements(aRes.data);
    if (iRes.data) setAllItems(iRes.data);
    setLoading(false);
  }, [event.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approved = merchants.filter(m => m.status === 'approved');
  const pending = merchants.filter(m => m.status === 'pending');
  const totalRevenue = allSales.reduce((s, t) => s + parseFloat(t.total_price), 0);
  const totalOrgCut = merchants.reduce((s, m) => {
    const mSales = allSales.filter(t => t.merchant_id === m.id).reduce((a, t) => a + parseFloat(t.total_price), 0);
    return s + mSales * ((100 - m.merchant_pct) / 100);
  }, 0);

  const merchantRevenues = merchants.map(m => ({
    ...m,
    revenue: allSales.filter(t => t.merchant_id === m.id).reduce((a, t) => a + parseFloat(t.total_price), 0),
    txCount: allSales.filter(t => t.merchant_id === m.id).length,
  })).sort((a, b) => b.revenue - a.revenue);

  const revenueChartData = merchantRevenues.filter(m => m.revenue > 0).slice(0, 8).map(m => ({ name: m.shop_name, revenue: parseFloat(m.revenue.toFixed(2)) }));

  const updateStatus = async (merchantId, status) => {
    await supabase.from('fm_merchants').update({ status }).eq('id', merchantId);
    await logAudit(event.id, merchantId, `MERCHANT_${status.toUpperCase()}`);
    fetchData();
    toast.success(`Merchant ${status}`);
  };

  const [annMsg, setAnnMsg] = useState('');
  const sendAnnouncement = async () => {
    if (!annMsg.trim()) return;
    await supabase.from('fm_announcements').insert({ event_id: event.id, message: annMsg.trim() });
    setAnnMsg('');
    fetchData();
    toast.success('Announcement sent!');
  };

  const createEvent = async () => {
    if (!newEventForm.name || !newEventForm.event_date || !newEventForm.organizer_pin) { toast.error('Fill all required fields'); return; }
    setCreatingEvent(true);
    const { data, error } = await supabase.from('fm_events').insert({ ...newEventForm }).select().single();
    setCreatingEvent(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Event created! ID: ${data.id}`);
    setShowNewEvent(false);
    setNewEventForm({ name: '', event_date: '', location: '', organizer_pin: '', min_merchant_pct: 20, max_merchant_pct: 50 });
  };

  const exportCSV = () => {
    const rows = [['Merchant', 'Shop Name', 'Status', 'Split', 'Gross Revenue', 'Merchant Share', 'Organizer Cut', 'Transactions']];
    merchantRevenues.forEach(m => {
      const orgCut = m.revenue * ((100 - m.merchant_pct) / 100);
      const mShare = m.revenue * (m.merchant_pct / 100);
      rows.push([m.full_name, m.shop_name, m.status, `${m.merchant_pct}/${100 - m.merchant_pct}`, m.revenue.toFixed(2), mShare.toFixed(2), orgCut.toFixed(2), m.txCount]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${event.name.replace(/\s+/g, '_')}_report.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: 'overview',   label: 'Overview',       icon: DollarSign  },
    { id: 'merchants',  label: 'Merchants',       icon: Users       },
    { id: 'inventory',  label: 'Event Inventory', icon: Package     },
    { id: 'pos',        label: 'Organizer POS',   icon: ShoppingCart},
    { id: 'announcements', label: 'Announcements',icon: Bell        },
    { id: 'settings',   label: 'Settings',        icon: Settings    },
  ];

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
      <p>Loading…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', fontFamily: 'var(--font-display)' }}>Admin Panel</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{event.name} · {event.event_date}</div>
        </div>
        {pending.length > 0 && <span className="badge badge-yellow"><Bell size={11} /> {pending.length} pending</span>}
        <button className="btn btn-ghost btn-sm" onClick={fetchData}><RefreshCw size={14} /></button>
        <button className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={15} /></button>
      </header>

      {/* Tabs */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem',
            background: 'none', border: 'none',
            color: tab === t.id ? 'var(--accent)' : 'var(--text-3)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s',
          }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1200, width: '100%', margin: '0 auto' }}>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} /> Export CSV</button>
            </div>
            <div className="grid-4">
              <StatCard label="Total Revenue"       value={`₱${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--accent)" />
              <StatCard label="Organizer Earnings"  value={`₱${totalOrgCut.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}  color="var(--green)" />
              <StatCard label="Active Merchants"    value={approved.length}  color="var(--blue)" />
              <StatCard label="Pending Approvals"   value={pending.length}   color={pending.length > 0 ? 'var(--red)' : 'var(--text-3)'} />
            </div>

            {revenueChartData.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Revenue by Merchant</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} formatter={v => [`₱${v}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>Settlement Summary</h3>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Merchant</th><th>Shop</th><th>Split</th><th>Gross</th><th>Merchant Gets</th><th>You Get</th><th>Txns</th><th>Status</th></tr></thead>
                  <tbody>
                    {merchantRevenues.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontSize: '0.8125rem' }}>{m.full_name}</td>
                        <td style={{ fontWeight: 600 }}>{m.shop_name}</td>
                        <td><span className="badge badge-blue">{m.merchant_pct}/{100 - m.merchant_pct}</span></td>
                        <td style={{ fontWeight: 700 }}>₱{m.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: 'var(--green)' }}>₱{(m.revenue * m.merchant_pct / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>₱{(m.revenue * (100 - m.merchant_pct) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td>{m.txCount}</td>
                        <td><span className={`badge ${m.status === 'approved' ? 'badge-green' : m.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{m.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── MERCHANTS ── */}
        {tab === 'merchants' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Merchant Applications</h2>
            {merchants.length === 0 && <div className="empty-state card"><Users size={36} /><p>No merchants yet</p></div>}
            {merchants.map(m => (
              <MerchantCard key={m.id} merchant={m}
                onApprove={() => updateStatus(m.id, 'approved')}
                onReject={() => updateStatus(m.id, 'rejected')} />
            ))}
          </div>
        )}

        {/* ── EVENT INVENTORY ── */}
        {tab === 'inventory' && (
          <EventInventoryTab
            merchants={merchants}
            allItems={allItems}
            onRefresh={fetchData}
          />
        )}

        {/* ── ORGANIZER POS ── */}
        {tab === 'pos' && (
          <OrganizerPOSTab
            merchants={merchants}
            allItems={allItems}
            event={event}
            onSale={fetchData}
          />
        )}

        {/* ── ANNOUNCEMENTS ── */}
        {tab === 'announcements' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Broadcast to All Merchants</h3>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input placeholder="Type your announcement…" value={annMsg} onChange={e => setAnnMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAnnouncement()} style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={sendAnnouncement} disabled={!annMsg.trim()}><Bell size={14} /> Send</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {announcements.length === 0 && <div className="empty-state card"><Bell size={32} /><p>No announcements yet</p></div>}
              {announcements.map(a => (
                <div key={a.id} className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <Bell size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem' }}>{a.message}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{new Date(a.created_at).toLocaleString('en-PH')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Current Event</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingRow label="Event Name"        value={event.name} />
                <SettingRow label="Date"              value={event.event_date} />
                <SettingRow label="Location"          value={event.location || '—'} />
                <SettingRow label="Commission Range"  value={`Merchant ${event.min_merchant_pct}%–${event.max_merchant_pct}%`} />
                <div>
                  <div className="form-label" style={{ marginBottom: '0.4rem' }}>Event ID (share with merchants)</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code style={{ background: 'var(--bg-3)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', flex: 1, wordBreak: 'break-all' }}>{event.id}</code>
                    <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(event.id); toast.success('Copied!'); }}><Copy size={13} /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }} onClick={() => setShowNewEvent(s => !s)}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-2)', fontFamily: 'var(--font-display)' }}>Create New Event</h3>
                {showNewEvent ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {showNewEvent && (
                <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade">
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">Event Name *</label><input value={newEventForm.name} onChange={e => setNewEventForm(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Date *</label><input type="date" value={newEventForm.event_date} onChange={e => setNewEventForm(p => ({ ...p, event_date: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Location</label><input value={newEventForm.location} onChange={e => setNewEventForm(p => ({ ...p, location: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Organizer PIN *</label><input type="password" value={newEventForm.organizer_pin} onChange={e => setNewEventForm(p => ({ ...p, organizer_pin: e.target.value }))} /></div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group"><label className="form-label">Min Merchant %</label><input type="number" min={5} max={49} value={newEventForm.min_merchant_pct} onChange={e => setNewEventForm(p => ({ ...p, min_merchant_pct: parseInt(e.target.value) }))} /></div>
                    <div className="form-group"><label className="form-label">Max Merchant %</label><input type="number" min={6} max={95} value={newEventForm.max_merchant_pct} onChange={e => setNewEventForm(p => ({ ...p, max_merchant_pct: parseInt(e.target.value) }))} /></div>
                  </div>
                  <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={createEvent} disabled={creatingEvent}>
                    <Plus size={14} /> {creatingEvent ? 'Creating…' : 'Create Event'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── EVENT INVENTORY TAB ──────────────────────────────────────────────────────
function EventInventoryTab({ merchants, allItems, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterMerchant, setFilterMerchant] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const merchantMap = Object.fromEntries(merchants.map(m => [m.id, m]));

  const filtered = allItems.filter(item => {
    const merchant = merchantMap[item.merchant_id];
    const remaining = item.quantity - item.quantity_sold;
    const status = remaining <= 0 ? 'out' : remaining <= 2 ? 'low' : 'in';

    if (filterMerchant !== 'all' && item.merchant_id !== filterMerchant) return false;
    if (filterStatus === 'out' && status !== 'out') return false;
    if (filterStatus === 'low' && status !== 'low') return false;
    if (filterStatus === 'in' && status !== 'in') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return item.name.toLowerCase().includes(q) || merchant?.shop_name.toLowerCase().includes(q);
    }
    return true;
  });

  const totalItems = allItems.length;
  const outCount = allItems.filter(i => i.quantity - i.quantity_sold <= 0).length;
  const lowCount = allItems.filter(i => { const r = i.quantity - i.quantity_sold; return r > 0 && r <= 2; }).length;
  const totalStock = allItems.reduce((s, i) => s + (i.quantity - i.quantity_sold), 0);

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="grid-4">
        <StatCard label="Total SKUs"     value={totalItems}  color="var(--text)" />
        <StatCard label="Total Stock"    value={totalStock}  color="var(--blue)" />
        <StatCard label="Low Stock"      value={lowCount}    color="var(--accent)" />
        <StatCard label="Out of Stock"   value={outCount}    color={outCount > 0 ? 'var(--red)' : 'var(--text-3)'} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
          <input placeholder="Search items or merchants…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2rem' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Filter size={13} color="var(--text-3)" />
          <select value={filterMerchant} onChange={e => setFilterMerchant(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">All Merchants</option>
            {merchants.filter(m => m.status === 'approved').map(m => (
              <option key={m.id} value={m.id}>{m.shop_name}</option>
            ))}
          </select>
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All Statuses</option>
          <option value="in">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}><RefreshCw size={13} /></button>
      </div>

      {/* Inventory grid */}
      {filtered.length === 0 ? (
        <div className="empty-state card"><Package size={36} /><p>No items match your filters</p></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Item</th>
                  <th>Merchant</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Sold</th>
                  <th>Remaining</th>
                  <th>Revenue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const merchant = merchantMap[item.merchant_id];
                  const remaining = item.quantity - item.quantity_sold;
                  const status = remaining <= 0
                    ? { label: 'Out of Stock', cls: 'badge-red' }
                    : remaining <= 2
                    ? { label: 'Low Stock', cls: 'badge-yellow' }
                    : { label: 'In Stock', cls: 'badge-green' };
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.photo_url
                          ? <img src={item.photo_url} alt={item.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                          : <div style={{ width: 36, height: 36, background: 'var(--bg-4)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={14} color="var(--text-3)" /></div>
                        }
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{item.description}</div>}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{merchant?.shop_name || '—'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{merchant?.full_name}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>₱{parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td>{item.quantity}</td>
                      <td>{item.quantity_sold}</td>
                      <td style={{ fontWeight: 700, color: remaining <= 2 ? 'var(--red)' : 'inherit' }}>{remaining}</td>
                      <td>₱{(item.quantity_sold * item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-3)' }}>
            Showing {filtered.length} of {totalItems} items
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ORGANIZER POS TAB ────────────────────────────────────────────────────────
function OrganizerPOSTab({ merchants, allItems, event, onSale }) {
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  const approvedMerchants = merchants.filter(m => m.status === 'approved');
  const merchantMap = Object.fromEntries(merchants.map(m => [m.id, m]));

  const availableItems = allItems.filter(item => {
    const remaining = item.quantity - item.quantity_sold;
    if (remaining <= 0) return false;
    if (selectedMerchant !== 'all' && item.merchant_id !== selectedMerchant) return false;
    if (search.trim()) return item.name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      const maxQty = item.quantity - item.quantity_sold;
      if (existing) {
        if (existing.qty >= maxQty) { toast.error(`Only ${maxQty} left`); return prev; }
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c).filter(c => c.qty > 0));
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));

  // Group cart by merchant for display
  const cartByMerchant = cart.reduce((acc, c) => {
    const mid = c.merchant_id;
    if (!acc[mid]) acc[mid] = [];
    acc[mid].push(c);
    return acc;
  }, {});

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const handleCheckout = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      // Group by merchant and insert sales per merchant
      for (const [merchantId, items] of Object.entries(cartByMerchant)) {
        const salesRows = items.map(c => ({
          merchant_id: merchantId,
          item_id: c.id,
          item_name: c.name,
          quantity: c.qty,
          unit_price: c.price,
          total_price: c.price * c.qty,
          payment_method: payment,
        }));
        const { error } = await supabase.from('fm_sales').insert(salesRows);
        if (error) throw error;

        // Update inventory for each item
        for (const c of items) {
          await supabase.from('fm_items').update({ quantity_sold: c.quantity_sold + c.qty }).eq('id', c.id);
        }

        await logAudit(event.id, merchantId, 'ORGANIZER_SALE', {
          items: items.length,
          total: items.reduce((s, c) => s + c.price * c.qty, 0),
        });
      }

      setLastSale({ items: [...cart], total: cartTotal, payment, merchantCount: Object.keys(cartByMerchant).length });
      setCart([]);
      toast.success('Sale recorded!');
      onSale();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Info banner */}
      <div style={{ padding: '0.75rem 1rem', background: 'var(--blue-dim)', border: '1px solid rgba(90,156,240,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ShoppingCart size={14} />
        Selling on behalf of merchants — sales will be attributed to each item's respective merchant and split applied automatically.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: item browser */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2rem' }} />
            </div>
            <select value={selectedMerchant} onChange={e => setSelectedMerchant(e.target.value)} style={{ width: 'auto' }}>
              <option value="all">All Merchants</option>
              {approvedMerchants.map(m => (
                <option key={m.id} value={m.id}>{m.shop_name}</option>
              ))}
            </select>
          </div>

          {/* Items grid */}
          {availableItems.length === 0 ? (
            <div className="empty-state card"><Package size={36} /><p>No items available</p></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {availableItems.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                const remaining = item.quantity - item.quantity_sold;
                const merchant = merchantMap[item.merchant_id];
                return (
                  <button key={item.id} onClick={() => addToCart(item)} style={{
                    background: inCart ? 'var(--accent-dim)' : 'var(--bg-2)',
                    border: `1px solid ${inCart ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', padding: 0, textAlign: 'left',
                    cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}
                    onMouseEnter={e => { if (!inCart) e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                    onMouseLeave={e => { if (!inCart) e.currentTarget.style.borderColor = 'var(--border)'; }}>
                    {/* Photo */}
                    <div style={{ width: '100%', height: 100, background: 'var(--bg-3)', position: 'relative', overflow: 'hidden' }}>
                      {item.photo_url
                        ? <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={24} color="var(--text-3)" style={{ opacity: 0.3 }} /></div>
                      }
                      {inCart && (
                        <div style={{ position: 'absolute', top: 5, right: 5, background: 'var(--accent)', color: '#000', borderRadius: 99, fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.4rem' }}>×{inCart.qty}</div>
                      )}
                      {remaining <= 2 && (
                        <div style={{ position: 'absolute', top: 5, left: 5, background: 'var(--red)', color: '#fff', borderRadius: 99, fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem' }}>{remaining} left</div>
                      )}
                    </div>
                    <div style={{ padding: '0.6rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>₱{parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{merchant?.shop_name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: cart */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Current Sale</h2>

            {cart.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}><ShoppingCart size={28} /><p style={{ fontSize: '0.8125rem' }}>Tap items to add</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 340, overflowY: 'auto' }}>
                {/* Grouped by merchant */}
                {Object.entries(cartByMerchant).map(([merchantId, items]) => {
                  const merchant = merchantMap[merchantId];
                  const subtotal = items.reduce((s, c) => s + c.price * c.qty, 0);
                  return (
                    <div key={merchantId}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.2rem 0', borderBottom: '1px solid var(--border)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{merchant?.shop_name || 'Unknown'}</span>
                        <span style={{ color: 'var(--text-2)' }}>₱{subtotal.toFixed(2)}</span>
                      </div>
                      {items.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0' }}>
                          {c.photo_url
                            ? <img src={c.photo_url} alt={c.name} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--bg-4)', flexShrink: 0 }} />
                          }
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>₱{parseFloat(c.price).toFixed(2)}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '0.15rem 0.35rem' }} onClick={() => updateQty(c.id, -1)}>−</button>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{c.qty}</span>
                            <button className="btn btn-ghost btn-sm" style={{ padding: '0.15rem 0.35rem' }} onClick={() => updateQty(c.id, 1)}>+</button>
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)', minWidth: 52, textAlign: 'right' }}>₱{(c.price * c.qty).toFixed(2)}</span>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', padding: '0.15rem' }} onClick={() => removeFromCart(c.id)}><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="divider" style={{ margin: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Total</div>
                {Object.keys(cartByMerchant).length > 1 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{Object.keys(cartByMerchant).length} merchants</div>
                )}
              </div>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                ₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select value={payment} onChange={e => setPayment(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="other">Other (GCash, etc.)</option>
              </select>
            </div>

            <button className="btn btn-primary btn-full btn-lg" onClick={handleCheckout} disabled={!cart.length || submitting}>
              {submitting ? 'Processing…' : <><Check size={18} /> Confirm Sale</>}
            </button>
            {cart.length > 0 && <button className="btn btn-ghost btn-sm btn-full" onClick={() => setCart([])}>Clear cart</button>}
          </div>

          {/* Last sale receipt */}
          {lastSale && (
            <div className="card animate-fade" style={{ marginTop: '1rem', border: '1px solid var(--green)', background: 'var(--green-dim)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>LAST SALE</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: '0.1rem' }} onClick={() => setLastSale(null)}><X size={12} /></button>
              </div>
              {lastSale.items.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '0.2rem' }}>
                  <span>{c.name} × {c.qty}</span><span>₱{(c.price * c.qty).toFixed(2)}</span>
                </div>
              ))}
              <div className="divider" style={{ margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--green)' }}>
                <span>Total</span><span>₱{lastSale.total.toFixed(2)}</span>
              </div>
              {lastSale.merchantCount > 1 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.4rem' }}>Split across {lastSale.merchantCount} merchants</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function MerchantCard({ merchant, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)' }}>{merchant.shop_name}</span>
            <span className={`badge ${merchant.status === 'approved' ? 'badge-green' : merchant.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{merchant.status}</span>
            <span className="badge badge-blue">{merchant.merchant_pct}% merchant</span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>{merchant.full_name}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(s => !s)}><Eye size={14} /></button>
        {merchant.status === 'pending' && <>
          <button className="btn btn-primary btn-sm" onClick={onApprove}><Check size={13} /> Approve</button>
          <button className="btn btn-danger btn-sm" onClick={onReject}><X size={13} /> Reject</button>
        </>}
        {merchant.status === 'approved' && <button className="btn btn-danger btn-sm" onClick={onReject}><X size={13} /> Revoke</button>}
        {merchant.status === 'rejected' && <button className="btn btn-primary btn-sm" onClick={onApprove}><Check size={13} /> Re-approve</button>}
      </div>
      {expanded && (
        <div className="animate-fade" style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-2)' }}>
          {merchant.description && <p style={{ marginBottom: '0.5rem' }}>{merchant.description}</p>}
          <p style={{ color: 'var(--text-3)' }}>Registered: {new Date(merchant.created_at).toLocaleString('en-PH')}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

function SettingRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
