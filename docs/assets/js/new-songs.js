// assets/js/new-songs.js

// --- Dependencies ---
// This file relies on functions defined in core.js:
// - copyToClipboard()
// - showCopiedMessage()
// It also relies on the global 'baseurl' variable.

document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');

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
                    // Construct the share link (assuming baseurl and page.url are available globally or passed differently)
                    // Using fixed structure based on permalink setting
                    const shareLink = `${window.location.origin}${baseurl}/new-songs/?song=${encodeURIComponent(songSerial)}`;
                    copyToClipboard(shareLink);
                    showCopiedMessage();
                }
            }
            // Handling Album/Singer Button Click (Redirecting)
            else if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
                 event.stopPropagation(); // Prevent row click
                 const searchTerm = target.textContent.trim();
                 const searchType = target.classList.contains('album-button') ? 'album' : 'singer';
                 if (searchTerm) {
                      window.location.href = `${baseurl}/?search=${encodeURIComponent(searchTerm)}&searchBy=${searchType}`;
                 }
            }
            // Handling Row Click (for direct download)
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
                    // showMessage("שגיאה: קישור הורדה לא תקין.");
                }
            }
        });
    } else {
         console.warn("Results table body not found for new-songs page interactions.");
    }
});