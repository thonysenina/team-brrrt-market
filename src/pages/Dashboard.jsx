import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, logAudit, uploadItemPhoto, deleteItemPhoto, prepareImageFile } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  ShoppingCart, Package, TrendingUp, AlertTriangle, Bell, LogOut, Plus, Trash2,
  Edit2, Check, X, RefreshCw, DollarSign, Archive, Zap, Image, Upload,
  Sun, Moon, Printer, ArrowUpDown, RotateCcw, BarChart2
} from 'lucide-react';
import ImageLightbox, { LightboxTrigger } from '../components/shared/ImageLightbox';

const AUTO_REFRESH_INTERVAL = 60000; // 60 seconds

export default function Dashboard() {
  const { session, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { merchantId, merchant, eventId } = session;

  const [tab, setTab] = useState('overview');
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [showEOD, setShowEOD] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(l => items.length === 0 ? true : l);
    const [itemsRes, salesRes, annRes] = await Promise.all([
      supabase.from('fm_items').select('*').eq('merchant_id', merchantId).order('name'),
      supabase.from('fm_sales').select('*').eq('merchant_id', merchantId).eq('is_undone', false).order('sold_at', { ascending: false }),
      supabase.from('fm_announcements').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(5),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (salesRes.data) setSales(salesRes.data);
    if (annRes.data) setAnnouncements(annRes.data);
    setLoading(false);
    setLastRefreshed(new Date());
  }, [merchantId, eventId]);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Lightbox listener
  useEffect(() => {
    const handler = (e) => setLightbox({ src: e.detail.src, alt: e.detail.alt });
    document.addEventListener('open-lightbox', handler);
    return () => document.removeEventListener('open-lightbox', handler);
  }, []);

  const grossRevenue = sales.reduce((s, t) => s + parseFloat(t.total_price), 0);
  const totalUnitsSold = sales.reduce((s, t) => s + t.quantity, 0);
  const outOfStock = items.filter(i => i.quantity - i.quantity_sold <= 0);
  const lowStock = items.filter(i => { const rem = i.quantity - i.quantity_sold; return i.quantity > 2 && rem > 0 && rem <= 2; });
  const topItems = [...items].sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 5);
  const zeroSales = items.filter(i => i.quantity_sold === 0 && i.quantity > 0);

  const hourlyData = (() => {
    const map = {};
    sales.forEach(s => {
      const h = new Date(s.sold_at).getHours();
      const label = `${h}:00`;
      map[label] = (map[label] || 0) + parseFloat(s.total_price);
    });
    return Object.entries(map).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([hour, revenue]) => ({ hour, revenue: parseFloat(revenue.toFixed(2)) }));
  })();

  const tabs = [
    { id: 'overview',  label: 'Overview',        icon: TrendingUp  },
    { id: 'pos',       label: 'Point of Sale',    icon: ShoppingCart},
    { id: 'inventory', label: 'Inventory',        icon: Package     },
    { id: 'sales',     label: 'Sales Log',        icon: DollarSign  },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <ShoppingCart size={20} color="var(--accent)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{merchant.shop_name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{session.eventName}</div>
          </div>
        </div>
        {announcements.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 99, fontSize: '0.75rem', color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => toast(announcements[0].message, { icon: '📢', duration: 6000 })}>
            <Bell size={13} /> {announcements.length} announcement{announcements.length > 1 ? 's' : ''}
          </div>
        )}
        {lastRefreshed && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
            Updated {lastRefreshed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowEOD(true)} title="End-of-Day Summary"><BarChart2 size={15} /></button>
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
        <button className="btn btn-ghost btn-sm" onClick={logout}><LogOut size={15} /></button>
      </header>

      {/* Tab bar */}
      <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1rem',
            background: 'none', border: 'none', color: tab === t.id ? 'var(--accent)' : 'var(--text-3)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s',
          }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={() => fetchData()} style={{ marginLeft: 'auto', alignSelf: 'center' }} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1100, width: '100%', margin: '0 auto' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">
            {(outOfStock.length > 0 || lowStock.length > 0 || zeroSales.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {outOfStock.map(i => <Alert key={i.id} type="red" icon={<Archive size={14} />} message={<><strong>{i.name}</strong> is out of stock</>} />)}
                {lowStock.map(i => <Alert key={i.id} type="yellow" icon={<AlertTriangle size={14} />} message={<><strong>{i.name}</strong> — only {i.quantity - i.quantity_sold} left</>} />)}
                {zeroSales.length > 0 && <Alert type="blue" icon={<Zap size={14} />} message={<>{zeroSales.length} item{zeroSales.length > 1 ? 's have' : ' has'} 0 sales — consider adjusting pricing or display</>} />}
              </div>
            )}

            <div className="grid-2">
              <StatCard label="Gross Revenue" value={`₱${grossRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--accent)" sub={`${sales.length} transaction${sales.length !== 1 ? 's' : ''}`} />
              <StatCard label="Total Items Sold" value={totalUnitsSold} color="var(--blue)" sub="Units across all transactions" />
            </div>

            <div className="grid-2">
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Revenue by Hour</h3>
                {hourlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="hour" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' }} formatter={v => [`₱${v}`, 'Revenue']} />
                      <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="empty-state" style={{ padding: '2rem' }}>No sales yet</div>}
              </div>

              <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Top Selling Items</h3>
                {topItems.filter(i => i.quantity_sold > 0).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {topItems.filter(i => i.quantity_sold > 0).map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {item.photo_url ? (
                          <LightboxTrigger src={item.photo_url} alt={item.name}>
                            <img src={item.photo_url} alt={item.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          </LightboxTrigger>
                        ) : (
                          <span style={{ width: 32, height: 32, borderRadius: 6, background: idx === 0 ? 'var(--accent-dim)' : 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: idx === 0 ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }}>{idx + 1}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{item.quantity_sold} sold · ₱{(item.quantity_sold * item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div style={{ width: 60, height: 6, background: 'var(--bg-4)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 99, width: `${Math.min(100, (item.quantity_sold / (topItems[0]?.quantity_sold || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state" style={{ padding: '2rem' }}>No sales yet</div>}
              </div>
            </div>

            {/* Inventory snapshot */}
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Inventory Snapshot</h3>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Photo</th><th>Item</th><th>Price</th><th>Stock</th><th>Sold</th><th>Revenue</th><th>Status</th></tr></thead>
                  <tbody>
                    {items.map(item => {
                      const remaining = item.quantity - item.quantity_sold;
                      const status = remaining <= 0 ? { label: 'Out of Stock', cls: 'badge-red' } : (item.quantity > 2 && remaining <= 2) ? { label: 'Low Stock', cls: 'badge-yellow' } : { label: 'In Stock', cls: 'badge-green' };
                      return (
                        <tr key={item.id}>
                          <td>
                            {item.photo_url
                              ? <LightboxTrigger src={item.photo_url} alt={item.name}><img src={item.photo_url} alt={item.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, display: 'block' }} /></LightboxTrigger>
                              : <div style={{ width: 36, height: 36, background: 'var(--bg-4)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={14} color="var(--text-3)" /></div>
                            }
                          </td>
                          <td style={{ fontWeight: 500, color: 'var(--text)' }}>{item.name}</td>
                          <td>₱{parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          <td>{remaining}</td>
                          <td>{item.quantity_sold}</td>
                          <td>₱{(item.quantity_sold * item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                          <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'pos' && <POSTab items={items} merchantId={merchantId} merchant={merchant} onSale={fetchData} />}
        {tab === 'inventory' && <InventoryTab items={items} merchantId={merchantId} onUpdate={fetchData} />}
        {tab === 'sales' && <SalesLogTab sales={sales} merchantId={merchantId} merchant={merchant} onUpdate={fetchData} />}

      </main>

      {/* End-of-Day Summary Modal */}
      {showEOD && (
        <EODModal
          sales={sales}
          items={items}
          merchant={merchant}
          grossRevenue={grossRevenue}
          totalUnitsSold={totalUnitsSold}
          topItems={topItems}
          onClose={() => setShowEOD(false)}
        />
      )}

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ─── END-OF-DAY MODAL ─────────────────────────────────────────────────────────
function EODModal({ sales, items, merchant, grossRevenue, totalUnitsSold, topItems, onClose }) {
  const outOfStock = items.filter(i => i.quantity - i.quantity_sold <= 0).length;
  const peakHour = (() => {
    const map = {};
    sales.forEach(s => {
      const h = new Date(s.sold_at).getHours();
      map[h] = (map[h] || 0) + parseFloat(s.total_price);
    });
    const peak = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return peak ? `${peak[0]}:00` : '—';
  })();

  const exportCSV = () => {
    const rows = [['Time', 'Item', 'Qty', 'Unit Price', 'Total', 'Payment']];
    sales.forEach(s => {
      rows.push([
        new Date(s.sold_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
        s.item_name, s.quantity, s.unit_price, s.total_price, s.payment_method
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${merchant.shop_name.replace(/\s+/g, '_')}_sales.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.1rem' }}>End-of-Day Summary</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginTop: 2 }}>{merchant.shop_name}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Key stats */}
          <div className="grid-2">
            <div className="stat-card">
              <div className="stat-label">Gross Revenue</div>
              <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.5rem' }}>₱{grossRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Units Sold</div>
              <div className="stat-value" style={{ color: 'var(--blue)', fontSize: '1.5rem' }}>{totalUnitsSold}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Transactions</div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>{sales.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Peak Hour</div>
              <div className="stat-value" style={{ color: 'var(--green)', fontSize: '1.5rem' }}>{peakHour}</div>
            </div>
          </div>

          {/* Out of stock count */}
          {outOfStock > 0 && (
            <div style={{ padding: '0.75rem', background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(240,90,90,0.2)', fontSize: '0.875rem', color: 'var(--red)' }}>
              ⚠️ {outOfStock} item{outOfStock > 1 ? 's' : ''} sold out today
            </div>
          )}

          {/* Top 3 items */}
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.75rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Performers</div>
            {topItems.filter(i => i.quantity_sold > 0).slice(0, 3).length === 0
              ? <p style={{ fontSize: '0.875rem', color: 'var(--text-3)' }}>No sales recorded</p>
              : topItems.filter(i => i.quantity_sold > 0).slice(0, 3).map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: idx === 0 ? 'var(--accent-dim)' : 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: idx === 0 ? 'var(--accent)' : 'var(--text-3)' }}>{idx + 1}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--accent)' }}>₱{(item.quantity_sold * item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{item.quantity_sold} sold</div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><DollarSign size={13} /> Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13} /> Print</button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── POS TAB ──────────────────────────────────────────────────────────────────
function POSTab({ items, merchantId, merchant, onSale }) {
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  const available = items.filter(i => i.quantity - i.quantity_sold > 0);

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
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const handleCheckout = async () => {
    if (!cart.length) return;
    setSubmitting(true);
    try {
      const salesRows = cart.map(c => ({
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
      for (const c of cart) {
        await supabase.from('fm_items').update({ quantity_sold: c.quantity_sold + c.qty }).eq('id', c.id);
      }
      await logAudit(merchant.event_id, merchantId, 'SALE', { items: cart.length, total: cartTotal });
      setLastSale({ items: [...cart], total: cartTotal, payment, time: new Date() });
      setCart([]);
      toast.success('Sale recorded!');
      onSale(true);
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
    setSubmitting(false);
  };

  const printReceipt = (sale) => {
    const win = window.open('', '_blank', 'width=320,height=500');
    win.document.write(`
      <html><head><title>Receipt</title><style>
        body { font-family: monospace; font-size: 13px; padding: 1rem; max-width: 280px; margin: 0 auto; }
        h2 { font-size: 16px; margin-bottom: 4px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .total { font-weight: bold; font-size: 15px; }
        .footer { text-align: center; margin-top: 12px; font-size: 11px; color: #666; }
      </style></head><body>
        <h2>${merchant.shop_name}</h2>
        <div style="font-size:11px;color:#666">${sale.time.toLocaleString('en-PH')}</div>
        <div class="divider"></div>
        ${sale.items.map(c => `<div class="row"><span>${c.name} × ${c.qty}</span><span>₱${(c.price * c.qty).toFixed(2)}</span></div>`).join('')}
        <div class="divider"></div>
        <div class="row total"><span>TOTAL</span><span>₱${sale.total.toFixed(2)}</span></div>
        <div class="row"><span>Payment</span><span>${sale.payment}</span></div>
        <div class="footer">Thank you!</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }} className="animate-fade">
      <div>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Available Items</h2>
        {available.length === 0 ? (
          <div className="empty-state card"><Archive size={36} /><p>No items in stock</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem' }}>
            {available.map(item => {
              const inCart = cart.find(c => c.id === item.id);
              const remaining = item.quantity - item.quantity_sold;
              return (
                <button key={item.id} onClick={() => addToCart(item)} style={{
                  background: inCart ? 'var(--accent-dim)' : 'var(--bg-2)',
                  border: `1px solid ${inCart ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', padding: 0, textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
                  onMouseEnter={e => { if (!inCart) e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                  onMouseLeave={e => { if (!inCart) e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <div style={{ width: '100%', height: 110, background: 'var(--bg-3)', position: 'relative', overflow: 'hidden' }}>
                    {item.photo_url ? (
                      <LightboxTrigger src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%' }}>
                        <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </LightboxTrigger>
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Image size={28} color="var(--text-3)" style={{ opacity: 0.4 }} />
                      </div>
                    )}
                    {inCart && <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent)', color: '#000', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', fontFamily: 'var(--font-display)' }}>×{inCart.qty}</div>}
                    {(item.quantity > 2 && remaining <= 2) && <div style={{ position: 'absolute', top: 6, left: 6, background: 'var(--red)', color: '#fff', borderRadius: 99, fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.45rem' }}>{remaining} left</div>}
                  </div>
                  <div style={{ padding: '0.65rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>₱{parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                    {remaining > 2 && <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{remaining} in stock</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart */}
      <div style={{ position: 'sticky', top: 80 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Current Sale</h2>
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><ShoppingCart size={28} /><p style={{ fontSize: '0.8125rem' }}>Tap items to add</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 280, overflowY: 'auto' }}>
              {cart.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-3)', borderRadius: 8 }}>
                  {c.photo_url
                    ? <img src={c.photo_url} alt={c.name} style={{ width: 32, height: 32, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 32, height: 32, borderRadius: 5, background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Image size={13} color="var(--text-3)" /></div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>₱{parseFloat(c.price).toFixed(2)} each</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '1rem' }} onClick={() => updateQty(c.id, -1)}>−</button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: 20, textAlign: 'center', color: 'var(--text)' }}>{c.qty}</span>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '1rem' }} onClick={() => updateQty(c.id, 1)}>+</button>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: 60, textAlign: 'right', color: 'var(--accent)' }}>₱{(c.price * c.qty).toFixed(2)}</div>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', padding: '0.2rem' }} onClick={() => removeFromCart(c.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="divider" style={{ margin: 0 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Total</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>₱{cartTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
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

        {lastSale && (
          <div className="card animate-fade" style={{ marginTop: '1rem', border: '1px solid var(--green)', background: 'var(--green-dim)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>LAST SALE</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button className="btn btn-ghost btn-sm" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', color: 'var(--text-3)' }} onClick={() => printReceipt(lastSale)} title="Print receipt"><Printer size={12} /></button>
                <button className="btn btn-ghost btn-sm" style={{ padding: '0.1rem' }} onClick={() => setLastSale(null)}><X size={12} /></button>
              </div>
            </div>
            {lastSale.items.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                <span>{c.name} × {c.qty}</span><span>₱{(c.price * c.qty).toFixed(2)}</span>
              </div>
            ))}
            <div className="divider" style={{ margin: '0.5rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--green)' }}>
              <span>Total</span><span>₱{lastSale.total.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INVENTORY TAB ────────────────────────────────────────────────────────────
function InventoryTab({ items, merchantId, onUpdate }) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', quantity: '' });
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // name | price | remaining | sold
  const [sortDir, setSortDir] = useState('asc');
  const newPhotoRef = useRef();
  const editPhotoRef = useRef();

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const sortedItems = [...items].sort((a, b) => {
    let va, vb;
    if (sortBy === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
    else if (sortBy === 'price') { va = a.price; vb = b.price; }
    else if (sortBy === 'remaining') { va = a.quantity - a.quantity_sold; vb = b.quantity - b.quantity_sold; }
    else if (sortBy === 'sold') { va = a.quantity_sold; vb = b.quantity_sold; }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortBtn = ({ field, label }) => (
    <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', color: sortBy === field ? 'var(--accent)' : 'var(--text-3)', padding: '0.3rem 0.5rem' }} onClick={() => toggleSort(field)}>
      {label} <ArrowUpDown size={11} style={{ opacity: sortBy === field ? 1 : 0.4 }} />
    </button>
  );

  const handleNewPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10MB'); return; }
    setNewPhotoPreview('loading');
    try {
      const { file: prepared, previewUrl } = await prepareImageFile(file);
      setNewPhotoFile(prepared);
      setNewPhotoPreview(previewUrl);
    } catch (err) {
      console.error('[photo] handleNewPhoto error:', err);
      toast.error('Could not load photo — try a different image');
      setNewPhotoPreview(null);
    }
  };

  const handleEditPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10MB'); return; }
    setEditPhotoPreview('loading');
    try {
      const { file: prepared, previewUrl } = await prepareImageFile(file);
      setEditPhotoFile(prepared);
      setEditPhotoPreview(previewUrl);
    } catch (err) {
      console.error('[photo] handleEditPhoto error:', err);
      toast.error('Could not load photo — try a different image');
      setEditPhotoPreview(null);
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setEditData({ name: item.name, description: item.description || '', price: item.price, quantity: item.quantity, photo_url: item.photo_url || '' });
    setEditPhotoFile(null); setEditPhotoPreview(null);
  };

  const saveEdit = async () => {
    setSaving(true);
    let photo_url = editData.photo_url;
    if (editPhotoFile) {
      if (editData.photo_url) await deleteItemPhoto(editData.photo_url);
      const url = await uploadItemPhoto(editPhotoFile, merchantId);
      if (url) photo_url = url;
      else { toast.error('Photo upload failed'); setSaving(false); return; }
    }
    await supabase.from('fm_items').update({ name: editData.name, description: editData.description, price: parseFloat(editData.price), quantity: parseInt(editData.quantity), photo_url }).eq('id', editId);
    setEditId(null); setEditPhotoFile(null); setEditPhotoPreview(null);
    setSaving(false); onUpdate(); toast.success('Item updated');
  };

  const deleteItem = async (item) => {
    if (!window.confirm('Delete this item?')) return;
    if (item.photo_url) await deleteItemPhoto(item.photo_url);
    await supabase.from('fm_items').delete().eq('id', item.id);
    onUpdate(); toast.success('Item removed');
  };

  const removePhoto = async (item) => {
    if (!window.confirm('Remove this photo?')) return;
    await deleteItemPhoto(item.photo_url);
    await supabase.from('fm_items').update({ photo_url: null }).eq('id', item.id);
    onUpdate(); toast.success('Photo removed');
  };

  const addItem = async () => {
    if (!newItem.name || !newItem.price || !newItem.quantity) { toast.error('Name, price and quantity are required'); return; }
    setSaving(true);
    let photo_url = null;
    if (newPhotoFile) {
      photo_url = await uploadItemPhoto(newPhotoFile, merchantId);
      if (!photo_url) { toast.error('Photo upload failed'); setSaving(false); return; }
    }
    await supabase.from('fm_items').insert({ merchant_id: merchantId, name: newItem.name.trim(), description: newItem.description.trim(), price: parseFloat(newItem.price), quantity: parseInt(newItem.quantity), quantity_sold: 0, photo_url });
    setNewItem({ name: '', description: '', price: '', quantity: '' });
    setNewPhotoFile(null); setNewPhotoPreview(null); setShowAdd(false);
    setSaving(false); onUpdate(); toast.success('Item added');
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Manage Inventory</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Sort:</span>
          <SortBtn field="name" label="Name" />
          <SortBtn field="price" label="Price" />
          <SortBtn field="remaining" label="Stock" />
          <SortBtn field="sold" label="Sold" />
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}><Plus size={14} /> Add Item</button>
        </div>
      </div>

      {showAdd && (
        <div className="card animate-fade" style={{ borderColor: 'var(--accent-border)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>New Item</h3>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <div onClick={() => newPhotoRef.current.click()} style={{ width: 120, height: 120, borderRadius: 'var(--radius-sm)', border: `2px dashed ${newPhotoPreview ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                {newPhotoPreview === 'loading' ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: 'var(--text-3)' }}><div className="animate-pulse" style={{ fontSize: '1.4rem' }}>⏳</div><span style={{ fontSize: '0.7rem' }}>Processing…</span></div> : newPhotoPreview ? <img src={newPhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: 'var(--text-3)' }}><Upload size={22} /><span style={{ fontSize: '0.7rem' }}>Upload photo</span></div>}
              </div>
              <input ref={newPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleNewPhoto} />
              {newPhotoPreview && <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem', color: 'var(--red)' }} onClick={() => { setNewPhotoFile(null); setNewPhotoPreview(null); }}>Remove</button>}
              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Optional · max 10MB</span>
            </div>
            <div style={{ flex: 1, minWidth: 240, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Name *</label><input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Description</label><input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Price (₱) *</label><input type="number" min="0.01" step="0.01" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Quantity *</label><input type="number" min="1" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} /></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn btn-primary btn-sm" onClick={addItem} disabled={saving}>{saving ? 'Saving…' : <><Check size={14} /> Save Item</>}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowAdd(false); setNewPhotoFile(null); setNewPhotoPreview(null); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
        {sortedItems.map(item => {
          const remaining = item.quantity - item.quantity_sold;
          const status = remaining <= 0 ? { label: 'Out of Stock', cls: 'badge-red' } : (item.quantity > 2 && remaining <= 2) ? { label: 'Low Stock', cls: 'badge-yellow' } : { label: 'In Stock', cls: 'badge-green' };
          const isEditing = editId === item.id;
          return (
            <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden', border: isEditing ? '1px solid var(--accent-border)' : '1px solid var(--border)' }}>
              <div style={{ width: '100%', height: 160, background: 'var(--bg-3)', position: 'relative', overflow: 'hidden' }}>
                {(isEditing ? (editPhotoPreview || editData.photo_url) : item.photo_url)
                  ? (isEditing
                      ? <img src={editPhotoPreview || editData.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <LightboxTrigger src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%' }}>
                          <img src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </LightboxTrigger>
                    )
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={32} color="var(--text-3)" style={{ opacity: 0.3 }} /></div>
                }
                {isEditing && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => editPhotoRef.current.click()}><Upload size={13} /> Change</button>
                    {(editPhotoPreview || editData.photo_url) && <button className="btn btn-danger btn-sm" onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(null); setEditData(p => ({ ...p, photo_url: '' })); }}><Trash2 size={13} /> Remove</button>}
                    <input ref={editPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleEditPhoto} />
                  </div>
                )}
                {!isEditing && item.photo_url && (
                  <button onClick={() => removePhoto(item)} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 6, padding: '0.25rem 0.4rem', cursor: 'pointer', color: 'var(--red)', opacity: 0, transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0} title="Remove photo"><Trash2 size={12} /></button>
                )}
                <div style={{ position: 'absolute', top: 6, left: 6 }}><span className={`badge ${status.cls}`}>{status.label}</span></div>
              </div>
              <div style={{ padding: '0.875rem' }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div className="form-group"><label className="form-label">Name</label><input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="form-group"><label className="form-label">Description</label><input value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group"><label className="form-label">Price (₱)</label><input type="number" value={editData.price} onChange={e => setEditData(p => ({ ...p, price: e.target.value }))} /></div>
                      <div className="form-group"><label className="form-label">Stock</label><input type="number" value={editData.quantity} onChange={e => setEditData(p => ({ ...p, quantity: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : <><Check size={13} /> Save</>}</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(null); setEditPhotoFile(null); setEditPhotoPreview(null); }}><X size={13} /> Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9375rem', fontFamily: 'var(--font-display)', color: 'var(--text)' }}>{item.name}</div>
                      <div style={{ fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>₱{parseFloat(item.price).toFixed(2)}</div>
                    </div>
                    {item.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>{item.description}</div>}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                      <span>{remaining} remaining</span><span>{item.quantity_sold} sold</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(item)}><Edit2 size={12} /> Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item)}><Trash2 size={12} /> Delete</button>
                      {!item.photo_url && <button className="btn btn-ghost btn-sm" onClick={() => { startEdit(item); setTimeout(() => editPhotoRef.current?.click(), 100); }} style={{ marginLeft: 'auto' }}><Image size={12} /> Add Photo</button>}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && <div className="empty-state card"><Package size={36} /><p>No items yet. Add your first item above.</p></div>}
    </div>
  );
}

// ─── SALES LOG TAB ────────────────────────────────────────────────────────────
function SalesLogTab({ sales, merchantId, merchant, onUpdate }) {
  const [undoingId, setUndoingId] = useState(null);

  const undoSale = async (sale) => {
    if (!window.confirm('Undo this sale? Stock will be restored.')) return;
    setUndoingId(sale.id);
    await supabase.from('fm_sales').update({ is_undone: true }).eq('id', sale.id);
    const { data } = await supabase.from('fm_items').select('quantity_sold').eq('id', sale.item_id).single();
    if (data) await supabase.from('fm_items').update({ quantity_sold: Math.max(0, data.quantity_sold - sale.quantity) }).eq('id', sale.item_id);
    await logAudit(merchant.event_id, merchantId, 'SALE_UNDONE', { sale_id: sale.id });
    setUndoingId(null);
    onUpdate();
    toast.success('Sale undone');
  };

  const printReceipt = (sale) => {
    const win = window.open('', '_blank', 'width=320,height=400');
    win.document.write(`
      <html><head><title>Receipt</title><style>
        body { font-family: monospace; font-size: 13px; padding: 1rem; max-width: 280px; margin: 0 auto; }
        h2 { font-size: 16px; margin-bottom: 4px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .total { font-weight: bold; font-size: 15px; }
        .footer { text-align: center; margin-top: 12px; font-size: 11px; color: #666; }
      </style></head><body>
        <h2>${merchant.shop_name}</h2>
        <div style="font-size:11px;color:#666">${new Date(sale.sold_at).toLocaleString('en-PH')}</div>
        <div class="divider"></div>
        <div class="row"><span>${sale.item_name} × ${sale.quantity}</span><span>₱${parseFloat(sale.total_price).toFixed(2)}</span></div>
        <div class="divider"></div>
        <div class="row total"><span>TOTAL</span><span>₱${parseFloat(sale.total_price).toFixed(2)}</span></div>
        <div class="row"><span>Payment</span><span>${sale.payment_method}</span></div>
        <div class="footer">Thank you!</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="animate-fade">
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Sales Log</h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{sales.length} transaction{sales.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>Payment</th><th></th></tr></thead>
            <tbody>
              {sales.length === 0 && <tr><td colSpan={7}><div className="empty-state">No sales recorded yet</div></td></tr>}
              {sales.map(sale => (
                <tr key={sale.id}>
                  <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{new Date(sale.sold_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{sale.item_name}</td>
                  <td>{sale.quantity}</td>
                  <td>₱{parseFloat(sale.unit_price).toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>₱{parseFloat(sale.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td><span className={`badge ${sale.payment_method === 'cash' ? 'badge-green' : sale.payment_method === 'card' ? 'badge-blue' : 'badge-purple'}`}>{sale.payment_method}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-3)', padding: '0.2rem 0.4rem' }} onClick={() => printReceipt(sale)} title="Print receipt"><Printer size={12} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => undoSale(sale)} disabled={undoingId === sale.id}>
                        <RotateCcw size={12} /> {undoingId === sale.id ? '…' : 'Undo'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

function Alert({ type, icon, message }) {
  const colors = { red: ['var(--red-dim)', 'var(--red)', 'rgba(240,90,90,0.2)'], yellow: ['var(--accent-dim)', 'var(--accent)', 'var(--accent-border)'], blue: ['var(--blue-dim)', 'var(--blue)', 'rgba(90,156,240,0.2)'] };
  const [bg, , border] = colors[type];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.9rem', background: bg, border: `1px solid ${border}`, borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
      {icon} <span style={{ color: 'var(--text-2)' }}>{message}</span>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="animate-pulse" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
        <p>Loading your dashboard…</p>
      </div>
    </div>
  );
}
