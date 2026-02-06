/**
 * InsightIQ API TypeScript Type Definitions
 * For TikTok creator data integration
 */

export interface InsightIQConfig {
    clientId: string;
    clientSecret: string;
    baseUrl: string;
    redirectUri: string;
}

/**
 * Connect API - OAuth Flow
 */
export interface ConnectInitiateRequest {
    platform: 'tiktok';
    redirect_uri: string;
    user_id?: string;
}

export interface ConnectInitiateResponse {
    connect_url: string;
    token: string;
    expires_in: number;
}

export interface TokenExchangeRequest {
    user_token: string;
}

export interface TokenExchangeResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    platform: 'tiktok';
    platform_user_id: string;
    platform_username: string;
}

export interface TokenRefreshRequest {
    refresh_token: string;
}

export interface TokenRefreshResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

/**
 * Social Content API - TikTok Videos
 */
export interface AudioTrackInfo {
    id: string;
    title: string;
    artist: string;
    url: string;
    cover_url?: string;
    duration?: number;
}

export interface ContentEngagement {
    likes: number;
    comments: number;
    shares: number;
    plays: number;
    saves?: number;
}

export interface ContentCreator {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
}

export interface TikTokContent {
    id: string;
    platform: 'tiktok';
    platform_content_id: string;
    title: string;
    description: string;
    format: 'video';
    url: string;
    direct_url?: string;
    thumbnail_url: string;
    published_at: string;
    duration?: number;
    audio_track_info?: AudioTrackInfo;
    hashtags: string[];
    engagement: ContentEngagement;
    creator: ContentCreator;
}

export interface ContentsResponse {
    data: TikTokContent[];
    pagination: {
        total: number;
        offset: number;
        limit: number;
        has_more: boolean;
    };
}

export interface FetchContentRequest {
    platform: 'tiktok';
    url: string;
}

export interface FetchContentResponse {
    data: TikTokContent;
}

/**
 * Identity API - User Profile
 */
export interface UserIdentity {
    platform: 'tiktok';
    platform_user_id: string;
    username: string;
    display_name: string;
    bio?: string;
    avatar_url: string;
    follower_count: number;
    following_count: number;
    video_count: number;
    likes_count: number;
    is_verified: boolean;
    is_business_account: boolean;
    connected_at: string;
}

/**
 * Error Responses
 */
export interface InsightIQError {
    error: string;
    code: string;
    message: string;
    details?: unknown;
}

/**
 * Query Parameters
 */
export interface GetContentsParams {
    platform: 'tiktok';
    limit?: number;
    offset?: number;
    from_date?: string;
    to_date?: string;
}

export interface GetIdentityParams {
    platform: 'tiktok';
}
