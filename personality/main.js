#!/usr/bin/env node
/**
 * Mattermost Personality Analyzer
 *
 * Usage:
 *   node main.js                   # phân tích tất cả user
 *   node main.js --user username   # phân tích 1 user
 *   node main.js --dry-run         # chỉ scrape, không gọi LLM
 *   node main.js --load-cache      # dùng data đã scrape (output/scrape_cache.json)
 */
import fs from "fs";
import path from "path";
import { MattermostScraper } from "./scraper/mattermost_scraper.js";
import { analyzeUser } from "./analyzer/personality_analyzer.js";
import { toPromptBlock } from "./models/user_profile.js";
import { OUTPUT_DIR, MIN_MESSAGES_THRESHOLD } from "./config.js";

const CACHE_FILE = "./output/scrape_cache.json";

async function main() {
    const args = parseArgs();

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync("./output", { recursive: true });

    // ── 1. Scrape hoặc load cache ──────────────────────────────────────────
    let scraped;
    if (args.loadCache && fs.existsSync(CACHE_FILE)) {
        console.log(`Loading cached data from ${CACHE_FILE}...`);
        scraped = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } else {
        console.log("Scraping Mattermost messages...");
        const scraper = new MattermostScraper();
        scraped = await scraper.scrapeAll();
        fs.writeFileSync(CACHE_FILE, JSON.stringify(scraped, null, 2), "utf-8");
        console.log(`Cached to ${CACHE_FILE}`);
    }

    const { users, messagesByUser } = scraped;

    // ── 2. Filter users ────────────────────────────────────────────────────
    const targetUsers = Object.entries(users).filter(([uid, u]) => {
        const msgs = messagesByUser[uid] ?? [];
        if (msgs.length < MIN_MESSAGES_THRESHOLD) return false;
        if (args.user && u.username !== args.user) return false;
        return true;
    });

    console.log(`\nFound ${targetUsers.length} users to analyze (min ${MIN_MESSAGES_THRESHOLD} messages)\n`);

    if (args.dryRun) {
        console.log("Dry run — skipping LLM analysis");
        for (const [uid, u] of targetUsers) {
            const count = (messagesByUser[uid] ?? []).length;
            console.log(`  @${u.username} (${u.displayName}): ${count} messages`);
        }
        return;
    }

    // ── 3. Analyze each user ───────────────────────────────────────────────
    const results = [];

    for (let i = 0; i < targetUsers.length; i++) {
        const [uid, userInfo] = targetUsers[i];
        const msgs = messagesByUser[uid] ?? [];
        console.log(`[${i + 1}/${targetUsers.length}] Analyzing @${userInfo.username} (${msgs.length} messages)...`);

        try {
            const profile = await analyzeUser(userInfo, msgs);

            const jsonPath = path.join(OUTPUT_DIR, `${userInfo.username}.json`);
            const txtPath = path.join(OUTPUT_DIR, `${userInfo.username}.txt`);

            fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), "utf-8");
            fs.writeFileSync(txtPath, toPromptBlock(profile), "utf-8");

            results.push({ username: userInfo.username, status: "ok", path: jsonPath });
            console.log(`  ✓ Saved to ${jsonPath}`);
        } catch (err) {
            console.error(`  ✗ Error: ${err.message}`);
            results.push({ username: userInfo.username, status: "error", error: err.message });
        }
    }

    // ── 4. Summary index ───────────────────────────────────────────────────
    const indexPath = path.join(OUTPUT_DIR, "_index.json");
    const index = {
        generatedAt: new Date().toISOString(),
        totalUsers: results.length,
        users: results,
    };
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");

    const ok = results.filter(r => r.status === "ok").length;
    console.log(`\nDone: ${ok}/${results.length} users analyzed. Index: ${indexPath}`);
}

function parseArgs() {
    const argv = process.argv.slice(2);
    return {
        user: getArg(argv, "--user"),
        dryRun: argv.includes("--dry-run"),
        loadCache: argv.includes("--load-cache"),
    };
}

function getArg(argv, flag) {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : null;
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
