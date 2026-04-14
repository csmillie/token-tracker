import { getProjectUsage } from "@/lib/queries";
import { ProjectChartWrapper } from "./project-chart";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let projects = null;
  let error = null;

  try {
    projects = await getProjectUsage();
  } catch (e) {
    error = String(e);
  }

  if (error) {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4">Projects</h2>
        <p className="text-red">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Projects</h2>

      {!projects || projects.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center text-text-muted">
          No project data yet.
        </div>
      ) : (
        <>
          <ProjectChartWrapper data={projects} />

          <div className="mt-6 bg-surface-raised border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left bg-surface-overlay">
                  <th className="p-3">Project</th>
                  <th className="p-3 text-right">Input Tokens</th>
                  <th className="p-3 text-right">Output Tokens</th>
                  <th className="p-3 text-right">Total Tokens</th>
                  <th className="p-3 text-right">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.project_name}
                    className="border-t border-border/50 hover:bg-surface-overlay"
                  >
                    <td className="p-3 text-text-primary font-medium">
                      {p.project_name}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {p.total_input.toLocaleString()}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {p.total_output.toLocaleString()}
                    </td>
                    <td className="p-3 text-right tabular-nums font-medium">
                      {p.total.toLocaleString()}
                    </td>
                    <td className="p-3 text-right tabular-nums text-text-secondary">
                      {p.session_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
