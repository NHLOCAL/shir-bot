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

        const artistSongCounts = {}; // אובייקט לספירת שירים לאמן
        console.log("Homepage.js: Counting songs per artist (max 3 words)...");
        let initialSkippedCount = 0;
        let wordCountSkippedCount = 0;

        // שלב 1: ספירת שירים לכל אמן שעומד בקריטריון ספירת המילים
        allSongs.forEach(song => {
            const singerName = song.singer;
            if (singerName && singerName.trim() !== '') {
                const wordCount = singerName.split(/\s+/).filter(Boolean).length;
                if (wordCount <= 3) {
                    artistSongCounts[singerName] = (artistSongCounts[singerName] || 0) + 1;
                } else {
                    wordCountSkippedCount++;
                }
            } else {
                initialSkippedCount++; // ספירת שירים ללא שם זמר או שם ריק
            }
        });
        console.log(`Homepage.js: Initial song count complete. Artists considered: ${Object.keys(artistSongCounts).length}. Skipped initial (no/empty name): ${initialSkippedCount}. Skipped word count (>3): ${wordCountSkippedCount}.`);

        // שלב 2: סינון אמנים לפי ספירת שירים (>= 3) ויצירת רשימה סופית עם URL
        const filteredArtists = [];
        let songCountSkippedCount = 0;
        console.log("Homepage.js: Filtering artists by song count (>= 3)...");

        for (const singerName in artistSongCounts) {
            // לוודא שאנחנו עובדים רק על מאפיינים ישירים של האובייקט
            if (artistSongCounts.hasOwnProperty(singerName)) {
                const count = artistSongCounts[singerName];
                if (count >= 3) {
                    let slug = "unknown-artist"; // ברירת מחדל ל-slug
                    try {
                        // שימוש חוזר בלוגיקת יצירת ה-slug הקיימת
                        if (typeof UNF !== 'undefined' && UNF.Normalizer) {
                            // שימוש בספריית UNF אם קיימת
                            const normalized_text = UNF.Normalizer.normalize(singerName, 'nfkc').toLowerCase();
                            slug = normalized_text.replace(/[^a-z0-9\u0590-\u05FF\-]+/g, '-'); // כולל תווים בעברית
                            slug = slug.replace(/-+/g, '-'); // החלפת מקפים כפולים
                            slug = slug.replace(/^-+|-+$/g, ''); // הסרת מקפים מהתחלה/סוף
                            slug = slug || "artist"; // Fallback for empty slug after normalization
                        } else {
                            // Fallback basic slug generation if UNF is not available
                            slug = singerName.toLowerCase()
                                .replace(/\s+/g, '-') // החלפת רווחים במקף
                                .replace(/[^a-z0-9\u0590-\u05ff\-]+/g, '') // הסרת תווים לא חוקיים (כולל עברית)
                                .replace(/-+/g, '-'); // החלפת מקפים כפולים
                            slug = slug.replace(/^-+|-+$/g, ''); // הסרת מקפים מהתחלה/סוף
                            slug = slug || "artist"; // Fallback for empty slug
                        }
                    } catch (e) {
                         console.error("Error creating slug for artist:", singerName, e);
                         slug = "error-artist"; // סלאג במקרה של שגיאה
                    }
                    filteredArtists.push({ name: singerName, url: `${baseurl || ''}/artists/${slug}/` });
                } else {
                    songCountSkippedCount++; // ספירת אמנים שנדחו עקב מיעוט שירים
                }
            }
        }

        if (typeof UNF === 'undefined') {
            console.warn("UNF library not loaded, using basic slug generation for artists.");
        }
        console.log(`Homepage.js: Artist filtering complete. Kept ${filteredArtists.length} artists (>= 3 songs). Skipped by song count (<3): ${songCountSkippedCount}.`);

        // מיון הרשימה הסופית לפי שם אמן בעברית
        return filteredArtists.sort((a, b) => a.name.localeCompare(b.name, 'he'));
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
        // קח כמות רנדומלית *מתוך הרשימה שכבר סוננה*
        const randomArtists = getRandomItems(availableArtists, NUM_ARTISTS_TO_SHOW);

        if (randomArtists.length === 0) {
            artistsGrid.innerHTML = '<p class="loading-placeholder">לא נמצאו אמנים להצגה (עם 3 שירים לפחות).</p>';
            return;
        }

        let html = '';
        randomArtists.forEach(artist => {
            // Escape quotes in artist name for the title attribute
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

        // הוספת event listeners ללחיצות על אמנים (כמו שהיה)
        artistsGrid.querySelectorAll('a.artist-circle').forEach(link => {
            link.addEventListener('click', (event) => {
                const artistName = link.closest('.artist-item')?.dataset.artistName || 'unknown';
                 if (typeof gtag === 'function') {
                    gtag('event', 'select_content', {
                        'content_type': 'artist_homepage_grid',
                        'item_id': artistName
                    });
                 }
                 // אין צורך ב-event.preventDefault() כי זה קישור רגיל לדף האמן
            });
        });
    }

    function displaySongs(allSongs) {
        if (!songsList) {
            console.warn("Homepage.js: songsList element not found.");
            return;
        }

        // סינון שירים שניתן להציג (עם שם, מספר סידורי ו-Drive ID)
        const displayableSongs = allSongs.filter(song => song && song.name && song.serial && song.driveId);
        const randomSongs = getRandomItems(displayableSongs, NUM_SONGS_TO_SHOW);

        if (randomSongs.length === 0) {
            songsList.innerHTML = '<li class="loading-placeholder">לא נמצאו שירים להצגה.</li>';
            return;
        }

        let html = '';
        randomSongs.forEach(song => {
             // Escape quotes in song name for the title attribute
             const songNameEscaped = song.name.replace(/"/g, '"');
             const singerName = song.singer || 'לא ידוע'; // Fallback for missing singer name
             const titleText = `חפש את '${songNameEscaped}' מאת ${singerName}`;
            html += `
                <li data-song-serial="${song.serial}" title="${titleText}">
                    <i class="fas fa-music song-icon"></i>
                    ${song.name} - ${singerName}
                </li>`;
        });
        songsList.innerHTML = html;

        // הוספת event listeners ללחיצות על שירים (כמו שהיה)
        songsList.querySelectorAll('li[data-song-serial]').forEach(item => {
            item.addEventListener('click', () => {
                const serial = item.dataset.songSerial;
                console.log("Homepage.js: Song clicked, serial:", serial);

                const searchInputGlobal = document.getElementById('searchInput');
                // בדיקה אם פונקציות החיפוש והפילטר זמינות ב-window
                const searchHandler = typeof window.searchSongs === 'function' ? window.searchSongs : null;
                const filterHandler = typeof window.handleFilterClick === 'function' ? window.handleFilterClick : null;
                const isDataReady = typeof songsDataLoaded !== 'undefined' && songsDataLoaded;

                if (searchHandler && filterHandler && searchInputGlobal && isDataReady) {
                     // ממלאים את תיבת החיפוש עם המספר הסידורי
                     searchInputGlobal.value = serial;
                     // מפעילים את הפילטר על 'serial' כדי שהחיפוש יתבצע לפי מספר סידורי
                     filterHandler('serial', false); // false - not triggered by user click directly
                     // מבצעים את החיפוש
                     searchHandler(serial, 'serial');
                     // מחזירים את הפילטר הפעיל ל'all' (או משאירים 'serial' אם רוצים)
                     // filterHandler('all', false); // uncomment if you want to reset filter visually

                      // שליחת אירוע ל-GA
                      if (typeof gtag === 'function') {
                         gtag('event', 'select_content', {
                           'content_type': 'song_homepage_list',
                           'item_id': serial
                         });
                      }
                } else if (!isDataReady) {
                     console.warn("Homepage.js: Song clicked, but song data is not ready yet.");
                     // הצגת הודעה למשתמש שהנתונים עדיין נטענים
                     if(typeof showMessage === 'function') showMessage("מאגר השירים עדיין בטעינה, נסה לחפש שוב בעוד רגע.");
                } else {
                    // Fallback אם הפונקציות לא נמצאו - הפנייה עם פרמטרים ב-URL
                    console.warn("Homepage.js: Search/filter functions or input not found, redirecting as fallback.");
                    window.location.href = `${baseurl || ''}/?search=${encodeURIComponent(serial)}&searchBy=serial`;
                }
            });
        });
    }

    function initializeHomepageContent(songs) {
        console.log("Homepage.js: Initializing content (songsDataReady event received).");
        const urlParams = new URLSearchParams(window.location.search);
        const hasSearchParams = urlParams.has('search') || urlParams.has('searchBy');

        if (!hasSearchParams) {
            // רק אם אין פרמטרי חיפוש ב-URL, נציג את תוכן דף הבית
            if (homepageContent) homepageContent.style.display = 'block';
            if (searchResultsArea) searchResultsArea.style.display = 'none'; // הסתר אזור תוצאות חיפוש

            // קבל והצג אמנים (כבר מסוננים לפי 3 שירים ומעלה)
            const uniqueArtists = getUniqueArtists(songs);
            displayArtists(uniqueArtists);

            // הצג שירים רנדומליים
            if (songs && songs.length > 0) {
                displaySongs(songs);
            } else {
                if (songsList) songsList.innerHTML = '<li class="loading-placeholder">לא נמצאו שירים במאגר.</li>';
            }
        } else {
            // אם יש פרמטרי חיפוש, search.js אמור לטפל בהצגה
            console.log("Homepage.js: Search params detected in URL, letting search.js handle view.");
            if (homepageContent) homepageContent.style.display = 'none'; // הסתר תוכן דף הבית
        }
    }

    function setInitialLoadingState() {
         console.log("Homepage.js: Setting initial loading placeholders.");
         if (artistsGrid) artistsGrid.innerHTML = '<div class="loading-placeholder">טוען אמנים...</div>';
         if (songsList) songsList.innerHTML = '<li class="loading-placeholder">טוען שירים...</li>';

         // בהתחלה, נניח שאין פרמטרי חיפוש ונציג את דף הבית
         if (homepageContent) homepageContent.style.display = 'block';
         if (searchResultsArea) searchResultsArea.style.display = 'none';
    }

     function displayDataLoadErrorHomepage() {
         console.error("Homepage.js: Displaying data load error.");
         if (artistsGrid) artistsGrid.innerHTML = '<p class="loading-placeholder" style="color: red;">שגיאה בטעינת נתוני האמנים.</p>';
         if (songsList) songsList.innerHTML = '<li class="loading-placeholder" style="color: red;">שגיאה בטעינת נתוני השירים.</li>';
     }

    // --- הגדרת Event Listeners והתנהגות ראשונית ---
    console.log("Homepage.js: Setting up event listeners.");

    // האזנה לאירוע שהנתונים מוכנים (נשלח מ-search.js)
    document.addEventListener('songsDataReady', (event) => {
        console.log("Homepage.js: 'songsDataReady' event caught.");
        if (event.detail && Array.isArray(event.detail)) {
             // רק כשהנתונים מוכנים, נאתחל את תוכן דף הבית
             initializeHomepageContent(event.detail);
        } else {
             console.error("Homepage.js: 'songsDataReady' event fired without valid data array.");
             displayDataLoadErrorHomepage();
        }
    });

    // האזנה לאירוע של שגיאה בטעינת הנתונים
     document.addEventListener('songsDataError', (event) => {
         console.error("Homepage.js: 'songsDataError' event caught.", event.detail);
         displayDataLoadErrorHomepage();
     });

    // בדיקה אם הנתונים כבר נטענו *לפני* שה-Listener הזה נרשם
     if (typeof songsDataLoaded !== 'undefined' && songsDataLoaded && typeof allSongs !== 'undefined' && allSongs.length > 0) {
         console.log("Homepage.js: Data was already loaded, initializing content immediately.");
         initializeHomepageContent(allSongs);
     }
     // בדיקה אם טעינת הנתונים נכשלה *לפני* שה-Listener נרשם
     else if (typeof songsDataLoaded !== 'undefined' && !songsDataLoaded && typeof isLoadingSongs !== 'undefined' && !isLoadingSongs) {
         console.error("Homepage.js: Data loading seems to have failed before listener was ready.");
         displayDataLoadErrorHomepage();
     }
     // אם הנתונים עדיין בטעינה או טרם התחילו להיטען
     else {
         console.log("Homepage.js: Waiting for 'songsDataReady' event...");
         setInitialLoadingState(); // הצג מצב טעינה ראשוני
     }

});

console.log("homepage.js loaded"); // Verify file loading