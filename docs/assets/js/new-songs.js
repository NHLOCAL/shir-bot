// assets/js/new-songs.js

// Dependencies: showMessage (from core.js, if used for errors)

// This script now specifically handles the download button click for the new-songs page,
// as it needs to trigger the hidden link containing the specific Drive ID.

document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');

    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const button = target.closest('button.download-button-new'); // Target ONLY the specific new download button

            if (!button) {
                // If the click wasn't on the download button, let shared-redirect-handler handle share/album/singer buttons
                return;
            }

            // --- START: Specific Download Logic for New Songs Page Button ---
            event.preventDefault(); // Prevent default button action
            event.stopPropagation(); // Prevent shared handler from processing this specific button

            const row = button.closest('tr');
            if (!row) return;

            // Find the hidden download link within this specific row
            const hiddenDownloadLink = row.querySelector('a.hidden-download-link');

            if (hiddenDownloadLink && hiddenDownloadLink.href) {
                console.log(`New Songs Page: Triggering download for: ${button.dataset.filename || 'song'}`);

                 // Optional: Add visual feedback to the button
                 button.disabled = true;
                 const originalIcon = button.innerHTML;
                 button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                 // Simulate click on the hidden link
                 hiddenDownloadLink.click();

                 // Restore button after a short delay (simulating download start)
                 setTimeout(() => {
                     if(button) {
                         button.innerHTML = originalIcon;
                         button.disabled = false;
                     }
                 }, 2000); // Adjust delay if needed

            } else {
                console.error('New Songs Page: Hidden download link not found or invalid for this row.');
                if (typeof showMessage === 'function') showMessage("שגיאה: קישור הורדה לא תקין.");
            }
            // --- END: Specific Download Logic ---
        });
        console.log("New Songs Page: Attached specific download button listener.");
    } else {
         console.warn("New Songs Page: Results table body (tbody.songs-list) not found for specific download listener.");
    }
});