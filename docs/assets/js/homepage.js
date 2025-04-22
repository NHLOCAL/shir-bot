document.addEventListener('DOMContentLoaded', () => {
    const artistsGrid = document.getElementById('popular-artists-grid');
    const songsList = document.getElementById('random-songs-list');
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');
    const artistsDataElement = document.getElementById('artistsData');

    const NUM_ARTISTS_TO_SHOW = 6;
    const NUM_SONGS_TO_SHOW = 5;


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
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(field =>
                    field.trim().replace(/^"|"$/g, '')
                );
                if (columns.length >= 4 && (columns[0] || columns[1])) { // Ensure serial OR name exists
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

    // --- MODIFIED function to display only singles ---
    function displaySongs(allSongs) {
        if (!songsList) return;

        // --- MODIFICATION START ---
        // Filter for valid songs (have name and serial) that are explicitly marked as singles
        const singleSongs = allSongs.filter(song => {
            // Check if singer or album contains 'סינגל' (singular or plural)
            const isSingle = (song.singer && typeof song.singer === 'string' && song.singer.includes('סינגל')) ||
                           (song.album && typeof song.album === 'string' && song.album.includes('סינגל'));
            // Check if the song has essential data (name AND serial)
            const isValid = song.name && song.serial;
            return isValid && isSingle;
        });
        const randomSongs = getRandomItems(singleSongs, NUM_SONGS_TO_SHOW);
        // --- MODIFICATION END ---

        if (randomSongs.length === 0) {
            songsList.innerHTML = '<li>לא נמצאו סינגלים אחרונים.</li>'; // Updated message
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

        // Add click listeners to search for the song by its serial number
        songsList.querySelectorAll('li[data-song-serial]').forEach(item => {
            item.addEventListener('click', () => {
                const serial = item.dataset.songSerial;
                console.log("Song clicked, searching for serial:", serial);

                // Ensure the search function and UI elements exist
                if (typeof searchSongs === 'function' && typeof showSearchResultsView === 'function') {
                     const searchInput = document.getElementById('searchInput');
                     if(searchInput) searchInput.value = serial; // Put serial in search box

                     // Deactivate all filters and activate the 'serial' filter
                     document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
                     const serialFilterButton = document.querySelector('.filter-button[data-filter="serial"]');
                     if(serialFilterButton) serialFilterButton.classList.add('active');

                     // Trigger the search with the serial number and 'serial' type
                     searchSongs(serial, 'serial');

                     // Switch view to show results
                     showSearchResultsView();
                } else {
                    // Fallback: Redirect to homepage with search parameters if function/view unavailable
                    console.warn("Search function or view switcher not found, redirecting.");
                    window.location.href = `${baseurl || ''}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }


     function showSearchResultsView() {
         if (homepageContent) homepageContent.style.display = 'none';
         if (searchResultsArea) searchResultsArea.style.display = 'block';
         const resultsTable = document.getElementById('resultsTable');
         if(resultsTable) resultsTable.style.display = ''; // Ensure table container is visible
     }

     // Function to switch back to the homepage view (e.g., if search is cleared)
     window.showHomepageView = function() {
         if (homepageContent) homepageContent.style.display = 'block';
         if (searchResultsArea) searchResultsArea.style.display = 'none';
     }

    async function initHomepage() {
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');


        // Load artists from embedded JSON
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


        // Fetch and parse song data from CSV
        let allSongs = [];
        const csvUrl = `${baseurl || ''}/assets/data/songs.csv`; // Use baseurl
        const csvData = await fetchCSV(csvUrl);
        if (csvData) {
            allSongs = parseCSV(csvData);
            if (allSongs.length === 0) {
                 console.warn("Parsed song data from CSV is empty.");
                 if (songsList) songsList.innerHTML = '<li>שגיאה בעיבוד נתוני שירים.</li>';
            } else {
                console.log(`Loaded ${allSongs.length} songs from CSV.`);
            }
        } else {
            // Handle CSV fetch failure
            if (songsList) songsList.innerHTML = '<li>שגיאה בטעינת נתוני שירים.</li>';
        }


        // Decide whether to show homepage or search results based on URL params
        if (hasSearchParams) {
             console.log("Search params detected, hiding homepage content initially.");
             showSearchResultsView();
             // Note: The actual search based on params is handled in search.js's DOMContentLoaded
        } else {
             console.log("No search params, showing homepage content.");
             showHomepageView();

             // Display artists and songs (now filtered for singles)
             displayArtists(artistsFromCollection);
             if (allSongs.length > 0) {
                 displaySongs(allSongs); // This now displays only singles
             }
        }

    }

    // Initialize the homepage logic
    initHomepage();

});