// assets/js/homepage.js

// Dependencies:
// - Global `baseurl` variable (from layout)
// - `searchSongs` function from search.js (if available) for song clicks
// - `fetchCSV`, `parseCSV` (needed ONLY for random songs list)

document.addEventListener('DOMContentLoaded', () => {
    const artistsGrid = document.getElementById('popular-artists-grid');
    const songsList = document.getElementById('random-songs-list');
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');
    const artistsDataElement = document.getElementById('artistsData'); // Get the embedded data script tag

    const NUM_ARTISTS_TO_SHOW = 6;
    const NUM_SONGS_TO_SHOW = 5;

    // --- Data Fetching and Parsing (Adapted from search.js - needed for SONGS ONLY) ---
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

    // --- Updated function to use data from site.artists (via embedded JSON) ---
    function displayArtists(availableArtists) {
        if (!artistsGrid) return;

        // Get random artists directly from the provided list
        const randomArtists = getRandomItems(availableArtists, NUM_ARTISTS_TO_SHOW);

        if (randomArtists.length === 0) {
            artistsGrid.innerHTML = '<p>לא נטענו אמנים.</p>';
            return;
        }

        let html = '';
        randomArtists.forEach(artist => {
            // Use the name and url directly from the artist object
            const artistUrl = artist.url;
            const singerName = artist.name;

            html += `
                <div class="artist-item" data-artist-name="${singerName}">
                    <a href="${artistUrl}" class="artist-circle" title="עבור לדף האמן ${singerName}">
                       <i class="fas fa-user"></i>
                    </a>
                    <span class="artist-name">${singerName}</span>
                </div>`;
        });
        artistsGrid.innerHTML = html;
    }

    // --- This function remains the same, using CSV data ---
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

                if (typeof searchSongs === 'function') {
                     const searchInput = document.getElementById('searchInput');
                     if(searchInput) searchInput.value = serial;
                     document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
                     const serialFilterButton = document.querySelector('.filter-button[data-filter="serial"]');
                     if(serialFilterButton) serialFilterButton.classList.add('active');
                     searchSongs(serial, 'serial');
                     showSearchResultsView();
                } else {
                    window.location.href = `${baseurl}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }

     function showSearchResultsView() {
         if (homepageContent) homepageContent.style.display = 'none';
         if (searchResultsArea) searchResultsArea.style.display = 'block';
         const resultsTable = document.getElementById('resultsTable');
         if(resultsTable) resultsTable.style.display = '';
     }

     window.showHomepageView = function() {
         if (homepageContent) homepageContent.style.display = 'block';
         if (searchResultsArea) searchResultsArea.style.display = 'none';
     }

    async function initHomepage() {
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');

        // 1. Read Artist Data from Embedded JSON
        let artistsFromCollection = [];
        if (artistsDataElement) {
            try {
                artistsFromCollection = JSON.parse(artistsDataElement.textContent);
                console.log(`Loaded ${artistsFromCollection.length} artists from embedded data.`);
            } catch (e) {
                console.error("Failed to parse artists JSON data:", e);
                 if (artistsGrid) artistsGrid.innerHTML = '<p>שגיאה בטעינת נתוני אמנים.</p>';
            }
        } else {
            console.warn("Artists data script tag (#artistsData) not found.");
             if (artistsGrid) artistsGrid.innerHTML = '<p>שגיאה בטעינת נתוני אמנים.</p>';
        }

        // 2. Fetch and Parse CSV for Songs (still needed)
        let allSongs = [];
        const csvUrl = `${baseurl}/assets/data/songs.csv`;
        const csvData = await fetchCSV(csvUrl);
        if (csvData) {
            allSongs = parseCSV(csvData);
            if (allSongs.length === 0) {
                 console.warn("Parsed song data from CSV is empty.");
                 if (songsList) songsList.innerHTML = '<li>שגיאה בעיבוד נתוני שירים.</li>';
            }
        } else {
            if (songsList) songsList.innerHTML = '<li>שגיאה בטעינת נתוני שירים.</li>';
        }

        // 3. Handle View Logic (Search Params vs Homepage)
        if (hasSearchParams) {
             console.log("Search params detected, hiding homepage content initially.");
             showSearchResultsView(); // Start in search view
             // Let search.js handle the actual search based on params
        } else {
             console.log("No search params, showing homepage content.");
             showHomepageView(); // Start in homepage view

             // Display Artists using data from _artists collection
             displayArtists(artistsFromCollection);

             // Display Songs using data from CSV
             if (allSongs.length > 0) {
                 displaySongs(allSongs);
             }
        }
         // Let ads.js handle the rotating ad content
    }

    initHomepage();

});