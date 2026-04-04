import { Plus, Zap, Activity, Sparkles } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../store/appStore'
import { AgentCard } from '../components/ui/AgentCard'

export function AgentSwarmView() {
  const { agents, launchSwarm, spawnAgent, swarmGoal, setSwarmGoal } = useAppStore(
    useShallow(s => ({
      agents: s.agents,
      launchSwarm: s.launchSwarm,
      spawnAgent: s.spawnAgent,
      swarmGoal: s.swarmGoal,
      setSwarmGoal: s.setSwarmGoal,
    }))
  )
  const running = agents.filter(a => a.status === 'running').length
  const total = agents.length

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#7f77dd22' }}>
            <Zap size={18} style={{ color: '#7f77dd' }} />
          </div>
          <div>
            <h1 className="font-bold text-[#e8e8ef] text-lg">Agent Swarm</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Activity size={11} className="text-[#6b6b78]" />
              <span className="text-xs text-[#6b6b78]">
                {running} running · {total} total
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            void spawnAgent()
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{
            background: '#7f77dd',
            boxShadow: '0 2px 12px rgba(127,119,221,0.35)',
          }}
        >
          <Plus size={15} />
          Spawn Agent
        </button>
      </div>

      <div className="px-6 py-4 border-b border-[#2a2a2e] bg-[#101013]">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <textarea
            value={swarmGoal}
            onChange={event => setSwarmGoal(event.target.value)}
            rows={3}
            placeholder="Describe the goal for the orchestrator or the next worker agent."
            className="w-full bg-[#141418] border border-[#2a2a2e] rounded-xl px-4 py-3 text-sm text-[#e8e8ef] resize-none outline-none focus:border-[#7f77dd]/60"
          />
          <button
            onClick={() => {
              void spawnAgent()
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
            style={{
              background: '#7f77dd',
              boxShadow: '0 2px 12px rgba(127,119,221,0.35)',
            }}
          >
            <Plus size={15} />
            Spawn Agent
          </button>
          <button
            onClick={() => {
              void launchSwarm()
            }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-[#0d0d0f] transition-all hover:opacity-90 active:scale-95"
            style={{
              background: '#d9f27f',
              boxShadow: '0 2px 12px rgba(217,242,127,0.28)',
            }}
          >
            <Sparkles size={15} />
            Run Orchestrator
          </button>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#1c1c22' }}>
              <Zap size={28} className="text-[#2a2a2e]" />
            </div>
            <p className="text-[#6b6b78] text-sm">
              No agents spawned yet.
              <br />
              Use the goal box to start a single worker or a full orchestrated swarm.
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
