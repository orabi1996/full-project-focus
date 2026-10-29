// ==============================================================================
// MADARX ENTERPRISE WORKFORCE PLATFORM
// PRODUCTION DEPLOYMENT READINESS VERIFICATION SCRIPT
// ==============================================================================

const fs = require("fs");
const path = require("path");

console.log("----------------------------------------------------------------");
console.log("Verifying MadarX Production Build & Deployment Artifacts...");
console.log("----------------------------------------------------------------");

const outputDir = path.resolve(__dirname, "..", ".output");
const serverEntry = path.join(outputDir, "server", "index.mjs");
const publicDir = path.join(outputDir, "public");
const wranglerConfig = path.join(outputDir, "server", "wrangler.json");

let allPassed = true;

// 1. Verify Server Artifacts
if (fs.existsSync(serverEntry)) {
  const stat = fs.statSync(serverEntry);
  if (stat.size > 1024) {
    console.log(`[PASS] Server entry point exists: ${serverEntry} (${Math.round(stat.size / 1024)} KB)`);
  } else {
    console.error(`[FAIL] Server entry point is abnormally small (${stat.size} bytes).`);
    allPassed = false;
  }
} else {
  console.error(`[FAIL] Missing server entry point: ${serverEntry}`);
  allPassed = false;
}

// 2. Verify Public Client Assets
if (fs.existsSync(publicDir)) {
  const files = fs.readdirSync(publicDir);
  if (files.length > 0) {
    console.log(`[PASS] Client public assets directory exists: ${publicDir} (${files.length} items)`);
  } else {
    console.error(`[FAIL] Client public assets directory is empty.`);
    allPassed = false;
  }
} else {
  console.error(`[FAIL] Missing public client assets directory: ${publicDir}`);
  allPassed = false;
}

// 3. Verify Cloudflare Wrangler Config
if (fs.existsSync(wranglerConfig)) {
  console.log(`[PASS] Cloudflare Workers / Nitro deployment config exists: ${wranglerConfig}`);
} else {
  console.warn(`[WARN] Cloudflare wrangler.json not found (required only for Cloudflare target).`);
}

console.log("----------------------------------------------------------------");
if (allPassed) {
  console.log("STATUS: SUCCESS. All production deployment artifacts verified.");
  process.exit(0);
} else {
  console.error("STATUS: FAILURE. Deployment verification failed.");
  process.exit(1);
}
