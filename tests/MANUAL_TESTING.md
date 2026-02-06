/**
 * Manual Testing Checklist for InsightIQ Integration
 * Use this guide to test the complete integration manually
 */

# InsightIQ Integration - Manual Testing Guide

## Prerequisites

- ✅ InsightIQ sandbox credentials configured in `.env`
- ✅ Database migrated with new fields
- ✅ Development server running (`npm run dev`)
- ✅ Test TikTok account with videos

---

## Test 1: Encryption Utilities

### Test Token Encryption

**File:** `lib/crypto.ts`

```bash
# Create test file: test-encryption.js
node -e "
const { encryptToken, decryptToken, testEncryption } = require('./lib/crypto.ts');
console.log('Encryption test:', testEncryption() ? '✅ PASS' : '❌ FAIL');

const token = 'test-token-123';
const encrypted = encryptToken(token);
console.log('Encrypted:', encrypted);

const decrypted = decryptToken(encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', token === decrypted ? '✅ PASS' : '❌ FAIL');
"
```

**Expected Result:**
```
Encryption test: ✅ PASS
Encrypted: [random_hex]:[encrypted_hex]
Decrypted: test-token-123
Match: ✅ PASS
```

---

## Test 2: URL Parsing

### Test Music ID Extraction

**Test URLs:**
```typescript
const tests = [
  {
    url: 'https://www.tiktok.com/music/Cool-Song-7123456789012345678',
    expected: '7123456789012345678',
  },
  {
    url: 'https://m.tiktok.com/music/Song-Name-7000000000000000000',
    expected: '7000000000000000000',
  },
];
```

**How to Test:**
1. Open browser console on any page
2. Import and test:
```javascript
import { extractMusicId } from '@/lib/insightiq/url-utils';

tests.forEach(({ url, expected }) => {
  const result = extractMusicId(url);
  console.log(result === expected ? '✅' : '❌', url);
});
```

**Expected:** All ✅

---

## Test 3: OAuth Flow (Web)

### 3.1 Initiate Connection

**Endpoint:** `POST /api/auth/insightiq/initiate`

**cURL Test:**
```bash
curl -X POST http://localhost:3000/api/auth/insightiq/initiate \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "connectUrl": "https://api.sandbox.insightiq.ai/connect/tiktok/...",
  "expiresIn": 600
}
```

**Visual Test:**
1. Login to your app
2. Go to Settings page
3. Click "Connect TikTok" button
4. Should open InsightIQ OAuth page
5. **Sandbox Note:** May show mock data or test screen

---

### 3.2 OAuth Callback

**Endpoint:** `GET /api/auth/insightiq/callback`

**Test URL** (manually construct):
```
http://localhost:3000/api/auth/insightiq/callback?user_token=test_token_123&status=success&platform=tiktok
```

**Expected:**
- Redirects to `/settings?success=tiktok_connected`
- User record updated in database with:
  - Encrypted `insightiqAccessToken`
  - Encrypted `insightiqRefreshToken`
  - `tiktokUserId`, `tiktokUsername`, etc.

**Database Check:**
```sql
SELECT 
  tiktokUserId, 
  tiktokUsername, 
  insightiqAccessToken IS NOT NULL as has_token,
  tiktokConnectedAt
FROM "User" 
WHERE id = 'your-user-id';
```

---

### 3.3 Connection Status

**Endpoint:** `GET /api/auth/insightiq/status`

**cURL Test:**
```bash
curl http://localhost:3000/api/auth/insightiq/status \
  -H "Cookie: your-session-cookie"
```

**Expected Response:**
```json
{
  "success": true,
  "connected": true,
  "user": {
    "userId": "7123456789",
    "username": "@testuser",
    "displayName": "Test User",
    "avatarUrl": "https://...",
    "connectedAt": "2026-02-02T...",
    "tokenExpiresIn": 86400
  }
}
```

---

### 3.4 Disconnect

**Endpoint:** `POST /api/auth/insightiq/disconnect`

**cURL Test:**
```bash
curl -X POST http://localhost:3000/api/auth/insightiq/disconnect \
  -H "Cookie: your-session-cookie"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "TikTok account disconnected"
}
```

**Database Check:**
```sql
-- All these should be NULL
SELECT 
  insightiqAccessToken,
  insightiqRefreshToken,
  tiktokUserId
FROM "User" 
WHERE id = 'your-user-id';
```

---

## Test 4: Song Upload with InsightIQ

**Endpoint:** `POST /api/songs/upload`

### Test Case 1: Valid Music URL

**Request:**
```bash
curl -X POST http://localhost:3000/api/songs/upload \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "tiktokUrl": "https://www.tiktok.com/music/Song-Name-7123456789"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "song": {
    "id": "song_xxx",
    "title": "Song Name",
    "authorName": "Artist Name",
    "tiktokMusicId": "7123456789",
    "musicCoverUrl": "https://...",
    "videoCount": 5
  },
  "videoCount": 5,
  "message": "Song \"Song Name\" by Artist Name added successfully"
}
```

**Visual Test:**
1. Login as artist
2. Go to "Add Song" page
3. Paste TikTok music URL
4. Click "Upload"
5. Should show success with song details
6. Song should appear in your songs list

---

### Test Case 2: No TikTok Connection

**Expected Response:**
```json
{
  "error": "TikTok not connected",
  "message": "Please connect your TikTok account first",
  "requiresConnection": true
}
```

---

### Test Case 3: Invalid URL

**Request:**
```json
{
  "tiktokUrl": "https://www.tiktok.com/@user/video/123"
}
```

**Expected Response:**
```json
{
  "error": "Invalid TikTok music URL",
  "message": "Please provide a valid TikTok music page URL"
}
```

---

### Test Case 4: No Videos Found

**Scenario:** Music URL for song user hasn't used

**Expected Response:**
```json
{
  "error": "No videos found",
  "message": "Could not find any videos in your TikTok account using this music track..."
}
```

---

### Test Case 5: Duplicate Song

**Request:** Same music URL as Test Case 1

**Expected Response:**
```json
{
  "error": "Song already exists",
  "message": "This song has already been added to the platform",
  "song": { ... }
}
```

---

## Test 5: Video Submission with Verification

**Endpoint:** `POST /api/campaigns/[id]/submit-video`

### Test Case 1: Correct Song

**Request:**
```bash
curl -X POST http://localhost:3000/api/campaigns/camp_123/submit-video \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.tiktok.com/@user/video/7350123456789"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "submission": {
    "id": "sub_xxx",
    "verified": true,
    "status": "APPROVED",
    "lastViewCount": 15000,
    "lastLikeCount": 1200
  },
  "video": {
    "title": "Video title",
    "thumbnail": "https://...",
    "engagement": {
      "likes": 1200,
      "comments": 50,
      "shares": 30,
      "plays": 15000
    }
  },
  "message": "Video submitted and verified successfully!"
}
```

---

### Test Case 2: Wrong Song

**Scenario:** Video using different music

**Expected Response:**
```json
{
  "error": "Wrong song",
  "message": "This video uses \"Different Song\" by Other Artist, but the campaign requires \"Campaign Song\" by Campaign Artist",
  "expected": {
    "title": "Campaign Song",
    "artist": "Campaign Artist"
  },
  "actual": {
    "title": "Different Song",
    "artist": "Other Artist"
  }
}
```

---

### Test Case 3: Video Not in User Account

**Scenario:** URL from another user's account

**Expected Response:**
```json
{
  "error": "Video not found",
  "message": "Could not find this video in your TikTok account..."
}
```

---

### Test Case 4: Duplicate Submission

**Request:** Same video URL as Test Case 1

**Expected Response:**
```json
{
  "error": "Already submitted",
  "message": "You have already submitted a video to this campaign",
  "submission": { ... }
}
```

---

## Test 6: Token Auto-Refresh

### Simulate Token Expiration

**Manually in Database:**
```sql
-- Set token expiry to past
UPDATE "User" 
SET "insightiqTokenExpiry" = NOW() - INTERVAL '1 hour'
WHERE id = 'your-user-id';
```

**Test:**
1. Make any API call that uses InsightIQ
2. Should auto-refresh token
3. Check logs for: `Refreshing access token for user...`

**Verify:**
```sql
-- Token expiry should be updated to future
SELECT insightiqTokenExpiry > NOW() as is_valid
FROM "User" 
WHERE id = 'your-user-id';
```

---

## Test 7: Error Handling

### Test Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Invalid credentials | 401 Unauthorized |
| InsightIQ API down | 502 Bad Gateway |
| Rate limit hit | 429 with retry message |
| Malformed URL | 400 Bad Request |
| Missing user_token in callback | Redirect to error page |

---

## Test 8: Sandbox Mock Data

### Verify Sandbox Responses

**Note:** Sandbox returns mock data, not real TikTok data

**Check:**
1. OAuth flow completes successfully
2. `getUserContents()` returns mock videos
3. Mock videos have `audio_track_info`
4. Can extract music metadata from mock data

---

## Test Checklist

### Phase 1: Foundation ✅
- [ ] Encryption works correctly
- [ ] URL parsing extracts IDs
- [ ] InsightIQ client initializes
- [ ] Environment variables loaded

### Phase 2: OAuth Flow
- [ ] Initiate connection returns URL
- [ ] Callback stores encrypted tokens
- [ ] Status endpoint shows connection
- [ ] Disconnect removes tokens
- [ ] Token auto-refresh works

### Phase 3: Song Upload
- [ ] Valid music URL creates song
- [ ] Duplicate detection works
- [ ] Invalid URL rejected
- [ ] Missing videos handled
- [ ] Music metadata extracted

### Phase 4: Video Submission
- [ ] Correct song auto-approved
- [ ] Wrong song rejected clearly
- [ ] Video not found handled
- [ ] Duplicate prevention works
- [ ] Engagement metrics captured

### Phase 5: Edge Cases
- [ ] Expired token refreshes
- [ ] API errors handled gracefully
- [ ] Mobile URLs normalized
- [ ] Empty/invalid input rejected
- [ ] Database constraints enforced

---

## Success Criteria

✅ **Foundation:** All utilities work independently  
✅ **OAuth:** Complete flow from initiate to callback  
✅ **Song Upload:** Music metadata extracted correctly  
✅ **Video Submit:** Automatic verification functional  
✅ **Error Handling:** Graceful failures with clear messages  
✅ **Security:** Tokens encrypted, auto-refresh working  

---

## Next Steps After Testing

1. **Sandbox → Staging**
   - Update `INSIGHTIQ_BASE_URL` to staging
   - Test with real TikTok data (limited calls)

2. **Staging → Production**
   - Pay for production access
   - Update base URL to production
   - Deploy to Vercel

3. **Mobile Integration**
   - Test OAuth with deep links
   - Verify mobile API calls work

---

## Troubleshooting

### "ENCRYPTION_KEY must be 64 characters"
**Fix:** Check `.env` has correct key format

### "User has not connected TikTok"
**Fix:** Complete OAuth flow first

### "InsightIQ API Error: 401"
**Fix:** Verify `INSIGHTIQ_CLIENT_ID` and `CLIENT_SECRET`

### Videos not found
**Fix:** Ensure user has videos with the specified music

### Token refresh fails
**Fix:** Check `insightiqRefreshToken` is valid and encrypted

---

**Happy Testing! 🎉**
