import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { MonitorX, RefreshCw } from 'lucide-react';
import { TerrainEngine } from '../terrain-engine';
import type { BrushSettings, CameraView, ProjectState, SceneStats, Stroke, Tool, TravelReport, ViewSettings } from '../studio';

export type ViewportHandle = {
  fit: () => void;
  zoomBy: (factor: number) => void;
  travelTo: (x: number, z: number) => void;
  setCameraView: (view: CameraView) => void;
  screenshot: () => string | undefined;
  calmRegion: () => void;
  engine: () => TerrainEngine | null;
};

type Props = {
  project: ProjectState;
  view: ViewSettings;
  tool: Tool;
  brush: BrushSettings;
  paused?: boolean;
  onStats: (stats: SceneStats) => void;
  onStroke: (stroke: Stroke) => void;
  onTravel: (report: TravelReport) => void;
};

export const TerrainViewport = forwardRef<ViewportHandle, Props>(function TerrainViewport(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TerrainEngine | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useImperativeHandle(ref, () => ({
    fit: () => engineRef.current?.fit(),
    zoomBy: (factor) => engineRef.current?.zoomBy(factor),
    travelTo: (x, z) => engineRef.current?.travelTo(x, z),
    setCameraView: (view) => engineRef.current?.setCameraView(view),
    screenshot: () => engineRef.current?.screenshot(),
    calmRegion: () => {
      const engine = engineRef.current;
      if (!engine) return;
      const bounds = engine.regionBounds();
      if (!bounds) return;
      const points: number[] = [];
      const radius = Math.max(60, bounds.span * 0.42);
      for (let ring = 0; ring < 3; ring++) {
        const r = radius * (ring / 2);
        const steps = ring === 0 ? 1 : 8;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2 + ring * 0.4;
          points.push(bounds.x + bounds.span / 2 + Math.cos(angle) * r, bounds.z + bounds.span / 2 + Math.sin(angle) * r);
        }
      }
      latest.current.onStroke({ mode: 'calm', r: radius * 0.62, k: 0.62, points });
    },
    engine: () => engineRef.current
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: TerrainEngine | undefined;
    try {
      engine = new TerrainEngine(host, {
        onStats: (stats) => latest.current.onStats(stats),
        onStroke: (stroke) => latest.current.onStroke(stroke),
        onTravel: (report) => latest.current.onTravel(report)
      });
      engineRef.current = engine;
      engine.setProject(latest.current.project);
      engine.setView(latest.current.view);
      engine.setTool(latest.current.tool);
      engine.setBrush(latest.current.brush);
      engine.setPaused(Boolean(latest.current.paused));
      setFailed(false);
    } catch (cause) {
      console.error('The terrain viewport could not start:', cause);
      engine?.dispose();
      engineRef.current = null;
      setFailed(true);
    }
    return () => { engine?.dispose(); engineRef.current = null; };
  }, [attempt]);

  useEffect(() => { engineRef.current?.setProject(props.project); }, [props.project]);
  useEffect(() => { engineRef.current?.setView(props.view); }, [props.view]);
  useEffect(() => { engineRef.current?.setTool(props.tool); }, [props.tool]);
  useEffect(() => { engineRef.current?.setBrush(props.brush); }, [props.brush]);
  useEffect(() => { engineRef.current?.setPaused(Boolean(props.paused)); }, [props.paused]);

  return <>
    <div ref={hostRef} className="terrain-viewport" />
    {failed && (
      <div className="viewport-error">
        <MonitorX size={34} />
        <h2>A little more graphics power</h2>
        <p>Terra renders with WebGL 2. Turn hardware acceleration on in your browser, then try again.</p>
        <button className="button primary" onClick={() => setAttempt((value) => value + 1)}><RefreshCw size={15} /> Try again</button>
      </div>
    )}
  </>;
});
