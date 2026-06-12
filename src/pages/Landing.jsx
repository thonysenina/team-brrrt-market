import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { ShoppingBag, Lock, ArrowRight, Store } from 'lucide-react';

export default function Landing() {
  const { loginOrganizer, loginMerchant } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState(null); // 'organizer' | 'merchant'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Organizer flow
  const [orgPin, setOrgPin] = useState('');
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState('');

  // Merchant flow
  const [mEventCode, setMEventCode] = useState('');
  const [mPin, setMPin] = useState('');
  const [mEvent, setMEvent] = useState(null);

  const handleOrgPinSubmit = async () => {
    if (!orgPin.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('fm_events')
      .select('*')
      .eq('organizer_pin', orgPin.trim());
    setLoading(false);
    if (error || !data.length) {
      toast.error('Invalid organizer PIN');
      return;
    }
    setEvents(data);
    setStep(2);
  };

  const handleOrgEventSelect = () => {
    const ev = events.find(e => e.id === selectedEvent);
    if (!ev) return;
    loginOrganizer(ev);
    navigate('/admin');
  };

  const handleMerchantEventLookup = async () => {
    if (!mEventCode.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('fm_events')
      .select('*')
      .eq('id', mEventCode.trim())
      .eq('is_active', true)
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error('Event not found or inactive');
      return;
    }
    setMEvent(data);
    setStep(2);
  };

  const handleMerchantLogin = async () => {
    if (!mPin.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('fm_merchants')
      .select('*')
      .eq('event_id', mEvent.id)
      .eq('pin', mPin.trim())
      .single();
    setLoading(false);
    if (error || !data) {
      toast.error('Invalid merchant PIN');
      return;
    }
    if (data.status === 'rejected') {
      toast.error('Your application has been rejected.');
      return;
    }
    if (data.status === 'pending') {
      toast('Your application is pending organizer approval.', { icon: '⏳' });
      return;
    }
    loginMerchant(data, mEvent);
    navigate('/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(240,165,0,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(90,156,240,0.05) 0%, transparent 50%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 16, marginBottom: '1rem' }}>
            <ShoppingBag size={28} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>MarketDay</h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Flea Market Management Platform</p>
        </div>

        {!mode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fade">
            <button className="card" onClick={() => setMode('organizer')} style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'border-color 0.2s', border: '1px solid var(--border)', color: 'var(--text)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Lock size={20} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Organizer Access</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>Manage events, merchants & reports</div>
              </div>
              <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />
            </button>

            <button className="card" onClick={() => setMode('merchant')} style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', transition: 'border-color 0.2s', border: '1px solid var(--border)', color: 'var(--text)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--blue)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Store size={20} color="var(--blue)" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Merchant Access</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>POS, inventory & sales dashboard</div>
              </div>
              <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-3)' }} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/register')}>
                New merchant? Register here →
              </button>
            </div>
          </div>
        ) : mode === 'organizer' ? (
          <div className="card animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setMode(null); setStep(1); setOrgPin(''); setEvents([]); }}>←</button>
              <h2 style={{ fontSize: '1.1rem' }}>Organizer Login</h2>
            </div>

            {step === 1 && (
              <>
                <div className="form-group">
                  <label className="form-label">Organizer PIN</label>
                  <input type="password" placeholder="Enter your PIN" value={orgPin} onChange={e => setOrgPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleOrgPinSubmit()} />
                </div>
                <button className="btn btn-primary btn-full" onClick={handleOrgPinSubmit} disabled={loading}>
                  {loading ? 'Verifying…' : 'Continue'}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-group">
                  <label className="form-label">Select Event</label>
                  <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                    <option value="">Choose an event…</option>
                    {events.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.name} — {ev.event_date}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary btn-full" onClick={handleOrgEventSelect} disabled={!selectedEvent}>
                  Enter Admin Panel
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="card animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setMode(null); setStep(1); setMEventCode(''); setMPin(''); setMEvent(null); }}>←</button>
              <h2 style={{ fontSize: '1.1rem' }}>Merchant Login</h2>
            </div>

            {step === 1 && (
              <>
                <div className="form-group">
                  <label className="form-label">Event ID</label>
                  <input placeholder="Paste your event ID" value={mEventCode} onChange={e => setMEventCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMerchantEventLookup()} />
                  <span className="form-hint">Get this from your organizer</span>
                </div>
                <button className="btn btn-primary btn-full" onClick={handleMerchantEventLookup} disabled={loading}>
                  {loading ? 'Looking up…' : 'Find Event'}
                </button>
              </>
            )}

            {step === 2 && mEvent && (
              <>
                <div style={{ padding: '0.75rem', background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{mEvent.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{mEvent.event_date} · {mEvent.location}</div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Your Merchant PIN</label>
                  <input type="password" placeholder="Enter your PIN" value={mPin} onChange={e => setMPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMerchantLogin()} />
                </div>
                <button className="btn btn-primary btn-full" onClick={handleMerchantLogin} disabled={loading}>
                  {loading ? 'Logging in…' : 'Enter Dashboard'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
