// assets/js/shared-redirect-handler.js

// Dependencies:
// - Global 'baseurl' variable
// - Functions from core.js: copyToClipboard, showCopiedMessage
// - Global function window.downloadSong (from search.js)

/**
 * Handles the submission of the header search form on secondary pages.
 * @param {Event} event - The form submit event.
 */
function handleHeaderSearchRedirect(event) {
    event.preventDefault();
    const searchForm = event.currentTarget;
    const searchInput = searchForm.querySelector('#searchInput');
    const searchInputVal = searchInput ? searchInput.value.trim() : '';
    const activeFilterButton = searchForm.querySelector('.filter-button.active');
    const searchBy = activeFilterButton ? activeFilterButton.dataset.filter : 'all';

    if (searchInputVal) {
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
        console.log(`Shared Handler: Redirecting from secondary page (header search) to: ${redirectUrl}`);
        window.location.href = redirectUrl;
    } else {
        searchInput?.focus();
    }
}

/**
 * Handles clicks within the results table body on secondary pages (Artist, etc.).
 * Delegates actions for Download, Share, Album, and Singer buttons.
 * @param {Event} event - The click event.
 */
function handleTableClickActions(event) {
    const target = event.target;
    const button = target.closest('button'); // Check if click was on or inside a button

    // Exit if click wasn't on a button or not within a tbody.songs-list
    if (!button || !button.closest('tbody.songs-list')) return;

    const row = button.closest('tr');
    const songSerial = button.dataset.songSerial || (row ? row.dataset.songSerial : null); // Get serial from button or row

    // 1. Handle Download Button Click (Uses global downloadSong from search.js)
    // Exclude the specific download button for new-songs page, handled by new-songs.js
    if (button.classList.contains('download-button') && songSerial) {
         event.preventDefault();
         event.stopPropagation();
         console.log(`Shared Handler: Download button clicked for serial ${songSerial}`);
         if (typeof window.downloadSong === 'function') {
             // Use the wrapper from search.js if available globally, otherwise call directly
             if (typeof window.downloadSongWrapper === 'function') {
                 window.downloadSongWrapper(button); // Assumes wrapper is global too
             } else {
                  // Add basic button disabling if wrapper isn't global
                 button.disabled = true;
                 const originalIcon = button.innerHTML;
                 button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                 window.downloadSong(songSerial)
                    .catch(err => console.error("Shared handler download failed:", err))
                    .finally(() => {
                         setTimeout(() => {
                             if(button) {
                                 button.disabled = false;
                                 button.innerHTML = originalIcon;
                             }
                         }, 2000);
                     });
             }
         } else {
             console.error("Shared Handler: downloadSong function is not defined globally.");
             // Optionally show an error message to the user
             if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
         }
         return; // Stop processing
    }

    // 2. Handle Share Button Click (Uses core.js functions)
    if (button.classList.contains('share-button') && songSerial) {
        event.preventDefault();
        event.stopPropagation();
        console.log(`Shared Handler: Share button clicked for serial ${songSerial}`);
        const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
        if (typeof copyToClipboard === 'function' && typeof showCopiedMessage === 'function') {
            copyToClipboard(shareLink);
            showCopiedMessage();
        } else {
             console.warn("Shared Handler: Clipboard functions not found.");
        }
        return; // Stop processing
    }

    // 3. Handle Album/Singer Button Click (Redirect to Homepage Search)
    if (button.classList.contains('album-button') || button.classList.contains('singer-button')) {
        event.preventDefault();
        event.stopPropagation();
        // Get name from text content OR data attribute if present
        const searchTerm = button.dataset.albumName || button.dataset.singerName || button.textContent.trim();
        const searchType = button.classList.contains('album-button') ? 'album' : 'singer';

        if (searchTerm) {
            const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
            console.log(`Shared Handler: Redirecting from secondary page (table button ${searchType}) to: ${redirectUrl}`);
            window.location.href = redirectUrl;
        }
        return; // Stop processing
    }

    // Note: Row clicks are intentionally not handled here for download/share.
}

/**
 * Initializes the shared redirection listeners.
 */
function initializeSharedRedirects() {
    console.log("Shared Handler: Initializing shared search redirect handlers...");

    // --- Initialize Header Search Form Redirect ---
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.removeEventListener('submit', handleHeaderSearchRedirect);
        searchForm.addEventListener('submit', handleHeaderSearchRedirect);
        console.log("Shared Handler: Attached header search redirect listener.");
    }

    // --- Initialize Table Click Redirects/Actions (using delegation) ---
    // Attach listener to document body to catch clicks in ANY table body with class 'songs-list'
    // This simplifies things and works even if the table is loaded dynamically.
    document.body.removeEventListener('click', handleTableClickActions); // Prevent duplicates
    document.body.addEventListener('click', handleTableClickActions);
    console.log("Shared Handler: Attached global table click actions listener to document body.");

}

// --- Run Initialization ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharedRedirects);
} else {
    initializeSharedRedirects();
}