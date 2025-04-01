// assets/js/search.js

// --- Global Variables & State ---
let allSongs = [];
let results = [];
let displayedResults = 0;
let showSinglesOnly = true; // Default to false (can be toggled if needed)
let downloadPromises = [];
let downloadedSongsCount = 0;
let totalSongsToDownload = 0;
let activeFilter = 'all'; // Default filter

// --- DOM Elements ---
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-button'); // Get all filter buttons
const loadMoreButton = document.getElementById('loadMoreButton');
const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list'); // Prefer specific tbody first
const loadingMessage = document.getElementById('loadingMessage');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progress');
const resultsTableThead = document.querySelector("#resultsTable thead"); // Corrected selector
const resultsTable = document.getElementById('resultsTable'); // Get the container table
const homepageContent = document.getElementById('homepage-content'); // Added for view switching
const searchResultsArea = document.getElementById('search-results-area'); // Added for view switching

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Preload data or handle URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchValue = urlParams.get('search');
    const searchByParam = urlParams.get('searchBy') || 'all'; // Get searchBy param or default

    // Preload CSV data regardless of search params for faster subsequent searches
    preloadCSVData().then(() => {
        // Now handle initial search *after* data might be loaded
        if (searchValue) {
            searchInput.value = decodeURIComponent(searchValue); // Decode from URL
            handleFilterClick(searchByParam, false); // Set filter visually without searching yet
            // View switching is handled inside searchSongs
            searchSongs(searchValue.toLowerCase(), searchByParam); // Perform initial search
            // updateURLWithoutReload(); // Clean the URL? Let's keep params for refresh
        } else {
            // No search params, ensure default 'all' filter button is active
            handleFilterClick('all', false);
            // Ensure homepage view is shown if no search params
            // Use internal function or global if available
            if (typeof showHomepageView === 'function') {
                showHomepageView();
            } else {
                showHomepageViewInternal();
            }
        }
    }).catch(error => {
        console.error("Error during initialization or initial data load:", error);
        // Display error in results area if homepage isn't showing
        if (!homepageContent || homepageContent.style.display === 'none') {
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
                event.preventDefault(); // Prevent default form submission
                submitForm();
            }
        });
    }

    // Add submit listener to form
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
          event.preventDefault(); // Prevent default form submission
          submitForm();
        });
    }

    // Add click listeners to filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            handleFilterClick(this.dataset.filter); // Default behavior: search on click
        });
    });

     // Add click listener for "Load More" button
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreResults);
    }
});

// --- View Switching --- (Helper functions, might exist in homepage.js too)
// Ensures these functions exist even if homepage.js fails or isn't loaded
function showSearchResultsViewInternal() {
    if (homepageContent) homepageContent.style.display = 'none';
    if (searchResultsArea) searchResultsArea.style.display = 'block';
    // Ensure results table container itself is visible if it was hidden separately
    if (resultsTable && resultsTable.style.display === 'none') {
        resultsTable.style.display = ''; // Default display
    }
}

function showHomepageViewInternal() {
    if (homepageContent) homepageContent.style.display = 'block';
    if (searchResultsArea) searchResultsArea.style.display = 'none';
}

// --- Search Execution ---
function submitForm() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    // Update URL when form is submitted
    updateURLWithoutReload(searchInput.value.trim(), activeFilter);
    searchSongs(searchTerm, activeFilter);
}

async function searchSongs(query, searchBy) {
    // Show search view immediately when a search is triggered
    if (typeof showSearchResultsView === 'function') {
        showSearchResultsView();
    } else {
        showSearchResultsViewInternal();
    }

    // Handle empty query based on searchBy
    if (!query && searchBy === 'all') {
        displayResults([]); // Display empty state message
        if (resultsTableThead) resultsTableThead.style.display = "none";
        loadMoreButton.style.display = 'none';
        // Do NOT switch back to homepage view automatically here.
        // User might want to see the empty state before trying a new search.
        return; // Stop processing
    }

    // Proceed with search logic (loading message, data loading, filtering)
    displayLoadingMessage(); // Show loading indicator

    // Ensure data is loaded
    if (allSongs.length === 0) {
        try {
            await preloadCSVData();
        } catch (error) {
             console.error("Failed to load song data during search:", error);
             resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>';
             if (resultsTableThead) resultsTableThead.style.display = "none";
             if (loadMoreButton) loadMoreButton.style.display = 'none'; // Hide load more on error
             return;
        }
        // Check again if loading failed
        if (allSongs.length === 0) {
             console.error("Song data is still empty after attempting load.");
             resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>';
             if (resultsTableThead) resultsTableThead.style.display = "none";
             if (loadMoreButton) loadMoreButton.style.display = 'none';
             return;
        }
    }

    // Perform the actual search and display
    performSearch(query, searchBy);

    // Don't update URL here; done in submitForm
}


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

    // Apply the main search query filter ON TOP of the base list (which might already be filtered for singles)
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
    // Prevent multiple simultaneous loads using a static property on the function
    if (preloadCSVData.loading) {
        console.log("CSV data is already loading.");
        return preloadCSVData.promise; // Return existing promise
    }
    if (allSongs.length > 0) {
         console.log("CSV data already loaded.");
         return Promise.resolve(); // Already loaded
    }

    preloadCSVData.loading = true;
    const currentCSVUrl = baseurl + '/assets/data/songs.csv'; // Ensure this path is correct

    preloadCSVData.promise = new Promise(async (resolve, reject) => {
        try {
            console.log("Preloading CSV data...");
            const currentCSVText = await fetchCSV(currentCSVUrl);
            if (currentCSVText) {
                allSongs = parseCSV(currentCSVText);
                console.log(`CSV data preloaded: ${allSongs.length} songs.`);
                resolve();
            } else {
                 // This case might not happen if fetchCSV throws on empty response
                 console.error('Fetched CSV data is empty.');
                 allSongs = [];
                 reject(new Error('Fetched CSV data is empty.'));
            }
        } catch (error) {
            console.error('Error preloading CSV data:', error);
            allSongs = []; // Ensure it's empty on error
            reject(error); // Reject the promise on error
        } finally {
            preloadCSVData.loading = false; // Reset loading flag
            preloadCSVData.promise = null; // Clear promise reference
        }
    });
    return preloadCSVData.promise;
}
// Initialize static properties for the loading flag and promise
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
            // Handle cases where the fetch is ok but the body is empty
            throw new Error('CSV file is empty or failed to load content.');
        }
        return text;
    } catch (error) {
         console.error(`Failed to fetch CSV from ${url}:`, error);
         // Re-throw the error to be caught by the caller (preloadCSVData)
         throw error;
    }
}

function parseCSV(csvText) {
    if (!csvText) return [];
    const lines = csvText.split('\n');
    const songs = [];
    // Start from 1 to skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            // Robust CSV parsing: handles commas inside quoted fields
            const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(field =>
                field.trim().replace(/^"|"$/g, '') // Trim whitespace and remove surrounding quotes
            );

            if (columns.length >= 4) {
                const song = {
                    serial: columns[0] || '', // Default to empty string if missing
                    name: columns[1] || '',
                    album: columns[2] || '',
                    singer: columns[3] || ''
                };
                // Basic validation: Ensure at least a name or serial exists?
                if (song.serial || song.name) {
                    songs.push(song);
                } // else: Optionally log skipped lines
            } // else: Optionally log lines with insufficient columns
        }
    }
    return songs;
}

// --- Filtering Logic ---
function handleFilterClick(filter, doSearch = true) {
    if (!filter) return;
    activeFilter = filter;
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    // Trigger search only if doSearch is true
    if (doSearch) {
       // Don't update URL on filter click, only on submit
       searchSongs(searchInput.value.trim().toLowerCase(), activeFilter);
    }
}

function filterSongs(songsToFilter, query, searchBy) {
    // Handle empty query based on searchBy
    if (!query) {
        if (searchBy === 'all') {
            return []; // No query and 'all' means no results
        } else {
            // Empty query but specific field: Show songs where that field is non-empty.
            return songsToFilter.filter(song => song[searchBy] && String(song[searchBy]).trim() !== '');
        }
    }

    // Fuzzy search logic
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
        if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.6) return 1; // Optimization: If lengths differ too much

        const matrix = Array.from({ length: len1 + 1 }, (_, i) => [i]);
        for (let j = 1; j <= len2; j++) matrix[0][j] = j;

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // Deletion
                    matrix[i][j - 1] + 1,      // Insertion
                    matrix[i - 1][j - 1] + cost // Substitution
                );
            }
        }
        const maxLen = Math.max(len1, len2);
        return maxLen === 0 ? 0 : matrix[len1][len2] / maxLen;
    };

    const queryTokens = query.split(/\s+/).filter(Boolean);
    const fuzzyThreshold = 0.55; // Dice coefficient threshold (adjust as needed)
    const levenshteinThreshold = 0.45; // Max normalized Levenshtein distance (adjust as needed)

    const filtered = songsToFilter.filter(song => {
        const fieldsToCheck = [];
        if (searchBy === 'all') {
            fieldsToCheck.push(song.serial, song.name, song.album, song.singer);
        } else if (song[searchBy] !== undefined) {
            fieldsToCheck.push(song[searchBy]);
        }

        for (const value of fieldsToCheck) {
            // Ensure value is a usable string
            const stringValue = (value === null || value === undefined) ? '' : String(value);
            if (!stringValue) continue;

            const lowerValue = stringValue.toLowerCase();

            // 1. Exact match (starts with for serial, includes for others)
            if (searchBy === 'serial' && lowerValue.startsWith(query)) return true;
            if (searchBy !== 'serial' && lowerValue.includes(query)) return true;
            // Handle exact match for 'all' filter as well
            if (searchBy === 'all' && lowerValue.includes(query)) return true;


            // 2. Fuzzy match
            const valueTokens = lowerValue.split(/\s+/).filter(Boolean);
            const diceSim = calculateDiceCoefficient(queryTokens, valueTokens);
            if (diceSim >= fuzzyThreshold) return true;

            // Levenshtein check (can be slower, use after Dice)
            const levDist = calculateNormalizedLevenshteinDistance(query, lowerValue);
            if (levDist <= levenshteinThreshold) return true;
        }
        return false; // No match found in relevant fields
    });

    // Sort results - prioritize exact matches? More complex sorting could be added.
    // Simple sort by serial for consistency.
    return filtered.sort((a, b) => {
        const serialA = parseInt(a.serial, 10) || 0;
        const serialB = parseInt(b.serial, 10) || 0;
        return serialA - serialB;
    });
}


// --- Display Logic ---
function displayLoadingMessage() {
    if (!resultsTableBody) return;
    // Ensure view is correct
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    resultsTableBody.innerHTML = ''; // Clear previous results/messages

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.setAttribute('colspan', '4'); // Span all columns
    loadingCell.style.textAlign = 'center'; // Center content

    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('loading-container');

    const loadingImage = document.createElement('img');
    loadingImage.src = baseurl + '/assets/images/loading.gif';
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

    // Hide table header and load more button while loading
    if (resultsTableThead) resultsTableThead.style.display = "none";
    if (loadMoreButton) loadMoreButton.style.display = 'none';
}


function displayResults(resultsToDisplay, append = false) {
    if (!resultsTableBody) return;

    // Ensure view is correct
    if (typeof showSearchResultsView === 'function') showSearchResultsView(); else showSearchResultsViewInternal();

    // Clear previous results only if not appending
    if (!append) {
        resultsTableBody.innerHTML = '';
    }

    // Handle no results state
    if (resultsToDisplay.length === 0 && !append) {
        const noResultsRow = document.createElement('tr');
        const noResultsCell = document.createElement('td');
        noResultsCell.setAttribute('colspan', '4');
        noResultsCell.textContent = 'לא נמצאו תוצאות התואמות את החיפוש.';
        noResultsCell.style.textAlign = 'center';
        noResultsRow.appendChild(noResultsCell);
        resultsTableBody.appendChild(noResultsRow);
        if (resultsTableThead) resultsTableThead.style.display = "none"; // Hide header
        toggleLoadMoreButton(); // Ensure load more is hidden
        return; // Stop processing
    }

    // Show header if we have results and it's hidden
    if (resultsToDisplay.length > 0 && resultsTableThead && (resultsTableThead.style.display === "none" || !resultsTableThead.style.display)) {
        resultsTableThead.style.display = ""; // Show header (default display)
    }

    // Create rows for results using a DocumentFragment for efficiency
    const fragment = document.createDocumentFragment();
    resultsToDisplay.forEach(song => {
        const row = document.createElement('tr');
        row.dataset.songSerial = song.serial; // Add serial for event delegation

        // Serial Number Cell (with copy link)
        const serialCell = document.createElement('td');
        const serialLink = document.createElement('a');
        serialLink.textContent = song.serial;
        serialLink.href = '#'; // Prevent page jump
        serialLink.title = 'העתק קישור לשיר זה';
        serialLink.classList.add('serial-link'); // Class for delegation
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
        albumButton.classList.add('album-button'); // Class for delegation
        albumButton.dataset.albumName = song.album; // Store name for listener
        albumButton.title = `חפש אלבום: ${song.album}`;
        albumCell.appendChild(albumButton);
        row.appendChild(albumCell);

        // Singer Name Cell (with filter button)
        const singerCell = document.createElement('td');
        const singerButton = document.createElement('button');
        singerButton.textContent = song.singer;
        singerButton.classList.add('singer-button'); // Class for delegation
        singerButton.dataset.singerName = song.singer; // Store name for listener
        singerButton.title = `חפש זמר: ${song.singer}`;
        singerCell.appendChild(singerButton);
        row.appendChild(singerCell);

        fragment.appendChild(row); // Add the completed row to the fragment
    });

    resultsTableBody.appendChild(fragment); // Append all new rows at once

    // Update load more button visibility AFTER appending
    toggleLoadMoreButton();
}


// --- Event Delegation for Row Clicks ---
if (resultsTableBody) {
    resultsTableBody.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('tr');
        // Ensure the click is within a row that has a song serial dataset
        if (!row || !row.dataset.songSerial) return;

        const songSerial = row.dataset.songSerial;

        // 1. Handle Serial Link Click (Copy)
        if (target.classList.contains('serial-link')) {
            event.preventDefault(); // Prevent default <a> behavior
            const shareLink = `${window.location.origin}${baseurl}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
            copyToClipboard(shareLink); // Use function from core.js
            showCopiedMessage(); // Use function from core.js
            return; // Stop further processing for this click
        }

        // 2. Handle Album Button Click (Search)
        if (target.classList.contains('album-button')) {
            event.preventDefault(); // Prevent default <button> behavior (if any)
            const albumName = target.dataset.albumName;
            if (albumName && searchInput) {
                searchInput.value = albumName; // Update search input visually
                updateURLWithoutReload(albumName, 'album'); // Update URL
                handleFilterClick('album'); // Activate filter and trigger search
            }
            return; // Stop further processing
        }

        // 3. Handle Singer Button Click (Search)
        if (target.classList.contains('singer-button')) {
            event.preventDefault();
            const singerName = target.dataset.singerName;
            if (singerName && searchInput) {
                searchInput.value = singerName; // Update search input visually
                updateURLWithoutReload(singerName, 'singer'); // Update URL
                handleFilterClick('singer'); // Activate filter and trigger search
            }
            return; // Stop further processing
        }

        // 4. Handle Row Click (Download) - If click target is TD or TR
        if (target.tagName === 'TD' || target.tagName === 'TR') {
            // Prevent accidental double-clicks triggering multiple downloads
            if (row.classList.contains('download-in-progress')) {
                console.warn("Download already in progress for this row.");
                return;
            }
            row.classList.add('download-in-progress');

            // Optional: Check if filtering by singles only is active
            if (showSinglesOnly) {
                 const songData = results.find(s => s.serial === songSerial); // Find song data in current results
                 if (songData && !songData.album?.toLowerCase().includes('סינגלים') && !songData.singer?.toLowerCase().includes('סינגלים')) {
                      showMessage('באתר זה נשלחים סינגלים בלבד, נא נסה שיר אחר!');
                      row.classList.remove('download-in-progress'); // Remove flag as download won't start
                      return;
                 }
            }

            // Proceed with download
            downloadSong(songSerial)
                .catch(err => console.error("Download promise rejected in row click:", err)) // Error already shown in downloadSong
                .finally(() => {
                    // Remove flag after a short delay to allow visual feedback or completion
                    setTimeout(() => {
                        if (row) row.classList.remove('download-in-progress');
                    }, 1500);
                });
        }
    });
}


function loadMoreResults() {
    console.log(`Load More: Displayed=${displayedResults}, Total=${results.length}`);
    const startIndex = displayedResults;
    const newLimit = displayedResults + 250; // Load next batch size
    const endIndex = Math.min(newLimit, results.length);

    if (startIndex >= results.length) {
        console.log("No more results to load.");
        if (loadMoreButton) loadMoreButton.style.display = 'none'; // Ensure button is hidden
        return;
    }

    const newResultsToDisplay = results.slice(startIndex, endIndex);
    console.log(`Loading results from ${startIndex} to ${endIndex} (${newResultsToDisplay.length} new songs)`);

    displayResults(newResultsToDisplay, true); // Append the new results

    displayedResults = endIndex; // Update the count of displayed results

    // toggleLoadMoreButton is called within displayResults, so check is done there
    console.log(`Load More Finished. New displayed=${displayedResults}, Button visible=${loadMoreButton ? loadMoreButton.style.display : 'N/A'}`);
}

function toggleLoadMoreButton() {
     if (loadMoreButton) {
        // Show if there are more results in the 'results' array than currently displayed
        loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
     }
}


// --- Download Logic ---
async function downloadSong(songNumber) {
    if (!songNumber) {
        console.error("Invalid song number provided for download.");
        showMessage("שגיאה: מספר שיר לא תקין.");
        return Promise.reject(new Error("Invalid song number")); // Return a rejected promise with an Error object
    }

    // --- ADD THIS CHECK BACK ---
    // Retrieve the full song details to check album/singer name
    // Search within the 'results' array first if available, otherwise fallback to 'allSongs'
    // Note: 'results' reflects the currently displayed filtered list.
    let songData = results.find(s => s.serial === songNumber);
    if (!songData) {
        // If not in current results (e.g., direct link?), check allSongs
        songData = allSongs.find(s => s.serial === songNumber);
    }

    // Check if filtering by singles is active AND song data was found
    if (showSinglesOnly && songData) {
        // Check if either album or singer contains "סינגלים"
        const isSingle = (songData.album && typeof songData.album === 'string' && songData.album.toLowerCase().includes('סינגלים')) ||
                         (songData.singer && typeof songData.singer === 'string' && songData.singer.toLowerCase().includes('סינגלים'));

        // If it's NOT identified as a single, show message and reject
        if (!isSingle) {
            showMessage('באתר זה מוצגים סינגלים בלבד. לא ניתן להוריד שיר זה.');
            // Find the corresponding row and remove the 'download-in-progress' class if it exists
            // Use optional chaining for safety in case resultsTableBody is null
            const row = resultsTableBody?.querySelector(`tr[data-song-serial="${songNumber}"]`);
            if (row) row.classList.remove('download-in-progress');
            return Promise.reject(new Error("Attempted to download non-single item")); // Reject the download
        }
    }
    // --- END OF ADDED CHECK ---


    // Prevent multiple simultaneous downloads of the *same* song
    const existingPromise = downloadPromises.find(p => p.songNumber === songNumber);
    if (existingPromise) {
        console.warn(`Download for song ${songNumber} already in progress.`);
        // Optionally bring loading message to front or pulse it?
        return existingPromise.promise; // Return the existing promise
    }

    // --- Initialize Progress Bar State ---
    // Only reset counts if this is the *first* download in a potential batch
    if (downloadPromises.length === 0) {
        downloadedSongsCount = 0;
        totalSongsToDownload = 0;
    }
    totalSongsToDownload++; // Increment total for this batch
    const currentDownloadQueuePosition = totalSongsToDownload; // Track position *before* adding promise

    // Show loading message (progress bar) if not already visible
    if (loadingMessage && !loadingMessage.classList.contains('show')) {
         loadingMessage.classList.add('show');
    }
    // Update progress immediately for the start of this download
    updateProgressDisplay(0, currentDownloadQueuePosition, 'מתחיל...');

    // --- Create the Download Promise ---
    const downloadAction = new Promise(async (resolve, reject) => {
        try {
            updateProgressDisplay(15, currentDownloadQueuePosition, 'מעבד...'); // Update state

            // Use the Google Apps Script URL for fetching download link
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec';
            const downloadUrl = `${scriptUrl}?songNumber=${encodeURIComponent(songNumber)}`;

            const response = await fetch(downloadUrl);
            if (!response.ok) {
                // Try to get a more specific error message from the response body
                let errorMsg = `שגיאת רשת (${response.status})`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMsg = errorData.message;
                    }
                } catch (e) { /* Ignore if response is not JSON or reading body fails */ }
                throw new Error(errorMsg); // Throw error with specific message
            }

            const data = await response.json();
            updateProgressDisplay(40, currentDownloadQueuePosition, 'מעבד...'); // Update state

            // Check if the Apps Script call was successful and provided a link
            if (data.success && data.downloadLink) {
                updateProgressDisplay(60, currentDownloadQueuePosition, 'מוריד...');
                await new Promise(res => setTimeout(res, 50)); // Short delay for UI update
                updateProgressDisplay(80, currentDownloadQueuePosition, 'מוריד...');

                // Trigger the download using a temporary link element
                const link = document.createElement('a');
                link.href = data.downloadLink;
                // Use the filename provided by Apps Script, or fallback
                const filename = data.originalFileName || `${songNumber}.mp3`;
                link.download = filename;
                document.body.appendChild(link); // Required for Firefox
                link.click();
                document.body.removeChild(link); // Clean up the link

                // Simulate download time - Replace with actual feedback if possible (hard to do reliably)
                await new Promise(res => setTimeout(res, 1500)); // Wait 1.5 seconds

                downloadedSongsCount++; // Increment successful count *only on success*
                updateProgressDisplay(100, currentDownloadQueuePosition, 'הושלם!'); // Final update for this item
                resolve({ songNumber: songNumber, status: 'success' }); // Resolve the promise

            } else {
                // Apps Script call failed or didn't return expected data
                 throw new Error(data.message || 'הורדה נכשלה מסיבה לא ידועה.');
            }
        } catch (error) {
            // Catch errors from fetch, JSON parsing, or thrown errors
            console.error(`Download Error for ${songNumber}:`, error);
            showMessage(`שגיאה בהורדת שיר ${songNumber}: ${error.message}`); // Show user-friendly message
            // Do not increment downloadedSongsCount here
            updateProgressDisplay(null, currentDownloadQueuePosition, 'נכשל'); // Update status text to indicate failure
            reject({ songNumber: songNumber, status: 'error', error: error }); // Reject the promise with details
        }
    });

    // Store the promise along with its song number for tracking
    const promiseEntry = { songNumber: songNumber, promise: downloadAction };
    downloadPromises.push(promiseEntry);

    // --- Handle Promise Completion (Finally Block) ---
    downloadAction
      .catch(err => {
          // Error is already logged and message shown within the promise catch block
          // No additional action needed here, but catch must exist if using finally
      })
      .finally(() => {
          // This runs whether the promise resolved or rejected
          // Remove this completed/failed promise from the active list
          downloadPromises = downloadPromises.filter(p => p.songNumber !== songNumber);

          // Check if this was the last promise in the current batch
          if (downloadPromises.length === 0) {
              // All downloads in this batch are done (either success or fail)
              setTimeout(() => {
                  if (loadingMessage && loadingMessage.classList.contains('show')) {
                      const finalMessage = `הורדת ${downloadedSongsCount}/${totalSongsToDownload} שירים הושלמה!`;
                      if (progressText) progressText.innerText = finalMessage;
                      // Ensure progress bar is 100% if all are done
                      if (progressBar) progressBar.style.width = `100%`;

                      // Hide the loading message after a short delay showing completion
                      setTimeout(() => {
                          loadingMessage.classList.remove('show');
                          // Reset counters *after* hiding the message for the next batch
                          downloadedSongsCount = 0;
                          totalSongsToDownload = 0;
                      }, 2000); // Hide after 2 seconds
                  }
              }, 500); // Show final message for 0.5 seconds before starting hide timer
          } else {
              // More downloads are still pending in this batch
              // Update the overall progress display based on remaining count
              updateProgressDisplay(null, null, `מוריד (${downloadPromises.length} נותרו)`);
          }
      });

    return downloadAction; // Return the promise for potential chaining or waiting
}

// Helper to update progress UI consistently
function updateProgressDisplay(percentage, currentQueuePosition, statusText = '') {
    // Only update if the loading message is actually visible
    if (loadingMessage && loadingMessage.classList.contains('show')) {
        let progressPrefix = ''; // Initialize prefix

        // Show count like "1/3" ONLY if updating a specific item's progress
        // (currentQueuePosition is not null) AND multiple downloads are queued.
        if (currentQueuePosition !== null && totalSongsToDownload > 1) {
            progressPrefix = `${currentQueuePosition}/${totalSongsToDownload}`;
        }

        // Update the text message - always show status, optionally preceded by prefix
        if (progressText) {
            progressText.innerText = `${progressPrefix} ${statusText}`.trim();
        }

        // Calculate and update the progress bar width
        let displayPercentage = 0;
        if (totalSongsToDownload > 0) {
            // Base percentage on successfully completed songs
            displayPercentage = Math.round((downloadedSongsCount / totalSongsToDownload) * 100);

            // If the currently updating item (not null position) provides a percentage,
            // factor it in lightly for visual feedback during processing.
            if (currentQueuePosition !== null && percentage !== null && downloadPromises.length > 0) {
                 const weightOfCurrent = 1 / totalSongsToDownload; // Weight of the current item
                 const currentItemContribution = percentage * weightOfCurrent;
                 const baseCompletedPercentage = (downloadedSongsCount / totalSongsToDownload) * 100;
                 // Adjust overall percentage slightly towards current item's progress,
                 // but don't let it go below the already completed % or above 100.
                 displayPercentage = Math.max(baseCompletedPercentage, Math.min(100, baseCompletedPercentage + currentItemContribution));
            }
             // Ensure display percentage is clamped between 0 and 100
             displayPercentage = Math.max(0, Math.min(100, Math.round(displayPercentage)));
        }


        if (progressBar) {
            progressBar.style.width = `${displayPercentage}%`;
        }
    }
}

// --- URL Handling ---
function updateURLWithoutReload(query = null, searchBy = null) {
    try {
        const url = new URL(window.location.href);
        // Clear existing search params first
        url.searchParams.delete('search');
        url.searchParams.delete('searchBy');

        // Add new params if they are valid
        const cleanQuery = query ? String(query).trim() : '';
        if (cleanQuery) {
            url.searchParams.set('search', cleanQuery); // Use the cleaned query
            const cleanSearchBy = searchBy ? String(searchBy).trim() : 'all';
            if (cleanSearchBy !== 'all') {
                url.searchParams.set('searchBy', cleanSearchBy);
            }
        }
        // Use replaceState to modify the URL without adding a new history entry
        window.history.replaceState({}, document.title, url.toString());
    } catch (e) {
         // Avoid crashing if URL manipulation fails (e.g., in sandboxed environments)
         console.error("Error updating URL:", e);
    }
}