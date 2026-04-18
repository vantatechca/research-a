import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SEED_IDEAS = [
  // Ebooks & Guides
  {
    title: "Peptide Beginner's Bible",
    slug: "peptide-beginners-bible",
    summary: "Comprehensive starter guide covering what peptides are, how they work, safety considerations, and getting started with popular compounds like BPC-157 and TB-500.",
    category: "ebook",
    subcategory: "starter guide",
    peptideTopics: ["BPC-157", "TB-500", "general"],
    priorityScore: 82,
    confidenceScore: 75,
    effortToBuild: "medium",
    timeToBuild: "1-2 weeks",
    estimatedPriceRange: "$14.99 - $29.99",
    estimatedMonthlyRev: "$2,000 - $5,000",
    discoverySource: "seed",
    redditMentionCount: 45,
    googleTrendsScore: 72,
    googleTrendsDirection: "rising",
  },
  {
    title: "Peptide Reconstitution Step-by-Step Guide",
    slug: "peptide-reconstitution-guide",
    summary: "Visual, beginner-friendly guide with diagrams showing exactly how to reconstitute peptides with bacteriostatic water. Covers math, safety, storage.",
    category: "ebook",
    subcategory: "reconstitution",
    peptideTopics: ["reconstitution", "bacteriostatic water"],
    priorityScore: 88,
    confidenceScore: 85,
    effortToBuild: "low",
    timeToBuild: "3-5 days",
    estimatedPriceRange: "$9.99 - $19.99",
    estimatedMonthlyRev: "$3,000 - $8,000",
    discoverySource: "seed",
    redditMentionCount: 120,
    redditQuestionCount: 67,
    googleTrendsScore: 65,
    googleTrendsDirection: "rising",
  },
  {
    title: "GLP-1 Agonist Complete Guide",
    slug: "glp1-agonist-complete-guide",
    summary: "Deep dive into semaglutide, tirzepatide, and retatrutide — dosing protocols, side effect management, diet optimization, and progress tracking.",
    category: "ebook",
    subcategory: "GLP-1",
    peptideTopics: ["semaglutide", "tirzepatide", "retatrutide", "GLP-1"],
    priorityScore: 91,
    confidenceScore: 88,
    effortToBuild: "medium",
    timeToBuild: "1-2 weeks",
    estimatedPriceRange: "$19.99 - $39.99",
    estimatedMonthlyRev: "$5,000 - $15,000",
    discoverySource: "seed",
    redditMentionCount: 230,
    googleTrendsScore: 92,
    googleTrendsDirection: "rising",
    etsyCompetitorCount: 12,
  },
  {
    title: "Peptide Stacking Guides",
    slug: "peptide-stacking-guides",
    summary: "Which peptides combine well, synergistic stacks for healing, anti-aging, fat loss, and performance. Safety considerations for combining compounds.",
    category: "ebook",
    subcategory: "stacking",
    peptideTopics: ["BPC-157", "TB-500", "CJC-1295", "ipamorelin"],
    priorityScore: 76,
    confidenceScore: 70,
    effortToBuild: "medium",
    timeToBuild: "1-2 weeks",
    estimatedPriceRange: "$14.99 - $24.99",
    estimatedMonthlyRev: "$1,500 - $4,000",
    discoverySource: "seed",
    redditMentionCount: 35,
    googleTrendsScore: 55,
    googleTrendsDirection: "stable",
  },
  // Tools & Calculators
  {
    title: "Peptide Dosing Calculator",
    slug: "peptide-dosing-calculator",
    summary: "Interactive web tool for reconstitution math and dose tracking. Input vial size, BAC water volume, desired dose — get exact units to draw.",
    category: "calculator",
    subcategory: "dosing",
    peptideTopics: ["reconstitution", "dosing", "general"],
    priorityScore: 85,
    confidenceScore: 80,
    effortToBuild: "low",
    timeToBuild: "3-5 days",
    estimatedPriceRange: "$4.99 - $9.99/mo",
    estimatedMonthlyRev: "$2,000 - $6,000",
    discoverySource: "seed",
    redditMentionCount: 90,
    redditQuestionCount: 55,
    googleTrendsScore: 70,
    googleTrendsDirection: "rising",
  },
  {
    title: "Peptide Cycle Planner",
    slug: "peptide-cycle-planner",
    summary: "Calendar-based cycle planning tool. Set start dates, compound selection, dosing schedule, PCT timing. Visual timeline with reminders.",
    category: "app",
    subcategory: "planning",
    peptideTopics: ["general", "cycle planning"],
    priorityScore: 79,
    confidenceScore: 72,
    effortToBuild: "high",
    timeToBuild: "2-4 weeks",
    estimatedPriceRange: "$9.99/mo",
    estimatedMonthlyRev: "$3,000 - $10,000",
    discoverySource: "seed",
    redditMentionCount: 25,
    googleTrendsScore: 45,
    googleTrendsDirection: "rising",
  },
  {
    title: "Reconstitution Calculator",
    slug: "reconstitution-calculator-tool",
    summary: "Simple single-purpose tool: enter BAC water volume and peptide amount, get exact concentration and dose per unit marking. Shareable results.",
    category: "calculator",
    subcategory: "reconstitution",
    peptideTopics: ["reconstitution", "bacteriostatic water"],
    priorityScore: 83,
    confidenceScore: 78,
    effortToBuild: "low",
    timeToBuild: "1-2 days",
    estimatedPriceRange: "Free with premium",
    estimatedMonthlyRev: "$500 - $2,000",
    discoverySource: "seed",
    redditMentionCount: 110,
    redditQuestionCount: 80,
    googleTrendsScore: 60,
    googleTrendsDirection: "stable",
  },
  // Templates & Printables
  {
    title: "Peptide Dosing Log",
    slug: "peptide-dosing-log",
    summary: "Printable PDF tracker for daily peptide doses, injection sites, side effects, and progress notes. Beautiful design, easy to use.",
    category: "printable",
    subcategory: "tracking",
    peptideTopics: ["general", "dosing"],
    priorityScore: 71,
    confidenceScore: 68,
    effortToBuild: "low",
    timeToBuild: "1-2 days",
    estimatedPriceRange: "$4.99 - $9.99",
    estimatedMonthlyRev: "$500 - $2,000",
    discoverySource: "seed",
    etsyCompetitorCount: 5,
    googleTrendsScore: 35,
    googleTrendsDirection: "stable",
  },
  {
    title: "Blood Work Comparison Template",
    slug: "blood-work-comparison-template",
    summary: "Spreadsheet template to track blood markers before/after peptide use. Pre-formatted for common panels with visual trend charts.",
    category: "template",
    subcategory: "blood work",
    peptideTopics: ["general", "health monitoring"],
    priorityScore: 74,
    confidenceScore: 70,
    effortToBuild: "low",
    timeToBuild: "2-3 days",
    estimatedPriceRange: "$7.99 - $14.99",
    estimatedMonthlyRev: "$800 - $2,500",
    discoverySource: "seed",
    redditMentionCount: 18,
    googleTrendsScore: 40,
    googleTrendsDirection: "rising",
  },
  // Courses
  {
    title: "Peptide 101 Video Course",
    slug: "peptide-101-video-course",
    summary: "Beginner to intermediate video course covering peptide science, safe sourcing, reconstitution, injection technique, and popular protocols.",
    category: "course",
    subcategory: "beginner",
    peptideTopics: ["general", "BPC-157", "TB-500", "semaglutide"],
    priorityScore: 77,
    confidenceScore: 65,
    effortToBuild: "high",
    timeToBuild: "3-6 weeks",
    estimatedPriceRange: "$49.99 - $149.99",
    estimatedMonthlyRev: "$3,000 - $10,000",
    discoverySource: "seed",
    youtubeVideoCount: 45,
    youtubeAvgViews: 15000,
    googleTrendsScore: 58,
    googleTrendsDirection: "rising",
  },
  // Memberships
  {
    title: "Monthly Peptide Protocol Updates",
    slug: "monthly-peptide-protocol-updates",
    summary: "Subscription newsletter + community with monthly protocol updates, new research summaries, dosing adjustments, and Q&A access.",
    category: "membership",
    subcategory: "newsletter",
    peptideTopics: ["general"],
    priorityScore: 80,
    confidenceScore: 73,
    effortToBuild: "medium",
    timeToBuild: "1-2 weeks",
    estimatedPriceRange: "$9.99 - $29.99/mo",
    estimatedMonthlyRev: "$5,000 - $20,000",
    discoverySource: "seed",
    whopCompetitorCount: 3,
    googleTrendsScore: 50,
    googleTrendsDirection: "stable",
  },
  // AI Tools
  {
    title: "Custom Peptide Protocol Generator",
    slug: "custom-peptide-protocol-generator",
    summary: "AI chatbot that creates personalized peptide protocols based on goals, experience level, and health conditions. Includes disclaimers.",
    category: "ai_tool",
    subcategory: "protocol generator",
    peptideTopics: ["general", "BPC-157", "semaglutide", "GHK-Cu"],
    priorityScore: 86,
    confidenceScore: 70,
    effortToBuild: "high",
    timeToBuild: "2-4 weeks",
    estimatedPriceRange: "$14.99 - $29.99/mo",
    estimatedMonthlyRev: "$5,000 - $25,000",
    discoverySource: "seed",
    googleTrendsScore: 62,
    googleTrendsDirection: "rising",
  },
  {
    title: "Peptide Interaction Checker",
    slug: "peptide-interaction-checker",
    summary: "Input your peptide stack, get interaction warnings, timing recommendations, and safety notes. Database-backed with AI explanations.",
    category: "ai_tool",
    subcategory: "safety",
    peptideTopics: ["general", "stacking"],
    priorityScore: 81,
    confidenceScore: 68,
    effortToBuild: "high",
    timeToBuild: "3-5 weeks",
    estimatedPriceRange: "$9.99/mo",
    estimatedMonthlyRev: "$3,000 - $12,000",
    discoverySource: "seed",
    redditMentionCount: 15,
    googleTrendsScore: 42,
    googleTrendsDirection: "stable",
  },
  // SaaS
  {
    title: "Peptide Tracker App",
    slug: "peptide-tracker-app",
    summary: "Mobile-first web app for dose logging, reminders, cycle tracking, and progress photos. Syncs across devices.",
    category: "app",
    subcategory: "tracking",
    peptideTopics: ["general", "dosing"],
    priorityScore: 84,
    confidenceScore: 75,
    effortToBuild: "high",
    timeToBuild: "4-8 weeks",
    estimatedPriceRange: "$4.99 - $9.99/mo",
    estimatedMonthlyRev: "$5,000 - $20,000",
    discoverySource: "seed",
    redditMentionCount: 30,
    googleTrendsScore: 55,
    googleTrendsDirection: "rising",
  },
  {
    title: "Women's Peptide Guide",
    slug: "womens-peptide-guide",
    summary: "Gender-specific dosing and compound selection guide for women. Covers hormonal considerations, popular compounds for women, and safety.",
    category: "ebook",
    subcategory: "women's health",
    peptideTopics: ["general", "BPC-157", "GHK-Cu", "semaglutide"],
    priorityScore: 78,
    confidenceScore: 72,
    effortToBuild: "medium",
    timeToBuild: "1-2 weeks",
    estimatedPriceRange: "$14.99 - $24.99",
    estimatedMonthlyRev: "$1,500 - $5,000",
    discoverySource: "seed",
    redditMentionCount: 20,
    googleTrendsScore: 48,
    googleTrendsDirection: "rising",
  },
  {
    title: "Cosmetic Peptide Skincare Guide",
    slug: "cosmetic-peptide-skincare-guide",
    summary: "Guide to topical peptides for skincare — GHK-Cu, copper peptides, argireline. DIY formulation recipes and product recommendations.",
    category: "ebook",
    subcategory: "skincare",
    peptideTopics: ["GHK-Cu", "cosmetic peptides"],
    priorityScore: 73,
    confidenceScore: 67,
    effortToBuild: "medium",
    timeToBuild: "1-2 weeks",
    estimatedPriceRange: "$12.99 - $24.99",
    estimatedMonthlyRev: "$1,000 - $4,000",
    discoverySource: "seed",
    etsyCompetitorCount: 8,
    googleTrendsScore: 52,
    googleTrendsDirection: "stable",
  },
];

const GOLDEN_RULES = [
  "Focus only on peptide-related digital products",
  "Recurring revenue models are always preferred over one-time purchases",
  "Never suggest anything that could be seen as medical advice without proper disclaimers",
];

const GENERAL_RULES = [
  "Prefer ebooks and calculators for quick wins — low effort, fast to market",
  "GLP-1 content (semaglutide, tirzepatide) has the highest search volume right now",
  "Visual/video-enhanced products tend to command higher prices than text-only",
  "Compound-specific content preferred over generic peptide content",
  "Always check Etsy competitor count — >30 similar products means saturated unless differentiation is clear",
];

const MONITORED_SOURCES = [
  { sourceType: "subreddit", sourceName: "r/peptides", sourceUrl: "https://reddit.com/r/peptides", checkFreqHours: 2 },
  { sourceType: "subreddit", sourceName: "r/Semaglutide", sourceUrl: "https://reddit.com/r/Semaglutide", checkFreqHours: 2 },
  { sourceType: "subreddit", sourceName: "r/Tirzepatide", sourceUrl: "https://reddit.com/r/Tirzepatide", checkFreqHours: 2 },
  { sourceType: "subreddit", sourceName: "r/Biohackers", sourceUrl: "https://reddit.com/r/Biohackers", checkFreqHours: 4 },
  { sourceType: "subreddit", sourceName: "r/Nootropics", sourceUrl: "https://reddit.com/r/Nootropics", checkFreqHours: 4 },
  { sourceType: "rss", sourceName: "Google News - Peptides", sourceUrl: "https://news.google.com/rss/search?q=peptides+health", checkFreqHours: 1 },
  { sourceType: "rss", sourceName: "Google News - Semaglutide", sourceUrl: "https://news.google.com/rss/search?q=semaglutide", checkFreqHours: 1 },
  { sourceType: "etsy_query", sourceName: "Peptide Guide (Etsy)", sourceUrl: null, checkFreqHours: 24 },
  { sourceType: "etsy_query", sourceName: "Semaglutide Guide (Etsy)", sourceUrl: null, checkFreqHours: 24 },
  { sourceType: "whop_category", sourceName: "Whop Health & Fitness", sourceUrl: "https://whop.com/categories/health-fitness/", checkFreqHours: 24 },
];

const TAGS = [
  { name: "Hot", color: "#ef4444" },
  { name: "Quick Win", color: "#22c55e" },
  { name: "Recurring Revenue", color: "#8b5cf6" },
  { name: "High Competition", color: "#f59e0b" },
  { name: "Research Needed", color: "#3b82f6" },
  { name: "GLP-1", color: "#06b6d4" },
  { name: "BPC-157", color: "#ec4899" },
  { name: "Skincare", color: "#d946ef" },
];

async function main() {
  console.log("Seeding PeptideBrain database...");

  // Seed tags
  console.log("Creating tags...");
  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag,
    });
  }

  // Seed ideas
  console.log("Creating seed ideas...");
  for (const idea of SEED_IDEAS) {
    await prisma.idea.upsert({
      where: { slug: idea.slug },
      update: {},
      create: {
        ...idea,
        sourceLinks: [],
        existingProducts: [],
        operatorNotes: [],
      },
    });
  }

  // Seed golden rules
  console.log("Creating golden rules...");
  for (const rule of GOLDEN_RULES) {
    const existing = await prisma.brainMemory.findFirst({
      where: { memoryType: "golden_rule", content: rule },
    });
    if (!existing) {
      await prisma.brainMemory.create({
        data: {
          memoryType: "golden_rule",
          content: rule,
          source: "system",
          importance: 1.0,
        },
      });
    }
  }

  // Seed general rules
  console.log("Creating general rules...");
  for (const rule of GENERAL_RULES) {
    const existing = await prisma.brainMemory.findFirst({
      where: { memoryType: "general_rule", content: rule },
    });
    if (!existing) {
      await prisma.brainMemory.create({
        data: {
          memoryType: "general_rule",
          content: rule,
          source: "system",
          importance: 0.7,
        },
      });
    }
  }

  // Seed monitored sources
  console.log("Creating monitored sources...");
  for (const source of MONITORED_SOURCES) {
    const existing = await prisma.monitoredSource.findFirst({
      where: { sourceName: source.sourceName },
    });
    if (!existing) {
      await prisma.monitoredSource.create({ data: source });
    }
  }

  console.log("Seed complete!");
  console.log(`  - ${SEED_IDEAS.length} ideas`);
  console.log(`  - ${GOLDEN_RULES.length} golden rules`);
  console.log(`  - ${GENERAL_RULES.length} general rules`);
  console.log(`  - ${MONITORED_SOURCES.length} monitored sources`);
  console.log(`  - ${TAGS.length} tags`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
