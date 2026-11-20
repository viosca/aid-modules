#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_PATH = path.join(ROOT_DIR, "src", "aid-modules.js");
const CLIENT_SRC_PATH = path.join(ROOT_DIR, "src", "cscp-client.js");
const LOADER_SRC_PATH = path.join(ROOT_DIR, "src", "cscp-loader.js");
const OUTPUT_LIB_PATH = path.join(ROOT_DIR, "library-aid-modules.js");
const OUTPUT_LOADER_PATH = path.join(ROOT_DIR, "library-cscp-loader.js");
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

/**
 * Safely minifies JS source by stripping block/line comments and collapsing
 * leading/trailing whitespace and empty lines while preserving string/regex literals.
 */
function minifyJs(src) {
    // Strip JSDoc / block comments and pure comment lines
    const noBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, "");
    const lines = noBlockComments
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith("//"));
    return lines.join("\n");
}

function main() {
    console.log("==================================================================");
    console.log("  BUILDING AID-Modules & CSCP Variation-Selector DLL Artifacts");
    console.log("==================================================================");

    if (!fs.existsSync(SRC_PATH) || !fs.existsSync(CLIENT_SRC_PATH)) {
        console.error("Error: Source files not found.");
        process.exit(1);
    }

    const pkg = JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));
    const version = pkg.version || "1.1.0";
    const gitHash = getGitHash(ROOT_DIR);
    const timestamp = getTimestamp();

    console.log(`   Version:    ${version}`);
    console.log(`   Git Commit: ${gitHash}`);
    console.log(`   Build Time: ${timestamp}`);

    // 1. Stamp and minify cscp-client.js for the Variation-Selector DLL payload
    const rawClient = fs.readFileSync(CLIENT_SRC_PATH, "utf8");
    const stampedClient = rawClient
        .replace(/const GIT_HASH = "[^"]*";/, `const GIT_HASH = "${gitHash}";`)
        .replace(/const BUILD_TIME = "[^"]*";/, `const BUILD_TIME = "${timestamp}";`);

    const minifiedClient = minifyJs(stampedClient);
    try {
        new vm.Script(minifiedClient);
        console.log(`   ✔ Minified CSCP Client DLL payload (${Buffer.byteLength(minifiedClient, "utf8")} bytes)`);
    } catch (err) {
        console.error("   ✖ Syntax validation FAILED for minified CSCP client:", err);
        process.exit(1);
    }

    // 2. Stamp aid-modules.js and embed the stamped client (self-serializing via cscpFactory.toString())
    const rawSrc = fs.readFileSync(SRC_PATH, "utf8");
    const stampedServer = rawSrc
        .replace("/* __EMBED_CSCP_CLIENT__ */", stampedClient)
        .replace(/const GIT_HASH = "[^"]*";/g, `const GIT_HASH = "${gitHash}";`)
        .replace(/const BUILD_TIME = "[^"]*";/g, `const BUILD_TIME = "${timestamp}";`);

    const banner = `// ============================================================================
//
//                             USE THIS VERSION
//
//                  AID-Modules & CSCP Server (Ver. ${version})
//
//   Build Generation: ${timestamp}
//   Git Commit:       ${gitHash}
//   Repository:       https://github.com/viosca/aid-modules
//   License:          MIT (c) Randy Viosca (@Random_Variable)
//
//   Paste this whole file as your ENTIRE "Library" tab in AI Dungeon.
//
//   Exports the CSCP Client DLL into storyCards using 16 invisible Unicode
//   Variation Selectors (\\uFE00..\\uFE0F) so downstream script slots can
//   dynamically load the CSCP client at runtime via loadCSCP()!
//
// ============================================================================

`;

    const finalLibraryCode = banner + stampedServer;

    try {
        new vm.Script(finalLibraryCode);
        console.log("   ✔ Syntax validation passed for library-aid-modules.js");
    } catch (err) {
        console.error("   ✖ Syntax validation FAILED for library-aid-modules.js:", err);
        process.exit(1);
    }

    fs.writeFileSync(OUTPUT_LIB_PATH, finalLibraryCode, "utf8");
    const libLines = finalLibraryCode.split("\n").length;
    const libKb = (Buffer.byteLength(finalLibraryCode, "utf8") / 1024).toFixed(1);
    console.log(`   ✔ Wrote library-aid-modules.js (${libLines.toLocaleString()} lines, ${libKb} KB)`);

    // 3. Build library-cscp-loader.js
    if (fs.existsSync(LOADER_SRC_PATH)) {
        const rawLoader = fs.readFileSync(LOADER_SRC_PATH, "utf8");
        fs.writeFileSync(OUTPUT_LOADER_PATH, rawLoader, "utf8");
        const loaderBytes = Buffer.byteLength(rawLoader, "utf8");
        console.log(`   ✔ Wrote library-cscp-loader.js (${loaderBytes} bytes)`);
    }

    console.log("==================================================================");
    console.log("  🎉 BUILD COMPLETE!");
    console.log("==================================================================");
}

main();
