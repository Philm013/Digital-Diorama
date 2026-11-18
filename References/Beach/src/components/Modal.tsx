import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; className?: string }

export default function Modal({ title, eyebrow, onClose, children, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key !== 'Tab') return;
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${className}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}><button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={19}/></button>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id="modal-title">{title}</h2>{children}</div></div>;
}