export interface Song {
  id: string;
  title: string;
  duration: number;
  authorName: string | null;
  coverImage: string | null;
}

export interface CampaignFormData {
  songId: string;
  title: string;
  description: string;
  totalBudget: string;
  startDate: Date | null;
  endDate: Date | null;
  minVideoDuration: string;
}
