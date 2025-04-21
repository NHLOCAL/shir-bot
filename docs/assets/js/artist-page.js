// assets/js/artist-page.js

// Dependencies: relies on downloadSong (from search.js, must be global),
// showMessage (from core.js, must be global)

document.addEventListener('DOMContentLoaded', function() {
    console.log("Artist Page: DOMContentLoaded fired.");

    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');

    if (resultsTableBody) {
        console.log("Artist Page: Found results table body (tbody.songs-list). Attaching listener.");

        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target; // The actual element clicked (e.g., could be text node inside TD)
            const containingTd = target.closest('td'); // Find the TD containing the click
            const row = target.closest('tr'); // Find the row containing the click

            console.log("Artist Page: Table body clicked. Target:", target, "TD:", containingTd, "Row:", row);

            // --- Pre-condition checks ---
            // 1. Must be inside a row with a serial number
            if (!row || !row.dataset.songSerial) {
                console.log("Artist Page: Click not in a valid row or row lacks data-song-serial. Ignoring.");
                return;
            }

            // 2. Check if the click was on elements handled by the shared handler (A or BUTTON)
            // We check the target *itself* or if the target is *inside* an A or BUTTON
            if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a') || target.closest('button')) {
                console.log("Artist Page: Click target is A/BUTTON or inside one. Handled by shared handler. Ignoring download.");
                // Let the shared handler manage this click (it uses stopPropagation)
                return;
            }

            // 3. If we reached here, the click was likely on a TD (or its direct text content)
            // that isn't the first TD (serial link) or doesn't contain a button.
            // This is our trigger for download.
            console.log("Artist Page: Click is valid for download action.");

            // --- START: Specific Download Logic for Artist Page ---
            const songSerial = row.dataset.songSerial;

            // Check if downloadSong function exists
            if (typeof downloadSong !== 'function') {
                console.error("Artist Page: downloadSong function is not defined or not accessible. Make sure search.js loaded correctly.");
                if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
                return;
            }
            console.log("Artist Page: downloadSong function found.");

            // Prevent double-click download attempts
            if (row.classList.contains('download-in-progress')) {
                console.warn("Artist Page: Download already in progress for this row.");
                return;
            }
            console.log("Artist Page: Starting download process for serial:", songSerial);

            row.classList.add('download-in-progress');

            // Call the download function
            downloadSong(songSerial) // Assume downloadSong is global from search.js
                .then(() => {
                     console.log("Artist Page: downloadSong promise resolved for", songSerial);
                })
                .catch((error) => {
                    // Error should be logged within downloadSong, but log here too for context
                    console.error(`Artist Page: downloadSong promise rejected for ${songSerial}:`, error);
                })
                .finally(() => {
                    // Remove the flag after a delay
                    setTimeout(() => {
                       if(row) row.classList.remove('download-in-progress');
                       console.log("Artist Page: Removed download-in-progress flag for", songSerial);
                    }, 1500);
                });
            // --- END: Specific Download Logic ---
        });
    } else {
        console.warn("Artist Page: Results table body (tbody.songs-list) not found for specific download listener.");
    }
});