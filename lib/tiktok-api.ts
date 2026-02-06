// Server-only import - this should never run on the client
import 'server-only';

interface TikTokUser {
  open_id: string;
  username: string;
  display_name: string;
  avatar_url: string;
  follower_count: number;
  following_count: number;
  likes_count: number;
  video_count: number;
}

interface TikTokVideo {
  id: string;
  title: string;
  video_description: string;
  duration: number;
  cover_image_url: string;
  create_time: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
}

export class TikTokAPIService {
  private clientKey: string;
  private clientSecret: string;
  
  constructor() {
    this.clientKey = process.env.TIKTOK_CLIENT_KEY!;
    this.clientSecret = process.env.TIKTOK_CLIENT_SECRET!;
  }
  
  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    open_id: string;
    scope: string;
  }> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: process.env.TIKTOK_REDIRECT_URI!
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/oauth/token/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: this.clientKey,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get user info from TikTok API
   */
  async getUserInfo(accessToken: string): Promise<TikTokUser> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.user;
  }
  
  /**
   * Get video details from TikTok API
   */
  async getVideoInfo(
    accessToken: string,
    videoIds: string[]
  ): Promise<TikTokVideo[]> {
    const response = await fetch(
      'https://open.tiktokapis.com/v2/video/query/?fields=id,title,video_description,duration,cover_image_url,create_time,view_count,like_count,comment_count,share_count',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filters: { video_ids: videoIds }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get video info: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data.videos;
  }
}

export const tiktokAPI = new TikTokAPIService();
