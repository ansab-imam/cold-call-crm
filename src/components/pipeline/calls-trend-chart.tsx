"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Point = { date: string; count: number; trackedCount?: number };

const WIDTH = 900;
const HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatShortDate(dateKey: string): string {
  // dateKey is "YYYY-MM-DD" (UTC) — parse as UTC so the label always
  // matches the day it actually represents, no local timezone drift.
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function CallsTrendChart({
  data,
  trackedLabel,
}: {
  data: Point[];
  // When set, a second line plots `trackedCount` per day (e.g. how many
  // calls landed on "Interested" each day) alongside total call volume, so
  // it's visible whether more calls is actually converting into more of
  // what matters, not just more activity.
  trackedLabel?: string | null;
}) {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const showTracked = !!trackedLabel;

  const max = Math.max(
    1,
    ...data.map((d) => d.count),
    ...(showTracked ? data.map((d) => d.trackedCount ?? 0) : [])
  );
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD_LEFT + stepX * i;
    const y = PAD_TOP + plotHeight - (d.count / max) * plotHeight;
    const trackedY =
      PAD_TOP + plotHeight - ((d.trackedCount ?? 0) / max) * plotHeight;
    return { x, y, trackedY, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(PAD_TOP + plotHeight).toFixed(2)} L ${points[0].x.toFixed(2)} ${(PAD_TOP + plotHeight).toFixed(2)} Z`
      : "";
  const trackedLinePath = showTracked
    ? points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.trackedY.toFixed(2)}`)
        .join(" ")
    : "";

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const trackedTotal = data.reduce((sum, d) => sum + (d.trackedCount ?? 0), 0);
  // A handful of evenly-spaced date labels along the x-axis — every single
  // one of 30 days would overlap and be unreadable.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-base">Calls per day</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-primary" />
            Calls · {total} total
          </span>
          {showTracked && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-emerald-500" />
              {trackedLabel} · {trackedTotal} total
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-56 w-full"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Horizontal gridlines at 0%, 50%, 100% of the max */}
          {[0, 0.5, 1].map((f) => {
            const y = PAD_TOP + plotHeight - f * plotHeight;
            return (
              <line
                key={f}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
            );
          })}

          {areaPath && (
            <path d={areaPath} fill="var(--color-primary)" fillOpacity={0.08} stroke="none" />
          )}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {trackedLinePath && (
            <path
              d={trackedLinePath}
              fill="none"
              stroke="var(--color-emerald-500, #10b981)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray="4 3"
            />
          )}

          {points.map((p, i) => (
            <g key={p.date}>
              {/* Wide invisible hit target — the visible dot is too small to hover reliably */}
              <rect
                x={p.x - stepX / 2}
                y={PAD_TOP}
                width={Math.max(stepX, 1)}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
              />
              {(hoverIndex === i || p.count > 0) && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === i ? 4 : 2.5}
                  fill="var(--color-primary)"
                  stroke="var(--color-card)"
                  strokeWidth={1.5}
                />
              )}
              {showTracked && (hoverIndex === i || (p.trackedCount ?? 0) > 0) && (
                <circle
                  cx={p.x}
                  cy={p.trackedY}
                  r={hoverIndex === i ? 4 : 2.5}
                  fill="#10b981"
                  stroke="var(--color-card)"
                  strokeWidth={1.5}
                />
              )}
              {i % labelEvery === 0 && (
                <text
                  x={p.x}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize={11}
                >
                  {formatShortDate(p.date)}
                </text>
              )}
            </g>
          ))}

          {hoverIndex !== null && (
            <line
              x1={points[hoverIndex].x}
              x2={points[hoverIndex].x}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              className="stroke-border"
              strokeDasharray="3 3"
            />
          )}
        </svg>

        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-32 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md"
            style={{
              left: `${(points[hoverIndex].x / WIDTH) * 100}%`,
              transform:
                (points[hoverIndex].x / WIDTH) * 100 < 12
                  ? "translateX(0%)"
                  : (points[hoverIndex].x / WIDTH) * 100 > 88
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            <div className="mb-1.5 font-medium text-foreground">
              {formatShortDate(points[hoverIndex].date)}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
                  Calls
                </span>
                <span className="font-medium tabular-nums text-foreground">
                  {points[hoverIndex].count}
                </span>
              </div>
              {showTracked && (
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {trackedLabel}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {points[hoverIndex].trackedCount ?? 0}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
}
