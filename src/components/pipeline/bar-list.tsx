import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function BarList({
  title,
  items,
  emptyLabel = "No data yet",
}: {
  title: string;
  items: { name: string; count: number }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card className="py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 px-4">
        {items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        )}
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm text-muted-foreground" title={item.name}>
              {item.name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums">
              {item.count}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
