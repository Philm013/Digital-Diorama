import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { cachedThumb, requestThumb } from './thumbs3d';

/** a 3D portrait of an asset, rendered lazily when scrolled into view (emoji until then) */
export function AssetThumb({ id, emoji, className, size = 56, silhouette }: { id: string; emoji: string; className?: string; size?: number; silhouette?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | undefined>(() => cachedThumb(id));
  useEffect(() => {
    if (url !== undefined) return;
    const el = ref.current;
    if (!el) return;
    let cancel = () => {};
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { cancel = requestThumb(id, (u) => setUrl(u)); io.disconnect(); }
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => { io.disconnect(); cancel(); };
  }, [id, url]);
  return (
    <div ref={ref} className={clsx('relative grid place-items-center', className)} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="" draggable={false} className={clsx('dd-thumb-in h-full w-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]', silhouette && 'brightness-0 opacity-30')} />
      ) : (
        <span className={clsx('leading-none drop-shadow-sm', url === undefined && 'dd-shimmer-text', silhouette && 'grayscale opacity-40')} style={{ fontSize: size * 0.52 }}>{emoji}</span>
      )}
    </div>
  );
}
