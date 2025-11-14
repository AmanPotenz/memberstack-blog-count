/**
 * BROWSER CONSOLE SCRIPT
 * Extract all blog slugs from your Webflow homepage/blog list page
 *
 * HOW TO USE:
 * 1. Open your blog list page in browser (where all 300+ blogs are displayed)
 * 2. Open browser console (F12)
 * 3. Paste this entire script and press Enter
 * 4. Copy the output and paste into init-all-blogs.js
 */

(function() {
  console.log('🔍 Extracting blog slugs from page...');

  // Find all links that point to /blog/
  const blogLinks = document.querySelectorAll('a[href*="/blog/"]');

  const slugs = new Set(); // Use Set to avoid duplicates

  blogLinks.forEach(link => {
    const href = link.getAttribute('href');
    const match = href.match(/\/blog\/([^\/\?#]+)/);

    if (match) {
      const slug = match[1];
      slugs.add(slug);
    }
  });

  const slugArray = Array.from(slugs).sort();

  console.log(`\n✅ Found ${slugArray.length} unique blog slugs:\n`);

  // Format as JavaScript array
  console.log('Copy this array into init-all-blogs.js:\n');
  console.log('const BLOG_SLUGS = [');
  slugArray.forEach(slug => {
    console.log(`  '${slug}',`);
  });
  console.log('];\n');

  // Also output as JSON for easy copying
  console.log('\n📋 JSON format (easier to copy):');
  console.log(JSON.stringify(slugArray, null, 2));

  return slugArray;
})();
