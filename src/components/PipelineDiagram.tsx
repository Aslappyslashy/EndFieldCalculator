import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
  MarkerType,
  ReactFlowProvider,
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2 } from 'lucide-react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ZoneFlowGraph } from '../utils/flowGraph';

const elk = new ELK();

// Custom node styles by type
const nodeColors: Record<string, { bg: string; border: string; text: string }> = {
  pool: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  recipe: { bg: '#1f2937', border: '#f59e0b', text: '#fcd34d' },
  sold: { bg: '#14532d', border: '#22c55e', text: '#86efac' },
  zoneIn: { bg: '#312e81', border: '#6366f1', text: '#a5b4fc' },
  zoneOut: { bg: '#4c1d95', border: '#a855f7', text: '#d8b4fe' },
};

// Edge colors by kind
const edgeColors: Record<string, string> = {
  local: '#eab308',
  fromPool: '#60a5fa',
  toPool: '#a78bfa',
  sold: '#4ade80',
  interzone: '#f472b6',
};

// Custom Multi-Lane Edge Component
const MultiLaneEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const rawLanes = (data as any)?.lanes || 1;
  const lanes = Math.max(1, Math.round(rawLanes));
  const laneSpacing = 5;
  const paths = [];

  for (let i = 0; i < lanes; i++) {
    const offset = (i - (lanes - 1) / 2) * laneSpacing;
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY: sourceY + offset,
      sourcePosition,
      targetX,
      targetY: targetY + offset,
      targetPosition,
    });
    paths.push(path);
  }

  // Adjust style for visibility: thicker base if many lanes
  const mergedStyle = {
    ...style,
    strokeWidth: lanes > 1 ? 1.8 : 1.5
  };

  return (
    <>
      {paths.map((path, i) => (
        <BaseEdge key={`${id}-${i}`} id={`${id}-${i}`} path={path} style={mergedStyle} markerEnd={i === 0 ? markerEnd : undefined} />
      ))}
    </>
  );
};

const edgeTypes = {
  multiLane: MultiLaneEdge,
};

interface ElkNode {
  id: string;
  width: number;
  height: number;
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

interface ElkGraph {
  id: string;
  layoutOptions: Record<string, string>;
  children: ElkNode[];
  edges: ElkEdge[];
}

async function layoutWithElk(graph: ZoneFlowGraph, savedPositions?: Record<string, { x: number; y: number }>): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const nodeWidth = 160;
  const nodeHeight = 60;

  // Build ELK graph
  const elkGraph: ElkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: graph.nodes.map(n => ({
      id: n.id,
      width: nodeWidth,
      height: nodeHeight,
    })),
    edges: graph.edges.map((e, i) => ({
      id: e.id || `edge-${i}`,
      sources: [e.from],
      targets: [e.to],
    })),
  };

  // Run ELK layout
  const layoutedGraph = await elk.layout(elkGraph);

  // Convert to ReactFlow nodes
  const nodes: Node[] = (layoutedGraph.children || []).map(elkNode => {
    const original = graph.nodes.find(n => n.id === elkNode.id);
    const colors = nodeColors[original?.type || 'recipe'] || nodeColors.recipe;

    return {
      id: elkNode.id,
      position: savedPositions?.[elkNode.id] || { x: elkNode.x || 0, y: elkNode.y || 0 },
      data: {
        label: (
          <div style={{ padding: '4px 8px', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 12 }}>{original?.label || elkNode.id}</div>
            {original?.sublabel && (
              <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{original.sublabel}</div>
            )}
          </div>
        ),
      },
      style: {
        background: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius: 8,
        color: colors.text,
        width: nodeWidth,
        height: nodeHeight,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  // Convert to ReactFlow edges
  const edges: Edge[] = graph.edges.map((edge, idx) => {
    const color = edgeColors[edge.kind] || '#888';


    return {
      id: edge.id || `edge-${idx}`,
      source: edge.from,
      target: edge.to,
      type: 'multiLane',
      data: { lanes: edge.lanes },
      animated: edge.kind === 'fromPool' || edge.kind === 'toPool',
      label: edge.itemName,
      labelStyle: {
        fill: color,
        fontSize: 9,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: 'rgba(0,0,0,0.85)',
        fillOpacity: 0.85,
      },
      labelBgPadding: [4, 2] as [number, number],
      labelShowBg: true,
      style: { stroke: color, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 15, height: 15 },
    };
  });

  return { nodes, edges };
}

function PipelineDiagramInner(props: {
  graph: ZoneFlowGraph;
  savedPositions?: Record<string, { x: number; y: number }>;
  onLayoutChange?: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  const { graph, savedPositions, onLayoutChange } = props;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isLayouting, setIsLayouting] = useState(true);

  // Run ELK layout when graph changes
  useEffect(() => {
    let cancelled = false;
    setIsLayouting(true);

    layoutWithElk(graph, savedPositions).then(({ nodes: layoutedNodes, edges: layoutedEdges }) => {
      if (cancelled) return;
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setIsLayouting(false);
    }).catch(err => {
      console.error('ELK layout failed:', err);
      setIsLayouting(false);
    });

    return () => { cancelled = true; };
  }, [graph, setNodes, setEdges, savedPositions]);

  const onNodeDragStop = useCallback(() => {
    if (onLayoutChange) {
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach(node => {
        positions[node.id] = node.position;
      });
      onLayoutChange(positions);
    }
  }, [nodes, onLayoutChange]);

  const handleResetLayout = () => {
    if (onLayoutChange) onLayoutChange({}); // Clear saved positions
  };

  const nodeColor = useCallback((node: Node) => {
    const type = graph.nodes.find(n => n.id === node.id)?.type || 'recipe';
    return nodeColors[type]?.border || '#888';
  }, [graph]);

  if (isLayouting) {
    return (
      <div className="pipeline-view" style={{
        width: '100%',
        height: '100%',
        minHeight: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#94a3b8'
      }}>
        Computing layout...
      </div>
    );
  }

  return (
    <div className="pipeline-view" style={{ width: '100%', height: '100%', minHeight: 400 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{ type: 'multiLane' }}
      >
        <Background color="#334155" gap={20} />
        <Controls />
        <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 4, display: 'flex', gap: 8 }}>
          <button onClick={handleResetLayout} className="btn btn-small btn-secondary flex items-center gap-1">
            <Maximize2 size={12} /> Auto Layout / 重置
          </button>
        </div>
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(0, 0, 0, 0.8)"
          style={{ background: '#1e293b' }}
        />
      </ReactFlow>
    </div>
  );
}

export function PipelineDiagram(props: {
  graph: ZoneFlowGraph;
  savedPositions?: Record<string, { x: number; y: number }>;
  onLayoutChange?: (positions: Record<string, { x: number; y: number }>) => void;
}) {
  return (
    <ReactFlowProvider>
      <PipelineDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
