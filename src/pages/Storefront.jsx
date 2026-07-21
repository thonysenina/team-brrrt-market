import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import ImageLightbox, { LightboxTrigger } from '../components/shared/ImageLightbox';
import { Sun, Moon, Package, Image, Search, LayoutGrid, List, ChevronDown, ChevronUp, Calendar, MapPin } from 'lucide-react';

export default function Storefront() {
  const { eventId } = useParams();
  const { theme, toggle: toggleTheme } = useTheme();

  const [event, setEvent] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // View state
  const [viewMode, setViewMode] = useState('grid'); // grid | byMerchant
  const [search, setSearch] = useState('');
  const [expandedMerchants, setExpandedMerchants] = useState(new Set());

  useEffect(() => {
    const handler = (e) => setLightbox({ src: e.detail.src, alt: e.detail.alt });
    document.addEventListener('open-lightbox', handler);
    return () => document.removeEventListener('open-lightbox', handler);
  }, []);

  useEffect(() => {
    async function load() {
      // Load event
      const { data: ev, error: evErr } = await supabase
        .from('fm_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (evErr || !ev) { setNotFound(true); setLoading(false); return; }
      setEvent(ev);

      // Load approved merchants
      const { data: merchantData } = await supabase
        .from('fm_merchants')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .order('shop_name');

      if (!merchantData?.length) { setMerchants([]); setItems([]); setLoading(false); return; }
      setMerchants(merchantData);
      setExpandedMerchants(new Set(merchantData.map(m => m.id)));

      // Load in-stock items from approved merchants
      const merchantIds = merchantData.map(m => m.id);
      const { data: itemData } = await supabase
        .from('fm_items')
        .select('*')
        .in('merchant_id', merchantIds)
        .order('name');

      // Only show items with remaining stock
      const inStock = (itemData || []).filter(i => i.quantity - i.quantity_sold > 0);
      setItems(inStock);
      setLoading(false);
    }
    load();
  }, [eventId]);

  const merchantMap = Object.fromEntries(merchants.map(m => [m.id, m]));

  const filteredItems = items.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const merchant = merchantMap[item.merchant_id];
    return (
      item.name.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      merchant?.shop_name.toLowerCase().includes(q)
    );
  });

  const isUpcoming = event && new Date(event.event_date) > new Date();
  const isActive = event?.is_active;

  const toggleMerchant = (id) => {
    setExpandedMerchants(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <StorefrontLoading />;
  if (notFound) return <NotFound />;

  return (
    <div className="store-page">
      {/* Header */}
      <header className="store-header">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Brand */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Team BRRRT
              <span style={{ color: 'var(--teal)', marginLeft: '0.35rem' }}>Flea Market</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1 }}>{event.name}</div>
          </div>

          {/* Event meta */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-3)' }}>
              <Calendar size={13} />
              {new Date(event.event_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {event.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-3)' }}>
                <MapPin size={13} />
                {event.location}
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-2)' }}
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Coming soon state */}
        {!isActive && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }} className="animate-fade">
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
            <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text)' }}>Coming Soon</h1>
            <p style={{ color: 'var(--text-3)', fontSize: '0.9375rem', maxWidth: 420, margin: '0 auto 1.5rem' }}>
              This event hasn't opened yet. Check back closer to the date to browse available items.
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', background: 'var(--teal-dim)', border: '1px solid var(--teal-border)', borderRadius: 'var(--radius)', color: 'var(--teal)', fontSize: '0.875rem', fontWeight: 600 }}>
              <Calendar size={15} />
              {new Date(event.event_date).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        )}

        {/* Active storefront */}
        {isActive && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fade">

            {/* Stats bar */}
            <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem 1.25rem', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', flexWrap: 'wrap' }}>
              <Stat label="Items Available" value={filteredItems.length} color="var(--teal)" />
              <Stat label="Booths" value={merchants.length} color="var(--accent)" />
              <Stat label="Event Date" value={new Date(event.event_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} color="var(--text-2)" />
              {event.location && <Stat label="Location" value={event.location} color="var(--text-2)" />}
            </div>

            {/* Search + view toggle */}
            <div className="store-filters" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                <input
                  placeholder="Search items, descriptions, or booths…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.25rem', width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '0.5rem 0.75rem', background: viewMode === 'grid' ? 'var(--bg-4)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'grid' ? 'var(--text)' : 'var(--text-3)', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }} title="Grid view">
                  <LayoutGrid size={16} />
                </button>
                <button onClick={() => setViewMode('byMerchant')} style={{ padding: '0.5rem 0.75rem', background: viewMode === 'byMerchant' ? 'var(--bg-4)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'byMerchant' ? 'var(--text)' : 'var(--text-3)', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }} title="Browse by booth">
                  <List size={16} />
                </button>
              </div>
            </div>

            {filteredItems.length === 0 && (
              <div className="empty-state card"><Package size={40} /><p>No items match your search</p></div>
            )}

            {/* GRID VIEW — flat grid of all items */}
            {viewMode === 'grid' && filteredItems.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {filteredItems.map(item => (
                  <ItemCard key={item.id} item={item} merchant={merchantMap[item.merchant_id]} />
                ))}
              </div>
            )}

            {/* BY MERCHANT VIEW */}
            {viewMode === 'byMerchant' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {merchants.map(merchant => {
                  const mItems = filteredItems.filter(i => i.merchant_id === merchant.id);
                  if (mItems.length === 0) return null;
                  const expanded = expandedMerchants.has(merchant.id);
                  return (
                    <div key={merchant.id}>
                      {/* Merchant header */}
                      <button
                        onClick={() => toggleMerchant(merchant.id)}
                        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: expanded ? '1rem' : 0 }}
                      >
                        <div className="store-merchant-section" style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.25rem', paddingBottom: '0.25rem' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text)' }}>{merchant.shop_name}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>{merchant.full_name}</div>
                            {merchant.description && <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginTop: 4 }}>{merchant.description}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--teal)', fontWeight: 600 }}>{mItems.length} item{mItems.length !== 1 ? 's' : ''}</span>
                            {expanded ? <ChevronUp size={16} color="var(--text-3)" /> : <ChevronDown size={16} color="var(--text-3)" />}
                          </div>
                        </div>
                      </button>
                      {expanded && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }} className="animate-fade">
                          {mItems.map(item => (
                            <ItemCard key={item.id} item={item} merchant={merchant} showMerchant={false} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '1.5rem', textAlign: 'center', marginTop: '3rem' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>
          Team BRRRT Flea Market · Browse-only · Items are available for purchase on event day
        </p>
      </footer>

      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ─── ITEM CARD ────────────────────────────────────────────────────────────────
function ItemCard({ item, merchant, showMerchant = true }) {
  const remaining = item.quantity - item.quantity_sold;
  const isLowStock = item.quantity > 2 && remaining <= 2;

  return (
    <div className="store-item-card">
      {/* Photo */}
      <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-3)', position: 'relative', overflow: 'hidden' }}>
        {item.photo_url ? (
          <LightboxTrigger src={item.photo_url} alt={item.name} style={{ width: '100%', height: '100%' }}>
            <img
              src={item.photo_url}
              alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </LightboxTrigger>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image size={36} color="var(--text-3)" style={{ opacity: 0.25 }} />
          </div>
        )}
        {/* Stock badge overlay */}
        {isLowStock && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--accent)', color: '#000', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: 99 }}>
            Only {remaining} left!
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '0.875rem' }}>
        {showMerchant && (
          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem', fontFamily: 'var(--font-display)' }}>
            {merchant?.shop_name}
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text)', fontFamily: 'var(--font-display)', marginBottom: '0.25rem', lineHeight: 1.3 }}>
          {item.name}
        </div>
        {item.description && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
            {item.description}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.125rem', color: 'var(--accent)' }}>
            ₱{parseFloat(item.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: isLowStock ? 'var(--accent)' : 'var(--text-3)', fontWeight: isLowStock ? 600 : 400 }}>
            {remaining} in stock
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-3)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color, fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}

function StorefrontLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-3)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)' }}>
        Team BRRRT <span style={{ color: 'var(--teal)' }}>Flea Market</span>
      </div>
      <div className="animate-pulse" style={{ fontSize: '0.875rem' }}>Loading event…</div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem' }}>🔍</div>
      <h1 style={{ fontSize: '1.5rem', color: 'var(--text)', fontFamily: 'var(--font-display)' }}>Event not found</h1>
      <p style={{ color: 'var(--text-3)', maxWidth: 360, lineHeight: 1.6 }}>
        This link may be invalid or the event may have been removed. Double-check the URL or contact your organizer.
      </p>
    </div>
  );
}
