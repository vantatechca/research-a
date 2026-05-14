import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter });

const SITES = [
  // Productivity Templates
  { niche: "notion_template",         name: "Notion Template Hub",           platform: "gumroad" },
  { niche: "excel_template",          name: "Excel Template Store",           platform: "etsy"    },
  { niche: "google_sheets_template",  name: "Google Sheets Templates",        platform: "etsy"    },
  { niche: "airtable_template",       name: "Airtable Template Vault",        platform: "gumroad" },
  { niche: "powerpoint_template",     name: "PowerPoint Template Shop",       platform: "etsy"    },
  { niche: "google_slides_template",  name: "Google Slides Templates",        platform: "etsy"    },
  { niche: "clickup_template",        name: "ClickUp Template Store",         platform: "gumroad" },
  { niche: "trello_template",         name: "Trello Template Hub",            platform: "gumroad" },
  // Printables
  { niche: "etsy_printable",          name: "Etsy Printables Hub",            platform: "etsy"    },
  { niche: "wedding_printable",       name: "Wedding Printables Store",       platform: "etsy"    },
  { niche: "party_printable",         name: "Party Printables Shop",          platform: "etsy"    },
  { niche: "holiday_printable",       name: "Holiday Printables",             platform: "etsy"    },
  { niche: "kids_activity_printable", name: "Kids Activity Printables",       platform: "etsy"    },
  { niche: "homeschool_printable",    name: "Homeschool Printables Hub",      platform: "etsy"    },
  { niche: "coloring_page",           name: "Coloring Pages Store",           platform: "etsy"    },
  { niche: "sticker_sheet",           name: "Sticker Sheet Shop",             platform: "etsy"    },
  // Planners & Trackers
  { niche: "planner_printable",       name: "Planner Printables",             platform: "etsy"    },
  { niche: "budget_tracker",          name: "Budget Tracker Templates",       platform: "etsy"    },
  { niche: "habit_tracker",           name: "Habit Tracker Hub",              platform: "etsy"    },
  { niche: "meal_planner",            name: "Meal Planner Templates",         platform: "etsy"    },
  { niche: "fitness_planner",         name: "Fitness Planner Store",          platform: "etsy"    },
  { niche: "travel_planner",          name: "Travel Planner Templates",       platform: "etsy"    },
  { niche: "content_calendar",        name: "Content Calendar Templates",     platform: "gumroad" },
  { niche: "project_planner",         name: "Project Planner Hub",            platform: "etsy"    },
  // Business Templates
  { niche: "resume_template",         name: "Resume Template Store",          platform: "etsy"    },
  { niche: "business_plan_template",  name: "Business Plan Templates",        platform: "gumroad" },
  { niche: "pitch_deck_template",     name: "Pitch Deck Templates",           platform: "gumroad" },
  { niche: "invoice_template",        name: "Invoice Template Hub",           platform: "etsy"    },
  { niche: "contract_template",       name: "Contract Template Store",        platform: "gumroad" },
  { niche: "sop_template",            name: "SOP Template Vault",             platform: "gumroad" },
  { niche: "business_card_template",  name: "Business Card Templates",        platform: "etsy"    },
  { niche: "email_template",          name: "Email Template Store",           platform: "gumroad" },
  // Marketing
  { niche: "social_media_template",   name: "Social Media Templates",         platform: "etsy"    },
  { niche: "instagram_template",      name: "Instagram Template Hub",         platform: "etsy"    },
  { niche: "canva_template",          name: "Canva Template Store",           platform: "etsy"    },
  { niche: "youtube_thumbnail",       name: "YouTube Thumbnail Templates",    platform: "etsy"    },
  { niche: "tiktok_template",         name: "TikTok Template Shop",           platform: "etsy"    },
  { niche: "newsletter_template",     name: "Newsletter Template Hub",        platform: "gumroad" },
  { niche: "brand_kit",               name: "Brand Kit Store",                platform: "etsy"    },
  { niche: "logo_template",           name: "Logo Template Hub",              platform: "etsy"    },
  // Design Assets
  { niche: "figma_kit",               name: "Figma UI Kit Store",             platform: "gumroad" },
  { niche: "procreate_brush",         name: "Procreate Brush Shop",           platform: "etsy"    },
  { niche: "photoshop_action",        name: "Photoshop Action Store",         platform: "etsy"    },
  { niche: "lightroom_preset",        name: "Lightroom Preset Hub",           platform: "etsy"    },
  { niche: "illustration_pack",       name: "Illustration Pack Store",        platform: "etsy"    },
  { niche: "icon_pack",               name: "Icon Pack Hub",                  platform: "gumroad" },
  { niche: "mockup_template",         name: "Mockup Template Store",          platform: "etsy"    },
  { niche: "font_bundle",             name: "Font Bundle Shop",               platform: "etsy"    },
  { niche: "color_palette",           name: "Color Palette Store",            platform: "etsy"    },
  { niche: "svg_cut_file",            name: "SVG Cut File Hub",               platform: "etsy"    },
  // Print on Demand
  { niche: "print_on_demand",         name: "Print on Demand Templates",      platform: "etsy"    },
  { niche: "sublimation_design",      name: "Sublimation Design Store",       platform: "etsy"    },
  { niche: "embroidery_design",       name: "Embroidery Design Hub",          platform: "etsy"    },
  { niche: "clipart_pack",            name: "Clipart Pack Store",             platform: "etsy"    },
  { niche: "pattern_design",          name: "Pattern Design Hub",             platform: "etsy"    },
  // Music & Audio
  { niche: "sample_pack",             name: "Sample Pack Store",              platform: "gumroad" },
  { niche: "midi_pack",               name: "MIDI Pack Hub",                  platform: "gumroad" },
  { niche: "drum_kit",                name: "Drum Kit Store",                 platform: "gumroad" },
  { niche: "sound_effect_pack",       name: "Sound Effect Pack Hub",          platform: "gumroad" },
  { niche: "music_loop_pack",         name: "Music Loop Pack Store",          platform: "gumroad" },
  // Video
  { niche: "video_template",          name: "Video Template Hub",             platform: "etsy"    },
  { niche: "video_lut",               name: "Video LUT Store",                platform: "etsy"    },
  { niche: "motion_graphic",          name: "Motion Graphic Hub",             platform: "gumroad" },
  { niche: "youtube_banner",          name: "YouTube Banner Templates",       platform: "etsy"    },
  { niche: "intro_template",          name: "Intro Template Store",           platform: "etsy"    },
  // Education & Info
  { niche: "gumroad_ebook",           name: "Ebook Store",                    platform: "gumroad" },
  { niche: "mini_course",             name: "Mini Course Hub",                platform: "gumroad" },
  { niche: "workbook",                name: "Workbook Store",                 platform: "etsy"    },
  { niche: "swipe_file",              name: "Swipe File Vault",               platform: "gumroad" },
  { niche: "checklist_pack",          name: "Checklist Pack Store",           platform: "etsy"    },
  { niche: "study_guide",             name: "Study Guide Hub",                platform: "etsy"    },
  { niche: "flashcard_pack",          name: "Flashcard Pack Store",           platform: "etsy"    },
  { niche: "language_learning",       name: "Language Learning Templates",    platform: "etsy"    },
  // Books & Publishing
  { niche: "kdp_low_content",         name: "KDP Low Content Books",          platform: "kdp"     },
  { niche: "journal_template",        name: "Journal Template Hub",           platform: "etsy"    },
  { niche: "planner_book",            name: "Planner Book Store",             platform: "kdp"     },
  // AI Tools
  { niche: "ai_prompt_pack",          name: "AI Prompt Pack Store",           platform: "gumroad" },
  { niche: "chatgpt_prompt_pack",     name: "ChatGPT Prompt Pack Hub",        platform: "gumroad" },
  { niche: "midjourney_prompt_pack",  name: "Midjourney Prompt Pack Store",   platform: "gumroad" },
  { niche: "ai_workflow_template",    name: "AI Workflow Template Hub",       platform: "gumroad" },
  // Tech & Dev
  { niche: "wordpress_theme",         name: "WordPress Theme Store",          platform: "gumroad" },
  { niche: "shopify_app",             name: "Shopify App Hub",                platform: "gumroad" },
  { niche: "browser_extension",       name: "Browser Extension Store",        platform: "gumroad" },
  { niche: "discord_bot",             name: "Discord Bot Hub",                platform: "gumroad" },
  { niche: "micro_saas",              name: "Micro SaaS Products",            platform: "gumroad" },
  { niche: "game_asset",              name: "Game Asset Store",               platform: "gumroad" },
  { niche: "unity_asset",             name: "Unity Asset Hub",                platform: "gumroad" },
  { niche: "website_template",        name: "Website Template Store",         platform: "gumroad" },
  // Data & Finance
  { niche: "dataset",                 name: "Dataset Store",                  platform: "gumroad" },
  { niche: "financial_model",         name: "Financial Model Templates",      platform: "etsy"    },
  { niche: "crm_template",            name: "CRM Template Hub",               platform: "gumroad" },
  // PLR Content
  { niche: "plr_pack",                name: "PLR Pack Store",                 platform: "gumroad" },
  { niche: "plr_articles",            name: "PLR Article Hub",                platform: "gumroad" },
  { niche: "plr_social_posts",        name: "PLR Social Post Store",          platform: "gumroad" },
  // Lifestyle
  { niche: "recipe_collection",       name: "Recipe Collection Store",        platform: "etsy"    },
  { niche: "wedding_planner_kit",     name: "Wedding Planner Kit Hub",        platform: "etsy"    },
  { niche: "event_planner_kit",       name: "Event Planner Kit Store",        platform: "etsy"    },
  { niche: "kids_worksheet",          name: "Kids Worksheet Hub",             platform: "etsy"    },
  { niche: "educational_poster",      name: "Educational Poster Store",       platform: "etsy"    },
  { niche: "goal_setting_workbook",   name: "Goal Setting Workbook Hub",      platform: "etsy"    },
];

async function seed() {
  console.log(`Seeding ${SITES.length} sites...`);

  for (const site of SITES) {
    await prisma.site.upsert({
      where:  { id: site.niche },
      update: { name: site.name, platform: site.platform },
      create: { id: site.niche, ...site, active: true },
    });
    console.log(`✓ ${site.name}`);
  }

  const total = await prisma.site.count();
  console.log(`\nTotal sites in DB: ${total}`);
  await prisma.$disconnect();
}

seed().catch((e) => { console.error(e); process.exit(1); });