'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ShieldCheck, HelpCircle, ArrowRight, Home, CreditCard, Sparkles, AlertCircle, Plus, Gift } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionData {
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: string;
  currentPeriodEnd?: string;
  features: {
    scansPerMonth: number;
    privateRepos: boolean;
    customRules: boolean;
    prBot: boolean;
    autoRemediation: boolean;
    complianceReports: boolean;
  };
}

export default function PricingPage() {
  const [email, setEmail] = useState('');
  const [checkedEmail, setCheckedEmail] = useState('');
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(false);
  
  // Checkout States
  const [promoCode, setPromoCode] = useState('');
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  // Admin Promo Generator States
  const [adminCode, setAdminCode] = useState('');
  const [adminPercentOff, setAdminPercentOff] = useState(20);
  const [loadingPromoCreate, setLoadingPromoCreate] = useState(false);
  const [createdPromo, setCreatedPromo] = useState<{ code: string; percentOff: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Developer License States
  const [loadingDevLicense, setLoadingDevLicense] = useState(false);
  const [devLicenseMessage, setDevLicenseMessage] = useState<string | null>(null);

  // URL Query Parameters (Success / Cancel messages)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'cancelled'; text: string } | null>(null);

  useEffect(() => {
    // Check if redirecting back from Stripe
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success') === 'true';
    const plan = params.get('plan') || 'PRO';
    const sessionId = params.get('session_id');
    const queryEmail = params.get('email');

    if (success) {
      const activeEmail = queryEmail || localStorage.getItem('deployguard_billing_email') || '';
      if (activeEmail) {
        setEmail(activeEmail);
      }

      setStatusMessage({
        type: 'success',
        text: `Subscription successful! Verifying checkout session...`,
      });

      if (sessionId && activeEmail) {
        const verifySession = async () => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            await axios.post(`${API_URL}/api/v1/payments/verify-session`, {
              sessionId,
              email: activeEmail,
            });
            setStatusMessage({
              type: 'success',
              text: `Subscription successful! You are now subscribed to DeployGuard ${plan}. Your status has been verified in the database.`,
            });
            checkSubscription(activeEmail);
          } catch (err: any) {
            console.error('Session verification failed', err);
            setStatusMessage({
              type: 'success',
              text: `Subscription completed on Stripe! Please click "Check Status" below with your email to fetch features.`,
            });
            checkSubscription(activeEmail);
          }
        };
        verifySession();
      } else if (activeEmail) {
        checkSubscription(activeEmail);
      }
    } else if (params.get('cancelled') === 'true') {
      setStatusMessage({
        type: 'cancelled',
        text: 'Checkout cancelled. You can try again whenever you are ready.',
      });
    }
  }, []);

  const checkSubscription = async (emailToCheck: string) => {
    if (!emailToCheck.trim()) return;
    setLoadingCheck(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await axios.get(`${API_URL}/api/v1/payments/subscription/${encodeURIComponent(emailToCheck.trim())}`);
      setSubscription(res.data);
      setCheckedEmail(emailToCheck.trim());
      localStorage.setItem('deployguard_billing_email', emailToCheck.trim());
    } catch (err: any) {
      console.error('Failed to fetch subscription', err);
    } finally {
      setLoadingCheck(false);
    }
  };

  const handleCheckout = async (plan: 'PRO' | 'ENTERPRISE') => {
    if (!email.trim()) {
      setCheckoutError('Please enter your email to proceed to checkout.');
      return;
    }
    setLoadingCheckout(plan);
    setCheckoutError(null);
    localStorage.setItem('deployguard_billing_email', email.trim());

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${API_URL}/api/v1/payments/create-checkout-session`, {
        email: email.trim(),
        plan,
        promoCode: promoCode.trim() || undefined,
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL returned.');
      }
    } catch (err: any) {
      console.error(err);
      setCheckoutError(err.response?.data?.error || 'Failed to initialize payment checkout.');
      setLoadingCheckout(null);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminCode.trim()) return;
    setLoadingPromoCreate(true);
    setPromoError(null);
    setCreatedPromo(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${API_URL}/api/v1/payments/create-promo`, {
        code: adminCode.trim(),
        percentOff: adminPercentOff,
      });
      setCreatedPromo({
        code: response.data.promoCode,
        percentOff: response.data.percentOff,
      });
      setAdminCode('');
    } catch (err: any) {
      console.error(err);
      setPromoError(err.response?.data?.error || 'Failed to create promo code.');
    } finally {
      setLoadingPromoCreate(false);
    }
  };

  const handleGrantDevLicense = async () => {
    if (!email.trim()) {
      setDevLicenseMessage('Please enter an email in the "Check Active Subscriptions" field above first.');
      return;
    }
    if (email.trim().toLowerCase() !== 'ytannu1410@gmail.com') {
      setDevLicenseMessage('Access Denied: Only the authorized developer email (ytannu1410@gmail.com) can bypass payments.');
      return;
    }
    setLoadingDevLicense(true);
    setDevLicenseMessage(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await axios.post(`${API_URL}/api/v1/payments/grant-dev-license`, {
        email: email.trim(),
      });
      setDevLicenseMessage(response.data.message || 'Enterprise license granted!');
      await checkSubscription(email);
    } catch (err: any) {
      console.error(err);
      setDevLicenseMessage(err.response?.data?.error || 'Failed to grant license.');
    } finally {
      setLoadingDevLicense(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-[#EAECE9] selection:text-[#1C2E1E] scroll-smooth">
      
      {/* Interactive Navbar */}
      <header className="fixed top-0 inset-x-0 z-[20] px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center bg-white/80 backdrop-blur-sm border-b border-[#F1F3F1]">
        <div className="flex flex-row items-center gap-3">
          <span className="text-[21px] sm:text-[26px] tracking-tight font-medium select-none shiny-text">DeployGuard&reg;</span>
          <span className="text-[25px] sm:text-[30px] select-none tracking-[-0.02em] font-medium leading-none mb-1 shiny-text">&#10033;</span>
        </div>
        
        <div className="hidden md:flex flex-row items-center gap-8 text-[20px] font-medium">
          <a href="https://github.com/tannu005/DeployGuard" target="_blank" rel="noreferrer" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Documentation</a>
          <Link href="/analytics" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Analytics</Link>
          <Link href="/pricing" className="cursor-pointer hover:opacity-60 transition-opacity underline underline-offset-4 shiny-text">Pricing</Link>
        </div>

        <Link href="/" className="hidden md:flex items-center gap-2 text-[18px] text-[#1C2E1E] bg-[#FAFBF9] border border-[#F1F3F1] px-5 py-2 rounded-full hover:bg-[#F1F3F1]/55 transition-all">
          <Home className="w-4 h-4" /> Back to Scanner
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 pt-36 pb-24">
        
        {/* Status Alerts */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-10 p-5 rounded-2xl border text-sm flex gap-3 items-start ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                  : 'bg-amber-50/50 border-amber-100 text-amber-800'
              }`}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">{statusMessage.type === 'success' ? 'Thank You!' : 'Cancelled'}</p>
                <p className="opacity-90">{statusMessage.text}</p>
              </div>
              <button onClick={() => setStatusMessage(null)} className="ml-auto text-xs underline font-semibold hover:opacity-75">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="px-3 py-1 bg-[#FAFBF9] border border-[#F1F3F1] text-[11px] font-semibold uppercase tracking-widest rounded-full text-[#1C2E1E]">Pricing Tiers</span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight shiny-text pb-2 mt-4">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-[#5A635A] mt-4 font-normal max-w-2xl mx-auto">
              Scan pipelines, enforce rules, and deploy with absolute confidence.
            </p>
          </motion.div>
        </div>

        {/* Email Identification & Search */}
        <div className="max-w-xl mx-auto bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-3xl shadow-sm mb-16">
          <h3 className="text-lg font-semibold text-black mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            Check Active Subscriptions
          </h3>
          <p className="text-xs text-[#738273] mb-4">
            Enter your billing email to look up your existing plan features or prepare for a new Stripe subscription.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              type="email" 
              placeholder="e.g., developer@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 bg-white border border-[#EAECE9] rounded-2xl focus:ring-2 focus:ring-[#1C2E1E]/10 focus:border-[#1C2E1E]/30 outline-none transition-all"
            />
            <button
              onClick={() => checkSubscription(email)}
              disabled={loadingCheck || !email.trim()}
              className="px-6 py-3 bg-[#1C2E1E] text-white hover:bg-black rounded-2xl font-medium text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loadingCheck ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          {subscription && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              className="mt-6 pt-6 border-t border-[#F1F3F1] text-sm text-neutral-800"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-black">Active Billing Email:</span>
                <span className="font-mono text-xs text-[#738273]">{checkedEmail}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-black">Current Plan:</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  subscription.plan === 'FREE' ? 'bg-[#FAFBF9] border border-[#F1F3F1] text-[#1C2E1E]' :
                  subscription.plan === 'PRO' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                  'bg-violet-50 text-violet-800 border border-violet-100'
                }`}>
                  {subscription.plan} TIER ({subscription.status})
                </span>
              </div>

              {subscription.currentPeriodEnd && (
                <div className="flex justify-between items-center mb-4 text-xs text-[#738273]">
                  <span>Period Renewal Date:</span>
                  <span>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
                </div>
              )}

              <div className="bg-white border border-[#F1F3F1] p-4 rounded-2xl">
                <p className="font-semibold text-xs text-black uppercase tracking-wider mb-3">Unlocked Features</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <li className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 ${subscription.features.scansPerMonth === -1 ? 'text-emerald-600' : 'text-[#738273]'}`} />
                    <span>{subscription.features.scansPerMonth === -1 ? 'Unlimited Scans' : `${subscription.features.scansPerMonth} Scans / mo`}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 ${subscription.features.privateRepos ? 'text-emerald-600' : 'text-neutral-300'}`} />
                    <span className={subscription.features.privateRepos ? 'text-black' : 'text-neutral-300'}>Private Repo Scans</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 ${subscription.features.customRules ? 'text-emerald-600' : 'text-neutral-300'}`} />
                    <span className={subscription.features.customRules ? 'text-black' : 'text-neutral-300'}>Custom Security Rules</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 ${subscription.features.prBot ? 'text-emerald-600' : 'text-neutral-300'}`} />
                    <span className={subscription.features.prBot ? 'text-black' : 'text-neutral-300'}>Automated PR Bot</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 ${subscription.features.autoRemediation ? 'text-emerald-600' : 'text-neutral-300'}`} />
                    <span className={subscription.features.autoRemediation ? 'text-black' : 'text-neutral-300'}>Auto-Remediation fixes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className={`w-3.5 h-3.5 ${subscription.features.complianceReports ? 'text-emerald-600' : 'text-neutral-300'}`} />
                    <span className={subscription.features.complianceReports ? 'text-black' : 'text-neutral-300'}>Compliance Reports</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </div>

        {/* Promo Code Input during subscription */}
        <div className="max-w-xl mx-auto flex items-center gap-3 mb-10 p-4 bg-emerald-50/20 border border-emerald-100/50 rounded-2xl text-sm justify-between">
          <div className="flex items-center gap-2 text-emerald-800">
            <Gift className="w-4 h-4" />
            <span>Have a discount promo code?</span>
          </div>
          <input 
            type="text" 
            placeholder="PROMO50"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="w-32 px-3 py-1 bg-white border border-[#EAECE9] rounded-lg text-center uppercase font-semibold text-xs focus:ring-1 focus:ring-[#1C2E1E] focus:outline-none"
          />
        </div>

        {checkoutError && (
          <div className="max-w-xl mx-auto mb-8 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm text-center">
            {checkoutError}
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start mb-24">
          
          {/* FREE PLAN */}
          <div className="bg-[#FAFBF9] border border-[#F1F3F1] rounded-3xl p-8 flex flex-col h-full hover:border-[#1C2E1E]/20 transition-all shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-black mb-1">Free Tier</h3>
              <p className="text-xs text-[#738273]">Perfect for checking open-source configurations.</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold text-black tracking-tight">$0</span>
                <span className="ml-1 text-sm text-[#738273]">/month</span>
              </div>
            </div>

            <ul className="space-y-3.5 mb-8 text-sm flex-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>5 scans per month</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Public repositories only</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Basic static rules</span>
              </li>
              <li className="flex items-center gap-2.5 text-neutral-300">
                <Check className="w-4 h-4 text-neutral-200 flex-shrink-0" />
                <span>Automated PR comments</span>
              </li>
              <li className="flex items-center gap-2.5 text-neutral-300">
                <Check className="w-4 h-4 text-neutral-200 flex-shrink-0" />
                <span>Auto-fix code suggestion</span>
              </li>
            </ul>

            <button 
              onClick={() => {
                if (!email.trim()) {
                  setCheckoutError('Please enter your email in the box above first!');
                  return;
                }
                checkSubscription(email);
              }}
              className="w-full py-3 border border-[#F1F3F1] hover:bg-[#FAFBF9] text-sm font-medium rounded-2xl text-black bg-white transition-all"
            >
              Get Started Free
            </button>
          </div>

          {/* PRO PLAN */}
          <div className="bg-[#FAFBF9] border-2 border-[#1C2E1E] rounded-3xl p-8 flex flex-col h-full relative hover:scale-[1.01] transition-all shadow-md">
            <span className="absolute -top-3.5 right-6 px-3.5 py-1 bg-[#1C2E1E] text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Popular</span>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-black mb-1">DeployGuard Pro</h3>
              <p className="text-xs text-[#738273]">For professional developers and engineering teams.</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold text-black tracking-tight">$29</span>
                <span className="ml-1 text-sm text-[#738273]">/month</span>
              </div>
            </div>

            <ul className="space-y-3.5 mb-8 text-sm flex-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold text-black">Unlimited pipeline scans</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Private & Public repos</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Advanced Apex & Metadata rules</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Custom lint & security rules</span>
              </li>
              <li className="flex items-center gap-2.5 text-neutral-300">
                <Check className="w-4 h-4 text-neutral-200 flex-shrink-0" />
                <span>Auto-remediation suggestions</span>
              </li>
            </ul>

            <button
              onClick={() => handleCheckout('PRO')}
              disabled={loadingCheckout !== null}
              className="w-full py-3 bg-[#1C2E1E] hover:bg-black text-sm font-semibold rounded-2xl text-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              {loadingCheckout === 'PRO' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Redirecting...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Subscribe Pro
                </>
              )}
            </button>
          </div>

          {/* ENTERPRISE PLAN */}
          <div className="bg-[#FAFBF9] border border-[#F1F3F1] rounded-3xl p-8 flex flex-col h-full hover:border-[#1C2E1E]/20 transition-all shadow-sm">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-black mb-1">Enterprise Tiers</h3>
              <p className="text-xs text-[#738273]">Mission critical DevOps safety for scale.</p>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold text-black tracking-tight">$99</span>
                <span className="ml-1 text-sm text-[#738273]">/month</span>
              </div>
            </div>

            <ul className="space-y-3.5 mb-8 text-sm flex-1">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold text-black">Everything in Pro</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Automated PR comments bot</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>AI Auto-Remediation commits</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>SOC2 Compliance exports</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Dedicated support SLAs</span>
              </li>
            </ul>

            <button
              onClick={() => handleCheckout('ENTERPRISE')}
              disabled={loadingCheckout !== null}
              className="w-full py-3 bg-[#1C2E1E]/90 hover:bg-black text-sm font-semibold rounded-2xl text-white transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loadingCheckout === 'ENTERPRISE' ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Redirecting...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" /> Subscribe Enterprise
                </>
              )}
            </button>
          </div>

        </div>

        {/* Promo Code Creator (Admin Tool) */}
        <div className="max-w-xl mx-auto border border-dashed border-[#EAECE9] p-8 rounded-3xl bg-neutral-50/40">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-[#FAFBF9] border border-[#F1F3F1] text-[9px] font-bold text-[#738273] uppercase tracking-wider rounded-md">Admin Console</span>
          </div>
          <h3 className="text-lg font-bold text-black mb-1 flex items-center gap-2">
            Stripe Discount Promo Code Generator
          </h3>
          <p className="text-xs text-[#738273] mb-6">
            Generate customized coupon discount codes in your active Stripe payment gateway and use them immediately on the subscription checkout pages.
          </p>

          <form onSubmit={handleCreatePromo} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wider mb-2">Promo Code Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. HALFOFF"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#EAECE9] rounded-xl focus:ring-1 focus:ring-[#1C2E1E] focus:outline-none uppercase font-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wider mb-2">Percent Discount (%)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="100"
                  value={adminPercentOff}
                  onChange={(e) => setAdminPercentOff(parseInt(e.target.value) || 20)}
                  className="w-full px-4 py-2.5 bg-white border border-[#EAECE9] rounded-xl focus:ring-1 focus:ring-[#1C2E1E] focus:outline-none text-sm font-semibold"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingPromoCreate || !adminCode.trim()}
              className="w-full py-2.5 bg-neutral-900 text-white font-medium text-xs hover:bg-black rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loadingPromoCreate ? 'Generating in Stripe...' : 'Create Stripe Discount Code'}
            </button>
          </form>

          {createdPromo && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="mt-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl text-xs flex flex-col gap-1"
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Gift className="w-3.5 h-3.5 text-emerald-600" />
                <span>Code successfully registered in Stripe!</span>
              </div>
              <p className="opacity-95">Use code <strong className="font-mono text-sm underline">{createdPromo.code}</strong> during checkout to receive a <strong>{createdPromo.percentOff}%</strong> discount on subscriptions.</p>
            </motion.div>
          )}

          {promoError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs">
              {promoError}
            </div>
          )}

          {/* Dev License Bypass */}
          <div className="mt-8 pt-8 border-t border-[#EAECE9]">
            <h4 className="text-xs font-semibold text-black uppercase tracking-wider mb-1">Developer Bypass</h4>
            <p className="text-[11px] text-[#738273] mb-4">
              Directly write an active 10-year **Enterprise** subscription to your local database for the email entered in the status box.
            </p>
            <button
              type="button"
              onClick={handleGrantDevLicense}
              disabled={loadingDevLicense || !email.trim()}
              className="w-full py-2.5 bg-emerald-700 text-white font-medium text-xs hover:bg-emerald-800 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loadingDevLicense ? 'Granting...' : `Grant Free Enterprise to: ${email || '(enter email above)'}`}
            </button>
            
            {devLicenseMessage && (
              <div className="mt-4 p-3 bg-neutral-100 border border-[#EAECE9] text-neutral-800 rounded-xl text-xs font-mono">
                {devLicenseMessage}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
