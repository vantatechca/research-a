"use client";

import type { IdeaDetail } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  AlertTriangle,
  DollarSign,
  Hammer,
  Clock,
  Lightbulb,
  FileText,
} from "lucide-react";

interface OverviewTabProps {
  idea: IdeaDetail;
}

export function OverviewTab({ idea }: OverviewTabProps) {
  return (
    <div className="space-y-6 mt-4">
      {/* AI Analysis */}
      {idea.detailedAnalysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-violet-600" />
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
              {idea.detailedAnalysis.split("\n").map((line, i) => {
                if (!line.trim()) return <br key={i} />;

                // Handle headings (lines starting with ## or ###)
                if (line.startsWith("### ")) {
                  return (
                    <h4 key={i} className="text-sm font-semibold text-gray-900 mt-4 mb-1">
                      {line.replace("### ", "")}
                    </h4>
                  );
                }
                if (line.startsWith("## ")) {
                  return (
                    <h3 key={i} className="text-base font-semibold text-gray-900 mt-4 mb-2">
                      {line.replace("## ", "")}
                    </h3>
                  );
                }

                // Handle bullet points
                if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
                  return (
                    <li key={i} className="ml-4 text-sm text-gray-600">
                      {line.replace(/^\s*[-*]\s+/, "")}
                    </li>
                  );
                }

                // Handle bold text within paragraphs
                const parts = line.split(/\*\*(.*?)\*\*/g);
                return (
                  <p key={i} className="text-sm text-gray-600 mb-2">
                    {parts.map((part, j) =>
                      j % 2 === 1 ? (
                        <strong key={j} className="text-gray-800 font-medium">
                          {part}
                        </strong>
                      ) : (
                        part
                      )
                    )}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Target Audience */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-blue-600" />
              Target Audience
            </CardTitle>
          </CardHeader>
          <CardContent>
            {idea.subcategory ? (
              <div>
                <Badge variant="secondary" className="mb-2">
                  {idea.subcategory}
                </Badge>
                <p className="text-sm text-gray-600">
                  People interested in{" "}
                  <span className="font-medium text-gray-800">
                    {idea.peptideTopics.length > 0
                      ? idea.peptideTopics.join(", ")
                      : idea.category}
                  </span>{" "}
                  looking for{" "}
                  <span className="font-medium text-gray-800">
                    {idea.category.replace(/_/g, " ")}
                  </span>{" "}
                  products.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No specific audience data available yet.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pain Point */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Pain Point Addressed
            </CardTitle>
          </CardHeader>
          <CardContent>
            {idea.summary ? (
              <p className="text-sm text-gray-600 leading-relaxed">
                {idea.summary}
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No pain point analysis available.
              </p>
            )}
            {idea.redditQuestionCount > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Based on {idea.redditQuestionCount} related questions found on Reddit
              </p>
            )}
          </CardContent>
        </Card>

        {/* Revenue Estimate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-green-600" />
              Revenue Estimate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {idea.estimatedMonthlyRev ? (
                <div>
                  <span className="text-xl font-bold text-gray-900">
                    {idea.estimatedMonthlyRev}
                  </span>
                  <span className="text-sm text-gray-500 ml-1">/month</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Not yet estimated</p>
              )}

              {idea.estimatedPriceRange && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Price range:</span>
                  <span className="font-medium text-gray-800">
                    {idea.estimatedPriceRange}
                  </span>
                </div>
              )}

              {idea.etsyAvgPrice && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Etsy avg price:</span>
                  <span className="font-medium text-gray-800">
                    {idea.etsyAvgPrice}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Build Effort & Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Hammer className="w-4 h-4 text-orange-600" />
              Build Effort & Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-500">Effort:</span>
                </div>
                <span className="text-sm font-medium text-gray-800">
                  {idea.effortToBuild ?? "Unknown"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-sm text-gray-500">Timeline:</span>
                </div>
                <span className="text-sm font-medium text-gray-800">
                  {idea.timeToBuild ?? "Unknown"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Differentiation */}
      {idea.differentiationNotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              Differentiation Angles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {idea.differentiationNotes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state if no analysis at all */}
      {!idea.detailedAnalysis &&
        !idea.subcategory &&
        !idea.estimatedMonthlyRev &&
        !idea.differentiationNotes && (
          <Card className="p-8 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              No detailed analysis available yet. Use the Deep Dive button to ask the AI Brain for analysis.
            </p>
          </Card>
        )}
    </div>
  );
}
