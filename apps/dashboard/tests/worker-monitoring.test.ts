import { describe, expect, it } from "vitest";
import { normalizeResources, parseHealthcheckTargets } from "../src/worker/index";

describe("dashboard monitoring discovery", () => {
  it("associates a Worker with its official custom domain", () => {
    const resources = normalizeResources({
      zones: [{ id: "zone-8xd", name: "8xd.io", status: "active" }],
      pages: [],
      workers: [{ id: "jovlo-ai" }],
      workerDomains: [{ hostname: "jovlo.8xd.io", service: "jovlo-ai", zone_name: "8xd.io" }],
      d1: [],
      r2: { buckets: [] },
      kv: [],
      queues: [],
      vectorize: [],
    });

    expect(resources.find((item) => item.id === "worker-jovlo-ai")).toMatchObject({
      name: "jovlo-ai",
      projectKey: "jovlo",
      domain: "8xd.io",
      hostnames: ["jovlo.8xd.io"],
    });
  });

  it("accepts only complete HTTPS health targets", () => {
    const targets = parseHealthcheckTargets(JSON.stringify([
      {
        id: "jovlo",
        name: "Jovlo",
        url: "https://jovlo.8xd.io/api/health",
        projectKey: "jovlo",
        domain: "8xd.io",
      },
      { id: "bad", name: "Bad", url: "http://example.com", projectKey: "bad", domain: "example.com" },
    ]));

    expect(targets).toEqual([
      {
        id: "jovlo",
        name: "Jovlo",
        url: "https://jovlo.8xd.io/api/health",
        projectKey: "jovlo",
        domain: "8xd.io",
      },
    ]);
  });
});
