import { ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Section({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-white/5 px-4 py-4', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
        {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-[11px] text-emerald-300">
          {format ? format(value) : `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-emerald-400
                   [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
                   [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
      />
    </label>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      {label && <div className="mb-1 text-xs text-slate-300">{label}</div>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-2 text-xs text-slate-100
                   outline-none transition focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-900">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-xs text-slate-300 transition hover:text-white"
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-emerald-500/80' : 'bg-slate-700'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-4.5' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-white/10 bg-slate-800/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1 rounded-md font-medium transition',
            size === 'sm' ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs',
            value === o.value
              ? 'bg-emerald-500/90 text-slate-950 shadow'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
          )}
        >
          {o.icon && <span className="text-xs leading-none">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = 'default',
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
        variant === 'default' && 'border border-white/10 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80',
        variant === 'ghost' && 'text-slate-400 hover:bg-white/5 hover:text-white',
        variant === 'danger' && 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Grid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

export function Grid3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}
