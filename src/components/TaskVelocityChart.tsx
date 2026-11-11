import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  Activity,
  Layers,
  Calendar,
  Filter,
} from 'lucide-react';
import { Task, DashboardCustomization } from '../types';

interface TaskVelocityChartProps {
  tasks: Task[];
  customization: DashboardCustomization;
}

type ChartViewMode = 'throughput' | 'cumulative' | 'weekly';

interface DayVelocityPoint {
  dateKey: string;
  displayDate: string;
  dayOfMonth: string;
  weekday: string;
  tasksCreated: number;
  tasksDone: number;
  cumulativeCreated: number;
  cumulativeDone: number;
  rollingVelocity: number;
}

export const TaskVelocityChart: React.FC<TaskVelocityChartProps> = ({
  tasks,
  customization,
}) => {
  const [viewMode, setChartViewMode] = useState<ChartViewMode>('throughput');

  const { chartData, metrics } = useMemo(() => {
    const now = new Date();
    const days: DayVelocityPoint[] = [];

    // Map existing live tasks in memory to dates
    const liveCreatedByDay = new Map<string, number>();
    const liveDoneByDay = new Map<string, number>();

    tasks.forEach((t) => {
      if (t.createdAt) {
        const d = new Date(t.createdAt).toISOString().split('T')[0];
        liveCreatedByDay.set(d, (liveCreatedByDay.get(d) || 0) + 1);
      }
      if (t.lane === 'done' && t.completedAt) {
        const d = new Date(t.completedAt).toISOString().split('T')[0];
        liveDoneByDay.set(d, (liveDoneByDay.get(d) || 0) + 1);
      }
    });

    let runningCreated = 0;
    let runningDone = 0;
    let total30DayDone = 0;
    let total30DayCreated = 0;

    // Generate 30 points (from 29 days ago to today)
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const isoKey = d.toISOString().split('T')[0];
      const monthShort = d.toLocaleDateString([], { month: 'short' });
      const dayNum = d.getDate();
      const weekday = d.toLocaleDateString([], { weekday: 'narrow' });

      // Live user tasks created or moved to done
      const created = liveCreatedByDay.get(isoKey) || 0;
      const done = liveDoneByDay.get(isoKey) || 0;

      runningCreated += created;
      runningDone += done;
      total30DayDone += done;
      total30DayCreated += created;

      days.push({
        dateKey: isoKey,
        displayDate: `${monthShort} ${dayNum}`,
        dayOfMonth: `${dayNum}`,
        weekday,
        tasksCreated: created,
        tasksDone: done,
        cumulativeCreated: runningCreated,
        cumulativeDone: runningDone,
        rollingVelocity: 0, // computed below
      });
    }

    // Compute 7-day rolling velocity
    for (let i = 0; i < days.length; i++) {
      const windowStart = Math.max(0, i - 6);
      const slice = days.slice(windowStart, i + 1);
      const sumDone = slice.reduce((acc, curr) => acc + curr.tasksDone, 0);
      days[i].rollingVelocity = parseFloat((sumDone / slice.length).toFixed(1));
    }

    const avgVelocityPerWeek = parseFloat(((total30DayDone / 30) * 7).toFixed(1));
    const throughputRatio =
      total30DayCreated > 0
        ? Math.min(100, Math.round((total30DayDone / total30DayCreated) * 100))
        : 0;

    return {
      chartData: days,
      metrics: {
        total30DayDone,
        total30DayCreated,
        avgVelocityPerWeek,
        throughputRatio,
        avgCycleDays: 1.8,
      },
    };
  }, [tasks]);

  const isDark = customization.themeMode === 'dark';
  const accentColor = customization.accentColor || '#38bdf8';

  return (
    <div className="p-5 sm:p-6 rounded-xl card-sheen border border-[var(--border-subtle)] relative overflow-hidden transition-colors">
      {/* Header and Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">
            Sprint Velocity &amp; Throughput
          </h2>
        </div>

        {/* View Mode Toggle Controls */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)] shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartViewMode('throughput')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === 'throughput'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-semibold shadow-xs border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Daily Velocity
          </button>
          <button
            type="button"
            onClick={() => setChartViewMode('cumulative')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === 'cumulative'
                ? 'bg-[var(--bg-surface-high)] text-[var(--accent-primary)] font-semibold shadow-xs border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Cumulative Flow
          </button>
        </div>
      </div>

      {/* KPI Velocity Sub-Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div className="p-3 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span>30-DAY COMPLETED</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-num text-[var(--text-primary)]">
              {metrics.total30DayDone}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            Tasks moved to 'Done'
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span>WEEKLY VELOCITY</span>
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-num text-[var(--text-primary)]">
              {metrics.avgVelocityPerWeek}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">tasks/wk</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            Rolling pace
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span>NEW INTAKE (TO-DO)</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-num text-[var(--text-primary)]">
              {metrics.total30DayCreated}
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">tasks</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            Added to backlog
          </span>
        </div>

        <div className="p-3 rounded-lg bg-[var(--bg-surface-lowest)] border border-[var(--border-subtle)]">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span>THROUGHPUT EFFICIENCY</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono-num text-[var(--text-primary)]">
              {metrics.throughputRatio}%
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono">
            Completed vs added
          </span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="w-full h-[280px] sm:h-[320px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'throughput' ? (
            <ComposedChart
              data={chartData}
              margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="velocityDoneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0.35} />
                </linearGradient>
                <linearGradient id="velocityCreatedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isDark ? '#475569' : '#94a3b8'} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={isDark ? '#1e293b' : '#cbd5e1'} stopOpacity={0.3} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}
              />

              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={{ stroke: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                tick={{
                  fill: isDark ? '#71717a' : '#64748b',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
                interval={4}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: isDark ? '#71717a' : '#64748b',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
                allowDecimals={false}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DayVelocityPoint;
                    return (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl text-xs font-mono backdrop-blur-md">
                        <div className="font-bold text-[var(--text-primary)] pb-1.5 mb-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
                          <span>{data.displayDate}</span>
                          <span className="text-[10px] text-[var(--text-muted)] font-normal">
                            Day {data.dayOfMonth}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-[var(--accent-primary)]">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: accentColor }}
                              />
                              Tasks Done:
                            </span>
                            <span className="font-bold">{data.tasksDone}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-[var(--text-secondary)]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              Tasks Added (To-Do):
                            </span>
                            <span className="font-bold">{data.tasksCreated}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-1 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)]">
                            <span>7-Day Pace:</span>
                            <span>{data.rollingVelocity} / day</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Bar 1: Tasks Added to To-Do / Backlog */}
              <Bar
                dataKey="tasksCreated"
                name="Tasks Added (To-Do)"
                fill="url(#velocityCreatedGrad)"
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
              />

              {/* Bar 2: Tasks Moved to 'Done' */}
              <Bar
                dataKey="tasksDone"
                name="Tasks Completed (Done)"
                fill="url(#velocityDoneGrad)"
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
              />

              {/* Smooth 7-Day Velocity Trendline */}
              <Line
                type="monotone"
                dataKey="rollingVelocity"
                name="7-Day Rolling Pace"
                stroke={isDark ? '#ffffff' : '#0f172a'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: accentColor }}
              />
            </ComposedChart>
          ) : (
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaDoneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="areaCreatedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.01} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}
              />

              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={{ stroke: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                tick={{
                  fill: isDark ? '#71717a' : '#64748b',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
                interval={4}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{
                  fill: isDark ? '#71717a' : '#64748b',
                  fontSize: 10,
                  fontFamily: 'JetBrains Mono',
                }}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DayVelocityPoint;
                    return (
                      <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl text-xs font-mono backdrop-blur-md">
                        <div className="font-bold text-[var(--text-primary)] pb-1.5 mb-1.5 border-b border-[var(--border-subtle)]">
                          {data.displayDate} (Cumulative)
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-4 text-[var(--accent-primary)]">
                            <span>Cumulative Done:</span>
                            <span className="font-bold">{data.cumulativeDone}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[var(--text-secondary)]">
                            <span>Total Ingested (To-Do):</span>
                            <span className="font-bold">{data.cumulativeCreated}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 pt-1 border-t border-[var(--border-subtle)] text-[10px] text-emerald-400">
                            <span>Sprint Completion:</span>
                            <span>
                              {Math.round((data.cumulativeDone / data.cumulativeCreated) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="cumulativeCreated"
                name="Cumulative To-Do / Ingested"
                stroke="#94a3b8"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#areaCreatedGrad)"
              />

              <Area
                type="monotone"
                dataKey="cumulativeDone"
                name="Cumulative Done"
                stroke={accentColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#areaDoneGrad)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend & Summary Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-[var(--border-subtle)] text-[11px] font-mono">
        <div className="flex items-center gap-4 text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: accentColor }}
            />
            {viewMode === 'throughput' ? "Moved to 'Done'" : "Cumulative Done"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-400" />
            {viewMode === 'throughput' ? "Added to 'To-Do'" : "Total Ingested"}
          </span>
          {viewMode === 'throughput' && (
            <span className="flex items-center gap-1.5 text-[var(--text-primary)]">
              <span className="w-4 h-0.5 bg-current rounded-full" />
              7-Day Rolling Trend
            </span>
          )}
        </div>

        <span className="text-[10px] text-[var(--text-muted)]">
          Automated sprint telemetry · Updated in real time
        </span>
      </div>
    </div>
  );
};
