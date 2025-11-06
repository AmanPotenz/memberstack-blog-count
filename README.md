# Memberstack Blog Count

Blog view counter API using Airtable and Vercel, designed to work with Webflow and Memberstack.

## Features

- **View Tracking**: Track blog post view counts in Airtable with auto-record creation
- **Webflow Integration**: Bi-directional sync between Webflow CMS and Airtable
- **Auto-sync**: Webhook support for automatic synchronization from Webflow
- **Deduplication**: Server-side request deduplication to prevent race conditions
- **Auto-publish**: Automatically publish Webflow site after content changes
- **Title Management**: Automatically fetch and update blog titles from Webflow
- **CORS-enabled**: Works seamlessly with Webflow and other web platforms
- **Testing Tools**: Built-in endpoints for debugging and configuration validation
- **Batch Operations**: Efficient batch processing for syncing large datasets

## API Endpoints

### View Counter APIs

#### 1. Get View Count
```
GET /api/get-count?slug=your-blog-slug
```
Returns the view count for a specific blog post.

#### 2. Increment View Count
```
POST /api/increment-count
Body: { "slug": "your-blog-slug" }
```
Increments the view count for a blog post. Auto-creates the record if it doesn't exist.

#### 3. Get All Counts
```
GET /api/get-all-counts
```
Returns view counts for all blog posts, sorted by total views.

### Webflow Sync APIs

#### 4. Sync from Webflow to Airtable
```
POST /api/sync-from-webflow
```
Syncs blog posts from Webflow CMS to Airtable. Creates missing records automatically. Includes webhook support and server-side deduplication.

#### 5. Sync from Airtable to Webflow
```
POST /api/sync-to-webflow
```
Syncs blog posts from Airtable to Webflow CMS. Creates missing blog entries and publishes the site.

#### 6. Update Webflow Counts
```
POST /api/update-webflow-counts
```
Updates view counts in Webflow CMS from Airtable data. Publishes site after updates.

#### 7. Fix Missing Titles
```
POST /api/fix-missing-titles
```
Fetches missing blog titles from Webflow and updates Airtable records.

### Utility APIs

#### 8. Get Site ID
```
GET /api/get-site-id
```
Returns the Webflow site ID from your collection. Useful for configuration.

#### 9. Publish Site
```
POST /api/publish-site
```
Manually publishes your Webflow site.

#### 10. Check Webflow Schema
```
GET /api/check-webflow-schema
```
Returns the schema/fields of your Webflow collection. Helps verify field names.

#### 11. Test Webflow Auth
```
GET /api/test-webflow-auth
```
Tests Webflow API authentication and permissions. Useful for debugging.

#### 12. Test Environment Variables
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

**Optional (for Webflow integration):**
- `WEBFLOW_API_TOKEN` - Webflow API token
- `WEBFLOW_COLLECTION_ID` - Webflow collection ID
- `WEBFLOW_SITE_ID` - Webflow site ID

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
- Webflow integration
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
