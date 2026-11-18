import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Bookmark, Box, Check, ChevronDown, Eye, EyeOff, Info, LayoutGrid, Layers3, Leaf, RotateCcw, Ruler, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Parameter } from '*.mjs';
import { ANIMALS, CATEGORIES, type Animal, type AnimalOptions } from '../data/catalog';
import { formatLength, getColorways, getSchema, labelForPart, type ModelStats } from '../engine/studio';

export type InspectorTab = 'Parameters' | 'Parts' | 'Details';
interface Props {
  animal: Animal;
  options: AnimalOptions;
  onChange: (key: string, value: string | number | boolean) => void;
  onAnimal: (animal: Animal) => void;
  onReset: () => void;
  onSave: () => void;
  saved: boolean;
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  stats: ModelStats | null;
  selectedPart: string | null;
  onSelectPart: (name: string | null) => void;
  hiddenParts: string[];
  onTogglePart: (name: string) => void;
  onShowAll: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  mobileViewer?: ReactNode;
  category: string;
  onCategory: (value: string) => void;
  onOpenLibrary: () => void;
}

function RangeControl({ name, schema, value, onChange }: { name: string; schema: Parameter; value: number; onChange: (key: string, value: number) => void }) {
  const progress = (value - (schema.min || 0)) / ((schema.max || 1) - (schema.min || 0)) * 100;
  const readout = name === 'bodyLength' ? formatLength(value, true) : name === 'segments' || name === 'tentacles' || name === 'arms' || name === 'poreDensity' ? String(Math.round(value)) : name === 'wingSpread' || name === 'valveOpening' || name === 'curvature' ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}x`;
  return <label className="range-control" title={schema.describe}><span className="range-label"><span>{schema.label}</span><output>{readout}</output></span><input type="range" min={schema.min} max={schema.max} step={schema.step} value={value} onChange={event => onChange(name, Number(event.target.value))} style={{ '--range-progress': `${progress}%` } as React.CSSProperties} aria-label={schema.label} /></label>;
}

function ToggleControl({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: () => void; description?: string }) {
  return <label className="toggle-control" title={description}><span>{label}</span><span className={`switch ${checked ? 'on' : ''}`}><input type="checkbox" checked={checked} onChange={onChange} /><span /></span></label>;
}

function pickCategory(onCategory: (value: string) => void, onAnimal: (animal: Animal) => void, current: Animal, cat: string) {
  onCategory(cat);
  if (current.category !== cat && cat !== 'All animals') {
    const first = ANIMALS.find(a => a.category === cat);
    if (first) onAnimal(first);
  }
}

export default function Inspector(props: Props) {
  const [editColors, setEditColors] = useState(false);
  const [partQuery, setPartQuery] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const schema = useMemo(() => getSchema(props.animal as unknown as Record<string, unknown>), [props.animal]);
  const colorways = useMemo(() => getColorways(props.animal as unknown as Record<string, unknown>), [props.animal]);
  const value = (key: string) => props.options[key] ?? schema[key]?.default;
  const colorway = String(value('colorway'));
  const ranges = Object.entries(schema).filter(([, parameter]) => parameter.type === 'range');
  const bodyKeys = ['bodyLength', 'bodyMass', 'legLength'];
  const bodyRanges = ranges.filter(([key]) => bodyKeys.includes(key));
  const features = ranges.filter(([key]) => !bodyKeys.includes(key));
  const presets = ANIMALS.filter(animal => props.category === 'All animals' || animal.category === props.category);
  const parts = props.stats?.parts.filter(part => part.label.toLowerCase().includes(partQuery.toLowerCase())) || [];

  useEffect(() => {
    if (!categoryOpen) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setCategoryOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [categoryOpen]);

  return <aside className={`inspector-panel ${props.mobileOpen ? 'mobile-is-open' : ''}`} aria-label="Animal customization">
    <div className="mobile-config-viewer" aria-label="Live mobile model preview">
      <div className="mobile-config-stage">{props.mobileViewer}</div>
      <div className="mobile-config-topbar">
        <div className="mobile-viewer-picker" title="Switch animal">
          <Leaf size={15} strokeWidth={1.7} />
          <select
            aria-label="Switch animal"
            value={props.animal.id}
            onChange={e => {
              const chosen = ANIMALS.find(a => a.id === e.target.value);
              if (chosen) props.onAnimal(chosen);
            }}
          >
            {presets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button className="icon-button mobile-viewer-close" aria-label="Close parameters" onClick={props.onMobileClose}><X size={20} /></button>
      </div>
    </div>
    <div className="inspector-heading"><div className="animal-title-row"><h2>{props.animal.name}</h2><span className="scientific-name">{props.animal.scientific}</span><button className="icon-button mobile-close" aria-label="Close parameters" onClick={props.onMobileClose}><X size={20} /></button></div></div>
    <div className="inspector-tabs" role="tablist" aria-label="Animal inspector">{(['Parameters', 'Parts', 'Details'] as InspectorTab[]).map(tab => <button role="tab" aria-selected={props.tab === tab} className={props.tab === tab ? 'active' : ''} onClick={() => props.onTab(tab)} key={tab}>{tab}{tab === 'Parts' && <span className="tab-dot" />}</button>)}</div>
    <div className="inspector-scroll" role="tabpanel" aria-label={props.tab}>
      {props.tab === 'Parameters' && <>
        <div className="preset-section"><div className="species-row"><div className="select-wrapper preset-select"><Leaf size={14} strokeWidth={1.5} /><select id="species-preset" aria-label="Species" value={props.animal.id} onChange={event => { const animal = ANIMALS.find(item => item.id === event.target.value); if (animal) props.onAnimal(animal); }}>{presets.map(animal => <option value={animal.id} key={animal.id}>{animal.name}</option>)}</select><ChevronDown size={13} /></div><div className="category-menu" ref={menuRef}><button className={`category-menu-button ${categoryOpen ? 'open' : ''}`} aria-label="Filter by category" aria-expanded={categoryOpen} title={props.category} onClick={() => setCategoryOpen(open => !open)}><LayoutGrid size={15} strokeWidth={1.6} /></button>{categoryOpen && <div className="category-menu-list" role="menu">{CATEGORIES.map(cat => <button key={cat} role="menuitem" className={props.category === cat ? 'active' : ''} onClick={() => { pickCategory(props.onCategory, props.onAnimal, props.animal, cat); setCategoryOpen(false); }}>{cat}<span>{cat === 'All animals' ? ANIMALS.length : ANIMALS.filter(a => a.category === cat).length}</span></button>)}</div>}</div></div></div>
        <section className="colorway-section"><div className="section-heading no-line"><h3>Colorway</h3><button className={`subtle-button ${editColors ? 'active' : ''}`} onClick={() => setEditColors(!editColors)}>{editColors ? 'Close palette' : 'Edit palette'}</button></div><div className="colorway-options">{Object.entries(colorways).map(([name, colors]) => <button key={name} onClick={() => props.onChange('colorway', name)} className={`colorway-option ${colorway === name ? 'selected' : ''}`} aria-pressed={colorway === name}><span className="colorway-swatch" style={{ background: `conic-gradient(from 35deg, ${colors.skin} 0deg 235deg, ${colors.underside} 235deg 320deg, ${colors.dark} 320deg 360deg)` }}>{colorway === name && <span><Check size={9} strokeWidth={2.5} /></span>}</span><span>{name === 'natural' ? 'Natural' : name === 'arctic' ? 'Arctic' : 'Dusk'}</span></button>)}</div>
        {editColors && <div className="zone-palette">{Object.entries(schema).filter(([, item]) => item.type === 'color').map(([key, item]) => <label key={key} title={item.label}><input type="color" value={String(props.options[key] || colorways[colorway]?.[key] || item.default)} onChange={event => props.onChange(key, event.target.value)} aria-label={item.label} /><span>{key === 'underside' ? 'Light' : key === 'skin' ? 'Body' : key === 'dark' ? 'Dark' : key === 'glass' ? 'Glass' : key === 'detail' ? 'Detail' : 'Accent'}</span></label>)}</div>}
        </section>
        <details className="parameter-section" open><summary><span>Body proportions</span><ChevronDown size={13} /></summary><div className="parameter-fields">{bodyRanges.map(([key, parameter]) => <RangeControl key={key} name={key} schema={parameter} value={Number(value(key))} onChange={props.onChange} />)}</div></details>
        {features.length > 0 && <details className="parameter-section" open><summary><span>Features</span><ChevronDown size={13} /></summary><div className="parameter-fields">{features.map(([key, parameter]) => <RangeControl key={key} name={key} schema={parameter} value={Number(value(key))} onChange={props.onChange} />)}{schema.antlers && <ToggleControl label="Antlers" checked={Boolean(value('antlers'))} onChange={() => props.onChange('antlers', !value('antlers'))} />}</div></details>}
        <details className="advanced-section"><summary><SlidersHorizontal size={14} /><span>Advanced settings</span><ChevronDown size={13} /></summary><div className="advanced-controls"><label className="control-label" htmlFor="detail-level">Geometry detail</label><div className="select-wrapper"><select id="detail-level" value={String(value('detailLevel'))} onChange={event => props.onChange('detailLevel', event.target.value)}>{schema.detailLevel.options?.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={13} /></div><ToggleControl label="Merge for production" checked={Boolean(value('mergeForProduction'))} onChange={() => props.onChange('mergeForProduction', !value('mergeForProduction'))} description={schema.mergeForProduction.describe} /></div></details>
      </>}
      {props.tab === 'Parts' && <div className="parts-content"><div className="parts-intro"><p>Select a part here or click it in the viewport.</p><button className="subtle-button" onClick={props.onShowAll}>Show all</button></div>{value('mergeForProduction') && <div className="inline-notice"><Info size={15} /><p>Production mode is on. <button onClick={() => props.onChange('mergeForProduction', false)}>Keep parts editable</button> to inspect the anatomy.</p></div>}
        {props.selectedPart && <div className="selected-part-detail"><span className="eyebrow">SELECTED PART</span><strong>{labelForPart(props.selectedPart)}</strong><div><button className="text-button" onClick={() => props.onTogglePart(props.selectedPart!)}>{props.hiddenParts.includes(props.selectedPart) ? <Eye size={13} /> : <EyeOff size={13} />}{props.hiddenParts.includes(props.selectedPart) ? 'Show part' : 'Hide part'}</button><button className="icon-button" aria-label="Deselect part" onClick={() => props.onSelectPart(null)}><X size={13} /></button></div></div>}
        <div className="parts-search"><Search size={14} /><input placeholder="Find a part..." aria-label="Search model parts" value={partQuery} onChange={event => setPartQuery(event.target.value)} /></div><div className="parts-list">{parts.map(part => <div className={`part-row ${props.selectedPart === part.name ? 'selected' : ''} ${props.hiddenParts.includes(part.name) ? 'part-hidden' : ''}`} key={part.name}><button className="part-select" onClick={() => props.onSelectPart(part.name)}>{part.isGroup ? <Layers3 size={14} /> : <Box size={14} />}<span>{part.label}</span>{part.isGroup && <small>{part.count}</small>}</button><button className="part-visibility" onClick={() => props.onTogglePart(part.name)} aria-label={`${props.hiddenParts.includes(part.name) ? 'Show' : 'Hide'} ${part.label}`}>{props.hiddenParts.includes(part.name) ? <EyeOff size={13} /> : <Eye size={13} />}</button></div>)}{!parts.length && <p className="empty-parts">No parts match your search.</p>}</div></div>}
      {props.tab === 'Details' && <div className="details-content"><span className="eyebrow">A CLOSER LOOK</span><p className="animal-description">{props.animal.description}</p><h3>In the wild</h3><dl className="detail-list"><div><dt>Habitat</dt><dd>{props.animal.habitat}</dd></div><div><dt>Body plan</dt><dd>{props.animal.bodyPlan}</dd></div></dl><h3><Ruler size={14} /> Real-world dimensions</h3><dl className="detail-list">{['Width', 'Height', 'Depth'].map((label, index) => <div key={label}><dt>{label}</dt><dd>{props.stats ? formatLength(props.stats.dimensions[index], true) : 'Calculating...'}</dd></div>)}</dl><h3><Box size={14} /> Under the surface</h3><dl className="detail-list"><div><dt>Triangles</dt><dd>{props.stats?.triangles.toLocaleString() || '...'}</dd></div><div><dt>Selectable meshes</dt><dd>{props.stats?.meshes || '...'}</dd></div><div><dt>Base materials</dt><dd>{props.stats?.materials || '...'}</dd></div><div><dt>License</dt><dd>CC0 1.0</dd></div></dl></div>}
    </div>
    <div className="inspector-footer"><button className="reset-button" onClick={props.onReset} title="Reset all parameters"><RotateCcw size={14} /><span>Reset</span></button><button className="primary-button save-button" onClick={props.onSave}><Bookmark size={14} strokeWidth={1.6} />Save variant</button></div>
  </aside>;
}