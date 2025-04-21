// assets/js/new-songs.js

// Dependencies: showMessage (from core.js, if used for errors)

document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');

    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const row = target.closest('tr');

            // Exit if not a direct row click (TD or TR),
            // or if clicking a specific button/link (which are handled by shared-redirect-handler.js)
            if (!row || target.tagName === 'A' || target.tagName === 'BUTTON') {
                // Allow shared-redirect-handler to process clicks on A and BUTTON elements.
                // If it's not A or BUTTON, and not a row, do nothing.
                return;
            }

            // --- START: Specific Download Logic for New Songs Page (using hidden link) ---
            // This assumes a click on the row (not on a button/link within it) should trigger download
            event.preventDefault(); // Prevent any default action for row click if one exists

            // Find the hidden download link within this specific row
            const downloadLink = row.querySelector('td[style*="display:none"] a'); // The selector for the hidden link
            if (downloadLink && downloadLink.href) {
                console.log(`New Songs Page: Triggering download for: ${downloadLink.download}`);
                downloadLink.click(); // Simulate click on the hidden link
            } else {
                console.error('New Songs Page: Download link not found or invalid for this row.');
                // Optional: Show an error to the user?
                // if (typeof showMessage === 'function') showMessage("שגיאה: קישור הורדה לא תקין.");
            }
            // --- END: Specific Download Logic ---
        });
        console.log("New Songs Page: Attached specific row download listener.");
    } else {
         console.warn("New Songs Page: Results table body (tbody.songs-list) not found for specific download listener.");
    }
});