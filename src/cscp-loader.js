/**
 * ============================================================================
 * AID-CSCP Loader: Dynamic StoryCard DLL Bootstrapper for AI Dungeon
 * ============================================================================
 *
 * Tiny (~450 byte) bootstrap loader for downstream script slots in AI Dungeon.
 * Scans storyCards for the Variation-Selector (\uFE00..\uFE0F) encoded CSCP
 * client DLL exported by AID-Modules (Slot 1), decodes it in O(N) bitwise
 * operations, and hydrates globalThis.AID_CSCP inside the current QuickJS VM.
 *
 * @version 1.1.0
 * @author Randy Viosca (@Random_Variable on AI Dungeon)
 * @license MIT
 */
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
                    return new Function("globalThis", js + ";return globalThis.AID_CSCP;")(root);
                }
            }
        }
    }
    return null;
}

if (typeof module === "object" && module.exports) {
    module.exports = { loadCSCP };
} else if (typeof globalThis !== "undefined") {
    globalThis.loadCSCP = loadCSCP;
}
