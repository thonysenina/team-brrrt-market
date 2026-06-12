import { useState, useEffect, useCallback } from 'react';
import { supabase, logAudit } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  ShoppingCart, Package, TrendingUp, AlertTriangle, Bell,
  LogOut, Plus, Trash2, Edit2, Check, X, RefreshCw, DollarSign,
  Archive, Zap
} from 'lucide-react';

export default function Dashboard() {
  const { session, logout } = useAuth();
  const { merchantId, merchant, eventId } = session;

  const [tab, setTab] = useState('overview'); // overview | pos | inventory | sales
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [itemsRes, salesRes, annRes] = await Promise.all([
      supabase.from('fm_items').select('*').eq('merchant_id', merchantId).order('name'),
      supabase.from('fm_sales').select('*').eq('merchant_id', merchantId).eq('is_undone', false).order('sold_at', { ascending: false }),
      supabase.from('fm_announcements').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(5),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (salesRes.data) setSales(salesRes.data);
    if (annRes.data) setAnnouncements(annRes.data);
    setLoading(false);
  }, [merchantId, eventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived stats
  const grossRevenue = sales.reduce((s, t) => s + parseFloat(t.total_price), 0);
  const merchantShare = grossRevenue * (merchant.merchant_pct / 100);
  const organizerShare = grossRevenue * ((100 - merchant.merchant_pct) / 100);
  const outOfStock = items.filter(i => i.quantity - i.quantity_sold <= 0);
  const lowStock = items.filter(i => { const rem = i.quantity - i.quantity_sold; return rem > 0 && rem <= 2; });
  const topItems = [...items].sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 5);
  const zeroSales = items.filter(i => i.quantity_sold === 0 && i.quantity > 0);

  // Hourly sales chart data
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
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'sales', label: 'Sales Log', icon: DollarSign },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <header style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', padding: '0 1.5rem', height: 60, display: 'flex', alignItems: 'center', gap: '1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          <ShoppingCart size={20} color="var(--accent)" />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', fontFamily: 'var(--font-display)' }}>{merchant.shop_name}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>{session.eventName}</div>
          </div>
        </div>
        {announcements.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 99, fontSize: '0.75rem', color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => toast(announcements[0].message, { icon: '📢', duration: 6000 })}>
            <Bell size={13} /> {announcements.length} announcement{announcements.length > 1 ? 's' : ''}
          </div>
        )}
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
        <button className="btn btn-ghost btn-sm" onClick={fetchData} style={{ marginLeft: 'auto', alignSelf: 'center' }} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      <main style={{ flex: 1, padding: '1.5rem', maxWidth: 1100, width: '100%', margin: '0 auto' }}>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">

            {/* Alerts */}
            {(outOfStock.length > 0 || lowStock.length > 0 || zeroSales.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {outOfStock.map(i => (
                  <Alert key={i.id} type="red" icon={<Archive size={14} />} message={<><strong>{i.name}</strong> is out of stock</>} />
                ))}
                {lowStock.map(i => (
                  <Alert key={i.id} type="yellow" icon={<AlertTriangle size={14} />} message={<><strong>{i.name}</strong> — only {i.quantity - i.quantity_sold} left</>} />
                ))}
                {zeroSales.length > 0 && (
                  <Alert type="blue" icon={<Zap size={14} />} message={<>{zeroSales.length} item{zeroSales.length > 1 ? 's have' : ' has'} 0 sales — consider adjusting pricing or display</>} />
                )}
              </div>
            )}

            {/* Revenue stats */}
            <div className="grid-3">
              <StatCard label="Gross Revenue" value={`₱${grossRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--accent)" sub={`${sales.length} transaction${sales.length !== 1 ? 's' : ''}`} />
              <StatCard label={`Your Share (${merchant.merchant_pct}%)`} value={`₱${merchantShare.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--green)" sub="Net earnings" />
              <StatCard label={`Organizer Cut (${100 - merchant.merchant_pct}%)`} value={`₱${organizerShare.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} color="var(--blue)" sub="Commission owed" />
            </div>

            {/* Charts row */}
            <div className="grid-2">
              {/* Hourly revenue */}
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

              {/* Top items */}
              <div className="card">
                <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Top Selling Items</h3>
                {topItems.filter(i => i.quantity_sold > 0).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {topItems.filter(i => i.quantity_sold > 0).map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: idx === 0 ? 'var(--accent-dim)' : 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: idx === 0 ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }}>{idx + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
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
                  <thead><tr><th>Item</th><th>Price</th><th>Stock</th><th>Sold</th><th>Revenue</th><th>Status</th></tr></thead>
                  <tbody>
                    {items.map(item => {
                      const remaining = item.quantity - item.quantity_sold;
                      const status = remaining <= 0 ? { label: 'Out of Stock', cls: 'badge-red' } : remaining <= 2 ? { label: 'Low Stock', cls: 'badge-yellow' } : { label: 'In Stock', cls: 'badge-green' };
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 500 }}>{item.name}</td>
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

        {/* POS */}
        {tab === 'pos' && <POSTab items={items} merchantId={merchantId} merchant={merchant} onSale={fetchData} />}

        {/* INVENTORY */}
        {tab === 'inventory' && <InventoryTab items={items} merchantId={merchantId} onUpdate={fetchData} />}

        {/* SALES LOG */}
        {tab === 'sales' && <SalesLogTab sales={sales} merchantId={merchantId} merchant={merchant} onUpdate={fetchData} />}

      </main>
    </div>
  );
}

// ─── POS TAB ─────────────────────────────────────────────────────────────────
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
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c)
      .filter(c => c.qty > 0));
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

      // Update inventory
      for (const c of cart) {
        await supabase.from('fm_items').update({ quantity_sold: c.quantity_sold + c.qty }).eq('id', c.id);
      }

      await logAudit(merchant.event_id, merchantId, 'SALE', { items: cart.length, total: cartTotal });
      setLastSale({ items: [...cart], total: cartTotal, payment });
      setCart([]);
      toast.success('Sale recorded!');
      onSale();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
    setSubmitting(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }} className="animate-fade">
      {/* Items grid */}
      <div>
        <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-2)' }}>Available Items</h2>
        {available.length === 0 ? (
          <div className="empty-state card"><Archive size={36} /><p>No items in stock</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
            {available.map(item => {
              const inCart = cart.find(c => c.id === item.id);
              const remaining = item.quantity - item.quantity_sold;
              return (
                <button key={item.id} onClick={() => addToCart(item)} style={{
                  background: inCart ? 'var(--accent-dim)' : 'var(--bg-2)',
                  border: `1px solid ${inCart ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'left', cursor: 'pointer',
                  transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '0.4rem',
                }}
                  onMouseEnter={e => { if (!inCart) e.currentTarget.style.borderColor = 'var(--border-light)'; }}
                  onMouseLeave={e => { if (!inCart) e.currentTarget.style.borderColor = 'var(--border)'; }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>₱{parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.75rem', color: remaining <= 2 ? 'var(--red)' : 'var(--text-3)' }}>{remaining} left</div>
                  {inCart && <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>× {inCart.qty} in cart</div>}
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>₱{parseFloat(c.price).toFixed(2)} each</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '1rem' }} onClick={() => updateQty(c.id, -1)}>−</button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: 20, textAlign: 'center' }}>{c.qty}</span>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '1rem' }} onClick={() => updateQty(c.id, 1)}>+</button>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: 60, textAlign: 'right', color: 'var(--accent)' }}>₱{(c.price * c.qty).toFixed(2)}</div>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', padding: '0.2rem' }} onClick={() => removeFromCart(c.id)}><X size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="divider" style={{ margin: '0' }} />
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

          {cart.length > 0 && (
            <button className="btn btn-ghost btn-sm btn-full" onClick={() => setCart([])}>Clear cart</button>
          )}
        </div>

        {/* Last sale receipt */}
        {lastSale && (
          <div className="card animate-fade" style={{ marginTop: '1rem', border: '1px solid var(--green)', background: 'var(--green-dim)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>LAST SALE</span>
              <button className="btn btn-ghost btn-sm" style={{ padding: '0.1rem' }} onClick={() => setLastSale(null)}><X size={12} /></button>
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
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', quantity: '' });
  const [saving, setSaving] = useState(false);

  const startEdit = (item) => { setEditId(item.id); setEditData({ name: item.name, description: item.description, price: item.price, quantity: item.quantity }); };

  const saveEdit = async () => {
    setSaving(true);
    await supabase.from('fm_items').update({ name: editData.name, description: editData.description, price: parseFloat(editData.price), quantity: parseInt(editData.quantity) }).eq('id', editId);
    setEditId(null);
    setSaving(false);
    onUpdate();
    toast.success('Item updated');
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    await supabase.from('fm_items').delete().eq('id', id);
    onUpdate();
    toast.success('Item removed');
  };

  const addItem = async () => {
    if (!newItem.name || !newItem.price || !newItem.quantity) { toast.error('All fields required'); return; }
    setSaving(true);
    await supabase.from('fm_items').insert({ merchant_id: merchantId, name: newItem.name.trim(), description: newItem.description.trim(), price: parseFloat(newItem.price), quantity: parseInt(newItem.quantity), quantity_sold: 0 });
    setNewItem({ name: '', description: '', price: '', quantity: '' });
    setShowAdd(false);
    setSaving(false);
    onUpdate();
    toast.success('Item added');
  };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>Manage Inventory</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}><Plus size={14} /> Add Item</button>
      </div>

      {showAdd && (
        <div className="card animate-fade" style={{ borderColor: 'var(--accent-border)' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>New Item</h3>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Name *</label><input value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Description</label><input value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Price (₱) *</label><input type="number" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Quantity *</label><input type="number" value={newItem.quantity} onChange={e => setNewItem(p => ({ ...p, quantity: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button className="btn btn-primary btn-sm" onClick={addItem} disabled={saving}><Check size={14} /> Save</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Description</th><th>Price</th><th>Stock</th><th>Sold</th><th>Remaining</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map(item => {
                const remaining = item.quantity - item.quantity_sold;
                const status = remaining <= 0 ? { label: 'Out of Stock', cls: 'badge-red' } : remaining <= 2 ? { label: 'Low Stock', cls: 'badge-yellow' } : { label: 'In Stock', cls: 'badge-green' };
                const isEditing = editId === item.id;
                return (
                  <tr key={item.id}>
                    <td>{isEditing ? <input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} style={{ minWidth: 120 }} /> : <span style={{ fontWeight: 500 }}>{item.name}</span>}</td>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>{isEditing ? <input value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} /> : item.description || '—'}</td>
                    <td>{isEditing ? <input type="number" value={editData.price} onChange={e => setEditData(p => ({ ...p, price: e.target.value }))} style={{ width: 90 }} /> : `₱${parseFloat(item.price).toFixed(2)}`}</td>
                    <td>{isEditing ? <input type="number" value={editData.quantity} onChange={e => setEditData(p => ({ ...p, quantity: e.target.value }))} style={{ width: 70 }} /> : item.quantity}</td>
                    <td>{item.quantity_sold}</td>
                    <td style={{ color: remaining <= 2 ? 'var(--red)' : 'inherit', fontWeight: remaining <= 2 ? 700 : 400 }}>{remaining}</td>
                    <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}><Check size={12} /></button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}><X size={12} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(item)}><Edit2 size={12} /></button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteItem(item.id)}><Trash2 size={12} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SALES LOG TAB ────────────────────────────────────────────────────────────
function SalesLogTab({ sales, merchantId, merchant, onUpdate }) {
  const undoSale = async (sale) => {
    if (!window.confirm('Undo this sale? Stock will be restored.')) return;
    await supabase.from('fm_sales').update({ is_undone: true }).eq('id', sale.id);
    await supabase.from('fm_items').update({ quantity_sold: Math.max(0, (await supabase.from('fm_items').select('quantity_sold').eq('id', sale.item_id).single()).data.quantity_sold - sale.quantity) }).eq('id', sale.item_id);
    await logAudit(merchant.event_id, merchantId, 'SALE_UNDONE', { sale_id: sale.id });
    onUpdate();
    toast.success('Sale undone');
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
              {sales.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">No sales recorded yet</div></td></tr>
              )}
              {sales.map(sale => {
                const mins = Math.floor((Date.now() - new Date(sale.sold_at)) / 60000);
                const canUndo = mins < 10;
                return (
                  <tr key={sale.id}>
                    <td style={{ color: 'var(--text-3)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{new Date(sale.sold_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontWeight: 500 }}>{sale.item_name}</td>
                    <td>{sale.quantity}</td>
                    <td>₱{parseFloat(sale.unit_price).toFixed(2)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>₱{parseFloat(sale.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    <td><span className={`badge ${sale.payment_method === 'cash' ? 'badge-green' : sale.payment_method === 'card' ? 'badge-blue' : 'badge-purple'}`}>{sale.payment_method}</span></td>
                    <td>{canUndo && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: '0.75rem' }} onClick={() => undoSale(sale)}>Undo</button>}</td>
                  </tr>
                );
              })}
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
  const [bg, text, border] = colors[type];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.9rem', background: bg, border: `1px solid ${border}`, borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: text }}>
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
