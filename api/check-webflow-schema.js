module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get collection details to see available fields
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
        error: 'Failed to fetch Webflow collection',
        details: errorData
      });
    }

    const collectionData = await response.json();

    return res.status(200).json({
      collection_name: collectionData.displayName,
      collection_id: collectionData.id,
      fields: collectionData.fields,
      message: 'Use this information to create the correct fields in Webflow'
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: 'Failed to check Webflow schema',
      details: error.message
    });
  }
};
