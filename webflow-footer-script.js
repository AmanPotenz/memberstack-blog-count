(function () {
  "use strict";
  const API_URL = "https://memberstack-blog-count.vercel.app";

  function getBlogSlugFromURL() {
    const path = window.location.pathname;
    const match = path.match(/\/blog\/([^\/\?#]+)/);
    return match ? match[1] : null;
  }

  function isOnBlogPost() {
    const path = window.location.pathname;
    return /^\/blog\/[^\/]+\/?$/.test(path);
  }

  function isOnBlogListPage() {
    const path = window.location.pathname;
    return path === "/" || path === "/blog" || path === "/blog/";
  }

  function hasViewedInSession(slug) {
    return sessionStorage.getItem(`blog-visited-${slug}`) === "1";
  }

  function markAsViewed(slug) {
    sessionStorage.setItem(`blog-visited-${slug}`, "1");
  }

  async function incrementViewCount(slug) {
    try {
      const response = await fetch(`${API_URL}/api/increment-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();
      if (!response.ok) {
        return null;
      }
      return data.total_views || 0;
    } catch (error) {
      return null;
    }
  }

  async function getViewCount(slug) {
    try {
      const response = await fetch(`${API_URL}/api/get-count?slug=${slug}`);
      const data = await response.json();
      return data.total_views || 0;
    } catch (error) {
      return 0;
    }
  }

  async function getAllViewCounts() {
    try {
      const response = await fetch(`${API_URL}/api/get-all-counts`);
      const data = await response.json();
      return data.posts || [];
    } catch (error) {
      return [];
    }
  }

  function showLoadingState(elements) {
    elements.forEach((element) => {
      element.textContent = "—";
      element.style.opacity = "0.6";
    });
  }

  function displayViewCountOnBlogPage(count) {
    const selectors = [
      "[data-view-count]",
      "[data-read-count]",
      ".view-count",
      ".views-count",
      "#view-count",
    ];
    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        const useReadsFormat = element.hasAttribute("data-read-count");
        element.textContent = useReadsFormat
          ? `${count} reads`
          : count.toLocaleString();
        element.style.opacity = "1";
      });
    });
  }

  function displayViewCountsOnHomepage(posts) {
    const badges = document.querySelectorAll(
      "[data-view-count], [data-read-count]"
    );

    console.log(`[ViewCounter] Found ${badges.length} badges to update`);
    console.log(`[ViewCounter] Received ${posts.length} posts from API`);

    if (posts.length === 0) {
      badges.forEach((badge) => {
        badge.style.opacity = "1";
      });
      return;
    }

    const postsMap = new Map(posts.map((p) => [p.slug, p.total_views || 0]));
    let updatedCount = 0;
    let notFoundCount = 0;

    badges.forEach((badge) => {
      let slug = null;
      const card =
        badge.closest(".w-dyn-item") || badge.closest("[data-blog-slug]");
      const link =
        badge.closest('a[href*="/blog/"]') ||
        (card && card.querySelector('a[href*="/blog/"]')) ||
        badge.querySelector('a[href*="/blog/"]');
      if (link) {
        const href = link.getAttribute("href");
        const match = href.match(/\/blog\/([^\/\?#]+)/);
        if (match) {
          slug = match[1];
        }
      }
      if (!slug && card && card.hasAttribute("data-blog-slug")) {
        const attrSlug = card.getAttribute("data-blog-slug");
        if (attrSlug && attrSlug !== "post-slug-here" && attrSlug !== "slug") {
          slug = attrSlug;
        }
      }

      const count = postsMap.get(slug);
      if (count !== undefined && slug) {
        const useReadsFormat = badge.hasAttribute("data-read-count");
        badge.textContent = useReadsFormat
          ? `${count} reads`
          : count.toLocaleString();
        badge.style.opacity = "1";
        updatedCount++;
      } else {
        if (slug) {
          console.log(`[ViewCounter] No count found for slug: "${slug}"`);
          notFoundCount++;
        }
        badge.style.opacity = "1";
      }
    });

    console.log(`[ViewCounter] Updated ${updatedCount} badges, ${notFoundCount} not found`);
  }

  async function handleBlogPost() {
    const slug = getBlogSlugFromURL();
    if (!slug) return;

    const selectors = [
      "[data-view-count]",
      "[data-read-count]",
      ".view-count",
      ".views-count",
      "#view-count",
    ];
    const elements = [];
    selectors.forEach((selector) => {
      const found = document.querySelectorAll(selector);
      found.forEach((el) => elements.push(el));
    });
    showLoadingState(elements);

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (hasViewedInSession(slug)) {
      const count = await getViewCount(slug);
      displayViewCountOnBlogPage(count);
    } else {
      const newCount = await incrementViewCount(slug);
      if (newCount !== null) {
        displayViewCountOnBlogPage(newCount);
        markAsViewed(slug);
      } else {
        elements.forEach((el) => (el.style.opacity = "1"));
      }
    }
  }

  let isLoadingHomepage = false;
  let hasLoadedHomepage = false;

  async function handleHomepage(force = false) {
    if (isLoadingHomepage) return;

    if (hasLoadedHomepage && !force) return;

    isLoadingHomepage = true;

    try {
      const badges = document.querySelectorAll(
        "[data-view-count], [data-read-count]"
      );
      showLoadingState(badges);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const posts = await getAllViewCounts();
      displayViewCountsOnHomepage(posts);
      hasLoadedHomepage = true;
    } catch (error) {
      const badges = document.querySelectorAll(
        "[data-view-count], [data-read-count]"
      );
      badges.forEach((badge) => {
        badge.style.opacity = "1";
      });
    } finally {
      isLoadingHomepage = false;
    }
  }

  async function init(forceRefresh = false) {
    if (isOnBlogPost()) {
      await handleBlogPost();
    } else if (isOnBlogListPage()) {
      await handleHomepage(forceRefresh);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener("popstate", function () {
    hasLoadedHomepage = false;
    setTimeout(() => init(true), 100);
  });

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      hasLoadedHomepage = false;
      setTimeout(() => init(true), 100);
    }
  });

  let mutationTimeout;
  let retryCount = 0;
  const MAX_RETRIES = 5;

  // Retry logic for dynamic content
  async function initWithRetry() {
    const badges = document.querySelectorAll("[data-view-count], [data-read-count]");

    if (badges.length === 0 && retryCount < MAX_RETRIES) {
      retryCount++;
      setTimeout(initWithRetry, 300);
      return;
    }

    if (isOnBlogListPage()) {
      await handleHomepage();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const observer = new MutationObserver(function (mutations) {
      if (isOnBlogListPage()) {
        clearTimeout(mutationTimeout);
        mutationTimeout = setTimeout(() => {
          handleHomepage(true);
        }, 500);
      }
    });

    if (isOnBlogListPage()) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Initial load with retry
      initWithRetry();
    }
  });
})();
