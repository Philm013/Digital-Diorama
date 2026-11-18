import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const first = panel?.querySelector<HTMLElement>('[autofocus], input:not([type="checkbox"]), button');
    first?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab' && panel) {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex="0"]')).filter(el => el.offsetParent !== null);
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" initial={{ y: 18, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0, scale: 0.98 }} transition={{ duration: 0.23 }}>
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
      <div className="modal-heading"><span className="eyebrow">WILDFORM FIELD NOTES</span><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {children}
    </motion.div>
  </motion.div>;
}