"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, Clock, Activity, Zap, Award, BarChart3, Database, Calendar, Trash2 } from "lucide-react";
import Link from "next/link";

interface OverviewStats {
  total_sessions: number;
  total_events: number;
  avg_duration: number;
  avg_confidence: number;
  avg_fps: number;
  avg_latency: number;
  most_used_gesture: string;
  gesture_distribution: Record<string, number>;
  correction_rate: number;
  accuracy: number;
  module_usage: {
    canvas_saves: number;
    math_solves: number;
  };
}

interface SessionLog {
  id: number;
  session_uuid: string;
  created_at: string;
  duration: number;
  gesture_count: number;
  writing_count: number;
  canvas_count: number;
  math_count: number;
}

interface TimelineEvent {
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

export default function AnalyticsDashboardPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState(30);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const overviewResp = await fetch(`${apiUrl}/api/analytics/overview?days=${filterDays}`);
      const sessionsResp = await fetch(`${apiUrl}/api/analytics/sessions`);
      const timelineResp = await fetch(`${apiUrl}/api/analytics/timeline`);

      if (overviewResp.ok) {
        const overviewData = await overviewResp.json();
        setOverview(overviewData.overview);
      }
      if (sessionsResp.ok) {
        const sessionsData = await sessionsResp.json();
        setSessions(sessionsData.sessions);
      }
      if (timelineResp.ok) {
        const timelineData = await timelineResp.json();
        setTimeline(timelineData.timeline);
      }
    } catch (e) {
      console.error("Error fetching analytics details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [filterDays]);

  const handlePurge = async () => {
    const proceed = confirm("Privacy check: This will permanently delete all session history, coordinate trajectories, and tracking events. Proceed?");
    if (!proceed) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/analytics/purge`, {
        method: "DELETE"
      });
      if (response.ok) {
        alert("All interaction data purged successfully.");
        fetchAnalytics();
      } else {
        alert("Purge operation failed.");
      }
    } catch (e) {
      console.error(e);
      alert("Error Purging data.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-mono text-gray-400">Loading system metrics dashboard...</p>
        </div>
      </div>
    );
  }

  const o = overview;

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-[#f3f4f6] min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f172a] px-6 py-4 flex justify-between items-center z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-md font-bold tracking-wider text-white">SYSTEM ANALYTICS</h1>
            <p className="text-[10px] text-gray-400 font-mono">Performance indicators, interaction logs, and database metrics</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            className="bg-gray-900 border border-gray-800 rounded px-2.5 py-1 text-xs text-gray-300 font-semibold focus:outline-none focus:border-blue-500"
            aria-label="Filter Days range selector"
          >
            <option value={7}>7 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>All time</option>
          </select>
          <button
            onClick={handlePurge}
            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/40 border border-red-900/30 text-red-400 hover:text-red-300 transition"
            title="Purge session data logs"
            aria-label="Purge Analytics Data"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Grid dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Metric Cards overview grid */}
        {!o || (o.total_sessions === 0 && o.total_events === 0 && o.module_usage.canvas_saves === 0 && o.module_usage.math_solves === 0) ? (
          <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-8 text-center text-gray-500">
            No system interaction logs available for this range. Select another duration filter.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1 */}
              <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-950/60 border border-blue-900/40 text-blue-400">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] font-mono block uppercase">Total Sessions:</span>
                  <span className="text-xl font-bold text-white">{o.total_sessions}</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-violet-950/60 border border-violet-900/40 text-violet-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] font-mono block uppercase">System FPS / latency:</span>
                  <span className="text-sm font-bold text-white block">
                    {o.avg_fps.toFixed(0)} FPS / {o.avg_latency.toFixed(0)}ms
                  </span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-900/40 text-emerald-400">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] font-mono block uppercase">Gesture Confidence:</span>
                  <span className="text-xl font-bold text-white">{(o.avg_confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-900/40 text-amber-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] font-mono block uppercase">Correction Rate:</span>
                  <span className="text-xl font-bold text-white">{(o.correction_rate * 100).toFixed(0)}%</span>
                </div>
              </div>

            </div>

            {/* Middle Grid: Charts & Timelines */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Visual breakdowns (ColSpan: 8) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* Gestures distribution chart */}
                <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 pb-3 border-b border-gray-800/80 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Gesture Distribution counts
                  </h3>
                  <div className="space-y-4">
                    {Object.entries(o.gesture_distribution).map(([gesture, count]) => {
                      const maxCount = Math.max(...Object.values(o.gesture_distribution));
                      const percent = maxCount > 0 ? (count / maxCount) * 100 : 0;
                      return (
                        <div key={gesture} className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-white font-bold">{gesture}</span>
                            <span className="text-gray-400">{count} times</span>
                          </div>
                          <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-900">
                            <div style={{ width: `${percent}%` }} className="h-full bg-blue-600 rounded-full"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modules usage details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 text-center">
                    <span className="text-gray-500 text-[10px] font-mono block uppercase">Canvas saves:</span>
                    <span className="text-3xl font-bold text-blue-400 mt-2 block">{o.module_usage.canvas_saves}</span>
                  </div>
                  <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 text-center">
                    <span className="text-gray-500 text-[10px] font-mono block uppercase">Math Solves:</span>
                    <span className="text-3xl font-bold text-violet-400 mt-2 block">{o.module_usage.math_solves}</span>
                  </div>
                </div>

              </div>

              {/* Right Column: Activity Timeline (ColSpan: 4) */}
              <div className="lg:col-span-4 flex flex-col">
                <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5 flex-1 flex flex-col">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 pb-3 border-b border-gray-800/80 mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-500" />
                    Interaction Timeline
                  </h3>
                  <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2">
                    {timeline.length === 0 ? (
                      <span className="text-gray-500 italic text-xs block text-center py-10">No recent events tracked.</span>
                    ) : (
                      timeline.map((event, idx) => (
                        <div key={idx} className="flex gap-3 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                          <div>
                            <span className="font-bold text-white block">{event.title}</span>
                            <span className="text-gray-500 text-[10px] font-mono block">{new Date(event.timestamp).toLocaleTimeString()}</span>
                            <span className="text-gray-400 mt-0.5 block leading-relaxed">{event.description}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Session History Table */}
            <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 pb-3 border-b border-gray-800/80 mb-4">
                Session History details
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 uppercase text-[10px]">
                      <th className="py-2">UUID</th>
                      <th className="py-2">Start Time</th>
                      <th className="py-2">Duration</th>
                      <th className="py-2">Gestures</th>
                      <th className="py-2">Writing</th>
                      <th className="py-2">Canvas</th>
                      <th className="py-2">Math</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((sess) => (
                      <tr key={sess.id} className="border-b border-gray-900 last:border-b-0 hover:bg-gray-950/40">
                        <td className="py-3 text-gray-400 font-bold">{sess.session_uuid.slice(0, 8)}...</td>
                        <td className="py-3 text-gray-400">{new Date(sess.created_at).toLocaleString()}</td>
                        <td className="py-3 text-white font-bold">{sess.duration}s</td>
                        <td className="py-3 text-blue-400">{sess.gesture_count}</td>
                        <td className="py-3 text-amber-400">{sess.writing_count}</td>
                        <td className="py-3 text-emerald-400">{sess.canvas_count}</td>
                        <td className="py-3 text-purple-400">{sess.math_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
export type AnalyticsDashboardPageType = typeof AnalyticsDashboardPage;
