(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const API_URL = 'https://memberstack-blog-count.vercel.app';
    const DEBUG = true; // Enable detailed logging

    console.log('🔵 [ViewCounter] Script loaded');
    console.log('🔵 [ViewCounter] Current URL:', window.location.href);
    console.log('🔵 [ViewCounter] Current path:', window.location.pathname);

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Extract blog slug from current URL
     */
    function getBlogSlugFromURL() {
        const path = window.location.pathname;
        const match = path.match(/\/blog\/([^\/\?#]+)/);
        const slug = match ? match[1] : null;
        console.log('🔍 [ViewCounter] Extracted slug:', slug);
        return slug;
    }

    /**
     * Check if we're on a blog post page
     */
    function isOnBlogPost() {
        const path = window.location.pathname;
        const isBlogPost = /^\/blog\/[^\/]+\/?$/.test(path);
        console.log('🔍 [ViewCounter] Is blog post?', isBlogPost, 'Path:', path);
        return isBlogPost;
    }

    /**
     * Check if we're on a blog list page
     */
    function isOnBlogListPage() {
        const path = window.location.pathname;
        const isBlogList = path === '/' || path === '/blog' || path === '/blog/';
        console.log('🔍 [ViewCounter] Is blog list?', isBlogList, 'Path:', path);
        return isBlogList;
    }

    /**
     * Check if already viewed in session
     */
    function hasViewedInSession(slug) {
        const viewed = sessionStorage.getItem(`blog-visited-${slug}`) === '1';
        console.log('💾 [ViewCounter] Already viewed?', viewed, 'Slug:', slug);
        return viewed;
    }

    /**
     * Mark as viewed
     */
    function markAsViewed(slug) {
        sessionStorage.setItem(`blog-visited-${slug}`, '1');
        console.log('✅ [ViewCounter] Marked as viewed:', slug);
    }

    // ============================================
    // API FUNCTIONS
    // ============================================

    /**
     * Increment view count
     */
    async function incrementViewCount(slug) {
        try {
            console.log('📤 [ViewCounter] Sending increment request for:', slug);

            const response = await fetch(`${API_URL}/api/increment-count`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug })
            });

            const data = await response.json();
            console.log('📥 [ViewCounter] Increment response:', data);

            if (!response.ok) {
                console.error('❌ [ViewCounter] API error:', response.status);
                return null;
            }

            return data.total_views || 0;
        } catch (error) {
            console.error('❌ [ViewCounter] Increment error:', error);
            return null;
        }
    }

    /**
     * Get view count for specific blog
     */
    async function getViewCount(slug) {
        try {
            console.log('📤 [ViewCounter] Fetching count for:', slug);

            const response = await fetch(`${API_URL}/api/get-count?slug=${slug}`);
            const data = await response.json();

            console.log('📥 [ViewCounter] Get count response:', data);
            return data.total_views || 0;
        } catch (error) {
            console.error('❌ [ViewCounter] Get count error:', error);
            return 0;
        }
    }

    /**
     * Get all view counts
     */
    async function getAllViewCounts() {
        try {
            console.log('📤 [ViewCounter] Fetching all counts');

            const response = await fetch(`${API_URL}/api/get-all-counts`);
            const data = await response.json();

            console.log('📥 [ViewCounter] All counts response:', data.posts ? data.posts.length : 0, 'posts');
            return data.posts || [];
        } catch (error) {
            console.error('❌ [ViewCounter] Get all counts error:', error);
            return [];
        }
    }

    // ============================================
    // DISPLAY FUNCTIONS
    // ============================================

    /**
     * Show loading state for blog post page
     */
    function showLoadingState() {
        const selectors = [
            '[data-view-count]',
            '[data-read-count]',
            '.view-count',
            '.views-count',
            '#view-count'
        ];

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.opacity = '0.5';
                element.textContent = '...';
                console.log('⏳ [ViewCounter] Set loading state for:', element);
            });
        });
    }

    /**
     * Display view count on blog post page
     */
    function displayViewCountOnBlogPage(count) {
        console.log('🎨 [ViewCounter] Displaying count on blog page:', count);

        // Find ALL possible elements that should show the count
        const selectors = [
            '[data-view-count]',
            '[data-read-count]',
            '.view-count',
            '.views-count',
            '#view-count'
        ];

        let elementsFound = 0;

        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            console.log(`🔎 [ViewCounter] Found ${elements.length} elements for selector: ${selector}`);

            elements.forEach(element => {
                const useReadsFormat = element.hasAttribute('data-read-count');
                element.textContent = useReadsFormat ? `${count} reads` : count.toLocaleString();
                element.style.opacity = '1';
                console.log('✏️ [ViewCounter] Updated element:', element, 'with count:', count);
                elementsFound++;
            });
        });

        if (elementsFound === 0) {
            console.warn('⚠️ [ViewCounter] NO ELEMENTS FOUND to display view count!');
            console.warn('⚠️ [ViewCounter] Add data-view-count attribute to your HTML elements');
        } else {
            console.log(`✅ [ViewCounter] Updated ${elementsFound} element(s) with count: ${count}`);
        }
    }

    /**
     * Show loading state for homepage badges
     */
    function showLoadingStateHomepage() {
        const badges = document.querySelectorAll('[data-view-count], [data-read-count]');
        console.log(`⏳ [ViewCounter] Setting loading state for ${badges.length} badges`);
        badges.forEach(badge => {
            badge.style.opacity = '0.5';
            badge.textContent = '...';
        });
    }

    /**
     * Display view counts on homepage/blog list
     */
    function displayViewCountsOnHomepage(posts) {
        console.log('🎨 [ViewCounter] Displaying counts for', posts.length, 'posts');

        if (posts.length === 0) {
            console.warn('⚠️ [ViewCounter] No posts data to display');
            return;
        }

        // Create lookup map
        const postsMap = new Map(posts.map(p => [p.slug, p.total_views || 0]));
        console.log('📊 [ViewCounter] Posts map:', Array.from(postsMap.entries()).slice(0, 5));

        const badges = document.querySelectorAll('[data-view-count], [data-read-count]');
        console.log(`🔎 [ViewCounter] Found ${badges.length} badges on page`);

        let updatedCount = 0;

        badges.forEach((badge, index) => {
            console.log(`🔍 [ViewCounter] Processing badge ${index + 1}`);

            let slug = null;
            const card = badge.closest('.w-dyn-item') || badge.closest('[data-blog-slug]');

            // PRIORITY 1: Extract from blog post link (most reliable)
            const link = badge.closest('a[href*="/blog/"]') ||
                        (card && card.querySelector('a[href*="/blog/"]')) ||
                        badge.querySelector('a[href*="/blog/"]');

            if (link) {
                const href = link.getAttribute('href');
                const match = href.match(/\/blog\/([^\/\?#]+)/);
                if (match) {
                    slug = match[1];
                    console.log(`  ✓ Found slug from link:`, slug);
                }
            }

            // PRIORITY 2: Check data-blog-slug attribute (only if valid)
            if (!slug && card && card.hasAttribute('data-blog-slug')) {
                const attrSlug = card.getAttribute('data-blog-slug');
                // Ignore placeholder values
                if (attrSlug && attrSlug !== 'post-slug-here' && attrSlug !== 'slug') {
                    slug = attrSlug;
                    console.log(`  ✓ Found slug from data-blog-slug:`, slug);
                } else {
                    console.log(`  ⚠️ Ignoring placeholder data-blog-slug:`, attrSlug);
                }
            }

            if (!slug) {
                console.warn(`  ⚠️ Could not find slug for badge`, badge);
                return;
            }

            const count = postsMap.get(slug);

            if (count === undefined) {
                console.warn(`  ⚠️ No count data for slug:`, slug);
                return;
            }

            const useReadsFormat = badge.hasAttribute('data-read-count');
            badge.textContent = useReadsFormat ? `${count} reads` : count.toLocaleString();
            badge.style.opacity = '1';

            console.log(`  ✅ Updated badge for ${slug}: ${count}`);
            updatedCount++;
        });

        console.log(`✅ [ViewCounter] Updated ${updatedCount} of ${badges.length} badges`);

        if (updatedCount === 0 && badges.length > 0) {
            console.warn('⚠️ [ViewCounter] Badges found but none updated - check slug matching!');
        }
    }

    // ============================================
    // PAGE HANDLERS
    // ============================================

    /**
     * Handle blog post page
     */
    async function handleBlogPost() {
        const slug = getBlogSlugFromURL();
        if (!slug) {
            console.warn('⚠️ [ViewCounter] No slug found, exiting');
            return;
        }

        console.log(`📄 [ViewCounter] Handling blog post: ${slug}`);

        // Show loading state immediately
        showLoadingState();

        if (hasViewedInSession(slug)) {
            console.log('🔄 [ViewCounter] Already viewed, just fetching count');
            const count = await getViewCount(slug);
            displayViewCountOnBlogPage(count);
        } else {
            console.log('🆕 [ViewCounter] First visit, incrementing count');
            const newCount = await incrementViewCount(slug);

            if (newCount !== null) {
                displayViewCountOnBlogPage(newCount);
                markAsViewed(slug);
            } else {
                console.error('❌ [ViewCounter] Failed to increment, will retry next time');
            }
        }
    }

    /**
     * Handle homepage/blog list
     */
    async function handleHomepage() {
        console.log('📋 [ViewCounter] Handling blog list page');

        // Show loading state immediately
        showLoadingStateHomepage();

        const posts = await getAllViewCounts();

        if (posts && posts.length > 0) {
            displayViewCountsOnHomepage(posts);
        } else {
            console.warn('⚠️ [ViewCounter] No posts received from API');
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Main init function
     */
    async function init() {
        console.log('🚀 [ViewCounter] Initializing...');
        console.log('🚀 [ViewCounter] URL:', window.location.href);
        console.log('🚀 [ViewCounter] Pathname:', window.location.pathname);

        const isBlog = isOnBlogPost();
        const isList = isOnBlogListPage();

        console.log('🚀 [ViewCounter] isBlogPost:', isBlog);
        console.log('🚀 [ViewCounter] isOnBlogListPage:', isList);

        if (isBlog) {
            console.log('✓ Detected: Blog Post Page');
            await handleBlogPost();
        } else if (isList) {
            console.log('✓ Detected: Blog List Page');
            await handleHomepage();
        } else {
            console.log('ℹ️ Not a blog page, skipping');
            console.log('ℹ️ Current path:', window.location.pathname);
        }

        console.log('🏁 [ViewCounter] Initialization complete');
    }

    // Expose test functions for manual debugging
    window.testViewCounter = async function() {
        console.log('=== Manual Test ===');
        console.log('Current URL:', window.location.href);
        console.log('Is Blog Post?', isOnBlogPost());
        console.log('Is Blog List?', isOnBlogListPage());

        const slug = getBlogSlugFromURL();
        console.log('Extracted Slug:', slug);

        if (slug) {
            console.log('Has viewed in session?', hasViewedInSession(slug));
            console.log('Attempting to increment...');
            const result = await incrementViewCount(slug);
            console.log('Increment result:', result);
        }
    };

    // Clear session storage to test increments
    window.clearViewCounter = function() {
        const keys = Object.keys(sessionStorage).filter(k => k.startsWith('blog-visited-'));
        console.log('Clearing', keys.length, 'session storage entries');
        keys.forEach(key => sessionStorage.removeItem(key));
        console.log('✅ Session storage cleared. Refresh page to test increment.');
    };

    // Show all stored sessions
    window.showViewCounterSessions = function() {
        const keys = Object.keys(sessionStorage).filter(k => k.startsWith('blog-visited-'));
        console.log('📦 Stored sessions:', keys.length);
        keys.forEach(key => {
            console.log('  -', key.replace('blog-visited-', ''), ':', sessionStorage.getItem(key));
        });
    };

    // Run on page load
    if (document.readyState === 'loading') {
        console.log('⏳ [ViewCounter] Waiting for DOM...');
        document.addEventListener('DOMContentLoaded', init);
    } else {
        console.log('⚡ [ViewCounter] DOM ready, running now');
        init();
    }

})();
