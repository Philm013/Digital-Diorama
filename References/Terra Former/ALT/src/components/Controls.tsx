import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

export function IconButton({ label, children, onClick, active, disabled, className = '' }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} onClick={onClick} disabled={disabled} className={`icon-button ${active ? 'active' : ''} ${className}`}>{children}</button>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}><span /></button>;
}

export function RangeControl({ label, value, onChange, min, max, step = 1, display, small = false }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; display?: string; small?: boolean }) {
  const id = useId();
  return <div className={`range-control ${small ? 'compact' : ''}`}>
    <div className="range-label"><label htmlFor={id}>{label}</label><output htmlFor={id}>{display ?? value}</output></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-valuetext={display} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties} />
  </div>;
}

export function PanelSection({ title, icon, action, children, initialOpen = true }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  return <section className="panel-section"><div className="section-heading"><button className="section-title" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{icon}<span>{title}</span><ChevronDown size={13} className={open ? '' : 'is-closed'} /></button>{action}</div>{open && <div id={id} className="section-content">{children}</div>}</section>;
}

export function Modal({ title, eyebrow, description, onClose, children, className = '' }: { title: string; eyebrow?: string; description?: string; onClose: () => void; children: ReactNode; className?: string }) {
  const id = useId(), ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const focusables = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex="0"]');
      if (!focusables?.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className={`modal ${className}`}>
    <IconButton label="Close dialog" className="modal-close" onClick={onClose}><X size={19} /></IconButton>
    {eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2>{description && <p className="modal-description">{description}</p>}{children}
  </div></div>;
}