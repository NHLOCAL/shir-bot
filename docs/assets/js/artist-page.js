// assets/js/artist-page-initializer.js

// Dependencies: relies on functions from core.js (showMessage, copyToClipboard, showCopiedMessage)
// and search.js (downloadSong, handleFilterClick, searchInput element)
// Make sure search.js is loaded BEFORE this script.

document.addEventListener('DOMContentLoaded', function() {
    const initialResultsTableBody = document.querySelector('#resultsTable tbody.songs-list');

    if (initialResultsTableBody) {
        // Get all initially loaded rows
        const initialRows = initialResultsTableBody.querySelectorAll('tr');

        initialRows.forEach(row => {
            // Retrieve song data directly from the row's cells if needed later
            const serialLink = row.cells[0]?.querySelector('a');
            const songSerial = serialLink?.textContent.trim();
            const songName = row.cells[1]?.textContent.trim();
            const albumButton = row.cells[2]?.querySelector('button');
            const songAlbum = albumButton?.textContent.trim();
            const singerButton = row.cells[3]?.querySelector('button');
            const songSinger = singerButton?.textContent.trim();

            // Attach the main click listener to the row
            row.addEventListener('click', function(event) {
                const target = event.target;

                // 1. Handle Serial Link Click (Copy)
                if (target.tagName === 'A' && target.closest('td') === row.cells[0]) {
                    event.preventDefault();
                    event.stopPropagation(); // Prevent triggering row download
                    if (songSerial) {
                        // Construct the share link (assuming baseurl is available globally)
                        const shareLink = `${window.location.origin}${baseurl}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
                        copyToClipboard(shareLink);
                        showCopiedMessage();
                    }
                    return; // Stop processing
                }

                // 2. Handle Album/Singer Button Click (Search)
                if (target.tagName === 'BUTTON' && (target.classList.contains('album-button') || target.classList.contains('singer-button'))) {
                    event.preventDefault();
                    event.stopPropagation(); // Prevent triggering row download
                    const searchTerm = target.textContent.trim();
                    const searchType = target.classList.contains('album-button') ? 'album' : 'singer';

                    if (searchTerm && typeof handleFilterClick === 'function' && document.getElementById('searchInput')) {
                        // Update search input and trigger search using functions from search.js
                        document.getElementById('searchInput').value = searchTerm;
                        handleFilterClick(searchType); // This function should handle the search execution
                    } else {
                         // Fallback or error handling if functions/elements aren't ready
                         console.warn("Could not trigger search from initial results button.");
                         // Maybe redirect manually as a fallback?
                         // window.location.href = `${baseurl}/?search=${encodeURIComponent(searchTerm)}&searchBy=${searchType}`;
                    }
                    return; // Stop processing
                }

                // 3. Handle Row Click (Download) - Only if not clicking link/button
                // Check if downloadSong function exists (from search.js)
                if (typeof downloadSong !== 'function') {
                    console.error("ERROR: downloadSong function not found. Ensure search.js is loaded.");
                    showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
                    return;
                }

                // Prevent double-click download attempts
                if (row.classList.contains('download-in-progress')) {
                    console.warn("Download already in progress for this initial row.");
                    return;
                }

                if (songSerial) {
                    console.log("Initializer: Triggering download for initial row:", songSerial);
                    row.classList.add('download-in-progress');
                    downloadSong(songSerial)
                        .catch((error) => {
                            console.error(`Initializer: downloadSong promise rejected for ${songSerial}:`, error);
                        })
                        .finally(() => {
                            // Remove the flag after a delay
                            setTimeout(() => {
                                row.classList.remove('download-in-progress');
                            }, 1500);
                        });
                } else {
                    console.error('Initializer: Could not find song serial for initial row click.');
                    showMessage("שגיאה: לא ניתן היה למצוא מספר סידורי להורדה.");
                }
            }); // End row click listener

            // Add specific listeners to buttons/links if row listener isn't enough (optional, row listener should handle it with stopPropagation)
             if (serialLink) {
                serialLink.addEventListener('click', (e) => { /* Logic is handled in row listener */ });
             }
             if (albumButton) {
                 albumButton.addEventListener('click', (e) => { /* Logic is handled in row listener */ });
             }
             if (singerButton) {
                 singerButton.addEventListener('click', (e) => { /* Logic is handled in row listener */ });
             }

        }); // End forEach row

    } else {
        console.warn("Initializer: Initial results table body not found.");
    }
});