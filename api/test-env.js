module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  return res.status(200).json({
    message: 'Testing environment variables',
    env_check: {
      AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? `${process.env.AIRTABLE_API_KEY.substring(0, 10)}...` : 'NOT SET',
      AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID || 'NOT SET',
      AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME || 'NOT SET',
      WEBFLOW_API_TOKEN: process.env.WEBFLOW_API_TOKEN ? `${process.env.WEBFLOW_API_TOKEN.substring(0, 10)}...` : 'NOT SET',
      WEBFLOW_SITE_ID: process.env.WEBFLOW_SITE_ID || 'NOT SET',
      WEBFLOW_COLLECTION_ID: process.env.WEBFLOW_COLLECTION_ID || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET',
      VERCEL: process.env.VERCEL || 'NOT SET',
      all_keys: Object.keys(process.env).filter(key =>
        key.includes('AIRTABLE') || key.includes('WEBFLOW')
      )
    }
  });
};
