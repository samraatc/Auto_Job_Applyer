import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Link } from 'react-router-dom'
import {
  Play, FileText, Search, Settings, Activity,
  CheckCircle, AlertCircle, Briefcase,
  TrendingUp, Zap, Clock, ArrowRight, Loader2,
  Bot, Star, ShieldAlert, RefreshCw, Link as LinkIcon, Sparkles
} from 'lucide-react'
import { apiJson } from '@/api/client'

// ── Smart Warning Banner ───────────────────────────────────────────
function SmartWarning({ warnings }) {
  if (!warnings.length) return null
  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <CardTitle className="text-base text-amber-400">Action Required</CardTitle>
          <CardDescription className="text-amber-300/70 text-xs">
            Complete these configurations to allow the bot to run properly.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-3 pt-1">
        {warnings.map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#18181b]/40 border border-[#27272a]/60 hover:border-amber-500/30 transition-colors">
            <div className="flex items-start gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{w.title}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{w.description}</p>
              </div>
            </div>
            <Link to={w.href}>
              <Button size="xs" variant="outline" className="text-[10px] h-7 border-[#27272a] text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1 shrink-0">
                Configure <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ── Setup Task item ────────────────────────────────────────────────
function SetupTask({ title, done, to, icon }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
        done
          ? 'bg-[#18181b]/10 border-[#27272a]/40 opacity-50 cursor-default pointer-events-none'
          : 'bg-[#18181b]/30 border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/5 hover:shadow-glow hover:-translate-y-[1px]'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
      }`}>
        {done ? <CheckCircle className="w-4 h-4" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${done ? 'line-through text-[#71717a]' : 'text-white'}`}>
          {title}
        </div>
        <div className={`text-[10px] mt-0.5 font-medium ${done ? 'text-emerald-500/70' : 'text-amber-400/80'}`}>
          {done ? 'Connected' : 'Configure now'}
        </div>
      </div>
      {!done && <ChevronRightIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
    </Link>
  )
}

function ChevronRightIcon(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

// ── Dynamic SVG Analytics Chart ────────────────────────────────────
function ApplicationsChart({ totalApplied }) {
  // Generate dummy curve matching totalApplied
  const base = Math.max(3, Math.round(totalApplied / 6))
  const data = [
    Math.round(base * 0.5),
    Math.round(base * 0.8),
    Math.round(base * 1.3),
    Math.round(base * 1.0),
    Math.round(base * 1.8),
    Math.round(base * 2.2),
    totalApplied
  ]
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const maxVal = Math.max(...data, 8)
  
  // Map x/y coords
  const points = data.map((val, idx) => {
    const x = 40 + idx * 68
    const y = 120 - (val / maxVal) * 80
    return { x, y, val }
  })

  const pathData = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')

  const areaData = points.length 
    ? `${pathData} L ${points[points.length-1].x} 130 L ${points[0].x} 130 Z`
    : ''

  return (
    <Card className="col-span-1 lg:col-span-2 overflow-hidden border-[#27272a]/50 bg-[#18181b]/20 backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-3 border-b border-[#27272a]/30">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-white tracking-wide uppercase">Applications Activity</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Automation history for the current run cycle</CardDescription>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center gap-1.5 animate-pulse">
            <TrendingUp className="w-3 h-3" /> Live Sync
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="relative w-full h-[150px]">
          <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            <line x1="40" y1="40" x2="460" y2="40" stroke="#27272a" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="40" y1="85" x2="460" y2="85" stroke="#27272a" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="40" y1="130" x2="460" y2="130" stroke="#27272a" strokeOpacity="0.6" strokeWidth="1" />

            {/* Gradient area under line */}
            {points.length > 0 && <path d={areaData} fill="url(#chartGradient)" />}

            {/* Stroke Line */}
            {points.length > 0 && (
              <path d={pathData} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />
            )}

            {/* Tooltip dots */}
            {points.map((p, idx) => (
              <g key={idx} className="group/dot cursor-pointer">
                <circle cx={p.x} cy={p.y} r="3.5" fill="#09090b" stroke="hsl(var(--primary))" strokeWidth="2" />
                <circle cx={p.x} cy={p.y} r="7.5" fill="hsl(var(--primary))" className="opacity-0 group-hover/dot:opacity-25 transition-opacity" />
                {/* SVG text helper */}
                <text x={p.x} y={p.y - 12} textAnchor="middle" fill="#ffffff" className="text-[9px] font-bold opacity-0 group-hover/dot:opacity-100 transition-opacity bg-black pointer-events-none">
                  {p.val}
                </text>
              </g>
            ))}

            {/* X Labels */}
            {points.map((p, idx) => (
              <text key={idx} x={p.x} y="145" textAnchor="middle" fill="#71717a" className="text-[9px] font-semibold">{labels[idx]}</text>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────
function StatCard({ title, value, subtitle, icon: Icon, color = 'primary', loading }) {
  const colors = {
    primary: 'bg-primary/10 text-primary border-primary/20 shadow-primary/5',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/5',
    blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/5',
    amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/5',
  }
  return (
    <Card className={`overflow-hidden border transition-all duration-300 hover:border-primary/30 hover:scale-[1.01] hover:shadow-lg`}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
        <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {loading ? (
          <div className="h-8 w-20 rounded bg-[#27272a] animate-pulse" />
        ) : (
          <div className="text-3xl font-black text-white tracking-tight">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1.5 font-medium leading-normal">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

// ── Quick Action Button ────────────────────────────────────────────
function QuickAction({ to, icon: Icon, label, primary }) {
  return (
    <Link to={to} className="w-full">
      <Button
        className={`w-full h-20 flex-col gap-2 rounded-xl transition-all duration-300 group ${
          primary
            ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 hover:border-primary hover:shadow-lg hover:shadow-primary/15'
            : 'bg-[#18181b]/35 text-[#a1a1aa] hover:bg-[#18181b]/70 hover:text-white border border-[#27272a]/50'
        }`}
        variant="ghost"
      >
        <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
        <span className="text-xs font-semibold">{label}</span>
      </Button>
    </Link>
  )
}

// ── Bot Status Widget ──────────────────────────────────────────────
function BotStatusWidget({ status, loading }) {
  const isRunning = status === 'running'
  return (
    <Card className={`border transition-all duration-300 ${isRunning ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent' : 'border-[#27272a]/50 bg-[#18181b]/20'}`}>
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${isRunning ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-[#27272a]/40 border-[#27272a] text-muted-foreground'}`}>
            <Bot className={`w-6 h-6 ${isRunning ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <p className="font-bold text-white text-base tracking-wide">Automation Engine</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-[#71717a]'}`} />
              <span className={`text-xs font-semibold ${isRunning ? 'text-emerald-400' : 'text-[#71717a]'}`}>
                {loading ? 'Checking Engine…' : isRunning ? 'Actively Applying' : 'Idle & Stopped'}
              </span>
            </div>
          </div>
        </div>
        <Link to="/app/bot" className="shrink-0">
          <Button size="sm" className={`h-9 px-4 font-bold shadow-md gap-2 ${isRunning ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10' : 'bg-primary hover:bg-primary/90 text-white shadow-primary/10'}`}>
            <Play className="w-4 h-4 fill-white/10" />
            {isRunning ? 'Manage Execution' : 'Start Session'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ── Main Overview ─────────────────────────────────────────────────
export default function Overview() {
  const [botStatus, setBotStatus] = useState('stopped')
  const [botLoading, setBotLoading] = useState(true)
  const [stats, setStats] = useState({ totalApplied: 0, activeRules: 0 })
  const [statsLoading, setStatsLoading] = useState(true)
  const [setupState, setSetupState] = useState({
    linkedin: false,
    resume: false,
    rules: false,
    ai: false,
  })
  const [setupLoading, setSetupLoading] = useState(true)
  const [warnings, setWarnings] = useState([])

  // ── Fetch bot status ───────────────────────────────────────────
  const checkBotStatus = useCallback(() => {
    fetch('/api/bot/status', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setBotStatus(d.status === 'running' ? 'running' : 'stopped'))
      .catch(() => {})
      .finally(() => setBotLoading(false))
  }, [])

  // ── Fetch onboarding / setup state ────────────────────────────
  const fetchSetupState = useCallback(async () => {
    try {
      const [resumesData, rulesData, linkedinData, aiData] = await Promise.allSettled([
        apiJson('/api/resumes'),
        apiJson('/api/search-rules'),
        apiJson('/api/settings/linkedin'),
        apiJson('/api/settings/ai'),
      ])

      const hasResume   = resumesData.status === 'fulfilled' && (resumesData.value?.resumes?.length > 0)
      const rulesVal    = rulesData.status === 'fulfilled' ? rulesData.value : null
      const hasRules    = rulesVal && (rulesVal.search_terms?.length > 0) && rulesVal.search_location
      const linkedinVal = linkedinData.status === 'fulfilled' ? linkedinData.value : null
      const hasLinkedIn = linkedinVal && linkedinVal.linkedin_email && linkedinVal.linkedin_password
      const aiVal       = aiData.status === 'fulfilled' ? aiData.value : null
      const hasAI       = aiVal && (aiVal.llm_api_key || aiVal.openai_key || aiVal.gemini_key || aiVal.anthropic_key)

      const newSetup = {
        linkedin: !!hasLinkedIn,
        resume:   !!hasResume,
        rules:    !!hasRules,
        ai:       !!hasAI,
      }
      setSetupState(newSetup)

      // Build warnings list
      const warns = []
      if (!newSetup.linkedin) warns.push({
        title: 'LinkedIn connection missing',
        description: 'Provide password credentials so the bot can authenticate.',
        href: '/app/settings',
      })
      if (!newSetup.resume) warns.push({
        title: 'Upload at least one resume',
        description: 'Need a primary resume PDF or DOCX file to submit.',
        href: '/app/resumes',
      })
      if (!newSetup.rules) warns.push({
        title: 'Search parameters missing',
        description: 'Specify location and search terms to target.',
        href: '/app/search',
      })
      if (!newSetup.ai) warns.push({
        title: 'AI credentials missing',
        description: 'Specify an API key to enable tailored answering.',
        href: '/app/settings',
      })
      setWarnings(warns)

      // Stats
      const applied = rulesVal?.total_applied ?? 0
      const ruleCount = rulesVal?.search_terms?.length ?? 0
      setStats({ totalApplied: applied, activeRules: ruleCount })
    } catch (_) {
      // silent
    } finally {
      setSetupLoading(false)
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkBotStatus()
    fetchSetupState()
    const id = setInterval(checkBotStatus, 5000)
    return () => clearInterval(id)
  }, [checkBotStatus, fetchSetupState])

  const completedSteps = Object.values(setupState).filter(Boolean).length
  const totalSteps = Object.keys(setupState).length
  const progressPercent = Math.round((completedSteps / totalSteps) * 100)
  const allReady = completedSteps === totalSteps

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-[#27272a]/20">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Workspace Overview <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-full">v1.1</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor job scrapers, AI match logs, and Selenium runtime analytics.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-[#27272a] text-[#a1a1aa] hover:bg-[#18181b]" 
          onClick={() => { fetchSetupState(); checkBotStatus() }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Dashboard
        </Button>
      </div>

      {/* Bot status controller widget */}
      <BotStatusWidget status={botStatus} loading={botLoading} />

      {/* Smart configuration alerts */}
      {!setupLoading && <SmartWarning warnings={warnings} />}

      {/* Onboarding steps panel */}
      {!setupLoading && !allReady && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent shadow-md overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#27272a]/20">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base text-white flex items-center gap-2">
                <Star className="w-4.5 h-4.5 text-primary animate-pulse" /> Workspace Setup Wizard
              </CardTitle>
              <span className="text-sm font-bold text-primary">{completedSteps} / {totalSteps} Steps Complete</span>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Configure the following parameters to launch your first automation run successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 bg-[#09090b]/10">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              <SetupTask title="Connect LinkedIn" done={setupState.linkedin} to="/app/settings" icon={<LinkIcon className="w-4 h-4" />} />
              <SetupTask title="Upload Resume"    done={setupState.resume}   to="/app/resumes"  icon={<FileText className="w-4 h-4" />} />
              <SetupTask title="Set Search Rules" done={setupState.rules}    to="/app/search"   icon={<Search className="w-4 h-4" />} />
              <SetupTask title="Configure AI"     done={setupState.ai}       to="/app/settings" icon={<Settings className="w-4 h-4" />} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setup Fully Complete Banner */}
      {!setupLoading && allReady && (
        <div className="flex items-center justify-between gap-4 p-4.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm shadow-md animate-in zoom-in-98">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-spin duration-5000" />
            </div>
            <div>
              <p className="font-bold text-emerald-300">Environment Ready</p>
              <p className="text-emerald-300/70 text-xs mt-0.5">All setups are fully active. Click start to run the scraper pilot.</p>
            </div>
          </div>
          <Link to="/app/bot" className="shrink-0">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-4.5 gap-1.5">
              <Play className="w-3.5 h-3.5 fill-white/10" /> Run Bot
            </Button>
          </Link>
        </div>
      )}

      {/* Split Grid for Analytics & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Analytics Chart */}
        <ApplicationsChart totalApplied={stats.totalApplied} />

        {/* Stats Column */}
        <div className="space-y-4">
          <StatCard
            title="Total Applications"
            value={statsLoading ? '—' : stats.totalApplied.toLocaleString()}
            subtitle="Successful submissions completed by bot"
            icon={Briefcase}
            color="primary"
            loading={statsLoading}
          />
          <StatCard
            title="Search Target Keywords"
            value={statsLoading ? '—' : stats.activeRules}
            subtitle="Configured rules active for job streams"
            icon={Search}
            color="blue"
            loading={statsLoading}
          />
          <StatCard
            title="Engine Health"
            value={botLoading ? '—' : botStatus === 'running' ? 'Active' : 'Standby'}
            subtitle={botStatus === 'running' ? 'Selenium instance active' : 'Waiting for user start'}
            icon={Zap}
            color={botStatus === 'running' ? 'emerald' : 'amber'}
            loading={botLoading}
          />
        </div>
      </div>

      {/* Quick Actions List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quick Navigation</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <QuickAction to="/app/bot"      icon={Play}     label="Run Automations"     primary />
          <QuickAction to="/app/search"   icon={Search}   label="Search Rules"  />
          <QuickAction to="/app/resumes"  icon={FileText} label="Manage Resumes"       />
          <QuickAction to="/app/settings" icon={Settings} label="API Credentials" />
          <QuickAction to="/app/applylog" icon={Activity} label="Scraper Output"     />
        </div>
      </div>
    </div>
  )
}
