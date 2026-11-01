import assert from "node:assert/strict";
import test from "node:test";

import { isMessagingDryRun, isMessagingEnabled } from "../src/lib/messaging/config";

const configKeys = ["MESSAGING_ENABLED", "DRY_RUN"] as const;

function withMessagingEnvironment(
  values: Partial<Record<(typeof configKeys)[number], string>>,
  callback: () => void,
) {
  const previous = Object.fromEntries(
    configKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof configKeys)[number], string | undefined>;

  for (const key of configKeys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    callback();
  } finally {
    for (const key of configKeys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("messaging is disabled and dry-run is enabled when unset", () => {
  withMessagingEnvironment({}, () => {
    assert.equal(isMessagingEnabled(), false);
    assert.equal(isMessagingDryRun(), true);
  });
});

test("messaging requires an explicit true value", () => {
  withMessagingEnvironment({ MESSAGING_ENABLED: "true" }, () => {
    assert.equal(isMessagingEnabled(), true);
  });
  withMessagingEnvironment({ MESSAGING_ENABLED: "1" }, () => {
    assert.equal(isMessagingEnabled(), false);
  });
});

test("dry-run can only be disabled by an explicit false value", () => {
  withMessagingEnvironment({ DRY_RUN: "false" }, () => {
    assert.equal(isMessagingDryRun(), false);
  });
  withMessagingEnvironment({ DRY_RUN: "TRUE" }, () => {
    assert.equal(isMessagingDryRun(), true);
  });
});
