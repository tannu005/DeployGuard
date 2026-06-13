'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { Activity, ShieldAlert, TrendingDown, Clock, Home } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface DashboardStats {
  totalScans: number;
  totalCriticalIssues: number;
  avgTimeSavingsS: number;
  avgCostSavingsPercent: number;
}

interface TrendData {
  date: string;
  issues: number;
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await axios.get(`${API_URL}/api/v1/analytics/dashboard`);
        setStats(res.data.stats);
        setTrends(res.data.trends);
      } catch (e) {
        console.error("Failed to load analytics", e);
        // We removed the mock fallback. The dashboard will show 0s or errors if DB is empty/unreachable.
        setStats({
          totalScans: 0,
          totalCriticalIssues: 0,
          avgTimeSavingsS: 0,
          avgCostSavingsPercent: 0
        });
        setTrends([
          { date: '-', issues: 0 },
          { date: '-', issues: 0 },
          { date: '-', issues: 0 },
          { date: '-', issues: 0 },
          { date: '-', issues: 0 }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#F1F3F1] border-t-[#1C2E1E] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans selection:bg-[#EAECE9] selection:text-[#1C2E1E]">
      
      {/* Interactive Navbar */}
      <header className="fixed top-0 inset-x-0 z-[20] px-5 sm:px-8 py-4 sm:py-5 flex flex-row justify-between items-center bg-white/80 backdrop-blur-sm border-b border-[#F1F3F1]">
        <div className="flex flex-row items-center gap-3">
          <span className="text-[21px] sm:text-[26px] tracking-tight font-medium select-none shiny-text">DeployGuard&reg;</span>
          <span className="text-[25px] sm:text-[30px] select-none tracking-[-0.02em] font-medium leading-none mb-1 shiny-text">&#10033;</span>
        </div>
        
        <div className="hidden md:flex flex-row items-center gap-8 text-[20px] font-medium">
          <a href="https://github.com/tannu005/DeployGuard" target="_blank" rel="noreferrer" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Documentation</a>
          <Link href="/analytics" className="cursor-pointer hover:opacity-60 transition-opacity underline underline-offset-4 shiny-text">Analytics</Link>
          <Link href="/pricing" className="cursor-pointer hover:opacity-60 transition-opacity shiny-text">Pricing</Link>
        </div>

        <Link href="/" className="hidden md:flex items-center gap-2 text-[18px] text-[#1C2E1E] bg-[#FAFBF9] border border-[#F1F3F1] px-5 py-2 rounded-full hover:bg-[#F1F3F1]/55 transition-all">
          <Home className="w-4 h-4" /> Back to Scanner
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-8 pt-36 pb-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-14">
          <h1 className="text-4xl md:text-5xl font-normal tracking-tight shiny-text pb-2">
            Global Analytics
          </h1>
          <p className="text-lg text-[#5A635A] mt-4 font-normal max-w-2xl">
            Real-time insights across your entire Salesforce CI/CD infrastructure.
          </p>
        </motion.div>

        {/* Top KPIs */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
        >
          <div className="bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white border border-[#EAECE9] rounded-lg"><Activity className="w-5 h-5 text-[#1C2E1E]" /></div>
              <h3 className="text-[#5A635A] font-medium text-sm">Total Scans</h3>
            </div>
            <p className="text-4xl font-medium tracking-tight text-black">{stats?.totalScans.toLocaleString()}</p>
          </div>

          <div className="bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white border border-[#EAECE9] rounded-lg"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
              <h3 className="text-[#5A635A] font-medium text-sm">Critical Intercepts</h3>
            </div>
            <p className="text-4xl font-medium tracking-tight text-black">{stats?.totalCriticalIssues.toLocaleString()}</p>
          </div>

          <div className="bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white border border-[#EAECE9] rounded-lg"><Clock className="w-5 h-5 text-[#1C2E1E]" /></div>
              <h3 className="text-[#5A635A] font-medium text-sm">Avg Time Saved</h3>
            </div>
            <p className="text-4xl font-medium tracking-tight text-black">{stats?.avgTimeSavingsS}s <span className="text-sm font-normal text-[#738273]">/ run</span></p>
          </div>

          <div className="bg-[#FAFBF9] border border-[#F1F3F1] p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-white border border-[#EAECE9] rounded-lg"><TrendingDown className="w-5 h-5 text-[#4D6D47]" /></div>
              <h3 className="text-[#5A635A] font-medium text-sm">Cloud Cost Reduced</h3>
            </div>
            <p className="text-4xl font-medium tracking-tight text-black">{stats?.avgCostSavingsPercent}%</p>
          </div>
        </motion.div>

        {/* Charts */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <div className="bg-white border border-[#F1F3F1] p-8 rounded-2xl shadow-sm">
            <h3 className="text-lg font-medium tracking-tight mb-8 text-black">
              Issues Detected Over Time
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F1" vertical={false} />
                  <XAxis dataKey="date" stroke="#738273" tick={{fill: '#738273', fontSize: 13}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#738273" tick={{fill: '#738273', fontSize: 13}} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    cursor={{fill: '#F9FAFB'}}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #EAECE9', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    itemStyle={{ color: '#1C2E1E', fontWeight: 500 }}
                  />
                  <Bar dataKey="issues" fill="#1C2E1E" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-[#F1F3F1] p-8 rounded-2xl shadow-sm">
            <h3 className="text-lg font-medium tracking-tight mb-8 text-black">
              Pipeline Processing Volume
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F1" vertical={false} />
                  <XAxis dataKey="date" stroke="#738273" tick={{fill: '#738273', fontSize: 13}} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#738273" tick={{fill: '#738273', fontSize: 13}} tickLine={false} axisLine={false} dx={-10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #EAECE9', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    itemStyle={{ color: '#4D6D47', fontWeight: 500 }}
                  />
                  <Line type="monotone" dataKey="issues" stroke="#4D6D47" strokeWidth={3} dot={{ r: 4, fill: '#4D6D47', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#1C2E1E', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
