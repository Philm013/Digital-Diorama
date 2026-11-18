import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MonitorX, RefreshCw } from 'lucide-react';
import { TerrainEngine } from '../terrain-engine';
import type { BrushSettings, ProjectState, SceneStats, Tool, ViewSettings } from '../studio';

export type ViewportHandle = {
  fit: () => void;
  zoom: (factor: number) => void;
  setCameraView: (view: '3d' | 'top') => void;
  screenshot: () => string | undefined;
  soften: () => void;
};
type Props = {
  project: ProjectState;
  view: ViewSettings;
  tool: Tool;
  brush: BrushSettings;
  onStats: (stats: SceneStats) => void;
  onSculpt: (heights: number[]) => void;
};

export const TerrainViewport = forwardRef<ViewportHandle, Props>(function TerrainViewport(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null), engineRef = useRef<TerrainEngine | null>(null);
  const callbackRef = useRef(props); callbackRef.current = props;
  const appliedProject = useRef<ProjectState | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useImperativeHandle(ref, () => ({
    fit: () => engineRef.current?.fit(), zoom: (factor) => engineRef.current?.zoom(factor),
    setCameraView: (view) => engineRef.current?.setCameraView(view), screenshot: () => engineRef.current?.screenshot(),
    soften: () => engineRef.current?.soften(),
  }), []);
  useEffect(() => {
    if (!hostRef.current) return;
    let engine: TerrainEngine | undefined;
    try {
      engine = new TerrainEngine(hostRef.current, (stats) => callbackRef.current.onStats(stats), (heights) => callbackRef.current.onSculpt(heights));
      engineRef.current = engine; engine.setProject(callbackRef.current.project); appliedProject.current = callbackRef.current.project; engine.setView(callbackRef.current.view); engine.setTool(callbackRef.current.tool, callbackRef.current.brush); setError(false);
    } catch (cause) { console.error('Unable to initialize the terrain viewport:', cause); engine?.dispose(); engineRef.current = null; setError(true); }
    return () => { engine?.dispose(); engineRef.current = null; appliedProject.current = null; };
  }, [retry]);
  useEffect(() => { if (engineRef.current && appliedProject.current !== props.project) { engineRef.current.setProject(props.project); appliedProject.current = props.project; } }, [props.project]);
  useEffect(() => { engineRef.current?.setView(props.view); }, [props.view]);
  useEffect(() => { engineRef.current?.setTool(props.tool, props.brush); }, [props.tool, props.brush]);
  return <>
    <div ref={hostRef} className="terrain-viewport" />
    {error && <div className="viewport-error"><MonitorX size={34} /><h2>A little more graphics power</h2><p>Terra needs WebGL 2. Enable hardware acceleration in your browser, then try again.</p><button className="button primary" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={15} /> Try again</button></div>}
  </>;
});