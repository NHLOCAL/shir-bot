function handleHeaderSearchRedirect(event) {
    // Check if the current page is the homepage
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');

    // If we are ON the homepage, let search.js's submit handler do the work
    if (isHomepage) {
        console.log("Shared Handler: Header search on homepage, letting search.js handle submit.");
        // Prevent default form submission IF this handler interferes,
        // but allow search.js's handler (attached to the same form) to proceed.
        // Note: The submitForm in search.js should already prevent default if needed.
        // This primarily stops *this* handler from redirecting.
        event.preventDefault();
        return; // Exit this handler early
    }

    // --- Existing redirection logic for non-homepage pages ---
    event.preventDefault(); // Keep preventing default redirection here too
    const searchForm = event.currentTarget;
    const searchInput = searchForm.querySelector('#searchInput');
    const searchInputVal = searchInput ? searchInput.value.trim() : '';

    let searchBy = 'all';
    const activeFilterButton = document.querySelector('.filter-button.active');
    if (activeFilterButton && activeFilterButton.dataset.filter) {
        searchBy = activeFilterButton.dataset.filter;
    }

    if (searchInputVal) {
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
        console.log(`Shared Handler: Redirecting from secondary page (header search) to: ${redirectUrl}`);
        window.location.href = redirectUrl;
    } else {
        searchInput?.focus();
    }
}


function handleTableClickActions(event) {
    const target = event.target;
    const button = target.closest('button');

    // Ensure it's a button within the results table body
    if (!button || !button.closest('tbody.songs-list')) return;

    const row = button.closest('tr');
    // Extract data consistently
    const songSerial = button.dataset.songSerial || (row ? row.dataset.songSerial : null);
    const driveId = button.dataset.driveId || (row ? row.dataset.driveId : null);

    // --- Download Button Logic ---
    const isDownloadButton = button.classList.contains('download-button') || button.classList.contains('download-button-new');
    if (isDownloadButton && songSerial && driveId) {
         event.preventDefault();
         event.stopPropagation();
         console.log(`Shared Handler: Download button clicked for serial ${songSerial} with DriveID ${driveId}`);
         // Use the globally available function (defined potentially in search.js or new-songs.js)
         if (typeof window.downloadSongWithDriveId === 'function') {
             window.downloadSongWithDriveId(button);
         } else {
             console.error("Shared Handler: downloadSongWithDriveId function is not defined globally.");
             if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
             // Attempt to restore button state if it was already processing
             if (button.classList.contains('download-in-progress')) {
                 button.innerHTML = button.dataset.originalIcon || '<i class="fas fa-download"></i>';
                 button.disabled = false;
                 button.classList.remove('download-in-progress');
                 delete button.dataset.originalIcon;
             }
         }
         return; // Handled
    }

    // --- Share Button Logic ---
    if (button.classList.contains('share-button') && songSerial) {
        event.preventDefault();
        event.stopPropagation();
        console.log(`Shared Handler: Share button clicked for serial ${songSerial}`);
        const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;

        if (typeof copyToClipboard === 'function') {
            const success = copyToClipboard(shareLink);
            if (success) {
                const originalIconHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check" style="color: green;"></i>';
                button.classList.add('copied');
                button.disabled = true;
                setTimeout(() => {
                    if (button) { // Check if button still exists
                         button.innerHTML = originalIconHTML;
                         button.classList.remove('copied');
                         button.disabled = false;
                    }
                }, 1500);
            } else {
                 console.warn("Shared Handler: copyToClipboard function failed.");
                 if (typeof showMessage === 'function') showMessage("שגיאה בהעתקת הקישור.");
            }
        } else {
             console.warn("Shared Handler: copyToClipboard function not found.");
             if (typeof showMessage === 'function') showMessage("שגיאה: לא ניתן להעתיק קישור.");
        }
        return; // Handled
    }

    // --- MODIFIED Logic for Singer/Album buttons ---
    if (button.classList.contains('album-button') || button.classList.contains('singer-button')) {
        event.preventDefault();
        event.stopPropagation();

        const searchTerm = button.dataset.albumName || button.dataset.singerName || button.textContent.trim();
        const searchType = button.classList.contains('album-button') ? 'album' : 'singer';
        // Check if we are on the homepage
        const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');

        if (searchTerm) {
            // Check if on homepage AND the necessary search functions from search.js are available
            if (isHomepage && typeof searchSongs === 'function' && typeof handleFilterClick === 'function' && document.getElementById('searchInput')) {
                // Perform in-page search on homepage
                console.log(`Shared Handler: Table button '${searchType}' clicked on homepage. Searching for: "${searchTerm}"`);
                const searchInputGlobal = document.getElementById('searchInput');

                searchInputGlobal.value = searchTerm; // Update search bar text
                // Update filter visually and internally (false = not triggered by direct user click on filter)
                handleFilterClick(searchType, false);
                // Trigger the search logic from search.js
                searchSongs(searchTerm.toLowerCase(), searchType);

                // Optional: Scroll to the top or results area for better UX
                 window.scrollTo({ top: 0, behavior: 'smooth' });

            } else {
                // Perform redirection (original behavior for non-homepage or if functions missing)
                const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
                console.log(`Shared Handler: Redirecting from secondary page or fallback (table button ${searchType}) to: ${redirectUrl}`);
                window.location.href = redirectUrl;
            }
        }
        return; // Handled
    }
    // --- End of Singer/Album button logic ---

    // If the click wasn't on any handled button, do nothing further in this specific handler
}


// This function remains the same, just ensures the listeners are correctly attached.
function initializeSharedRedirects() {
    console.log("Shared Handler: Initializing shared handlers...");

    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        // Ensure only one listener is attached, remove first just in case
        searchForm.removeEventListener('submit', handleHeaderSearchRedirect);
        searchForm.addEventListener('submit', handleHeaderSearchRedirect);
        console.log("Shared Handler: Attached header search redirect listener.");
    } else {
        console.warn("Shared Handler: Header search form not found.");
    }

    // Detach previous listener before adding, to prevent duplicates if script re-runs
    document.body.removeEventListener('click', handleTableClickActions);
    document.body.addEventListener('click', handleTableClickActions);
    console.log("Shared Handler: Attached global table click actions listener to document body.");
}

// Ensure initialization runs correctly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharedRedirects);
} else {
    // DOM already loaded
    initializeSharedRedirects();
}
