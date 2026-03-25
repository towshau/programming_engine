/**
 * TeamBuilder → Supabase Exercise Sync Script
 *
 * Purpose: Scrape exercise list from TeamBuilder for a member's program,
 * compare against the CURRENT programming_generated row in Supabase,
 * and auto-update exercise order, selection, and discrepancies.
 *
 * The --date determines which program generation to target (the one whose
 * active window covers that date), so a newly-generated "next" program
 * is never accidentally modified.
 *
 * Usage:
 *   npx ts-node sync-exercises.ts --member="Advani, Rohan" --date="2026-03-23" --day=1
 *   npx ts-node sync-exercises.ts --member="Advani, Rohan" --date="2026-03-23" --day=2 --dry-run
 *
 * Prerequisites:
 *   npm install playwright @supabase/supabase-js dotenv chalk commander
 *   npx playwright install chromium
 */

import { chromium, type Page, type Browser } from "playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import chalk from "chalk";
import { Command } from "commander";
import path from "path";

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
    url: process.env.SUPABASE_URL || "https://dvrhazdtbsttzduaedzu.supabase.co",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
  browser: {
    headless: false,
    slowMo: 400,
    timeout: 30000,
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface TeamBuilderExercise {
  name: string;
  order: number;
  setsReps: string;
  isCircuit: boolean;
}

interface SupabaseExercise {
  exercise_name: string;
  exercise_id: string | null;
  tags: string;
  series_label: string;
  sets: Array<{ reps: string; set_number: number }>;
  order: number;
  row_id?: string;
}

interface SyncDiff {
  missingInSupabase: TeamBuilderExercise[];
  missingInTeamBuilder: SupabaseExercise[];
  orderMismatches: Array<{
    exercise: string;
    teamBuilderOrder: number;
    supabaseOrder: number;
  }>;
}

// ============================================================================
// TEAMBUILDER SCRAPER
// ============================================================================

class TeamBuilderScraper {
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

    console.log(chalk.blue("→ Navigating to TeamBuilder..."));
    await this.page.goto("https://app.teambuildr.com");

    // Dismiss cookie banner if present
    try {
      const acceptBtn = this.page.locator('button:has-text("Accept Cookies")');
      await acceptBtn.click({ timeout: 3000 });
      console.log(chalk.gray("  Dismissed cookie banner"));
      await this.page.waitForTimeout(500);
    } catch {
      // No cookie banner, continue
    }

    // Step 1: Enter email and click NEXT (two-step login)
    await this.page.waitForSelector(
      'input[placeholder*="Email" i], input[placeholder*="Username" i]',
      { timeout: 15000 }
    );

    console.log(chalk.blue("→ Entering email..."));
    await this.page.fill(
      'input[placeholder*="Email" i], input[placeholder*="Username" i]',
      CONFIG.teambuilder.email
    );
    await this.page.click('button:has-text("NEXT")');

    // Step 2: Enter password and click SIGN IN
    await this.page.waitForSelector('input[placeholder*="Password" i]', {
      timeout: 10000,
    });

    console.log(chalk.blue("→ Entering password..."));
    const pwdInput = this.page.locator('input[placeholder*="Password" i]');
    await pwdInput.click();
    await pwdInput.pressSequentially(CONFIG.teambuilder.password, { delay: 50 });

    // Wait for SIGN IN to become enabled then click
    const signInBtn = this.page.locator('button:has-text("SIGN IN")');
    await signInBtn.waitFor({ state: "visible", timeout: 5000 });
    await this.page.waitForTimeout(500);
    await signInBtn.click();

    // Wait for post-login redirect (may go to /dashboard or other page)
    await this.page.waitForFunction(
      () => !window.location.pathname.includes("/login"),
      { timeout: 20000 }
    );
    await this.page.waitForLoadState("domcontentloaded");

    // Navigate to the calendar page
    console.log(chalk.blue("→ Navigating to calendar..."));
    await this.page.goto("https://app.teambuildr.com/calendar", {
      waitUntil: "domcontentloaded",
    });
    await this.page.waitForTimeout(2000);

    console.log(chalk.green("✓ Logged in successfully"));
  }

  async navigateToMemberProgram(memberName: string, targetDate: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    console.log(chalk.blue(`→ Selecting calendar for: ${memberName}...`));

    // Step 1: Click "Select Calendar" dropdown in the header
    await this.page.click('text="Select Calendar"');
    await this.page.waitForTimeout(1000);

    // Step 2: Click "Athlete Calendars" tab in the modal
    await this.page.click('text="Athlete Calendars"');
    await this.page.waitForTimeout(500);

    // Step 3: Type in the search field
    await this.page.fill(
      'input[placeholder="Search for Athlete"]',
      memberName
    );
    await this.page.waitForTimeout(1000);

    // Step 4: Click the athlete name in the visible results list
    await this.page.locator(`a:has-text("${memberName}")`).first().click();
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForTimeout(2000);

    console.log(chalk.green(`✓ Loaded calendar for ${memberName}`));

    // Step 5: Navigate to the target date on the left-hand calendar
    await this.navigateToDate(targetDate);
  }

  async navigateToDate(targetDate: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");

    const [year, month, day] = targetDate.split("-").map(Number);

    console.log(chalk.blue(`→ Navigating to date: ${targetDate}...`));

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
        chalk.yellow(`⚠ Could not auto-click date ${dayStr}. You may need to click it manually.`)
      );
    }

    await this.page.waitForTimeout(2000);
    await this.page.waitForLoadState("domcontentloaded");

    console.log(chalk.green(`✓ Calendar at ${targetDate}`));
  }

  async scrapeExerciseList(targetDate: string): Promise<TeamBuilderExercise[]> {
    if (!this.page) throw new Error("Browser not initialized");

    console.log(chalk.blue("→ Scraping exercise list..."));

    const [, , targetDay] = targetDate.split("-").map(Number);

    const exercises = await this.page.evaluate((day: number) => {
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

        // Detect day header: day number followed by abbreviation
        if (line === String(day)) {
          const nextLine = lines[i + 1];
          if (nextLine && dayAbbrevs.includes(nextLine)) {
            inTargetDay = true;
            foundDayHeader = true;
            i++;
            continue;
          }
        }

        // Stop when we hit the next day block
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

        // Skip non-exercise lines
        const skipPatterns = [
          /^Day \d/,
          /^Untitled Workout$/,
          /^Add Exercise$/,
          /^Default View:/,
          /^Calendar Actions$/,
          /^Save|^Copy|^Clear|^Share|^Week View|^Sidebar|^Load|^Workouts$/,
          /^\d+$/, // bare numbers
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

        // Detect sets/reps lines (e.g. "3 x 6-8", "1 x 10 ea.", "60 Sec. Rest")
        const isSetsReps =
          /^\d+\s*x\s*\d+/i.test(line) || /sec\.?\s*rest/i.test(line);

        if (isSetsReps) {
          if (results.length > 0 && !results[results.length - 1].setsReps) {
            results[results.length - 1].setsReps = line;
          }
          continue;
        }

        // Remaining lines with reasonable length are exercise names
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

    console.log(chalk.green(`✓ Found ${exercises.length} exercises in TeamBuilder`));
    exercises.forEach((ex, i) => {
      const reps = ex.setsReps ? chalk.gray(` (${ex.setsReps})`) : "";
      console.log(chalk.gray(`  ${i + 1}. ${ex.name}${reps}`));
    });

    return exercises;
  }

  async scrapeExerciseListDOM(): Promise<TeamBuilderExercise[]> {
    if (!this.page) throw new Error("Browser not initialized");

    const exercises = await this.page.evaluate(() => {
      const results: Array<{
        name: string;
        order: number;
        setsReps: string;
        isCircuit: boolean;
      }> = [];

      const exerciseElements = document.querySelectorAll(
        '[class*="exercise-name"], ' +
          '[class*="exerciseName"], ' +
          '[class*="exercise_name"], ' +
          '[class*="workout-exercise"], ' +
          ".exercise-title, " +
          ".exercise-item .name"
      );

      exerciseElements.forEach((el, index) => {
        const name = el.textContent?.trim() || "";
        if (name) {
          const parent = el.parentElement;
          const setsEl = parent?.querySelector(
            '[class*="sets"], [class*="reps"], [class*="prescription"]'
          );
          results.push({
            name,
            order: index,
            setsReps: setsEl?.textContent?.trim() || "",
            isCircuit: false,
          });
        }
      });

      return results;
    });

    return exercises;
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
  }
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

class SupabaseSync {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey);
  }

  async getExercisesForMember(
    memberName: string,
    targetDate: string,
    dayNumber?: number
  ): Promise<{
    exercises: SupabaseExercise[];
    programId: string;
    sessionIndex: number;
    fullPayload: any;
    dayLabel: string;
  } | null> {
    console.log(chalk.blue(`→ Querying Supabase for ${memberName}...`));

    const nameParts = memberName.includes(",")
      ? memberName.split(",").map((s) => s.trim())
      : [memberName];

    let memberQuery = this.client
      .from("member_programs")
      .select("member_id, member_name");

    if (nameParts.length === 2) {
      const [last, first] = nameParts;
      memberQuery = memberQuery.or(
        `member_name.ilike.%${first}%${last}%,member_name.ilike.%${last}%${first}%`
      );
    } else {
      memberQuery = memberQuery.ilike("member_name", `%${memberName}%`);
    }

    const { data: memberPrograms, error: mpError } = await memberQuery.limit(1);

    if (mpError || !memberPrograms || memberPrograms.length === 0) {
      console.log(chalk.red(`✗ Member "${memberName}" not found in member_programs`));
      return null;
    }

    const memberProgram = memberPrograms[0];
    console.log(
      chalk.gray(
        `  Found: ${memberProgram.member_name} (${memberProgram.member_id})`
      )
    );

    // Fetch ALL programs for this member, oldest first
    const { data: programs, error: progError } = await this.client
      .from("programming_generated")
      .select("id, payload, created_at, scheme_name, sessions_per_week, duration_weeks")
      .eq("member_id", memberProgram.member_id)
      .order("created_at", { ascending: true });

    if (progError || !programs || programs.length === 0) {
      console.log(chalk.red(`✗ No generated program found for this member`));
      return null;
    }

    console.log(chalk.gray(`  Found ${programs.length} program generation(s)`));

    // Pick the program whose active window covers targetDate.
    // Active window = created_at  →  created_at + (duration_weeks * 7 days).
    // When multiple overlap, the EARLIEST wins (= current program, not the next).
    const dateMs = new Date(targetDate + "T00:00:00Z").getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;

    let program: (typeof programs)[0] | null = null;
    for (const p of programs) {
      const startMs = new Date(p.created_at).getTime();
      const endMs = startMs + (p.duration_weeks || 6) * 7 * DAY_MS;
      if (dateMs >= startMs && dateMs <= endMs) {
        program = p;
        break; // first (earliest) match
      }
    }

    if (!program) {
      // Fall back: pick the latest program if nothing covers the date
      program = programs[programs.length - 1];
      console.log(
        chalk.yellow(
          `⚠ No program's active window covers ${targetDate} — falling back to latest (created ${program.created_at})`
        )
      );
    }

    const activeEnd = new Date(
      new Date(program.created_at).getTime() +
        (program.duration_weeks || 6) * 7 * DAY_MS
    )
      .toISOString()
      .split("T")[0];

    console.log(
      chalk.gray(
        `  Selected: ${program.scheme_name} | ${program.sessions_per_week}x/week | created ${new Date(program.created_at).toISOString().split("T")[0]} → ends ~${activeEnd}`
      )
    );

    if (programs.length > 1) {
      const idx = programs.indexOf(program);
      console.log(
        chalk.gray(
          `  (generation ${idx + 1} of ${programs.length} — targeting current program, not the next)`
        )
      );
    }

    const sessions = program.payload.sessions as any[];

    let targetIndex = -1;
    if (dayNumber) {
      targetIndex = sessions.findIndex(
        (s: any) => Number(s.day) === dayNumber
      );
      if (targetIndex === -1) {
        console.log(chalk.yellow(`⚠ No session for day ${dayNumber}`));
        console.log(chalk.yellow(`  Available days:`));
        sessions.forEach((s: any) =>
          console.log(
            chalk.gray(
              `    Day ${s.day} — ${(s.exercises || []).length} exercises`
            )
          )
        );
        return null;
      }
    } else {
      targetIndex = 0;
      console.log(chalk.yellow(`⚠ No --day specified, defaulting to day ${sessions[0]?.day}`));
    }

    const session = sessions[targetIndex];
    const dayLabel = `Day ${session.day}`;
    const exercises: SupabaseExercise[] = (session.exercises || []).map(
      (ex: any, index: number) => ({
        exercise_name: ex.exercise_name,
        exercise_id: ex.exercise_id || null,
        tags: ex.tags || "",
        series_label: ex.series_label || "",
        sets: ex.sets || [],
        order: index,
        row_id: ex.row_id || crypto.randomUUID(),
      })
    );

    console.log(chalk.green(`✓ Found ${exercises.length} exercises in Supabase (${dayLabel})`));
    exercises.forEach((ex, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${ex.exercise_name} [${ex.series_label}]`));
    });

    return {
      exercises,
      programId: program.id,
      sessionIndex: targetIndex,
      fullPayload: program.payload,
      dayLabel,
    };
  }

  async updateExerciseOrder(
    programId: string,
    sessionIndex: number,
    fullPayload: any,
    newExerciseOrder: Array<{
      exercise_name: string;
      exercise_id: string | null;
      tags: string;
      series_label: string;
      sets: any[];
      row_id?: string;
    }>
  ): Promise<boolean> {
    console.log(chalk.blue("→ Updating programming_generated..."));

    const updatedPayload = JSON.parse(JSON.stringify(fullPayload));
    updatedPayload.sessions[sessionIndex] = {
      ...updatedPayload.sessions[sessionIndex],
      exercises: newExerciseOrder,
    };

    const { error } = await this.client
      .from("programming_generated")
      .update({
        payload: updatedPayload,
        updated_at: new Date().toISOString(),
        coach_edited: true,
      })
      .eq("id", programId);

    if (error) {
      console.log(chalk.red(`✗ Update failed: ${error.message}`));
      return false;
    }

    console.log(chalk.green("✓ programming_generated updated"));
    return true;
  }

  async getProgram(
    memberName: string,
    targetDate: string
  ): Promise<{
    programId: string;
    fullPayload: any;
    sessionsPerWeek: number;
    schemeName: string;
    createdAt: string;
    durationWeeks: number;
  } | null> {
    const nameParts = memberName.includes(",")
      ? memberName.split(",").map((s) => s.trim())
      : [memberName];

    let memberQuery = this.client
      .from("member_programs")
      .select("member_id, member_name");

    if (nameParts.length === 2) {
      const [last, first] = nameParts;
      memberQuery = memberQuery.or(
        `member_name.ilike.%${first}%${last}%,member_name.ilike.%${last}%${first}%`
      );
    } else {
      memberQuery = memberQuery.ilike("member_name", `%${memberName}%`);
    }

    const { data: memberPrograms, error: mpError } = await memberQuery.limit(1);
    if (mpError || !memberPrograms || memberPrograms.length === 0) return null;

    const memberId = memberPrograms[0].member_id;
    console.log(chalk.gray(`  Found: ${memberPrograms[0].member_name} (${memberId})`));

    const { data: programs, error: progError } = await this.client
      .from("programming_generated")
      .select("id, payload, created_at, scheme_name, sessions_per_week, duration_weeks")
      .eq("member_id", memberId)
      .order("created_at", { ascending: true });

    if (progError || !programs || programs.length === 0) return null;

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

    return {
      programId: program.id,
      fullPayload: program.payload,
      sessionsPerWeek: program.sessions_per_week,
      schemeName: program.scheme_name,
      createdAt: new Date(program.created_at).toISOString().split("T")[0],
      durationWeeks: program.duration_weeks || 6,
    };
  }

  async replaceAllSessions(
    programId: string,
    newSessions: any[],
    newSessionsPerWeek: number
  ): Promise<boolean> {
    console.log(chalk.blue(`→ Replacing all sessions in programming_generated (${newSessions.length} days)...`));

    const { data: existing, error: fetchErr } = await this.client
      .from("programming_generated")
      .select("payload")
      .eq("id", programId)
      .single();

    if (fetchErr || !existing) {
      console.log(chalk.red(`✗ Could not fetch program: ${fetchErr?.message}`));
      return false;
    }

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

    if (error) {
      console.log(chalk.red(`✗ Update failed: ${error.message}`));
      return false;
    }

    console.log(chalk.green(`✓ programming_generated updated — ${newSessions.length} sessions, ${newSessionsPerWeek}x/week`));
    return true;
  }
}

// ============================================================================
// DIFF + SYNC
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

function compareExercises(
  tbExercises: TeamBuilderExercise[],
  sbExercises: SupabaseExercise[]
): SyncDiff {
  const diff: SyncDiff = {
    missingInSupabase: [],
    missingInTeamBuilder: [],
    orderMismatches: [],
  };

  for (const tbEx of tbExercises) {
    if (!sbExercises.find((sb) => exerciseNamesMatch(tbEx.name, sb.exercise_name))) {
      diff.missingInSupabase.push(tbEx);
    }
  }

  for (const sbEx of sbExercises) {
    if (!tbExercises.find((tb) => exerciseNamesMatch(tb.name, sbEx.exercise_name))) {
      diff.missingInTeamBuilder.push(sbEx);
    }
  }

  for (const tbEx of tbExercises) {
    const match = sbExercises.find((sb) =>
      exerciseNamesMatch(tbEx.name, sb.exercise_name)
    );
    if (match && tbEx.order !== match.order) {
      diff.orderMismatches.push({
        exercise: tbEx.name,
        teamBuilderOrder: tbEx.order,
        supabaseOrder: match.order,
      });
    }
  }

  return diff;
}

function printDiff(diff: SyncDiff): void {
  console.log("\n" + chalk.bold("═══ SYNC DIFF REPORT ═══\n"));

  const hasChanges =
    diff.missingInSupabase.length +
    diff.missingInTeamBuilder.length +
    diff.orderMismatches.length;

  if (!hasChanges) {
    console.log(chalk.green("✓ Everything in sync.\n"));
    return;
  }

  if (diff.missingInSupabase.length > 0) {
    console.log(chalk.yellow("⚠ In TeamBuilder but NOT Supabase:"));
    diff.missingInSupabase.forEach((ex) =>
      console.log(chalk.yellow(`  + ${ex.name} (#${ex.order + 1})`))
    );
    console.log();
  }

  if (diff.missingInTeamBuilder.length > 0) {
    console.log(chalk.red("⚠ In Supabase but NOT TeamBuilder:"));
    diff.missingInTeamBuilder.forEach((ex) =>
      console.log(chalk.red(`  - ${ex.exercise_name} (#${ex.order + 1})`))
    );
    console.log();
  }

  if (diff.orderMismatches.length > 0) {
    console.log(chalk.cyan("↕ Order mismatches:"));
    diff.orderMismatches.forEach((m) =>
      console.log(
        chalk.cyan(`  ${m.exercise}: TB #${m.teamBuilderOrder + 1} → SB #${m.supabaseOrder + 1}`)
      )
    );
    console.log();
  }
}

function buildUpdatedExerciseList(
  tbExercises: TeamBuilderExercise[],
  sbExercises: SupabaseExercise[]
): Array<{
  exercise_name: string;
  exercise_id: string | null;
  tags: string;
  series_label: string;
  sets: any[];
  row_id?: string;
}> {
  const usedSeriesLabels = new Set<string>();

  return tbExercises.map((tbEx) => {
    const match = sbExercises.find((sb) =>
      exerciseNamesMatch(tbEx.name, sb.exercise_name)
    );

    if (match) {
      usedSeriesLabels.add(match.series_label);
      return {
        exercise_name: match.exercise_name,
        exercise_id: match.exercise_id,
        tags: match.tags,
        series_label: match.series_label,
        sets: match.sets,
        row_id: match.row_id || crypto.randomUUID(),
      };
    }

    const seriesLabel = tbEx.isCircuit ? "Circuit" : "";
    console.log(chalk.yellow(`  Adding new: ${tbEx.name}`));
    return {
      exercise_name: tbEx.name,
      exercise_id: null,
      tags: "",
      series_label: seriesLabel,
      sets: [{ reps: "0", set_number: 1 }],
      row_id: crypto.randomUUID(),
    };
  });
}

// ============================================================================
// HELPERS
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
// MAIN
// ============================================================================

async function main() {
  const program = new Command();
  program
    .requiredOption("--member <name>", 'Member name as "Last, First"')
    .option("--date <date>", "TeamBuilder calendar date YYYY-MM-DD (default: today)")
    .option("--day <number>", "Session day number in the generated program (1, 2, 3...)")
    .option("--sync-week", "Scrape full Mon-Fri week and replace all sessions", false)
    .option("--dry-run", "Diff only, no updates", false)
    .option("--dom-scraper", "Use DOM selectors instead of text parsing", false)
    .parse(process.argv);

  const opts = program.opts();
  const targetDate = opts.date || new Date().toISOString().split("T")[0];
  const dayNumber = opts.day ? parseInt(opts.day, 10) : undefined;

  if (!CONFIG.teambuilder.email || !CONFIG.teambuilder.password) {
    console.log(chalk.red("✗ Set TEAMBUILDER_EMAIL and TEAMBUILDER_PASSWORD in .env"));
    process.exit(1);
  }
  if (!CONFIG.supabase.serviceKey) {
    console.log(chalk.red("✗ Set SUPABASE_SERVICE_ROLE_KEY in .env"));
    process.exit(1);
  }

  if (opts.syncWeek) {
    await syncWeek(opts, targetDate);
  } else {
    await syncSingleDay(opts, targetDate, dayNumber);
  }
}

async function syncWeek(opts: any, targetDate: string): Promise<void> {
  const weekDates = getWeekDates(targetDate);
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  console.log(chalk.bold("\n🏋️ TeamBuilder → Supabase FULL WEEK Sync\n"));
  console.log(chalk.gray(`Member:  ${opts.member}`));
  console.log(chalk.gray(`Week:    ${weekDates[0]} → ${weekDates[4]}`));
  console.log(chalk.gray(`Target:  programming_generated (current program period)`));
  console.log(chalk.gray(`Mode:    ${opts.dryRun ? "DRY RUN" : "LIVE UPDATE"}\n`));

  const scraper = new TeamBuilderScraper();
  const supabase = new SupabaseSync();

  try {
    // Step 1: Login and navigate to member
    console.log(chalk.bold("── STEP 1: Login to TeamBuilder ──\n"));
    await scraper.init();
    await scraper.login();
    await scraper.navigateToMemberProgram(opts.member, weekDates[0]);

    // Step 2: Scrape each day Mon-Fri
    console.log(chalk.bold("\n── STEP 2: Scrape Mon–Fri ──\n"));
    const weekExercises: Array<{
      date: string;
      dayName: string;
      exercises: TeamBuilderExercise[];
    }> = [];

    for (let i = 0; i < weekDates.length; i++) {
      const date = weekDates[i];
      console.log(chalk.blue(`\n  ── ${dayNames[i]} (${date}) ──`));

      if (i > 0) {
        await scraper.navigateToDate(date);
      }

      const exercises = opts.domScraper
        ? await scraper.scrapeExerciseListDOM()
        : await scraper.scrapeExerciseList(date);

      if (exercises.length > 0) {
        weekExercises.push({ date, dayName: dayNames[i], exercises });
      } else {
        console.log(chalk.gray("  (rest day — no exercises)"));
      }
    }

    const activeDays = weekExercises.length;
    console.log(
      chalk.green(`\n✓ Found ${activeDays} training days this week`)
    );
    weekExercises.forEach((day, i) => {
      console.log(
        chalk.gray(
          `  Day ${i + 1} = ${day.dayName} (${day.date}) — ${day.exercises.length} exercises`
        )
      );
    });

    // Step 3: Get existing program from Supabase
    console.log(chalk.bold("\n── STEP 3: Query Supabase ──\n"));
    const prog = await supabase.getProgram(opts.member, targetDate);

    if (!prog) {
      console.log(chalk.red("✗ No program found in Supabase."));
      process.exit(1);
    }

    const existingSessions = prog.fullPayload.sessions as any[];
    console.log(
      chalk.gray(
        `  Existing: ${prog.schemeName} | ${prog.sessionsPerWeek}x/week | ${existingSessions.length} sessions | created ${prog.createdAt}`
      )
    );

    // Step 4: Build diff summary
    console.log(chalk.bold("\n── STEP 4: Diff (per day) ──\n"));

    const newSessions: any[] = [];
    let totalChanges = 0;

    for (let i = 0; i < weekExercises.length; i++) {
      const tbDay = weekExercises[i];
      const dayNum = i + 1;
      const existingSession = existingSessions.find(
        (s: any) => Number(s.day) === dayNum
      );

      console.log(chalk.bold(`  Day ${dayNum} (${tbDay.dayName}):`));

      if (existingSession) {
        const sbExercises: SupabaseExercise[] = (
          existingSession.exercises || []
        ).map((ex: any, idx: number) => ({
          exercise_name: ex.exercise_name,
          exercise_id: ex.exercise_id || null,
          tags: ex.tags || "",
          series_label: ex.series_label || "",
          sets: ex.sets || [],
          order: idx,
          row_id: ex.row_id || crypto.randomUUID(),
        }));

        const diff = compareExercises(tbDay.exercises, sbExercises);
        const changes =
          diff.missingInSupabase.length +
          diff.missingInTeamBuilder.length +
          diff.orderMismatches.length;

        if (changes === 0) {
          console.log(chalk.green("    ✓ In sync"));
        } else {
          totalChanges += changes;
          if (diff.missingInSupabase.length > 0) {
            diff.missingInSupabase.forEach((ex) =>
              console.log(chalk.yellow(`    + ${ex.name}`))
            );
          }
          if (diff.missingInTeamBuilder.length > 0) {
            diff.missingInTeamBuilder.forEach((ex) =>
              console.log(chalk.red(`    - ${ex.exercise_name}`))
            );
          }
          if (diff.orderMismatches.length > 0) {
            diff.orderMismatches.forEach((m) =>
              console.log(
                chalk.cyan(
                  `    ↕ ${m.exercise}: #${m.teamBuilderOrder + 1} → #${m.supabaseOrder + 1}`
                )
              )
            );
          }
        }

        const updatedExercises = buildUpdatedExerciseList(
          tbDay.exercises,
          sbExercises
        );
        newSessions.push({
          ...existingSession,
          day: dayNum,
          exercises: updatedExercises,
        });
      } else {
        // New day that didn't exist in the generated program
        totalChanges++;
        console.log(chalk.yellow(`    + NEW session (${tbDay.exercises.length} exercises)`));

        const newExercises = tbDay.exercises.map((tbEx) => ({
          exercise_name: tbEx.name,
          exercise_id: null,
          tags: "",
          series_label: "",
          sets: [{ reps: "0", set_number: 1 }],
          row_id: crypto.randomUUID(),
        }));

        newSessions.push({
          day: dayNum,
          exercises: newExercises,
        });
      }
    }

    if (activeDays !== prog.sessionsPerWeek) {
      totalChanges++;
      console.log(
        chalk.yellow(
          `\n  Sessions/week: ${prog.sessionsPerWeek} → ${activeDays}`
        )
      );
    }

    // Step 5: Apply or report
    if (totalChanges === 0) {
      console.log(chalk.green("\n✓ All days already in sync.\n"));
      return;
    }

    console.log(
      chalk.bold(`\n── STEP 5: ${opts.dryRun ? "Summary" : "Update"} ──\n`)
    );

    console.log(chalk.gray("Final program:"));
    newSessions.forEach((s) => {
      console.log(chalk.gray(`  Day ${s.day}: ${s.exercises.length} exercises`));
      s.exercises.forEach((ex: any, i: number) =>
        console.log(chalk.gray(`    ${i + 1}. ${ex.exercise_name}`))
      );
    });

    if (opts.dryRun) {
      console.log(chalk.yellow("\nDry run. No changes made.\n"));
    } else {
      const ok = await supabase.replaceAllSessions(
        prog.programId,
        newSessions,
        activeDays
      );
      if (ok) console.log(chalk.bold.green("\n✓ Full week sync complete.\n"));
    }
  } catch (error) {
    console.error(chalk.red(`\n✗ Error: ${error}`));
    throw error;
  } finally {
    await scraper.close();
  }
}

async function syncSingleDay(
  opts: any,
  targetDate: string,
  dayNumber?: number
): Promise<void> {
  console.log(chalk.bold("\n🏋️ TeamBuilder → Supabase Exercise Sync\n"));
  console.log(chalk.gray(`Member:  ${opts.member}`));
  console.log(chalk.gray(`Date:    ${targetDate} (TeamBuilder calendar)`));
  console.log(chalk.gray(`Day:     ${dayNumber ?? "auto (first session)"}`));
  console.log(chalk.gray(`Target:  programming_generated (current program period)`));
  console.log(chalk.gray(`Mode:    ${opts.dryRun ? "DRY RUN" : "LIVE UPDATE"}\n`));

  const scraper = new TeamBuilderScraper();
  const supabase = new SupabaseSync();

  try {
    console.log(chalk.bold("── STEP 1: Scrape TeamBuilder ──\n"));
    await scraper.init();
    await scraper.login();
    await scraper.navigateToMemberProgram(opts.member, targetDate);

    const tbExercises = opts.domScraper
      ? await scraper.scrapeExerciseListDOM()
      : await scraper.scrapeExerciseList(targetDate);

    if (tbExercises.length === 0) {
      console.log(chalk.red("✗ No exercises found. Try --dom-scraper or run the inspector."));
      process.exit(1);
    }

    console.log(chalk.bold("\n── STEP 2: Query Supabase (programming_generated) ──\n"));
    const sbData = await supabase.getExercisesForMember(
      opts.member,
      targetDate,
      dayNumber
    );

    if (!sbData) {
      console.log(chalk.red("✗ Member program not found in Supabase."));
      process.exit(1);
    }

    console.log(chalk.bold("\n── STEP 3: Compare ──\n"));
    const diff = compareExercises(tbExercises, sbData.exercises);
    printDiff(diff);

    const hasChanges =
      diff.missingInSupabase.length +
      diff.missingInTeamBuilder.length +
      diff.orderMismatches.length;

    if (!opts.dryRun && hasChanges) {
      console.log(chalk.bold("\n── STEP 4: Update programming_generated ──\n"));
      const updated = buildUpdatedExerciseList(tbExercises, sbData.exercises);

      console.log(chalk.gray("New exercise list:"));
      updated.forEach((ex, i) =>
        console.log(chalk.gray(`  ${i + 1}. ${ex.exercise_name} [${ex.series_label}]`))
      );

      const ok = await supabase.updateExerciseOrder(
        sbData.programId,
        sbData.sessionIndex,
        sbData.fullPayload,
        updated
      );

      if (ok) console.log(chalk.bold.green("\n✓ Sync complete.\n"));
    } else if (opts.dryRun) {
      console.log(chalk.yellow("\nDry run. No changes made.\n"));
    } else {
      console.log(chalk.green("\nAlready in sync.\n"));
    }
  } catch (error) {
    console.error(chalk.red(`\n✗ Error: ${error}`));
    throw error;
  } finally {
    await scraper.close();
  }
}

main();
