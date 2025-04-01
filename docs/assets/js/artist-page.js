// assets/js/artist-page.js

// --- Dependencies ---
// This file relies on functions defined in core.js:
// - showMessage()
// - copyToClipboard()
// - showCopiedMessage()
// It also relies on downloadSong() defined in search.js
// Ensure search.js is loaded BEFORE this script on artist pages.
// Relies on the global 'baseurl' variable.

document.addEventListener('DOMContentLoaded', function() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    // Check if downloadSong function exists (loaded from search.js)
    if (typeof downloadSong !== 'function') {
        console.error("ERROR: downloadSong function not found. Ensure search.js is loaded before artist-page.js");
        // Optionally disable download functionality or show an error message
        // You could add a class to the body or table to visually indicate the issue.
        // Example: document.body.classList.add('download-unavailable');
        return; // Stop execution if download function is missing
    }


    if (resultsTableBody) {
        resultsTableBody.addEventListener('click', function(event) {
            const target = event.target;
            const row = target.closest('tr');

            if (!row) return;

            // Handling Serial Link Click (for copying)
             if (target.tagName === 'A' && target.closest('td') === row.cells[0]) {
                event.preventDefault();
                event.stopPropagation();
                const songSerial = target.textContent.trim();
                 // Get artist name from page data if possible, or use a placeholder
                 const artistName = document.title || 'artist'; // Get artist name from page title
                 const safeArtistName = artistName.replace(/\s+/g, '-').toLowerCase(); // Basic sanitization
                 const shareLink = `${window.location.origin}${baseurl}/artists/${safeArtistName}/?song=${encodeURIComponent(songSerial)}`; // Adjust URL structure if needed
                copyToClipboard(shareLink);
                showCopiedMessage();
            }
             // Handling Album/Singer Button Click (Redirecting - might be less useful here?)
             else if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
                 event.stopPropagation();
                 const searchTerm = target.textContent.trim();
                 const searchType = target.classList.contains('album-button') ? 'album' : 'singer';
                 if (searchTerm) {
                     // Redirect to main search page
                     window.location.href = `${baseurl}/?search=${encodeURIComponent(searchTerm)}&searchBy=${searchType}`;
                 }
             }
            // Handling Row Click (for downloading via Apps Script)
            else if (target.tagName !== 'A' && target.tagName !== 'BUTTON') {
                event.preventDefault();
                const serialCell = row.cells[0]; // Assuming serial is always in the first cell
                const serialLink = serialCell?.querySelector('a');
                const songSerial = serialLink?.textContent.trim();

                if (songSerial) {
                    console.log(`Requesting download for serial: ${songSerial}`);
                    downloadSong(songSerial); // Call function from search.js
                } else {
                    console.error('Could not find song serial in the clicked row.');
                    showMessage("שגיאה: לא ניתן היה למצוא מספר סידורי להורדה."); // Use core.js function
                }
            }
        });

        // --- "Load More" for Artist Pages (Placeholder) ---
        // Artist pages currently load all songs via Jekyll front matter.
        // If you implement pagination for very large artist lists later, add the logic here.
        const loadMoreButtonArtist = document.getElementById('loadMoreButton'); // Check if button exists
        if (loadMoreButtonArtist) {
             // Add logic similar to search.js's loadMoreResults if needed,
             // potentially fetching more songs via AJAX if not all loaded initially.
             // Currently, it's likely unused on artist pages.
             // loadMoreButtonArtist.addEventListener('click', loadMoreArtistSongs);
             loadMoreButtonArtist.style.display = 'none'; // Hide by default on artist pages
        }

    } else {
         console.warn("Results table body not found for artist page interactions.");
    }


});