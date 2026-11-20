# CSCP v1.1 Implementation Handoff & Execution Blueprint

> [!IMPORTANT]
> **Standing Rules for All Models Executing This Plan:**
> 1. **DO NOT PUSH TO REMOTE (`git push` is forbidden).** Commit all work locally on `feat/cscp` branches.
> 2. **DO NOT PUBLISH SCENARIOS.** Never call `publishScenario` or `aiModerateScenario`. Keep all AI Dungeon scenarios in draft mode (`published: false`, `viewPublished: false`).
> 3. **Windows PowerShell Note:** Do not run complex inline `node -e "..."` one-liners in PowerShell (quote escaping breaks). Always write `.js` files to `C:\git\aid-connector\scratch\` and run `node C:\git\aid-connector\scratch\<script>.js`.
> 4. **AI Dungeon `<isolated-vm>` Constraint:** Never use `new Function(...)` (throws `TypeError: Function is not a constructor` in AI Dungeon). Always use indirect `(0, eval)(...)` as implemented in `src/cscp-loader.js`.

---

## Current State (Phase 1 Complete ✅)

- **Repository:** `C:\git\aid-modules` is on branch `feat/cscp` (commit `64a13fd`, all tests passing).
- **Completed Artifacts:**
  - `src/cscp-loader.js` / `library-cscp-loader.js`: 26-line Variation-Selector (`\uFE00`..`\uFE0F`) DLL loader using `(0, eval)`.
  - `src/cscp-client.js`: Full CSCP v1.0 client & codec with `"dedicated"` and `"shared"` carrier modes (plus aliases `dashboard`, `visible`, `piggyback`, `stealth`, `headless`) and `buildSelfDLLFrame()`.
  - `src/aid-modules.js` / `library-aid-modules.js`: 100% domain-agnostic CSCP Server & Registry.
- **Live Draft Testbed Scenario on AI Dungeon:**
  - Testbed Scenario ShortId: `peoOs7qN9aR-` (`published: false`)
  - Draft `AID-Modules` Script ShortId: `jHwEbn7_bYGC` (`published: false`)
  - Draft `CSCP Thin-Client Probe` Script ShortId: `DTgeHqKOl95k` (`published: false`)

---

## Phase 2: `aid-getopt` CSCP Thin-Client & Cross-Slot `/help` (`C:\git\aid-getopt`)

### Step 2.1: Create Branch
```powershell
git -C C:\git\aid-getopt checkout -b feat/cscp
```

### Step 2.2: Embed `loadCSCP()` and Announce `aid-getopt`
In `C:\git\aid-getopt\src\aid-getopt.js` and `C:\git\aid-getopt\examples\sandbox-script.js`:

1. Embed the `loadCSCP()` function from `C:\git\aid-modules\src\cscp-loader.js`:
   ```javascript
   function loadCSCP() {
       const root = typeof globalThis !== "undefined" ? globalThis : this;
       if (root.AID_CSCP) return root.AID_CSCP;
       const sc = (typeof storyCards !== "undefined" && Array.isArray(storyCards))
           ? storyCards
           : (Array.isArray(root.storyCards) ? root.storyCards : null);
       if (sc) {
           for (const c of sc) {
               const k = c && c.keys;
               const s = typeof k === "string" ? k.indexOf("\u200D\uFE00\u200D") : -1;
               if (s !== -1) {
                   const e = k.indexOf("\u200D\uFE0F\u200D", s + 3);
                   if (e !== -1 && ((e - (s + 3)) % 2 === 0)) {
                       let js = "";
                       for (let i = s + 3; i < e; i += 2) {
                           js += String.fromCharCode(((k.charCodeAt(i) & 15) << 4) | (k.charCodeAt(i + 1) & 15));
                       }
                       return (0, eval)(js + ";globalThis.AID_CSCP;");
                   }
               }
           }
       }
       return null;
   }
   ```
2. In `GetoptSandbox(inHook, inText, inStop)` (`examples/sandbox-script.js`):
   - On hook entry (`"input"`, `"context"`, `"output"`), call `const cscp = loadCSCP();` and if present, announce `aid-getopt`:
     ```javascript
     if (cscp && typeof cscp.announce === "function") {
         cscp.announce({
             name: "aid-getopt",
             version: VERSION,
             buildType: "modular",
             provides: ["aid-getopt"],
             prefix: "/aid-getopt",
             aliases: ["/aid-getopts"],
             description: "POSIX/GNU option parser & multi-script slash command router",
             helpSummary: "Router diagnostics and self-test suite (/aid-getopt --diag, /aid-getopt --test)"
         }, { phase: HOOK });
     }
     ```
3. In `/help` (`examples/sandbox-script.js`):
   - Merge modules from `globalThis.AID_MODULES` **and** `loadCSCP()?.read()?.modules` so `/help` discovers modules registered in other QuickJS VM slots!
4. **Domain-Agnosticism Cleanup in `examples/sandbox-script.js`:**
   - Remove hardcoded checks for `globalThis.AutoCards`, `globalThis.EntityCards`, `globalThis.InnerEntity`, and `globalThis.InnerSelf`. Instead, list modules dynamically from `Object.keys(mergedModules)`.
5. Run build and tests:
   ```powershell
   npm --prefix C:\git\aid-getopt test
   ```
6. Add a unit test verifying that `aid-getopt` in VM Slot 1 discovers a module announced via CSCP in VM Slot 2 when `/help` is dispatched, and commit locally on `feat/cscp`.

---

## Phase 3: `Entity-Cards` CSCP Integration (`C:\git\Entity-Cards`)

### Step 3.1: Create Branch
```powershell
git -C C:\git\Entity-Cards checkout -b feat/cscp
```

### Step 3.2: Integrate `loadCSCP()` with Standalone Fallback
In `C:\git\Entity-Cards\src\library.js`:
1. Call `loadCSCP()` to hydrate `globalThis.AID_CSCP` if `aid-modules` has exported the Variation-Selector DLL onto a story card.
2. When `globalThis.AID_CSCP` is available, call:
   ```javascript
   const cscpRes = globalThis.AID_CSCP.announce({
       name: "entity-cards",
       version: "2.8.0",
       buildType: isBundledInstance ? "all-in-one" : "standalone",
       provides: ["entity-cards"],
       prefix: "/ec",
       aliases: ["/ac"],
       description: "Autonomous story cards and named entity recognition for characters & lore",
       helpSummary: "Autonomous story cards and lore generation (/ec <title>, /ec redo, /ec info)"
   }, { phase: inHook || "context", createCard: false });
   ```
3. Keep the compact fallback stamp check for when `aid-modules` is **not** installed (so standalone `Entity-Cards` + `Inner-Entity` without `aid-modules` still coordinates in `"shared"` mode on their own config cards).
4. Ensure all 5 tests in `C:\git\Entity-Cards\test\test_double_engine.js` plus the existing test suite pass:
   ```powershell
   npm --prefix C:\git\Entity-Cards test
   node C:\git\Entity-Cards\test\test_double_engine.js
   ```
5. Commit locally on `feat/cscp`.

---

## Phase 4: `Inner-Entity` CSCP Integration (`C:\git\Inner-Entity`)

### Step 4.1: Create Branch
```powershell
git -C C:\git\Inner-Entity checkout -b feat/cscp
```

### Step 4.2: Integrate `loadCSCP()` and Multi-Capability Announcement
In `C:\git\Inner-Entity\src\core.js`:
1. Use `loadCSCP()` to link `globalThis.AID_CSCP` if exported by `aid-modules`.
2. Announce `inner-entity` with capabilities matching its build flavor:
   - If `hasAutoCards()` is `true` (`all-in-one` or `classic` build): `provides: ["inner-entity", "entity-cards"]`, `buildType: "all-in-one"`.
   - If `hasAutoCards()` is `false` (`minds-only` build): `provides: ["inner-entity"]`, `buildType: "minds-only"`.
3. If `cscpRes.yielded.includes("entity-cards")`, flag `_AID_DOUBLE_ENGINE_DETECTED = true` so `Inner-Entity` bypasses its bundled card engine while keeping its character minds (`"inner-entity"`) active.
4. Run build and all unit tests in `C:\git\Inner-Entity`:
   ```powershell
   node C:\git\Inner-Entity\scripts\build.js
   node C:\git\Inner-Entity\unittest\test_double_engine.js
   ```
5. Commit locally on `feat/cscp`.

---

## Phase 5: Protocol Documentation Update

1. Update `C:\git\Inner-Entity\docs\CROSS_SLOT_PROTOCOL.md` and `C:\git\aid-modules\SPECIFICATION.md` to document:
   - Canonical carrier card modes: **`"dedicated"`** (default, `"Configure \nSystem Modules"` dashboard card) and **`"shared"`** (piggyback on existing config card), plus aliases (`dashboard`, `visible`, `piggyback`, `stealth`, `headless`).
   - The **16-Variation-Selector (`\uFE00`..`\uFE0F`) StoryCard DLL** format (`DLL_START = "\u200D\uFE00\u200D"`, `DLL_END = "\u200D\uFE0F\u200D"`, 2 chars per byte, 4 bits per nibble).
   - The `<isolated-vm>` compatibility requirement: indirect `(0, eval)(...)` instead of `new Function(...)`.
