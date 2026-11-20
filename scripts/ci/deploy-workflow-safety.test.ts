import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function workflow(name: string) {
  return readFileSync(path.resolve(process.cwd(), ".github/workflows", name), "utf8");
}

describe("deploy workflow safety", () => {
  const prod = workflow("ci-cd.yml");
  const staging = workflow("deploy-staging-preview.yml");

  it("fails the build on critical and high advisories before deploy", () => {
    expect(prod).toContain("npm run audit:ci");
    expect(prod).toContain("needs: quality");
    expect(staging).toContain("npm run audit:ci");
    expect(staging).toContain("needs: quality");
  });

  it("refuses a production deploy from the wrong ref or the staging project", () => {
    expect(prod).toContain("refs/heads/main");
    expect(prod).toContain("refs/heads/develop");
    expect(prod).toContain(
      "VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID VERCEL_STAGING_PROJECT_ID",
    );
    expect(prod).toContain("VERCEL_PROJECT_ID must not equal VERCEL_STAGING_PROJECT_ID");
    expect(prod).toContain("github.event_name == 'push'");
  });

  it("refuses a staging deploy onto the production project", () => {
    expect(staging).toContain("refs/heads/staging");
    expect(staging).toContain("VERCEL_STAGING_PROJECT_ID must not equal VERCEL_PROJECT_ID");
    expect(staging).toContain('export VERCEL_PROJECT_ID="$VERCEL_STAGING_PROJECT_ID"');
  });

  it("audits the Apify actor lockfile for critical and high advisories", () => {
    const actorAudit =
      "npm audit --audit-level=high --prefix scripts/experimental/apify-rasaoi-menu-sync";
    expect(prod).toContain(actorAudit);
    expect(staging).toContain(actorAudit);
  });

  it("pins the Vercel CLI and keeps the token out of process arguments", () => {
    for (const yml of [prod, staging]) {
      expect(yml).toContain("vercel@66.5.0");
      expect(yml).not.toContain("vercel@latest");
      expect(yml).not.toContain("--token=");
    }
  });
});
