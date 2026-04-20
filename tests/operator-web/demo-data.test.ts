import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoSnapshot } from "../../apps/operator-web/src/lib/demo-data.ts";
import { formatDateTime, titleize } from "../../apps/operator-web/src/lib/format.ts";

describe("operator-web demo data", () => {
  it("exposes the expected operator navigation surfaces", () => {
    const paths = demoSnapshot.bootstrap.navigation.map((item) => item.path);

    assert.deepEqual(paths, [
      "/inbox",
      "/objectives",
      "/queue",
      "/runs",
      "/reviews",
      "/governance",
      "/findings",
      "/insights",
      "/workers",
    ]);
  });

  it("keeps governance artifacts linked across publication roots, reports, and results", () => {
    const publicationRootIds = new Set(demoSnapshot.publication_roots.map((item) => item.id));
    const validationReportIds = new Set(demoSnapshot.validation_reports.map((item) => item.id));

    assert.ok(
      demoSnapshot.publication_roots.some((item) =>
        item.member_descriptors.some((member) => member.artifact_type === "validation-report"),
      ),
    );

    for (const report of demoSnapshot.validation_reports) {
      assert.ok(publicationRootIds.has(report.data.subject_ref.id), `missing publication root for ${report.id}`);
    }

    for (const result of demoSnapshot.validation_results) {
      assert.ok(validationReportIds.has(result.data.report_id), `missing validation report for ${result.id}`);
    }
  });

  it("keeps basic formatting helpers stable", () => {
    assert.equal(titleize("review_inbox"), "Review Inbox");
    assert.equal(formatDateTime(null), "—");
  });
});
