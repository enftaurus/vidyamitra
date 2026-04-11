import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── Node colour palette by type ─────────────────────────────────────────────
const NODE_STYLES = {
  start: {
    bg: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    border: '#8b5cf6',
    badge: '#c4b5fd',
    icon: '🚀',
  },
  concept: {
    bg: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
    border: '#3b82f6',
    badge: '#93c5fd',
    icon: '💡',
  },
  step: {
    bg: 'linear-gradient(135deg, #065f46, #047857)',
    border: '#10b981',
    badge: '#6ee7b7',
    icon: '⚙️',
  },
  milestone: {
    bg: 'linear-gradient(135deg, #92400e, #b45309)',
    border: '#f59e0b',
    badge: '#fde68a',
    icon: '🏁',
  },
  resource: {
    bg: 'linear-gradient(135deg, #831843, #9d174d)',
    border: '#ec4899',
    badge: '#fbcfe8',
    icon: '📚',
  },
  end: {
    bg: 'linear-gradient(135deg, #064e3b, #065f46)',
    border: '#34d399',
    badge: '#a7f3d0',
    icon: '✅',
  },
};

// ── Custom React Flow node ────────────────────────────────────────────────────
function RoadmapNode({ data }) {
  const style = NODE_STYLES[data.nodeType] || NODE_STYLES.step;

  return (
    <div
      style={{
        background: style.bg,
        border: `1.5px solid ${style.border}`,
        borderRadius: '14px',
        padding: '14px 18px',
        minWidth: '220px',
        maxWidth: '280px',
        boxShadow: `0 0 20px ${style.border}30, 0 4px 24px rgba(0,0,0,0.4)`,
        color: '#f1f5f9',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: style.border, border: 'none', width: 8, height: 8 }} />

      {/* Type badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: `${style.badge}20`,
        border: `1px solid ${style.badge}40`,
        borderRadius: '20px',
        padding: '2px 8px',
        fontSize: '0.65rem',
        color: style.badge,
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: '8px',
      }}>
        {style.icon} {data.nodeType}
      </div>

      {/* Label */}
      <div style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3, marginBottom: '6px', color: '#f8fafc' }}>
        {data.label}
      </div>

      {/* Description */}
      {data.description && (
        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '6px' }}>
          {data.description}
        </div>
      )}

      {/* Time estimate */}
      {data.estimated_time && (
        <div style={{
          fontSize: '0.7rem',
          color: style.badge,
          fontWeight: 500,
          marginBottom: '6px',
        }}>
          ⏱ {data.estimated_time}
        </div>
      )}

      {/* Resources */}
      {data.resources && data.resources.length > 0 && (
        <div style={{ marginTop: '8px', borderTop: `1px solid ${style.border}40`, paddingTop: '8px' }}>
          <div style={{ fontSize: '0.65rem', color: style.badge, fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Resources
          </div>
          {data.resources.map((r, i) => (
            <div key={i} style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '2px' }}>
              → {r}
            </div>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: style.border, border: 'none', width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { roadmapNode: RoadmapNode };

// ── Auto-layout: stack nodes vertically in columns ───────────────────────────
function buildLayoutedNodes(rawNodes, rawEdges) {
  const NODE_W = 280;
  const NODE_H = 220;
  const H_GAP = 80;
  const V_GAP = 100;

  // BFS to find levels
  const adjacency = {};
  rawNodes.forEach(n => { adjacency[n.id] = []; });
  rawEdges.forEach(e => { if (adjacency[e.source]) adjacency[e.source].push(e.target); });

  const levels = {};
  const queue = [rawNodes[0]?.id].filter(Boolean);
  const visited = new Set(queue);
  queue.forEach(id => { levels[id] = 0; });

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const next of (adjacency[cur] || [])) {
      if (!visited.has(next)) {
        visited.add(next);
        levels[next] = (levels[cur] || 0) + 1;
        queue.push(next);
      }
    }
  }

  // Group by level
  const byLevel = {};
  rawNodes.forEach(n => {
    const level = levels[n.id] ?? 0;
    if (!byLevel[level]) byLevel[level] = [];
    byLevel[level].push(n.id);
  });

  const maxPerRow = 3;
  const positioned = {};

  Object.keys(byLevel)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(level => {
      const ids = byLevel[level];
      ids.forEach((id, idx) => {
        const col = idx % maxPerRow;
        const row = Math.floor(idx / maxPerRow);
        positioned[id] = {
          x: col * (NODE_W + H_GAP),
          y: (Number(level) + row) * (NODE_H + V_GAP),
        };
      });
    });

  return rawNodes.map(n => ({
    id: n.id,
    type: 'roadmapNode',
    position: positioned[n.id] || { x: 0, y: 0 },
    data: {
      label: n.label,
      nodeType: n.node_type,
      description: n.description,
      resources: n.resources,
      estimated_time: n.estimated_time,
    },
  }));
}

// ── Main React Flow component ─────────────────────────────────────────────────
export default function RoadmapFlow({ nodes: rawNodes = [], edges: rawEdges = [], title }) {
  const nodes = useMemo(() => buildLayoutedNodes(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const edges = useMemo(() =>
    rawEdges.map((e, i) => ({
      id: `e${i}`,
      source: String(e.source),
      target: String(e.target),
      label: e.label || undefined,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      labelStyle: { fill: '#94a3b8', fontSize: 11 },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 16, height: 16 },
    })),
    [rawEdges]
  );

  return (
    <div style={{ width: '100%', height: '700px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #1e293b' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0a0f1e' }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px' }} />
        <MiniMap
          nodeColor={n => (NODE_STYLES[n.data?.nodeType]?.border || '#6366f1')}
          style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px' }}
        />
      </ReactFlow>
    </div>
  );
}
