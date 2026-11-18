import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import type { Animal, AnimalOptions } from '../data/catalog';
import { getThumbnail } from '../engine/studio';

export default function AnimalThumbnail({ animal, options = {} }: { animal: Animal; options?: AnimalOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState('');
  const [failed, setFailed] = useState(false);
  const optionKey = JSON.stringify(options);

  useEffect(() => {
    let cancelled = false;
    setImage(''); setFailed(false);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      getThumbnail(animal, JSON.parse(optionKey)).then(url => { if (!cancelled) setImage(url); }).catch(() => { if (!cancelled) setFailed(true); });
    }, { rootMargin: '150px' });
    if (ref.current) observer.observe(ref.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [animal, optionKey]);

  return <div ref={ref} className={`animal-thumbnail ${image ? 'is-ready' : ''}`}>
    {image ? <img src={image} alt={`Low-poly ${animal.name.toLowerCase()}`} draggable={false} /> : failed ? <Box size={26} strokeWidth={1} aria-label="3D model" /> : <span className="thumbnail-loading" />}
  </div>;
}