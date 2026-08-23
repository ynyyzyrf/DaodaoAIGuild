"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  ClipboardList,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getDashboard } from "@/lib/admin-api";
import type { DashboardData } from "@/lib/admin-api";

function StatCard({
  icon: Icon,
  label,
  value,
  highlight = false,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  highlight?: boolean;
  href?: string;
}) {
  const body = (
    <div
      className={`card flex min-w-0 items-center gap-4 p-5 transition-colors ${
        highlight ? "border-brand-200 bg-brand-50/40" : ""
      }`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          highlight ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        <Icon size={20} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-slate-500">{label}</div>
        <div className={`truncate text-2xl font-bold ${highlight ? "text-brand-600" : "text-slate-900"}`}>
          {value}
        </div>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

function TrendChart({ trend }: { trend: DashboardData["trend"] }) {
  // 堆疊柱基準 = 每天三類之和的最大值；三層加起來恰好等於柱總高，避免溢出容器
  const maxSum = Math.max(1, ...trend.map((d) => d.questions + d.answers + d.tutorials));
  const height = 140;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <TrendingUp size={16} strokeWidth={2} />
        近 30 日内容趋势
      </div>
      <div className="mt-4">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> 问题
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" /> 回答
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> 教程
          </span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <div className="flex h-[140px] min-w-[480px] items-end gap-[3px]">
            {trend.map((d) => (
              <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end gap-[2px]">
                <div
                  className="w-full rounded-sm bg-amber-400/80 transition-all group-hover:bg-amber-500"
                  style={{ height: `${(d.tutorials / maxSum) * height}px` }}
                  title={`${d.date} 教程 ${d.tutorials}`}
                />
                <div
                  className="w-full rounded-sm bg-slate-400/80 transition-all group-hover:bg-slate-500"
                  style={{ height: `${(d.answers / maxSum) * height}px` }}
                  title={`${d.date} 回答 ${d.answers}`}
                />
                <div
                  className="w-full rounded-sm bg-brand-500/90 transition-all group-hover:bg-brand-600"
                  style={{ height: `${(d.questions / maxSum) * height}px` }}
                  title={`${d.date} 问题 ${d.questions}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-slate-400">加载中...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">仪表板</h1>
        <p className="mt-1 text-sm text-slate-500">社区健康度一览</p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="待审核教程"
          value={data.pending_tutorials}
          highlight
          href="/admin/moderation?target_type=tutorial"
        />
        <StatCard
          icon={MessageSquare}
          label="今日新增"
          value={data.today_new_questions + data.today_new_answers + data.today_new_tutorials}
        />
        <StatCard
          icon={ClipboardList}
          label="进行中任务"
          value={data.in_progress_missions}
          href="/admin/missions?status=in_progress"
        />
        <StatCard
          icon={Users}
          label="近 7 日活跃骑士"
          value={data.active_knights_7d}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <TrendChart trend={data.trend} />
        </div>
        <div className="min-w-0 space-y-4">
          {/* 待审核队列 */}
          <div className="card p-5">
            <div className="text-sm font-semibold text-slate-800">待审核队列</div>
            <div className="mt-3 space-y-2">
              <Link
                href="/admin/moderation?target_type=tutorial"
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50"
              >
                <span className="text-slate-600">待审核教程</span>
                <span className="badge badge-red">{data.pending_tutorials}</span>
              </Link>
              <Link
                href="/admin/moderation"
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-sm transition-colors hover:bg-slate-50"
              >
                <span className="text-slate-600">举报 / 敏感词命中</span>
                <span className="text-slate-400">→</span>
              </Link>
            </div>
          </div>

          {/* 异常预警 */}
          <div className="card border-orange-200 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
              <AlertTriangle size={16} strokeWidth={2} />
              异常预警
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>24h 内 0 浏览的问题</span>
                <span className="font-semibold text-orange-600">{data.alerts.zero_answer_questions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>超期未交付任务（7d+）</span>
                <span className="font-semibold text-orange-600">{data.alerts.overdue_missions}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
