import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

const KNOWN_PLATFORMS = new Set([
  "envato", "etsy", "gumroad", "product_hunt", "hacker_news",
  "reddit", "kaggle", "creative_market", "payhip", "lemonsqueezy",
  "shopify_app_store", "notion_marketplace", "whop", "sellfy",
  "teachers_pay_teachers", "redbubble", "design_bundles",
]);

// Infer platform from niche as fallback
const NICHE_PLATFORM: Record<string, string> = {
  etsy_printable:         "etsy",
  wedding_printable:      "etsy",
  party_printable:        "etsy",
  holiday_printable:      "etsy",
  kids_activity_printable:"etsy",
  homeschool_printable:   "etsy",
  coloring_page:          "etsy",
  sticker_sheet:          "etsy",
  planner_printable:      "etsy",
  svg_cut_file:           "etsy",
  embroidery_design:      "etsy",
  sublimation_design:     "etsy",
  resume_template:        "envato",
  social_media_template:  "envato",
  brand_kit:              "envato",
  mockup_template:        "envato",
  motion_graphic:         "envato",
  video_template:         "envato",
  powerpoint_template:    "envato",
  business_card_template: "envato",
  print_on_demand:        "envato",
  gumroad_ebook:          "gumroad",
  mini_course:            "gumroad",
  swipe_file:             "gumroad",
  ai_prompt_pack:         "gumroad",
  chatgpt_prompt_pack:    "gumroad",
  midjourney_prompt_pack: "gumroad",
  plr_pack:               "gumroad",
  kdp_low_content:        "kdp",
  journal_template:       "kdp",
  planner_book:           "kdp",
  micro_saas:             "product_hunt",
  discord_bot:            "product_hunt",
  browser_extension:      "product_hunt",
  shopify_app:            "product_hunt",
  notion_template:        "gumroad",
  figma_kit:              "gumroad",
  ai_workflow_template:   "product_hunt",
  dataset:               "gumroad",
  financial_model:       "etsy",
  crm_template:          "gumroad",
  plr_articles:          "gumroad",
  plr_social_posts:      "gumroad",
  canva_template:        "etsy",
  instagram_template:    "etsy",
  youtube_thumbnail:     "etsy",
  tiktok_template:       "etsy",
  newsletter_template:   "gumroad",
  logo_template:         "envato",
  procreate_brush:       "etsy",
  photoshop_action:      "envato",
  lightroom_preset:      "etsy",
  illustration_pack:     "envato",
  icon_pack:             "envato",
  font_bundle:           "envato",
  color_palette:         "etsy",
  clipart_pack:          "etsy",
  pattern_design:        "etsy",
  sample_pack:           "gumroad",
  midi_pack:             "gumroad",
  drum_kit:              "gumroad",
  sound_effect_pack:     "gumroad",
  music_loop_pack:       "gumroad",
  video_lut:             "envato",
  youtube_banner:        "etsy",
  intro_template:        "envato",
  workbook:              "gumroad",
  checklist_pack:        "etsy",
  study_guide:           "gumroad",
  flashcard_pack:        "etsy",
  language_learning:     "gumroad",
  airtable_template:     "gumroad",
  google_sheets_template:"etsy",
  excel_template:        "etsy",
  google_slides_template:"etsy",
  clickup_template:      "gumroad",
  trello_template:       "gumroad",
  budget_tracker:        "etsy",
  habit_tracker:         "etsy",
  meal_planner:          "etsy",
  fitness_planner:       "etsy",
  travel_planner:        "etsy",
  content_calendar:      "gumroad",
  project_planner:       "etsy",
  business_plan_template:"gumroad",
  pitch_deck_template:   "gumroad",
  invoice_template:      "etsy",
  contract_template:     "gumroad",
  sop_template:          "gumroad",
  email_template:        "gumroad",
  unity_asset:           "envato",
  game_asset:            "envato",
  website_template:      "envato",
  wordpress_theme:       "envato",
  recipe_collection:     "etsy",
  wedding_planner_kit:   "etsy",
  event_planner_kit:     "etsy",
  kids_worksheet:        "etsy",
  educational_poster:    "etsy",
  goal_setting_workbook: "etsy",
};

function extractPlatform(rationale?: string | null): string | null {
  if (!rationale) return null;
  const viaMatch = rationale.match(/via\s+([\w_]+)\./i);
  if (viaMatch && KNOWN_PLATFORMS.has(viaMatch[1].toLowerCase())) return viaMatch[1].toLowerCase();
  const onMatch  = rationale.match(/on\s+([\w_]+)\.\s*$/i);
  if (onMatch  && KNOWN_PLATFORMS.has(onMatch[1].toLowerCase()))  return onMatch[1].toLowerCase();
  return null;
}

async function backfill() {
  const opps = await prisma.digitalOpportunity.findMany({
    where: { OR: [{ platform: "unknown" }, { platform: "points" }, { platform: "attempts" }] },
  });

  console.log(`Backfilling ${opps.length} records...`);
  let fixed   = 0;
  let inferred = 0;

  for (const opp of opps) {
    const raw = opp.rawData as any;

    // Try rationale first
    let platform = extractPlatform(raw?.aiRationale);

    // Fall back to niche-based inference
    if (!platform) {
      platform = NICHE_PLATFORM[opp.niche] ?? null;
      if (platform) inferred++;
    } else {
      fixed++;
    }

    if (!platform) continue;

    await prisma.digitalOpportunity.update({
      where: { id: opp.id },
      data:  { platform },
    });
  }

  const remaining = await prisma.digitalOpportunity.count({ where: { platform: "unknown" } });
  console.log(`Fixed from rationale: ${fixed} | Inferred from niche: ${inferred} | Still unknown: ${remaining}`);
  await prisma.$disconnect();
}

backfill().catch(console.error);