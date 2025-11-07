const Airtable = require('airtable');

// SERVER-SIDE DEDUPLICATION: Prevents race conditions when multiple requests arrive simultaneously
const pendingRequests = new Map();

// ============================================
// AUTO-SYNC TO WEBFLOW HELPER FUNCTION
// ============================================
async function updateWebflowCount(slug, totalViews) {
  try {
    // Find the blog post in Webflow by slug
    const searchResponse = await fetch(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items?fieldData.slug=${slug}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    if (!searchResponse.ok) {
      console.log('[AUTO-SYNC] Webflow search failed:', await searchResponse.text());
      return;
    }

    const searchData = await searchResponse.json();
    const items = searchData.items || [];

    if (items.length === 0) {
      console.log(`[AUTO-SYNC] Blog not found in Webflow: ${slug}`);
      return;
    }

    const webflowItem = items[0];
    const currentCount = webflowItem.fieldData['total-views'] || 0;

    console.log(`[AUTO-SYNC] Updating Webflow: ${slug} (${currentCount} → ${totalViews})`);

    // Update the item
    const updateResponse = await fetch(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items/${webflowItem.id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          fieldData: {
            'total-views': totalViews
          }
        })
      }
    );

    if (updateResponse.ok) {
      console.log(`[AUTO-SYNC] ✅ Successfully updated Webflow for ${slug}`);
    } else {
      const error = await updateResponse.json();
      console.log(`[AUTO-SYNC] ❌ Failed to update Webflow:`, error);
    }

  } catch (error) {
    console.error('[AUTO-SYNC] Error updating Webflow:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // Enable CORS - allows requests from any domain (Webflow sites)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.body;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  // ============================================
  // SERVER-SIDE DEDUPLICATION
  // ============================================
  // Check if a request for this slug is already being processed
  if (pendingRequests.has(slug)) {
    console.log(`[DEDUP] Request already in-flight for "${slug}", waiting...`);
    try {
      // Wait for the existing request to complete and return its result
      const result = await pendingRequests.get(slug);
      return res.status(200).json(result);
    } catch (error) {
      console.error(`[DEDUP] Error waiting for pending request:`, error);
      return res.status(500).json({
        error: 'Failed to process duplicate request',
        details: error.message
      });
    }
  }

  // Create a new promise for this request
  const requestPromise = (async () => {
    try {
      // TODO: Configure your Airtable credentials in Vercel environment variables
      const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
        .base(process.env.AIRTABLE_BASE_ID);

      // Find the record
      // TODO: Update AIRTABLE_TABLE_NAME to match your table name
      const records = await base(process.env.AIRTABLE_TABLE_NAME)
        .select({
          filterByFormula: `{slug} = '${slug}'`,
          maxRecords: 1
        })
        .firstPage();

      let recordId;
      let newCount;
      let wasCreated = false;

      if (records.length === 0) {
        // Record doesn't exist - CREATE IT AUTOMATICALLY!
        console.log(`[AUTO-CREATE] Creating new record for slug: ${slug}`);

        // Try to fetch the title from Webflow CMS (OPTIONAL)
        let blogTitle = slug; // Default to slug if we can't get title

        // TODO: If you have Webflow integration, uncomment and configure this section
        /*
        try {
          const webflowResponse = await fetch(
            `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}/items?fieldData.slug=${slug}`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
                'accept': 'application/json'
              }
            }
          );

          if (webflowResponse.ok) {
            const webflowData = await webflowResponse.json();
            if (webflowData.items && webflowData.items.length > 0) {
              blogTitle = webflowData.items[0].fieldData?.name || slug;
              console.log(`[AUTO-CREATE] Found blog title in Webflow: "${blogTitle}"`);
            }
          }
        } catch (error) {
          console.warn(`[AUTO-CREATE] Could not fetch title from Webflow: ${error.message}`);
        }
        */

        // Field mapping: Views = old views, view_count = new views
        const newRecords = await base(process.env.AIRTABLE_TABLE_NAME).create([
          {
            fields: {
              slug: slug,
              title: blogTitle,
              view_count: 1,
              Views: 0  // Your existing "Views" field (old views for new posts)
            }
          }
        ]);
        recordId = newRecords[0].id;
        newCount = 1;
        wasCreated = true;

        console.log(`[AUTO-CREATE] Successfully created record with title: "${blogTitle}", view_count: 1`);
      } else {
        // Record exists - UPDATE IT
        const record = records[0];
        const currentCount = record.get('view_count') || 0;
        newCount = currentCount + 1;

        await base(process.env.AIRTABLE_TABLE_NAME).update([
          {
            id: record.id,
            fields: {
              view_count: newCount
            }
          }
        ]);
        recordId = record.id;

        console.log(`[UPDATE] Incremented view count from ${currentCount} to ${newCount}`);
      }

      // Fetch the updated record to get total_views
      const updatedRecords = await base(process.env.AIRTABLE_TABLE_NAME)
        .select({
          filterByFormula: `{slug} = '${slug}'`,
          maxRecords: 1
        })
        .firstPage();

      const updatedRecord = updatedRecords[0];
      const totalViews = updatedRecord.get('total_views') || newCount;

      // ============================================
      // AUTO-SYNC TO WEBFLOW (Background)
      // ============================================
      // Update Webflow in the background without blocking the response
      if (process.env.WEBFLOW_API_TOKEN && process.env.WEBFLOW_COLLECTION_ID) {
        updateWebflowCount(slug, totalViews).catch(err => {
          console.error('[AUTO-SYNC] Failed to update Webflow:', err.message);
          // Don't fail the request if Webflow update fails
        });
      }

      return {
        slug: slug,
        view_count: newCount,
        total_views: totalViews,
        record_id: recordId,
        auto_created: wasCreated,
        message: 'View count incremented successfully'
      };

    } finally {
      // Always remove from pending requests when done
      pendingRequests.delete(slug);
    }
  })();

  // Store the promise so duplicate requests can wait for it
  pendingRequests.set(slug, requestPromise);

  try {
    const result = await requestPromise;
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to increment view count',
      details: error.message
    });
  }
};
