// assets/js/artist-page.js

// Dependencies: relies on functions from core.js (showMessage, copyToClipboard, showCopiedMessage)
// and potentially search.js's downloadSong if still needed for direct row clicks (but not for search).
// Assumes baseurl is available globally.

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
                console.log(`Redirecting from artist page (header search) to: ${redirectUrl}`);
                window.location.href = redirectUrl;
            } else {
                 searchInput?.focus();
            }
        });
    } else {
        console.warn("Search form not found on artist page.");
    }


    // --- Table Interaction Logic ---
    if (resultsTableBody) {
        // Get all initially loaded rows (if any exist statically)
        const initialRows = resultsTableBody.querySelectorAll('tr');

        initialRows.forEach(row => {
            setupRowEventListeners(row); // Setup listeners for static rows
        });

        // If results are loaded dynamically later, ensure listeners are added then as well.
        // This example focuses on the static/initial rows.

    } else {
        console.warn("Results table body not found on artist page.");
    }
}); // End DOMContentLoaded


function setupRowEventListeners(row) {
    // Retrieve song data directly from the row's cells if needed later
    const serialLink = row.cells[0]?.querySelector('a');
    const songSerial = serialLink?.textContent.trim();
    const songName = row.cells[1]?.textContent.trim();
    // Find buttons by class within the specific cells
    const albumButton = row.cells[2]?.querySelector('button.album-button');
    const songAlbum = albumButton?.textContent.trim();
    const singerButton = row.cells[3]?.querySelector('button.singer-button');
    const songSinger = singerButton?.textContent.trim();

    // Attach the main click listener to the row using event delegation pattern
    row.addEventListener('click', function(event) {
        const target = event.target;

        // 1. Handle Serial Link Click (Copy)
        if (target.tagName === 'A' && target.closest('td') === row.cells[0]) {
            event.preventDefault();
            event.stopPropagation(); // Prevent triggering row download
            if (songSerial) {
                // Construct the share link (assuming baseurl is available globally)
                const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
                copyToClipboard(shareLink); // Function from core.js
                showCopiedMessage();      // Function from core.js
            }
            return; // Stop processing
        }

        // 2. Handle Album/Singer Button Click (Redirect to Homepage Search)
        if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
            event.preventDefault();
            event.stopPropagation(); // Prevent triggering row download
            const searchTerm = target.textContent.trim();
            const searchType = target.classList.contains('album-button') ? 'album' : 'singer';

            if (searchTerm) {
                // Redirect to homepage with search parameters
                const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
                console.log(`Redirecting from artist page (button click) to: ${redirectUrl}`);
                window.location.href = redirectUrl;
            }
            return; // Stop processing
        }

        // 3. Handle Row Click (Download) - Only if not clicking link/button
        // Check if downloadSong function exists (from search.js or wherever it's defined)
        if (target.tagName !== 'A' && target.tagName !== 'BUTTON') {
            if (typeof downloadSong !== 'function') {
                console.error("ERROR: downloadSong function not found.");
                if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
                return;
            }

            // Prevent double-click download attempts
            if (row.classList.contains('download-in-progress')) {
                console.warn("Download already in progress for this row.");
                return;
            }

            if (songSerial) {
                console.log("Triggering download for row:", songSerial);
                row.classList.add('download-in-progress');
                downloadSong(songSerial) // Assumes downloadSong handles its own errors/messages
                    .catch((error) => {
                        console.error(`downloadSong promise rejected for ${songSerial}:`, error);
                        // Optional: Show message here if downloadSong doesn't always
                        // if (typeof showMessage === 'function') showMessage(`שגיאה בהורדת שיר ${songSerial}.`);
                    })
                    .finally(() => {
                        // Remove the flag after a delay
                        setTimeout(() => {
                           if(row) row.classList.remove('download-in-progress');
                        }, 1500);
                    });
            } else {
                console.error('Could not find song serial for row click.');
                if (typeof showMessage === 'function') showMessage("שגיאה: לא ניתן היה למצוא מספר סידורי להורדה.");
            }
        } // End Row Click (Download)
    }); // End row click listener
}