# Memberstack Blog Count

Blog view counter API using Airtable and Vercel, designed to work with Webflow and Memberstack.

## Features

- **View Tracking**: Track blog post view counts in Airtable with auto-record creation
- **Deduplication**: Server-side request deduplication to prevent race conditions
- **Session Tracking**: Client-side session tracking prevents duplicate counts per session
- **CORS-enabled**: Works seamlessly with Webflow and other web platforms
- **Testing Tools**: Built-in endpoint for debugging and configuration validation
- **Auto-create Records**: Automatically creates Airtable records for new blog posts

## API Endpoints

#### 1. Get View Count
```
GET /api/get-count?slug=your-blog-slug
```
Returns the view count for a specific blog post.

**Response:**
```json
{
  "slug": "your-blog-slug",
  "view_count": 42,
  "total_views": 142,
  "title": "Blog Post Title",
  "record_id": "recXXXXXXXXXX"
}
```

#### 2. Increment View Count
```
POST /api/increment-count
Body: { "slug": "your-blog-slug" }
```
Increments the view count for a blog post. Auto-creates the record if it doesn't exist.

**Features:**
- Server-side deduplication prevents race conditions
- Auto-creates Airtable records for new blogs
- Returns updated count immediately

**Response:**
```json
{
  "slug": "your-blog-slug",
  "view_count": 43,
  "total_views": 143,
  "record_id": "recXXXXXXXXXX",
  "auto_created": false,
  "message": "View count incremented successfully"
}
```

#### 3. Get All Counts
```
GET /api/get-all-counts
```
Returns view counts for all blog posts, sorted by total views (descending).

**Response:**
```json
{
  "posts": [
    {
      "slug": "popular-post",
      "title": "Most Popular Post",
      "total_views": 1500
    },
    ...
  ],
  "total": 42
}
```

#### 4. Test Environment Variables
```
GET /api/test-env
```
Displays configured environment variables (sanitized). Useful for verifying setup.

## Setup

### 1. Airtable Setup

Create an Airtable base with a table containing these fields:
- `slug` (Single line text) - Blog post slug/URL
- `title` (Single line text) - Blog post title
- `view_count` (Number) - Current view count
- `old_views` (Number) - Views from previous system (optional)
- `total_views` (Formula) - `{view_count} + {old_views}`

### 2. Environment Variables

Configure these in Vercel:

**Required:**
- `AIRTABLE_API_KEY` - Your Airtable API key
- `AIRTABLE_BASE_ID` - Your Airtable base ID
- `AIRTABLE_TABLE_NAME` - Your table name (e.g., "Blog Posts")

### 3. Local Development

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Fill in your credentials
4. Install dependencies: `npm install`
5. Run locally: `vercel dev`

### 4. Deploy to Vercel

1. Connect your GitHub repo to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy: `vercel --prod`

## Customization

All API endpoints have `TODO` comments marking where you can customize:
- Airtable field names
- Response format
- Additional features

Look for `// TODO:` comments in the code.

## Usage in Webflow

Add this script to your Webflow blog post template:

```javascript
<script>
// Increment view count when page loads
fetch('https://your-vercel-url/api/increment-count', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slug: 'your-blog-slug' })
})
.then(res => res.json())
.then(data => {
  console.log('Views:', data.view_count);
  // Display view count in your page
  document.getElementById('view-count').textContent = data.view_count;
})
.catch(err => console.error('Error:', err));
</script>
```

## Deployment

Live at: https://memberstack-blog-count.vercel.app/

GitHub: https://github.com/AmanPotenz/memberstack-blog-count
