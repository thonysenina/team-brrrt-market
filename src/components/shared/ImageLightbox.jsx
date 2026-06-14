import { useEffect, useCallback } from 'react';
import { X, ZoomIn } from 'lucide-react';

/**
 * Full-screen image lightbox.
 *
 * Usage:
 *   <ImageLightbox src={url} alt="Item name" onClose={() => setOpen(false)} />
 *
 * Closes on:
 *   - Clicking the × button
 *   - Clicking the backdrop
 *   - Pressing Escape
 */
export default function ImageLightbox({ src, alt, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  if (!src) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          transition: 'background 0.15s',
          zIndex: 201,
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        title="Close (Esc)"
      >
        <X size={18} />
      </button>

      {/* Image — stop propagation so clicking image doesn't close */}
      <img
        src={src}
        alt={alt || 'Item photo'}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '100%',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: 8,
          boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          userSelect: 'none',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Caption */}
      {alt && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '0.4rem 1rem',
            borderRadius: 99,
            fontSize: '0.8125rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            maxWidth: '90vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {alt}
        </div>
      )}
    </div>
  );
}

/**
 * Clickable thumbnail wrapper.
 * Wrap any <img> or placeholder with this to make it open the lightbox.
 *
 * Usage:
 *   <LightboxTrigger src={url} alt="Item name">
 *     <img src={url} ... />
 *   </LightboxTrigger>
 */
export function LightboxTrigger({ src, alt, children, style }) {
  if (!src) return <>{children}</>;

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', cursor: 'zoom-in', ...style }}
      onClick={e => {
        e.stopPropagation();
        // Dispatch a custom event that a parent ImageLightboxProvider can listen to,
        // or use the simpler inline state approach (see Dashboard/AdminPanel usage)
        const event = new CustomEvent('open-lightbox', { detail: { src, alt }, bubbles: true });
        e.currentTarget.dispatchEvent(event);
      }}
      title="Click to enlarge"
    >
      {children}
      {/* Zoom hint overlay on hover */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'inherit',
        transition: 'background 0.2s',
        color: '#fff',
        opacity: 0,
      }}
        onMouseEnter={e => {
          e.currentTarget.style.opacity = 1;
          e.currentTarget.style.background = 'rgba(0,0,0,0.35)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = 0;
          e.currentTarget.style.background = 'rgba(0,0,0,0)';
        }}
      >
        <ZoomIn size={20} />
      </div>
    </div>
  );
}
