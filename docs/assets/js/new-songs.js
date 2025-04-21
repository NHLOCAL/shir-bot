// assets/js/new-songs.js

// --- Dependencies ---
// Relies on functions defined in core.js: copyToClipboard(), showCopiedMessage(), showMessage()
// Relies on the global 'baseurl' variable.

document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    const searchForm = document.getElementById('searchForm'); // Handle header search form

    // --- Header Search Form Redirect ---
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const searchInput = document.getElementById('searchInput');
            const searchInputVal = searchInput ? searchInput.value.trim() : '';
            const activeFilterButton = document.querySelector('.filter-button.active');
            const searchBy = activeFilterButton ? activeFilterButton.dataset.filter : 'all';

            if (searchInputVal) {
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

    // --- Table Interaction Logic using Event Delegation ---
    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const row = target.closest('tr'); // Find the closest parent row

            if (!row || !row.dataset.songSerial) return; // Exit if click wasn't inside a row with data

            const songSerial = row.dataset.songSerial;

            // 1. Handling Serial Link Click (Copy)
            if (target.classList.contains('serial-link')) {
                event.preventDefault();
                event.stopPropagation();
                if (songSerial) {
                    // Construct the share link pointing to homepage search
                    const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
                    if(typeof copyToClipboard === 'function') copyToClipboard(shareLink);
                    if(typeof showCopiedMessage === 'function') showCopiedMessage();
                }
            }
            // 2. Handling Album/Singer Button Click (Redirecting to Homepage Search)
            else if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
                 event.preventDefault();
                 event.stopPropagation();
                 const searchTerm = target.textContent.trim();
                 const searchType = target.classList.contains('album-button') ? 'album' : 'singer';
                 if (searchTerm) {
                      const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
                      console.log(`Redirecting from new-songs page (button click) to: ${redirectUrl}`);
                      window.location.href = redirectUrl;
                 }
            }
            // 3. Handling Row Click (for direct download using hidden link)
            else if (target.tagName !== 'A' && target.tagName !== 'BUTTON') {
                event.preventDefault();
                // Find the hidden download link within this specific row using its class
                const downloadLink = row.querySelector('a.download-link');
                if (downloadLink && downloadLink.href) {
                    console.log(`Triggering download for: ${downloadLink.download || songSerial}`);
                    downloadLink.click(); // Simulate click on the hidden link
                } else {
                    console.error('Download link not found or invalid for this row.');
                    if (typeof showMessage === 'function') showMessage("שגיאה: קישור הורדה לא תקין.");
                }
            }
        });
    } else {
         console.warn("Results table body not found for new-songs page interactions.");
    }
});