module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const results = {
    env_vars: {
      has_token: !!process.env.WEBFLOW_API_TOKEN,
      token_length: process.env.WEBFLOW_API_TOKEN?.length || 0,
      token_preview: process.env.WEBFLOW_API_TOKEN ?
        `${process.env.WEBFLOW_API_TOKEN.substring(0, 10)}...` : 'NOT SET',
      has_site_id: !!process.env.WEBFLOW_SITE_ID,
      site_id: process.env.WEBFLOW_SITE_ID || 'NOT SET',
      has_collection_id: !!process.env.WEBFLOW_COLLECTION_ID,
      collection_id: process.env.WEBFLOW_COLLECTION_ID || 'NOT SET'
    },
    tests: {}
  };

  // Test 1: Check if we can access Webflow API at all
  try {
    const authTest = await fetch('https://api.webflow.com/v2/token/authorized_by', {
      headers: {
        'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
        'accept': 'application/json'
      }
    });

    results.tests.auth_check = {
      status: authTest.status,
      ok: authTest.ok
    };

    if (authTest.ok) {
      const authData = await authTest.json();
      results.tests.auth_check.data = authData;
    } else {
      const errorData = await authTest.json();
      results.tests.auth_check.error = errorData;
    }
  } catch (error) {
    results.tests.auth_check = {
      error: error.message
    };
  }

  // Test 2: Try to get site info
  try {
    const siteTest = await fetch(
      `https://api.webflow.com/v2/sites/${process.env.WEBFLOW_SITE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    results.tests.site_access = {
      status: siteTest.status,
      ok: siteTest.ok
    };

    if (siteTest.ok) {
      const siteData = await siteTest.json();
      results.tests.site_access.data = {
        displayName: siteData.displayName,
        shortName: siteData.shortName,
        id: siteData.id
      };
    } else {
      const errorData = await siteTest.json();
      results.tests.site_access.error = errorData;
    }
  } catch (error) {
    results.tests.site_access = {
      error: error.message
    };
  }

  // Test 3: Try to list all collections in the site
  try {
    const collectionsTest = await fetch(
      `https://api.webflow.com/v2/sites/${process.env.WEBFLOW_SITE_ID}/collections`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    results.tests.collections_list = {
      status: collectionsTest.status,
      ok: collectionsTest.ok
    };

    if (collectionsTest.ok) {
      const collectionsData = await collectionsTest.json();
      results.tests.collections_list.data = collectionsData.collections?.map(c => ({
        id: c.id,
        displayName: c.displayName,
        slug: c.slug
      }));

      // Check if our collection ID exists
      const ourCollection = collectionsData.collections?.find(
        c => c.id === process.env.WEBFLOW_COLLECTION_ID
      );
      results.tests.collections_list.our_collection_found = !!ourCollection;
      if (ourCollection) {
        results.tests.collections_list.our_collection = {
          id: ourCollection.id,
          displayName: ourCollection.displayName,
          slug: ourCollection.slug
        };
      }
    } else {
      const errorData = await collectionsTest.json();
      results.tests.collections_list.error = errorData;
    }
  } catch (error) {
    results.tests.collections_list = {
      error: error.message
    };
  }

  // Test 4: Try to access the specific collection
  try {
    const collectionTest = await fetch(
      `https://api.webflow.com/v2/collections/${process.env.WEBFLOW_COLLECTION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
          'accept': 'application/json'
        }
      }
    );

    results.tests.collection_access = {
      status: collectionTest.status,
      ok: collectionTest.ok
    };

    if (collectionTest.ok) {
      const collectionData = await collectionTest.json();
      results.tests.collection_access.data = {
        displayName: collectionData.displayName,
        slug: collectionData.slug,
        id: collectionData.id,
        fields: collectionData.fields?.map(f => ({
          slug: f.slug,
          displayName: f.displayName,
          type: f.type,
          required: f.required
        }))
      };
    } else {
      const errorData = await collectionTest.json();
      results.tests.collection_access.error = errorData;
    }
  } catch (error) {
    results.tests.collection_access = {
      error: error.message
    };
  }

  return res.status(200).json(results);
};
