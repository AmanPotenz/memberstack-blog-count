const Airtable = require('airtable');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[SYNC] Starting Airtable to Webflow sync...');

    // ============================================
    // Step 1: Fetch all records from Airtable
    // ============================================
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const airtableRecords = await base(process.env.AIRTABLE_TABLE_NAME)
      .select()
      .all();

    console.log(`[SYNC] Found ${airtableRecords.length} records in Airtable`);

    // TODO: Update field names to match your Airtable schema
    const airtableData = airtableRecords.map(record => ({
      slug: record.get('slug'),
      title: record.get('title') || record.get('slug'), // Fallback to slug if no title
      old_views: record.get('old_views') || 0,
      view_count: record.get('view_count') || 0,
      total_views: record.get('total_views') || 0
    }));

    // ============================================
    // Step 2: Fetch all items from Webflow CMS
    // ============================================
    const webflowResponse = await fetch(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    if (!webflowResponse.ok) {
      const errorData = await webflowResponse.json();
      throw new Error(`Webflow API error: ${JSON.stringify(errorData)}`);
    }

    const webflowData = await webflowResponse.json();
    const webflowItems = webflowData.items || [];

    console.log(`[SYNC] Found ${webflowItems.length} items in Webflow CMS`);

    // Extract slugs from Webflow (they might be in fieldData.slug or just slug)
    const webflowSlugs = new Set(
      webflowItems.map(item => item.fieldData?.slug || item.slug).filter(Boolean)
    );

    // ============================================
    // Step 3: Find missing blogs in Webflow
    // ============================================
    const missingBlogs = airtableData.filter(record => {
      return record.slug && !webflowSlugs.has(record.slug);
    });

    console.log(`[SYNC] Found ${missingBlogs.length} blogs missing in Webflow`);

    if (missingBlogs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All blogs already exist in Webflow',
        synced: 0,
        total_airtable: airtableData.length,
        total_webflow: webflowItems.length
      });
    }

    // ============================================
    // Step 4: Create missing blogs in Webflow
    // ============================================
    const created = [];
    const errors = [];

    for (const blog of missingBlogs) {
      try {
        console.log(`[SYNC] Creating blog in Webflow: ${blog.slug}`);

        // TODO: Update Webflow field names to match your collection schema
        const createResponse = await fetch(
          `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
              'accept': 'application/json',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              fieldData: {
                name: blog.title,           // Main title field (required by Webflow)
                slug: blog.slug,            // URL slug
                'total-views': blog.total_views,  // Custom field for total views
                'old-views': blog.old_views       // Custom field for old views
              }
            })
          }
        );

        if (createResponse.ok) {
          const createdItem = await createResponse.json();
          created.push({
            slug: blog.slug,
            title: blog.title,
            webflow_id: createdItem.id
          });
          console.log(`[SYNC] ✅ Created: ${blog.slug}`);
        } else {
          const errorData = await createResponse.json();
          errors.push({
            slug: blog.slug,
            error: errorData
          });
          console.log(`[SYNC] ❌ Failed to create: ${blog.slug}`, errorData);
        }

        // Rate limiting: Wait 200ms between requests to avoid hitting Webflow limits
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errors.push({
          slug: blog.slug,
          error: error.message
        });
        console.error(`[SYNC] Error creating ${blog.slug}:`, error);
      }
    }

    // ============================================
    // Step 5: Publish the site
    // ============================================
    let publishStatus = 'skipped';

    // Only publish if we created new items
    if (created.length > 0) {
      try {
        // First, get the site ID from the collection
        const collectionResponse = await fetch(
          `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
              'accept': 'application/json'
            }
          }
        );

        if (collectionResponse.ok) {
          const collectionData = await collectionResponse.json();
          const siteId = collectionData.siteId;

          if (siteId) {
            console.log(`[SYNC] Publishing site: ${siteId}`);

            const publishResponse = await fetch(
              `https://api.webflow.com/v2/sites/${siteId}/publish`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                  'accept': 'application/json',
                  'content-type': 'application/json'
                },
                body: JSON.stringify({
                  publishToWebflowSubdomain: true
                })
              }
            );

            if (publishResponse.ok) {
              publishStatus = 'success';
              console.log('[SYNC] ✅ Site published successfully');
            } else {
              const publishError = await publishResponse.json();
              publishStatus = `failed: ${publishError.message}`;
              console.log('[SYNC] ❌ Failed to publish:', publishError);
            }
          } else {
            publishStatus = 'failed: siteId not found';
            console.log('[SYNC] ❌ Could not determine site ID');
          }
        }
      } catch (publishError) {
        publishStatus = `error: ${publishError.message}`;
        console.error('[SYNC] Error publishing site:', publishError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Sync completed: ${created.length} created, ${errors.length} errors`,
      published: publishStatus,
      created: created,
      errors: errors,
      stats: {
        total_airtable: airtableData.length,
        total_webflow: webflowItems.length,
        missing_blogs: missingBlogs.length,
        created_count: created.length,
        error_count: errors.length
      }
    });

  } catch (error) {
    console.error('[SYNC] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Sync failed',
      details: error.message
    });
  }
};
