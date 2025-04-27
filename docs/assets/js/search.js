// File: assets/js/search.js

// --- שינוי: קבלת נתונים ממשתנה גלובלי במקום טעינת CSV ---
let allSongs = []; // יאוכלס מ-window.allSongsData
// ----------------------------------------------------------
let results = [];
let displayedResults = 0;
let showSinglesOnly = true; // נשאר ללוגיקת החיפוש, לא להורדה
// --- שינוי: הסרת משתנים ישנים של הורדת API ---
// let downloadPromises = [];
// let downloadedSongsCount = 0;
// let totalSongsToDownload = 0;
// ----------------------------------------------
let activeFilter = 'all';

// --- שינוי: משתנים חדשים לניהול תור הורדות iframe ---
const downloadQueue = [];
let isProcessingQueue = false;
const INTER_DOWNLOAD_DELAY_MS = 300;
const BUTTON_RESTORE_DELAY_MS = 3000;
const IFRAME_REMOVE_DELAY_MS = 5000;
// ------------------------------------------------------


const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-button');
const loadMoreButton = document.getElementById('loadMoreButton');
const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
const loadingMessage = document.getElementById('loadingMessage'); // ישמש גם להורדות
const progressText = document.getElementById('progressText');    // ישמש גם להורדות
// --- שינוי: הסרת progressBar הישן, אם נשתמש באותו loadingMessage ---
// const progressBar = document.getElementById('progress');
// --------------------------------------------------------------
const resultsTableThead = document.querySelector("#resultsTable thead");
const resultsTable = document.getElementById('resultsTable');
const homepageContent = document.getElementById('homepage-content');
const searchResultsArea = document.getElementById('search-results-area');

// --- פונקצית ניקוי URL נשארת ---
function clearUrlParams() {
    try {
        const cleanUrl = window.location.origin + (baseurl || '') + '/';
        if (window.location.href !== cleanUrl) {
             window.history.replaceState({}, document.title, cleanUrl);
             console.log("URL parameters cleared.");
        }
    } catch (e) {
        console.error("Error clearing URL parameters:", e);
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const urlParams = new URLSearchParams(window.location.search);
    const searchValue = urlParams.get('search');
    const searchByParam = urlParams.get('searchBy') || 'all';

    // --- שינוי: טעינת נתונים מה-JSON המוטמע ---
    try {
        const songsDataElement = document.getElementById('allSongsData');
        if (songsDataElement && songsDataElement.textContent) {
            allSongs = JSON.parse(songsDataElement.textContent);
            console.log(`Search.js: Loaded ${allSongs.length} songs from embedded JSON.`);
            if (!Array.isArray(allSongs)) {
                 console.error("Search.js: Embedded song data is not an array.");
                 allSongs = [];
            }
        } else {
            console.error("Search.js: Embedded song data element (#allSongsData) not found or empty.");
            allSongs = []; // Ensure it's an empty array if loading failed
        }
    } catch (e) {
        console.error("Search.js: Error parsing embedded JSON song data:", e);
        allSongs = []; // Ensure it's an empty array on error
    }
    // -------------------------------------------

    // --- שאר לוגיקת האתחול נשארת דומה, אך ללא preloadCSVData ---
    let searchPerformedFromUrl = false;
    if (isHomepage && searchValue) {
        console.log(`Homepage loaded with search params: search=${searchValue}, searchBy=${searchByParam}`);
        if (searchInput) searchInput.value = decodeURIComponent(searchValue);
        handleFilterClick(searchByParam, false); // Set filter buttons
        searchSongs(searchValue.toLowerCase(), searchByParam); // Perform search immediately
        searchPerformedFromUrl = true;
    } else if (isHomepage) {
         console.log("Homepage loaded without search params.");
         handleFilterClick('all', false); // Set default filter button
         // Ensure homepage view is shown if homepage.js exists and handles it
         if (typeof showHomepageView === 'function') {
             showHomepageView();
         } else {
             showHomepageViewInternal(); // Fallback if homepage.js is removed/changed
         }
    } else {
         // Handle non-homepage pages (like artist pages)
         // Usually, nothing needs to be done here for search init,
         // as search actions redirect to homepage.
         // If artist pages have their own pre-filled data, that's handled by the layout/plugin.
         console.log("Non-homepage loaded. Search init skipped.");
    }

    // --- ניקוי פרמטרים וחיבור מאזינים נשארים ---
    if (isHomepage && (searchValue || urlParams.has('searchBy'))) {
         setTimeout(clearUrlParams, 150);
    }

    if (searchInput) {
        searchInput.addEventListener("keypress", function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitForm();
            }
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
          event.preventDefault();
          submitForm();
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
             const isCurrentlyHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
            handleFilterClick(this.dataset.filter, isCurrentlyHomepage); // Only trigger search if on homepage
        });
    });

    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreResults);
    }

    // --- שינוי: הסרת קריאה ל-attachHomepageTableListeners ---
    // האירועים יטופלו גלובלית על ידי shared-redirect-handler.js
    // if (isHomepage && resultsTableBody) {
    //      attachHomepageTableListeners();
    // }
    // ------------------------------------------------------
});


// --- פונקציות הצגת/הסתרת אזורים נשארות ---
function showSearchResultsViewInternal() {
    if (homepageContent) homepageContent.style.display = 'none';
    if (searchResultsArea) searchResultsArea.style.display = 'block';
    if (resultsTable && resultsTable.style.display === 'none') {
        resultsTable.style.display = '';
    }
}

function showHomepageViewInternal() {
    if (homepageContent) homepageContent.style.display = 'block';
    if (searchResultsArea) searchResultsArea.style.display = 'none';
}


// --- פונקצית submit נשארת ---
function submitForm() {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const searchTermLower = searchTerm.toLowerCase();
    const currentActiveFilter = activeFilter;

    if (!isHomepage) {
        // If not on homepage, redirect to homepage with search parameters
        if (searchTerm) {
             const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(currentActiveFilter)}`;
             console.log(`Redirecting from non-homepage search submit to: ${redirectUrl}`);
             window.location.href = redirectUrl;
        } else {
             // Maybe show a message or just focus input if empty search on other pages
             searchInput?.focus();
        }
    } else {
        // If on homepage, perform the search directly
        searchSongs(searchTermLower, currentActiveFilter);
        setTimeout(clearUrlParams, 100); // Clear params after search starts
    }
}

// --- פונקצית טיפול בלחיצה על פילטר נשארת ---
function handleFilterClick(filter, doSearch = false) {
    if (!filter) return;
    activeFilter = filter;
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    if (doSearch) {
       const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
       searchSongs(searchTerm, activeFilter); // Perform search
       setTimeout(clearUrlParams, 100); // Clear params after search starts
    }
}

// --- עדכון פונקצית החיפוש הראשית ---
async function searchSongs(query, searchBy) {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
     if (isHomepage) {
         // Ensure search results view is shown on homepage
         if (typeof showSearchResultsView === 'function') { // Use function from homepage.js if available
             showSearchResultsView();
         } else {
             showSearchResultsViewInternal(); // Use internal fallback
         }
     } else {
          // This function should ideally only run on the homepage now
          // due to the redirection logic in submitForm.
          console.warn("searchSongs called on non-homepage. This might indicate an issue.");
          // If called on artist page, maybe do nothing or ensure table is visible?
          // For now, let's proceed assuming it might be needed for initial URL param handling
          // if redirection hasn't happened yet (though unlikely).
     }

    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;

    // If no query and filter is 'all', clear results and hide
    if (!query && searchBy === 'all') {
        displayResults([]); // Display empty state
        if (resultsTableThead) resultsTableThead.style.display = "none";
        if(loadMoreButton) loadMoreButton.style.display = 'none';
        return;
    }

    displayLoadingMessage(colspan); // Show "Searching..."

    // --- שינוי: בדיקה אם הנתונים כבר טעונים ---
    if (allSongs.length === 0) {
        // Data should have been loaded during DOMContentLoaded. If not, it's an error.
         console.error("Search Error: Song data (allSongs) is empty when search initiated.");
         if (resultsTableBody) resultsTableBody.innerHTML = `<tr><td colspan="${colspan}">שגיאה קריטית: נתוני השירים לא נטענו כראוי. נסה לרענן את הדף.</td></tr>`;
         if (resultsTableThead) resultsTableThead.style.display = "none";
         if (loadMoreButton) loadMoreButton.style.display = 'none';
         return; // Stop if data isn't available
    }
    // ------------------------------------------

    // Perform the actual search logic
    performSearch(query, searchBy);
}

// --- performSearch נשארת דומה, עובדת על המערך allSongs ---
function performSearch(query, searchBy) {
    // (הלוגיקה של סינון לפי סינגלים בלבד, אם נדרשת, נשארת כאן)
    let baseSongsToFilter = allSongs; // Start with all loaded songs
    // if (showSinglesOnly) { ... filter logic ... } // Apply filter if needed

    results = filterSongs(baseSongsToFilter, query, searchBy); // Filter based on query/type
    displayedResults = 0; // Reset display count
    const initialResultsToShow = results.slice(0, 250); // Get first batch
    displayedResults = initialResultsToShow.length; // Update count
    displayResults(initialResultsToShow, false); // Display first batch (overwrite existing)
}


// --- הסרת preloadCSVData, fetchCSV, parseCSV ---
// פונקציות אלו אינן נחוצות יותר כי הנתונים מוטמעים

// --- פונקציית filterSongs נשארת זהה (כולל חישוב רלוונטיות ומיון) ---
// היא פשוט תקבל את allSongs כמקור
function filterSongs(songsToFilter, query, searchBy) {
    // ... (אותה לוגיקה בדיוק כמו בקוד המקורי) ...
     if (!query) {
        if (searchBy === 'all') return [];
        return songsToFilter.filter(song => {
            // Map searchBy to the correct key in our YAML data structure
            const fieldMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' };
            const key = fieldMap[searchBy];
            if (!key) return false; // Invalid searchBy
            const value = song[key];
            return value !== null && value !== undefined && String(value).trim() !== '';
        });
    }

    const calculateDiceCoefficient = (tokens1, tokens2) => {
        if (!tokens1?.length || !tokens2?.length) return 0;
        const intersection = new Set(tokens1.filter(token => tokens2.includes(token)));
        return (2 * intersection.size) / (tokens1.length + tokens2.length);
    };

    const calculateNormalizedLevenshteinDistance = (str1 = '', str2 = '') => {
        const len1 = str1.length;
        const len2 = str2.length;
        if (len1 === 0) return len2 > 0 ? 1 : 0;
        if (len2 === 0) return len1 > 0 ? 1 : 0;
        if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.6) return 1;

        const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
        for (let j = 1; j <= len2; j++) matrix[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 0 : matrix[len1][len2] / maxLen;
    };

    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);
    const fuzzyThreshold = 0.55;
    const levenshteinThreshold = 0.45;

    const fieldMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' }; // Map searchBy to YAML keys

    const scoredResults = songsToFilter.map(song => {
        song._relevanceScore = 0;
        let bestScoreForSong = 0;

        const fieldsToCheckKeys = [];
        if (searchBy === 'all') {
            fieldsToCheckKeys.push('serial', 'name', 'album', 'singer');
        } else if (fieldMap[searchBy]) {
            fieldsToCheckKeys.push(fieldMap[searchBy]);
        }

        for (const key of fieldsToCheckKeys) {
            const value = song[key];
            const stringValue = (value === null || value === undefined) ? '' : String(value);
            if (!stringValue) continue;
            const lowerValue = stringValue.toLowerCase();
            let currentFieldScore = 0;

            const isExactMatch = (key === 'serial' && lowerValue.startsWith(queryLower)) ||
                                 (key !== 'serial' && lowerValue.includes(queryLower)) ||
                                 (searchBy === 'all' && lowerValue.includes(queryLower));


            if (isExactMatch) {
                currentFieldScore = 1.0;
            } else {
                const valueTokens = lowerValue.split(/\s+/).filter(Boolean);
                const diceSim = calculateDiceCoefficient(queryTokens, valueTokens);
                if (diceSim >= fuzzyThreshold) {
                    currentFieldScore = Math.max(currentFieldScore, diceSim);
                }

                if (currentFieldScore < fuzzyThreshold &&
                    Math.abs(queryLower.length - lowerValue.length) <= Math.max(queryLower.length, lowerValue.length) * 0.5)
                {
                    const levDist = calculateNormalizedLevenshteinDistance(queryLower, lowerValue);
                    if (levDist <= levenshteinThreshold) {
                        currentFieldScore = Math.max(currentFieldScore, (1 - levDist));
                    }
                }
            }
            bestScoreForSong = Math.max(bestScoreForSong, currentFieldScore);
        }
        song._relevanceScore = bestScoreForSong;
        return song;

    }).filter(song => song._relevanceScore > 0);


    if (searchBy === 'serial') {
        const targetSerial = parseInt(queryLower, 10);
        if (!isNaN(targetSerial)) {
            return scoredResults.sort((a, b) => {
                const serialA = parseInt(a.serial, 10) || 0;
                const serialB = parseInt(b.serial, 10) || 0;

                const isAExact = serialA === targetSerial;
                const isBExact = serialB === targetSerial;

                if (isAExact && !isBExact) return -1;
                if (!isAExact && isBExact) return 1;
                if (isAExact && isBExact) return 0; // Should ideally not happen if serials are unique

                // If searching by serial, prioritize exact match first, then relevance, then proximity
                if (a._relevanceScore !== b._relevanceScore) {
                    return b._relevanceScore - a._relevanceScore;
                 }

                const diffA = Math.abs(serialA - targetSerial);
                const diffB = Math.abs(serialB - targetSerial);

                if (diffA !== diffB) {
                    return diffA - diffB;
                } else {
                    return serialA - serialB;
                }
            });
        }
    }

    return scoredResults.sort((a, b) => {
        if (a._relevanceScore !== b._relevanceScore) {
            return b._relevanceScore - a._relevanceScore;
        }
        const serialA = parseInt(a.serial, 10) || 0;
        const serialB = parseInt(b.serial, 10) || 0;
        return serialA - serialB;
    });
}


// --- פונקצית הצגת הודעת טעינה נשארת ---
function displayLoadingMessage(colspan = 4) {
    if (!resultsTableBody) return;
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    resultsTableBody.innerHTML = ''; // Clear previous results/messages

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.setAttribute('colspan', colspan);
    loadingCell.style.textAlign = 'center';

    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('loading-container');

    const loadingImage = document.createElement('img');
    loadingImage.src = (baseurl || '') + '/assets/images/loading.gif';
    loadingImage.alt = "טוען...";
    loadingImage.classList.add('loading-image');
    const loadingTextElem = document.createElement('p');
    loadingTextElem.textContent = 'מחפש...';
    loadingTextElem.classList.add('loading-text');
    loadingContainer.appendChild(loadingImage);
    loadingContainer.appendChild(loadingTextElem);
    loadingCell.appendChild(loadingContainer);
    loadingRow.appendChild(loadingCell);

    resultsTableBody.appendChild(loadingRow);

    if (resultsTableThead) resultsTableThead.style.display = "none"; // Hide headers during loading
    if (loadMoreButton) loadMoreButton.style.display = 'none'; // Hide load more during loading
}

// --- עדכון displayResults להוספת data-drive-id ---
function displayResults(resultsToDisplay, append = false) {
    if (!resultsTableBody) return;
    // Ensure results view is visible (important if called after initial load)
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;

    if (!append) {
        resultsTableBody.innerHTML = ''; // Clear only if not appending
    }

    // Handle no results case
    if (resultsToDisplay.length === 0 && !append) {
        const noResultsRow = document.createElement('tr');
        const noResultsCell = document.createElement('td');
        noResultsCell.setAttribute('colspan', colspan);
        noResultsCell.textContent = 'לא נמצאו תוצאות התואמות את החיפוש.';
        noResultsCell.style.textAlign = 'center';
        noResultsRow.appendChild(noResultsCell);
        resultsTableBody.appendChild(noResultsRow);
        if (resultsTableThead) resultsTableThead.style.display = "none";
        toggleLoadMoreButton(); // Hide load more button
        return;
    }

    // Show headers if hidden and we have results
    if (resultsToDisplay.length > 0 && resultsTableThead && (resultsTableThead.style.display === "none" || !resultsTableThead.style.display)) {
        resultsTableThead.style.display = ""; // Or "table-header-group"
    }

    const fragment = document.createDocumentFragment();
    resultsToDisplay.forEach(song => {
        const row = document.createElement('tr');
        // --- שינוי: הוספת driveId לשורה ---
        row.dataset.songSerial = song.serial;
        row.dataset.driveId = song.driveId; // <-- הוספה
        // ---------------------------------

        const nameCell = document.createElement('td');
        nameCell.textContent = song.name;
        row.appendChild(nameCell);

        const albumCell = document.createElement('td');
        const albumButton = document.createElement('button');
        albumButton.textContent = song.album;
        albumButton.classList.add('album-button');
        albumButton.dataset.albumName = song.album;
        albumButton.title = `חפש אלבום: ${song.album}`;
        albumCell.appendChild(albumButton);
        row.appendChild(albumCell);

        const singerCell = document.createElement('td');
        const singerButton = document.createElement('button');
        singerButton.textContent = song.singer;
        singerButton.classList.add('singer-button');
        singerButton.dataset.singerName = song.singer;
        singerButton.title = `חפש זמר: ${song.singer}`;
        singerCell.appendChild(singerButton);
        row.appendChild(singerCell);

        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions-cell');

        const groupDiv = document.createElement('div');
        groupDiv.className = 'actions-button-group';

        const downloadButton = document.createElement('button');
        downloadButton.classList.add('download-button'); // Use a generic class
        downloadButton.dataset.songSerial = song.serial;
        // --- שינוי: הוספת driveId לכפתור (גם אם הוא כבר על השורה, ליתר ביטחון) ---
        downloadButton.dataset.driveId = song.driveId; // <-- הוספה
        // ------------------------------------------------------------------------
        downloadButton.title = 'הורדה';
        downloadButton.innerHTML = '<i class="fas fa-download"></i>';

        const shareButton = document.createElement('button');
        shareButton.classList.add('share-button');
        shareButton.dataset.songSerial = song.serial;
        shareButton.title = 'שיתוף';
        shareButton.innerHTML = '<i class="fas fa-share-alt"></i>';

        groupDiv.appendChild(downloadButton);
        groupDiv.appendChild(shareButton);
        actionsCell.appendChild(groupDiv);
        row.appendChild(actionsCell);

        fragment.appendChild(row);
    });

    resultsTableBody.appendChild(fragment);
    toggleLoadMoreButton(); // Update load more button visibility
}


// --- הסרת attachHomepageTableListeners ו-handleHomepageTableClick ---
// המטפל הגלובלי ב-shared-redirect-handler יטפל בזה


// --- פונקציות loadMoreResults ו-toggleLoadMoreButton נשארות ---
function loadMoreResults() {
    console.log(`Load More: Displayed=${displayedResults}, Total=${results.length}`);
    const startIndex = displayedResults;
    const newLimit = displayedResults + 250; // Load 250 more
    const endIndex = Math.min(newLimit, results.length);

    if (startIndex >= results.length) {
        console.log("No more results to load.");
        if (loadMoreButton) loadMoreButton.style.display = 'none';
        return;
    }

    const newResultsToDisplay = results.slice(startIndex, endIndex);
    console.log(`Loading results from ${startIndex} to ${endIndex} (${newResultsToDisplay.length} new songs)`);
    displayResults(newResultsToDisplay, true); // Append results
    displayedResults = endIndex; // Update count
    console.log(`Load More Finished. New displayed=${displayedResults}, Button visible=${loadMoreButton ? loadMoreButton.style.display : 'N/A'}`);
}

function toggleLoadMoreButton() {
     if (loadMoreButton) {
        loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
     }
}


// --- ====================================================== ---
// --- החלפת כל לוגיקת ההורדה לשיטת ה-iframe המרוכזת ---
// --- ====================================================== ---

// פונקציה לעדכון הודעת הטעינה (עבור הורדות)
function updateDownloadLoadingMessage() {
    if (!loadingMessage || !progressText) return;

    const buttonsInProgress = document.querySelectorAll('button.download-button.download-in-progress').length;
    const itemsInQueue = downloadQueue.length;

    if (buttonsInProgress > 0 || itemsInQueue > 0) {
        let message = "";
        if (buttonsInProgress > 0) {
            // Optional: Could show which song is actively downloading if needed
            message += `מוריד ${buttonsInProgress} שירים... `;
        }
        if (itemsInQueue > 0) {
            message += `(${itemsInQueue} ממתינים בתור)`;
        }
        progressText.innerText = message.trim();
        if (!loadingMessage.classList.contains('show')) {
            loadingMessage.style.display = 'flex'; // Make it visible
            loadingMessage.classList.add('show');
        }
        // Hide the progress bar itself if not needed for granular progress
        const progressBarContainer = loadingMessage.querySelector('.progress-bar');
        if (progressBarContainer) progressBarContainer.style.display = 'none';

    } else {
        // Hide the message only if no downloads are active *and* queue is empty
        if (loadingMessage.classList.contains('show')) {
            // Add a small delay before hiding to show completion message briefly
             setTimeout(() => {
                 // Double-check conditions before hiding
                  if (document.querySelectorAll('button.download-button.download-in-progress').length === 0 && downloadQueue.length === 0) {
                     loadingMessage.style.display = 'none';
                     loadingMessage.classList.remove('show');
                  }
              }, 1500); // Delay before hiding
        }
    }
}

// פונקציה להחזרת כפתור למצב רגיל אחרי הורדה (או כישלון)
function restoreDownloadButton(songSerial) {
    // Find button across all potential tables (homepage, artist page via shared handler)
    const button = document.querySelector(`button.download-button[data-song-serial="${songSerial}"]`);
    if (button && button.classList.contains('download-in-progress')) {
        const originalIconHTML = button.dataset.originalIcon || '<i class="fas fa-download"></i>';
        button.innerHTML = originalIconHTML;
        button.disabled = false;
        button.classList.remove('download-in-progress');
        delete button.dataset.originalIcon;
        console.log(`Download Handler: Button restored for serial: ${songSerial}`);
        updateDownloadLoadingMessage(); // Update status message
    }
}

// פונקציה לעיבוד התור (הורדה אחת אחרי השניה)
function processDownloadQueue() {
    if (downloadQueue.length === 0) {
        isProcessingQueue = false;
        console.log("Download Handler: Queue is empty. Stopping processing.");
        updateDownloadLoadingMessage(); // Update status (likely hide message)
        return;
    }

    isProcessingQueue = true;
    const item = downloadQueue.shift(); // Get the next item

    console.log(`Download Handler: Processing serial: ${item.songSerial} (DriveID: ${item.driveId}). Queue length: ${downloadQueue.length}`);
    updateDownloadLoadingMessage(); // Show "Downloading..." message

    try {
        // Create hidden iframe to trigger download
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `https://drive.google.com/uc?export=download&id=${item.driveId}`;
        document.body.appendChild(iframe);
        console.log(`Download Handler: iframe created and appended for driveId: ${item.driveId}`);

        // Restore button after a delay (assume download started)
        setTimeout(() => {
            restoreDownloadButton(item.songSerial);
        }, BUTTON_RESTORE_DELAY_MS);

        // Remove iframe after a longer delay
        setTimeout(() => {
            try {
                iframe.remove();
                console.log(`Download Handler: iframe removed for driveId: ${item.driveId}`);
            } catch (removeError) {
                // Non-critical error
                console.warn(`Download Handler: Minor error removing iframe for driveId: ${item.driveId}`, removeError);
            }
        }, IFRAME_REMOVE_DELAY_MS);

        // Process the next item in the queue after a short delay
        setTimeout(processDownloadQueue, INTER_DOWNLOAD_DELAY_MS);

    } catch (error) {
        console.error(`Download Handler: Error creating/appending iframe for serial ${item.songSerial}:`, error);
        restoreDownloadButton(item.songSerial); // Restore button on error
        if (typeof showMessage === 'function') { // Show user-friendly message
            showMessage(`שגיאה בהכנת ההורדה לשיר מספר ${item.songSerial}.`);
        }
        // Continue processing queue even if one item failed
        setTimeout(processDownloadQueue, 50); // Shorter delay after error
    }
}

// --- פונקציית ההורדה הגלובלית החדשה ---
window.downloadSongWithDriveId = function(buttonElement) {
    if (!buttonElement) {
        console.error("Download Handler: Invalid button element provided.");
        return;
    }

    const songSerial = buttonElement.dataset.songSerial;
    const driveId = buttonElement.dataset.driveId;

    if (!songSerial || !driveId) {
        console.error(`Download Handler: Missing data on button. Serial: ${songSerial}, DriveID: ${driveId}`);
        if(typeof showMessage === 'function') showMessage('שגיאה: חסר מידע נחוץ להורדה (מספר או מזהה קובץ).');
        // Restore button if it was somehow disabled
         if (buttonElement.classList.contains('download-in-progress')) {
              restoreDownloadButton(songSerial || 'unknown'); // Attempt restore
         }
        return;
    }

    // Prevent double-clicks / adding same item multiple times quickly
    if (buttonElement.disabled || buttonElement.classList.contains('download-in-progress')) {
        console.warn(`Download Handler: Download already in progress or button disabled for serial: ${songSerial}`);
        return;
    }

    // --- שינוי: בדיקה אם השיר כבר בתור ---
    if (downloadQueue.some(item => item.songSerial === songSerial)) {
        console.warn(`Download Handler: Song ${songSerial} is already in the download queue.`);
        if(typeof showMessage === 'function') showMessage(`השיר ${songSerial} כבר נמצא בתור להורדה.`);
        return;
    }
    // ------------------------------------

    // Update button state
    buttonElement.disabled = true;
    buttonElement.classList.add('download-in-progress');
    buttonElement.dataset.originalIcon = buttonElement.innerHTML; // Save original icon
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Show spinner

    // Add to queue
    downloadQueue.push({
        songSerial: songSerial,
        driveId: driveId
    });

    console.log(`Download Handler: Added serial: ${songSerial} (driveId: ${driveId}) to queue. Queue length: ${downloadQueue.length}`);
    updateDownloadLoadingMessage(); // Update status message

    // Start processing the queue if it's not already running
    if (!isProcessingQueue) {
        console.log("Download Handler: Starting queue processing.");
        processDownloadQueue();
    }
}

// --- הסרת הפונקציות הישנות: downloadSongWrapper, downloadSong, updateProgressDisplay ---
// הפונקציה הגלובלית downloadSongWithDriveId מחליפה אותן.

// --- ====================================================== ---
// ---         סוף שינוי לוגיקת ההורדה                     ---
// --- ====================================================== ---