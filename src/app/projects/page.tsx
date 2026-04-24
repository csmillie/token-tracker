import { getProjectUsage } from "@/lib/queries";
import { ProjectChartWrapper } from "./project-chart";
import { ProjectAccordion } from "./project-accordion";

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

          <div className="mt-6 space-y-2">
            {projects.map((p) => (
              <ProjectAccordion key={p.project_name} project={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
