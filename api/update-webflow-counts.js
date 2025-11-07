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
    console.log('[UPDATE-COUNTS] Starting Airtable to Webflow counts sync...');

    // ============================================
    // Step 1: Fetch all records from Airtable
    // ============================================
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const airtableRecords = await base(process.env.AIRTABLE_TABLE_NAME)
      .select()
      .all();

    console.log(`[UPDATE-COUNTS] Found ${airtableRecords.length} records in Airtable`);

    // Field mapping: Views = old views, view_count = new views, total_views = Views + view_count
    const airtableData = {};
    airtableRecords.forEach(record => {
      const slug = record.get('slug');
      if (slug) {
        airtableData[slug] = {
          old_views: record.get('Views') || 0,  // Your existing "Views" field
          view_count: record.get('view_count') || 0,
          total_views: record.get('total_views') || 0
        };
      }
    });

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

    console.log(`[UPDATE-COUNTS] Found ${webflowItems.length} items in Webflow CMS`);

    // ============================================
    // Step 3: Update each item individually
    // ============================================
    const updated = [];
    const errors = [];
    const notInAirtable = [];

    for (const item of webflowItems) {
      const slug = item.fieldData?.slug;
      if (!slug) continue;

      if (airtableData[slug]) {
        try {
          const airtableTotal = airtableData[slug].total_views;
          const currentTotal = item.fieldData['total-views'] || 0;

          console.log(`[UPDATE-COUNTS] Updating ${slug}: ${currentTotal} → ${airtableTotal}`);

          // TODO: Update Webflow field names to match your collection schema
          const updateResponse = await fetch(
            `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${item.id}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                'accept': 'application/json',
                'content-type': 'application/json'
              },
              body: JSON.stringify({
                fieldData: {
                  'total-views': airtableTotal
                }
              })
            }
          );

          if (updateResponse.ok) {
            updated.push({
              slug: slug,
              updated_from: currentTotal,
              updated_to: airtableTotal
            });
            console.log(`[UPDATE-COUNTS] ✅ Updated ${slug}`);
          } else {
            const errorData = await updateResponse.json();
            errors.push({
              slug: slug,
              error: errorData
            });
            console.log(`[UPDATE-COUNTS] ❌ Failed to update ${slug}:`, errorData);
          }

          // Rate limiting: Wait 200ms between requests
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          errors.push({
            slug: slug,
            error: error.message
          });
          console.error(`[UPDATE-COUNTS] Error updating ${slug}:`, error);
        }
      } else {
        notInAirtable.push(slug);
      }
    }

    console.log(`[UPDATE-COUNTS] Updated: ${updated.length}, Errors: ${errors.length}, Not in Airtable: ${notInAirtable.length}`);

    // ============================================
    // Step 4: Publish the site
    // ============================================
    let publishStatus = 'skipped';

    if (updated.length > 0) {
      try {
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
            console.log(`[UPDATE-COUNTS] Publishing site: ${siteId}`);

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
              console.log('[UPDATE-COUNTS] ✅ Site published successfully');
            } else {
              const publishError = await publishResponse.json();
              publishStatus = `failed: ${publishError.message}`;
              console.log('[UPDATE-COUNTS] ❌ Failed to publish:', publishError);
            }
          }
        }
      } catch (publishError) {
        publishStatus = `error: ${publishError.message}`;
        console.error('[UPDATE-COUNTS] Error publishing site:', publishError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Counts updated: ${updated.length} updated, ${errors.length} errors`,
      published: publishStatus,
      updated: updated,
      errors: errors,
      not_in_airtable: notInAirtable,
      stats: {
        total_airtable: Object.keys(airtableData).length,
        total_webflow: webflowItems.length,
        updated_count: updated.length,
        error_count: errors.length,
        not_in_airtable_count: notInAirtable.length
      }
    });

  } catch (error) {
    console.error('[UPDATE-COUNTS] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Update counts failed',
      details: error.message
    });
  }
};
