import { Server, Plus, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import type { MCPServer } from '../types'

const MOCK_SERVERS: MCPServer[] = [
  { id: 'm1', name: 'filesystem', url: 'stdio://mcp-filesystem', status: 'connected', toolsCount: 8 },
  { id: 'm2', name: 'github', url: 'https://mcp.github.com', status: 'connected', toolsCount: 14 },
  { id: 'm3', name: 'postgres', url: 'stdio://mcp-postgres', status: 'connected', toolsCount: 6 },
  { id: 'm4', name: 'brave-search', url: 'https://mcp.brave.com', status: 'disconnected', toolsCount: 2 },
  { id: 'm5', name: 'slack', url: 'https://mcp.slack.com', status: 'error', toolsCount: 5 },
]

const STATUS_CFG = {
  connected: { Icon: CheckCircle, color: '#1d9e75', bg: '#1d9e7515', label: 'Connected' },
  disconnected: { Icon: XCircle, color: '#6b6b78', bg: '#6b6b7815', label: 'Disconnected' },
  error: { Icon: AlertCircle, color: '#e05050', bg: '#e0505015', label: 'Error' },
}

export function MCPServersView() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0ea5e922' }}>
            <Server size={18} style={{ color: '#0ea5e9' }} />
          </div>
          <div>
            <h1 className="font-bold text-[#e8e8ef] text-lg">MCP Servers</h1>
            <p className="text-xs text-[#6b6b78]">
              {MOCK_SERVERS.filter(s => s.status === 'connected').length} connected · {MOCK_SERVERS.length} total
            </p>
          </div>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#7f77dd' }}
        >
          <Plus size={14} />
          Add Server
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {MOCK_SERVERS.map(server => {
            const cfg = STATUS_CFG[server.status]
            const { Icon } = cfg
            return (
              <div
                key={server.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[#2a2a2e] bg-[#141418] hover:border-[#3a3a42] transition-all"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-mono text-sm font-bold" style={{ background: '#0ea5e922', color: '#0ea5e9' }}>
                  {server.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#e8e8ef] text-sm">{server.name}</div>
                  <div className="text-xs text-[#6b6b78] font-mono mt-0.5 truncate">{server.url}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6b6b78]">{server.toolsCount} tools</span>
                  <span
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    <Icon size={11} />
                    {cfg.label}
                  </span>
                  <button className="p-1.5 rounded-lg text-[#6b6b78] hover:text-[#9898a8] hover:bg-[#2a2a2e] transition-colors">
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 rounded-xl border border-[#2a2a2e] bg-[#141418]">
          <p className="text-xs text-[#6b6b78] leading-relaxed">
            MCP (Model Context Protocol) servers extend Drodo's capabilities with tools like file access, web search, database queries, and external APIs. Each server exposes a set of tools the agent can call during a session.
          </p>
        </div>
      </div>
    </div>
  )
}
