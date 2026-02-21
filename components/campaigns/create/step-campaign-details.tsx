"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface StepCampaignDetailsProps {
  title: string;
  description: string;
  minVideoDuration: string;
  onTitleChange: (val: string) => void;
  onDescriptionChange: (val: string) => void;
  onMinVideoDurationChange: (val: string) => void;
}

export function StepCampaignDetails({
  title,
  description,
  minVideoDuration,
  onTitleChange,
  onDescriptionChange,
  onMinVideoDurationChange,
}: StepCampaignDetailsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">2</span>
        Kampanya Detayları
      </h3>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Kampanya Başlığı</Label>
            <Input
              id="title"
              placeholder="Örn: Yaz Hit Promosyonu"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="h-12 text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Açıklama & Vizyon</Label>
            <Textarea
              id="description"
              placeholder="İçerik üreticilerinden ne bekliyorsunuz? (Örn: Dans videosu, dudak senkronizasyonu...)"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minVideoDuration">Min. Video Süresi (sn)</Label>
            <Input
              id="minVideoDuration"
              type="number"
              min="5"
              max="180"
              placeholder="15"
              value={minVideoDuration}
              onChange={(e) => onMinVideoDurationChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
