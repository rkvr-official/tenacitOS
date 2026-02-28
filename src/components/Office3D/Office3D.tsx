'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { AGENTS as STATIC_AGENTS } from './agentsConfig';
import type { AgentConfig, AgentState } from './agentsConfig';
import AgentDesk from './AgentDesk';
import Floor from './Floor';
import Walls from './Walls';
import Lights from './Lights';
import AgentPanel from './AgentPanel';
import FileCabinet from './FileCabinet';
import Whiteboard from './Whiteboard';
import CoffeeMachine from './CoffeeMachine';
import PlantPot from './PlantPot';
import WallClock from './WallClock';
import FirstPersonControls from './FirstPersonControls';
import MovingAvatar from './MovingAvatar';

export default function Office3D() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [interactionModal, setInteractionModal] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<'orbit' | 'fps'>('orbit');
  const [avatarPositions, setAvatarPositions] = useState<Map<string, Vector3>>(new Map());
  
  const [agents, setAgents] = useState<AgentConfig[]>(STATIC_AGENTS);

  // Agent state comes from /api/office when available; fallback to deterministic mock.
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(() => {
    const statuses: AgentState['status'][] = ['working', 'idle', 'thinking', 'working', 'idle', 'error'];
    return Object.fromEntries(
      STATIC_AGENTS.map((a, idx) => [
        a.id,
        {
          id: a.id,
          status: statuses[idx % statuses.length],
          currentTask:
            statuses[idx % statuses.length] === 'working'
              ? 'Running tasks…'
              : statuses[idx % statuses.length] === 'thinking'
                ? 'Reasoning…'
                : undefined,
          model: ['opus', 'sonnet', 'haiku'][idx % 3],
          tokensPerHour: statuses[idx % statuses.length] === 'idle' ? 0 : 5000 + idx * 1000,
          tasksInQueue: statuses[idx % statuses.length] === 'idle' ? 0 : 1 + (idx % 3),
          uptime: 5 + idx,
        } satisfies AgentState,
      ])
    );
  });

  const OFFICE_POSITIONS = useMemo(() => {
    // Positions by agent id. Uses the baked layout for known ids; otherwise assigns free desks.
    const map = new Map<string, [number, number, number]>();
    for (const a of STATIC_AGENTS) map.set(a.id, a.position);
    return map;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/office', { cache: 'no-store' });
        const json = await res.json();
        const apiAgents = (json?.agents ?? []) as Array<{
          id: string;
          name: string;
          emoji: string;
          color: string;
          role: string;
          currentTask?: string;
          status?: 'working' | 'thinking' | 'idle' | 'error' | 'sleeping';
          model?: string;
          tokensPerHour?: number;
          tasksInQueue?: number;
          uptime?: number;
        }>;

        if (!Array.isArray(apiAgents) || apiAgents.length === 0) return;

        // Ensure unique ids (duplicate ids cause avatars to collapse into one position/state)
        const seen = new Set<string>();
        const uniqueApiAgents = apiAgents.filter((a) => {
          if (!a?.id || seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        const nextAgents: AgentConfig[] = uniqueApiAgents.map((a, idx) => {
          // Prefer explicit layout positions by agent id.
          // Otherwise assign to a free static desk slot (deterministic by index).
          const pos = OFFICE_POSITIONS.get(a.id) ?? STATIC_AGENTS[idx % STATIC_AGENTS.length].position;
          return {
            id: a.id,
            name: a.name ?? a.id,
            emoji: a.emoji ?? '🤖',
            position: pos,
            color: a.color ?? '#666',
            role: a.role ?? 'Agent',
          };
        });

        const nextStates: Record<string, AgentState> = {};
        for (const a of uniqueApiAgents) {
          // /api/office is authoritative for status.
          // Map API -> Office3D internal state.
          const status: AgentState['status'] =
            a.status === 'working'
              ? 'working'
              : a.status === 'thinking'
                ? 'thinking'
                : a.status === 'error'
                  ? 'error'
                  : a.status === 'idle' || a.status === 'sleeping'
                    ? 'idle'
                    : 'idle';

          nextStates[a.id] = {
            id: a.id,
            status,
            currentTask: a.currentTask,
            model: (a as any).model,
            tokensPerHour: typeof (a as any).tokensPerHour === "number" ? (a as any).tokensPerHour : undefined,
            tasksInQueue: typeof (a as any).tasksInQueue === "number" ? (a as any).tasksInQueue : undefined,
            uptime: typeof (a as any).uptime === "number" ? (a as any).uptime : undefined,
          };
        }

        if (!cancelled) {
          setAgents(nextAgents);
          setAgentStates(nextStates);
        }
      } catch {
        // ignore and keep fallback
      }
    };

    load();
    // Poll a bit slower to reduce CPU/IO and keep UI responsive.
    const i = setInterval(load, 6000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [OFFICE_POSITIONS]);

  const handleDeskClick = (agentId: string) => {
    setSelectedAgent(agentId);
  };

  const handleClosePanel = () => {
    setSelectedAgent(null);
  };

  const handleFileCabinetClick = () => {
    setInteractionModal('memory');
  };

  const handleWhiteboardClick = () => {
    setInteractionModal('roadmap');
  };

  const handleCoffeeClick = () => {
    setInteractionModal('energy');
  };

  const handleCloseModal = () => {
    setInteractionModal(null);
  };

  const handleAvatarPositionUpdate = (id: string, position: Vector3) => {
    setAvatarPositions(prev => new Map(prev).set(id, position));
  };

  // Definir obstáculos (muebles)
  const obstacles = [
    // Escritorios (6)
    ...agents.map(agent => ({
      position: new Vector3(agent.position[0], 0, agent.position[2]),
      radius: 2.15
    })),
    // Archivador
    { position: new Vector3(-8, 0, -5), radius: 0.8 },
    // Pizarra
    { position: new Vector3(0, 0, -8), radius: 1.5 },
    // Máquina de café
    { position: new Vector3(8, 0, -5), radius: 0.6 },
    // Plantas
    { position: new Vector3(-7, 0, 6), radius: 0.5 },
    { position: new Vector3(7, 0, 6), radius: 0.5 },
    { position: new Vector3(-9, 0, 0), radius: 0.4 },
    { position: new Vector3(9, 0, 0), radius: 0.4 },
  ];

  return (
    <div className="fixed inset-0 bg-gray-900" style={{ height: '100vh', width: '100vw' }}>
      <Canvas
        camera={{ position: [0, 8, 12], fov: 60 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        }>
          {/* Iluminación */}
          <Lights />

          {/* Cielo y ambiente */}
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="sunset" />

          {/* Suelo */}
          <Floor />

          {/* Paredes */}
          <Walls />

          {/* Escritorios de agentes (sin avatares) */}
          {agents.map((agent) => (
            <AgentDesk
              key={agent.id}
              agent={agent}
              state={agentStates[agent.id] ?? ({ id: agent.id, status: 'idle' } as AgentState)}
              onClick={() => handleDeskClick(agent.id)}
              isSelected={selectedAgent === agent.id}
            />
          ))}

          {/* Avatares móviles */}
          {agents.map((agent) => (
            <MovingAvatar
              key={`avatar-${agent.id}`}
              agent={agent}
              state={agentStates[agent.id] ?? ({ id: agent.id, status: 'idle' } as AgentState)}
              officeBounds={{ minX: -8, maxX: 8, minZ: -7, maxZ: 7 }}
              obstacles={obstacles}
              otherAvatarPositions={avatarPositions}
              onPositionUpdate={handleAvatarPositionUpdate}
            />
          ))}

          {/* Mobiliario interactivo */}
          <FileCabinet
            position={[-8, 0, -5]}
            onClick={handleFileCabinetClick}
          />
          <Whiteboard
            position={[0, 0, -8]}
            rotation={[0, 0, 0]}
            onClick={handleWhiteboardClick}
          />
          <CoffeeMachine
            position={[8, 0.8, -5]}
            onClick={handleCoffeeClick}
          />

          {/* Decoración */}
          <PlantPot position={[-7, 0, 6]} size="large" />
          <PlantPot position={[7, 0, 6]} size="medium" />
          <PlantPot position={[-9, 0, 0]} size="small" />
          <PlantPot position={[9, 0, 0]} size="small" />
          <WallClock
            position={[0, 2.5, -8.4]}
            rotation={[0, 0, 0]}
          />

          {/* Controles de cámara */}
          {controlMode === 'orbit' ? (
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={30}
              maxPolarAngle={Math.PI / 2.2}
            />
          ) : (
            <FirstPersonControls
              moveSpeed={5}
              obstacles={obstacles.map((o) => ({ x: o.position.x, z: o.position.z, radius: o.radius + 0.25 }))}
            />
          )}
        </Suspense>
      </Canvas>

      {/* Panel lateral cuando se selecciona un agente */}
      {selectedAgent && (
        <AgentPanel
          agent={agents.find(a => a.id === selectedAgent)!}
          state={agentStates[selectedAgent] ?? ({ id: selectedAgent, status: 'idle' } as AgentState)}
          onClose={handleClosePanel}
        />
      )}

      {/* Modal de interacciones con objetos */}
      {interactionModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-yellow-500 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-yellow-400">
                {interactionModal === 'memory' && '📁 Memory Browser'}
                {interactionModal === 'roadmap' && '📋 Roadmap & Planning'}
                {interactionModal === 'energy' && '☕ Agent Energy Dashboard'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="text-gray-300 space-y-4">
              {interactionModal === 'memory' && (
                <>
                  <p className="text-lg">🧠 Access to workspace memories and files</p>
                  <div className="bg-gray-800 p-4 rounded border border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Quick links:</p>
                    <ul className="space-y-2">
                      <li><a href="/memory" className="text-yellow-400 hover:underline">→ Full Memory Browser</a></li>
                      <li><a href="/files" className="text-yellow-400 hover:underline">→ File Explorer</a></li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-500 italic">
                    This would show a file tree of memory/*.md and workspace files
                  </p>
                </>
              )}

              {interactionModal === 'roadmap' && (
                <>
                  <p className="text-lg">🗺️ Project roadmap and planning board</p>
                  <div className="bg-gray-800 p-4 rounded border border-gray-700">
                    <p className="text-sm text-gray-400 mb-2">Active phases:</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        <span>Phase 0: TenacitOS Shell</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-yellow-400">●</span>
                        <span>Phase 8: The Office 3D (MVP)</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-gray-500">○</span>
                        <span>Phase 2: File Browser Pro</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-500 italic">
                    Full roadmap available at workspace/mission-control/ROADMAP.md
                  </p>
                </>
              )}

              {interactionModal === 'energy' && (
                <>
                  <p className="text-lg">⚡ Agent activity and energy levels</p>
                  <div className="bg-gray-800 p-4 rounded border border-gray-700 space-y-3">
                    <div>
                      <p className="text-sm text-gray-400">Tokens consumed today:</p>
                      <p className="text-2xl font-bold text-yellow-400">47,000</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Active agents:</p>
                      <p className="text-2xl font-bold text-green-400">3 / 6</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">System uptime:</p>
                      <p className="text-2xl font-bold text-blue-400">12h 34m</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 italic">
                    This would show real-time agent mood/productivity metrics
                  </p>
                </>
              )}
            </div>

            <button
              onClick={handleCloseModal}
              className="mt-6 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Controles UI overlay */}
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
        <h2 className="text-lg font-bold mb-2">🏢 The Office</h2>
        <div className="text-sm space-y-1 mb-3">
          <p><strong>Mode: {controlMode === 'orbit' ? '🖱️ Orbit' : '🎮 FPS'}</strong></p>
          {controlMode === 'orbit' ? (
            <>
              <p>🖱️ Mouse: Rotar vista</p>
              <p>🔄 Scroll: Zoom</p>
              <p>👆 Click: Seleccionar</p>
            </>
          ) : (
            <>
              <p>Click to lock cursor</p>
              <p>WASD/Arrows: Mover</p>
              <p>Space: Subir | Shift: Bajar</p>
              <p>Mouse: Mirar | ESC: Unlock</p>
            </>
          )}
        </div>
        <button
          onClick={() => setControlMode(controlMode === 'orbit' ? 'fps' : 'orbit')}
          className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-2 px-3 rounded text-xs transition-colors"
        >
          Switch to {controlMode === 'orbit' ? 'FPS Mode' : 'Orbit Mode'}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
        <h3 className="text-sm font-bold mb-2">Estados</h3>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Working</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Thinking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
            <span>Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Error</span>
          </div>
        </div>
      </div>
    </div>
  );
}
