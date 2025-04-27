// File: assets/js/homepage.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("Homepage.js: DOMContentLoaded");

    // DOM Element References
    const artistsGrid = document.getElementById('popular-artists-grid');
    const songsList = document.getElementById('random-songs-list');
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area'); // Needed to hide/show

    // Configuration
    const NUM_ARTISTS_TO_SHOW = 6;
    const NUM_SONGS_TO_SHOW = 5; // Number of recent/random songs to display

    // --- Helper Functions ---

    /**
     * Extracts unique artists and their corresponding page URLs from the song data.
     * Requires the UNF library for proper Hebrew slug generation if used for URLs.
     * @param {Array} allSongs - The array of all song objects.
     * @returns {Array} - An array of objects like { name: 'Artist Name', url: '/artists/artist-name/' }.
     */
    function getUniqueArtists(allSongs) {
        if (!Array.isArray(allSongs)) return [];
        const artistMap = new Map();
        console.log("Homepage.js: Filtering artists based on word count (max 3 words)...");
        let skippedCount = 0;

        allSongs.forEach(song => {
            const singerName = song.singer; // Get the singer name

            // --- Existing check: Ensure name is valid and not already added ---
            if (singerName && !artistMap.has(singerName)) {

                // --- <<< NEW CHECK: Check word count >>> ---
                // Split by whitespace (robustly handling multiple spaces) and count non-empty parts
                const wordCount = singerName.split(/\s+/).filter(Boolean).length;

                if (wordCount <= 3) {
                    // --- <<< Artist passes the check, proceed with adding to map >>> ---
                    let slug = "unknown-artist";
                    try {
                        // --- Slug generation logic (existing code) ---
                        if (typeof UNF !== 'undefined' && UNF.Normalizer) {
                            const normalized_text = UNF.Normalizer.normalize(singerName, 'nfkc').toLowerCase();
                            slug = normalized_text.replace(/[^a-z0-9\u0590-\u05FF\-]+/g, '-').replace(/^-+|-+$/g, '');
                            slug = slug || "artist";
                        } else {
                            slug = singerName.toLowerCase().replace(/[^a-z0-9\u0590-\u05FF\-]+/g, '-').replace(/^-+|-+$/g, '');
                            slug = slug || "artist";
                            // Warning moved outside the loop if needed once
                        }
                        // --- End Slug generation logic ---
                    } catch (e) {
                         console.error("Error creating slug for artist:", singerName, e);
                         slug = "error-artist"; // Fallback slug on error
                    }
                    // Add the valid artist and their URL to the map
                    artistMap.set(singerName, `${baseurl || ''}/artists/${slug}/`);
                } else {
                    // --- <<< Artist fails the check (more than 3 words), skip it >>> ---
                    skippedCount++;
                    // Optional: Log skipped artists for debugging (can be noisy)
                    // console.log(`Homepage: Skipping artist '${singerName}' (word count: ${wordCount})`);
                }
                 // --- <<< End of NEW CHECK >>> ---
            }
        });

        if (typeof UNF === 'undefined') {
            console.warn("UNF library not loaded, using basic slug generation for artists.");
        }
        console.log(`Homepage.js: Filtered artists. Kept ${artistMap.size}, skipped ${skippedCount} due to word count.`);
        // Return the filtered list sorted alphabetically (existing code)
        return Array.from(artistMap, ([name, url]) => ({ name, url })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }


    /**
     * Selects a specified number of random items from an array.
     * @param {Array} array - The array to select from.
     * @param {number} count - The number of items to select.
     * @returns {Array} - A new array containing the random items.
     */
    function getRandomItems(array, count) {
        if (!array || array.length === 0) return [];
        // Fisher-Yates (Knuth) Shuffle for better randomness
        const shuffled = array.slice(); // Create a copy
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
        }
        return shuffled.slice(0, count);
    }

    /**
     * Populates the artists grid with random artists.
     * @param {Array} availableArtists - Array of artist objects {name, url}.
     */
    function displayArtists(availableArtists) {
        if (!artistsGrid) {
            console.warn("Homepage.js: artistsGrid element not found.");
            return;
        }
        const randomArtists = getRandomItems(availableArtists, NUM_ARTISTS_TO_SHOW);

        if (randomArtists.length === 0) {
            artistsGrid.innerHTML = '<p class="loading-placeholder">לא נמצאו אמנים להצגה.</p>';
            return;
        }

        let html = '';
        randomArtists.forEach(artist => {
            const artistNameEscaped = artist.name.replace(/"/g, '"'); // Escape quotes for title attribute
            html += `
                <div class="artist-item" data-artist-name="${artistNameEscaped}">
                    <a href="${artist.url}" class="artist-circle" title="עבור לדף האמן ${artistNameEscaped}">
                       <i class="fas fa-user"></i>
                    </a>
                    <span class="artist-name">${artist.name}</span>
                </div>`;
        });
        artistsGrid.innerHTML = html;

        // Add GA event tracking for artist clicks
        artistsGrid.querySelectorAll('a.artist-circle').forEach(link => {
            link.addEventListener('click', (event) => {
                const artistName = link.closest('.artist-item')?.dataset.artistName || 'unknown';
                 if (typeof gtag === 'function') {
                    gtag('event', 'select_content', {
                        'content_type': 'artist_homepage_grid',
                        'item_id': artistName
                    });
                 }
            });
        });
    }

    /**
     * Populates the songs list with random, downloadable songs.
     * Adds click listeners to trigger a search for the selected song.
     * @param {Array} allSongs - The full array of song objects.
     */
    function displaySongs(allSongs) {
        if (!songsList) {
            console.warn("Homepage.js: songsList element not found.");
            return;
        }

        // Filter for songs that seem valid and potentially downloadable
        const displayableSongs = allSongs.filter(song => song.name && song.serial && song.driveId);
        const randomSongs = getRandomItems(displayableSongs, NUM_SONGS_TO_SHOW);

        if (randomSongs.length === 0) {
            songsList.innerHTML = '<li class="loading-placeholder">לא נמצאו שירים להצגה.</li>';
            return;
        }

        let html = '';
        randomSongs.forEach(song => {
             const songNameEscaped = song.name.replace(/"/g, '"');
            html += `
                <li data-song-serial="${song.serial}" title="חפש את '${songNameEscaped}'">
                    <i class="fas fa-music song-icon"></i>
                    ${song.name} - ${song.singer || 'לא ידוע'}
                </li>`;
        });
        songsList.innerHTML = html;

        // Add click listeners to trigger search in search.js
        songsList.querySelectorAll('li[data-song-serial]').forEach(item => {
            item.addEventListener('click', () => {
                const serial = item.dataset.songSerial;
                console.log("Homepage.js: Song clicked, serial:", serial);

                // Access functions and state from search.js (ensure they exist)
                const searchInputGlobal = document.getElementById('searchInput');
                const searchHandler = window.searchSongs; // Defined in search.js
                const filterHandler = window.handleFilterClick; // Defined in search.js
                const isDataReady = typeof songsDataLoaded !== 'undefined' && songsDataLoaded; // Check flag from search.js

                if (searchHandler && filterHandler && searchInputGlobal && isDataReady) {
                     searchInputGlobal.value = serial; // Set search input value
                     filterHandler('serial', false); // Update filter buttons visually
                     searchHandler(serial, 'serial'); // Trigger the search (will also show results view)

                     // Optional: GA Event for homepage song click leading to search
                      if (typeof gtag === 'function') {
                         gtag('event', 'select_content', {
                           'content_type': 'song_homepage_list',
                           'item_id': serial
                         });
                      }
                } else if (!isDataReady) {
                     console.warn("Homepage.js: Song clicked, but song data is not ready yet.");
                     if(typeof showMessage === 'function') showMessage("מאגר השירים עדיין בטעינה, נסה לחפש שוב בעוד רגע.");
                } else {
                    // Fallback if search functions are not available
                    console.warn("Homepage.js: Search/filter functions or input not found, redirecting as fallback.");
                    window.location.href = `${baseurl || ''}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }


    // --- Main Initialization Logic ---

    /**
     * Initializes the homepage content (artists, songs) once the main song data is ready.
     * @param {Array} songs - The loaded array of all songs.
     */
    function initializeHomepageContent(songs) {
        console.log("Homepage.js: Initializing content (songsDataReady event received).");
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');

        // Display homepage content ONLY if there are no search parameters in the URL
        // (If there are params, search.js should handle showing the results)
        if (!hasSearchParams) {
            if (homepageContent) homepageContent.style.display = 'block';
            if (searchResultsArea) searchResultsArea.style.display = 'none';

            const uniqueArtists = getUniqueArtists(songs);
            displayArtists(uniqueArtists);

            if (songs.length > 0) {
                displaySongs(songs);
            }
        } else {
            console.log("Homepage.js: Search params detected in URL, letting search.js handle view.");
            if (homepageContent) homepageContent.style.display = 'none'; // Ensure homepage content is hidden
        }
    }

    /**
     * Sets the initial loading state placeholders.
     */
    function setInitialLoadingState() {
         console.log("Homepage.js: Setting initial loading placeholders.");
         if (artistsGrid) artistsGrid.innerHTML = '<div class="loading-placeholder">טוען אמנים...</div>';
         if (songsList) songsList.innerHTML = '<li class="loading-placeholder">טוען שירים...</li>';
         // Ensure homepage content is visible initially, search results hidden
         if (homepageContent) homepageContent.style.display = 'block';
         if (searchResultsArea) searchResultsArea.style.display = 'none';
    }

     /**
     * Displays error messages if data loading fails.
     */
     function displayDataLoadErrorHomepage() {
         console.error("Homepage.js: Displaying data load error.");
         if (artistsGrid) artistsGrid.innerHTML = '<p class="loading-placeholder" style="color: red;">שגיאה בטעינת נתונים.</p>';
         if (songsList) songsList.innerHTML = '<li class="loading-placeholder" style="color: red;">שגיאה בטעינת נתונים.</li>';
     }


    // --- Event Listeners and Initial Check ---

    console.log("Homepage.js: Setting up event listeners.");

    // Listen for the custom event fired by search.js when data is ready
    document.addEventListener('songsDataReady', (event) => {
        console.log("Homepage.js: 'songsDataReady' event caught.");
        if (event.detail && Array.isArray(event.detail)) {
             initializeHomepageContent(event.detail);
        } else {
             console.error("Homepage.js: 'songsDataReady' event fired without valid data array.");
             displayDataLoadErrorHomepage();
        }
    });

     // Listen for the error event from search.js
     document.addEventListener('songsDataError', (event) => {
         console.error("Homepage.js: 'songsDataError' event caught.", event.detail);
         displayDataLoadErrorHomepage();
     });

     // Initial check: Maybe the data loaded *before* this script's listener was attached?
     // Access global flags/data set by search.js
     if (typeof songsDataLoaded !== 'undefined' && songsDataLoaded && typeof allSongs !== 'undefined' && allSongs.length > 0) {
         // Data is already available globally
         console.log("Homepage.js: Data was already loaded, initializing content immediately.");
         initializeHomepageContent(allSongs); // Initialize right away
     }
     // Check if loading failed *before* listener was attached
     else if (typeof songsDataLoaded !== 'undefined' && !songsDataLoaded && typeof isLoadingSongs !== 'undefined' && !isLoadingSongs) {
         console.error("Homepage.js: Data loading seems to have failed before listener was ready.");
         displayDataLoadErrorHomepage();
     }
     // Otherwise, data is still loading or hasn't started yet
     else {
         console.log("Homepage.js: Waiting for 'songsDataReady' event...");
         setInitialLoadingState(); // Show placeholders while waiting
     }

}); // End DOMContentLoaded

console.log("homepage.js loaded");