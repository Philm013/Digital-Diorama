import { useMemo } from 'react';
import { ArrowDownWideNarrow, ArrowRight, Bookmark, Check, ChevronDown, Network, Search, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ANIMALS, CATEGORIES, type Animal, type AnimalOptions } from '../data/catalog';
import AnimalThumbnail from './AnimalThumbnail';

export interface SavedVariant {
  id: string;
  animalId: string;
  name: string;
  options: AnimalOptions;
  savedAt: number;
}
interface Props {
  selected: Animal;
  query: string;
  onQuery: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  phylum: string;
  onClearPhylum: () => void;
  onPhyla: () => void;
  onSelect: (animal: Animal) => void;
  saved: boolean;
  variants: SavedVariant[];
  selectedVariant: string | null;
  onVariant: (variant: SavedVariant) => void;
  onDelete: (id: string) => void;
  onExplore: () => void;
  alphabetical: boolean;
  onSort: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Library(props: Props) {
  const filtered = useMemo(() => {
    const query = props.query.toLowerCase().trim();
    const source = ANIMALS.filter(animal => (!props.phylum || animal.phylum === props.phylum) && (props.category === 'All animals' || animal.category === props.category) && (!query || `${animal.name} ${animal.scientific} ${animal.phylum} ${animal.category} ${animal.habitat}`.toLowerCase().includes(query)));
    return props.alphabetical ? [...source].sort((a, b) => a.name.localeCompare(b.name)) : source;
  }, [props.query, props.category, props.phylum, props.alphabetical]);
  const savedVariants = props.variants.filter(variant => {
    const animal = ANIMALS.find(item => item.id === variant.animalId);
    return animal && (!props.phylum || animal.phylum === props.phylum) && (props.category === 'All animals' || animal.category === props.category) && (!props.query || `${variant.name} ${animal.name} ${animal.scientific} ${animal.phylum}`.toLowerCase().includes(props.query.toLowerCase().trim()));
  }).sort((a, b) => props.alphabetical ? a.name.localeCompare(b.name) : b.savedAt - a.savedAt);
  const count = props.saved ? savedVariants.length : filtered.length;

  return <aside className={`library-panel ${props.mobileOpen ? 'mobile-is-open' : ''}`} aria-label="Animal library">
    <div className="library-heading"><div><h1>{props.saved ? 'My collection' : 'Animal library'}</h1><p>{props.saved ? 'Your own corner of the wild.' : 'Find your kind of wild.'}</p></div><button className="icon-button mobile-close" aria-label="Close animal library" onClick={props.onMobileClose}><X size={20} /></button></div>
    <div className="library-search-wrap"><Search size={16} strokeWidth={1.6} /><input aria-label="Search animals" placeholder="Search animals..." value={props.query} onChange={event => props.onQuery(event.target.value)} />{props.query ? <button aria-label="Clear search" onClick={() => props.onQuery('')}><X size={13} /></button> : <kbd>/</kbd>}</div>
    <div className="library-filters"><div className="select-wrapper"><select value={props.category} onChange={event => props.onCategory(event.target.value)} aria-label="Filter by animal category">{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select><ChevronDown size={13} /></div></div>
    {props.phylum && <div className="active-filter"><Network size={12} /><span>{props.phylum}</span><button onClick={props.onClearPhylum} aria-label="Clear phylum filter"><X size={12} /></button></div>}
    <div className="library-section-label"><span>{props.saved ? 'SAVED VARIANTS' : props.phylum ? props.phylum.toUpperCase() : props.category !== 'All animals' ? props.category.toUpperCase() : 'THE COLLECTION'} <span className="species-count">{count}</span></span><button onClick={props.onSort} title={props.alphabetical ? 'Show curated order' : 'Sort alphabetically'} aria-label={props.alphabetical ? 'Show curated order' : 'Sort alphabetically'} className={props.alphabetical ? 'active' : ''}><ArrowDownWideNarrow size={14} /></button></div>
    <div className="library-scroll">
      {count ? <div className="animal-grid">
        {props.saved ? savedVariants.map(variant => {
          const animal = ANIMALS.find(item => item.id === variant.animalId)!;
          return <motion.div layout="position" key={variant.id} className="saved-animal-wrap"><button className={`animal-card ${props.selectedVariant === variant.id ? 'selected' : ''}`} onClick={() => props.onVariant(variant)} aria-pressed={props.selectedVariant === variant.id}><AnimalThumbnail animal={animal} options={variant.options} /><div className="animal-card-copy"><strong title={variant.name}>{variant.name}</strong><span>{animal.name}</span></div>{props.selectedVariant === variant.id && <span className="animal-selected-check"><Check size={9} strokeWidth={2.5} /></span>}</button><button className="delete-variant" aria-label={`Delete ${variant.name}`} onClick={() => props.onDelete(variant.id)}><Trash2 size={12} /></button></motion.div>;
        }) : filtered.map((animal, index) => <motion.button layout="position" initial={index < 8 ? { opacity: 0, y: 7 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(index, 7) * 0.035 }} key={animal.id} className={`animal-card ${props.selected.id === animal.id ? 'selected' : ''}`} onClick={() => props.onSelect(animal)} aria-pressed={props.selected.id === animal.id}>
          <AnimalThumbnail animal={animal} /><div className="animal-card-copy"><strong>{animal.name}</strong><span>{animal.category === 'Microscopic' ? 'Microfauna' : animal.category}</span></div>{props.selected.id === animal.id && <span className="animal-selected-check"><Check size={9} strokeWidth={2.5} /></span>}
        </motion.button>)}
      </div> : <div className="library-empty">{props.saved ? <Bookmark size={28} strokeWidth={1.2} /> : <Search size={27} strokeWidth={1.2} />}<h3>{props.saved && !props.query ? 'A collection of your own' : 'Nothing in the undergrowth'}</h3><p>{props.saved && !props.query ? 'Make an animal your own, then save a variant to find it here.' : 'Try another name or open up your filters.'}</p><button className="text-button" onClick={props.saved ? props.onExplore : () => { props.onQuery(''); props.onCategory('All animals'); props.onClearPhylum(); }}>{props.saved ? 'Explore the animals' : 'Clear all filters'}<ArrowRight size={13} /></button></div>}
    </div>
    <button className="phyla-link" onClick={props.onPhyla}><Network size={19} strokeWidth={1.5} /><span>Explore all <strong>34 phyla</strong></span><ArrowRight size={15} /></button>
  </aside>;
}