const Airtable = require('airtable');

/**
 * Debug endpoint to see what slugs exist in Airtable
 * Visit: /api/debug-slugs
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);

    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select()
      .all();

    const slugData = records.map(record => ({
      slug: record.get('slug'),
      title: record.get('title'),
      total_views: record.get('total_views') || 0,
      slug_length: record.get('slug')?.length || 0,
      has_special_chars: /[^a-z0-9-]/.test(record.get('slug') || '')
    }));

    // Sort by total_views descending
    slugData.sort((a, b) => b.total_views - a.total_views);

    return res.status(200).json({
      total_records: slugData.length,
      sample_slugs: slugData.slice(0, 20), // First 20
      all_slugs: slugData.map(s => s.slug), // All slugs for easy searching
      stats: {
        with_views: slugData.filter(s => s.total_views > 0).length,
        zero_views: slugData.filter(s => s.total_views === 0).length,
        with_special_chars: slugData.filter(s => s.has_special_chars).length
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch slugs',
      details: error.message
    });
  }
};
