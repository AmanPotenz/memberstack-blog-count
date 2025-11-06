const Airtable = require('airtable');

module.exports = async (req, res) => {
  // Enable CORS - allows requests from any domain (Webflow sites)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    // TODO: Configure your Airtable credentials in Vercel environment variables
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    // TODO: Update AIRTABLE_TABLE_NAME to match your table name (e.g., "Blog Posts")
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: `{slug} = '${slug}'`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return res.status(404).json({
        error: 'Blog post not found',
        view_count: 0
      });
    }

    const record = records[0];
    // TODO: Update field names to match your Airtable schema
    const viewCount = record.get('view_count') || 0;
    const totalViews = record.get('total_views') || viewCount;
    const title = record.get('title') || '';

    return res.status(200).json({
      slug: slug,
      view_count: viewCount,
      total_views: totalViews,
      title: title,
      record_id: record.id
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch view count',
      details: error.message
    });
  }
};
