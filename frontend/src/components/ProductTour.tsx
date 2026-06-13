'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle } from 'lucide-react';

export function ProductTour({ onTriggerExample }: { onTriggerExample: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-start tour after 3 seconds for zero-knowledge users
  useEffect(() => {
    const timer = setTimeout(() => {
      const hasSeenTour = localStorage.getItem('deployguard-tour-seen');
      if (!hasSeenTour) {
        setIsOpen(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const closeTour = () => {
    setIsOpen(false);
    localStorage.setItem('deployguard-tour-seen', 'true');
  };

  const steps = [
    {
      title: "Welcome to DeployGuard",
      text: "We automatically scan your CI/CD pipelines to catch vulnerabilities and hardcoded secrets before they trigger a deployment. Let's see how it works.",
      action: "Next"
    },
    {
      title: "Load a Pipeline",
      text: "Usually, this happens automatically via GitHub Webhooks. For this demo, let's load a vulnerable Salesforce configuration file.",
      action: "Load Example",
      onAction: () => {
        onTriggerExample();
        setStep(2);
      }
    },
    {
      title: "Run the Analysis",
      text: "Click the 'Analyze Pipeline' button below the editor to watch our rule engine parse the AST and find the critical issues.",
      action: "Finish Tour",
      onAction: closeTour
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-8 right-8 z-50 w-80 bg-slate-900/90 backdrop-blur-xl border border-violet-500/30 shadow-[0_0_40px_rgba(139,92,246,0.15)] rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-violet-900/20">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-semibold text-violet-100">Interactive Guide</span>
            </div>
            <button onClick={closeTour} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5">
            <h3 className="text-lg font-bold text-white mb-2">{steps[step].title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">{steps[step].text}</p>
            
            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? 'bg-violet-400' : 'bg-slate-700'}`} />
                ))}
              </div>
              <button
                onClick={() => {
                  if (steps[step].onAction) {
                    steps[step].onAction();
                  } else {
                    setStep(step + 1);
                  }
                }}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                {steps[step].action}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
