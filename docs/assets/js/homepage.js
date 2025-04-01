// assets/js/homepage.js

// Dependencies:
// - Global `baseurl` variable (from layout)
// - `searchSongs` function from search.js (if available) for song clicks
// - `fetchCSV`, `parseCSV` (can be copied/adapted from search.js or assumed available)

document.addEventListener('DOMContentLoaded', () => {
    const artistsGrid = document.getElementById('popular-artists-grid');
    const songsList = document.getElementById('random-songs-list');
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');

    const NUM_ARTISTS_TO_SHOW = 6;
    const NUM_SONGS_TO_SHOW = 5;

    // --- Data Fetching and Parsing (Adapted from search.js - ensure consistency) ---
    async function fetchCSV(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.text();
        } catch (error) {
            console.error(`Failed to fetch CSV from ${url}:`, error);
            return null;
        }
    }

    function parseCSV(csvText) {
        if (!csvText) return [];
        const lines = csvText.split('\n');
        const songs = [];
        for (let i = 1; i < lines.length; i++) { // Skip header
            const line = lines[i].trim();
            if (line) {
                const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(field =>
                    field.trim().replace(/^"|"$/g, '')
                );
                if (columns.length >= 4 && (columns[0] || columns[1])) {
                    songs.push({
                        serial: columns[0] || '',
                        name: columns[1] || '',
                        album: columns[2] || '',
                        singer: columns[3] || ''
                    });
                }
            }
        }
        return songs;
    }
    // --- End Data Fetching/Parsing ---

    function getRandomItems(array, count) {
        if (!array || array.length === 0) return [];
        const shuffled = array.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    function displayArtists(allSongs) {
        if (!artistsGrid) return;

        // Extract unique, non-empty, non-"סינגלים" singer names
        const uniqueSingers = [...new Set(allSongs.map(song => song.singer))]
            .filter(singer => singer && !singer.toLowerCase().includes('סינגלים') && singer.trim() !== '');

        const randomSingers = getRandomItems(uniqueSingers, NUM_ARTISTS_TO_SHOW);

        if (randomSingers.length === 0) {
            artistsGrid.innerHTML = '<p>לא נטענו אמנים.</p>';
            return;
        }

        let html = '';
        randomSingers.forEach(singer => {
            // Generate URL-safe name (simple version)
            const safeName = singer.replace(/\s+/g, '-').replace(/[/\\?%*:|"<>]/g, '');
            const artistUrl = `${baseurl}/artists/${safeName}/`; // Assumes permalink structure

            html += `
                <div class="artist-item" data-artist-name="${singer}">
                    <a href="${artistUrl}" class="artist-circle" title="עבור לדף האמן ${singer}">
                       <i class="fas fa-user"></i>
                    </a>
                    <span class="artist-name">${singer}</span>
                </div>`;
        });
        artistsGrid.innerHTML = html;

        // Add click listeners (optional, as links work directly)
        // artistsGrid.querySelectorAll('.artist-item').forEach(item => {
        //     item.addEventListener('click', (e) => {
        //         // Could potentially use search instead of direct link
        //         const artistName = item.dataset.artistName;
        //         console.log("Artist clicked:", artistName);
        //         // window.location.href = item.querySelector('a').href; // Direct link handled by <a>
        //     });
        // });
    }

    function displaySongs(allSongs) {
        if (!songsList) return;

        // Filter out songs without a name or serial
        const validSongs = allSongs.filter(song => song.name && song.serial);
        const randomSongs = getRandomItems(validSongs, NUM_SONGS_TO_SHOW);

        if (randomSongs.length === 0) {
            songsList.innerHTML = '<li>לא נטענו שירים.</li>';
            return;
        }

        let html = '';
        randomSongs.forEach(song => {
            html += `
                <li data-song-serial="${song.serial}" title="חפש את '${song.name}'">
                    <i class="fas fa-compact-disc song-icon"></i>
                    ${song.name} - ${song.singer || 'לא ידוע'}
                </li>`;
        });
        songsList.innerHTML = html;

        // Add click listeners to search for the song
        songsList.querySelectorAll('li[data-song-serial]').forEach(item => {
            item.addEventListener('click', () => {
                const serial = item.dataset.songSerial;
                console.log("Song clicked, searching for serial:", serial);

                // Use searchSongs function from search.js if available
                if (typeof searchSongs === 'function') {
                     // Update search input visually
                     const searchInput = document.getElementById('searchInput');
                     if(searchInput) searchInput.value = serial;
                     // Set filter visually
                     document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
                     const serialFilterButton = document.querySelector('.filter-button[data-filter="serial"]');
                     if(serialFilterButton) serialFilterButton.classList.add('active');
                     // Trigger search
                     searchSongs(serial, 'serial');
                     // Switch view
                     showSearchResultsView();
                } else {
                    // Fallback: Redirect to index with search params
                    window.location.href = `${baseurl}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }

     // Function to switch view from homepage content to search results
     function showSearchResultsView() {
         if (homepageContent) homepageContent.style.display = 'none';
         if (searchResultsArea) searchResultsArea.style.display = 'block';
         // Ensure results table itself is visible if it was hidden separately
         const resultsTable = document.getElementById('resultsTable');
         if(resultsTable) resultsTable.style.display = ''; // Or 'table'
     }

     // Function to switch view back to homepage (e.g., if search is cleared)
     window.showHomepageView = function() { // Expose globally for search.js potentially
         if (homepageContent) homepageContent.style.display = 'block';
         if (searchResultsArea) searchResultsArea.style.display = 'none';
     }

    async function initHomepage() {
        // Check if we are already showing search results from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');

        if (hasSearchParams) {
             console.log("Search params detected, hiding homepage content initially.");
             showSearchResultsView(); // Start in search view
             // Let search.js handle the actual search based on params
        } else {
             console.log("No search params, showing homepage content.");
             showHomepageView(); // Start in homepage view
             const csvUrl = `${baseurl}/assets/data/songs.csv`;
             const csvData = await fetchCSV(csvUrl);
             if (csvData) {
                 const allSongs = parseCSV(csvData);
                 if (allSongs.length > 0) {
                     displayArtists(allSongs);
                     displaySongs(allSongs);
                 } else {
                     if (artistsGrid) artistsGrid.innerHTML = '<p>שגיאה בעיבוד נתוני שירים.</p>';
                     if (songsList) songsList.innerHTML = '<li>שגיאה בעיבוד נתוני שירים.</li>';
                 }
             } else {
                 if (artistsGrid) artistsGrid.innerHTML = '<p>שגיאה בטעינת נתוני שירים.</p>';
                 if (songsList) songsList.innerHTML = '<li>שגיאה בטעינת נתוני שירים.</li>';
             }
        }
         // Let ads.js handle the rotating ad content
    }

    initHomepage();

});