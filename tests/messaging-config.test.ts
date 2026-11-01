import assert from "node:assert/strict";
import test from "node:test";

import {
  getMessagingSendLimits,
  isMessagingDryRun,
  isGrowthEnabled,
  isMessagingEnabled,
  isWhatsAppLiveSendEnabled,
} from "../src/lib/messaging/config";

const configKeys = [
  "GROWTH_ENABLED",
  "MESSAGING_ENABLED",
  "DRY_RUN",
  "WHATSAPP_LIVE_SENDS_ENABLED",
] as const;

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
    assert.equal(isGrowthEnabled(), false);
    assert.equal(isMessagingEnabled(), false);
    assert.equal(isMessagingDryRun(), true);
    assert.equal(isWhatsAppLiveSendEnabled(), false);
  });
});

test("growth tools require their own explicit enable flag", () => {
  withMessagingEnvironment({ GROWTH_ENABLED: "true" }, () => {
    assert.equal(isGrowthEnabled(), true);
    assert.equal(isMessagingEnabled(), false);
  });
  withMessagingEnvironment({ GROWTH_ENABLED: "1" }, () => {
    assert.equal(isGrowthEnabled(), false);
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

test("live WhatsApp sending requires its separate explicit flag", () => {
  withMessagingEnvironment({ DRY_RUN: "false" }, () => {
    assert.equal(isMessagingDryRun(), false);
    assert.equal(isWhatsAppLiveSendEnabled(), false);
  });
  withMessagingEnvironment({ WHATSAPP_LIVE_SENDS_ENABLED: "true" }, () => {
    assert.equal(isWhatsAppLiveSendEnabled(), true);
  });
  withMessagingEnvironment({ WHATSAPP_LIVE_SENDS_ENABLED: "1" }, () => {
    assert.equal(isWhatsAppLiveSendEnabled(), false);
  });
});

test("send rate limits default conservatively and reject invalid values", () => {
  const keys = [
    "MAX_OUTBOUND_PER_CONTACT_PER_DAY",
    "MAX_OUTBOUND_PER_HOUR",
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  try {
    for (const key of keys) delete process.env[key];
    assert.deepEqual(getMessagingSendLimits(), {
      maxContactPerDay: 3,
      maxOutboundPerHour: 50,
    });

    process.env.MAX_OUTBOUND_PER_CONTACT_PER_DAY = "101";
    assert.throws(() => getMessagingSendLimits(), /Invalid MAX_OUTBOUND_PER_CONTACT_PER_DAY/);
    process.env.MAX_OUTBOUND_PER_CONTACT_PER_DAY = "3";
    process.env.MAX_OUTBOUND_PER_HOUR = "0";
    assert.throws(() => getMessagingSendLimits(), /Invalid MAX_OUTBOUND_PER_HOUR/);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
