'use client';

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { Check, Activity, ArrowRight, GitBranch, Code, PlayCircle, ShieldCheck, Sparkles, Shield, CloudLightning } from 'lucide-react';
import Link from 'next/link';
import { ValidationReport, PipelineReport } from '@/components/ValidationReport';
import { LiveLogViewer } from '@/components/LiveLogViewer';

function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    timeoutId = setTimeout(() => {
      let i = 0;
      intervalId = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return { displayed, done };
}

export default function Home() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);

  // Scroll reactive navbar
  const { scrollY } = useScroll();
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > lastScrollY.current && latest > 50) {
      setNavVisible(false); // scrolling down
    } else {
      setNavVisible(true); // scrolling up
    }
    lastScrollY.current = latest;
  });

  // Desktop: map absolute cursor X position to video timeline
  // Mobile: autoplay normally
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 1024) return;
      if (!video.duration || isNaN(video.duration)) return;

      // Map cursor X position (0 → window width) to video time (0 → duration)
      const fraction = e.clientX / window.innerWidth;
      const targetTime = fraction * video.duration;

      // Use rAF to avoid hammering seeks
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        video.currentTime = targetTime;
      });
    };

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        video.autoplay = true;
        video.play().catch(() => {});
      } else {
        video.pause();
        // Set initial position to middle of video
        if (video.duration && !isNaN(video.duration)) {
          video.currentTime = video.duration * 0.5;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Wait for video metadata to be ready, then initialize
    const initVideo = () => {
      handleResize();
    };
    if (video.readyState >= 1) {
      initVideo();
    } else {
      video.addEventListener('loadedmetadata', initVideo, { once: true });
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const { displayed, done } = useTypewriter("Deploy with\nAbsolute Confidence!");

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const services = ["Apex Static Analysis", "Metadata Validation", "Hardcoded IDs", "Destructive Changes"];

  const toggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  // Input States
  const [inputType, setInputType] = useState<'yaml' | 'github'>('yaml');
  const [yamlInput, setYamlInput] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  
  // Execution States
  const [jobId, setJobId] = useState<string | null>(null);
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Subscription and Enterprise Feature States
  const [subscription, setSubscription] = useState<any>(null);
  const [isPrivateRepo, setIsPrivateRepo] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  
  // Custom Rules
  const [customRules, setCustomRules] = useState<any[]>([]);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleId, setNewRuleId] = useState('CUSTOM-01');

  useEffect(() => {
    const savedEmail = localStorage.getItem('deployguard_billing_email');
    if (savedEmail) {
      const fetchSubscription = async () => {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          const res = await axios.get(`${API_URL}/api/v1/payments/subscription/${encodeURIComponent(savedEmail)}`);
          setSubscription(res.data);
        } catch (e) {
          console.error("Failed to load subscription on main page", e);
        }
      };
      fetchSubscription();
    }
  }, []);

  const handleFixIssue = (issue: any) => {
    let currentYaml = yamlInput;
    if (issue.ruleId === 'SEC-001' || issue.description.includes('AWS_SECRET_ACCESS_KEY')) {
      currentYaml = currentYaml.replace(/aws_secret_access_key:\s*["']?[A-Za-z0-9/+=]{40}["']?/g, 'aws_secret_access_key: "${{ secrets.AWS_SECRET_ACCESS_KEY }}"');
      currentYaml = currentYaml.replace(/aws_access_key_id:\s*["']?[A-Z0-9]{20}["']?/g, 'aws_access_key_id: "${{ secrets.AWS_ACCESS_KEY_ID }}"');
    }
    else if (issue.ruleId === 'SEC-002' || issue.description.includes('password')) {
      currentYaml = currentYaml.replace(/password:\s*["']?[A-Za-z0-9_@#$-]+["']?/g, 'password: "${{ secrets.SF_PASSWORD }}"');
      currentYaml = currentYaml.replace(/client_secret:\s*["']?[A-Za-z0-9_@#$-]+["']?/g, 'client_secret: "${{ secrets.SF_CLIENT_SECRET }}"');
    }
    else if (issue.ruleId === 'SF-001' || issue.description.includes('destructiveChanges')) {
      currentYaml = currentYaml.replace(/destructiveChangesPost\.xml/g, '# destructiveChangesPost.xml (removed for safety)');
      currentYaml = currentYaml.replace(/destructiveChangesPre\.xml/g, '# destructiveChangesPre.xml (removed for safety)');
    }
    else if (issue.ruleId.startsWith('CUSTOM-') || issue.ruleId === 'CUSTOM-COMPLIANCE') {
      if (issue.description.includes('found pattern "')) {
        const pattern = issue.description.split('found pattern "')[1].split('"')[0];
        currentYaml = currentYaml.replaceAll(pattern, `# REMOVED COMPLIANCE VIOLATION: ${pattern}`);
      }
    }
    setYamlInput(currentYaml);
  };

  const handleAnalyze = async () => {
    if (inputType === 'yaml' && !yamlInput.trim()) {
      setError('Please provide a YAML configuration.');
      return;
    }
    if (inputType === 'github' && !githubRepo.trim()) {
      setError('Please provide a GitHub repository (e.g., user/repo).');
      return;
    }
    
    setLoading(true);
    setError(null);
    setReport(null);
    setShowLogs(false); 

    try {
      const savedEmail = localStorage.getItem('deployguard_billing_email') || '';
      const payload = {
        email: savedEmail,
        yaml: inputType === 'yaml' ? yamlInput : undefined,
        githubRepo: inputType === 'github' ? githubRepo : undefined,
        isPrivate: inputType === 'github' && isPrivateRepo,
        githubToken: inputType === 'github' && isPrivateRepo ? githubToken : undefined,
        customRules: subscription?.plan === 'ENTERPRISE' ? customRules : undefined,
      };
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${API_URL}/api/v1/pipelines/analyze`, payload);
      
      setJobId(response.data.jobId);
      setShowLogs(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to communicate with backend validation engine.');
      setLoading(false);
      setShowLogs(false);
    }
  };

  return (
    <div className="relative bg-white text-neutral-900 font-sans selection:bg-[#EAECE9] selection:text-[#1C2E1E] antialiased w-full min-h-screen scroll-smooth">
      
      {/* Background Video Component */}
      <div className="order-last lg:order-none relative lg:fixed lg:inset-0 lg:z-0 overflow-hidden pointer-events-none w-full aspect-square md:aspect-video lg:aspect-auto lg:w-full lg:h-full bg-neutral-50 lg:bg-transparent">
        <video 
          ref={videoRef}
          muted 
          playsInline 
          preload="auto"
          className="w-full h-full object-cover object-center opacity-40 scale-[1.2] pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4"
        />
      </div>

      {/* Interactive Navbar */}
      <motion.header 
        initial={{ y: 0, opacity: 1 }}
        animate={{ y: navVisible ? 0 : -100, opacity: navVisible ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="fixed top-0 inset-x-0 z-[20] px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center bg-transparent backdrop-blur-sm lg:backdrop-blur-none border-b border-black/5 lg:border-none"
      >
        <div className="flex flex-row items-center gap-3">
          <span className="text-[21px] sm:text-[26px] tracking-tight font-medium select-none shiny-text">DeployGuard&reg;</span>
          <span className="text-[25px] sm:text-[30px] select-none tracking-[-0.02em] font-medium leading-none mb-1 shiny-text">&#10033;</span>
        </div>
        
        <div className="hidden md:flex flex-row items-center gap-8 text-[20px] font-medium">
          <a href="#docs" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Documentation</a>
          <Link href="/analytics" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Analytics</Link>
          <Link href="/pricing" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Pricing</Link>
        </div>

        <a href="#analyzer" className="hidden md:block text-[23px] text-black underline underline-offset-2 hover:opacity-60 transition-opacity">
          Scan Pipeline
        </a>

        {/* Mobile Hamburger */}
        <button 
          className="md:hidden flex flex-col justify-center items-center w-8 h-8 z-[30] relative"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <span className={`w-6 h-[2px] bg-black transition-all duration-300 absolute ${isMobileMenuOpen ? 'rotate-45 translate-y-0' : '-translate-y-[7px]'}`} />
          <span className={`w-6 h-[2px] bg-black transition-all duration-300 absolute ${isMobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
          <span className={`w-6 h-[2px] bg-black transition-all duration-300 absolute ${isMobileMenuOpen ? '-rotate-45 translate-y-0' : 'translate-y-[7px]'}`} />
        </button>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 z-[15] bg-white/95 backdrop-blur-sm transition-opacity duration-300 md:hidden flex flex-col justify-center items-center gap-8 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <a href="#docs" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-medium text-black">Documentation</a>
        <Link href="/analytics" className="text-3xl font-medium text-black">Analytics</Link>
        <Link href="/pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-medium text-black">Pricing</Link>
        <a href="#analyzer" onClick={() => setIsMobileMenuOpen(false)} className="mt-8 px-6 py-3 bg-black text-white rounded-full">Scan Pipeline</a>
      </div>

      {/* Content Layout Container */}
      <div className="relative z-10 flex flex-col order-first lg:order-none w-full bg-white lg:bg-transparent pb-8 lg:pb-0 lg:min-h-screen">
        <main id="spade-hero" className="w-full max-w-7xl mx-auto px-6 py-32 flex-1 flex flex-col justify-center">
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-6xl lg:text-[76px] font-normal tracking-tight leading-[1.08] mb-8 select-none w-full whitespace-pre-wrap shiny-text pb-2">
              {displayed}
              {!done && <span className="inline-block w-[2px] h-[1.1em] bg-black align-middle ml-[2px] animate-blink" />}
            </h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
            <p className="text-lg md:text-xl text-[#5A635A] leading-relaxed font-normal mb-14 max-w-2xl">
              Whether you have hardcoded secrets, performance bottlenecks, <br /> or missing Salesforce tests, we'll catch it instantly.
            </p>
          </motion.div>

          {/* Interactive Multi-Select Service Pills */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="py-16 md:py-20 border-t border-[#F1F3F1] my-4 w-full"
          >
            <h3 className="text-2xl font-medium tracking-tight mb-2 shiny-text">What sort of validation?</h3>
            <p className="opacity-85 text-[#738273] mb-8">Select all that apply</p>
            
            <div className="flex flex-wrap gap-3">
              {services.map((service) => {
                const isActive = selectedServices.includes(service);
                return (
                  <motion.button
                    key={service}
                    onClick={() => toggleService(service)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-[#1C2E1E] text-white shadow-md shadow-emerald-950/5' 
                        : 'bg-white text-[#1C2E1E] border border-[#F1F3F1] hover:bg-[#F1F3F1]/55'
                    }`}
                  >
                    {service}
                    {isActive && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                        <Check className="w-4 h-4" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Minimalist How It Works Section */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="py-16 md:py-20 border-t border-[#F1F3F1] my-4"
          >
            <h3 className="text-2xl font-medium tracking-tight mb-8 shiny-text">How it works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col">
                <div className="w-10 h-10 rounded-full bg-[#FAFBF9] border border-[#F1F3F1] flex items-center justify-center text-[#1C2E1E] mb-4 font-mono">1</div>
                <h4 className="text-lg font-medium mb-2">Input your Code</h4>
                <p className="text-sm text-[#738273] leading-relaxed">Paste your Salesforce deployment YAML, or simply provide your GitHub repository URL.</p>
              </div>
              <div className="flex flex-col">
                <div className="w-10 h-10 rounded-full bg-[#FAFBF9] border border-[#F1F3F1] flex items-center justify-center text-[#1C2E1E] mb-4 font-mono">2</div>
                <h4 className="text-lg font-medium mb-2">Enterprise Engine Scans</h4>
                <p className="text-sm text-[#738273] leading-relaxed">Our BullMQ background workers parse the AST to detect hardcoded IDs, missing tests, and destructive changes.</p>
              </div>
              <div className="flex flex-col">
                <div className="w-10 h-10 rounded-full bg-[#FAFBF9] border border-[#F1F3F1] flex items-center justify-center text-[#1C2E1E] mb-4 font-mono">3</div>
                <h4 className="text-lg font-medium mb-2">Instant Validation</h4>
                <p className="text-sm text-[#738273] leading-relaxed">View a detailed security and performance report instantly via live WebSockets before you ever deploy.</p>
              </div>
            </div>
          </motion.div>

          {/* Enterprise Features Section */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="py-16 md:py-20 border-t border-[#F1F3F1] my-4"
          >
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-2xl font-medium tracking-tight shiny-text">Enterprise Capabilities</h3>
              <span className="px-3 py-1 bg-violet-100 text-violet-800 text-[11px] font-bold uppercase tracking-widest rounded-full">Paid Tier</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#FAFBF9] border border-[#F1F3F1] rounded-xl flex items-center justify-center text-[#1C2E1E]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[17px] font-semibold text-black mb-1">Private Repository Scanning</h4>
                  <p className="text-sm text-[#738273] leading-relaxed">Secure OAuth integration to scan internal, private corporate repositories on GitHub, GitLab, or Bitbucket seamlessly.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#FAFBF9] border border-[#F1F3F1] rounded-xl flex items-center justify-center text-[#1C2E1E]">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[17px] font-semibold text-black mb-1">Automated Pull Request Bot</h4>
                  <p className="text-sm text-[#738273] leading-relaxed">Runs automatically inside CI/CD. Every time a developer opens a PR, DeployGuard scans it and leaves a blocking comment if vulnerabilities are found.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#FAFBF9] border border-[#F1F3F1] rounded-xl flex items-center justify-center text-[#1C2E1E]">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[17px] font-semibold text-black mb-1">Custom Security Rules</h4>
                  <p className="text-sm text-[#738273] leading-relaxed">Allow enterprise security teams to write their own custom validation rules specific to their company's internal compliance policies.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-[#FAFBF9] border border-[#F1F3F1] rounded-xl flex items-center justify-center text-[#1C2E1E]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[17px] font-semibold text-black mb-1">Auto-Remediation (Click-to-Fix)</h4>
                  <p className="text-sm text-[#738273] leading-relaxed">Use AI to generate the exact code fix and offer a "One-Click Commit" button to automatically push the fix directly to your repository.</p>
                </div>
              </div>

              <div className="flex gap-4 md:col-span-2">
                <div className="flex-shrink-0 w-12 h-12 bg-[#FAFBF9] border border-[#F1F3F1] rounded-xl flex items-center justify-center text-[#1C2E1E]">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[17px] font-semibold text-black mb-1">Compliance Reporting</h4>
                  <p className="text-sm text-[#738273] leading-relaxed max-w-2xl">Exportable PDF reports for SOC2/ISO27001 compliance audits that companies can hand directly to their security auditors.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Active Subscription Badge */}
          {subscription && subscription.plan !== 'FREE' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="w-full max-w-4xl mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-emerald-800 text-sm relative z-10 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Active <strong>{subscription.plan}</strong> Tier linked to <strong>{localStorage.getItem('deployguard_billing_email')}</strong></span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider rounded">Subscription Verified</span>
            </motion.div>
          )}

          {/* True Full-Stack Analyzer */}
          <motion.div 
            id="analyzer" 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl py-16 md:py-20 border-t border-[#F1F3F1] my-4"
          >
            <h3 className="text-2xl font-medium tracking-tight mb-2 shiny-text">Pipeline Configuration</h3>
            <p className="opacity-85 text-[#738273] mb-8">Paste your YAML file below or scan a GitHub repository to trigger the real DevSecOps validation engine.</p>
            
            {/* Input Toggle Tabs */}
            <div className="flex gap-2 mb-6">
              <button 
                onClick={() => setInputType('yaml')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${inputType === 'yaml' ? 'bg-[#FAFBF9] border border-[#F1F3F1] text-[#1C2E1E]' : 'text-[#738273] hover:text-[#1C2E1E]'}`}
              >
                <Code className="w-4 h-4" /> Paste YAML
              </button>
              <button 
                onClick={() => setInputType('github')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${inputType === 'github' ? 'bg-[#FAFBF9] border border-[#F1F3F1] text-[#1C2E1E]' : 'text-[#738273] hover:text-[#1C2E1E]'}`}
              >
                <GitBranch className="w-4 h-4" /> Scan GitHub Repo
              </button>
            </div>

            <div className="relative group">
              <AnimatePresence mode="wait">
                {inputType === 'yaml' ? (
                  <motion.textarea
                    key="yaml"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    className="w-full h-72 p-6 bg-[#FAFBF9] border border-[#F1F3F1] rounded-2xl text-neutral-800 font-mono text-sm leading-relaxed focus:ring-4 focus:ring-[#1C2E1E]/5 focus:border-[#1C2E1E]/20 transition-all outline-none resize-y placeholder:text-neutral-300 custom-scrollbar block"
                    placeholder="name: Salesforce Prod Deployment&#10;on: [push]&#10;&#10;jobs:&#10;  deploy:&#10;    runs-on: ubuntu-latest&#10;..."
                    value={yamlInput}
                    onChange={(e) => setYamlInput(e.target.value)}
                    spellCheck={false}
                  />
                ) : (
                  <motion.div key="github" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full p-8 bg-[#FAFBF9] border border-[#F1F3F1] rounded-2xl flex flex-col justify-center items-center min-h-72 h-auto gap-4">
                    <GitBranch className="w-12 h-12 text-[#EAECE9]" />
                    <input 
                      type="text" 
                      placeholder="e.g., github.com/user/repo"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      className="w-full max-w-md px-4 py-3 bg-white border border-[#EAECE9] rounded-lg focus:ring-2 focus:ring-[#1C2E1E]/10 focus:border-[#1C2E1E]/30 outline-none transition-all text-center"
                    />

                    {/* Private Repo Configuration */}
                    <div className="flex flex-col items-center gap-3 w-full max-w-md bg-white p-4 border border-[#EAECE9] rounded-xl shadow-sm">
                      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                        <input 
                          type="checkbox" 
                          checked={isPrivateRepo}
                          onChange={(e) => {
                            if (subscription && subscription.plan !== 'FREE') {
                              setIsPrivateRepo(e.target.checked);
                            } else {
                              setError("Private repository scanning requires a PRO or ENTERPRISE subscription.");
                            }
                          }}
                          className="rounded text-[#1C2E1E] focus:ring-[#1C2E1E]"
                        />
                        <span>Scan private repository</span>
                      </label>
                      
                      {isPrivateRepo && (
                        <input 
                          type="password" 
                          placeholder="GitHub Personal Access Token (PAT)"
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          className="w-full px-3 py-2 border border-[#EAECE9] rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#1C2E1E]"
                        />
                      )}
                      
                      {(!subscription || subscription.plan === 'FREE') && (
                        <p className="text-[10px] text-violet-700 font-semibold uppercase tracking-wider">🔒 Upgrade to Pro/Enterprise for Private Repos</p>
                      )}
                    </div>

                    <p className="text-xs text-[#738273]">We will fetch <code className="bg-white px-1 py-0.5 rounded border border-[#EAECE9]">main.yml</code> or <code className="bg-white px-1 py-0.5 rounded border border-[#EAECE9]">deploy.yml</code> from the repository.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Rules Input (Enterprise Only) */}
            {subscription && subscription.plan === 'ENTERPRISE' && (
              <div className="mt-6 p-6 bg-[#FAFBF9] border border-[#F1F3F1] rounded-2xl text-sm relative z-10 shadow-sm">
                <h4 className="font-bold text-black mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-violet-700" />
                  Custom Security Rule Builder (Enterprise)
                </h4>
                <p className="text-xs text-[#738273] mb-4">Define custom pattern match rules that will be checked in real-time during scans.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <input 
                    type="text" 
                    placeholder="Rule ID (e.g., COMP-01)"
                    value={newRuleId}
                    onChange={(e) => setNewRuleId(e.target.value)}
                    className="px-3 py-2 border border-[#EAECE9] rounded-lg text-xs bg-white outline-none focus:ring-1 focus:ring-[#1C2E1E]"
                  />
                  <input 
                    type="text" 
                    placeholder="Violating text pattern (e.g. env: PROD)"
                    value={newRulePattern}
                    onChange={(e) => setNewRulePattern(e.target.value)}
                    className="px-3 py-2 border border-[#EAECE9] rounded-lg text-xs bg-white outline-none focus:ring-1 focus:ring-[#1C2E1E]"
                  />
                  <input 
                    type="text" 
                    placeholder="Description of the violation"
                    value={newRuleDesc}
                    onChange={(e) => setNewRuleDesc(e.target.value)}
                    className="px-3 py-2 border border-[#EAECE9] rounded-lg text-xs bg-white outline-none focus:ring-1 focus:ring-[#1C2E1E]"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => {
                    if (!newRulePattern || !newRuleDesc) return;
                    setCustomRules(prev => [...prev, {
                      ruleId: newRuleId,
                      pattern: newRulePattern,
                      description: newRuleDesc,
                      suggestion: `Remove or change occurrence of "${newRulePattern}".`
                    }]);
                    setNewRulePattern('');
                    setNewRuleDesc('');
                    const num = parseInt(newRuleId.split('-')[1]) || 1;
                    setNewRuleId(`CUSTOM-0${num + 1}`);
                  }}
                  className="px-4 py-2 bg-[#1C2E1E] text-white hover:bg-black rounded-xl text-xs font-semibold"
                >
                  Add Custom Rule
                </button>
                
                {customRules.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#EAECE9]">
                    <p className="font-semibold text-xs mb-2">Active Rules ({customRules.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {customRules.map((rule, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-white border border-[#EAECE9] text-neutral-800 text-xs font-mono rounded-lg flex items-center gap-1.5">
                          <strong>{rule.ruleId}</strong>: "{rule.pattern}"
                          <button onClick={() => setCustomRules(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 font-bold ml-1">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-4 bg-[#FAFBF9] border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                {error}
              </motion.div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-6 pb-24">
              <p className="text-sm text-[#738273]">Powered by BullMQ & Redis Backend.</p>
              
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#F1F3F1] text-sm font-medium rounded-full text-[#1C2E1E] bg-white hover:bg-[#FAFBF9] focus:outline-none transition-all"
                >
                  <Activity className="w-4 h-4" />
                  {showLogs ? 'Hide Logs' : 'Live Logs'}
                </button>

                <button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-medium rounded-full text-white bg-[#1C2E1E] hover:bg-black focus:outline-none disabled:opacity-50 transition-all shadow-md shadow-emerald-950/5 active:scale-95"
                >
                  {loading ? 'Processing...' : 'Run Analysis Engine'}
                </button>
              </div>
            </div>
          </motion.div>

          {showLogs && jobId && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-24 w-full max-w-4xl">
              <LiveLogViewer 
                pipelineId={jobId} 
                onComplete={(realReport) => {
                  setReport(realReport);
                  setShowLogs(false);
                  setLoading(false);
                }} 
              />
            </motion.div>
          )}

          {report && !showLogs && (
            <>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-24 bg-white p-6 rounded-2xl border border-[#F1F3F1] shadow-[0_8px_40px_rgb(0,0,0,0.04)] w-full max-w-4xl relative z-10">
                <ValidationReport 
                  report={report} 
                  isEnterprise={subscription?.plan === 'ENTERPRISE'} 
                  onFixIssue={handleFixIssue}
                />
              </motion.div>

              {/* PR Bot Simulator (Enterprise Only) */}
              {subscription && subscription.plan === 'ENTERPRISE' && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mb-24 p-8 bg-[#FAFBF9] border border-[#F1F3F1] rounded-3xl w-full max-w-4xl relative z-10 shadow-sm"
                >
                  <h3 className="text-xl font-bold text-black mb-2 flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-violet-700" />
                    Automated Pull Request Bot Simulator (Enterprise)
                  </h3>
                  <p className="text-sm text-[#738273] mb-6">
                    Simulate how DeployGuard runs automatically in your GitHub pipeline and leaves blocking code review comments inside pull requests.
                  </p>
                  
                  <button
                    onClick={() => {
                      alert(`[DeployGuard PR Bot] Simulated webhook triggered! 
                      
1. Scanned Pull Request #482 ("feature/deploy-prod")
2. Found 1 high-risk vulnerability: Hardcoded Salesforce Session Token.
3. Left review comment: "❌ SEC-002: Hardcoded token detected on Line 14. Recommend using \${{ secrets.SF_SESSION_ID }} instead."
4. Set CI/CD status to: FAILED (Blocked from merging)`);
                    }}
                    className="px-6 py-3 bg-[#1C2E1E] text-white hover:bg-black rounded-full font-medium text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
                  >
                    <CloudLightning className="w-4 h-4" /> Trigger Simulated Webhook (PR #482)
                  </button>
                </motion.div>
              )}
            </>
          )}

          {/* Documentation Section */}
          <motion.section 
            id="docs"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl py-16 md:py-20 border-t border-[#F1F3F1] my-4"
          >
            <span className="px-3 py-1 bg-[#FAFBF9] border border-[#F1F3F1] text-[11px] font-semibold uppercase tracking-widest rounded-full text-[#1C2E1E]">Documentation</span>
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight shiny-text pb-2 mt-4 mb-6">
              About DeployGuard & How It Works
            </h2>
            <p className="text-base text-[#5A635A] leading-relaxed mb-10 max-w-3xl">
              DeployGuard is a premium, real-time DevSecOps verification gateway built specifically for Salesforce and cloud CI/CD pipelines. It intercepts high-risk vulnerabilities, checks rule compliance, and estimates deployment optimization metrics before code is pushed to production.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-2xl">
                <h4 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  Why DeployGuard?
                </h4>
                <p className="text-sm text-[#738273] leading-relaxed">
                  Traditional scanners check code only after commits are merged. DeployGuard analyzes the Abstract Syntax Tree (AST) of your YAML pipelines and Apex classes instantly, preventing broken deployments, unsafe Connected App IDs, or credentials leaks from reaching production.
                </p>
              </div>

              <div className="bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-2xl">
                <h4 className="font-semibold text-black mb-3 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
                  Core Mechanisms
                </h4>
                <p className="text-sm text-[#738273] leading-relaxed">
                  Our system combines static parsing with dynamic background validation. Leveraging BullMQ job queues, Redis caches, and simulated live WebSocket streams, the dashboard provides interactive logs and security reports directly to your browser with click-to-fix AI recommendations.
                </p>
              </div>
            </div>
          </motion.section>

          {/* Contact Section */}
          <motion.section 
            id="contact"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.25 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-4xl py-16 md:py-20 border-t border-[#F1F3F1] my-4"
          >
            <div className="bg-[#1C2E1E] text-white p-8 md:p-12 rounded-3xl relative overflow-hidden group shadow-lg">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700 pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                  <span className="px-3 py-1 bg-white/10 text-white/95 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4 inline-block">Need Help?</span>
                  <h3 className="text-2xl md:text-3xl font-normal tracking-tight mb-2">Have questions or found an issue?</h3>
                  <p className="text-sm text-neutral-300 max-w-md">
                    If you run into any issues with the pipeline validator or payment gateway, connect with me directly on LinkedIn. I am happy to help you get it resolved.
                  </p>
                </div>
                
                <a 
                  href="https://www.linkedin.com/in/tannu-yadav-06012733a/" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-full hover:bg-neutral-100 transition-all transform active:scale-95 shadow-md flex-shrink-0"
                >
                  Connect on LinkedIn <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </motion.section>

        </main>
      </div>
    </div>
  );
}
