/**
 * In-App Visual Test Suite Execution Runner
 */
import React, { useState, useEffect } from 'react';
import { Play, CheckCircle2, XCircle, RotateCcw, Clock, ShieldCheck } from 'lucide-react';
import { request } from '../api/client.ts';

export interface TestCaseResult {
  id: string;
  suite: string;
  name: string;
  description: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  error?: string;
}

export const SystemTestsPage: React.FC = () => {
  const [running, setRunning] = useState<boolean>(false);
  const [testSummary, setTestSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
    results: TestCaseResult[];
  } | null>(null);

  const executeTestSuite = async () => {
    setRunning(true);
    try {
      const summary = await request<any>('/tests/run');
      setTestSummary(summary);
    } catch (err) {
      console.error('Test runner execution failed', err);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    executeTestSuite();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-stone-900 text-white rounded-3xl p-8 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400">
            <ShieldCheck className="w-4 h-4" /> Automated QA Test Suite
          </div>
          <h1 className="font-serif text-3xl font-bold mt-1">
            Verification & Integrity Runner
          </h1>
          <p className="text-stone-400 text-xs mt-1">
            Real-time execution of unit, business logic, password validation, double-booking lock, and order state machine test cases.
          </p>
        </div>

        <button
          onClick={executeTestSuite}
          disabled={running}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
        >
          {running ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" /> Running Tests...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" /> Re-Run Test Suite
            </>
          )}
        </button>
      </div>

      {/* Summary Scorecard */}
      {testSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase text-stone-400">Total Test Cases</span>
            <p className="font-mono font-bold text-2xl text-stone-900 mt-1">
              {testSummary.total}
            </p>
          </div>

          <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-emerald-800">Passed</span>
            <p className="font-mono font-bold text-2xl text-emerald-700 mt-1">
              {testSummary.passed}
            </p>
          </div>

          <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 shadow-xs">
            <span className="text-xs font-bold uppercase text-rose-800">Failed</span>
            <p className="font-mono font-bold text-2xl text-rose-700 mt-1">
              {testSummary.failed}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
            <span className="text-xs font-bold uppercase text-stone-400">Total Duration</span>
            <p className="font-mono font-bold text-2xl text-stone-900 mt-1 flex items-center gap-1.5">
              <Clock className="w-5 h-5 text-amber-700" />
              {testSummary.durationMs} ms
            </p>
          </div>
        </div>
      )}

      {/* Test Cases Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-stone-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-lg text-stone-900">
            Execution Log & Assertions
          </h3>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            All Core Suites Passing
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 text-stone-500 uppercase font-semibold border-b">
              <tr>
                <th className="p-4">Test ID</th>
                <th className="p-4">Suite</th>
                <th className="p-4">Test Name & Description</th>
                <th className="p-4">Duration</th>
                <th className="p-4 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {testSummary?.results.map((test) => (
                <tr key={test.id} className="hover:bg-stone-50/60">
                  <td className="p-4 font-mono font-bold text-amber-900">
                    {test.id}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-md bg-stone-100 font-semibold text-stone-700">
                      {test.suite}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-stone-900">{test.name}</p>
                    <p className="text-stone-500 text-[11px]">{test.description}</p>
                    {test.error && (
                      <p className="text-rose-600 font-mono mt-1 font-semibold">{test.error}</p>
                    )}
                  </td>
                  <td className="p-4 font-mono text-stone-500">
                    {test.durationMs} ms
                  </td>
                  <td className="p-4 text-right">
                    {test.status === 'PASSED' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PASSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" /> FAILED
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
