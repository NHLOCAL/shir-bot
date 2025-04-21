// assets/js/shared-redirect-handler.js

// Dependencies:
// - Global 'baseurl' variable (from Jekyll _config.yml)
// - Functions from core.js: copyToClipboard, showCopiedMessage (assumed global)

/**
 * Handles the submission of the header search form on secondary pages.
 * Prevents default submission and redirects to the homepage search.
 * @param {Event} event - The form submit event.
 */
function handleHeaderSearchRedirect(event) {
    event.preventDefault(); // Prevent default form submission
    const searchForm = event.currentTarget; // Get the form that triggered the event
    const searchInput = searchForm.querySelector('#searchInput');
    const searchInputVal = searchInput ? searchInput.value.trim() : '';
    const activeFilterButton = searchForm.querySelector('.filter-button.active');
    const searchBy = activeFilterButton ? activeFilterButton.dataset.filter : 'all';

    if (searchInputVal) {
        // Construct the redirect URL for the homepage
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
        console.log(`Shared Handler: Redirecting from secondary page (header search) to: ${redirectUrl}`);
        window.location.href = redirectUrl;
    } else {
        searchInput?.focus(); // Focus if empty
    }
}

/**
 * Handles clicks within the results table body on secondary pages.
 * Delegates actions for serial links (copy) and album/singer buttons (redirect).
 * @param {Event} event - The click event.
 */
function handleTableClickActions(event) {
    const target = event.target;
    const row = target.closest('tr');

    // Ensure click is within a relevant row inside a tbody.songs-list
    if (!row || !row.closest('tbody.songs-list')) return;

    // 1. Handle Serial Link Click (Copy share link pointing to homepage search)
    // Check if the target is an 'A' tag and its parent 'TD' is the first cell in the row
    if (target.tagName === 'A' && row.cells.length > 0 && target.closest('td') === row.cells[0]) {
         event.preventDefault();
         event.stopPropagation(); // Prevent triggering other potential row listeners
         const songSerial = target.textContent.trim();
         if (songSerial) {
             // Construct a share link that performs a search on the homepage
             const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
             // Use core.js functions (must be loaded first)
             if (typeof copyToClipboard === 'function' && typeof showCopiedMessage === 'function') {
                 copyToClipboard(shareLink);
                 showCopiedMessage();
             } else {
                  console.warn("Shared Handler: Clipboard functions (copyToClipboard/showCopiedMessage) not found.");
             }
         }
         return; // Stop processing this click event further
    }

    // 2. Handle Album/Singer Button Click (Redirect to Homepage Search)
    if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
        event.preventDefault(); // Prevent default button action
        event.stopPropagation(); // Prevent triggering other potential row listeners
        const searchTerm = target.textContent.trim();
        const searchType = target.classList.contains('album-button') ? 'album' : 'singer';

        if (searchTerm) {
            // Construct the redirect URL for the homepage with specific searchBy
            const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
            console.log(`Shared Handler: Redirecting from secondary page (table button) to: ${redirectUrl}`);
            window.location.href = redirectUrl;
        }
        return; // Stop processing this click event further
    }

    // IMPORTANT: This handler intentionally DOES NOT handle the row click for download.
    // That logic remains in the page-specific JS files (artist-page.js, new-songs.js).
}

/**
 * Initializes the shared redirection listeners for header search and table clicks.
 */
function initializeSharedRedirects() {
    console.log("Shared Handler: Initializing shared search redirect handlers...");

    // --- Initialize Header Search Form Redirect ---
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        // Remove first to prevent duplicate listeners if this script is somehow loaded multiple times
        searchForm.removeEventListener('submit', handleHeaderSearchRedirect);
        searchForm.addEventListener('submit', handleHeaderSearchRedirect);
        console.log("Shared Handler: Attached header search redirect listener.");
    } else {
        // This might happen on pages without the header search, like 404 or custom pages.
        // console.warn("Shared Handler: Search form (#searchForm) not found.");
    }

    // --- Initialize Table Click Redirects/Actions (using delegation) ---
    // Only add if a results table exists on the page (common on artist and new-songs pages)
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    if (resultsTableBody) {
        // Remove first to prevent duplicate listeners
        resultsTableBody.removeEventListener('click', handleTableClickActions);
        resultsTableBody.addEventListener('click', handleTableClickActions);
        console.log("Shared Handler: Attached table click actions listener to tbody.songs-list.");
    } else {
        // Expected on pages like artists list which don't have this specific table structure.
        // console.log("Shared Handler: Results table body (tbody.songs-list) not found, skipping table listeners.");
    }
}

// --- Run Initialization ---
// Ensure this runs after the DOM is ready and core.js (if needed for functions) is loaded.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharedRedirects);
} else {
    // DOMContentLoaded has already fired
    initializeSharedRedirects();
}