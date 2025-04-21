// assets/js/new-songs.js

// --- Dependencies ---
// Relies on functions defined in core.js: copyToClipboard(), showCopiedMessage()
// Relies on the global 'baseurl' variable.

document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    const searchForm = document.getElementById('searchForm'); // Handle header search form

    // --- Header Search Form Redirect ---
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent default submission on this page

            const searchInput = document.getElementById('searchInput');
            const searchInputVal = searchInput ? searchInput.value.trim() : '';
            // Find the currently active filter button to get the searchBy value
            const activeFilterButton = document.querySelector('.filter-button.active');
            const searchBy = activeFilterButton ? activeFilterButton.dataset.filter : 'all'; // Default to 'all'

            if (searchInputVal) {
                // Construct the redirect URL for the homepage
                const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
                console.log(`Redirecting from new-songs page (header search) to: ${redirectUrl}`);
                window.location.href = redirectUrl;
            } else {
                 searchInput?.focus();
            }
        });
    } else {
        console.warn("Search form not found on new-songs page.");
    }

    // --- Table Interaction Logic ---
    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const row = target.closest('tr'); // Find the closest parent row

            if (!row) return; // Exit if click wasn't inside a row

            // Handling Serial Link Click (for copying)
            if (target.tagName === 'A' && target.closest('td') === row.cells[0]) { // Check if it's the link in the first cell
                event.preventDefault();
                event.stopPropagation();
                const songSerial = target.textContent.trim();
                if (songSerial) {
                    // Construct the share link using current page structure
                    // NOTE: The original onclick had a direct link structure which is fine for copy
                    const shareLink = `${window.location.origin}${baseurl || ''}${window.location.pathname}?song=${encodeURIComponent(songSerial)}`;
                    copyToClipboard(shareLink);
                    showCopiedMessage();
                }
            }
            // Handling Album/Singer Button Click (Redirecting to Homepage Search)
            else if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
                 event.preventDefault(); // Prevent button default action if any
                 event.stopPropagation(); // Prevent row click
                 const searchTerm = target.textContent.trim();
                 const searchType = target.classList.contains('album-button') ? 'album' : 'singer';
                 if (searchTerm) {
                      // CORRECTED: Ensure redirect goes to homepage '/'
                      const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
                      console.log(`Redirecting from new-songs page (button click) to: ${redirectUrl}`);
                      window.location.href = redirectUrl;
                 }
            }
            // Handling Row Click (for direct download using hidden link)
            else if (target.tagName !== 'A' && target.tagName !== 'BUTTON') {
                event.preventDefault();
                // Find the hidden download link within this specific row
                const downloadLink = row.querySelector('td[style*="display:none"] a'); // Find the link in the hidden cell
                if (downloadLink && downloadLink.href) {
                    console.log(`Triggering download for: ${downloadLink.download}`);
                    downloadLink.click(); // Simulate click on the hidden link
                     // Optional: Show a temporary "Downloading..." message?
                } else {
                    console.error('Download link not found or invalid for this row.');
                    // Optional: Show an error to the user using showMessage() from core.js?
                    // if (typeof showMessage === 'function') showMessage("שגיאה: קישור הורדה לא תקין.");
                }
            }
        });
    } else {
         console.warn("Results table body not found for new-songs page interactions.");
    }
});