// assets/js/search.js

// --- Global Variables & State ---
let allSongs = [];
let results = [];
let displayedResults = 0;
let showSinglesOnly = true; // Keep existing logic if needed, otherwise remove check
let downloadPromises = [];
let downloadedSongsCount = 0;
let totalSongsToDownload = 0;
let activeFilter = 'all'; // Default filter

// --- DOM Elements ---
// ... (שמור על הגדרות DOM קיימות)
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-button');
const loadMoreButton = document.getElementById('loadMoreButton');
const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
const loadingMessage = document.getElementById('loadingMessage');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progress');
const resultsTableThead = document.querySelector("#resultsTable thead");
const resultsTable = document.getElementById('resultsTable');
const homepageContent = document.getElementById('homepage-content');
const searchResultsArea = document.getElementById('search-results-area');

// --- Helper Function ---
// ... (שמור על clearUrlParams)
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
// ... (שמור על רוב לוגיקת האתחול, כולל קריאה ל-preloadCSVData)
document.addEventListener('DOMContentLoaded', () => {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const urlParams = new URLSearchParams(window.location.search);
    const searchValue = urlParams.get('search');
    const searchByParam = urlParams.get('searchBy') || 'all';

    preloadCSVData().then(() => {
        let searchPerformedFromUrl = false;
        if (isHomepage && searchValue) {
            console.log(`Homepage loaded with search params: search=${searchValue}, searchBy=${searchByParam}`);
            if (searchInput) searchInput.value = decodeURIComponent(searchValue);
            handleFilterClick(searchByParam, false);
            searchSongs(searchValue.toLowerCase(), searchByParam);
            searchPerformedFromUrl = true;
        } else if (isHomepage) {
             console.log("Homepage loaded without search params.");
             handleFilterClick('all', false);
             if (typeof showHomepageView === 'function') {
                 showHomepageView();
             } else {
                 showHomepageViewInternal();
             }
        }

        if (isHomepage && (searchValue || urlParams.has('searchBy'))) {
             setTimeout(clearUrlParams, 150);
        }

    }).catch(error => {
        console.error("Error during initialization or initial data load:", error);
        const shouldShowResults = isHomepage && (!homepageContent || homepageContent.style.display === 'none');
        if (shouldShowResults) {
             if (resultsTableBody) {
                 resultsTableBody.innerHTML = `<tr><td colspan="${resultsTableThead ? resultsTableThead.rows[0].cells.length : 4}">שגיאה חמורה בטעינת נתונים. נסה לרענן.</td></tr>`;
                 if (resultsTableThead) resultsTableThead.style.display = "none";
                 if (loadMoreButton) loadMoreButton.style.display = 'none';
             }
        }
    });

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
             const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
            handleFilterClick(this.dataset.filter, isHomepage);
        });
    });

    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreResults);
    }

    // Attach listeners specific to homepage search results table
    if (isHomepage && resultsTableBody) {
         attachHomepageTableListeners();
    }
});

// --- View Switching ---
// ... (שמור על showSearchResultsViewInternal, showHomepageViewInternal)
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

// --- Search Execution ---
// ... (שמור על submitForm, handleFilterClick, searchSongs, performSearch)
function submitForm() {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const searchTermLower = searchTerm.toLowerCase();
    const currentActiveFilter = activeFilter;

    if (!isHomepage) {
        if (searchTerm) {
             const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(currentActiveFilter)}`;
             console.log(`Redirecting from non-homepage search submit to: ${redirectUrl}`);
             window.location.href = redirectUrl;
        } else {
             searchInput?.focus();
        }
    } else {
        searchSongs(searchTermLower, currentActiveFilter);
        setTimeout(clearUrlParams, 100);
    }
}

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
       searchSongs(searchTerm, activeFilter);
       setTimeout(clearUrlParams, 100);
    }
}

async function searchSongs(query, searchBy) {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
     if (isHomepage) {
         if (typeof showSearchResultsView === 'function') {
             showSearchResultsView();
         } else {
             showSearchResultsViewInternal();
         }
     } else {
          console.warn("searchSongs called on non-homepage. Redirect should have happened.");
          return;
     }

    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!query && searchBy === 'all') {
        displayResults([]);
        if (resultsTableThead) resultsTableThead.style.display = "none";
        if(loadMoreButton) loadMoreButton.style.display = 'none';
        return;
    }

    displayLoadingMessage(colspan); // Pass colspan

    if (allSongs.length === 0) {
        try {
            await preloadCSVData();
        } catch (error) {
             console.error("Failed to load song data during search:", error);
             if (resultsTableBody) resultsTableBody.innerHTML = `<tr><td colspan="${colspan}">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>`;
             if (resultsTableThead) resultsTableThead.style.display = "none";
             if (loadMoreButton) loadMoreButton.style.display = 'none';
             return;
        }
        if (allSongs.length === 0) {
             console.error("Song data is still empty after attempting load.");
              if (resultsTableBody) resultsTableBody.innerHTML = `<tr><td colspan="${colspan}">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>`;
             if (resultsTableThead) resultsTableThead.style.display = "none";
             if (loadMoreButton) loadMoreButton.style.display = 'none';
             return;
        }
    }

    performSearch(query, searchBy);
}

function performSearch(query, searchBy) {
    let baseSongsToFilter;
    if (showSinglesOnly) {
        baseSongsToFilter = allSongs.filter(song =>
            (song.album && typeof song.album === 'string' && song.album.toLowerCase().includes('סינגלים')) ||
            (song.singer && typeof song.singer === 'string' && song.singer.toLowerCase().includes('סינגלים'))
        );
    } else {
        baseSongsToFilter = allSongs;
    }

    results = filterSongs(baseSongsToFilter, query, searchBy);
    displayedResults = 0;
    const initialResultsToShow = results.slice(0, 250);
    displayedResults = initialResultsToShow.length;
    displayResults(initialResultsToShow, false);
}


// --- Data Loading & Parsing ---
// ... (שמור על preloadCSVData, fetchCSV, parseCSV ללא שינוי)
async function preloadCSVData() {
    if (preloadCSVData.loading) {
        console.log("CSV data is already loading.");
        return preloadCSVData.promise;
    }
    if (allSongs.length > 0) {
         console.log("CSV data already loaded.");
         return Promise.resolve();
    }

    preloadCSVData.loading = true;
    const currentCSVUrl = (baseurl || '') + '/assets/data/songs.csv';

    preloadCSVData.promise = new Promise(async (resolve, reject) => {
        try {
            console.log("Preloading CSV data...");
            const currentCSVText = await fetchCSV(currentCSVUrl);
            if (currentCSVText) {
                allSongs = parseCSV(currentCSVText);
                console.log(`CSV data preloaded: ${allSongs.length} songs.`);
                resolve();
            } else {
                 console.error('Fetched CSV data is empty.');
                 allSongs = [];
                 reject(new Error('Fetched CSV data is empty.'));
            }
        } catch (error) {
            console.error('Error preloading CSV data:', error);
            allSongs = [];
            reject(error);
        } finally {
            preloadCSVData.loading = false;
            preloadCSVData.promise = null;
        }
    });
    return preloadCSVData.promise;
}
preloadCSVData.loading = false;
preloadCSVData.promise = null;

async function fetchCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        if (!text) {
            throw new Error('CSV file is empty or failed to load content.');
        }
        return text;
    } catch (error) {
         console.error(`Failed to fetch CSV from ${url}:`, error);
         throw error;
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
            if (columns.length >= 4) {
                const song = {
                    serial: columns[0] || '',
                    name: columns[1] || '',
                    album: columns[2] || '',
                    singer: columns[3] || ''
                };
                if (song.serial || song.name) {
                    songs.push(song);
                }
            }
        }
    }
    return songs;
}

// --- Filtering Logic ---
function filterSongs(songsToFilter, query, searchBy) {
    if (!query) {
        // Return empty if no query for 'all', or all non-empty for specific field
        if (searchBy === 'all') return [];
        return songsToFilter.filter(song => {
            const value = song[searchBy];
            return value !== null && value !== undefined && String(value).trim() !== '';
        });
    }

    // --- Relevance Helper Functions (Dice and Levenshtein remain the same) ---
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
        if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.6) return 1; // Optimization

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
    // --- End Helper Functions ---

    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(Boolean);
    const fuzzyThreshold = 0.55; // Dice similarity threshold
    const levenshteinThreshold = 0.45; // Levenshtein distance threshold (lower is better)

    // --- MODIFICATION START: Score calculation during filtering ---
    const scoredResults = songsToFilter.map(song => {
        song._relevanceScore = 0; // Initialize score for this song
        let bestScoreForSong = 0;

        const fieldsToCheck = [];
        if (searchBy === 'all') {
            fieldsToCheck.push(song.serial, song.name, song.album, song.singer);
        } else if (song[searchBy] !== undefined) {
            fieldsToCheck.push(song[searchBy]);
        }

        for (const value of fieldsToCheck) {
            const stringValue = (value === null || value === undefined) ? '' : String(value);
            if (!stringValue) continue;
            const lowerValue = stringValue.toLowerCase();
            let currentFieldScore = 0;

            // 1. Check for exact substring match (highest relevance)
            // For serial, we prioritize prefix match if searching by serial
            const isExactMatch = (searchBy === 'serial' && lowerValue.startsWith(queryLower)) ||
                                 (searchBy !== 'serial' && lowerValue.includes(queryLower)) ||
                                 (searchBy === 'all' && lowerValue.includes(queryLower));

            if (isExactMatch) {
                currentFieldScore = 1.0; // Assign max score for exact match
            } else {
                // 2. If not exact, check Dice coefficient (token similarity)
                const valueTokens = lowerValue.split(/\s+/).filter(Boolean);
                const diceSim = calculateDiceCoefficient(queryTokens, valueTokens);
                if (diceSim >= fuzzyThreshold) {
                    currentFieldScore = Math.max(currentFieldScore, diceSim); // Use Dice score
                }

                // 3. If still low score, check Levenshtein distance (character similarity)
                // (Only calculate if necessary and strings are comparable length)
                if (currentFieldScore < fuzzyThreshold && // Avoid redundant checks if already matched well
                    Math.abs(queryLower.length - lowerValue.length) <= Math.max(queryLower.length, lowerValue.length) * 0.5)
                {
                    const levDist = calculateNormalizedLevenshteinDistance(queryLower, lowerValue);
                    if (levDist <= levenshteinThreshold) {
                        // Convert distance (lower=better) to similarity (higher=better)
                        currentFieldScore = Math.max(currentFieldScore, (1 - levDist));
                    }
                }
            }
            // Update the song's best score found across all its checked fields
            bestScoreForSong = Math.max(bestScoreForSong, currentFieldScore);
        }
        song._relevanceScore = bestScoreForSong; // Store the highest score found for this song
        return song; // Return the song object with its score

    }).filter(song => song._relevanceScore > 0); // Keep only songs that had some match
    // --- MODIFICATION END: Score calculation ---


    // --- Sorting Logic ---
    // Special sorting for valid numeric serial search (prioritize exact, then proximity)
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
                if (isAExact && isBExact) return 0;

                const diffA = Math.abs(serialA - targetSerial);
                const diffB = Math.abs(serialB - targetSerial);

                if (diffA !== diffB) {
                    return diffA - diffB; // Sort by proximity
                } else {
                    return serialA - serialB; // Tie-breaker: serial number
                }
            });
        }
        // Fall through to relevance sort if serial query wasn't a valid number
    }

    // --- MODIFICATION: Relevance-based sorting for all other search types ---
    // Sort primarily by relevance score (descending), then by serial number (ascending) as tie-breaker
    return scoredResults.sort((a, b) => {
        // Primary sort: Higher relevance score comes first
        if (a._relevanceScore !== b._relevanceScore) {
            return b._relevanceScore - a._relevanceScore; // Note: b - a for descending order
        }

        // Secondary sort (tie-breaker): Lower serial number comes first
        const serialA = parseInt(a.serial, 10) || 0;
        const serialB = parseInt(b.serial, 10) || 0;
        return serialA - serialB;
    });
    // --- MODIFICATION END ---
}

// --- Display Logic ---
function displayLoadingMessage(colspan = 4) { // Default colspan
    if (!resultsTableBody) return;
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    resultsTableBody.innerHTML = '';

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.setAttribute('colspan', colspan); // Use dynamic colspan
    loadingCell.style.textAlign = 'center';

    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('loading-container');
    // ... (rest of loading indicator remains the same)
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

    if (resultsTableThead) resultsTableThead.style.display = "none";
    if (loadMoreButton) loadMoreButton.style.display = 'none';
}

function displayResults(resultsToDisplay, append = false) {
    if (!resultsTableBody) return;
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;

    if (!append) {
        resultsTableBody.innerHTML = '';
    }

    if (resultsToDisplay.length === 0 && !append) {
        const noResultsRow = document.createElement('tr');
        const noResultsCell = document.createElement('td');
        noResultsCell.setAttribute('colspan', colspan); // Use dynamic colspan
        noResultsCell.textContent = 'לא נמצאו תוצאות התואמות את החיפוש.';
        noResultsCell.style.textAlign = 'center';
        noResultsRow.appendChild(noResultsCell);
        resultsTableBody.appendChild(noResultsRow);
        if (resultsTableThead) resultsTableThead.style.display = "none";
        toggleLoadMoreButton();
        return;
    }

    if (resultsToDisplay.length > 0 && resultsTableThead && (resultsTableThead.style.display === "none" || !resultsTableThead.style.display)) {
        resultsTableThead.style.display = ""; // Or "table-header-group"
    }

    const fragment = document.createDocumentFragment();
    resultsToDisplay.forEach(song => {
        const row = document.createElement('tr');
        row.dataset.songSerial = song.serial; // Keep serial on row for reference

        // Song Name Cell
        const nameCell = document.createElement('td');
        nameCell.textContent = song.name;
        row.appendChild(nameCell);

        // Album Name Cell (with filter button)
        const albumCell = document.createElement('td');
        const albumButton = document.createElement('button');
        albumButton.textContent = song.album;
        albumButton.classList.add('album-button');
        albumButton.dataset.albumName = song.album; // Use data attribute
        albumButton.title = `חפש אלבום: ${song.album}`;
        albumCell.appendChild(albumButton);
        row.appendChild(albumCell);

        // Singer Name Cell (with filter button)
        const singerCell = document.createElement('td');
        const singerButton = document.createElement('button');
        singerButton.textContent = song.singer;
        singerButton.classList.add('singer-button');
        singerButton.dataset.singerName = song.singer; // Use data attribute
        singerButton.title = `חפש זמר: ${song.singer}`;
        singerCell.appendChild(singerButton);
        row.appendChild(singerCell);

        // --- Actions Cell (New) ---
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions-cell');

        // **** 1. Create the wrapper DIV ****
        const groupDiv = document.createElement('div');
        groupDiv.className = 'actions-button-group';

        // **** 2. Create Buttons (as before) ****
        // Download Button
        const downloadButton = document.createElement('button');
        downloadButton.classList.add('download-button');
        downloadButton.dataset.songSerial = song.serial;
        downloadButton.title = 'הורדה';
        downloadButton.innerHTML = '<i class="fas fa-download"></i>';

        // Share Button
        const shareButton = document.createElement('button');
        shareButton.classList.add('share-button');
        shareButton.dataset.songSerial = song.serial;
        shareButton.title = 'שיתוף';
        shareButton.innerHTML = '<i class="fas fa-share-alt"></i>';

        // **** 3. Append Buttons to the DIV ****
        groupDiv.appendChild(downloadButton);
        groupDiv.appendChild(shareButton);

        // **** 4. Append the DIV to the Cell ****
        actionsCell.appendChild(groupDiv);

        row.appendChild(actionsCell); // Append the cell to the row
        // --- End Actions Cell ---

        fragment.appendChild(row);
    });

    resultsTableBody.appendChild(fragment);
    toggleLoadMoreButton();
}

// --- Event Delegation for HOMEPAGE Table Clicks ---
// This listener ONLY handles clicks within the search results on the homepage
function attachHomepageTableListeners() {
     if (!resultsTableBody) return;

     // Remove previous listener if re-attaching (though typically done once on DOMContentLoaded)
     // resultsTableBody.removeEventListener('click', handleHomepageTableClick); // Need a named function

     resultsTableBody.addEventListener('click', handleHomepageTableClick);
     console.log("Attached HOMEPAGE specific table listener.");
}

function handleHomepageTableClick(event) {
    const target = event.target;
    const button = target.closest('button'); // Find the closest button clicked

    if (!button) return; // Exit if click wasn't on or inside a button

    const row = button.closest('tr');
    if (!row || !row.dataset.songSerial) return; // Ensure we are in a valid song row

    const songSerial = button.dataset.songSerial || row.dataset.songSerial; // Get serial from button or row

    // 1. Handle Download Button Click
    if (button.classList.contains('download-button')) {
        event.preventDefault();
        event.stopPropagation(); // Prevent potential nested listeners
        if (songSerial) {
             if (typeof downloadSong === 'function') {
                 downloadSongWrapper(button); // Use wrapper to handle button state
             } else {
                 console.error("downloadSong function is not defined.");
                 if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
             }
        }
        return;
    }

    // 2. Handle Share Button Click
    if (button.classList.contains('share-button')) {
        event.preventDefault();
        event.stopPropagation();
        if (songSerial) {
            const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
            if (typeof copyToClipboard === 'function' && typeof showCopiedMessage === 'function') {
                copyToClipboard(shareLink);
                showCopiedMessage();
            } else {
                console.warn("Clipboard functions not available.");
            }
        }
        return;
    }

    // 3. Handle Album Button Click (Search on Homepage)
    if (button.classList.contains('album-button')) {
        event.preventDefault();
        event.stopPropagation();
        const albumName = button.dataset.albumName; // Get from data attribute
        if (albumName && searchInput) {
             searchInput.value = albumName;
             handleFilterClick('album', true);
        }
        return;
    }

    // 4. Handle Singer Button Click (Search on Homepage)
    if (button.classList.contains('singer-button')) {
        event.preventDefault();
        event.stopPropagation();
        const singerName = button.dataset.singerName; // Get from data attribute
        if (singerName && searchInput) {
            searchInput.value = singerName;
            handleFilterClick('singer', true);
        }
        return;
    }
}


// --- Load More Logic ---
// ... (שמור על loadMoreResults, toggleLoadMoreButton ללא שינוי)
function loadMoreResults() {
    console.log(`Load More: Displayed=${displayedResults}, Total=${results.length}`);
    const startIndex = displayedResults;
    const newLimit = displayedResults + 250;
    const endIndex = Math.min(newLimit, results.length);

    if (startIndex >= results.length) {
        console.log("No more results to load.");
        if (loadMoreButton) loadMoreButton.style.display = 'none';
        return;
    }

    const newResultsToDisplay = results.slice(startIndex, endIndex);
    console.log(`Loading results from ${startIndex} to ${endIndex} (${newResultsToDisplay.length} new songs)`);
    displayResults(newResultsToDisplay, true);
    displayedResults = endIndex;
    console.log(`Load More Finished. New displayed=${displayedResults}, Button visible=${loadMoreButton ? loadMoreButton.style.display : 'N/A'}`);
}

function toggleLoadMoreButton() {
     if (loadMoreButton) {
        loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
     }
}


// --- Download Logic ---

// Wrapper function to handle button state during download
async function downloadSongWrapper(buttonElement) {
    if (!buttonElement) return;
    const songSerial = buttonElement.dataset.songSerial;
    if (!songSerial) return;

    // Prevent multiple clicks on the same button
    if (buttonElement.disabled || buttonElement.classList.contains('download-in-progress')) {
        console.warn("Download already in progress for this button.");
        return;
    }

    buttonElement.disabled = true;
    buttonElement.classList.add('download-in-progress');
    const originalIcon = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; // Loading spinner

    try {
        await downloadSong(songSerial);
        // Success feedback (optional, progress bar handles it)
        // buttonElement.innerHTML = '<i class="fas fa-check"></i>';
    } catch (error) {
        // Failure feedback (optional, message modal handles it)
        // buttonElement.innerHTML = '<i class="fas fa-times"></i>';
        console.error(`Download wrapper caught error for ${songSerial}:`, error);
    } finally {
        // Restore button after a delay, regardless of success/failure
        setTimeout(() => {
            if (buttonElement) {
                buttonElement.innerHTML = originalIcon;
                buttonElement.disabled = false;
                buttonElement.classList.remove('download-in-progress');
            }
        }, 2000); // Adjust delay as needed
    }
}


// Make downloadSong globally accessible IF NEEDED by other scripts (like shared handler)
// Ensure this doesn't conflict with other scripts defining it.
window.downloadSong = async function(songNumber) { // Use window.downloadSong
    if (!songNumber) {
        console.error("Invalid song number provided for download.");
        if(typeof showMessage === 'function') showMessage("שגיאה: מספר שיר לא תקין.");
        return Promise.reject(new Error("Invalid song number"));
    }

    // --- Optional: Single check (if showSinglesOnly logic is still relevant) ---
    if (showSinglesOnly) {
        let songData = results.find(s => s.serial === songNumber) || allSongs.find(s => s.serial === songNumber);
        if (songData) {
            const isSingle = (songData.album && typeof songData.album === 'string' && songData.album.toLowerCase().includes('סינגלים')) ||
                             (songData.singer && typeof songData.singer === 'string' && songData.singer.toLowerCase().includes('סינגלים'));
            if (!isSingle) {
                 if(typeof showMessage === 'function') showMessage('באתר זה מוצגים סינגלים בלבד. לא ניתן להוריד שיר זה.');
                 // No row class to remove here, handled by wrapper
                return Promise.reject(new Error("Attempted to download non-single item"));
            }
        }
    }
    // --- End Optional Single Check ---


    const existingPromise = downloadPromises.find(p => p.songNumber === songNumber);
    if (existingPromise) {
        console.warn(`Download for song ${songNumber} already in progress.`);
        return existingPromise.promise; // Return existing promise
    }

    // Initialize/Update Progress Bar State
    if (downloadPromises.length === 0) {
        downloadedSongsCount = 0;
        totalSongsToDownload = 0;
    }
    totalSongsToDownload++;
    const currentDownloadQueuePosition = totalSongsToDownload;

    if (loadingMessage && !loadingMessage.classList.contains('show')) {
         loadingMessage.classList.add('show');
    }
    updateProgressDisplay(0, currentDownloadQueuePosition, 'מתחיל...');

    // Create the Download Promise
    const downloadAction = new Promise(async (resolve, reject) => {
        try {
            updateProgressDisplay(15, currentDownloadQueuePosition, 'מעבד...');

            // Use the Google Apps Script URL
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec';
            const fetchUrl = `${scriptUrl}?songNumber=${encodeURIComponent(songNumber)}`;

            const response = await fetch(fetchUrl);
            let errorMsg = `שגיאת רשת (${response.status})`;
            if (!response.ok) {
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMsg = errorData.message;
                    }
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            updateProgressDisplay(40, currentDownloadQueuePosition, 'מעבד...');

            if (data.success && data.downloadLink) {
                updateProgressDisplay(60, currentDownloadQueuePosition, 'מוריד...');
                // Trigger download via hidden link
                const link = document.createElement('a');
                link.href = data.downloadLink;
                const filename = data.originalFileName || `${songNumber}.mp3`;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                await new Promise(res => setTimeout(res, 1500)); // Simulate download time

                downloadedSongsCount++;
                updateProgressDisplay(100, currentDownloadQueuePosition, 'הושלם!');
                resolve({ songNumber: songNumber, status: 'success' });

            } else {
                 throw new Error(data.message || 'הורדה נכשלה מסיבה לא ידועה.');
            }
        } catch (error) {
            console.error(`Download Error for ${songNumber}:`, error);
            if(typeof showMessage === 'function') showMessage(`שגיאה בהורדת שיר ${songNumber}: ${error.message}`);
            updateProgressDisplay(null, currentDownloadQueuePosition, 'נכשל');
            reject({ songNumber: songNumber, status: 'error', error: error }); // Reject the promise
        }
    });

    // Store the promise
    const promiseEntry = { songNumber: songNumber, promise: downloadAction };
    downloadPromises.push(promiseEntry);

    // Handle Promise Completion (Finally Block)
    downloadAction
      .catch(err => { /* Error handled within promise catch, and by wrapper */ })
      .finally(() => {
          // Remove from active list
          downloadPromises = downloadPromises.filter(p => p.songNumber !== songNumber);

          if (downloadPromises.length === 0) {
              // Last download finished
              setTimeout(() => {
                  if (loadingMessage && loadingMessage.classList.contains('show')) {
                      const finalMessage = `הורדת ${downloadedSongsCount}/${totalSongsToDownload} שירים הושלמה!`;
                      if (progressText) progressText.innerText = finalMessage;
                      if (progressBar) progressBar.style.width = `100%`;
                      setTimeout(() => {
                          loadingMessage.classList.remove('show');
                          downloadedSongsCount = 0; // Reset counters
                          totalSongsToDownload = 0;
                      }, 2000); // Hide after showing completion message
                  }
              }, 500); // Short delay before showing final completion
          } else {
              // More downloads pending - update progress based on completed count
              updateProgressDisplay(null, null, `מוריד (${downloadPromises.length} נותרו)`);
          }
      });

    return downloadAction; // Return the promise
}

// Helper to update progress UI
// ... (שמור על updateProgressDisplay ללא שינוי)
function updateProgressDisplay(percentage, currentQueuePosition, statusText = '') {
    if (loadingMessage && loadingMessage.classList.contains('show')) {
        let progressPrefix = '';
        if (currentQueuePosition !== null && totalSongsToDownload > 1) {
            progressPrefix = `${currentQueuePosition}/${totalSongsToDownload}`;
        }

        if (progressText) {
            progressText.innerText = `${progressPrefix} ${statusText}`.trim();
        }

        let displayPercentage = 0;
        if (totalSongsToDownload > 0) {
            // Calculate percentage based on completed count + progress of current item
            const baseCompletedPercentage = (downloadedSongsCount / totalSongsToDownload) * 100;
             if (currentQueuePosition !== null && percentage !== null && downloadPromises.length > 0) {
                 // Only add contribution of the *current* downloading item
                 const weightOfCurrent = 1 / totalSongsToDownload;
                 const currentItemContribution = percentage * weightOfCurrent;
                 displayPercentage = baseCompletedPercentage + currentItemContribution;
            } else {
                // If no current item progress, just show based on completed count
                displayPercentage = baseCompletedPercentage;
            }
             displayPercentage = Math.max(0, Math.min(100, Math.round(displayPercentage)));
        }


        if (progressBar) {
            progressBar.style.width = `${displayPercentage}%`;
            // Optional: Add transition for smoother updates
            // progressBar.style.transition = 'width 0.3s ease-in-out';
        }
    }
}