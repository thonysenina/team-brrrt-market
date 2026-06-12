import { useState, useEffect, useCallback } from 'react';
import { supabase, logAudit } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  Users, DollarSign, Bell, Settings, LogOut, Check, X, Plus,
  RefreshCw, Copy, Download, ChevronDown, ChevronUp, Eye
} from 'lucide-react';

export default function AdminPanel() {
  const { session, logout } = useAuth();
  const { event } = session;

  const [tab, setTab] = useState('overview');
  const [merchants, setMerchants] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // New event form
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEventForm, setNewEventForm] = useState({ name: '', event_date: '', location: '', organizer_pin: '', min_merchant_pct: 20, max_merchant_pct: 50 });
  const [creatingEvent, setCreatingEvent] = useState(false);

  const fetchData = useCallback(async () => {
    const [mRes, sRes, aRes] = await Promise.all([
      supabase.from('fm_merchants').select('*').eq('event_id', event.id).order('created_at'),
      supabase.from('fm_sales').select('*').eq('is_undone', false).in('merchant_id',
        (await supabase.from('fm_merchants').select('id').eq('event_id', event.id)).data?.map(m => m.id) || []
      ),
      supabase.from('fm_announcements').select('*').eq('event_id', event.id).order('created_at', { ascending: false }),
    ]);
    if (mRes.data) setMerchants(mRes.data);
    if (sRes.data) setAllSales(sRes.data);
    if (aRes.data) setAnnouncements(aRes.data);
    setLoading(false);
  }, [event.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived stats
  const approved = merchants.filter(m => m.status === 'approved');
  const pending = merchants.filter(m => m.status === 'pending');
  const totalRevenue = allSales.reduce((s, t) => s + parseFloat(t.total_price), 0);
  const totalOrgCut = merchants.reduce((s, m) => {
    const mSales = allSales.filter(t => t.merchant_id === m.id).reduce((a, t) => a + parseFloat(t.total_price), 0);
    return s + mSales * ((100 - m.merchant_pct) / 100);
  }, 0);

  // Per-merchant revenue
  const merchantRevenues = merchants.map(m => ({
    ...m,
    revenue: allSales.filter(t => t.merchant_id === m.id).reduce((a, t) => a + parseFloat(t.total_price), 0),
    txCount: allSales.filter(t => t.merchant_id === m.id).length,
  })).sort((a, b) => b.revenue - a.revenue);

  // Revenue chart (by merchant)
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
    { id: 'overview', label: 'Overview', icon: DollarSign },
    { id: 'merchants', label: 'Merchants', icon: Users },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}><p>Loading…</p></div>;

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
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', gap: '0.25rem' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem', background: 'none', border: 'none', color: tab === t.id ? 'var(--accent)' : 'var(--text-3)', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1100, width: '100%', margin: '0 auto' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} /> Export CSV</button>
            </div>

            <div className="grid-4">
              <StatCard label="Total Revenue" value={`₱${totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--accent)" />
              <StatCard label="Organizer Earnings" value={`₱${totalOrgCut.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--green)" />
              <StatCard label="Active Merchants" value={approved.length} color="var(--blue)" />
              <StatCard label="Pending Approvals" value={pending.length} color={pending.length > 0 ? 'var(--red)' : 'var(--text-3)'} />
            </div>

            {/* Revenue chart */}
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

            {/* Settlement table */}
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

        {/* MERCHANTS */}
        {tab === 'merchants' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Merchant Applications</h2>

            {merchants.length === 0 && <div className="empty-state card"><Users size={36} /><p>No merchants yet</p></div>}

            {merchants.map(m => (
              <MerchantCard key={m.id} merchant={m} onApprove={() => updateStatus(m.id, 'approved')} onReject={() => updateStatus(m.id, 'rejected')} />
            ))}
          </div>
        )}

        {/* ANNOUNCEMENTS */}
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

        {/* SETTINGS */}
        {tab === 'settings' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Event ID copy */}
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Current Event</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SettingRow label="Event Name" value={event.name} />
                <SettingRow label="Date" value={event.event_date} />
                <SettingRow label="Location" value={event.location || '—'} />
                <SettingRow label="Commission Range" value={`Merchant ${event.min_merchant_pct}%–${event.max_merchant_pct}%`} />
                <div>
                  <div className="form-label" style={{ marginBottom: '0.4rem' }}>Event ID (share with merchants)</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <code style={{ background: 'var(--bg-3)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', flex: 1, wordBreak: 'break-all' }}>{event.id}</code>
                    <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(event.id); toast.success('Copied!'); }}><Copy size={13} /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Create new event */}
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
                    <div className="form-group"><label className="form-label">Min Merchant % (default 20)</label><input type="number" min={5} max={49} value={newEventForm.min_merchant_pct} onChange={e => setNewEventForm(p => ({ ...p, min_merchant_pct: parseInt(e.target.value) }))} /></div>
                    <div className="form-group"><label className="form-label">Max Merchant % (default 50)</label><input type="number" min={6} max={95} value={newEventForm.max_merchant_pct} onChange={e => setNewEventForm(p => ({ ...p, max_merchant_pct: parseInt(e.target.value) }))} /></div>
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
        {merchant.status === 'pending' && (
          <>
            <button className="btn btn-primary btn-sm" onClick={onApprove}><Check size={13} /> Approve</button>
            <button className="btn btn-danger btn-sm" onClick={onReject}><X size={13} /> Reject</button>
          </>
        )}
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
