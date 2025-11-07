(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const API_URL = 'https://memberstack-blog-count.vercel.app';

    console.log('[ViewCounter] Script loaded');

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Extract blog slug from current URL
     * Expects URL format: /blog/post-slug
     */
    function getBlogSlugFromURL() {
        const path = window.location.pathname;
        const match = path.match(/\/blog\/([^\/]+)/);
        return match ? match[1] : null;
    }

    /**
     * Check if we're on a blog post page
     */
    function isOnBlogPost() {
        return window.location.pathname.includes('/blog/');
    }

    /**
     * Check if this blog was already viewed in this session
     * Prevents double-counting on same visit
     */
    function hasViewedInSession(slug) {
        return sessionStorage.getItem(`blog-visited-${slug}`) === '1';
    }

    /**
     * Mark blog as viewed in session storage
     */
    function markAsViewed(slug) {
        sessionStorage.setItem(`blog-visited-${slug}`, '1');
    }

    // ============================================
    // API FUNCTIONS
    // ============================================

    /**
     * Increment view count for a blog post
     * This is called ONLY on first view of session
     */
    async function incrementViewCount(slug) {
        try {
            console.log(`[ViewCounter] Incrementing view count for: ${slug}`);

            const response = await fetch(`${API_URL}/api/increment-count`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ slug })
            });

            const data = await response.json();
            console.log(`[ViewCounter] Response:`, data);

            return data.total_views || 0;
        } catch (error) {
            console.error('[ViewCounter] Error incrementing view count:', error);
            return 0;
        }
    }

    /**
     * Get view count for a specific blog post
     * Used when refreshing page or navigating back
     */
    async function getViewCount(slug) {
        try {
            const response = await fetch(`${API_URL}/api/get-count?slug=${slug}`);
            const data = await response.json();
            return data.total_views || 0;
        } catch (error) {
            console.error('[ViewCounter] Error fetching view count:', error);
            return 0;
        }
    }

    /**
     * Get all blog post view counts
     * Used on homepage/blog list pages
     */
    async function getAllViewCounts() {
        try {
            console.log('[ViewCounter] Fetching all view counts');

            const response = await fetch(`${API_URL}/api/get-all-counts`);
            const data = await response.json();

            console.log('[ViewCounter] All counts:', data);

            return data.posts || [];
        } catch (error) {
            console.error('[ViewCounter] Error fetching all counts:', error);
            return [];
        }
    }

    // ============================================
    // DISPLAY FUNCTIONS
    // ============================================

    /**
     * Display view count on individual blog post page
     * Finds all elements with [data-view-count] attribute
     */
    function displayViewCountOnBlogPage(count) {
        const elements = document.querySelectorAll('[data-view-count]');

        elements.forEach(element => {
            element.textContent = count.toLocaleString();
        });
    }

    /**
     * Display view counts on homepage or blog list page
     * Matches blog cards by slug and updates their view count badges
     */
    function displayViewCountsOnHomepage(posts) {
        // Find all badges with data-view-count or data-read-count
        const badges = document.querySelectorAll('[data-view-count], [data-read-count]');

        console.log(`[ViewCounter] Found ${badges.length} badges to update`);

        badges.forEach(badge => {
            // Find parent card with blog slug
            const card = badge.closest('.w-dyn-item') ||
                        badge.closest('[data-blog-slug]');

            if (!card) return;

            const slug = card.getAttribute('data-blog-slug');
            if (!slug) return;

            // Find matching post data
            const post = posts.find(p => p.slug === slug);
            if (!post) return;

            const count = post.total_views ? post.total_views : 0;
            const useReadsFormat = badge.hasAttribute('data-read-count');

            // Update badge text
            badge.textContent = useReadsFormat
                ? `${count} reads`
                : count.toLocaleString();
        });

        // Alternative: Update by finding links
        const allLinks = document.querySelectorAll('a[href*="/blog/"]');

        allLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            const slug = href.split('/').filter(Boolean).pop();
            if (!slug) return;

            const post = posts.find(p => p.slug === slug);
            if (!post) return;

            // Find badge within the card
            const card = link.closest('.blog-card') ||
                        link.closest('[class*="card"]') ||
                        link.closest('.w-dyn-item') ||
                        link.parentElement;

            if (card) {
                const badge = card.querySelector('[data-view-count]') ||
                             card.querySelector('[data-read-count]');

                if (badge) {
                    const useReadsFormat = badge.hasAttribute('data-read-count');
                    badge.textContent = useReadsFormat
                        ? `${post.total_views} reads`
                        : post.total_views.toLocaleString();
                }
            }
        });
    }

    // ============================================
    // PAGE HANDLERS
    // ============================================

    /**
     * Handle blog post page
     * Increment view count on first visit, fetch on subsequent visits
     */
    async function handleBlogPost() {
        const slug = getBlogSlugFromURL();
        if (!slug) return;

        console.log(`[ViewCounter] Blog post detected: ${slug}`);

        if (hasViewedInSession(slug)) {
            console.log(`[ViewCounter] Already viewed in this session, fetching count`);
            const count = await getViewCount(slug);
            displayViewCountOnBlogPage(count);
        } else {
            console.log(`[ViewCounter] First view in session, incrementing count`);
            const newCount = await incrementViewCount(slug);

            if (newCount !== null) {
                displayViewCountOnBlogPage(newCount);
                markAsViewed(slug);
            }
        }
    }

    /**
     * Handle homepage or blog list page
     * Fetch all view counts and display them
     */
    async function handleHomepage() {
        console.log('[ViewCounter] Homepage/blog list detected');

        const posts = await getAllViewCounts();

        if (posts && posts.length > 0) {
            displayViewCountsOnHomepage(posts);
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    /**
     * Main initialization function
     * Determines page type and calls appropriate handler
     */
    async function init() {
        console.log('[ViewCounter] Initializing on:', window.location.pathname);

        if (isOnBlogPost()) {
            await handleBlogPost();
        } else {
            await handleHomepage();
        }
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', function() {
        console.log('[ViewCounter] Navigation detected (back/forward)');
        setTimeout(init, 100);
    });

    // Handle page restoration from cache
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            console.log('[ViewCounter] Page restored from cache');
            init();
        }
    });

    // Refresh homepage counts when tab becomes visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && !isOnBlogPost()) {
            setTimeout(handleHomepage, 100);
        }
    });

})();
