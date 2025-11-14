require('dotenv').config();
const Airtable = require('airtable');

/**
 * One-time script to initialize Airtable with all blog slugs
 * Run this to pre-populate your Airtable with all existing blogs from Webflow
 *
 * Usage:
 * 1. Add all your blog slugs to the BLOG_SLUGS array below
 * 2. Run: node scripts/init-all-blogs.js
 */

// ============================================
// PASTE YOUR BLOG SLUGS HERE
// ============================================
const BLOG_SLUGS = [
  // Example:
  // 'my-first-blog-post',
  // 'another-blog-post',
  // 'third-post',
  // ... add all 300+ slugs here
];

async function initializeBlogs() {
  console.log(`🚀 Starting initialization for ${BLOG_SLUGS.length} blogs...`);

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID);

  // Fetch existing records
  console.log('📥 Fetching existing records from Airtable...');
  const existingRecords = await base(process.env.AIRTABLE_TABLE_NAME)
    .select()
    .all();

  const existingSlugs = new Set(existingRecords.map(r => r.get('slug')));
  console.log(`✅ Found ${existingSlugs.size} existing records in Airtable`);

  // Filter to only new blogs
  const newSlugs = BLOG_SLUGS.filter(slug => !existingSlugs.has(slug));
  console.log(`🆕 Need to create ${newSlugs.length} new records`);

  if (newSlugs.length === 0) {
    console.log('✅ All blogs already exist in Airtable!');
    return;
  }

  // Airtable allows max 10 records per batch
  const batchSize = 10;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < newSlugs.length; i += batchSize) {
    const batch = newSlugs.slice(i, i + batchSize);

    try {
      const recordsToCreate = batch.map(slug => ({
        fields: {
          slug: slug,
          title: slug, // Will be updated later or manually
          view_count: 0,
          Views: 0  // Old views field
        }
      }));

      await base(process.env.AIRTABLE_TABLE_NAME).create(recordsToCreate);
      created += batch.length;
      console.log(`✅ Created ${created}/${newSlugs.length} records`);

      // Rate limiting: wait 200ms between batches
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Error creating batch starting at index ${i}:`, error.message);
      errors += batch.length;
    }
  }

  console.log('\n🎉 Initialization complete!');
  console.log(`   ✅ Created: ${created} records`);
  console.log(`   ❌ Errors: ${errors} records`);
  console.log(`   📊 Total in Airtable: ${existingSlugs.size + created} records`);
}

// Run the script
initializeBlogs().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
