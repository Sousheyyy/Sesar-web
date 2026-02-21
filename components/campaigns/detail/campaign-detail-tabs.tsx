"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface CampaignDetailTabsProps {
  overviewContent: React.ReactNode;
  analyticsContent: React.ReactNode;
  submissionsContent: React.ReactNode;
  detailsContent: React.ReactNode;
  submissionCount: number;
  showAnalytics?: boolean;
}

export function CampaignDetailTabs({
  overviewContent,
  analyticsContent,
  submissionsContent,
  detailsContent,
  submissionCount,
  showAnalytics = true,
}: CampaignDetailTabsProps) {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="bg-white/5 border border-white/10 h-11 p-1">
        <TabsTrigger value="overview" className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4">
          Genel Bakış
        </TabsTrigger>
        {showAnalytics && (
          <TabsTrigger value="analytics" className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4">
            Analitik
          </TabsTrigger>
        )}
        <TabsTrigger value="submissions" className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4">
          Gönderiler ({submissionCount})
        </TabsTrigger>
        <TabsTrigger value="details" className="data-[state=active]:bg-white/10 data-[state=active]:text-white px-4">
          Detaylar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-6">
        {overviewContent}
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
