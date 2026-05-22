import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Bot, Briefcase, Zap, Shield, CheckCircle, ArrowRight, Star, 
  Terminal as TerminalIcon, Sparkles, Check, Play, Activity, FileText
} from 'lucide-react'

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
    }
  }

  return (
    <div className="landing-root w-full min-h-screen text-[#e8eaf6] flex flex-col selection:bg-indigo-500/30 overflow-x-hidden font-sans relative">
      <style>{`
        .landing-root {
          background:
            radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.25) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.2)  0%, transparent 55%),
            linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            #080b14;
          background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
          background-position: center;
          position: relative;
        }
        /* Drift animation */
        .landing-root::before, .landing-root::after {
          content: ''; position: absolute;
          border-radius: 50%; filter: blur(100px);
          pointer-events: none; opacity: 0.45;
          animation: blobDrift 20s ease-in-out infinite alternate;
          z-index: 0;
        }
        .landing-root::before {
          width: 550px; height: 550px;
          background: radial-gradient(circle, #6366f1, transparent 70%);
          top: -150px; left: -100px;
        }
        .landing-root::after {
          width: 450px; height: 450px;
          background: radial-gradient(circle, #8b5cf6, transparent 70%);
          bottom: 10%; right: -100px;
          animation-delay: -10s;
        }
        @keyframes blobDrift {
          0%   { transform: translate(0,0)      scale(1); }
          100% { transform: translate(80px,50px) scale(1.15); }
        }
        .glass-card {
          position: relative;
          background: rgba(20, 24, 40, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 22px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(24px);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-card:hover {
          border-color: rgba(99, 102, 241, 0.35);
          box-shadow: 0 32px 90px rgba(99, 102, 241, 0.12), 0 0 0 1px rgba(99, 102, 241, 0.15);
          transform: translateY(-4px);
        }
        .logo-box {
          width: 36px; height: 36px; border-radius: 11px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 20px rgba(99,102,241,0.4);
        }
        .glow-btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border: none;
          box-shadow: 0 4px 20px rgba(99,102,241,0.4);
          transition: all 0.2s;
        }
        .glow-btn-primary:hover {
          filter: brightness(1.1);
          box-shadow: 0 6px 26px rgba(99,102,241,0.55);
          transform: translateY(-1px);
        }
      `}</style>

      {/* Navbar */}
      <header className="relative w-full border-b border-white/5 bg-[#080b14]/75 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between relative z-10 w-full">
          <div className="flex items-center gap-2.5">
            <div className="logo-box">
              <Bot size={20} className="text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">
              Auto Job Applier
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-[#8892b0] uppercase tracking-wider">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">How it works</a>
            <a href="#cta" className="hover:text-white transition-colors">Apply Now</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-[#8892b0] hover:text-white hover:bg-white/5 text-xs font-bold px-4">
                Login
              </Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="glow-btn-primary text-xs font-bold px-4">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Hero Section */}
        <section className="relative w-full py-20 md:py-28 bg-transparent overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-12 gap-12 items-center w-full">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 space-y-6 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles size={11} className="text-indigo-400" /> Premium Autonomous Scraper
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-white">
                Automate Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#8b5cf6]">
                  LinkedIn Job Search
                </span> <br />
                with AI
              </h1>
              <p className="text-sm sm:text-base text-[#8892b0] max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Smart job automation, resume management, AI-powered applications, and analytics in one platform.
              </p>
              <div className="flex items-center justify-center lg:justify-start gap-4 pt-3">
                <Link to="/login">
                  <Button size="lg" className="glow-btn-primary text-sm font-bold px-7 h-12 gap-2">
                    Get Started <ArrowRight size={16} />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 text-[#e8eaf6] text-sm font-bold px-7 h-12">
                    Login
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Right side: Mockup dashboard */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5"
            >
              <div className="glass-card p-5 relative overflow-hidden max-w-md mx-auto">
                <div className="flex items-center justify-between pb-3.5 border-b border-white/5 mb-4">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-[9px] font-mono text-[#546180] px-2.5 py-0.5 rounded bg-black/40 border border-white/5">
                    https://dashboard.autoapply.ai
                  </span>
                  <div className="w-8" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-green-500/10 flex items-center justify-center text-green-400 shrink-0">
                        <Bot size={16} className="animate-spin duration-3000" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-white uppercase tracking-wider">Scraper Engine</div>
                        <div className="text-[9px] text-green-400 font-mono mt-0.5">Selenium running...</div>
                      </div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3 relative">
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#6366f1] to-transparent animate-pulse" />
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                          94% match
                        </span>
                        <h4 className="text-xs font-bold text-white mt-1.5">Senior React Developer</h4>
                        <p className="text-[10px] text-[#8892b0]">Stripe • Remote • Full-Time</p>
                      </div>
                      <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider">Auto Applying</span>
                    </div>
                    <div className="p-2 rounded bg-black/30 text-[9px] font-mono text-[#8892b0] flex items-center gap-2">
                      <span className="text-green-400">✓</span> Tailored answer for "Tell us about React experience"
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative w-full py-24 border-t border-white/5 overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 w-full">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Designed for Smart Automation
              </h2>
              <p className="text-xs sm:text-sm text-[#8892b0] max-w-lg mx-auto leading-relaxed">
                Everything you need to automate your job applications and increase callbacks.
              </p>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <motion.div variants={itemVariants}>
                <FeatureCard 
                  icon={<Sparkles size={20} className="text-indigo-400" />}
                  title="AI Job Search"
                  description="Leverage smart LLM agents to parse details and identify top opportunities that align with your background."
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <FeatureCard 
                  icon={<Zap size={20} className="text-[#8b5cf6]" />}
                  title="Auto Apply"
                  description="Automate job applications continuously with natural browser movements for LinkedIn Easy Apply."
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <FeatureCard 
                  icon={<FileText size={20} className="text-indigo-400" />}
                  title="Resume Management"
                  description="Store, index, and organize multiple resume targets to auto-apply using matching files."
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <FeatureCard 
                  icon={<TerminalIcon size={20} className="text-[#8b5cf6]" />}
                  title="Real-Time Logs"
                  description="Monitor active background Selenium scraping streams in real-time through the terminal log panel."
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <FeatureCard 
                  icon={<Activity size={20} className="text-indigo-400" />}
                  title="Analytics Dashboard"
                  description="Keep track of run histories, successfully submitted jobs, active criteria, and status counters."
                />
              </motion.div>
              <motion.div variants={itemVariants}>
                <FeatureCard 
                  icon={<Bot size={20} className="text-[#8b5cf6]" />}
                  title="LinkedIn Automation"
                  description="Configure intervals and humanized delays to keep your profile secure and fully isolated."
                />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="workflow" className="relative w-full py-24 border-t border-white/5 overflow-hidden">
          <div className="mx-auto max-w-5xl px-6 w-full">
            <div className="text-center mb-16 space-y-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">How It Works</h2>
              <p className="text-xs sm:text-sm text-[#8892b0]">Launch your job application assistant in five simple steps.</p>
            </div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-100px' }}
              className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4"
            >
              <motion.div variants={itemVariants}>
                <StepCard num="1" title="Create Account" desc="Set up your secure user environment." />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StepCard num="2" title="Connect LinkedIn" desc="Encrypt your email & password profile." />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StepCard num="3" title="Upload Resume" desc="Add targeted PDF or DOCX documents." />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StepCard num="4" title="Configure Search Rules" desc="Input location preferences & keywords." />
              </motion.div>
              <motion.div variants={itemVariants}>
                <StepCard num="5" title="Start Automation" desc="Click start to deploy the web scraper." />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="cta" className="relative w-full py-28 border-t border-white/5 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#6366f1]/15 rounded-full blur-[90px] pointer-events-none -z-10" />
          <div className="mx-auto max-w-2xl px-6 text-center space-y-6 relative z-10 w-full">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Start automating your job applications today.
            </h2>
            <p className="text-xs sm:text-sm text-[#8892b0] max-w-lg mx-auto">
              Save hundreds of hours. Get automated application submittals on autopilot while maintaining LinkedIn safety parameters.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Link to="/login">
                <Button size="lg" className="glow-btn-primary text-xs font-bold px-8 h-11">
                  Start Free
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 text-[#e8eaf6] text-xs font-bold px-8 h-11">
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative w-full border-t border-white/5 bg-[#080b14] py-12 z-10 text-center text-xs text-[#546180]">
        <div className="mx-auto max-w-5xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-2.5">
            <div className="logo-box !w-6 !h-6 !rounded bg-indigo-500">
              <Bot size={13} className="text-white" />
            </div>
            <span className="font-extrabold text-white text-xs tracking-tight">Auto Job Applier</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[11px] font-semibold text-[#8892b0]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#workflow" className="hover:text-white transition-colors">Pricing</a>
            <a href="#" className="hover:text-white transition-colors">Docs</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
          </div>
          <p>© {new Date().getFullYear()} Auto Job Applier. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <Card className="glass-card hover:-translate-y-1 transition-all h-full border-none rounded-none bg-transparent shadow-none">
      <div className="p-6 space-y-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-[14px] font-extrabold text-white uppercase tracking-wider">{title}</h3>
        <p className="text-[12px] text-[#8892b0] leading-relaxed font-medium">{description}</p>
      </div>
    </Card>
  )
}

function StepCard({ num, title, desc }) {
  return (
    <Card className="glass-card h-full border-none rounded-none bg-transparent shadow-none">
      <div className="p-5 flex flex-col justify-between h-full space-y-4">
        <div>
          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] block mb-2">
            0{num}
          </span>
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider mb-2 leading-relaxed">{title}</h4>
        </div>
        <p className="text-[11px] text-[#8892b0] leading-normal font-medium">{desc}</p>
      </div>
    </Card>
  )
}
