"use client";

import { useEffect, useState } from "react";

type Site = {
  id:          string;
  name:        string;
  niche:       string;
  platform:    string;
  active:      boolean;
  queuedCount: number;
};

const PLATFORM_COLOR: Record<string, string> = {
  etsy:          "bg-orange-100 text-orange-700",
  gumroad:       "bg-pink-100 text-pink-700",
  kdp:           "bg-yellow-100 text-yellow-700",
  envato:        "bg-green-100 text-green-700",
  product_hunt:  "bg-red-100 text-red-700",
  hacker_news:   "bg-orange-100 text-orange-800",
};

function platformClass(p: string) {
  return PLATFORM_COLOR[p] ?? "bg-gray-100 text-gray-600";
}

const CATEGORIES: Record<string, string[]> = {
  "Productivity Templates": ["notion_template","excel_template","google_sheets_template","airtable_template","powerpoint_template","google_slides_template","clickup_template","trello_template"],
  "Printables & Planners":  ["etsy_printable","wedding_printable","party_printable","holiday_printable","kids_activity_printable","homeschool_printable","coloring_page","sticker_sheet","planner_printable","budget_tracker","habit_tracker","meal_planner","fitness_planner","travel_planner","content_calendar","project_planner"],
  "Business Templates":     ["resume_template","business_plan_template","pitch_deck_template","invoice_template","contract_template","sop_template","business_card_template","email_template"],
  "Marketing & Design":     ["social_media_template","instagram_template","canva_template","youtube_thumbnail","tiktok_template","newsletter_template","brand_kit","logo_template","figma_kit","mockup_template"],
  "Creative Assets":        ["procreate_brush","photoshop_action","lightroom_preset","illustration_pack","icon_pack","font_bundle","color_palette","svg_cut_file","print_on_demand","sublimation_design","embroidery_design","clipart_pack","pattern_design"],
  "Video & Audio":          ["sample_pack","midi_pack","drum_kit","sound_effect_pack","music_loop_pack","video_template","video_lut","motion_graphic","youtube_banner","intro_template"],
  "Education & Info":       ["gumroad_ebook","mini_course","workbook","swipe_file","checklist_pack","study_guide","flashcard_pack","language_learning","kdp_low_content","journal_template","planner_book"],
  "AI & Tech":              ["ai_prompt_pack","chatgpt_prompt_pack","midjourney_prompt_pack","ai_workflow_template","wordpress_theme","shopify_app","browser_extension","discord_bot","micro_saas","game_asset","unity_asset","website_template"],
  "Data & Business Ops":    ["dataset","financial_model","crm_template","plr_pack","plr_articles","plr_social_posts"],
  "Lifestyle":              ["recipe_collection","wedding_planner_kit","event_planner_kit","kids_worksheet","educational_poster","goal_setting_workbook"],
};

function getCategoryForNiche(niche: string): string {
  for (const [cat, niches] of Object.entries(CATEGORIES)) {
    if (niches.includes(niche)) return cat;
  }
  return "Other";
}

export default function SitesPage() {
  const [sites,   setSites]   = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    fetch("/api/sites")
      .then((r) => r.json())
      .then((d) => { setSites(d); setLoading(false); });
  }, []);

  const filtered = sites.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.niche.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = new Map<string, Site[]>();
  for (const site of filtered) {
    const cat = getCategoryForNiche(site.niche);
    const arr = grouped.get(cat) ?? [];
    arr.push(site);
    grouped.set(cat, arr);
  }

  const totalQueued = sites.reduce((sum, s) => sum + s.queuedCount, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
        <p className="text-sm text-gray-500 mt-1">
          {sites.length} active sites across {Object.keys(CATEGORIES).length} categories — {totalQueued} opportunities queued
        </p>
      </div>

      <input
        type="text"
        placeholder="Search sites or niches..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md mb-6 px-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
      />

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([category, categorySites]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {category} ({categorySites.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categorySites.map((site) => (
                  <div key={site.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{site.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{site.niche.replace(/_/g, " ")}</p>
                      </div>
                      {site.queuedCount > 0 && (
                        <span className="shrink-0 text-xs font-semibold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                          {site.queuedCount}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className={"text-xs font-medium px-2 py-0.5 rounded " + platformClass(site.platform)}>
                        {site.platform}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}