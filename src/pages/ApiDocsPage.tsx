/**
 * Interactive REST API Documentation Explorer
 */
import React, { useState, useEffect } from 'react';
import { FileCode, Play, CheckCircle2, Shield, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export const ApiDocsPage: React.FC = () => {
  const { token } = useAuth();
  const { success } = useToast();
  const [spec, setSpec] = useState<any>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string>('/menu');
  const [activeMethod, setActiveMethod] = useState<string>('get');
  const [responseOutput, setResponseOutput] = useState<string>('// Click "Execute Request" to test this endpoint live against the API server.');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/openapi.json')
      .then((res) => res.json())
      .then((data) => setSpec(data))
      .catch((err) => console.error('Failed to load openapi spec', err));
  }, []);

  const handleExecute = async () => {
    setExecuting(true);
    setResponseStatus(null);
    try {
      const url = `/api${activeEndpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };

      const res = await fetch(url, {
        method: activeMethod.toUpperCase(),
        headers
      });

      setResponseStatus(res.status);
      const data = await res.json();
      setResponseOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setResponseOutput(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setExecuting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(responseOutput);
    setCopied(true);
    success('Response copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const ENDPOINTS = [
    { method: 'GET', path: '/menu', tag: 'Menu', desc: 'Get all dishes with optional search and filters' },
    { method: 'GET', path: '/menu/categories', tag: 'Menu', desc: 'Get list of menu categories' },
    { method: 'GET', path: '/tables', tag: 'Tables', desc: 'Get all hotel dining tables and restaurant info' },
    { method: 'GET', path: '/tables/availability?bookingDate=2026-09-25&startTime=19:30&guestCount=4', tag: 'Tables', desc: 'Check table availability for slot' },
    { method: 'GET', path: '/auth/me', tag: 'Auth', desc: 'Get current authenticated user profile (Requires Token)' },
    { method: 'GET', path: '/bookings', tag: 'Bookings', desc: 'Get user table reservation history (Requires Token)' },
    { method: 'GET', path: '/orders', tag: 'Orders', desc: 'Get user food ordering history (Requires Token)' },
    { method: 'GET', path: '/admin/stats', tag: 'Admin', desc: 'Get operations revenue and counts (Requires Admin Token)' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-stone-900 text-white rounded-3xl p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
            <FileCode className="w-4 h-4" /> OpenAPI 3.0 Standard
          </div>
          <h1 className="font-serif text-3xl font-bold mt-1">
            ABC Hotel REST API Documentation
          </h1>
          <p className="text-stone-400 text-xs mt-1">
            Explore and execute live REST endpoints for table booking, orders, menu querying, and administration.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-stone-800 p-2.5 rounded-xl border border-stone-700 text-xs">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Auth Status: </span>
          <strong className={token ? 'text-emerald-400' : 'text-amber-400'}>
            {token ? 'Authenticated (Bearer Token Active)' : 'Public Guest (No Token)'}
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 5 Cols: Endpoint Navigator */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/80 p-5 shadow-xs space-y-3">
          <h3 className="font-serif font-bold text-base text-stone-900 border-b pb-3">
            Available API Endpoints
          </h3>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {ENDPOINTS.map((ep) => {
              const isCurrent = activeEndpoint === ep.path;
              return (
                <button
                  key={`${ep.method}-${ep.path}`}
                  onClick={() => {
                    setActiveEndpoint(ep.path);
                    setActiveMethod(ep.method.toLowerCase());
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1 ${
                    isCurrent
                      ? 'bg-amber-50/80 border-amber-600 ring-2 ring-amber-600/20'
                      : 'bg-stone-50 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        ep.method === 'GET'
                          ? 'bg-blue-100 text-blue-800'
                          : ep.method === 'POST'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                      {ep.tag}
                    </span>
                  </div>

                  <p className="font-mono text-xs font-bold text-stone-900 break-all">
                    /api{ep.path}
                  </p>
                  <p className="text-[11px] text-stone-500 line-clamp-1">{ep.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 7 Cols: Interactive Runner & JSON Console */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-100 text-blue-800">
                  {activeMethod.toUpperCase()}
                </span>
                <span className="font-mono font-bold text-sm text-stone-900 break-all">
                  /api{activeEndpoint}
                </span>
              </div>

              <button
                onClick={handleExecute}
                disabled={executing}
                className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                {executing ? 'Executing...' : 'Execute Request'}
              </button>
            </div>

            {/* Console Output Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>Response Body</span>
                <div className="flex items-center gap-3">
                  {responseStatus && (
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                        responseStatus >= 200 && responseStatus < 300
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Status: {responseStatus}
                    </span>
                  )}
                  <button
                    onClick={copyToClipboard}
                    className="hover:text-stone-900 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    Copy JSON
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-stone-900 text-amber-200 rounded-xl font-mono text-xs overflow-x-auto max-h-[420px] leading-relaxed border border-stone-800">
                {responseOutput}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
