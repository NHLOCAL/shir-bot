// assets/js/search.js

// --- Global Variables & State ---
let allSongs = [];
let results = [];
let displayedResults = 0;
// Default showSinglesOnly to true as per original code, adjust if needed
let showSinglesOnly = true;
let downloadPromises = [];
let downloadedSongsCount = 0;
let totalSongsToDownload = 0;
let activeFilter = 'all'; // Default filter

// --- DOM Elements ---
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
// Function to clear URL parameters without reloading
function clearUrlParams() {
    try {
        // Use replaceState to modify URL without adding to history
        // Construct the correct clean URL pointing to the site root (index.html)
        const cleanUrl = window.location.origin + (baseurl || '') + '/';
        if (window.location.href !== cleanUrl) { // Only replace if different
             window.history.replaceState({}, document.title, cleanUrl);
             console.log("URL parameters cleared.");
        }
    } catch (e) {
        console.error("Error clearing URL parameters:", e);
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if this is the homepage
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || ''); // Added check for just baseurl

    const urlParams = new URLSearchParams(window.location.search);
    const searchValue = urlParams.get('search');
    const searchByParam = urlParams.get('searchBy') || 'all';

    // Preload CSV data first
    preloadCSVData().then(() => {
        let searchPerformedFromUrl = false;
        // Handle initial search ONLY on the homepage based on URL parameters
        if (isHomepage && searchValue) {
            console.log(`Homepage loaded with search params: search=${searchValue}, searchBy=${searchByParam}`);
            if (searchInput) searchInput.value = decodeURIComponent(searchValue);
            handleFilterClick(searchByParam, false); // Set filter visually only
            searchSongs(searchValue.toLowerCase(), searchByParam); // Perform initial search
            searchPerformedFromUrl = true; // Mark that a search was done
        } else if (isHomepage) {
             // Homepage loaded without search params
             console.log("Homepage loaded without search params.");
             handleFilterClick('all', false); // Ensure 'all' filter is visually active
             // Use internal function or global if available
             if (typeof showHomepageView === 'function') {
                 showHomepageView();
             } else {
                 showHomepageViewInternal();
             }
        }
        // else: Not homepage, preloadCSVData finished, specific page JS will handle interactions.

        // Clear URL parameters *after* potential initial search on homepage is done
        // Only clear if params actually existed initially
        if (isHomepage && (searchValue || urlParams.has('searchBy'))) {
             // Delay slightly to ensure search rendering starts if needed
             setTimeout(clearUrlParams, 150); // Increased delay slightly
        }

    }).catch(error => {
        console.error("Error during initialization or initial data load:", error);
        // Display error in results area only if it's supposed to be visible
        const shouldShowResults = isHomepage && (!homepageContent || homepageContent.style.display === 'none');
        if (shouldShowResults) {
            if (resultsTableBody) {
                 resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה חמורה בטעינת נתונים. נסה לרענן.</td></tr>';
                 if (resultsTableThead) resultsTableThead.style.display = "none";
                 if (loadMoreButton) loadMoreButton.style.display = 'none';
            }
        }
    });


    // Add Enter key listener to search input
    if (searchInput) {
        searchInput.addEventListener("keypress", function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitForm(); // Call the consolidated submit function
            }
        });
    }

    // Add submit listener to form
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
          event.preventDefault();
          submitForm(); // Call the consolidated submit function
        });
    }

    // Add click listeners to filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Determine if search should be triggered based on current page
             const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
            handleFilterClick(this.dataset.filter, isHomepage); // Pass true only if on homepage
        });
    });

     // Add click listener for "Load More" button
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreResults);
    }
});

// --- View Switching ---
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
function submitForm() {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const searchTerm = searchInput ? searchInput.value.trim() : ''; // Get value safely
    const searchTermLower = searchTerm.toLowerCase();
    const currentActiveFilter = activeFilter; // Use the globally tracked active filter

    if (!isHomepage) {
        // If NOT on homepage, REDIRECT
        if (searchTerm) {
             const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(currentActiveFilter)}`;
             console.log(`Redirecting from non-homepage search submit to: ${redirectUrl}`);
             window.location.href = redirectUrl;
        } else {
             searchInput?.focus(); // Just focus if empty on other pages
        }
    } else {
        // --- If ON homepage, perform search locally ---
        searchSongs(searchTermLower, currentActiveFilter);
        // Clear URL params AFTER the search is initiated on the homepage
        // Use a timeout to ensure it happens after searchSongs might update display
        setTimeout(clearUrlParams, 100);
    }
}

// --- handleFilterClick updated ---
function handleFilterClick(filter, doSearch = false) { // Default doSearch to false
    if (!filter) return;
    activeFilter = filter; // Update global active filter state
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    // Trigger search only if explicitly told to (e.g., on homepage filter click)
    if (doSearch) {
       const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : ''; // Get value safely
       searchSongs(searchTerm, activeFilter);
       // Clear URL params AFTER the search from filter click is initiated
       setTimeout(clearUrlParams, 100);
    }
}

// --- searchSongs function ---
async function searchSongs(query, searchBy) {
    // Show search view immediately when a search is triggered on homepage
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
     if (isHomepage) {
         // Use internal function or global if available
         if (typeof showSearchResultsView === 'function') {
             showSearchResultsView();
         } else {
             showSearchResultsViewInternal();
         }
     } else {
          // This function should ideally only run fully on the homepage now.
          // If called elsewhere, it might be an error unless specifically intended.
          console.warn("searchSongs called on non-homepage. Redirect should have happened.");
          return; // Prevent execution on non-homepage
     }

    // Handle empty query based on searchBy
    if (!query && searchBy === 'all') {
        displayResults([]); // Display empty state message
        if (resultsTableThead) resultsTableThead.style.display = "none";
        if(loadMoreButton) loadMoreButton.style.display = 'none';
        return; // Stop processing
    }

    displayLoadingMessage(); // Show loading indicator

    // Ensure data is loaded
    if (allSongs.length === 0) {
        try {
            await preloadCSVData(); // Wait for preload to finish if not already done
        } catch (error) {
             console.error("Failed to load song data during search:", error);
             if (resultsTableBody) resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>';
             if (resultsTableThead) resultsTableThead.style.display = "none";
             if (loadMoreButton) loadMoreButton.style.display = 'none';
             return;
        }
        // Check again if loading failed despite waiting
        if (allSongs.length === 0) {
             console.error("Song data is still empty after attempting load.");
              if (resultsTableBody) resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>';
             if (resultsTableThead) resultsTableThead.style.display = "none";
             if (loadMoreButton) loadMoreButton.style.display = 'none';
             return;
        }
    }

    // Perform the actual search and display
    performSearch(query, searchBy);
    // URL clearing is handled by the caller (submitForm, filter click, initial load)
}

// --- performSearch --- (No changes needed here for redirection logic)
function performSearch(query, searchBy) {
    let baseSongsToFilter; // Use a temporary variable

    // Apply "Singles Only" filter if active
    if (showSinglesOnly) {
        // Filter the master list 'allSongs' first
        // Ensure checks handle null/undefined and non-string types gracefully
        baseSongsToFilter = allSongs.filter(song =>
            (song.album && typeof song.album === 'string' && song.album.toLowerCase().includes('סינגלים')) ||
            (song.singer && typeof song.singer === 'string' && song.singer.toLowerCase().includes('סינגלים'))
        );
         // console.log(`Filtering singles: ${allSongs.length} -> ${baseSongsToFilter.length}`); // Optional debug log
    } else {
        // If not filtering by singles, use the entire list
        baseSongsToFilter = allSongs;
    }

    // Apply the main search query filter ON TOP of the base list
    results = filterSongs(baseSongsToFilter, query, searchBy);

    // Reset display count and show initial results
    displayedResults = 0;
    const initialResultsToShow = results.slice(0, 250); // Show first 250 of the FINAL results
    displayedResults = initialResultsToShow.length;

    displayResults(initialResultsToShow, false); // Display new results, overwrite old

    // toggleLoadMoreButton is called within displayResults
}

// --- Data Loading & Parsing ---
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
    const currentCSVUrl = (baseurl || '') + '/assets/data/songs.csv'; // Ensure baseurl is handled

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
         throw error; // Re-throw
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
                if (song.serial || song.name) { // Basic validation
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
        if (searchBy === 'all') {
            return [];
        } else {
            return songsToFilter.filter(song => song[searchBy] && String(song[searchBy]).trim() !== '');
        }
    }

    // Fuzzy search logic (Dice Coefficient & Levenshtein Distance)
    const calculateDiceCoefficient = (tokens1, tokens2) => {
        if (!tokens1.length || !tokens2.length) return 0;
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

    const queryTokens = query.split(/\s+/).filter(Boolean);
    const fuzzyThreshold = 0.55;
    const levenshteinThreshold = 0.45;

    const filtered = songsToFilter.filter(song => {
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

            // 1. Exact match variations
            if (searchBy === 'serial' && lowerValue.startsWith(query)) return true;
            if (searchBy !== 'serial' && lowerValue.includes(query)) return true;
            if (searchBy === 'all' && lowerValue.includes(query)) return true; // Ensure 'all' includes check works

            // 2. Fuzzy match
            const valueTokens = lowerValue.split(/\s+/).filter(Boolean);
            const diceSim = calculateDiceCoefficient(queryTokens, valueTokens);
            if (diceSim >= fuzzyThreshold) return true;

            const levDist = calculateNormalizedLevenshteinDistance(query, lowerValue);
            if (levDist <= levenshteinThreshold) return true;
        }
        return false;
    });

    // Sort by serial
    return filtered.sort((a, b) => {
        const serialA = parseInt(a.serial, 10) || 0;
        const serialB = parseInt(b.serial, 10) || 0;
        return serialA - serialB;
    });
}

// --- Display Logic ---
function displayLoadingMessage() {
    if (!resultsTableBody) return;
    // Ensure search results view is active
     if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    resultsTableBody.innerHTML = ''; // Clear previous content

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.setAttribute('colspan', '4');
    loadingCell.style.textAlign = 'center';

    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('loading-container');

    const loadingImage = document.createElement('img');
    loadingImage.src = (baseurl || '') + '/assets/images/loading.gif'; // Handle baseurl
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

    // Ensure search results view is active
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    if (!append) {
        resultsTableBody.innerHTML = '';
    }

    if (resultsToDisplay.length === 0 && !append) {
        const noResultsRow = document.createElement('tr');
        const noResultsCell = document.createElement('td');
        noResultsCell.setAttribute('colspan', '4');
        noResultsCell.textContent = 'לא נמצאו תוצאות התואמות את החיפוש.';
        noResultsCell.style.textAlign = 'center';
        noResultsRow.appendChild(noResultsCell);
        resultsTableBody.appendChild(noResultsRow);
        if (resultsTableThead) resultsTableThead.style.display = "none";
        toggleLoadMoreButton();
        return;
    }

    if (resultsToDisplay.length > 0 && resultsTableThead && (resultsTableThead.style.display === "none" || !resultsTableThead.style.display)) {
        resultsTableThead.style.display = "";
    }

    const fragment = document.createDocumentFragment();
    resultsToDisplay.forEach(song => {
        const row = document.createElement('tr');
        row.dataset.songSerial = song.serial;

        // Serial Number Cell (with copy link)
        const serialCell = document.createElement('td');
        const serialLink = document.createElement('a');
        serialLink.textContent = song.serial;
        serialLink.href = '#';
        serialLink.title = 'העתק קישור לשיר זה';
        serialLink.classList.add('serial-link');
        serialCell.appendChild(serialLink);
        row.appendChild(serialCell);

        // Song Name Cell
        const nameCell = document.createElement('td');
        nameCell.textContent = song.name;
        row.appendChild(nameCell);

        // Album Name Cell (with filter button)
        const albumCell = document.createElement('td');
        const albumButton = document.createElement('button');
        albumButton.textContent = song.album;
        albumButton.classList.add('album-button');
        albumButton.dataset.albumName = song.album;
        albumButton.title = `חפש אלבום: ${song.album}`;
        albumCell.appendChild(albumButton);
        row.appendChild(albumCell);

        // Singer Name Cell (with filter button)
        const singerCell = document.createElement('td');
        const singerButton = document.createElement('button');
        singerButton.textContent = song.singer;
        singerButton.classList.add('singer-button');
        singerButton.dataset.singerName = song.singer;
        singerButton.title = `חפש זמר: ${song.singer}`;
        singerCell.appendChild(singerButton);
        row.appendChild(singerCell);

        fragment.appendChild(row);
    });

    resultsTableBody.appendChild(fragment);
    toggleLoadMoreButton();
}

// --- Event Delegation for Row Clicks ---
if (resultsTableBody) {
    resultsTableBody.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('tr');
        if (!row || !row.dataset.songSerial) return;

        const songSerial = row.dataset.songSerial;
        const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');

        // 1. Handle Serial Link Click (Copy)
        if (target.classList.contains('serial-link')) {
            event.preventDefault();
            const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
            // Use functions from core.js (assuming they are globally available)
            if (typeof copyToClipboard === 'function') copyToClipboard(shareLink);
            if (typeof showCopiedMessage === 'function') showCopiedMessage();
            return;
        }

        // 2. Handle Album Button Click (Search on Homepage or Redirect)
        if (target.classList.contains('album-button')) {
            event.preventDefault();
            const albumName = target.dataset.albumName;
            if (albumName) {
                 if (isHomepage && searchInput) { // Check searchInput exists
                     searchInput.value = albumName;
                     handleFilterClick('album', true); // Activate filter and trigger search on homepage
                     // URL clearing is handled by handleFilterClick
                 } else {
                      // Fallback redirect:
                      const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(albumName)}&searchBy=album`;
                      window.location.href = redirectUrl;
                 }
            }
            return;
        }

        // 3. Handle Singer Button Click (Search on Homepage or Redirect)
        if (target.classList.contains('singer-button')) {
            event.preventDefault();
            const singerName = target.dataset.singerName;
            if (singerName) {
                 if (isHomepage && searchInput) { // Check searchInput exists
                    searchInput.value = singerName;
                    handleFilterClick('singer', true); // Activate filter and trigger search on homepage
                    // URL clearing is handled by handleFilterClick
                 } else {
                     // Fallback redirect:
                     const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(singerName)}&searchBy=singer`;
                     window.location.href = redirectUrl;
                 }
            }
            return;
        }

        // 4. Handle Row Click (Download) - Only if on homepage and target is TD/TR
        if (isHomepage && (target.tagName === 'TD' || target.tagName === 'TR')) {
            // Prevent accidental double-clicks
            if (row.classList.contains('download-in-progress')) {
                console.warn("Download already in progress for this row.");
                return;
            }
            row.classList.add('download-in-progress');

            // Retrieve the full song details for the single check
            let songData = results.find(s => s.serial === songSerial) || allSongs.find(s => s.serial === songSerial);

            // Check if filtering by singles is active AND song data was found AND it's NOT a single
            if (showSinglesOnly && songData) {
                const isSingle = (songData.album && typeof songData.album === 'string' && songData.album.toLowerCase().includes('סינגלים')) ||
                                 (songData.singer && typeof songData.singer === 'string' && songData.singer.toLowerCase().includes('סינגלים'));
                if (!isSingle) {
                     if (typeof showMessage === 'function') showMessage('באתר זה מוצגים סינגלים בלבד. לא ניתן להוריד שיר זה.'); // Use core.js function
                     row.classList.remove('download-in-progress'); // Remove flag
                     return; // Stop download attempt
                }
            }

            // Proceed with download (assuming downloadSong function exists)
            if (typeof downloadSong === 'function') {
                 downloadSong(songSerial)
                    .catch(err => console.error("Download promise rejected in row click:", err)) // Error likely shown in downloadSong
                    .finally(() => {
                        setTimeout(() => {
                            if (row) row.classList.remove('download-in-progress');
                        }, 1500);
                    });
            } else {
                 console.error("downloadSong function is not defined.");
                 if(typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
                 row.classList.remove('download-in-progress');
            }
        }
        // Note: Row clicks on non-homepage (like artist page) might still trigger download via their respective JS files if downloadSong is global
    });
}

// --- Load More Logic ---
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

    displayResults(newResultsToDisplay, true); // Append the new results

    displayedResults = endIndex; // Update the count

    // toggleLoadMoreButton is called within displayResults
    console.log(`Load More Finished. New displayed=${displayedResults}, Button visible=${loadMoreButton ? loadMoreButton.style.display : 'N/A'}`);
}

function toggleLoadMoreButton() {
     if (loadMoreButton) {
        loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
     }
}

// --- Download Logic ---
async function downloadSong(songNumber) {
    if (!songNumber) {
        console.error("Invalid song number provided for download.");
        if(typeof showMessage === 'function') showMessage("שגיאה: מספר שיר לא תקין.");
        return Promise.reject(new Error("Invalid song number"));
    }

    // Retrieve song details for single check
    let songData = results.find(s => s.serial === songNumber) || allSongs.find(s => s.serial === songNumber);

    // Single check logic
    if (showSinglesOnly && songData) {
        const isSingle = (songData.album && typeof songData.album === 'string' && songData.album.toLowerCase().includes('סינגלים')) ||
                         (songData.singer && typeof songData.singer === 'string' && songData.singer.toLowerCase().includes('סינגלים'));
        if (!isSingle) {
             if(typeof showMessage === 'function') showMessage('באתר זה מוצגים סינגלים בלבד. לא ניתן להוריד שיר זה.');
            const row = resultsTableBody?.querySelector(`tr[data-song-serial="${songNumber}"]`);
            if (row) row.classList.remove('download-in-progress');
            return Promise.reject(new Error("Attempted to download non-single item"));
        }
    }

    // Prevent multiple downloads of the same song
    const existingPromise = downloadPromises.find(p => p.songNumber === songNumber);
    if (existingPromise) {
        console.warn(`Download for song ${songNumber} already in progress.`);
        return existingPromise.promise;
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
            let errorMsg = `שגיאת רשת (${response.status})`; // Default error
            if (!response.ok) {
                try { // Try to parse specific error from script
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMsg = errorData.message;
                    }
                } catch (e) { /* Ignore if not JSON */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();
            updateProgressDisplay(40, currentDownloadQueuePosition, 'מעבד...');

            if (data.success && data.downloadLink) {
                updateProgressDisplay(60, currentDownloadQueuePosition, 'מוריד...');
                await new Promise(res => setTimeout(res, 50));
                updateProgressDisplay(80, currentDownloadQueuePosition, 'מוריד...');

                // Trigger download
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
            reject({ songNumber: songNumber, status: 'error', error: error });
        }
    });

    // Store the promise
    const promiseEntry = { songNumber: songNumber, promise: downloadAction };
    downloadPromises.push(promiseEntry);

    // Handle Promise Completion (Finally Block)
    downloadAction
      .catch(err => { /* Error handled within promise catch */ })
      .finally(() => {
          downloadPromises = downloadPromises.filter(p => p.songNumber !== songNumber); // Remove from active list

          if (downloadPromises.length === 0) {
              // Last download finished
              setTimeout(() => {
                  if (loadingMessage && loadingMessage.classList.contains('show')) {
                      const finalMessage = `הורדת ${downloadedSongsCount}/${totalSongsToDownload} שירים הושלמה!`;
                      if (progressText) progressText.innerText = finalMessage;
                      if (progressBar) progressBar.style.width = `100%`;

                      setTimeout(() => {
                          loadingMessage.classList.remove('show');
                          // Reset counters after hiding
                          downloadedSongsCount = 0;
                          totalSongsToDownload = 0;
                      }, 2000);
                  }
              }, 500);
          } else {
              // More downloads pending
              updateProgressDisplay(null, null, `מוריד (${downloadPromises.length} נותרו)`);
          }
      });

    return downloadAction;
}

// Helper to update progress UI
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
            displayPercentage = Math.round((downloadedSongsCount / totalSongsToDownload) * 100);
            if (currentQueuePosition !== null && percentage !== null && downloadPromises.length > 0) {
                 const weightOfCurrent = 1 / totalSongsToDownload;
                 const currentItemContribution = percentage * weightOfCurrent;
                 const baseCompletedPercentage = (downloadedSongsCount / totalSongsToDownload) * 100;
                 displayPercentage = Math.max(baseCompletedPercentage, Math.min(100, baseCompletedPercentage + currentItemContribution));
            }
             displayPercentage = Math.max(0, Math.min(100, Math.round(displayPercentage)));
        }

        if (progressBar) {
            progressBar.style.width = `${displayPercentage}%`;
        }
    }
}

// --- URL Handling ---
// updateURLWithoutReload is NO LONGER USED for setting params on homepage search.
/*
function updateURLWithoutReload(query = null, searchBy = null) {
    // Function deprecated for setting params post-search on homepage.
    // Kept commented for historical reference if needed.
    // try {
    //     const url = new URL(window.location.href);
    //     url.searchParams.delete('search');
    //     url.searchParams.delete('searchBy');
    //     const cleanQuery = query ? String(query).trim() : '';
    //     if (cleanQuery) {
    //         url.searchParams.set('search', cleanQuery);
    //         const cleanSearchBy = searchBy ? String(searchBy).trim() : 'all';
    //         if (cleanSearchBy !== 'all') {
    //             url.searchParams.set('searchBy', cleanSearchBy);
    //         }
    //     }
    //     window.history.replaceState({}, document.title, url.toString());
    // } catch (e) {
    //      console.error("Error updating URL:", e);
    // }
}
*/