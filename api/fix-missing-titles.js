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
    console.log('[FIX] Starting title fix process...');

    // ============================================
    // Step 1: Get all Webflow blogs with titles
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

    console.log(`[FIX] Found ${webflowItems.length} items in Webflow CMS`);

    // Create a map of slug -> title from Webflow
    // TODO: Update field mappings to match your Webflow collection
    const webflowTitles = new Map();
    webflowItems.forEach(item => {
      const slug = item.fieldData?.slug || item.slug;
      const title = item.fieldData?.name || item.name;
      if (slug && title) {
        webflowTitles.set(slug, title);
      }
    });

    // ============================================
    // Step 2: Get all Airtable records
    // ============================================
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const airtableRecords = await base(process.env.AIRTABLE_TABLE_NAME)
      .select()
      .all();

    console.log(`[FIX] Found ${airtableRecords.length} records in Airtable`);

    // ============================================
    // Step 3: Find records with missing/empty titles
    // ============================================
    const recordsToFix = [];

    airtableRecords.forEach(record => {
      const slug = record.get('slug');
      const currentTitle = record.get('title');

      // Skip if no slug or already has a title
      if (!slug) {
        console.log(`[FIX] Skipping record with no slug: ${record.id}`);
        return;
      }

      if (currentTitle && currentTitle.trim() !== '') {
        return; // Already has title
      }

      // Check if we have a title from Webflow
      const webflowTitle = webflowTitles.get(slug);
      if (webflowTitle) {
        recordsToFix.push({
          id: record.id,
          slug: slug,
          newTitle: webflowTitle
        });
      } else {
        console.log(`[FIX] No Webflow title found for slug: ${slug}`);
      }
    });

    console.log(`[FIX] Found ${recordsToFix.length} records to fix`);

    if (recordsToFix.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No records need title updates',
        fixed: 0,
        total_checked: airtableRecords.length
      });
    }

    // ============================================
    // Step 4: Update records in batches
    // ============================================
    const updated = [];
    const errors = [];

    // Airtable allows batch updates up to 10 records at a time
    const batchSize = 10;

    for (let i = 0; i < recordsToFix.length; i += batchSize) {
      const batch = recordsToFix.slice(i, i + batchSize);

      try {
        console.log(`[FIX] Updating batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);

        const recordsToUpdate = batch.map(item => ({
          id: item.id,
          fields: {
            title: item.newTitle
          }
        }));

        const updatedRecords = await base(process.env.AIRTABLE_TABLE_NAME).update(recordsToUpdate);

        updatedRecords.forEach((record, index) => {
          updated.push({
            slug: batch[index].slug,
            title: batch[index].newTitle,
            record_id: record.id
          });
          console.log(`[FIX] ✅ Updated: ${batch[index].slug} -> "${batch[index].newTitle}"`);
        });

        // Rate limiting: Wait 200ms between batches
        if (i + batchSize < recordsToFix.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error(`[FIX] Error updating batch:`, error);
        batch.forEach(item => {
          errors.push({
            slug: item.slug,
            error: error.message
          });
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Title fix completed: ${updated.length} updated, ${errors.length} errors`,
      updated: updated,
      errors: errors,
      stats: {
        total_checked: airtableRecords.length,
        needed_fix: recordsToFix.length,
        updated_count: updated.length,
        error_count: errors.length
      }
    });

  } catch (error) {
    console.error('[FIX] Fatal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Title fix failed',
      details: error.message
    });
  }
};
