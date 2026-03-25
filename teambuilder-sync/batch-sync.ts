/**
 * Batch TeamBuilder → Supabase sync for all members.
 *
 * Single browser session: logs in once, iterates through every member in
 * member_programs that has a programming_generated row, scrapes Mon–Fri
 * from TeamBuilder, and overwrites programming_generated with TeamBuilder
 * exercises.
 *
 * Features:
 *   - Resume: progress saved to batch-progress.json; restart picks up
 *     where it left off.
 *   - --limit N: only process N members (for testing).
 *   - --dry-run: scrape + diff without writing to Supabase.
 *   - --reset: clear progress file and start from scratch.
 *   - Error tolerance: logs failures and continues to next member.
 *
 * Usage:
 *   npx ts-node batch-sync.ts                           # full run, live
 *   npx ts-node batch-sync.ts --dry-run --limit 3       # test 3 members
 *   npx ts-node batch-sync.ts --reset                   # restart from top
 */

import { chromium, type Page, type Browser } from "playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import chalk from "chalk";
import { Command } from "commander";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(__dirname, ".env") });

// ============================================================================
// CONFIG
// ============================================================================

const CONFIG = {
  teambuilder: {
    url: process.env.TEAMBUILDER_URL || "https://app.teambuildr.com/calendar",
    email: process.env.TEAMBUILDER_EMAIL || "",
    password: process.env.TEAMBUILDER_PASSWORD || "",
  },
  supabase: {
    url:
      process.env.SUPABASE_URL ||
      "https://dvrhazdtbsttzduaedzu.supabase.co",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  browser: {
    headless: false,
    slowMo: 300,
    timeout: 30000,
  },
};

const PROGRESS_FILE = path.resolve(__dirname, "batch-progress.json");

// ============================================================================
// TYPES
// ============================================================================

interface MemberRow {
  member_id: string;
  member_name: string;
}

interface BatchProgress {
  started_at: string;
  target_date: string;
  completed: string[]; // member_ids that finished successfully
  failed: Array<{ member_id: string; member_name: string; error: string }>;
  skipped: Array<{ member_id: string; member_name: string; reason: string }>;
}

interface ScrapedDay {
  date: string;
  dayName: string;
  exercises: Array<{
    name: string;
    order: number;
    setsReps: string;
    isCircuit: boolean;
  }>;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

function loadProgress(): BatchProgress | null {
  if (!fs.existsSync(PROGRESS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function saveProgress(progress: BatchProgress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function getWeekDates(anyDate: string): string[] {
  const d = new Date(anyDate + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(d.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
  return Array.from({ length: 5 }, (_, i) => {
    const date = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  });
}

// ============================================================================
// BROWSER AUTOMATION
// ============================================================================

class TeamBuilderBatch {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: CONFIG.browser.headless,
      slowMo: CONFIG.browser.slowMo,
    });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(CONFIG.browser.timeout);
  }

  async login(): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    await this.page.goto("https://app.teambuildr.com");

    try {
      const acceptBtn = this.page.locator(
        'button:has-text("Accept Cookies")'
      );
      await acceptBtn.click({ timeout: 3000 });
      await this.page.waitForTimeout(500);
    } catch {
      // no cookie banner
    }

    await this.page.waitForSelector(
      'input[placeholder*="Email" i], input[placeholder*="Username" i]',
      { timeout: 15000 }
    );
    await this.page.fill(
      'input[placeholder*="Email" i], input[placeholder*="Username" i]',
      CONFIG.teambuilder.email
    );
    await this.page.click('button:has-text("NEXT")');

    await this.page.waitForSelector('input[placeholder*="Password" i]', {
      timeout: 10000,
    });
    const pwdInput = this.page.locator('input[placeholder*="Password" i]');
    await pwdInput.click();
    await pwdInput.pressSequentially(CONFIG.teambuilder.password, {
      delay: 50,
    });

    const signInBtn = this.page.locator('button:has-text("SIGN IN")');
    await signInBtn.waitFor({ state: "visible", timeout: 5000 });
    await this.page.waitForTimeout(500);
    await signInBtn.click();

    await this.page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      { timeout: 20000 }
    );
    await this.page.waitForLoadState("domcontentloaded");

    await this.page.goto("https://app.teambuildr.com/calendar", {
      waitUntil: "domcontentloaded",
    });
    await this.page.waitForTimeout(2000);
  }

  async selectMember(memberName: string): Promise<boolean> {
    if (!this.page) throw new Error("Browser not initialized");

    // member_programs stores "First Last"; TeamBuilder uses "Last, First"
    const parts = memberName.trim().split(/\s+/);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
    const tbFormat = firstName ? `${lastName}, ${firstName}` : lastName;

    try {
      // Always navigate to /calendar first for a clean state
      await this.page.goto("https://app.teambuildr.com/calendar", {
        waitUntil: "domcontentloaded",
      });
      await this.page.waitForTimeout(1500);

      await this.page.click('text="Select Calendar"');
      await this.page.waitForTimeout(1000);

      await this.page.click('text="Athlete Calendars"');
      await this.page.waitForTimeout(500);

      // Search by last name -- use .first() to handle multiple search inputs
      const searchInput = this.page
        .locator('input[placeholder="Search for Athlete"]')
        .first();
      await searchInput.fill(lastName);
      await this.page.waitForTimeout(2000);

      // Try "Last, First" format first, then just last name
      const link = this.page.locator(`a:has-text("${tbFormat}")`).first();
      const fallback = this.page.locator(`a:has-text("${lastName}")`).first();

      const target = (await link.count()) > 0 ? link : fallback;
      if ((await target.count()) === 0) {
        // Try searching by full "First Last" as fallback
        await searchInput.fill(memberName);
        await this.page.waitForTimeout(2000);
        const lastTry = this.page
          .locator(`a:has-text("${lastName}")`)
          .first();
        if ((await lastTry.count()) === 0) {
          throw new Error("No matching athlete link found");
        }
        await lastTry.click({ timeout: 5000 });
      } else {
        await target.click({ timeout: 5000 });
      }

      await this.page.waitForLoadState("domcontentloaded");
      await this.page.waitForTimeout(2000);

      return true;
    } catch (err: any) {
      console.log(chalk.gray(`    search error: ${err.message?.slice(0, 100)}`));
      try {
        await this.page.keyboard.press("Escape");
        await this.page.waitForTimeout(500);
      } catch {}
      return false;
    }
  }

  async navigateToDate(targetDate: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    const [, , day] = targetDate.split("-").map(Number);
    const dayStr = String(day);

    const dateClicked = await this.page.evaluate((dayNum: string) => {
      const cells = document.querySelectorAll(
        "td, .day, [class*='calendar'] [class*='day']"
      );
      for (const cell of cells) {
        const text = cell.textContent?.trim();
        if (text === dayNum) {
          (cell as HTMLElement).click();
          return true;
        }
      }
      return false;
    }, dayStr);

    if (!dateClicked) {
      console.log(
        chalk.yellow(`    ⚠ Could not click date ${dayStr}`)
      );
    }

    await this.page.waitForTimeout(2000);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async scrapeDay(targetDate: string): Promise<ScrapedDay["exercises"]> {
    if (!this.page) throw new Error("Browser not initialized");

    const [, , targetDay] = targetDate.split("-").map(Number);

    return this.page.evaluate((day: number) => {
      const results: Array<{
        name: string;
        order: number;
        setsReps: string;
        isCircuit: boolean;
      }> = [];

      const allText = document.body.innerText;
      const lines = allText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      let inTargetDay = false;
      let foundDayHeader = false;
      let exerciseIndex = 0;
      const dayAbbrevs = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line === String(day)) {
          const nextLine = lines[i + 1];
          if (nextLine && dayAbbrevs.includes(nextLine)) {
            inTargetDay = true;
            foundDayHeader = true;
            i++;
            continue;
          }
        }

        if (foundDayHeader && inTargetDay) {
          const num = parseInt(line);
          if (
            !isNaN(num) &&
            num !== day &&
            num >= 1 &&
            num <= 31 &&
            lines[i + 1] &&
            dayAbbrevs.includes(lines[i + 1])
          ) {
            break;
          }
        }

        if (!inTargetDay) continue;

        const skipPatterns = [
          /^Day \d/,
          /^Untitled Workout$/,
          /^Add Exercise$/,
          /^Default View:/,
          /^Calendar Actions$/,
          /^Save|^Copy|^Clear|^Share|^Week View|^Sidebar|^Load|^Workouts$/,
          /^\d+$/,
          /^(Supportive|Primary|Warm[- ]?Up|Accessories|Cool[- ]?Down)\s*(Exercises?)?\s*$/i,
          /^(Accessory|Compound|Main|Primer)\s*(Exercises?)?\s*$/i,
          /^Physicals?\s*(Assessment|Test)\b/i,
          /^Health\s*Tracking$/i,
          /^Body\s*Weight$/i,
          /^Step\s*Count/i,
          /^\d+\s*rounds?$/i,
          /^Notes?$/i,
        ];
        if (dayAbbrevs.includes(line)) continue;
        if (skipPatterns.some((p) => p.test(line))) continue;

        const isSetsReps =
          /^\d+\s*x\s*\d+/i.test(line) || /sec\.?\s*rest/i.test(line);

        if (isSetsReps) {
          if (results.length > 0 && !results[results.length - 1].setsReps) {
            results[results.length - 1].setsReps = line;
          }
          continue;
        }

        if (line.length > 2 && line.length < 100) {
          results.push({
            name: line,
            order: exerciseIndex++,
            setsReps: "",
            isCircuit: false,
          });
        }
      }

      return results;
    }, targetDay);
  }

  async scrapeWeek(
    memberName: string,
    weekDates: string[]
  ): Promise<ScrapedDay[]> {
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const results: ScrapedDay[] = [];

    // Navigate to Monday first (selectMember already done)
    await this.navigateToDate(weekDates[0]);

    for (let i = 0; i < weekDates.length; i++) {
      if (i > 0) {
        await this.navigateToDate(weekDates[i]);
      }

      const exercises = await this.scrapeDay(weekDates[i]);

      if (exercises.length > 0) {
        results.push({
          date: weekDates[i],
          dayName: dayNames[i],
          exercises,
        });
      }
    }

    return results;
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
  }
}

// ============================================================================
// SUPABASE
// ============================================================================

class SupabaseBatch {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey);
  }

  async getMembersToSync(): Promise<MemberRow[]> {
    const { data, error } = await this.client
      .from("member_programs")
      .select("member_id, member_name")
      .order("member_name");

    if (error) throw new Error(`Failed to fetch members: ${error.message}`);

    // Deduplicate by member_id
    const seen = new Set<string>();
    return (data || []).filter((m) => {
      if (seen.has(m.member_id)) return false;
      seen.add(m.member_id);
      return true;
    });
  }

  async getProgram(
    memberId: string,
    targetDate: string
  ): Promise<{
    programId: string;
    payload: any;
    sessionsPerWeek: number;
    durationWeeks: number;
  } | "not_uploaded" | null> {
    const { data: programs, error } = await this.client
      .from("programming_generated")
      .select(
        "id, payload, created_at, sessions_per_week, duration_weeks, uploaded_to_teambuildr"
      )
      .eq("member_id", memberId)
      .order("created_at", { ascending: true });

    if (error || !programs || programs.length === 0) return null;

    const DAY_MS = 24 * 60 * 60 * 1000;
    const dateMs = new Date(targetDate + "T00:00:00Z").getTime();

    let program: (typeof programs)[0] | null = null;
    for (const p of programs) {
      const startMs = new Date(p.created_at).getTime();
      const endMs = startMs + (p.duration_weeks || 6) * 7 * DAY_MS;
      if (dateMs >= startMs && dateMs <= endMs) {
        program = p;
        break;
      }
    }
    if (!program) program = programs[programs.length - 1];

    // Only sync programs that admin has uploaded to TeamBuilder
    if (!program.uploaded_to_teambuildr) {
      return "not_uploaded";
    }

    return {
      programId: program.id,
      payload: program.payload,
      sessionsPerWeek: program.sessions_per_week,
      durationWeeks: program.duration_weeks || 6,
    };
  }

  async replaceAllSessions(
    programId: string,
    newSessions: any[],
    newSessionsPerWeek: number
  ): Promise<boolean> {
    const { data: existing, error: fetchErr } = await this.client
      .from("programming_generated")
      .select("payload")
      .eq("id", programId)
      .single();

    if (fetchErr || !existing) return false;

    const updatedPayload = { ...existing.payload, sessions: newSessions };

    const { error } = await this.client
      .from("programming_generated")
      .update({
        payload: updatedPayload,
        sessions_per_week: newSessionsPerWeek,
        updated_at: new Date().toISOString(),
        coach_edited: true,
      })
      .eq("id", programId);

    return !error;
  }

  async logSync(
    runId: string,
    memberId: string,
    memberName: string,
    status: "success" | "failed" | "skipped",
    daysSynced?: number,
    exercisesSynced?: number,
    error?: string
  ): Promise<void> {
    await this.client.from("programming_sync_log").insert({
      run_id: runId,
      member_id: memberId,
      member_name: memberName,
      status,
      days_synced: daysSynced ?? null,
      exercises_synced: exercisesSynced ?? null,
      error: error ?? null,
    });
  }
}

// ============================================================================
// EXERCISE MATCHING (reused from sync-exercises.ts)
// ============================================================================

function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-\u2013\u2014]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(ea\.?|each)\b/g, "")
    .trim();
}

function exerciseNamesMatch(tbName: string, sbName: string): boolean {
  const a = normalizeExerciseName(tbName);
  const b = normalizeExerciseName(sbName);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = a.split(" ").filter((w) => w.length > 2);
  const bWords = b.split(" ").filter((w) => w.length > 2);
  const overlap = aWords.filter((w) => bWords.includes(w));
  return overlap.length / Math.max(aWords.length, bWords.length) >= 0.8;
}

function buildSessionFromScrape(
  scrapedExercises: ScrapedDay["exercises"],
  existingSession: any | null,
  dayNum: number
): any {
  const exercises = scrapedExercises.map((tbEx) => {
    if (existingSession) {
      const match = (existingSession.exercises || []).find((sb: any) =>
        exerciseNamesMatch(tbEx.name, sb.exercise_name)
      );
      if (match) {
        return {
          exercise_name: match.exercise_name,
          exercise_id: match.exercise_id,
          tags: match.tags || "",
          series_label: match.series_label || "",
          sets: match.sets || [],
          row_id: match.row_id || crypto.randomUUID(),
        };
      }
    }

    return {
      exercise_name: tbEx.name,
      exercise_id: null,
      tags: "",
      series_label: "",
      sets: [{ reps: "0", set_number: 1 }],
      row_id: crypto.randomUUID(),
    };
  });

  return { day: dayNum, exercises };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const program = new Command();
  program
    .option("--date <date>", "Target week date YYYY-MM-DD (default: today)")
    .option("--limit <n>", "Only process N members")
    .option("--dry-run", "Scrape + diff only, no writes", false)
    .option("--reset", "Clear progress and start fresh", false)
    .parse(process.argv);

  const opts = program.opts();
  const targetDate = opts.date || new Date().toISOString().split("T")[0];
  const weekDates = getWeekDates(targetDate);
  const limit = opts.limit ? parseInt(opts.limit, 10) : undefined;

  console.log(chalk.bold("\n🏋️ TeamBuilder → Supabase BATCH Sync\n"));
  console.log(chalk.gray(`Week:    ${weekDates[0]} → ${weekDates[4]}`));
  console.log(chalk.gray(`Mode:    ${opts.dryRun ? "DRY RUN" : "LIVE UPDATE"}`));
  console.log(chalk.gray(`Limit:   ${limit ?? "all members"}\n`));

  if (!CONFIG.teambuilder.email || !CONFIG.teambuilder.password) {
    console.log(chalk.red("✗ Set TEAMBUILDER_EMAIL and TEAMBUILDER_PASSWORD in .env"));
    process.exit(1);
  }
  if (!CONFIG.supabase.serviceKey) {
    console.log(chalk.red("✗ Set SUPABASE_SERVICE_ROLE_KEY in .env"));
    process.exit(1);
  }

  // Load or create progress
  if (opts.reset && fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
    console.log(chalk.yellow("Progress file cleared.\n"));
  }

  let progress = loadProgress();
  if (progress && progress.target_date !== weekDates[0]) {
    console.log(
      chalk.yellow(
        `Progress file is for week ${progress.target_date}, but target is ${weekDates[0]}. Starting fresh.\n`
      )
    );
    progress = null;
  }

  if (!progress) {
    progress = {
      started_at: new Date().toISOString(),
      target_date: weekDates[0],
      completed: [],
      failed: [],
      skipped: [],
    };
  }

  const alreadyDone = new Set(progress.completed);

  // Fetch member list
  const supabase = new SupabaseBatch();
  console.log(chalk.blue("→ Fetching member list..."));
  const allMembers = await supabase.getMembersToSync();
  console.log(chalk.green(`✓ ${allMembers.length} members in member_programs`));

  // Filter out already-completed
  let members = allMembers.filter((m) => !alreadyDone.has(m.member_id));
  if (alreadyDone.size > 0) {
    console.log(
      chalk.gray(`  Resuming: ${alreadyDone.size} already done, ${members.length} remaining`)
    );
  }

  if (limit) {
    members = members.slice(0, limit);
    console.log(chalk.gray(`  Limited to ${members.length} members`));
  }

  console.log();

  // Launch browser
  const scraper = new TeamBuilderBatch();
  console.log(chalk.blue("→ Launching browser and logging in..."));
  await scraper.init();
  await scraper.login();
  console.log(chalk.green("✓ Logged in\n"));

  // Generate a run_id for this batch (used in programming_sync_log)
  const crypto = await import("crypto");
  const runId = crypto.randomUUID();

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  console.log(chalk.gray(`Run ID:  ${runId}\n`));

  for (let idx = 0; idx < members.length; idx++) {
    const member = members[idx];
    const memberNum = alreadyDone.size + idx + 1;
    const totalTarget = alreadyDone.size + members.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const avgPerMember =
      idx > 0 ? (Date.now() - startTime) / idx / 1000 : 45;
    const remaining = ((members.length - idx) * avgPerMember / 60).toFixed(1);

    console.log(
      chalk.bold(
        `── [${memberNum}/${totalTarget}] ${member.member_name} ── (${elapsed}s elapsed, ~${remaining}m remaining)`
      )
    );

    try {
      // Check if member has a generated program that's been uploaded
      const prog = await supabase.getProgram(member.member_id, targetDate);

      if (!prog) {
        console.log(chalk.gray("  Skipped: no programming_generated row"));
        progress.skipped.push({
          member_id: member.member_id,
          member_name: member.member_name,
          reason: "no_generated_program",
        });
        if (!opts.dryRun) {
          await supabase.logSync(runId, member.member_id, member.member_name, "skipped", undefined, undefined, "no_generated_program");
        }
        skipCount++;
        saveProgress(progress);
        continue;
      }

      if (prog === "not_uploaded") {
        console.log(chalk.gray("  Skipped: not yet uploaded to TeamBuilder by admin"));
        progress.skipped.push({
          member_id: member.member_id,
          member_name: member.member_name,
          reason: "not_uploaded_to_teambuildr",
        });
        if (!opts.dryRun) {
          await supabase.logSync(runId, member.member_id, member.member_name, "skipped", undefined, undefined, "not_uploaded_to_teambuildr");
        }
        skipCount++;
        saveProgress(progress);
        continue;
      }

      // Navigate to member in TeamBuilder
      const found = await scraper.selectMember(member.member_name);
      if (!found) {
        console.log(chalk.yellow("  ⚠ Not found in TeamBuilder search"));
        progress.failed.push({
          member_id: member.member_id,
          member_name: member.member_name,
          error: "not_found_in_teambuilder",
        });
        if (!opts.dryRun) {
          await supabase.logSync(runId, member.member_id, member.member_name, "failed", undefined, undefined, "not_found_in_teambuilder");
        }
        failCount++;
        saveProgress(progress);
        continue;
      }

      // Scrape Mon–Fri
      const scrapedDays = await scraper.scrapeWeek(
        member.member_name,
        weekDates
      );

      if (scrapedDays.length === 0) {
        console.log(chalk.gray("  Skipped: no exercises found any day"));
        progress.skipped.push({
          member_id: member.member_id,
          member_name: member.member_name,
          reason: "no_exercises_in_teambuilder",
        });
        if (!opts.dryRun) {
          await supabase.logSync(runId, member.member_id, member.member_name, "skipped", undefined, undefined, "no_exercises_in_teambuilder");
        }
        skipCount++;
        saveProgress(progress);
        continue;
      }

      console.log(
        chalk.gray(
          `  Scraped: ${scrapedDays.length} days (${scrapedDays.map((d) => d.dayName.slice(0, 3)).join(", ")})`
        )
      );

      // Build new sessions
      const existingSessions = prog.payload.sessions as any[];
      const newSessions = scrapedDays.map((day, i) => {
        const dayNum = i + 1;
        const existing = existingSessions.find(
          (s: any) => Number(s.day) === dayNum
        );
        return buildSessionFromScrape(day.exercises, existing, dayNum);
      });

      const totalExercises = newSessions.reduce(
        (sum: number, s: any) => sum + s.exercises.length,
        0
      );

      if (!opts.dryRun) {
        const ok = await supabase.replaceAllSessions(
          prog.programId,
          newSessions,
          scrapedDays.length
        );

        if (ok) {
          console.log(
            chalk.green(
              `  ✓ Updated: ${scrapedDays.length} days, ${totalExercises} exercises`
            )
          );
          await supabase.logSync(runId, member.member_id, member.member_name, "success", scrapedDays.length, totalExercises);
          successCount++;
        } else {
          console.log(chalk.red("  ✗ Supabase write failed"));
          progress.failed.push({
            member_id: member.member_id,
            member_name: member.member_name,
            error: "supabase_write_failed",
          });
          await supabase.logSync(runId, member.member_id, member.member_name, "failed", undefined, undefined, "supabase_write_failed");
          failCount++;
          saveProgress(progress);
          continue;
        }
      } else {
        console.log(
          chalk.yellow(
            `  [DRY] Would update: ${scrapedDays.length} days, ${totalExercises} exercises`
          )
        );
        successCount++;
      }

      progress.completed.push(member.member_id);
      saveProgress(progress);
    } catch (err: any) {
      console.log(chalk.red(`  ✗ Error: ${err.message || err}`));
      progress.failed.push({
        member_id: member.member_id,
        member_name: member.member_name,
        error: String(err.message || err).slice(0, 200),
      });
      if (!opts.dryRun) {
        await supabase.logSync(runId, member.member_id, member.member_name, "failed", undefined, undefined, String(err.message || err).slice(0, 200));
      }
      failCount++;
      saveProgress(progress);
    }
  }

  await scraper.close();

  // Final summary
  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log(chalk.bold("\n═══ BATCH SYNC COMPLETE ═══\n"));
  console.log(chalk.gray(`  Run ID:   ${runId}`));
  console.log(chalk.green(`  ✓ Success:  ${successCount}`));
  console.log(chalk.red(`  ✗ Failed:   ${failCount}`));
  console.log(chalk.gray(`  ○ Skipped:  ${skipCount}`));
  console.log(chalk.gray(`  ⏱ Time:     ${totalElapsed} minutes`));
  console.log(
    chalk.gray(
      `  📄 Progress: ${PROGRESS_FILE}`
    )
  );

  if (progress.failed.length > 0) {
    console.log(chalk.yellow("\nFailed members:"));
    progress.failed.forEach((f) =>
      console.log(chalk.yellow(`  - ${f.member_name}: ${f.error}`))
    );
  }

  console.log();
}

main();
