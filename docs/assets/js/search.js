// assets/js/search.js

// --- Dependencies ---
// This file relies on functions defined in core.js:
// - showMessage()
// - copyToClipboard()
// - showCopiedMessage()
// It also relies on the global 'baseurl' variable.

// --- Global Variables & State ---
let allSongs = [];
let results = [];
let displayedResults = 0;
let showSinglesOnly = true; // Keep this logic if needed, otherwise remove
let downloadPromises = [];
let downloadedSongsCount = 0;
let totalSongsToDownload = 0;
let activeFilter = 'all'; // Default filter

// --- DOM Elements ---
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-button'); // Get all filter buttons
const loadMoreButton = document.getElementById('loadMoreButton');
const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list') || document.querySelector('#resultsTable tbody'); // Be more flexible finding the tbody
const loadingMessage = document.getElementById('loadingMessage');
const progressText = document.getElementById('progressText');
const progressBar = document.getElementById('progress');
const resultsTableThead = document.querySelector(".custom-table thead"); // Selector for the table head

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Preload data or handle URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const searchValue = urlParams.get('search');
    const searchByParam = urlParams.get('searchBy') || 'all'; // Get searchBy param or default

    if (searchValue) {
        searchInput.value = searchValue; // Keep case as entered by user? Maybe .toLowerCase() here?
        // Activate the correct filter button based on URL param
        handleFilterClick(searchByParam, false); // Pass false to prevent immediate search
        searchSongs(searchValue.toLowerCase(), searchByParam); // Perform initial search
        updateURLWithoutReload(); // Clean the URL
    } else {
        // Preload CSV data if no search params
        preloadCSVData();
        // Ensure default 'all' filter button is active
        handleFilterClick('all', false);
    }

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

// --- Search Execution ---
function submitForm() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    searchSongs(searchTerm, activeFilter);
}

async function searchSongs(query, searchBy) {
    // Basic input validation
    if (!query && searchBy === 'all') {
        // Clear results if query is empty and filter is 'all'
         displayResults([]);
         loadMoreButton.style.display = 'none';
         return; // Don't search for nothing
    }
     // Allow empty query only if a specific filter (not 'all') is selected
     if (!query && searchBy !== 'all') {
         // Proceed to search with empty query for the specific field
     } else if (query.length < 2 && !/^\d+$/.test(query)) {
         // Don't search for single characters unless it's a digit (potential serial)
         // Maybe show a message "Please enter at least 2 characters"?
         // Or allow it and potentially return many results
         // Current logic allows it, let's keep it for now.
     }


    displayLoadingMessage(); // Show loading indicator

    // Ensure data is loaded
    if (allSongs.length === 0) {
        await preloadCSVData();
        // Check again if loading failed
        if (allSongs.length === 0) {
             console.error("Failed to load song data. Cannot perform search.");
             resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה בטעינת נתונים. נסה לרענן את הדף.</td></tr>';
             if (resultsTableThead) resultsTableThead.style.display = "none";
             return;
        }
    }

    // Perform the actual search and display
    performSearch(query, searchBy);

    // Update URL (optional, could be annoying if user is just filtering)
    // Consider updating URL only on form submit, not filter clicks?
    // updateURLWithoutReload(query, searchBy); // Pass params to update URL correctly
}

function performSearch(query, searchBy) {
    let filteredSongs;

    // Apply "Singles Only" filter if active (consider removing if not needed)
    if (showSinglesOnly) {
        filteredSongs = allSongs.filter(song =>
            song.album?.toLowerCase().includes('סינגלים') || song.singer?.toLowerCase().includes('סינגלים')
        );
    } else {
        filteredSongs = allSongs;
    }

    // Apply the main search filter
    results = filterSongs(filteredSongs, query, searchBy);

    // Reset display count and show initial results
    displayedResults = 0;
    const initialResultsToShow = results.slice(0, 250);
    displayedResults = initialResultsToShow.length;

    displayResults(initialResultsToShow, false); // Display new results, overwrite old

    // Show/hide "Load More" button
    toggleLoadMoreButton();
}


// --- Data Loading & Parsing ---
async function preloadCSVData() {
    const currentCSVUrl = baseurl + '/assets/data/songs.csv'; // Ensure this path is correct
    try {
        const currentCSVText = await fetchCSV(currentCSVUrl);
        if (currentCSVText) {
            allSongs = parseCSV(currentCSVText);
            console.log(`CSV data preloaded: ${allSongs.length} songs.`);
        } else {
             console.error('Fetched CSV data is empty.');
             allSongs = [];
        }
    } catch (error) {
        console.error('Error preloading CSV data:', error);
        allSongs = []; // Ensure it's empty on error
        // Optionally, display an error message to the user in the results area
        if(resultsTableBody){
             resultsTableBody.innerHTML = '<tr><td colspan="4">שגיאה בטעינת נתוני שירים. נסה לרענן.</td></tr>';
        }
        if (resultsTableThead) resultsTableThead.style.display = "none";

    }
}

async function fetchCSV(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
         console.error(`Failed to fetch CSV from ${url}:`, error);
         return null; // Return null on fetch error
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
                } else {
                     // console.warn('Skipped line with missing serial and name:', line);
                }
            } else {
                // console.warn('Skipped line with insufficient columns:', line);
            }
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
     // Trigger search only if doSearch is true (allows setting filter from URL without double search)
    if (doSearch) {
       searchSongs(searchInput.value.trim().toLowerCase(), activeFilter);
    }
}

function filterSongs(songsToFilter, query, searchBy) {
    // Handle empty query based on searchBy
    if (!query) {
        if (searchBy === 'all') {
            return []; // No query and 'all' means no results
        } else {
            // Empty query but specific field: return all songs (or apply 'singles only' if needed)
            // The 'singles only' filter is already applied before calling this function
            return songsToFilter;
        }
    }

     // Fuzzy search logic (Dice Coefficient and Levenshtein Distance)
    const calculateDiceCoefficient = (tokens1, tokens2) => {
        if (!tokens1.length || !tokens2.length) return 0;
        const intersection = new Set(tokens1.filter(token => tokens2.includes(token)));
        return (2 * intersection.size) / (tokens1.length + tokens2.length);
    };

    const calculateNormalizedLevenshteinDistance = (str1, str2) => {
         if (!str1) str1 = '';
         if (!str2) str2 = '';
        const len1 = str1.length;
        const len2 = str2.length;
        if (len1 === 0) return len2 > 0 ? 1 : 0; // Distance is 1 if one is empty and other isn't
        if (len2 === 0) return len1 > 0 ? 1 : 0;

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
    const fuzzyThreshold = 0.6; // Adjust as needed (lower = more fuzzy)
    const levenshteinThreshold = 0.4; // Max allowed distance (lower = stricter)

    const filtered = songsToFilter.filter(song => {
        const fieldsToCheck = [];
        if (searchBy === 'all') {
            fieldsToCheck.push(song.serial, song.name, song.album, song.singer);
        } else if (song[searchBy] !== undefined) {
            fieldsToCheck.push(song[searchBy]);
        }

        for (const value of fieldsToCheck) {
             if (typeof value !== 'string') continue; // Skip if field is not a string

            const lowerValue = value.toLowerCase();

            // 1. Exact match (or starts with for serial number)
            if (searchBy === 'serial' && lowerValue.startsWith(query)) return true;
            if (lowerValue.includes(query)) return true;


            // 2. Fuzzy match
            const valueTokens = lowerValue.split(/\s+/).filter(Boolean);
            const diceSim = calculateDiceCoefficient(queryTokens, valueTokens);
            const levDist = calculateNormalizedLevenshteinDistance(query, lowerValue);

            if (diceSim >= fuzzyThreshold || levDist <= levenshteinThreshold) {
                return true;
            }
        }
        return false; // No match found in relevant fields
    });

     // Sort results - Exact matches first? Or by serial?
     // Simple sort by serial for now
     return filtered.sort((a, b) => {
         const serialA = parseInt(a.serial, 10) || 0;
         const serialB = parseInt(b.serial, 10) || 0;
         return serialA - serialB;
     });
}


// --- Display Logic ---
function displayLoadingMessage() {
    if (!resultsTableBody) return;
    resultsTableBody.innerHTML = ''; // Clear previous results/messages

    const loadingRow = document.createElement('tr');
    const loadingCell = document.createElement('td');
    loadingCell.setAttribute('colspan', '4'); // Span all columns
    loadingCell.style.textAlign = 'center'; // Center content

    const loadingContainer = document.createElement('div');
    loadingContainer.classList.add('loading-container'); // Use existing class if styled

    const loadingImage = document.createElement('img');
    // Ensure the path is correct relative to the final URL
    loadingImage.src = baseurl + '/assets/images/loading.gif';
    loadingImage.alt = "טוען...";
    loadingImage.classList.add('loading-image'); // Use existing class if styled

    const loadingTextElem = document.createElement('p');
    loadingTextElem.textContent = 'מחפש...';
    loadingTextElem.classList.add('loading-text'); // Use existing class if styled

    loadingContainer.appendChild(loadingImage);
    loadingContainer.appendChild(loadingTextElem);
    loadingCell.appendChild(loadingContainer);
    loadingRow.appendChild(loadingCell);
    resultsTableBody.appendChild(loadingRow);

    // Hide table header while loading
    if (resultsTableThead) resultsTableThead.style.display = "none";
}

function displayResults(resultsToDisplay, append = false) {
    if (!resultsTableBody) return;

    // Clear previous results only if not appending
    if (!append) {
        resultsTableBody.innerHTML = '';
    }

    // Handle no results
    if (resultsToDisplay.length === 0 && !append) {
        const noResultsRow = document.createElement('tr');
        const noResultsCell = document.createElement('td');
        noResultsCell.setAttribute('colspan', '4');
        noResultsCell.textContent = 'לא נמצאו תוצאות התואמות את החיפוש.';
        noResultsCell.style.textAlign = 'center';
        noResultsRow.appendChild(noResultsCell);
        resultsTableBody.appendChild(noResultsRow);
        if (resultsTableThead) resultsTableThead.style.display = "none"; // Hide header
        return; // Stop processing
    }

    // Show header if we have results
    if (resultsToDisplay.length > 0 && resultsTableThead) {
         resultsTableThead.style.display = ""; // Show header (or "table-header-group")
    }

    // Create rows for results
    const fragment = document.createDocumentFragment(); // Use fragment for performance
    resultsToDisplay.forEach(song => {
        const row = document.createElement('tr');

        // Serial Number Cell (with copy link)
        const serialCell = document.createElement('td');
        const serialLink = document.createElement('a');
        serialLink.textContent = song.serial;
        serialLink.href = '#'; // Prevent page jump
        serialLink.title = 'העתק קישור לשיר זה';
        serialLink.addEventListener('click', (event) => {
            event.preventDefault();    // Prevent default link navigation
            event.stopPropagation(); // <<--- חשוב: מונע מהקליק להגיע לשורה
            const shareLink = `${window.location.origin}${baseurl}/?search=${encodeURIComponent(song.serial)}&searchBy=serial`;
            copyToClipboard(shareLink); // Use function from core.js
            showCopiedMessage(); // Use function from core.js
        });
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
        albumButton.classList.add('album-button'); // Add class for styling
        albumButton.title = `חפש אלבום: ${song.album}`;
        albumButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent row click
            event.preventDefault();
            searchInput.value = song.album; // Update search input
            handleFilterClick('album'); // Activate filter and trigger search
        });
        albumCell.appendChild(albumButton);
        row.appendChild(albumCell);

        // Singer Name Cell (with filter button)
        const singerCell = document.createElement('td');
        const singerButton = document.createElement('button');
        singerButton.textContent = song.singer;
        singerButton.classList.add('singer-button'); // Add class for styling
        singerButton.title = `חפש זמר: ${song.singer}`;
        singerButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent row click
            event.preventDefault();
            searchInput.value = song.singer; // Update search input
            handleFilterClick('singer'); // Activate filter and trigger search
        });
        singerCell.appendChild(singerButton);
        row.appendChild(singerCell);

        // Row Click Listener (for downloading)
        row.addEventListener('click', (event) => {

            // בדוק אם הלחיצה (event.target) או אחד מאבותיו הקרובים הוא קישור או כפתור
            if (event.target.closest('a, button')) {
                // console.log("Clicked inside a link or button, preventing row download trigger.");
                return; // אל תפעיל הורדה אם הלחיצה היתה על אלמנט אינטראקטיבי
            }
            // Only trigger download if not clicking on a link or button within the row
            if (event.target.tagName !== 'A' && event.target.tagName !== 'BUTTON') {
                event.preventDefault();
                // Check if it's a single before attempting download (optional)
                if (showSinglesOnly && !song.album?.toLowerCase().includes('סינגלים') && !song.singer?.toLowerCase().includes('סינגלים')) {
                     showMessage('באתר זה נשלחים סינגלים בלבד, נא נסה שיר אחר!'); // Use function from core.js
                } else {
                    downloadSong(song.serial); // Trigger download
                }
            }
        });

        fragment.appendChild(row); // Add row to fragment
    });

    resultsTableBody.appendChild(fragment); // Append all new rows at once
}


function loadMoreResults() {
    console.log(`Load More: Displayed=${displayedResults}, Total=${results.length}`);
    const startIndex = displayedResults;
    const newLimit = displayedResults + 250; // Load 250 more
    const endIndex = Math.min(newLimit, results.length);

    if (startIndex >= results.length) {
        console.log("No more results to load.");
        loadMoreButton.style.display = 'none'; // Hide button if no more results
        return;
    }

    const newResultsToDisplay = results.slice(startIndex, endIndex);
    console.log(`Loading results from ${startIndex} to ${endIndex} (${newResultsToDisplay.length} new songs)`);

    displayResults(newResultsToDisplay, true); // Append the new results

    displayedResults = endIndex; // Update the count of displayed results

    // Update button visibility again after loading
    toggleLoadMoreButton();
    console.log(`Load More Finished. New displayed=${displayedResults}, Button visible=${loadMoreButton.style.display}`);
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
        showMessage("שגיאה: מספר שיר לא תקין."); // Use core.js function
        return;
    }

    // Check if this specific download is already in progress? (More complex state needed)
    // Simple approach: add to queue regardless

    if (downloadPromises.length === 0) {
        // Reset counters only when starting a new batch of downloads
        downloadedSongsCount = 0;
        totalSongsToDownload = 0;
    }

    totalSongsToDownload++;
    const currentDownloadIndex = totalSongsToDownload; // Track this specific download's place in the queue

    // Show loading message immediately if it's not already visible
    if (loadingMessage && !loadingMessage.classList.contains('show')) {
         loadingMessage.classList.add('show');
         updateProgressDisplay(0, currentDownloadIndex); // Show initial state
    }

    const downloadPromise = new Promise(async (resolve, reject) => {
        try {
            updateProgressDisplay(15, currentDownloadIndex, 'מעבד...'); // Update progress: Processing

            // Use the correct Apps Script URL
            const scriptUrl = 'https://script.google.com/macros/s/AKfycbyzJ9j93gbyOx1N42oJzDgFRDxPg4wsK6zCxEVNDkJb8zPzhgf5OyO6Prj4dWQWdhS-ow/exec';
            const downloadUrl = `${scriptUrl}?songNumber=${encodeURIComponent(songNumber)}`;

            const response = await fetch(downloadUrl);
             if (!response.ok) {
                // Attempt to read error message from response if possible
                let errorMsg = `שגיאת רשת (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignore if response is not JSON */ }
                throw new Error(errorMsg);
             }

            const data = await response.json();

            updateProgressDisplay(40, currentDownloadIndex, 'מעבד...'); // Update progress: Processed response

            if (data.success && data.downloadLink) {
                updateProgressDisplay(60, currentDownloadIndex, 'מוריד...'); // Update progress: Starting download trigger

                // Use a timeout to allow UI update before triggering download
                await new Promise(res => setTimeout(res, 50)); // Short delay

                updateProgressDisplay(80, currentDownloadIndex, 'מוריד...'); // Update progress: Triggering download

                const link = document.createElement('a');
                link.href = data.downloadLink;
                 // Try to construct a filename, fallback if parts missing
                 const filename = data.originalFileName || `${songNumber}.mp3`;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Simulate download time - replace with actual feedback if possible
                await new Promise(res => setTimeout(res, 1500)); // Wait 1.5 seconds

                downloadedSongsCount++; // Increment successful download count *here*
                updateProgressDisplay(100, currentDownloadIndex, 'הושלם!'); // Update progress: Completed

                resolve(); // Resolve the promise for this download

            } else {
                 throw new Error(data.message || 'הורדה נכשלה מסיבה לא ידועה.');
            }
        } catch (error) {
            console.error("Download Error:", error);
            showMessage(`שגיאה בהורדת שיר ${songNumber}: ${error.message}`); // Use core.js function
            reject(error); // Reject the promise
        }
    });

    downloadPromises.push(downloadPromise);

    // Handle completion of this specific promise
    downloadPromise.catch(err => {
        // Error already shown in catch block above
        // Ensure total count reflects failure if needed, though current logic increments on success
    }).finally(() => {
        // Remove this promise from the active list
        downloadPromises = downloadPromises.filter(p => p !== downloadPromise);

        // Check if all downloads in the batch are finished
        if (downloadPromises.length === 0) {
             // Update final message after a short delay
             setTimeout(() => {
                 if (loadingMessage && loadingMessage.classList.contains('show')) {
                     if (progressText) progressText.innerText = `הורדת ${downloadedSongsCount}/${totalSongsToDownload} שירים הושלמה!`;
                     if (progressBar) progressBar.style.width = `100%`;
                     // Hide the loading message after another delay
                     setTimeout(() => {
                         loadingMessage.classList.remove('show');
                         // Reset counters for the next batch
                         downloadedSongsCount = 0;
                         totalSongsToDownload = 0;
                     }, 2000);
                 }
             }, 500);
        } else {
            // Update progress for remaining downloads if needed
             updateProgressDisplay(null, null, `מוריד (${downloadPromises.length} נותרו)`); // Indicate remaining count
        }
    });
}

// Helper to update progress UI consistently
function updateProgressDisplay(percentage, currentIndex, statusText = '') {
    if (loadingMessage && loadingMessage.classList.contains('show')) {
        if (progressText) {
             const progressPrefix = (currentIndex && totalSongsToDownload > 0)
                ? `${downloadedSongsCount + (percentage === 100 ? 0 : 1)}/${totalSongsToDownload}` // Show next index unless completed
                : '';
            progressText.innerText = `${progressPrefix} ${statusText}`.trim();
        }
        if (progressBar && percentage !== null) {
            progressBar.style.width = `${percentage}%`;
        }
         // Calculate overall progress if multiple downloads are active
         else if (progressBar && totalSongsToDownload > 0 && downloadPromises.length === 0) {
             // If called after all promises are done, set to 100
             progressBar.style.width = '100%';
         } else if (progressBar && totalSongsToDownload > 0) {
             // Estimate overall progress based on completed count
             const overallPercentage = Math.round((downloadedSongsCount / totalSongsToDownload) * 100);
             progressBar.style.width = `${overallPercentage}%`;
         }
    }
}

// --- URL Handling ---
function updateURLWithoutReload(query = null, searchBy = null) {
    const url = new URL(window.location.href);
     if (query !== null && query !== '') {
         url.searchParams.set('search', query);
         if (searchBy !== null && searchBy !== 'all') {
             url.searchParams.set('searchBy', searchBy);
         } else {
             url.searchParams.delete('searchBy');
         }
     } else {
         url.searchParams.delete('search');
         url.searchParams.delete('searchBy');
     }
    // Use replaceState to avoid polluting history
    window.history.replaceState({}, document.title, url.toString());
}