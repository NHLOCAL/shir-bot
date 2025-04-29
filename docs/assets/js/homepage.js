document.addEventListener('DOMContentLoaded', () => {
    console.log("Homepage.js: DOMContentLoaded");

    const artistsGrid = document.getElementById('popular-artists-grid');
    const songsList = document.getElementById('random-songs-list');
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');

    const NUM_ARTISTS_TO_SHOW = 6;
    const NUM_SONGS_TO_SHOW = 5;

    function getUniqueArtists(allSongs) {
        if (!Array.isArray(allSongs)) return [];
        const artistMap = new Map();
        console.log("Homepage.js: Filtering artists based on word count (max 3 words)...");
        let skippedCount = 0;

        allSongs.forEach(song => {
            const singerName = song.singer;
            if (singerName && !artistMap.has(singerName)) {
                const wordCount = singerName.split(/\s+/).filter(Boolean).length;
                if (wordCount <= 3) {
                    let slug = "unknown-artist";
                    try {
                        if (typeof UNF !== 'undefined' && UNF.Normalizer) {
                            const normalized_text = UNF.Normalizer.normalize(singerName, 'nfkc').toLowerCase();
                            slug = normalized_text.replace(/[^a-z0-9\u0590-\u05FF\-]+/g, '-').replace(/^-+|-+$/g, '');
                            slug = slug || "artist";
                        } else {
                            slug = singerName.toLowerCase().replace(/[^a-z0-9\u0590-\u05FF\-]+/g, '-').replace(/^-+|-+$/g, '');
                            slug = slug || "artist";
                        }
                    } catch (e) {
                         console.error("Error creating slug for artist:", singerName, e);
                         slug = "error-artist";
                    }
                    artistMap.set(singerName, `${baseurl || ''}/artists/${slug}/`);
                } else {
                    skippedCount++;
                }
            }
        });

        if (typeof UNF === 'undefined') {
            console.warn("UNF library not loaded, using basic slug generation for artists.");
        }
        console.log(`Homepage.js: Filtered artists. Kept ${artistMap.size}, skipped ${skippedCount} due to word count.`);

        return Array.from(artistMap, ([name, url]) => ({ name, url })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }

    function getRandomItems(array, count) {
        if (!array || array.length === 0) return [];
        const shuffled = array.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, count);
    }

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
            const artistNameEscaped = artist.name.replace(/"/g, '"');
            html += `
                <div class="artist-item" data-artist-name="${artistNameEscaped}">
                    <a href="${artist.url}" class="artist-circle" title="עבור לדף האמן ${artistNameEscaped}">
                       <i class="fas fa-user"></i>
                    </a>
                    <span class="artist-name">${artist.name}</span>
                </div>`;
        });
        artistsGrid.innerHTML = html;

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

    function displaySongs(newSongsData) {
        if (!songsList) {
            console.warn("Homepage.js: songsList element not found.");
            return;
        }

        const displayableNewSongs = newSongsData.filter(song => song && song.name && song.serial && song.driveId);
        const randomNewSongs = getRandomItems(displayableNewSongs, NUM_SONGS_TO_SHOW);

        if (randomNewSongs.length === 0) {
            songsList.innerHTML = '<li class="loading-placeholder">לא נמצאו שירים חדשים להצגה.</li>';
            return;
        }

        let html = '';
        randomNewSongs.forEach(song => {
             const songNameEscaped = song.name.replace(/"/g, '"');
            html += `
                <li data-song-serial="${song.serial}" title="חפש את '${songNameEscaped}'">
                    <i class="fas fa-music song-icon"></i>
                    ${song.name} - ${song.singer || 'לא ידוע'}
                </li>`;
        });
        songsList.innerHTML = html;

        songsList.querySelectorAll('li[data-song-serial]').forEach(item => {
            item.addEventListener('click', () => {
                const serial = item.dataset.songSerial;
                console.log("Homepage.js: Song clicked, serial:", serial);

                const searchInputGlobal = document.getElementById('searchInput');
                const searchHandler = window.searchSongs;
                const filterHandler = window.handleFilterClick;
                const isDataReady = typeof songsDataLoaded !== 'undefined' && songsDataLoaded;

                if (searchHandler && filterHandler && searchInputGlobal && isDataReady) {
                     searchInputGlobal.value = serial;
                     filterHandler('serial');
                     searchHandler(serial, 'serial');
                     filterHandler('all');

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
                    console.warn("Homepage.js: Search/filter functions or input not found, redirecting as fallback.");
                    window.location.href = `${baseurl || ''}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }

    function initializeHomepageContent(allSongsData, newSongsData) {
        console.log("Homepage.js: Initializing content (songsDataReady event received).");
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');

        if (!hasSearchParams) {
            if (homepageContent) homepageContent.style.display = 'block';
            if (searchResultsArea) searchResultsArea.style.display = 'none';

            const uniqueArtists = getUniqueArtists(allSongsData);
            displayArtists(uniqueArtists);

            if (newSongsData && newSongsData.length > 0) {
                displaySongs(newSongsData);
            } else {
                if (songsList) songsList.innerHTML = '<li class="loading-placeholder">לא נמצאו שירים חדשים.</li>';
            }
        } else {
            console.log("Homepage.js: Search params detected in URL, letting search.js handle view.");
            if (homepageContent) homepageContent.style.display = 'none';
        }
    }

    function setInitialLoadingState() {
         console.log("Homepage.js: Setting initial loading placeholders.");
         if (artistsGrid) artistsGrid.innerHTML = '<div class="loading-placeholder">טוען אמנים...</div>';
         if (songsList) songsList.innerHTML = '<li class="loading-placeholder">טוען שירים...</li>';

         if (homepageContent) homepageContent.style.display = 'block';
         if (searchResultsArea) searchResultsArea.style.display = 'none';
    }

     function displayDataLoadErrorHomepage() {
         console.error("Homepage.js: Displaying data load error.");
         if (artistsGrid) artistsGrid.innerHTML = '<p class="loading-placeholder" style="color: red;">שגיאה בטעינת נתונים.</p>';
         if (songsList) songsList.innerHTML = '<li class="loading-placeholder" style="color: red;">שגיאה בטעינת נתונים.</li>';
     }

    console.log("Homepage.js: Setting up event listeners.");

    document.addEventListener('songsDataReady', (event) => {
        console.log("Homepage.js: 'songsDataReady' event caught.");
        if (event.detail && typeof event.detail === 'object' && Array.isArray(event.detail.allSongs) && Array.isArray(event.detail.newSongs)) {
             initializeHomepageContent(event.detail.allSongs, event.detail.newSongs);
        } else {
             console.error("Homepage.js: 'songsDataReady' event fired without valid data object {allSongs, newSongs}.");
             displayDataLoadErrorHomepage();
        }
    });

     document.addEventListener('songsDataError', (event) => {
         console.error("Homepage.js: 'songsDataError' event caught.", event.detail);
         displayDataLoadErrorHomepage();
     });

     if (typeof songsDataLoaded !== 'undefined' && !songsDataLoaded && typeof isLoadingSongs !== 'undefined' && !isLoadingSongs) {
         console.error("Homepage.js: Data loading seems to have failed before listener was ready.");
         displayDataLoadErrorHomepage();
     }
     else {
         console.log("Homepage.js: Waiting for 'songsDataReady' event...");
         setInitialLoadingState();
     }

});

console.log("homepage.js loaded");