// File: assets/js/homepage.js

document.addEventListener('DOMContentLoaded', () => {
    const artistsGrid = document.getElementById('popular-artists-grid');
    const songsList = document.getElementById('random-songs-list');
    const homepageContent = document.getElementById('homepage-content'); // Keep reference if needed
    const searchResultsArea = document.getElementById('search-results-area'); // Keep reference if needed
    // --- שינוי: הסרת artistsDataElement, הנתונים גלובליים ---
    // const artistsDataElement = document.getElementById('artistsData');
    // -----------------------------------------------------

    const NUM_ARTISTS_TO_SHOW = 6;
    const NUM_SONGS_TO_SHOW = 5; // או מספר אחר רצוי

    // --- שינוי: הסרת fetchCSV ו-parseCSV ---
    // async function fetchCSV(url) { ... }
    // function parseCSV(csvText) { ... }
    // ---------------------------------------

    // Function to get unique artists from song data
    function getUniqueArtists(allSongs) {
        if (!Array.isArray(allSongs)) return [];
        const artistMap = new Map();
        allSongs.forEach(song => {
            if (song.singer && !artistMap.has(song.singer)) {
                // Generate slug similar to the plugin for linking (handle Hebrew)
                 const normalized_text = typeof UNF !== 'undefined' ? UNF.normalize(song.singer, 'nfkc').toLowerCase() : song.singer.toLowerCase();
                 let slug = normalized_text.replace(/[\s.\/\\?%*:|"<>]+/g, '-');
                 slug = slug.replace(/^-+|-+$/g, '');
                 slug = slug || "artist"; // Fallback if slug becomes empty
                artistMap.set(song.singer, `${baseurl || ''}/artists/${slug}/`); // Construct the expected URL
            }
        });
        // Convert Map to array of objects [{name: '...', url: '...'}]
        return Array.from(artistMap, ([name, url]) => ({ name, url }));
    }


    function getRandomItems(array, count) {
        if (!array || array.length === 0) return [];
        const shuffled = array.slice().sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    // --- Updated function to use artists derived from allSongs data ---
    function displayArtists(availableArtists) {
        if (!artistsGrid) return;

        const randomArtists = getRandomItems(availableArtists, NUM_ARTISTS_TO_SHOW);

        if (randomArtists.length === 0) {
            artistsGrid.innerHTML = '<p class="loading-placeholder">לא נמצאו אמנים.</p>';
            return;
        }

        let html = '';
        randomArtists.forEach(artist => {
            // Use name and generated URL
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

         // Add GA event tracking for artist clicks if needed
        artistsGrid.querySelectorAll('a.artist-circle').forEach(link => {
            link.addEventListener('click', (event) => {
                const artistName = link.closest('.artist-item')?.dataset.artistName || 'unknown';
                 if (typeof gtag === 'function') {
                    gtag('event', 'select_content', {
                        'content_type': 'artist_homepage_grid',
                        'item_id': artistName
                    });
                 }
                 // Allow default navigation
            });
        });
    }

    // --- Updated function to display songs from allSongs data ---
    // (Optional: Filter for singles if still desired, or show any random)
    function displaySongs(allSongs) {
        if (!songsList) return;

        // Example: Filter for songs with a driveId (implies they are likely downloadable)
        // Or apply the 'סינגלים' filter if needed
        const downloadableSongs = allSongs.filter(song => song.driveId && song.name && song.serial);
        /* // Alternative: Filter for singles
        const singleSongs = allSongs.filter(song => {
             const isSingle = (song.singer && typeof song.singer === 'string' && song.singer.includes('סינגל')) ||
                            (song.album && typeof song.album === 'string' && song.album.includes('סינגל'));
             const isValid = song.name && song.serial && song.driveId; // Ensure valid data
             return isValid && isSingle;
         }); */

        const randomSongs = getRandomItems(downloadableSongs, NUM_SONGS_TO_SHOW); // Use the filtered list

        if (randomSongs.length === 0) {
            songsList.innerHTML = '<li class="loading-placeholder">לא נמצאו שירים להצגה.</li>';
            return;
        }

        let html = '';
        randomSongs.forEach(song => {
            html += `
                <li data-song-serial="${song.serial}" title="חפש את '${song.name}'">
                    <i class="fas fa-music song-icon"></i> <!-- Changed icon -->
                    ${song.name} - ${song.singer || 'לא ידוע'}
                </li>`;
        });
        songsList.innerHTML = html;

        // Add click listeners to search for the song by its serial number
        songsList.querySelectorAll('li[data-song-serial]').forEach(item => {
            item.addEventListener('click', () => {
                const serial = item.dataset.songSerial;
                console.log("Homepage song clicked, searching for serial:", serial);

                // Ensure search function and UI elements exist from search.js
                const searchInputGlobal = document.getElementById('searchInput');
                const searchHandler = window.searchSongs; // Access search function globally
                const filterHandler = window.handleFilterClick; // Access filter function globally

                if (searchHandler && filterHandler && searchInputGlobal) {
                     searchInputGlobal.value = serial; // Put serial in search box

                     // Activate the 'serial' filter visually
                     filterHandler('serial', false); // Update filter buttons without triggering search yet

                     // Trigger the search with the serial number and 'serial' type
                     searchHandler(serial, 'serial'); // This will also switch the view

                      // Optional: GA Event for homepage song click leading to search
                      if (typeof gtag === 'function') {
                         gtag('event', 'select_content', {
                           'content_type': 'song_homepage_list',
                           'item_id': serial
                         });
                      }

                } else {
                    // Fallback: Redirect to homepage with search parameters if functions unavailable
                    console.warn("Search function/filter function/input not found, redirecting as fallback.");
                    window.location.href = `${baseurl || ''}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }


     // --- שינוי: הסרת פונקציות החלפת תצוגה ---
     // search.js מטפל בזה כעת דרך searchSongs
     /*
     function showSearchResultsView() { ... }
     window.showHomepageView = function() { ... }
     */
     // ------------------------------------------

    // --- Updated initHomepage ---
    function initHomepage() {
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');

        // --- שינוי: קבלת נתונים מהמשתנה הגלובלי ---
        let localAllSongs = [];
        if (window.allSongsData && Array.isArray(window.allSongsData)) {
            localAllSongs = window.allSongsData;
             console.log(`Homepage.js: Using ${localAllSongs.length} songs from global data.`);
        } else {
            console.error("Homepage.js: Global song data (window.allSongsData) not found or invalid.");
             if (artistsGrid) artistsGrid.innerHTML = '<p class="loading-placeholder">שגיאה בטעינת נתונים.</p>';
             if (songsList) songsList.innerHTML = '<li class="loading-placeholder">שגיאה בטעינת נתונים.</li>';
             // Don't proceed if data is missing
        }
        // ------------------------------------------

        // If search params exist, search.js's init logic should handle showing results.
        // If no search params, display homepage content.
        if (!hasSearchParams) {
             console.log("Homepage.js: No search params, showing homepage content.");
             if (homepageContent) homepageContent.style.display = 'block'; // Ensure visible
             if (searchResultsArea) searchResultsArea.style.display = 'none'; // Ensure hidden

             // Generate artists list from the loaded songs
             const uniqueArtists = getUniqueArtists(localAllSongs);
             displayArtists(uniqueArtists);

             // Display random songs
             if (localAllSongs.length > 0) {
                 displaySongs(localAllSongs);
             }
        } else {
            // If search params *are* present, search.js initializer should have
            // already called searchSongs, which hides homepage content.
            // We don't need to do anything extra here.
             console.log("Homepage.js: Search params detected, homepage content should be hidden by search.js.");
              if (homepageContent) homepageContent.style.display = 'none'; // Explicitly hide just in case
        }
    }

    // --- קריאה לאתחול ---
    // Ensure UNF is loaded if needed for slug generation, might need to wait or check
     if (typeof UNF !== 'undefined') {
         initHomepage();
     } else {
         // Fallback or wait if UNF loads async (less likely with simple include)
         console.warn("Homepage.js: UNF library not found, artist links might be incorrect.");
         initHomepage(); // Try anyway
     }

});