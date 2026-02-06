/**
 * InsightIQ API Client
 * Handles all interactions with InsightIQ API for TikTok creator data
 * 
 * Authentication: Basic Auth with Base64(Client_ID:Secret)
 * Documentation: https://docs.insightiq.ai
 * 
 * IMPORTANT: All API calls must be made from server-side only (never from frontend)
 * 
 * Environments:
 * - Sandbox: https://api.sandbox.insightiq.ai (mock data)
 * - Staging: https://api.staging.insightiq.ai (testing with limitations)
 * - Production: https://api.insightiq.ai (live data)
 */

import {
    InsightIQConfig,
    ConnectInitiateResponse,
    TokenExchangeResponse,
    ContentsResponse,
    TikTokContent,
    GetContentsParams,
    FetchContentResponse,
    UserIdentity,
    InsightIQError,
} from './types';

// Maximum retry attempts for transient errors
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class InsightIQClient {
    private config: InsightIQConfig;
    private isConfigured: boolean;
    private basicAuthHeader: string;

    constructor(config: InsightIQConfig) {
        this.config = config;
        this.isConfigured = !!(
            config.clientId &&
            config.clientSecret &&
            config.baseUrl
        );
        
        // Pre-compute Basic Auth header
        if (config.clientId && config.clientSecret) {
            const credentials = `${config.clientId}:${config.clientSecret}`;
            this.basicAuthHeader = `Basic ${Buffer.from(credentials).toString('base64')}`;
        } else {
            this.basicAuthHeader = '';
        }
    }

    /**
     * Check if the client is properly configured
     */
    public checkConfiguration(): void {
        if (!this.isConfigured) {
            throw new Error(
                'InsightIQ is not configured. Please set INSIGHTIQ_CLIENT_ID, ' +
                'INSIGHTIQ_CLIENT_SECRET, and INSIGHTIQ_BASE_URL environment variables.'
            );
        }
    }

    /**
     * Check if InsightIQ is configured (without throwing)
     */
    public isInsightIQConfigured(): boolean {
        return this.isConfigured;
    }

    /**
     * Helper: Sleep for a given duration
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Helper: Make authenticated API request with retry logic
     * 
     * Authentication: Basic Auth with Client_ID:Secret
     * Rate Limit: Max 2 requests per second
     * On 429 error, respects Retry-After header
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        useUserToken = false,
        userToken?: string,
        retryCount = 0
    ): Promise<T> {
        this.checkConfiguration();

        const url = `${this.config.baseUrl}${endpoint}`;
        const method = options.method || 'GET';
        const body = options.body as string | undefined;

        // Build headers with Basic Auth
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': this.basicAuthHeader,
        };

        // For user-authenticated requests, also include Bearer token
        if (useUserToken && userToken) {
            headers['X-User-Token'] = userToken;
            console.log('[InsightIQ] Auth: Basic + User Token');
        } else {
            console.log('[InsightIQ] Auth: Basic Auth');
        }

        console.log('[InsightIQ] Request URL:', url);
        console.log('[InsightIQ] Method:', method);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body: body || undefined,
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = errorText;
                let errorCode = `HTTP_${response.status}`;

                try {
                    // Try parsing JSON error
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error?.message || errorJson.message || errorJson.error || errorText;
                    errorCode = errorJson.error?.code || errorJson.code || errorCode;
                } catch (e) {
                    // Not JSON, use text
                }

                console.error('[InsightIQ] API Error:', response.status, errorMessage);

                // Handle rate limiting (429)
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS * Math.pow(2, retryCount);
                    
                    if (retryCount < MAX_RETRIES) {
                        console.log(`[InsightIQ] Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                        await this.sleep(delay);
                        return this.request<T>(endpoint, options, useUserToken, userToken, retryCount + 1);
                    }
                }

                // Retry on server errors (5xx)
                if (retryCount < MAX_RETRIES && response.status >= 500) {
                    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
                    console.log(`[InsightIQ] Server error. Retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                    await this.sleep(delay);
                    return this.request<T>(endpoint, options, useUserToken, userToken, retryCount + 1);
                }

                throw new Error(`InsightIQ API Error (${response.status}): ${errorMessage}`);
            }

            return response.json();
        } catch (error) {
            // Handle network errors with retry
            if (
                retryCount < MAX_RETRIES &&
                error instanceof TypeError // Network errors
            ) {
                const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
                console.log(`[InsightIQ] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
                await this.sleep(delay);
                return this.request<T>(endpoint, options, useUserToken, userToken, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * USER API: Create a user in InsightIQ
     * 
     * Must be called before creating SDK tokens.
     * The external_id is your internal user ID that maps to InsightIQ's user.
     * 
     * @param externalId - Your internal user ID
     * @param name - Optional display name
     */
    async createUser(
        externalId: string,
        name?: string
    ): Promise<{ id: string; external_id: string; created_at: string }> {
        return this.request<{ id: string; external_id: string; created_at: string }>(
            '/v1/users',
            {
                method: 'POST',
                body: JSON.stringify({
                    external_id: externalId,
                    name: name || externalId,
                }),
            }
        );
    }

    /**
     * USER API: Get or create a user in InsightIQ
     * 
     * Tries to get existing user first, creates if not found.
     * 
     * @param externalId - Your internal user ID
     * @param name - Optional display name
     */
    async getOrCreateUser(
        externalId: string,
        name?: string
    ): Promise<{ id: string; external_id: string }> {
        try {
            // Try to get existing user
            const user = await this.request<{ id: string; external_id: string }>(
                `/v1/users/external_id/${externalId}`,
                { method: 'GET' }
            );
            console.log('[InsightIQ] Found existing user:', user.id);
            return user;
        } catch (error: any) {
            // If user doesn't exist (404), create them
            if (error.message?.includes('404') || error.message?.includes('not found')) {
                console.log('[InsightIQ] User not found, creating new user...');
                const newUser = await this.createUser(externalId, name);
                console.log('[InsightIQ] Created new user:', newUser.id);
                return newUser;
            }
            throw error;
        }
    }

    /**
     * SDK TOKEN API: Create a short-lived SDK token for Connect SDK
     * 
     * This token is used to initialize the frontend Connect SDK or redirect flow.
     * Valid for 1 week but should be refreshed before expiry.
     * 
     * Note: User must exist in InsightIQ first (use getOrCreateUser)
     * 
     * @param insightiqUserId - InsightIQ's user ID (not your internal ID)
     * @param products - Array of products to request access to
     * @param redirectUrl - Optional redirect URL for redirect flow (no SDK needed)
     */
    async createSdkToken(
        insightiqUserId: string,
        products: string[] = ['IDENTITY', 'ENGAGEMENT'],
        redirectUrl?: string
    ): Promise<{ 
        sdk_token: string; 
        sdk_token_id: string;
        expires_at: string; 
        user_id: string;
        connect_url?: string;  // Some APIs return this
    }> {
        const body: Record<string, any> = {
            user_id: insightiqUserId,
            products,
        };

        // Add redirect URL for redirect flow (no frontend SDK needed)
        if (redirectUrl) {
            body.redirect_url = redirectUrl;
        }

        const response = await this.request<any>(
            '/v1/sdk-tokens',
            {
                method: 'POST',
                body: JSON.stringify(body),
            }
        );

        console.log('[InsightIQ] SDK Token Response:', JSON.stringify(response, null, 2));

        // Handle different response formats
        return {
            sdk_token: response.sdk_token || response.token,
            sdk_token_id: response.sdk_token_id || response.id,
            expires_at: response.expires_at,
            user_id: response.user_id,
            connect_url: response.connect_url || response.url,
        };
    }

    /**
     * Get the Connect URL for redirect flow
     * 
     * Use InsightIQ's hosted connect page.
     * 
     * @param sdkToken - The SDK token from createSdkToken
     * @param workPlatformId - Optional: skip platform selection (e.g., TikTok ID)
     * @param environment - sandbox, staging, or production
     */
    getConnectUrl(sdkToken: string, workPlatformId?: string, environment?: string): string {
        // InsightIQ/Phyllo Connect URL format
        // Based on environment
        let baseConnectUrl: string;
        
        if (environment === 'sandbox' || this.config.baseUrl.includes('sandbox')) {
            baseConnectUrl = 'https://connect.sandbox.insightiq.ai';
        } else if (environment === 'staging' || this.config.baseUrl.includes('staging')) {
            baseConnectUrl = 'https://connect.staging.insightiq.ai';
        } else {
            baseConnectUrl = 'https://connect.insightiq.ai';
        }

        // Build URL with required parameters
        const params = new URLSearchParams();
        params.set('sdk_token', sdkToken);
        
        if (workPlatformId) {
            params.set('work_platform_id', workPlatformId);
        }

        const url = `${baseConnectUrl}?${params.toString()}`;
        console.log('[InsightIQ] Connect URL:', url);
        
        return url;
    }

    /**
     * ACCOUNTS API: Get account details by account ID
     * 
     * Returns account information including username, profile picture, etc.
     * 
     * @param accountId - The Phyllo/InsightIQ account ID
     */
    async getAccount(accountId: string): Promise<{
        id: string;
        user_id: string;
        work_platform_id: string;
        username?: string;
        platform_username?: string;
        platform_profile_name?: string;
        platform_profile_picture_url?: string;
        status: string;
        created_at: string;
        updated_at: string;
    }> {
        const response = await this.request<any>(
            `/v1/accounts/${accountId}`,
            { method: 'GET' }
        );

        console.log('[InsightIQ] Account details:', JSON.stringify(response, null, 2));

        return {
            id: response.id,
            user_id: response.user_id,
            work_platform_id: response.work_platform_id,
            username: response.username || response.platform_username,
            platform_username: response.platform_username,
            platform_profile_name: response.platform_profile_name,
            platform_profile_picture_url: response.platform_profile_picture_url,
            status: response.status,
            created_at: response.created_at,
            updated_at: response.updated_at,
        };
    }

    /**
     * WORK PLATFORMS API: Get all available work platforms
     * 
     * Use this to find the correct work_platform_id for TikTok or other platforms.
     */
    async getWorkPlatforms(): Promise<{
        data: Array<{
            id: string;
            name: string;
            url: string;
            logo_url: string;
            category: string;
        }>;
    }> {
        const response = await this.request<any>(
            '/v1/work-platforms',
            { method: 'GET' }
        );

        console.log('[InsightIQ] Work platforms:', JSON.stringify(response, null, 2));
        return response;
    }

    /**
     * Find TikTok work platform ID
     */
    async getTikTokPlatformId(): Promise<string | null> {
        try {
            const platforms = await this.getWorkPlatforms();
            const tiktok = platforms.data?.find(
                (p) => p.name.toLowerCase().includes('tiktok')
            );
            if (tiktok) {
                console.log('[InsightIQ] Found TikTok platform:', tiktok);
                return tiktok.id;
            }
            return null;
        } catch (error) {
            console.error('[InsightIQ] Failed to get TikTok platform ID:', error);
            return null;
        }
    }

    /**
     * @deprecated Use createSdkToken() instead - this endpoint doesn't exist
     * The Connect SDK handles the OAuth flow on the frontend
     */
    async initiateConnection(userId?: string): Promise<ConnectInitiateResponse> {
        // Redirect to using SDK token flow
        throw new Error(
            'initiateConnection is deprecated. Use createSdkToken() to get an SDK token, ' +
            'then initialize the Connect SDK on the frontend.'
        );
    }

    /**
     * CONNECT API: Exchange user_token for access_token
     */
    async exchangeToken(userToken: string): Promise<TokenExchangeResponse> {
        return this.request<TokenExchangeResponse>(
            '/v1/connect/token',
            {
                method: 'POST',
                body: JSON.stringify({
                    user_token: userToken,
                }),
            }
        );
    }

    /**
     * CONNECT API: Refresh access token
     */
    async refreshToken(refreshToken: string): Promise<TokenExchangeResponse> {
        return this.request<TokenExchangeResponse>(
            '/v1/connect/refresh',
            {
                method: 'POST',
                body: JSON.stringify({
                    refresh_token: refreshToken,
                }),
            }
        );
    }

    /**
     * SOCIAL CONTENT API: Get user's TikTok videos
     */
    async getUserContents(
        accessToken: string,
        params?: Partial<GetContentsParams>
    ): Promise<ContentsResponse> {
        const queryParams = new URLSearchParams({
            platform: 'tiktok',
            limit: String(params?.limit || 50),
            offset: String(params?.offset || 0),
        });

        if (params?.from_date) {
            queryParams.set('from_date', params.from_date);
        }
        if (params?.to_date) {
            queryParams.set('to_date', params.to_date);
        }

        return this.request<ContentsResponse>(
            `/v1/social/contents?${queryParams}`,
            {},
            true,
            accessToken
        );
    }

    /**
     * SOCIAL CONTENT API: Fetch specific content by URL
     * Uses server-side Basic Auth - no user token needed
     * 
     * Note: This works for VIDEO URLs, not music/sound page URLs
     * 
     * @param url - TikTok video URL (e.g., tiktok.com/@user/video/123)
     * @param workPlatformId - Work platform ID (TikTok = fetched dynamically)
     */
    async fetchContentByUrl(url: string, workPlatformId?: string): Promise<TikTokContent> {
        // Get TikTok platform ID if not provided
        const platformId = workPlatformId || await this.getTikTokPlatformId();
        
        if (!platformId) {
            throw new Error('Could not determine TikTok work platform ID');
        }

        const response = await this.request<any>(
            '/v1/social/creators/contents/fetch',
            {
                method: 'POST',
                body: JSON.stringify({
                    content_url: url,
                    work_platform_id: platformId,
                }),
            }
        );

        console.log('[InsightIQ] Raw response type:', Array.isArray(response) ? 'array' : typeof response);

        // Handle both array and single object responses
        // API returns array like [{...}] instead of {data: {...}}
        let content: any;
        if (Array.isArray(response)) {
            content = response[0];
            console.log('[InsightIQ] Extracted first item from array');
        } else if (response.data) {
            content = response.data;
            console.log('[InsightIQ] Extracted data property');
        } else {
            content = response;
            console.log('[InsightIQ] Using response directly');
        }
        
        if (!content) {
            throw new Error('No content returned from API');
        }

        console.log('[InsightIQ] Processed content has audio_track_info:', !!content.audio_track_info);

        return content as TikTokContent;
    }

    /**
     * CONTENT API: Get content/videos by account ID
     * Uses server-side Basic Auth with account_id (from SDK connection)
     * 
     * @param accountId - The Phyllo account ID from SDK connection
     * @param params - Optional pagination and filtering params
     */
    async getContentByAccountId(
        accountId: string,
        params?: { limit?: number; offset?: number; from_date?: string; to_date?: string }
    ): Promise<ContentsResponse> {
        const queryParams = new URLSearchParams({
            account_id: accountId,
            limit: String(params?.limit || 50),
            offset: String(params?.offset || 0),
        });

        if (params?.from_date) {
            queryParams.set('from_date', params.from_date);
        }
        if (params?.to_date) {
            queryParams.set('to_date', params.to_date);
        }

        return this.request<ContentsResponse>(
            `/v1/social/contents?${queryParams}`,
            { method: 'GET' }
        );
    }

    /**
     * IDENTITY API: Get profile by account ID
     * Uses server-side Basic Auth
     * 
     * @param accountId - The Phyllo account ID
     */
    async getProfileByAccountId(accountId: string): Promise<any> {
        return this.request<any>(
            `/v1/profiles?account_id=${accountId}`,
            { method: 'GET' }
        );
    }

    /**
     * HELPER: Find videos using a specific music track (by account ID)
     * Uses the account_id from SDK connection flow
     */
    async findVideosByMusicIdForAccount(
        accountId: string,
        musicId: string,
        limit = 100
    ): Promise<TikTokContent[]> {
        const contents = await this.getContentByAccountId(accountId, { limit });

        return contents.data.filter(
            (content) => content.audio_track_info?.id === musicId
        );
    }

    /**
     * IDENTITY API: Get user's TikTok profile
     * @deprecated Use getProfileByAccountId instead for SDK flow
     */
    async getUserIdentity(accessToken: string): Promise<UserIdentity> {
        return this.request<UserIdentity>(
            '/v1/social/identity?platform=tiktok',
            {},
            true,
            accessToken
        );
    }

    /**
     * HELPER: Find videos using a specific music track
     * @deprecated Use findVideosByMusicIdForAccount instead for SDK flow
     */
    async findVideosByMusicId(
        accessToken: string,
        musicId: string,
        limit = 100
    ): Promise<TikTokContent[]> {
        const contents = await this.getUserContents(accessToken, { limit });

        return contents.data.filter(
            (content) => content.audio_track_info?.id === musicId
        );
    }

    /**
     * HELPER: Get all videos (paginated)
     */
    async getAllUserContents(accessToken: string): Promise<TikTokContent[]> {
        const allVideos: TikTokContent[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await this.getUserContents(accessToken, {
                limit,
                offset,
            });

            allVideos.push(...response.data);
            hasMore = response.pagination.has_more;
            offset += limit;

            // Safety limit to prevent infinite loops
            if (offset > 1000) {
                console.warn('Reached safety limit of 1000 videos');
                break;
            }
        }

        return allVideos;
    }
}

/**
 * Singleton instance for use throughout the application
 * Note: Configuration is validated at runtime, not at import time
 */
export const insightIQClient = new InsightIQClient({
    clientId: process.env.INSIGHTIQ_CLIENT_ID || '',
    clientSecret: process.env.INSIGHTIQ_CLIENT_SECRET || '',
    baseUrl: process.env.INSIGHTIQ_BASE_URL || '',
    redirectUri: process.env.INSIGHTIQ_REDIRECT_URI || '',
});
