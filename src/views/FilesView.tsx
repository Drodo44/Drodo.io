import { useState } from 'react'
import {
  Files, FolderOpen, FolderClosed, File, FileCode, FileText, ChevronRight, ChevronDown
} from 'lucide-react'
import { clsx } from 'clsx'

interface TreeNode {
  name: string
  type: 'file' | 'folder'
  children?: TreeNode[]
  ext?: string
}

const FILE_TREE: TreeNode[] = [
  {
    name: 'src', type: 'folder', children: [
      {
        name: 'auth', type: 'folder', children: [
          { name: 'login.ts', type: 'file', ext: 'ts' },
          { name: 'middleware.ts', type: 'file', ext: 'ts' },
          { name: 'refresh.ts', type: 'file', ext: 'ts' },
        ]
      },
      {
        name: 'db', type: 'folder', children: [
          { name: 'client.ts', type: 'file', ext: 'ts' },
          { name: 'migrations', type: 'folder', children: [
            { name: '001_init.sql', type: 'file', ext: 'sql' },
            { name: '002_users.sql', type: 'file', ext: 'sql' },
          ]},
        ]
      },
      {
        name: 'api', type: 'folder', children: [
          { name: 'routes.ts', type: 'file', ext: 'ts' },
          { name: 'handlers.ts', type: 'file', ext: 'ts' },
        ]
      },
      { name: 'index.ts', type: 'file', ext: 'ts' },
    ]
  },
  {
    name: 'tests', type: 'folder', children: [
      { name: 'auth.test.ts', type: 'file', ext: 'ts' },
      { name: 'db.test.ts', type: 'file', ext: 'ts' },
    ]
  },
  { name: 'package.json', type: 'file', ext: 'json' },
  { name: 'tsconfig.json', type: 'file', ext: 'json' },
  { name: 'README.md', type: 'file', ext: 'md' },
]

function FileIcon({ ext }: { ext?: string }) {
  if (ext === 'ts' || ext === 'tsx' || ext === 'js') return <FileCode size={13} className="text-[#7f77dd]" />
  if (ext === 'md') return <FileText size={13} className="text-[#9898a8]" />
  if (ext === 'json') return <FileCode size={13} className="text-[#d4a227]" />
  if (ext === 'sql') return <FileCode size={13} className="text-[#1d9e75]" />
  return <File size={13} className="text-[#6b6b78]" />
}

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1)
  const isFolder = node.type === 'folder'

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1.5 py-1 px-2 cursor-pointer hover:bg-[#1c1c22] transition-colors text-xs rounded-md',
          'text-[#9898a8] hover:text-[#e8e8ef]'
        )}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => isFolder && setOpen(o => !o)}
      >
        {isFolder ? (
          <>
            {open ? <ChevronDown size={11} className="text-[#6b6b78]" /> : <ChevronRight size={11} className="text-[#6b6b78]" />}
            {open ? <FolderOpen size={13} className="text-[#d4a227]" /> : <FolderClosed size={13} className="text-[#d4a227]" />}
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileIcon ext={node.ext} />
          </>
        )}
        <span>{node.name}</span>
      </div>
      {isFolder && open && node.children?.map((child, i) => (
        <TreeItem key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export function FilesView() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: '#0d0d0f' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2e', background: '#141418' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#1d9e7522' }}>
          <Files size={18} style={{ color: '#1d9e75' }} />
        </div>
        <div>
          <h1 className="font-bold text-[#e8e8ef] text-lg">Files</h1>
          <p className="text-xs text-[#6b6b78]">Project workspace</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-[#141418] rounded-xl border border-[#2a2a2e] p-3">
          {FILE_TREE.map((node, i) => (
            <TreeItem key={i} node={node} />
          ))}
        </div>
      </div>
    </div>
  )
}
