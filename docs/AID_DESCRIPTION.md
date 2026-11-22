---
title: "AID-Modules"
short_description: "Standard module registry, runtime discovery, and dependency management for AI Dungeon scripts (v1.1.0)"
tags: ["utility", "script", "library", "ams", "cscp", "modules"]
version: "1.1.0"
---

# AID-Modules 📦
### Standard Module Registry & Discovery Specification for AI Dungeon (AMS v1.1.0 / CSCP v1.1.0)
**Created and maintained by Randy Viosca ([@Random_Variable](https://play.aidungeon.com/profile/Random_Variable))**

AID-Modules provides a zero-dependency, open standard for modular AI Dungeon QuickJS scripting. It solves the friction of multi-creator adventures by providing transparent module registration, SemVer dependency checking, runtime discovery, the 3 Golden Rules of zero-collision scripting, and collision-proof in-game `/aid-modules` diagnostics.

---

### Key Capabilities
* **Module Registration:** Registers script metadata, version, and exported APIs via `AID.register()`.
* **SemVer Range Checking:** Validate dependencies cleanly with `AID.has(name, range)` and `AID.require(name)`.
* **Upgrade Precedence:** When duplicate versions are loaded across scenarios, newer versions automatically take precedence.
* **100% Backward Compatible:** Safely adopts and mirrors `globalThis.AID_MODULES`.
* **Cross-Slot Coordination Protocol (CSCP):** Powers multi-slot capability negotiation and shared state persistence across independent scenario slots.
* **In-Game Diagnostics:** Type `/aid-modules -v` at any time to inspect registered scripts and versions.

---

### In-Game Commands
* `/aid-modules -v`, `--version` — Displays all registered modules, SemVer versions, authors, and script flavors.
* `/aid-modules -h`, `--help` — Displays command help and usage instructions.

---

### Installation
Place **AID-Modules** in **Slot 1** (the very top) of your AI Dungeon Script Management run order so downstream scripts can discover it during initialization:
1. Open your scenario on [AI Dungeon](https://play.aidungeon.com/).
2. In **Details ➔ Scripting**, enable scripts and click **Edit Scripts**.
3. Paste `library-aid-modules.js` into the **Shared Library** tab.
4. Set **Input**, **Context**, and **Output** hooks to pass text through cleanly.

---

### Documentation & Source Code
* **GitHub Repository:** [github.com/viosca/aid-modules](https://github.com/viosca/aid-modules)
* **AMS v1.1.0 Specification:** [SPECIFICATION.md](https://github.com/viosca/aid-modules/blob/main/SPECIFICATION.md)
* **CSCP v1.1.0 Specification:** [CSCP_SPECIFICATION.md](https://github.com/viosca/aid-modules/blob/main/CSCP_SPECIFICATION.md)
