import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BuilderNode } from '@/lib/builder';
import { Chessboard } from 'react-chessboard';

const CustomNode = ({ data }: any) => {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white dark:bg-gray-800 border-2 flex flex-col items-center relative
      ${data.source === 'maia' ? 'border-blue-500' : data.source === 'stockfish' ? 'border-green-500' : 'border-gray-800 dark:border-gray-600'}
    `}>
      {/* Delete button */}
      {data.onDeleteNode && data.source !== 'root' && (
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold leading-none flex items-center justify-center z-10"
          onClick={() => data.onDeleteNode(data.id)}
          title="Delete this branch"
        >×</button>
      )}
      <div className="font-bold text-lg dark:text-white">{data.label}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{data.source === 'root' ? 'Start' : data.source === 'maia' ? 'Maia' : 'Stockfish'}</div>
      <div className="w-24 h-24 mt-2 pointer-events-none">
         <Chessboard 
           options={{ position: data.fen, allowDragging: false }} 
         />
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export default function RepertoireGraph({ root, onDeleteNode }: { root: BuilderNode, onDeleteNode?: (id: string) => void }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    let branchY = 0;
    const HORIZONTAL_SPACING = 250;
    const VERTICAL_SPACING = 250;
    
    // Simple tree layout: if a node has multiple children, we spread them vertically.
    // If it has one child, it continues on the same Y.
    const traverse = (node: BuilderNode, depth: number, currentY: number): number => {
      nodes.push({
        id: node.id,
        type: 'custom',
        position: { x: depth * HORIZONTAL_SPACING, y: currentY },
        data: { 
          label: node.moveSan, 
          source: node.source,
          fen: node.fen,
          id: node.id,
          onDeleteNode,
        },
      });
      
      let nextY = currentY;
      
      if (node.children.length === 0) {
        return nextY + VERTICAL_SPACING;
      }
      
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        
        edges.push({
          id: `${node.id}->${child.id}`,
          source: node.id,
          target: child.id,
          animated: child.source === 'stockfish',
          style: { stroke: child.source === 'maia' ? '#3b82f6' : '#22c55e', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
        
        if (i > 0) {
           nextY = branchY;
        }
        
        branchY = traverse(child, depth + 1, nextY);
      }
      
      return branchY;
    };
    
    traverse(root, 0, 0);
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [root]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update when root changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
