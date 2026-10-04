import { buildTemplateCsv } from "@/lib/pipeline/template";

export async function GET() {
  const csv = buildTemplateCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="coldcall-pipeline-template.csv"',
    },
  });
}
