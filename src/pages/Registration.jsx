import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, logAudit, uploadItemPhoto, prepareImageFile } from '../lib/supabase';
import toast from 'react-hot-toast';
import {
  ShoppingBag, Plus, Trash2, ChevronRight, ChevronLeft,
  Check, Upload, Image, History, ArrowRight, X
} from 'lucide-react';

// Steps: Event (0) → Import? (0.5) → Profile (1) → Inventory (2) → Equipment (3) → Review (4)
const STEPS = ['Event', 'Profile', 'Inventory', 'Equipment', 'Review'];

export default function Registration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0, 0.5, 1, 2, 3, 4
  const [loading, setLoading] = useState(false);

  // Step 0 — Event
  const [eventId, setEventId] = useState('');
  const [event, setEvent] = useState(null);

  // Step 0.5 — Import from previous event
  const [prevEventId, setPrevEventId] = useState('');
  const [prevPin, setPrevPin] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importedFrom, setImportedFrom] = useState(null); // { shopName, eventName, count }

  // Step 1 — Profile
  const [fullName, setFullName] = useState('');
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');

  // Step 2 — Inventory
  const [items, setItems] = useState([{ name: '', description: '', price: '', quantity: '', photoFile: null, photoPreview: null }]);

  // Step 3 — Equipment
  const [equipment, setEquipment] = useState([{ name: '', quantity: 1 }]);

  const photoRefs = useRef([]);

  // ── Step 0: Event lookup ──────────────────────────────────────────────────
  const lookupEvent = async () => {
    if (!eventId.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('fm_events')
      .select('*')
      .eq('id', eventId.trim())
      .eq('is_active', true)
      .single();
    setLoading(false);
    if (error || !data) { toast.error('Event not found or inactive'); return; }
    setEvent(data);
    setStep(0.5); // go to import prompt
  };

  // ── Step 0.5: Import from previous event ─────────────────────────────────
  const handleImport = async () => {
    if (!prevEventId.trim() || !prevPin.trim()) {
      toast.error('Enter both a previous Event ID and your PIN');
      return;
    }
    setImportLoading(true);
    try {
      // Find previous merchant by event + PIN
      const { data: prevMerchant, error: mErr } = await supabase
        .from('fm_merchants')
        .select('*')
        .eq('event_id', prevEventId.trim())
        .eq('pin', prevPin.trim())
        .single();

      if (mErr || !prevMerchant) {
        toast.error('No matching merchant found for that Event ID and PIN');
        setImportLoading(false);
        return;
      }

      // Fetch their previous items
      const { data: prevItems } = await supabase
        .from('fm_items')
        .select('*')
        .eq('merchant_id', prevMerchant.id)
        .order('name');

      if (!prevItems?.length) {
        toast.error('That merchant had no inventory to import');
        setImportLoading(false);
        return;
      }

      // Fetch previous event name for display
      const { data: prevEvent } = await supabase
        .from('fm_events')
        .select('name')
        .eq('id', prevEventId.trim())
        .single();

      // Pre-fill profile fields from previous registration
      setFullName(prevMerchant.full_name);
      setShopName(prevMerchant.shop_name);
      setDescription(prevMerchant.description || '');

      // Pre-fill inventory — carry over name, description, price; reset quantity_sold
      // Keep original photo_url as a reference but no photoFile (they'd need to re-upload)
      const carried = prevItems.map(i => ({
        name: i.name,
        description: i.description || '',
        price: String(i.price),
        quantity: String(i.quantity),
        photoFile: null,
        photoPreview: null,
        importedPhotoUrl: i.photo_url || null, // show old photo as preview reference
      }));
      setItems(carried);

      setImportedFrom({
        shopName: prevMerchant.shop_name,
        eventName: prevEvent?.name || 'previous event',
        count: prevItems.length,
      });

      toast.success(`Imported ${prevItems.length} items from ${prevMerchant.shop_name}`);
      setStep(1);
    } catch (err) {
      toast.error('Import failed: ' + err.message);
    }
    setImportLoading(false);
  };

  const skipImport = () => {
    setImportedFrom(null);
    setItems([{ name: '', description: '', price: '', quantity: '', photoFile: null, photoPreview: null }]);
    setStep(1);
  };

  // ── Inventory helpers ─────────────────────────────────────────────────────
  const addItem = () => setItems([...items, { name: '', description: '', price: '', quantity: '', photoFile: null, photoPreview: null }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => {
    const updated = [...items];
    updated[i][field] = val;
    setItems(updated);
  };

  const handleItemPhoto = async (i, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Photo must be under 10MB'); return; }
    const loadingUpdate = [...items];
    loadingUpdate[i].photoPreview = 'loading';
    setItems(loadingUpdate);
    try {
      const { file: prepared, previewUrl } = await prepareImageFile(file);
      const updated = [...items];
      updated[i].photoFile = prepared;
      updated[i].photoPreview = previewUrl;
      updated[i].importedPhotoUrl = null; // replaced
      setItems(updated);
    } catch (err) {
      console.error('[photo] handleItemPhoto error:', err);
      toast.error('Could not load photo — try a different image');
      const reset = [...items];
      reset[i].photoPreview = null;
      setItems(reset);
    }
  };

  const removeItemPhoto = (i) => {
    const updated = [...items];
    updated[i].photoFile = null;
    updated[i].photoPreview = null;
    updated[i].importedPhotoUrl = null;
    setItems(updated);
  };

  // ── Equipment helpers ─────────────────────────────────────────────────────
  const addEquip = () => setEquipment([...equipment, { name: '', quantity: 1 }]);
  const removeEquip = (i) => setEquipment(equipment.filter((_, idx) => idx !== i));
  const updateEquip = (i, field, val) => {
    const updated = [...equipment];
    updated[i][field] = val;
    setEquipment(updated);
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = () => {
    if (step === 1) {
      if (!fullName.trim() || !shopName.trim()) { toast.error('Full name and shop name are required'); return false; }
      if (pin.length < 4) { toast.error('PIN must be at least 4 characters'); return false; }
      if (pin !== pinConfirm) { toast.error('PINs do not match'); return false; }
    }
    if (step === 2) {
      for (const item of items) {
        if (!item.name.trim() || !item.price || !item.quantity) { toast.error('All item fields are required'); return false; }
        if (parseFloat(item.price) <= 0 || parseInt(item.quantity) <= 0) { toast.error('Price and quantity must be positive'); return false; }
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(s => s + 1);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('fm_merchants')
        .select('id')
        .eq('event_id', event.id)
        .eq('shop_name', shopName.trim())
        .single();
      if (existing) { toast.error('A booth with this name already exists for this event'); setLoading(false); return; }

      const { data: merchant, error: mErr } = await supabase.from('fm_merchants').insert({
        event_id: event.id,
        full_name: fullName.trim(),
        shop_name: shopName.trim(),
        description: description.trim(),
        pin: pin.trim(),
        status: 'pending',
      }).select().single();
      if (mErr) throw mErr;

      const validItems = items.filter(i => i.name.trim());
      for (const item of validItems) {
        let photo_url = item.importedPhotoUrl || null;
        // If merchant uploaded a new photo, use that instead
        if (item.photoFile) {
          const uploaded = await uploadItemPhoto(item.photoFile, merchant.id);
          if (uploaded) photo_url = uploaded;
        }
        await supabase.from('fm_items').insert({
          merchant_id: merchant.id,
          name: item.name.trim(),
          description: item.description.trim(),
          price: parseFloat(item.price),
          quantity: parseInt(item.quantity),
          quantity_sold: 0,
          photo_url,
        });
      }

      const validEquip = equipment.filter(e => e.name.trim());
      if (validEquip.length) {
        await supabase.from('fm_equipment').insert(validEquip.map(e => ({
          merchant_id: merchant.id,
          name: e.name.trim(),
          quantity: parseInt(e.quantity) || 1,
        })));
      }

      await logAudit(event.id, merchant.id, 'MERCHANT_REGISTERED', {
        shop_name: shopName,
        ...(importedFrom ? { imported_from: importedFrom.eventName } : {}),
      });

      toast.success('Application submitted! Await organizer approval.');
      navigate('/');
    } catch (err) {
      toast.error('Submission failed: ' + err.message);
    }
    setLoading(false);
  };

  // ── Determine display step number (for progress bar) ─────────────────────
  // step 0.5 is between 0 and 1 — treat as pre-step, don't show progress bar
  const showProgress = step >= 1;
  const progressStep = Math.floor(step); // 1,2,3,4

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem' }}>
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 30% 40%, rgba(90,156,240,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 640, position: 'relative', zIndex: 1 }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, background: 'var(--accent-dim)', border: '1px solid var(--accent-border)', borderRadius: 12 }}>
            <ShoppingBag size={20} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem' }}>Merchant Registration</h1>
            {event && <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{event.name}</p>}
          </div>
        </div>

        {/* Progress bar (only show from step 1 onwards) */}
        {showProgress && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            {STEPS.slice(1).map((s, i) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700,
                    background: i + 1 < progressStep ? 'var(--green)' : i + 1 === progressStep ? 'var(--accent)' : 'var(--bg-4)',
                    color: i + 1 <= progressStep ? '#000' : 'var(--text-3)', flexShrink: 0,
                  }}>
                    {i + 1 < progressStep ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: i + 1 === progressStep ? 'var(--text)' : 'var(--text-3)', fontWeight: i + 1 === progressStep ? 600 : 400 }}>{s}</span>
                  {i < STEPS.length - 2 && <div style={{ flex: 1, height: 1, background: i + 1 < progressStep ? 'var(--green)' : 'var(--border)', marginLeft: '0.4rem' }} />}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── STEP 0: Find event ── */}
          {step === 0 && (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Find Your Event</h2>
              <div className="form-group">
                <label className="form-label">Event ID</label>
                <input placeholder="Paste the Event ID from your organizer" value={eventId}
                  onChange={e => setEventId(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupEvent()} />
              </div>
              <button className="btn btn-primary btn-full" onClick={lookupEvent} disabled={loading}>
                {loading ? 'Searching…' : 'Find Event'}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => navigate('/')}>
                ← Back to login
              </button>
            </>
          )}

          {/* ── STEP 0.5: Import prompt ── */}
          {step === 0.5 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <History size={18} color="var(--blue)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.05rem' }}>Welcome to {event.name}!</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>Have you sold with us before?</p>
                </div>
              </div>

              {/* Import section */}
              <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                  Import inventory from a previous event
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: -4 }}>
                  Your profile and items will be pre-filled. You can still edit everything before submitting.
                </p>
                <div className="form-group">
                  <label className="form-label">Previous Event ID</label>
                  <input placeholder="Paste your previous Event ID" value={prevEventId}
                    onChange={e => setPrevEventId(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Your Previous PIN</label>
                  <input type="password" placeholder="The PIN you used at that event" value={prevPin}
                    onChange={e => setPrevPin(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleImport()} />
                </div>
                <button className="btn btn-primary" onClick={handleImport} disabled={importLoading || !prevEventId.trim() || !prevPin.trim()}>
                  {importLoading ? 'Importing…' : <><History size={14} /> Import My Inventory</>}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <button className="btn btn-secondary btn-full" onClick={skipImport}>
                Start fresh <ArrowRight size={14} />
              </button>

              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={() => setStep(0)}>
                ← Back
              </button>
            </>
          )}

          {/* ── STEP 1: Profile ── */}
          {step === 1 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.1rem' }}>Your Profile</h2>
                {importedFrom && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', background: 'var(--blue-dim)', border: '1px solid rgba(90,156,240,0.2)', borderRadius: 99, fontSize: '0.7rem', color: 'var(--blue)' }}>
                    <History size={11} /> Imported from {importedFrom.eventName}
                  </div>
                )}
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input placeholder="Jane Dela Cruz" value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Booth / Shop Name *</label>
                  <input placeholder="Jane's Vintage Corner" value={shopName} onChange={e => setShopName(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Booth Description</label>
                <textarea rows={3} placeholder="Tell us about your booth…" value={description}
                  onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <div className="divider" />
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Set Your PIN *</label>
                  <input type="password" placeholder="Min. 4 characters" value={pin} onChange={e => setPin(e.target.value)} />
                  <span className="form-hint">Set a new PIN for this event</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm PIN *</label>
                  <input type="password" placeholder="Repeat PIN" value={pinConfirm} onChange={e => setPinConfirm(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: Inventory ── */}
          {step === 2 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.1rem' }}>Your Merchandise</h2>
                {importedFrom && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', background: 'var(--blue-dim)', border: '1px solid rgba(90,156,240,0.2)', borderRadius: 99, fontSize: '0.7rem', color: 'var(--blue)' }}>
                    <History size={11} /> {importedFrom.count} items imported
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: -8 }}>
                {importedFrom
                  ? 'Your previous inventory has been pre-filled. Edit, remove, or add items as needed before submitting.'
                  : 'List all items you plan to sell. Photos are optional but help with the POS display.'
                }
              </p>

              {items.map((item, i) => (
                <div key={i} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-3)', fontFamily: 'var(--font-display)' }}>
                      ITEM {i + 1}
                    </span>
                    {items.length > 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)} style={{ color: 'var(--red)' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Photo picker */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                      <div
                        onClick={() => { if (!photoRefs.current[i]) photoRefs.current[i] = document.getElementById(`photo-ref-${i}`); photoRefs.current[i]?.click(); }}
                        style={{
                          width: 90, height: 90, borderRadius: 8,
                          border: `2px dashed ${(item.photoPreview && item.photoPreview !== 'loading') || item.importedPhotoUrl ? 'var(--accent)' : 'var(--border-light)'}`,
                          background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'border-color 0.2s',
                        }}
                      >
                        {item.photoPreview === 'loading' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', color: 'var(--text-3)' }}>
                            <div className="animate-pulse" style={{ fontSize: '1.2rem' }}>⏳</div>
                            <span style={{ fontSize: '0.65rem' }}>Processing…</span>
                          </div>
                        ) : item.photoPreview ? (
                          <img src={item.photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : item.importedPhotoUrl ? (
                          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <img src={item.importedPhotoUrl} alt="previous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 600, textAlign: 'center', padding: '0 4px' }}>Tap to replace</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', color: 'var(--text-3)' }}>
                            <Upload size={18} /><span style={{ fontSize: '0.65rem' }}>Photo</span>
                          </div>
                        )}
                      </div>
                      <input id={`photo-ref-${i}`} type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => handleItemPhoto(i, e.target.files[0])} />
                      {(item.photoPreview || item.importedPhotoUrl) && item.photoPreview !== 'loading' && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.65rem', color: 'var(--red)', padding: '0.1rem 0.4rem' }}
                          onClick={() => removeItemPhoto(i)}>
                          <X size={10} /> Remove
                        </button>
                      )}
                    </div>

                    {/* Fields */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="grid-2" style={{ gap: '0.6rem' }}>
                        <div className="form-group">
                          <label className="form-label">Item Name *</label>
                          <input placeholder="Vintage lamp" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <input placeholder="Optional" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price (₱) *</label>
                          <input type="number" min="0.01" step="0.01" placeholder="250.00" value={item.price}
                            onChange={e => updateItem(i, 'price', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Quantity *</label>
                          <input type="number" min="1" placeholder="5" value={item.quantity}
                            onChange={e => updateItem(i, 'quantity', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button className="btn btn-secondary" onClick={addItem} style={{ alignSelf: 'flex-start' }}>
                <Plus size={15} /> Add Item
              </button>
            </>
          )}

          {/* ── STEP 3: Equipment ── */}
          {step === 3 && (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Booth Equipment</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: -8 }}>
                List everything you plan to bring (racks, tables, monitors, etc.)
              </p>
              {equipment.map((eq, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 3 }}>
                    {i === 0 && <label className="form-label">Equipment Name</label>}
                    <input placeholder="Clothing rack, folding table…" value={eq.name}
                      onChange={e => updateEquip(i, 'name', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    {i === 0 && <label className="form-label">Qty</label>}
                    <input type="number" min="1" value={eq.quantity}
                      onChange={e => updateEquip(i, 'quantity', e.target.value)} />
                  </div>
                  {equipment.length > 1 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => removeEquip(i)}
                      style={{ color: 'var(--red)', marginBottom: 2 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addEquip} style={{ alignSelf: 'flex-start' }}>
                <Plus size={15} /> Add Equipment
              </button>
            </>
          )}

          {/* ── STEP 4: Review ── */}
          {step === 4 && (
            <>
              <h2 style={{ fontSize: '1.1rem' }}>Review & Submit</h2>

              {importedFrom && (
                <div style={{ padding: '0.75rem', background: 'var(--blue-dim)', border: '1px solid rgba(90,156,240,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={14} />
                  Inventory imported from <strong>{importedFrom.eventName}</strong> and updated
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <ReviewRow label="Event" value={event?.name} />
                <ReviewRow label="Full Name" value={fullName} />
                <ReviewRow label="Booth Name" value={shopName} />
                <ReviewRow label="Description" value={description || '—'} />
                <ReviewRow
                  label="Merchandise Items"
                  value={`${items.filter(i => i.name).length} item(s) · ${items.filter(i => i.photoFile || i.importedPhotoUrl).length} with photo`}
                />
                <ReviewRow label="Equipment" value={`${equipment.filter(e => e.name).length} item(s)`} />
              </div>

              {/* Item photo previews */}
              {items.filter(i => i.photoPreview || i.importedPhotoUrl).length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '0.5rem' }}>Item Photos</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {items.filter(i => i.photoPreview || i.importedPhotoUrl).map((item, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        <img
                          src={item.photoPreview && item.photoPreview !== 'loading' ? item.photoPreview : item.importedPhotoUrl}
                          alt={item.name}
                          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                        />
                        <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', fontSize: '0.6rem', color: '#fff', background: 'rgba(0,0,0,0.5)', borderRadius: '0 0 6px 6px', padding: '0.1rem' }}>
                          {item.name.slice(0, 10)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ padding: '0.875rem', background: 'var(--accent-dim)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-border)', fontSize: '0.8125rem', color: 'var(--text-2)' }}>
                ℹ️ Your application will be reviewed by the organizer before you can access the POS system.
              </div>
            </>
          )}

          {/* ── Navigation ── */}
          {step !== 0 && step !== 0.5 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setStep(s => s === 1 ? 0.5 : s - 1)}>
                <ChevronLeft size={15} /> Back
              </button>
              {step < 4 ? (
                <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={handleNext}>
                  Next <ChevronRight size={15} />
                </button>
              ) : (
                <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Submitting…' : <><Check size={15} /> Submit Application</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: accent ? 700 : 500, color: accent ? 'var(--accent)' : 'var(--text)' }}>{value}</span>
    </div>
  );
}
