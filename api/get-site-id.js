module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Get collection details which includes the site ID
    // TODO: Configure WEBFLOW_COLLECTION_ID in environment variables
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: 'Failed to fetch collection',
        details: errorData
      });
    }

    const collectionData = await response.json();

    return res.status(200).json({
      site_id: collectionData.siteId,
      collection_name: collectionData.displayName,
      collection_slug: collectionData.slug,
      message: `Update your WEBFLOW_SITE_ID to: ${collectionData.siteId}`
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get site ID',
      details: error.message
    });
  }
};
