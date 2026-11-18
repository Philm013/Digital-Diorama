import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { HAT_TYPES } from './blocks';

export interface HatInstance {
  type: string;
  blockId: string;
  key?: string;
  msg?: string;
  secs?: number;
  when?: string;
  target?: string;
  fn: (api: unknown) => Promise<void>;
}
/** Calling a factory creates a fresh set of script closures (own variables) for one object or clone. */
export type ScriptFactory = () => HatInstance[];

export interface CompileResult { factory: ScriptFactory | null; error?: string; source?: string; hatCount: number }

export function compileScripts(json: unknown, opts: { highlight: boolean; onlyBlock?: string } = { highlight: true }): CompileResult {
  if (!json) return { factory: null, hatCount: 0 };
  const ws = new Blockly.Workspace();
  const G = javascriptGenerator;
  try {
    Blockly.serialization.workspaces.load(json as Blockly.serialization.blocks.State, ws, { recordUndo: false });
    G.STATEMENT_PREFIX = opts.highlight ? 'api.hl(%1);\n' : null;
    G.init(ws);
    const entries: string[] = [];
    let hatCount = 0;
    for (const top of ws.getTopBlocks(true)) {
      if (top.type.startsWith('procedures_def')) { G.blockToCode(top); continue; }
      const isHat = HAT_TYPES.has(top.type);
      if (opts.onlyBlock) {
        if (top.id !== opts.onlyBlock) continue;
      } else if (!isHat) continue;
      const first = isHat ? top.getNextBlock() : top;
      const body = first ? (G.blockToCode(first) as string) : '';
      const meta: Record<string, unknown> = { type: opts.onlyBlock ? 'run' : top.type, blockId: top.id };
      if (top.type === 'dd_when_key') meta.key = top.getFieldValue('KEY');
      if (top.type === 'dd_when_receive') meta.msg = String(top.getFieldValue('MSG') ?? '').trim().toLowerCase();
      if (top.type === 'dd_when_every') meta.secs = Number(top.getFieldValue('SECS')) || 1;
      if (top.type === 'dd_when_time') meta.when = top.getFieldValue('WHEN');
      if (top.type === 'dd_when_touch') meta.target = top.getFieldValue('OBJ');
      entries.push(`{ ...${JSON.stringify(meta)}, fn: async (api) => {\n${body}} }`);
      hatCount++;
    }
    const defs = G.finish('');
    const source = `"use strict";\n${defs}\nreturn [\n${entries.join(',\n')}\n];`;
    // eslint-disable-next-line no-new-func
    const factory = new Function(source) as ScriptFactory;
    return { factory, source, hatCount };
  } catch (e) {
    return { factory: null, error: (e as Error).message, hatCount: 0 };
  } finally {
    G.STATEMENT_PREFIX = null;
    ws.dispose();
  }
}
