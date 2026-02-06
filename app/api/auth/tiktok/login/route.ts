import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  const scope = 'user.info.basic,user.info.profile,user.info.stats,video.list';
  
  const authUrl = 
    `https://www.tiktok.com/v2/auth/authorize/` +
    `?client_key=${clientKey}` +
    `&scope=${scope}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri!)}` +
    `&state=${Math.random().toString(36).substring(7)}`;
  
  return NextResponse.redirect(authUrl);
}
