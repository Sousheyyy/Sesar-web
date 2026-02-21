"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface AdminCampaignTabsProps {
  overviewContent: React.ReactNode;
  financialContent: React.ReactNode;
  analyticsContent: React.ReactNode;
  submissionsContent: React.ReactNode;
  detailsContent: React.ReactNode;
  submissionCount: number;
  showAnalytics?: boolean;
}

export function AdminCampaignTabs({
  overviewContent,
  financialContent,
  analyticsContent,
  submissionsContent,
  detailsContent,
  submissionCount,
  showAnalytics = true,
}: AdminCampaignTabsProps) {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="bg-white/5 border border-white/10 h-11 p-1 flex-wrap h-auto gap-1">
        <TabsTrigger
          value="overview"
          className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4"
        >
          Genel Bakış
        </TabsTrigger>
        <TabsTrigger
          value="financial"
          className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4"
        >
          Finansal
        </TabsTrigger>
        {showAnalytics && (
          <TabsTrigger
            value="analytics"
            className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4"
          >
            Analitik
          </TabsTrigger>
        )}
        <TabsTrigger
          value="submissions"
          className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4 gap-1.5"
        >
          Gönderiler
          {submissionCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {submissionCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="details"
          className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4"
        >
          Detaylar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        {overviewContent}
      </TabsContent>

      <TabsContent value="financial" className="mt-6">
        {financialContent}
      </TabsContent>

      {showAnalytics && (
        <TabsContent value="analytics" className="mt-6">
          {analyticsContent}
        </TabsContent>
      )}

      <TabsContent value="submissions" className="mt-6">
        {submissionsContent}
      </TabsContent>

      <TabsContent value="details" className="mt-6">
        {detailsContent}
      </TabsContent>
    </Tabs>
  );
}
