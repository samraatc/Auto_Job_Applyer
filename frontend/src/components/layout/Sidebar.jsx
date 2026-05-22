import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, Search, FileText, Briefcase, Settings, 
  TerminalSquare, Activity, CheckCircle, LogOut, Link as LinkIcon, Play
} from 'lucide-react'

export default function Sidebar({ isOpen, onLogout, closeSidebar }) {
  const location = useLocation()

  const navGroups = [
    {
      label: 'Main',
      items: [
        { id: '/app', icon: Home, label: 'Overview' },
        { id: '/app/bot', icon: Play, label: 'Start Bot' },
      ]
    },
    {
      label: 'Setup',
      items: [
        { id: '/app/search', icon: Search, label: 'Search Rules' },
        { id: '/app/resumes', icon: FileText, label: 'Resumes' },
      ]
    },
        {
          label: 'Automation',
          items: [
            { id: '/app/companies', icon: Briefcase, label: 'Companies' },
            { id: '/app/posts', icon: FileText, label: 'Hiring Posts' },
            { id: '/app/linkedin', icon: LinkIcon, label: 'LinkedIn Posts' },
            { id: '/app/manual', icon: CheckCircle, label: 'Manual Apply' },
          ]
        },
    {
      label: 'System',
      items: [
        { id: '/app/applylog', icon: Activity, label: 'Apply Logs' },
        { id: '/app/appliedlog', icon: Activity, label: 'Applied Logs' },
        { id: '/app/config', icon: Settings, label: 'Raw Config' },
        { id: '/app/settings', icon: Settings, label: 'Settings & AI' },
        { id: '/app/logs', icon: TerminalSquare, label: 'Live Logs' },
      ]
    }
  ]

  return (
    <aside className={`w-64 bg-card border-r border-border flex flex-col h-screen fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0 gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold">
          <Play size={16} />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm leading-tight text-foreground">Auto Applier</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pro Edition</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <h3 className="px-6 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {group.label}
            </h3>
            <div className="space-y-1 px-3">
              {group.items.map((item) => {
                const isActive = location.pathname === item.id
                return (
                  <Link
                    key={item.id}
                    to={item.id}
                    onClick={closeSidebar}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary font-medium' 
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border shrink-0">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
