import { describe, expect, it } from 'vitest';
import {
  describeTarget,
  formatContext,
  formatElapsed,
  formatVram,
  matchesQuery,
  resolveDefaultTarget,
  sameTarget,
} from './aiChatUtils';
import { makeCatalogue, NODE_GARAGE, NODE_PC } from './aiTestData';

describe('aiChatUtils', () => {
  it('should format context windows in K and M', () => {
    expect(formatContext(8192)).toBe('8K');
    expect(formatContext(131072)).toBe('128K');
    expect(formatContext(512)).toBe('512');
    expect(formatContext(1048576)).toBe('1M');
    expect(formatContext(null)).toBeNull();
  });

  it('should format VRAM as used / total GB, or total only, or nothing', () => {
    expect(formatVram({ totalMb: 16384, usedMb: 9216 })).toBe('9.0 / 16.0 GB');
    expect(formatVram({ totalMb: 8192, usedMb: null })).toBe('8.0 GB total');
    expect(formatVram({ totalMb: null, usedMb: null })).toBeNull();
    expect(formatVram(undefined)).toBeNull();
  });

  it('should compare targets treating a missing node as Auto', () => {
    expect(sameTarget({ model: 'm', nodeId: null }, { model: 'm' })).toBe(true);
    expect(sameTarget({ model: 'm', nodeId: 'n1' }, { model: 'm', nodeId: null })).toBe(false);
    expect(sameTarget(null, { model: 'm' })).toBe(false);
  });

  it('should match queries case-insensitively against any field', () => {
    expect(matchesQuery('', 'x')).toBe(true);
    expect(matchesQuery(' QWEN ', 'qwen3:14b', 'Matt-PC')).toBe(true);
    expect(matchesQuery('rig', 'qwen3:14b', 'Matt-PC', undefined)).toBe(false);
  });

  it('should describe a target with Auto or the node name', () => {
    const catalogue = makeCatalogue();

    expect(describeTarget({ model: 'm', nodeId: null }, catalogue)).toEqual({ model: 'm', where: 'Auto' });
    expect(describeTarget({ model: 'm', nodeId: NODE_PC }, catalogue)).toEqual({ model: 'm', where: 'Matt-PC' });
    expect(describeTarget(null, catalogue)).toBeNull();
  });

  it('should keep the last target when the catalogue still has the model', () => {
    const catalogue = makeCatalogue();

    expect(resolveDefaultTarget({ model: 'qwen3:14b', nodeId: NODE_PC }, catalogue)).toEqual({ model: 'qwen3:14b', nodeId: NODE_PC });
    expect(resolveDefaultTarget({ model: 'qwen3:14b', nodeId: null }, catalogue)).toEqual({ model: 'qwen3:14b', nodeId: null });
  });

  it('should fall back to Auto when the pinned node is offline or no longer has the model', () => {
    const catalogue = makeCatalogue();

    expect(resolveDefaultTarget({ model: 'llama3.1:8b', nodeId: NODE_GARAGE }, catalogue)).toEqual({ model: 'llama3.1:8b', nodeId: null });
    expect(resolveDefaultTarget({ model: 'qwen3:14b', nodeId: 'node-rig' }, catalogue)).toEqual({ model: 'qwen3:14b', nodeId: null });
  });

  it('should pick a loaded model, else the first, when the last model is gone', () => {
    const catalogue = makeCatalogue();

    expect(resolveDefaultTarget({ model: 'gone:1b', nodeId: null }, catalogue)).toEqual({ model: 'llama3.1:8b', nodeId: null });
    expect(resolveDefaultTarget(null, { ...catalogue, models: catalogue.models.map((m) => ({ ...m, loadedOn: [] })) })).toEqual({
      model: 'llama3.1:8b',
      nodeId: null,
    });
  });

  it('should have no default target without models', () => {
    expect(resolveDefaultTarget({ model: 'm', nodeId: null }, null)).toBeNull();
    expect(resolveDefaultTarget({ model: 'm', nodeId: null }, { nodes: [], models: [] })).toBeNull();
  });

  it('should format elapsed times', () => {
    expect(formatElapsed(450)).toBe('450ms');
    expect(formatElapsed(2400)).toBe('2.4s');
    expect(formatElapsed(125000)).toBe('2m 5s');
  });
});
