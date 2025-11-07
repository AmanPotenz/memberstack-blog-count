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

    // Field mapping: Views = old views, view_count = new views, total_views = Views + view_count
    const airtableData = airtableRecords.map(record => ({
      slug: record.get('slug'),
      title: record.get('title') || record.get('slug'), // Fallback to slug if no title
      old_views: record.get('Views') || 0,  // Your existing "Views" field
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

    // Create a map of Webflow items by slug for easy lookup
    const webflowMap = new Map();
    webflowItems.forEach(item => {
      const slug = item.fieldData?.slug || item.slug;
      if (slug) {
        // Store base slug (without random suffix) and the item
        const baseSlug = slug.replace(/-[a-f0-9]{5}$/, ''); // Remove -xxxxx suffix if exists
        if (!webflowMap.has(baseSlug)) {
          webflowMap.set(baseSlug, item);
        }
      }
    });

    // ============================================
    // Step 3: Find blogs to sync (missing or need update)
    // ============================================
    const toCreate = [];
    const toUpdate = [];

    airtableData.forEach(record => {
      if (!record.slug) return;

      const existingItem = webflowMap.get(record.slug);

      if (!existingItem) {
        // Blog doesn't exist in Webflow - create it
        toCreate.push(record);
      } else {
        // Blog exists - update its view count
        toUpdate.push({
          ...record,
          webflow_id: existingItem.id,
          current_views: existingItem.fieldData['total-views'] || 0
        });
      }
    });

    console.log(`[SYNC] To create: ${toCreate.length}, To update: ${toUpdate.length}`);

    if (toCreate.length === 0 && toUpdate.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'All blogs are in sync',
        created: 0,
        updated: 0,
        total_airtable: airtableData.length,
        total_webflow: webflowItems.length
      });
    }

    // ============================================
    // Step 4: Create missing blogs in Webflow
    // ============================================
    const created = [];
    const updated = [];
    const errors = [];

    // Create new blogs
    for (const blog of toCreate) {
      try {
        console.log(`[SYNC] Creating blog in Webflow: ${blog.slug}`);

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
                name: blog.title,
                slug: blog.slug,
                'total-views': blog.total_views
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
            action: 'create',
            error: errorData
          });
          console.log(`[SYNC] ❌ Failed to create: ${blog.slug}`, errorData);
        }

        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errors.push({
          slug: blog.slug,
          action: 'create',
          error: error.message
        });
      }
    }

    // Update existing blogs
    for (const blog of toUpdate) {
      try {
        console.log(`[SYNC] Updating blog in Webflow: ${blog.slug} (${blog.current_views} → ${blog.total_views})`);

        const updateResponse = await fetch(
          `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${blog.webflow_id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
              'accept': 'application/json',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              fieldData: {
                'total-views': blog.total_views
              }
            })
          }
        );

        if (updateResponse.ok) {
          updated.push({
            slug: blog.slug,
            updated_from: blog.current_views,
            updated_to: blog.total_views
          });
          console.log(`[SYNC] ✅ Updated: ${blog.slug}`);
        } else {
          const errorData = await updateResponse.json();
          errors.push({
            slug: blog.slug,
            action: 'update',
            error: errorData
          });
          console.log(`[SYNC] ❌ Failed to update: ${blog.slug}`, errorData);
        }

        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        errors.push({
          slug: blog.slug,
          action: 'update',
          error: error.message
        });
      }
    }

    // ============================================
    // Step 5: Publish the site
    // ============================================
    let publishStatus = 'skipped';

    // Publish if we created or updated items
    if (created.length > 0 || updated.length > 0) {
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
      message: `Sync completed: ${created.length} created, ${updated.length} updated, ${errors.length} errors`,
      published: publishStatus,
      created: created,
      updated: updated,
      errors: errors,
      stats: {
        total_airtable: airtableData.length,
        total_webflow: webflowItems.length,
        to_create: toCreate.length,
        to_update: toUpdate.length,
        created_count: created.length,
        updated_count: updated.length,
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
