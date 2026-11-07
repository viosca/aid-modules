#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_PATH = path.join(ROOT_DIR, "src", "aid-modules.js");
const OUTPUT_LIB_PATH = path.join(ROOT_DIR, "library-aid-modules.js");
const PKG_PATH = path.join(ROOT_DIR, "package.json");

function getGitHash(dir) {
    try {
        return execSync("git rev-parse --short HEAD", { cwd: dir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch (_) {
        return "unknown";
    }
}

function getTimestamp() {
    return new Date().toISOString().replace("T", " ").replace(/\..+/, "") + " UTC";
}

function main() {
    console.log("==================================================================");
    console.log("  BUILDING AID-Modules Distribution Artifacts");
    console.log("==================================================================");

    if (!fs.existsSync(SRC_PATH)) {
        console.error(`Error: Source file not found at ${SRC_PATH}`);
        process.exit(1);
    }

    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
    const version = pkg.version || "1.0.0";
    const gitHash = getGitHash(ROOT_DIR);
    const timestamp = getTimestamp();

    console.log(`   Version:    ${version}`);
    console.log(`   Git Commit: ${gitHash}`);
    console.log(`   Build Time: ${timestamp}`);

    const rawSrc = fs.readFileSync(SRC_PATH, "utf8");

    // Replace dev placeholders with actual build metadata
    let stamped = rawSrc
        .replace(/const GIT_HASH = "[^"]*";/, `const GIT_HASH = "${gitHash}";`)
        .replace(/const BUILD_TIME = "[^"]*";/, `const BUILD_TIME = "${timestamp}";`);

    // Create official AID Library header banner
    const banner = `// ============================================================================
//
//                             USE THIS VERSION
//
//                      AID-Modules Registry (Ver. ${version})
//
//   Build Generation: ${timestamp}
//   Git Commit:       ${gitHash}
//   Repository:       https://github.com/viosca/aid-modules
//   License:          MIT (c) Randy Viosca (@Random_Variable)
//
//   Paste this whole file as your ENTIRE "Library" tab in AI Dungeon.
//
//   If publishing as a standalone script module on AI Dungeon:
//   1. In scenario Details -> Player presentation -> toggle "Mark as Script" ON.
//   2. In Scripts -> Library tab, paste this file.
//   3. In your scenario RUN ORDER, place AID-Modules at the TOP so all downstream
//      scripts can register and inspect modules!
//
// ============================================================================

`;

    const finalLibraryCode = banner + stamped;

    // Syntax validation
    try {
        new vm.Script(finalLibraryCode);
        console.log("   ✔ Syntax validation passed for library-aid-modules.js");
    } catch (err) {
        console.error("   ✖ Syntax validation FAILED for library-aid-modules.js:", err);
        process.exit(1);
    }

    // Write library-aid-modules.js
    fs.writeFileSync(OUTPUT_LIB_PATH, finalLibraryCode, "utf8");
    const libLines = finalLibraryCode.split("\n").length;
    const libKb = (Buffer.byteLength(finalLibraryCode, "utf8") / 1024).toFixed(1);
    console.log(`   ✔ Wrote library-aid-modules.js (${libLines.toLocaleString()} lines, ${libKb} KB)`);

    console.log("==================================================================");
    console.log("  🎉 BUILD COMPLETE!");
    console.log("==================================================================");
}

main();
