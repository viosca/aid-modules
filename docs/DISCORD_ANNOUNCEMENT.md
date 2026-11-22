# Discord Announcement & Thread Update Kit: AID-Modules

> **Note on Discord Markdown:** Discord uses a simplified Markdown engine. It does not support tables, HTML tags, or complex styling. The copy below uses Discord-safe formatting (headers, bold, bullet points `•`, backticks, code blocks, and blockquotes). Every post is verified to be under Discord's 2,000-character limit.

---

## Part 1: Thread Reply (Post This as a New Reply in Your Existing Thread)

*Character count: ~1,400 characters (Discord limit: 2,000)*

```markdown
📦 **AID-Modules v1.1.0 Update: Cross-Slot Coordination Protocol (CSCP) & Enhanced Diagnostics**

A major update is now live for **AID-Modules** (AMS v1.1.0)!

This release introduces the **Cross-Slot Coordination Protocol (CSCP v1.1.0)**, an open standard designed to eliminate double-engine collisions and coordinate multi-slot script architectures on AI Dungeon.

### 🌟 What's New in v1.1.0:
• **Cross-Slot Coordination (CSCP):** Coordinates scenario slots to negotiate capabilities dynamically. When paired with scripts like Inner-Entity and Entity-Cards, duplicates automatically yield to upstream instances.
• **Master /help Aggregation:** Automatically gathers slash commands and manuals from all registered modules in the scene into a unified in-game help directory.
• **SemVer Dependency Checking:** Check module requirements cleanly with `AID.has(name, range)` and `AID.require(name)`.
• **Upgrade Precedence:** If multiple versions of a module are loaded across scenario slots, the newer version automatically takes precedence.
• **Zero Dependencies:** Single lightweight file intended for Slot 1 of your script run order.

### 🎮 In-Game Commands:
• `/aid-modules -v`, `--version` — Lists all registered modules, SemVer versions, authors, and active flavors.
• `/aid-modules -h`, `--help` — Displays command help.

🔗 **GitHub & Specification:**
https://github.com/viosca/aid-modules
```

---

## Part 2: Improved Original Post (OP) for the Thread

*Character count: ~1,860 characters (Discord limit: 2,000)*

```markdown
📦 **[RELEASE] AID-Modules v1.1.0 — Open Module Registry & Discovery for AI Dungeon (AMS v1.1.0 / CSCP v1.1.0)**

Tired of multi-script adventures crashing with cryptic `ReferenceError`s or scripts colliding over player inputs? **AID-Modules** establishes an open standard for modular, zero-collision AI Dungeon QuickJS scripting!

Place it in **Slot 1** (the top) of your Script Management run order to unlock transparent discovery, dependency validation, and cross-slot coordination across all scripts in your adventure.

🌟 **Key Capabilities:**
• **Zero Dependencies:** Ultra-lightweight and runs everywhere in the QuickJS sandbox with zero configuration.
• **Cross-Slot Coordination (CSCP):** Coordinates multi-slot scenario architectures so complex scripts (like Entity-Cards and Inner-Entity) can negotiate capabilities and yield duplicates dynamically.
• **Master /help Aggregation:** Automatically gathers slash commands and manuals from all active modules into a single, unified in-game `/help` directory.
• **SemVer Dependency Checking:** Validate module requirements cleanly at runtime (`AID.has('getopt', '^1.0.0')`, `AID.require('my-lib')`).
• **Upgrade Precedence:** If duplicate versions of a module are loaded across scenario slots, the newer version automatically takes precedence.
• **In-Game Diagnostics:** Type `/aid-modules -v` at any time to inspect registered scripts, versions, authors, and active flavors.

🔗 **Add to your Scenario (Script Loader):**
https://play.aidungeon.com/script/jHwEbn7_bYGC/aid-modules?source=profile&tss_user=Random_Variable&tss_ct=scenario

📖 **GitHub & Specifications:**
• **Repository:** https://github.com/viosca/aid-modules
• **AMS v1.1.0 Spec:** https://github.com/viosca/aid-modules/blob/main/SPECIFICATION.md
• **CSCP v1.1.0 Spec:** https://github.com/viosca/aid-modules/blob/main/CSCP_SPECIFICATION.md
```

---

## Part 3: Unified Ecosystem Announcement (Overarching Post)

*Character count: ~1,930 characters (Discord limit: 2,000)*

```markdown
🚀 **Major AI Dungeon Script Release: The Modular Scripting Ecosystem is Live!** 📦🎭📇

A massive unified release is now live across **Entity Cards**, **Inner Entity**, **AID-Getopt**, and **AID-Modules**!

Powered by the **Cross-Slot Coordination Protocol (CSCP)**, these scripts now communicate across AI Dungeon's script execution pipeline—enabling zero-collision, multi-slot adventures with dynamic capability negotiation.

### 🌟 What’s New?

📇 **Entity Cards (v2.8.0-EC)**
• **Abort Controls:** Cancel active generations cleanly with `/ec -a`, `/ec --abort`, or `/ec cancel`.
• **Smarter Continuation:** Prompt preservation and toast notices (`cleanPromptOnCardGen`, `progressDisplay`).
• **Rejection Diagnostics:** Clear feedback for duplicate names, short titles, and empty inputs.
• **100-Token Slider Calibrated:** Dense 5-type YAML schemas with 4-letter **MBTI** profiles.

🎭 **Inner Entity (v2.8.0-IE)**
• **Autonomous NPC Cognition:** NPCs reflect in real time with private goals, secrets, and `🎭` thought badges.
• **Cross-VM Thought Suppression:** Inhibits NPC thoughts while Entity-Cards generates cards, preventing corrupted lore!
• **Dynamic Capability Yielding:** Mix All-in-One and Standalone scripts with zero double-engine collisions.

🎯 **AID-Getopt Router (v1.0.1)**
• **Waterfall Router:** Non-interfering command passthrough across multi-script setups.
• **Mobile Smart Punctuation:** Normalizes iOS/Android em-dashes (`—`) and curly quotes (`“ ”`).
• **Dialogue Quoting:** Type commands naturally in Say mode (`> You say, "/ec -p Molly."`).

📦 **AID-Modules (v1.1.0)**
• Open standard for module registration, SemVer discovery, and unified `/help` aggregation.

🔗 **Documentation & Code:**
• **Entity Cards:** https://github.com/viosca/Entity-Cards
• **Inner Entity:** https://github.com/viosca/Inner-Entity
• **Creator Guide:** Check `DYNAMIC_SLOT_MANAGEMENT_GUIDE.md` in the repos!
```
