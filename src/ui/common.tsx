import { clsx } from 'clsx';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

export function Btn({ className, variant = 'soft', size = 'md', active, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'soft' | 'solid' | 'ghost' | 'danger' | 'go' | 'stop'; size?: 'sm' | 'md' | 'lg'; active?: boolean }) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-display font-semibold transition-all select-none disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
        // (touch screens get finger-sized small buttons)
        size === 'sm' && 'h-8 px-2.5 text-[13px] [@media(pointer:coarse)]:h-10',
        size === 'md' && 'h-11 px-3.5 text-sm',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'soft' && (active ? 'bg-amber-200/90 text-ink ring-1 ring-amber-400' : 'bg-white/85 text-ink ring-1 ring-black/10 hover:bg-white'),
        variant === 'solid' && 'dd-3d bg-leaf text-white [--edge:#275a24] hover:brightness-110',
        variant === 'ghost' && (active ? 'bg-black/10 text-current' : 'text-current hover:bg-black/5'),
        variant === 'danger' && 'bg-red-50 text-red-700 ring-1 ring-red-200 hover:bg-red-100',
        variant === 'go' && 'dd-3d bg-[#3bb34a] text-white [--edge:#23802f] hover:brightness-110',
        variant === 'stop' && 'dd-3d bg-[#e8453c] text-white [--edge:#a5241e] hover:brightness-110',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconBtn({ label, className, active, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={clsx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-amber-500',
        active ? 'bg-amber-200 text-ink ring-1 ring-amber-400' : 'hover:bg-black/5', className)}
    >
      {children}
    </button>
  );
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format, unit, onCommit }: { label: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; onCommit?: (v: number) => void; format?: (v: number) => string; unit?: string }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-semibold text-ink/80">{label}</span>
        <span className="tabular-nums text-ink/60">{format ? format(value) : `${+value.toFixed(2)}${unit ? ' ' + unit : ''}`}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        className="dd-range w-full"
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 py-1 text-[13px] [@media(pointer:coarse)]:min-h-11" title={hint}>
      <span className="font-semibold text-ink/80">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-leaf' : 'bg-black/20')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-black/5 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title} onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={clsx('flex-1 whitespace-nowrap rounded-lg px-2 font-display font-semibold transition-all', size === 'sm' ? 'h-7 text-xs [@media(pointer:coarse)]:h-9' : 'h-8 text-[13px] [@media(pointer:coarse)]:h-10',
            o.value === value ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, right, defaultOpen = true, tour }: { title: ReactNode; children: ReactNode; right?: ReactNode; defaultOpen?: boolean; tour?: string }) {
  return (
    <details open={defaultOpen} className="group border-b border-black/5 py-3 last:border-0" data-tour={tour}>
      <summary className="mb-2 flex cursor-pointer list-none items-center justify-between gap-2 font-display text-[13px] font-semibold uppercase tracking-wide text-ink/55">
        <span className="flex items-center gap-1.5"><span className="inline-block transition-transform group-open:rotate-90">▸</span>{title}</span>
        {right}
      </summary>
      <div className="space-y-3">{children}</div>
    </details>
  );
}

export function Chip({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', className)}
      style={color ? { background: color + '22', color, boxShadow: `inset 0 0 0 1px ${color}55` } : undefined}>
      {children}
    </span>
  );
}

export function statusColor(status?: string) {
  const s = (status ?? '').toLowerCase();
  if (s.includes('critically')) return '#c0392b';
  if (s.startsWith('endangered') || s.includes('endangered (')) return '#e0662f';
  if (s.includes('vulnerable')) return '#d99a1e';
  if (s.includes('near threatened')) return '#9fae2a';
  if (s.includes('least concern')) return '#3f9b3a';
  if (s.includes('domestic')) return '#6d7c93';
  return '#7d8a99';
}
