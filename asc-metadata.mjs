import { readFileSync } from "fs";
import { createSign } from "crypto";

// --- Config ---
const KEY_ID = process.env.EXPO_ASC_KEY_ID;
const ISSUER_ID = process.env.EXPO_ASC_ISSUER_ID;
const KEY_PATH = process.env.EXPO_ASC_API_KEY_PATH;
const APP_ID = "6759310735";
const VERSION_ID = "9151d87e-c1ad-41e9-a480-8f1db62812d9";

// --- JWT Generation ---
function base64url(buf) {
  return (typeof buf === "string" ? Buffer.from(buf) : buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 1200,
    aud: "appstoreconnect-v1",
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = readFileSync(KEY_PATH, "utf8");
  const sign = createSign("SHA256");
  sign.update(signingInput);
  const sig = sign.sign({ key, dsaEncoding: "ieee-p1363" });

  return `${signingInput}.${base64url(sig)}`;
}

const TOKEN = generateJWT();
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function apiCall(method, url, body) {
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json, text };
}

// --- Step 1: Get existing localizations ---
console.log("=== STEP 1: Get appStoreVersionLocalizations ===");
const locRes = await apiCall(
  "GET",
  `https://api.appstoreconnect.apple.com/v1/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`
);
console.log(`Status: ${locRes.status}`);

let enUSLocId = null;
if (locRes.ok && locRes.json?.data) {
  for (const loc of locRes.json.data) {
    console.log(
      `  Found locale: ${loc.attributes.locale} (id: ${loc.id})`
    );
    if (loc.attributes.locale === "en-US") {
      enUSLocId = loc.id;
    }
  }
} else {
  console.log("  Failed:", JSON.stringify(locRes.json?.errors, null, 2));
}

// --- Step 2: Create or update en-US localization ---
const locFields = {
  description: "Turn any GitHub repo into a deck of swipeable code cards. Master codebases through spaced repetition \u2014 the same technique used to learn languages, now applied to code.\n\nHOW IT WORKS\n\n\u2022 Paste any public GitHub repo URL\n\u2022 We extract the key functions, types, and patterns\n\u2022 Swipe right if you understand it, left to see it again\n\u2022 Cards resurface using spaced repetition until you master them\n\nFEATURES\n\n\u2022 Supports TypeScript, JavaScript, Python, Rust, Go, and Swift\n\u2022 Syntax-highlighted code cards with context\n\u2022 Three-tier mastery system: unseen \u2192 learning \u2192 mastered\n\u2022 Streak tracking to build a daily learning habit\n\u2022 Per-repo progress saved locally\n\u2022 Recent repos for quick access\n\u2022 Beautiful dark interface built for focused reading\n\u2022 Haptic feedback on every interaction\n\nWHY DOOMSCROLL\n\nReading code is hard. Codebases are overwhelming. doomscroll breaks repos into digestible cards and uses spaced repetition to make the knowledge stick.\n\nSwipe right when you get it. Swipe left to see it again. Swipe up to skip. Master a card after 3 correct swipes.\n\nAll data stays on your device. No accounts, no cloud sync, no tracking.",
  keywords: "code,learn code,github,spaced repetition,developer tools,programming,codebase,flashcards",
  supportUrl: "https://ninetynine.digital/contact",
  marketingUrl: "https://ninetynine.digital",
};

console.log("\n=== STEP 2: Update/Create en-US localization ===");
let locResult;
if (enUSLocId) {
  console.log(`Updating existing en-US localization (id: ${enUSLocId})...`);
  locResult = await apiCall(
    "PATCH",
    `https://api.appstoreconnect.apple.com/v1/appStoreVersionLocalizations/${enUSLocId}`,
    {
      data: {
        type: "appStoreVersionLocalizations",
        id: enUSLocId,
        attributes: locFields,
      },
    }
  );
} else {
  console.log("Creating new en-US localization...");
  locResult = await apiCall(
    "POST",
    `https://api.appstoreconnect.apple.com/v1/appStoreVersionLocalizations`,
    {
      data: {
        type: "appStoreVersionLocalizations",
        attributes: { locale: "en-US", ...locFields },
        relationships: {
          appStoreVersion: {
            data: { type: "appStoreVersions", id: VERSION_ID },
          },
        },
      },
    }
  );
}
console.log(`Status: ${locResult.status} ${locResult.ok ? "OK" : "FAILED"}`);
if (!locResult.ok) {
  console.log("Error:", JSON.stringify(locResult.json?.errors, null, 2));
}
// Update enUSLocId if we just created it
if (locResult.ok && locResult.json?.data?.id) {
  enUSLocId = locResult.json.data.id;
}

// --- Step 3: Update copyright on appStoreVersion ---
console.log("\n=== STEP 3: Update copyright ===");
const copyrightRes = await apiCall(
  "PATCH",
  `https://api.appstoreconnect.apple.com/v1/appStoreVersions/${VERSION_ID}`,
  {
    data: {
      type: "appStoreVersions",
      id: VERSION_ID,
      attributes: {
        copyright: "2026 Maxwell Young",
      },
    },
  }
);
console.log(`Status: ${copyrightRes.status} ${copyrightRes.ok ? "OK" : "FAILED"}`);
if (!copyrightRes.ok) {
  console.log("Error:", JSON.stringify(copyrightRes.json?.errors, null, 2));
}

// --- Step 4: Get appInfos, then update subtitle ---
console.log("\n=== STEP 4: Get appInfos ===");
const appInfoRes = await apiCall(
  "GET",
  `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/appInfos`
);
console.log(`Status: ${appInfoRes.status}`);

if (appInfoRes.ok && appInfoRes.json?.data) {
  for (const info of appInfoRes.json.data) {
    console.log(`  AppInfo id: ${info.id}, state: ${info.attributes.appStoreState}`);
  }

  // Find the editable appInfo (PREPARE_FOR_SUBMISSION or the first one)
  let appInfoId = null;
  for (const info of appInfoRes.json.data) {
    if (info.attributes.appStoreState === "PREPARE_FOR_SUBMISSION") {
      appInfoId = info.id;
      break;
    }
  }
  if (!appInfoId) {
    appInfoId = appInfoRes.json.data[0]?.id;
  }

  if (appInfoId) {
    // Get appInfoLocalizations
    console.log(`\nGetting appInfoLocalizations for ${appInfoId}...`);
    const infoLocRes = await apiCall(
      "GET",
      `https://api.appstoreconnect.apple.com/v1/appInfos/${appInfoId}/appInfoLocalizations`
    );
    console.log(`Status: ${infoLocRes.status}`);

    let enUSInfoLocId = null;
    if (infoLocRes.ok && infoLocRes.json?.data) {
      for (const loc of infoLocRes.json.data) {
        console.log(
          `  Found info locale: ${loc.attributes.locale} (id: ${loc.id}), subtitle: "${loc.attributes.subtitle}", privacyPolicyUrl: "${loc.attributes.privacyPolicyUrl}"`
        );
        if (loc.attributes.locale === "en-US") {
          enUSInfoLocId = loc.id;
        }
      }
    }

    if (enUSInfoLocId) {
      console.log(`\nUpdating subtitle + privacyPolicyUrl on appInfoLocalization ${enUSInfoLocId}...`);
      const subtitleRes = await apiCall(
        "PATCH",
        `https://api.appstoreconnect.apple.com/v1/appInfoLocalizations/${enUSInfoLocId}`,
        {
          data: {
            type: "appInfoLocalizations",
            id: enUSInfoLocId,
            attributes: {
              subtitle: "Master Any Codebase by Swiping",
              privacyPolicyUrl: "https://ninetynine.digital/doomscroll/privacy",
            },
          },
        }
      );
      console.log(`Status: ${subtitleRes.status} ${subtitleRes.ok ? "OK" : "FAILED"}`);
      if (!subtitleRes.ok) {
        console.log("Error:", JSON.stringify(subtitleRes.json?.errors, null, 2));
        // Retry without privacyPolicyUrl
        console.log("\nRetrying subtitle only...");
        const retry = await apiCall(
          "PATCH",
          `https://api.appstoreconnect.apple.com/v1/appInfoLocalizations/${enUSInfoLocId}`,
          {
            data: {
              type: "appInfoLocalizations",
              id: enUSInfoLocId,
              attributes: {
                subtitle: "Master Any Codebase by Swiping",
              },
            },
          }
        );
        console.log(`Retry status: ${retry.status} ${retry.ok ? "OK" : "FAILED"}`);
        if (!retry.ok) {
          console.log("Error:", JSON.stringify(retry.json?.errors, null, 2));
        }

        // Try privacyPolicyUrl separately
        console.log("\nTrying privacyPolicyUrl separately...");
        const privRetry = await apiCall(
          "PATCH",
          `https://api.appstoreconnect.apple.com/v1/appInfoLocalizations/${enUSInfoLocId}`,
          {
            data: {
              type: "appInfoLocalizations",
              id: enUSInfoLocId,
              attributes: {
                privacyPolicyUrl: "https://ninetynine.digital/doomscroll/privacy",
              },
            },
          }
        );
        console.log(`Privacy URL status: ${privRetry.status} ${privRetry.ok ? "OK" : "FAILED"}`);
        if (!privRetry.ok) {
          console.log("Error:", JSON.stringify(privRetry.json?.errors, null, 2));
        }
      }
    } else {
      console.log("No en-US appInfoLocalization found. Creating one...");
      const createInfoLoc = await apiCall(
        "POST",
        `https://api.appstoreconnect.apple.com/v1/appInfoLocalizations`,
        {
          data: {
            type: "appInfoLocalizations",
            attributes: {
              locale: "en-US",
              subtitle: "Master Any Codebase by Swiping",
              privacyPolicyUrl: "https://ninetynine.digital/doomscroll/privacy",
            },
            relationships: {
              appInfo: {
                data: { type: "appInfos", id: appInfoId },
              },
            },
          },
        }
      );
      console.log(`Status: ${createInfoLoc.status} ${createInfoLoc.ok ? "OK" : "FAILED"}`);
      if (!createInfoLoc.ok) {
        console.log("Error:", JSON.stringify(createInfoLoc.json?.errors, null, 2));
      }
    }
  }
}

// --- Step 5: Check builds ---
console.log("\n=== STEP 5: Check builds ===");
const buildsRes = await apiCall(
  "GET",
  `https://api.appstoreconnect.apple.com/v1/apps/${APP_ID}/builds?limit=3&fields[builds]=version,processingState,uploadedDate`
);
console.log(`Status: ${buildsRes.status}`);
if (buildsRes.ok && buildsRes.json?.data) {
  if (buildsRes.json.data.length === 0) {
    console.log("  No builds found.");
  }
  for (const build of buildsRes.json.data) {
    console.log(
      `  Build: v${build.attributes.version}, state: ${build.attributes.processingState}, uploaded: ${build.attributes.uploadedDate}`
    );
  }
} else {
  console.log("  Failed to fetch builds.");
  if (buildsRes.json?.errors) {
    console.log("Error:", JSON.stringify(buildsRes.json.errors, null, 2));
  }
}

console.log("\n=== DONE ===");
