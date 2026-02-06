import { NextRequest, NextResponse } from 'next/server';
import { tiktokAPI } from '@/lib/tiktok-api';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', req.url));
  }
  
  try {
    // Exchange code for tokens
    const tokenData = await tiktokAPI.getAccessToken(code);
    
    // Get user info
    const userInfo = await tiktokAPI.getUserInfo(tokenData.access_token);
    
    // Find or create user
    const user = await prisma.user.upsert({
      where: { tiktok_open_id: userInfo.open_id },
      update: {
        tiktok_access_token: tokenData.access_token,
        tiktok_refresh_token: tokenData.refresh_token,
        tiktok_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ),
        tiktok_scopes: tokenData.scope,
        tiktokHandle: userInfo.username.replace('@', ''),
        name: userInfo.display_name,
        avatar: userInfo.avatar_url,
        followerCount: userInfo.follower_count,
        followingCount: userInfo.following_count,
        totalLikes: userInfo.likes_count,
        videoCount: userInfo.video_count,
        lastStatsFetchedAt: new Date()
      },
      create: {
        email: `${userInfo.open_id}@tiktok.temp`,
        password: 'tiktok-oauth',
        tiktok_open_id: userInfo.open_id,
        tiktok_access_token: tokenData.access_token,
        tiktok_refresh_token: tokenData.refresh_token,
        tiktok_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ),
        tiktok_scopes: tokenData.scope,
        tiktokHandle: userInfo.username.replace('@', ''),
        name: userInfo.display_name,
        avatar: userInfo.avatar_url,
        followerCount: userInfo.follower_count,
        followingCount: userInfo.following_count,
        totalLikes: userInfo.likes_count,
        videoCount: userInfo.video_count,
        role: 'CREATOR',
        balance: 0,
        lastStatsFetchedAt: new Date()
      }
    });
    
    // TODO: Create session with your auth system (Supabase/NextAuth)
    // For now, redirect to home with success
    return NextResponse.redirect(new URL('/?tiktok_connected=true', req.url));
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
  }
}
