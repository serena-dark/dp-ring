import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { demoSnapshot } from "../../apps/operator-web/src/lib/demo-data.ts";
import {
  getBootstrap,
  listActivity,
  listResource,
  readResource,
  streamActivity,
} from "../../apps/operator-web/src/lib/api.ts";

function restoreGlobal(name: "window" | "EventSource", descriptor?: PropertyDescriptor) {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
    return;
  }

  delete globalThis[name];
}

describe("operator-web api fallbacks", () => {
  it("falls back to demo snapshot data when fetch fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as typeof fetch;

    try {
      assert.deepEqual(await getBootstrap(), demoSnapshot.bootstrap);
      assert.deepEqual(await listActivity(), demoSnapshot.activity);
      assert.deepEqual(await listResource("workers"), demoSnapshot.workers);
      assert.deepEqual(await listResource("publication-roots"), demoSnapshot.publication_roots);
      assert.deepEqual(
        await readResource("objectives", demoSnapshot.objectives[0]!.id),
        demoSnapshot.objectives[0],
      );
      assert.deepEqual(
        await readResource("validation-reports", demoSnapshot.validation_reports[0]!.id),
        demoSnapshot.validation_reports[0],
      );
      assert.deepEqual(
        await readResource("validation-results", demoSnapshot.validation_results[0]!.id),
        demoSnapshot.validation_results[0],
      );
      assert.equal(await readResource("objectives", "missing-objective"), null);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns a no-op stream cleanup when browser EventSource support is unavailable", () => {
    const cleanup = streamActivity(() => {
      throw new Error("streamActivity should not emit in the node test environment");
    });

    assert.equal(typeof cleanup, "function");
    assert.doesNotThrow(() => cleanup());
  });

  it("returns a no-op stream cleanup when EventSource construction fails", () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalEventSource = Object.getOwnPropertyDescriptor(globalThis, "EventSource");
    class ThrowingEventSource {
      constructor() {
        throw new Error("EventSource unavailable");
      }
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { EventSource: ThrowingEventSource },
      writable: true,
    });
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      value: ThrowingEventSource,
      writable: true,
    });

    try {
      const cleanup = streamActivity(() => {
        throw new Error("streamActivity should not emit when EventSource creation fails");
      });

      assert.equal(typeof cleanup, "function");
      assert.doesNotThrow(() => cleanup());
    } finally {
      restoreGlobal("window", originalWindow);
      restoreGlobal("EventSource", originalEventSource);
    }
  });
});
