"use client";

import { useState, useEffect, memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye, Heart, MessageCircle, Share2, Loader2, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface TrendingVideo {
  videoId: string;
  videoUrl: string;
  author: {
    uniqueId: string;
    nickname: string;
    avatarThumb?: string;
  };
  stats: {
    playCount: number;
    diggCount: number;
    commentCount: number;
    shareCount: number;
  };
  desc: string;
  createTime: number;
  coverImage?: string;
}

interface TrendingVideosProps {
  songId: string;
  limit?: number;
  showTitle?: boolean;
}

export const TrendingVideos = memo(function TrendingVideos({ songId, limit = 10, showTitle = true }: TrendingVideosProps) {
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(6);

  useEffect(() => {
    fetchTrendingVideos();
  }, [songId, limit]);

  const fetchTrendingVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/music/${songId}/posts?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch trending videos");
      }
      
      const data = await response.json();
      setVideos(data.posts || []);
    } catch (err: any) {
      console.error("Error fetching trending videos:", err);
      setError(err.message || "Failed to load trending videos");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + 6, videos.length));
  };

  // Memoize displayed videos to avoid recalculating slice
  const displayedVideos = useMemo(() => videos.slice(0, displayCount), [videos, displayCount]);

  if (loading) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Videos
            </CardTitle>
            <CardDescription>
              Popular TikTok videos using this song
            </CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Videos
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>{error}</p>
            <Button 
              onClick={fetchTrendingVideos} 
              variant="outline" 
              size="sm" 
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Trending Videos
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No trending videos found for this song yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Trending Videos
          </CardTitle>
          <CardDescription>
            Popular TikTok videos using this song - Get inspired!
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedVideos.map((video) => (
            <div
              key={video.videoId}
              className="group relative overflow-hidden rounded-lg border bg-card hover:shadow-lg transition-all"
            >
              {/* Video Cover/Thumbnail */}
              <div className="relative aspect-[9/16] overflow-hidden bg-muted">
                {video.coverImage ? (
                  <img
                    src={video.coverImage}
                    alt={`Video by ${video.author.nickname}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
                
                {/* Overlay with stats */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                
                {/* Stats overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {formatNumber(video.stats.playCount)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {formatNumber(video.stats.diggCount)}
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      {formatNumber(video.stats.commentCount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Video Info */}
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  {video.author.avatarThumb && (
                    <img
                      src={video.author.avatarThumb}
                      alt={video.author.nickname}
                      className="h-8 w-8 rounded-full"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {video.author.nickname}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{video.author.uniqueId}
                    </p>
                  </div>
                </div>
                
                {video.desc && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {video.desc}
                  </p>
                )}

                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <ExternalLink className="h-3 w-3" />
                    View on TikTok
                  </Button>
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {displayCount < videos.length && (
          <div className="mt-4 text-center">
            <Button onClick={loadMore} variant="outline">
              Load More ({videos.length - displayCount} remaining)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});







