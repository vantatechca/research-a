"use client";

import type { IdeaDetail, ExistingProduct } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Star,
  ShoppingBag,
  Lightbulb,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface CompetitorsTabProps {
  idea: IdeaDetail;
}

function getPlatformStyle(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "etsy") return "bg-orange-100 text-orange-700";
  if (p === "whop") return "bg-purple-100 text-purple-700";
  if (p === "gumroad") return "bg-pink-100 text-pink-700";
  if (p === "amazon") return "bg-yellow-100 text-yellow-700";
  if (p === "udemy") return "bg-violet-100 text-violet-700";
  if (p === "teachable") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-700";
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < fullStars
              ? "fill-yellow-400 text-yellow-400"
              : i === fullStars && hasHalf
                ? "fill-yellow-200 text-yellow-400"
                : "text-gray-200"
          }`}
        />
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export function CompetitorsTab({ idea }: CompetitorsTabProps) {
  const products = idea.existingProducts ?? [];
  const hasCompetitors = products.length > 0;
  const hasAnalysis = !!idea.competitorAnalysis;
  const hasDifferentiation = !!idea.differentiationNotes;

  if (!hasCompetitors && !hasAnalysis && !hasDifferentiation) {
    return (
      <Card className="p-8 text-center mt-4">
        <ShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">
          No competitor data collected yet. Run a data refresh to discover competing products.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Competitor Products Table */}
      {hasCompetitors && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="w-4 h-4 text-violet-600" />
                Competing Products
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {products.length} found
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reviews
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((product: ExistingProduct, i: number) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {product.title}
                          </span>
                          {product.url && (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-violet-600 transition-colors shrink-0"
                              title="Open product page"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <Badge
                          className={`text-[10px] border-0 ${getPlatformStyle(product.platform)}`}
                        >
                          {product.platform}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700 font-medium">
                        {product.price ?? "--"}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {product.reviews != null
                          ? product.reviews.toLocaleString()
                          : "--"}
                      </td>
                      <td className="px-6 py-3">
                        {product.rating != null ? (
                          <StarRating rating={product.rating} />
                        ) : (
                          <span className="text-sm text-gray-400">--</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitive Landscape Analysis */}
      {hasAnalysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-blue-600" />
              Competitive Landscape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {idea.competitorAnalysis}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gap Analysis / Differentiation */}
      {hasDifferentiation && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              Gap Analysis & Differentiation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {idea.differentiationNotes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-gray-500 font-medium">Etsy Competitors</span>
          </div>
          <span className="text-xl font-bold text-gray-900">
            {idea.etsyCompetitorCount}
          </span>
          {idea.etsyAvgPrice && (
            <p className="text-xs text-gray-400 mt-1">
              Avg price: {idea.etsyAvgPrice}
              {idea.etsyAvgReviews != null && ` | Avg reviews: ${idea.etsyAvgReviews}`}
            </p>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs text-gray-500 font-medium">Whop Competitors</span>
          </div>
          <span className="text-xl font-bold text-gray-900">
            {idea.whopCompetitorCount}
          </span>
          <p className="text-xs text-gray-400 mt-1">
            {idea.whopCompetitorCount === 0
              ? "Low competition - opportunity"
              : "Active marketplace"}
          </p>
        </Card>
      </div>
    </div>
  );
}
