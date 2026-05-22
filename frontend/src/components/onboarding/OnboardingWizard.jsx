import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, ChevronRight, ChevronLeft, Link as LinkIcon, FileText, Search, Sparkles, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiJson, api } from '@/api/client'

const steps = [
  {
    id: 'linkedin',
    title: 'Connect LinkedIn',
    desc: 'Securely link your profile so the bot can apply on your behalf.',
    icon: LinkIcon
  },
  {
    id: 'resume',
    title: 'Upload Resume',
    desc: 'Add your PDF or Word resume. Our AI parses it instantly.',
    icon: FileText
  },
  {
    id: 'rules',
    title: 'Search Rules',
    desc: 'Define your target roles, locations, and salary expectations.',
    icon: Search
  },
  {
    id: 'ai',
    title: 'Configure AI',
    desc: 'Set up OpenAI or Gemini to power smart applications.',
    icon: Sparkles
  },
  {
    id: 'start',
    title: 'Ready to go!',
    desc: 'Start your first automation run.',
    icon: Play
  }
]

export default function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const navigate = useNavigate()

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(c => c + 1)
    } else {
      navigate('/app') // Go to dashboard
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1)
  }

  const ActiveIcon = steps[currentStep].icon

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome Setup Wizard</h1>
          <p className="text-muted-foreground">Complete these steps to launch your first automation.</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-sm font-medium mb-2 text-muted-foreground">
            <span>Setup Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="overflow-hidden border-border bg-card">
          <div className="grid md:grid-cols-3">
            {/* Sidebar steps */}
            <div className="bg-secondary/30 p-6 border-r border-border hidden md:block">
              <div className="space-y-6">
                {steps.map((step, idx) => (
                  <div key={step.id} className={`flex items-center gap-3 ${idx === currentStep ? 'text-primary' : idx < currentStep ? 'text-success' : 'text-muted-foreground'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${idx === currentStep ? 'border-primary bg-primary/10' : idx < currentStep ? 'border-success bg-success/10' : 'border-muted'}`}>
                      {idx < currentStep ? <CheckCircle className="w-4 h-4 text-success" /> : <span>{idx + 1}</span>}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{step.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content area */}
            <div className="md:col-span-2 p-6 flex flex-col min-h-[400px]">
              <div className="flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <ActiveIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{steps[currentStep].title}</h2>
                        <p className="text-muted-foreground text-sm">{steps[currentStep].desc}</p>
                      </div>
                    </div>
                    
                    <div className="py-4">
                      <StepContent stepId={steps[currentStep].id} />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
                <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleNext}>
                  {currentStep === steps.length - 1 ? 'Go to Dashboard' : 'Continue'} <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function StepContent({ stepId }) {
  if (stepId === 'linkedin') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-500/10 text-blue-400 p-4 rounded-lg text-sm mb-4 border border-blue-500/20">
          <strong>Why is this needed?</strong> The bot uses these credentials to log into LinkedIn securely on your behalf. Credentials are AES-256 encrypted.
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">LinkedIn Email</label>
          <input type="email" placeholder="you@example.com" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">LinkedIn Password</label>
          <input type="password" placeholder="••••••••" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
    )
  }
  
  if (stepId === 'resume') {
    return (
      <div className="space-y-4">
        <div className="border-2 border-dashed border-muted rounded-xl p-8 flex flex-col items-center justify-center text-center">
          <FileText className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-1">Upload your resume</h3>
          <p className="text-sm text-muted-foreground mb-4">Supported formats: PDF, DOCX (Max 5MB)</p>
          <Button variant="secondary">Browse Files</Button>
        </div>
      </div>
    )
  }

  if (stepId === 'rules') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">Create your first search rule to tell the bot what to look for.</p>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">Keywords (e.g. Software Engineer)</label>
          <input type="text" placeholder="Frontend Developer" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-3" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">Location (e.g. Remote, New York)</label>
          <input type="text" placeholder="Remote" className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
    )
  }

  if (stepId === 'ai') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">AI helps generate cover letters and answers custom employer questions automatically.</p>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">AI Provider</label>
          <select className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-3">
            <option>OpenAI</option>
            <option>Gemini</option>
            <option>Anthropic</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">API Key</label>
          <input type="password" placeholder="sk-..." className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
    )
  }

  if (stepId === 'start') {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold mb-2">You're all set!</h3>
        <p className="text-muted-foreground text-sm">Your configuration is saved. You can now go to your dashboard and start the bot. Make sure Chrome is installed on the host machine.</p>
      </div>
    )
  }

  return null
}
