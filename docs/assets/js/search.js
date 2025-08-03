let allSongs = [];
let results = [];
let displayedResults = 0;
let showSinglesOnly = true;
let activeFilter = 'all';
const downloadQueue = [];
let isProcessingQueue = false;
const INTER_DOWNLOAD_DELAY_MS = 300;
const BUTTON_RESTORE_DELAY_MS = 3000;
const IFRAME_REMOVE_DELAY_MS = 5000;
let isLoadingSongs = false;
let songsDataLoaded = false;
let userIsTyping = false;
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-button');
const loadMoreButton = document.getElementById('loadMoreButton');
const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
const loadingMessage = document.getElementById('loadingMessage');
const progressText = document.getElementById('progressText');
const resultsTableThead = document.querySelector("#resultsTable thead");
const resultsTable = document.getElementById('resultsTable');
const homepageContent = document.getElementById('homepage-content');
const searchResultsArea = document.getElementById('search-results-area');
let uniqueArtistNames = [];
let uniqueSongTitles = [];
let uniqueAlbumNames = [];
const suggestionsContainer = document.getElementById('autocomplete-suggestions');
const MIN_QUERY_LENGTH_FOR_AUTOCOMPLETE = 2;
const MAX_AUTOCOMPLETE_SUGGESTIONS = 7;
const SEARCH_HISTORY_KEY = 'shirBotSearchHistory';
const MAX_HISTORY_ITEMS = 5;
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
function getSearchHistory() {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error("Failed to get search history:", e);
        return [];
    }
}
function saveSearchToHistory(query) {
    if (!query) return;
    let history = getSearchHistory();
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    if (history.length > MAX_HISTORY_ITEMS) {
        history.length = MAX_HISTORY_ITEMS;
    }
    try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.error("Failed to save search history:", e);
    }
}
function clearSearchHistory() {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        hideAutocompleteSuggestions();
        console.log("Search history cleared.");
    } catch (e) {
        console.error("Failed to clear search history:", e);
    }
}
function prepareAutocompleteData(songs) {
    const artistSet = new Set();
    const songSet = new Set();
    const albumSet = new Set();
    songs.forEach(song => {
        if (song.singer) artistSet.add(song.singer.trim());
        if (song.name) songSet.add(song.name.trim());
        if (song.album) albumSet.add(song.album.trim());
    });
    uniqueArtistNames = Array.from(artistSet).sort((a, b) => a.localeCompare(b, 'he'));
    uniqueSongTitles = Array.from(songSet).sort((a, b) => a.localeCompare(b, 'he'));
    uniqueAlbumNames = Array.from(albumSet).sort((a, b) => a.localeCompare(b, 'he'));
    console.log(`Autocomplete data prepared: ${uniqueArtistNames.length} artists, ${uniqueSongTitles.length} songs, ${uniqueAlbumNames.length} albums.`);
}
function loadAllSongsData() {
    if (songsDataLoaded || isLoadingSongs) {
        if (songsDataLoaded) return Promise.resolve({ allSongs, newSongs: window.cachedNewSongs || [] });
        return window.songsDataPromise;
    }
    isLoadingSongs = true;
    console.log("Search.js: Starting to load both song data files...");
    const allSongsUrl = `${baseurl || ''}/assets/data/all_songs.json`;
    const newSongsUrl = `${baseurl || ''}/assets/data/new_songs.json`;
    window.songsDataPromise = Promise.all([
        fetch(allSongsUrl).then(response => {
            if (!response.ok) throw new Error(`Failed to load all_songs.json: ${response.status}`);
            return response.json();
        }).catch(error => {
            console.error("Error loading all_songs.json:", error);
            return [];
        }),
        fetch(newSongsUrl).then(response => {
            if (!response.ok) throw new Error(`Failed to load new_songs.json: ${response.status}`);
            return response.json();
        }).catch(error => {
            console.error("Error loading new_songs.json:", error);
            return [];
        })
    ])
    .then(([allSongsData, newSongsData]) => {
        console.log(`Search.js: Loaded ${allSongsData.length} from all_songs.json`);
        console.log(`Search.js: Loaded ${newSongsData.length} from new_songs.json`);
        const validAllSongs = Array.isArray(allSongsData) ? allSongsData : [];
        const validNewSongs = Array.isArray(newSongsData) ? newSongsData : [];
        window.cachedNewSongs = validNewSongs;
        const songsMap = new Map();
        validNewSongs.forEach(song => {
            if (song && song.serial) {
                if (!song.driveId) {
                    const matchingOldSong = validAllSongs.find(oldSong => oldSong.serial === song.serial);
                    if (matchingOldSong && matchingOldSong.driveId) {
                        song.driveId = matchingOldSong.driveId;
                    }
                }
                songsMap.set(song.serial, song);
            }
        });
        validAllSongs.forEach(song => {
            if (song && song.serial && !songsMap.has(song.serial)) {
                if (!song.driveId) {
                }
                songsMap.set(song.serial, song);
            }
        });
        allSongs = Array.from(songsMap.values());
        if (allSongs.length === 0 && (validAllSongs.length > 0 || validNewSongs.length > 0)) {
            console.warn("Search.js: Merged song list is empty, but source arrays were not. Check data structure/serials.");
        } else if (allSongs.length === 0) {
            console.warn("Search.js: Both source song files seem empty or failed to load/parse.");
        }
        songsDataLoaded = true;
        isLoadingSongs = false;
        console.log(`Search.js: Successfully merged data. Total unique songs: ${allSongs.length}.`);
        document.dispatchEvent(new CustomEvent('songsDataReady', {
            detail: {
                allSongs: allSongs,
                newSongs: validNewSongs
            }
        }));
        return { allSongs, newSongs: validNewSongs };
    })
    .catch(error => {
        isLoadingSongs = false;
        songsDataLoaded = false;
        console.error('Search.js: Critical error during Promise.all for song data:', error);
        displayDataLoadError();
        document.dispatchEvent(new CustomEvent('songsDataError', {
            detail: error
        }));
        throw error;
    });
    return window.songsDataPromise;
}
function displayDataLoadError() {
    if (resultsTableBody) {
        const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
        resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: red;">שגיאה בטעינת מאגר השירים. נסה לרענן את הדף.</td></tr>`;
        if (resultsTableThead) resultsTableThead.style.display = "none";
        if (loadMoreButton) loadMoreButton.style.display = 'none';
        const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
        if (isHomepage) {
            showSearchResultsViewInternal();
        }
    }
     hideAutocompleteSuggestions();
}
const debouncedHandleAutocomplete = debounce(handleAutocompleteInput, 250);
document.addEventListener('DOMContentLoaded', () => {
    loadAllSongsData().then(({ allSongs, newSongs }) => {
        console.log("Search.js: Song data loaded successfully after DOMContentLoaded.");
        prepareAutocompleteData(allSongs);
        const urlParams = new URLSearchParams(window.location.search);
        const searchValue = urlParams.get('search');
        const searchByParam = urlParams.get('searchBy') || 'all';
        const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
        if (searchValue && searchByParam === 'serial') {
            console.log(`Search.js: Processing URL serial search: search=${searchValue}`);
            if (searchInput) searchInput.value = decodeURIComponent(searchValue);
            handleFilterClick('all', false);
            searchSongs(searchValue.toLowerCase(), 'serial');
            if (isHomepage) {
                setTimeout(clearUrlParams, 150);
            }
        } else {
             handleFilterClick(searchByParam, false);
             if (searchValue) {
                console.log(`Search.js: Processing URL general search: search=${searchValue}, searchBy=${searchByParam}`);
                if (searchInput) searchInput.value = decodeURIComponent(searchValue);
                searchSongs(searchValue.toLowerCase(), searchByParam);
                if (isHomepage) {
                    setTimeout(clearUrlParams, 150);
                }
            } else {
                if (isHomepage) {
                    console.log("Search.js: Homepage loaded without search params. Displaying homepage content.");
                } else {
                    console.log("Search.js: Non-homepage loaded without search params.");
                }
            }
        }
    }).catch(error => {
        console.error("Search.js: Initial data load failed in DOMContentLoaded.", error);
    });
    if (searchInput) {
        searchInput.addEventListener('click', () => {
            if (searchInput.value.trim().length === 0) {
                renderHistorySuggestions();
            }
        });
        
        searchInput.addEventListener('input', () => {
             userIsTyping = true;
             const query = searchInput.value.trim();
             if (query.length === 0) {
                 renderHistorySuggestions();
             } else {
                debouncedHandleAutocomplete(query);
             }
        });
        searchInput.addEventListener("keypress", function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                hideAutocompleteSuggestions();
                submitForm();
            }
        });
        searchInput.addEventListener('blur', () => {
            setTimeout(hideAutocompleteSuggestions, 150);
        });
    }
    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault();
            hideAutocompleteSuggestions();
            submitForm();
        });
    }
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            handleFilterClick(this.dataset.filter, true);
        });
    });
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreResults);
    }
     if (suggestionsContainer) {
        suggestionsContainer.addEventListener('mousedown', (event) => {
            const suggestionItem = event.target.closest('.autocomplete-suggestion-item');
            if (!suggestionItem) return;
            if (suggestionItem.classList.contains('clear-history-button')) {
                event.preventDefault();
                clearSearchHistory();
                return;
            }
            if (searchInput) {
                const suggestionText = suggestionItem.dataset.suggestionValue;
                if (suggestionText) {
                    console.log('Suggestion selected:', suggestionText);
                    searchInput.value = suggestionText;
                    hideAutocompleteSuggestions();
                    searchInput.focus();
                    submitForm();
                }
            }
        });
    }
});
async function submitForm() {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const searchTermLower = searchTerm.toLowerCase();
    const currentActiveFilter = activeFilter;
    saveSearchToHistory(searchTerm);
    if (!isHomepage) {
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(currentActiveFilter)}`;
        window.location.href = redirectUrl;
    } else {
        if (!songsDataLoaded) {
            if (isLoadingSongs) {
                console.log("SubmitForm: Data is still loading, waiting...");
                if (loadingMessage && progressText) {
                    loadingMessage.style.display = 'flex';
                    progressText.textContent = 'טוען נתונים, מחפש בקרוב...';
                }
                try {
                    await window.songsDataPromise;
                    console.log("SubmitForm: Data finished loading, proceeding.");
                    if (loadingMessage && progressText && progressText.textContent.includes('טוען נתונים')) {
                        loadingMessage.style.display = 'none';
                    }
                    searchSongs(searchTermLower, currentActiveFilter);
                    setTimeout(clearUrlParams, 100);
                } catch (error) {
                    console.error("SubmitForm: Error waiting for data.", error);
                }
            } else {
                console.error("SubmitForm: Cannot search, data failed.");
                if (typeof showMessage === 'function') showMessage('טעינת נתוני השירים נכשלה.');
            }
        } else {
            searchSongs(searchTermLower, currentActiveFilter);
            setTimeout(clearUrlParams, 100);
        }
    }
}
async function searchSongs(query, searchBy) {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    if (isHomepage) {
        showSearchResultsViewInternal();
    }
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!songsDataLoaded) {
        if (isLoadingSongs) {
            console.log("SearchSongs: Waiting for data...");
            displayLoadingMessage(colspan, "טוען נתונים...");
            try {
                await window.songsDataPromise;
                console.log("SearchSongs: Data loaded, proceeding.");
            } catch (error) {
                console.error("SearchSongs: Error awaiting data.", error);
                return;
            }
        } else {
            console.error("SearchSongs: Cannot search, data failed.");
            return;
        }
    }
    displayLoadingMessage(colspan);
    performSearch(query, searchBy);
}
function displayLoadingMessage(colspan = 4, text = 'מחפש...') {
    if (!resultsTableBody) return;
    showSearchResultsViewInternal();
    resultsTableBody.innerHTML = '';
    const lr = document.createElement('tr'), lc = document.createElement('td');
    lc.setAttribute('colspan', colspan);
    lc.style.textAlign = 'center';
    const lcont = document.createElement('div');
    lcont.className = 'loading-container';
    const limg = document.createElement('img');
    limg.src = (baseurl || '') + '/assets/images/loading.gif';
    limg.alt = "טוען...";
    limg.className = 'loading-image';
    const ltxt = document.createElement('p');
    ltxt.textContent = text;
    ltxt.className = 'loading-text';
    lcont.appendChild(limg);
    lcont.appendChild(ltxt);
    lc.appendChild(lcont);
    lr.appendChild(lc);
    resultsTableBody.appendChild(lr);
    if (resultsTableThead) resultsTableThead.style.display = "none";
    if (loadMoreButton) loadMoreButton.style.display = 'none';
}
function updateDownloadLoadingMessage() {
    if (!loadingMessage || !progressText) return;
    const buttonsInProgress = document.querySelectorAll('button.download-button.download-in-progress, button.download-button-new.download-in-progress').length;
    const itemsInQueue = downloadQueue.length;
    if (buttonsInProgress > 0 || itemsInQueue > 0) {
        let msg = "";
        if (buttonsInProgress > 0) msg += `מוריד ${buttonsInProgress}... `;
        if (itemsInQueue > 0) msg += `(${itemsInQueue} בתור)`;
        progressText.innerText = msg.trim();
        if (!loadingMessage.classList.contains('show')) {
            loadingMessage.style.display = 'flex';
            loadingMessage.classList.add('show');
        }
        const pbCont = loadingMessage.querySelector('.progress-bar');
        if (pbCont) pbCont.style.display = 'none';
    } else {
        if (loadingMessage.classList.contains('show')) {
            setTimeout(() => {
                if (document.querySelectorAll('button.download-button.download-in-progress, button.download-button-new.download-in-progress').length === 0 && downloadQueue.length === 0) {
                    loadingMessage.style.display = 'none';
                    loadingMessage.classList.remove('show');
                }
            }, 1500);
        }
    }
}
function restoreDownloadButton(songSerial) {
    const btn = document.querySelector(`button.download-button[data-song-serial="${songSerial}"], button.download-button-new[data-song-serial="${songSerial}"]`);
    if (btn && btn.classList.contains('download-in-progress')) {
        const icon = btn.dataset.originalIcon || '<i class="fas fa-download"></i>';
        btn.innerHTML = icon;
        btn.disabled = false;
        btn.classList.remove('download-in-progress');
        delete btn.dataset.originalIcon;
        console.log(`DL Restore: ${songSerial}`);
        updateDownloadLoadingMessage();
    }
}
function processDownloadQueue() {
    if (downloadQueue.length === 0) {
        isProcessingQueue = false;
        console.log("DL Queue empty.");
        updateDownloadLoadingMessage();
        return;
    }
    isProcessingQueue = true;
    const item = downloadQueue.shift();
    console.log(`DL Proc: ${item.songSerial}. Q: ${downloadQueue.length}`);
    updateDownloadLoadingMessage();
    try {
        const ifr = document.createElement('iframe');
        ifr.style.display = 'none';
        ifr.src = `https://drive.google.com/uc?export=download&id=${item.driveId}`;
        document.body.appendChild(ifr);
        console.log(`DL iframe: ${item.driveId}`);
        setTimeout(() => {
            restoreDownloadButton(item.songSerial);
        }, BUTTON_RESTORE_DELAY_MS);
        setTimeout(() => {
            try {
                ifr.remove();
                console.log(`DL iframe removed: ${item.driveId}`);
            } catch (remErr) {
                console.warn(`iframe remove err: ${remErr}`);
            }
        }, IFRAME_REMOVE_DELAY_MS);
        setTimeout(processDownloadQueue, INTER_DOWNLOAD_DELAY_MS);
    } catch (err) {
        console.error(`iframe err ${item.songSerial}:`, err);
        restoreDownloadButton(item.songSerial);
        if (typeof showMessage === 'function') showMessage(`שגיאה בהורדה ${item.songSerial}.`);
        setTimeout(processDownloadQueue, 50);
    }
}
window.downloadSongWithDriveId = function(buttonElement) {
    if (!buttonElement) {
        console.error("DL Handler: Invalid button.");
        return;
    }
    const songSerial = buttonElement.dataset.songSerial;
    const driveId = buttonElement.dataset.driveId;
    if (!songSerial || !driveId) {
        console.error(`DL Handler: Missing data. Serial: ${songSerial}, DriveID: ${driveId}`);
        if (typeof showMessage === 'function') showMessage('שגיאה: חסר מידע להורדה.');
        if (buttonElement.classList.contains('download-in-progress')) {
            restoreDownloadButton(songSerial || 'unknown');
        }
        return;
    }
    if (buttonElement.disabled || buttonElement.classList.contains('download-in-progress')) {
        console.warn(`DL Handler: Already in progress: ${songSerial}`);
        return;
    }
    if (downloadQueue.some(item => item.songSerial === songSerial)) {
        console.warn(`DL Handler: Already in queue: ${songSerial}`);
        if (typeof showMessage === 'function') showMessage(`${songSerial} כבר בתור להורדה.`);
        return;
    }
    buttonElement.disabled = true;
    buttonElement.classList.add('download-in-progress');
    buttonElement.dataset.originalIcon = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    downloadQueue.push({
        songSerial: songSerial,
        driveId: driveId
    });
    console.log(`DL Handler: Added ${songSerial}. Queue: ${downloadQueue.length}`);
    updateDownloadLoadingMessage();
    if (!isProcessingQueue) {
        console.log("DL Handler: Starting queue.");
        processDownloadQueue();
    }
}
function clearUrlParams() {
    try {
        const cleanUrl = window.location.origin + (baseurl || '') + '/';
        if (window.location.href !== cleanUrl) {
            window.history.replaceState({}, document.title, cleanUrl);
            console.log("URL params cleared.");
        }
    } catch (e) {
        console.error("Error clearing URL params:", e);
    }
}
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
function handleFilterClick(filter, triggeredByUserClick = false) {
    if (!filter) return;
    const previousFilter = activeFilter;
    activeFilter = filter;
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`);
    if (activeButton) activeButton.classList.add('active');
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    if (triggeredByUserClick) {
         console.log(`handleFilterClick: Filter changed to '${filter}' by user click.`);
         if(isHomepage){
            searchSongs(searchTerm, filter);
         } else {
             if (searchInput) searchInput.focus();
         }
    } else {
        console.log(`handleFilterClick: Filter set to '${filter}' programmatically.`);
    }
}
function performSearch(query, searchBy) {
    let baseSongsToFilter = allSongs;
    results = filterSongs(baseSongsToFilter, query, searchBy);
    displayedResults = 0;
    const initialResultsToShow = results.slice(0, 250);
    displayedResults = initialResultsToShow.length;
    displayResults(initialResultsToShow, false);
}
function filterSongs(songsToFilter, query, searchBy) {
    if (!query) {
        if (searchBy === 'all') {
            console.log("Filtering: Empty query, 'all' filter -> returning all valid songs.");
            return songsToFilter.filter(song => song && song.serial && song.name);
        }
        const keyMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' };
        const key = keyMap[searchBy];
        if (!key) return [];
        console.log(`Filtering: Empty query, specific filter '${searchBy}' -> returning songs with non-empty '${key}'.`);
        return songsToFilter.filter(song => {
            const value = song[key];
            return value != null && String(value).trim() !== '';
        });
    }
    const calcDice = (t1, t2) => {
        if (!t1?.length || !t2?.length) return 0;
        const i = new Set(t1.filter(t => t2.includes(t)));
        return (2 * i.size) / (t1.length + t2.length);
    };
    const calcLev = (s1 = '', s2 = '') => {
        const l1 = s1.length, l2 = s2.length;
        if (l1 == 0) return l2 > 0 ? 1 : 0;
        if (l2 == 0) return l1 > 0 ? 1 : 0;
        if (Math.abs(l1 - l2) > Math.max(l1, l2) * 0.6) return 1;
        const m = Array.from({ length: l1 + 1 }, (_, i) => [i]);
        for (let j = 1; j <= l2; j++) m[0][j] = j;
        for (let i = 1; i <= l1; i++)
            for (let j = 1; j <= l2; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1));
        const maxL = Math.max(l1, l2);
        return maxL === 0 ? 0 : m[l1][l2] / maxL;
    };
    const qL = query.toLowerCase(), qT = qL.split(/\s+/).filter(Boolean), fT = 0.55, lT = 0.45;
    const fMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' };
    const scored = songsToFilter.map(s => {
        s._score = 0;
        let best = 0;
        const keys = searchBy === 'all' ? ['serial', 'name', 'album', 'singer'] : (fMap[searchBy] ? [fMap[searchBy]] : []);
        for (const k of keys) {
            const v = s[k], sv = v == null ? '' : String(v);
            if (!sv) continue;
            const lv = sv.toLowerCase();
            let current = 0;
            const exact = (k === 'serial' && lv.startsWith(qL)) || (k !== 'serial' && lv.includes(qL)) || (searchBy === 'all' && lv.includes(qL));
            if (exact) current = 1.0;
            else {
                const vT = lv.split(/\s+/).filter(Boolean), dice = calcDice(qT, vT);
                if (dice >= fT) current = Math.max(current, dice);
                if (current < fT && Math.abs(qL.length - lv.length) <= Math.max(qL.length, lv.length) * 0.5) {
                    const lev = calcLev(qL, lv);
                    if (lev <= lT) current = Math.max(current, (1 - lev));
                }
            }
            best = Math.max(best, current);
        }
        s._score = best;
        return s;
    }).filter(s => s._score > 0);
    if (searchBy === 'serial') {
        const tS = parseInt(qL, 10);
        if (!isNaN(tS)) return scored.sort((a, b) => {
            const sA = parseInt(a.serial, 10) || 0, sB = parseInt(b.serial, 10) || 0;
            const isA = sA === tS, isB = sB === tS;
            if (isA && !isB) return -1;
            if (!isA && isB) return 1;
            if (isA && isB) return 0;
            if (a._score !== b._score) return b._score - a._score;
            const dA = Math.abs(sA - tS), dB = Math.abs(sB - tS);
            return dA !== dB ? dA - dB : sA - sB;
        });
    }
    return scored.sort((a, b) => {
        if (a._score !== b._score) return b._score - a._score;
        const sA = parseInt(a.serial, 10) || 0, sB = parseInt(b.serial, 10) || 0;
        return sA - sB;
    });
}
function displayResults(resultsToDisplay, append = false) {
    if (!resultsTableBody) return;
    showSearchResultsViewInternal();
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!append) {
        resultsTableBody.innerHTML = '';
    }
    if (resultsToDisplay.length === 0 && !append) {
        const nr = document.createElement('tr'), nc = document.createElement('td');
        nc.setAttribute('colspan', colspan);
        nc.textContent = 'לא נמצאו תוצאות.';
        nc.style.textAlign = 'center';
        nr.appendChild(nc);
        resultsTableBody.appendChild(nr);
        if (resultsTableThead) resultsTableThead.style.display = "none";
        toggleLoadMoreButton();
        return;
    }
    if (resultsToDisplay.length > 0 && resultsTableThead && (resultsTableThead.style.display === "none" || !resultsTableThead.style.display)) {
        resultsTableThead.style.display = "";
    }
    const frag = document.createDocumentFragment();
    const adsEnabled = typeof inlineAdsConfig !== 'undefined' && inlineAdsConfig.enabled;
    const adFrequency = adsEnabled ? inlineAdsConfig.frequency : 0;
    const adsList = adsEnabled ? inlineAdsConfig.ads_list : [];
    const adsListSize = adsList.length;
    resultsToDisplay.forEach((s, index) => {
        const overallIndex = (append ? displayedResults : 0) + index;
        if (adsEnabled && adsListSize > 0 && overallIndex > 0 && (overallIndex + 1) % adFrequency === 0) {
            const adIndex = Math.floor(overallIndex / adFrequency) % adsListSize;
            const ad = adsList[adIndex];
            const adRow = document.createElement('tr');
            adRow.className = 'inline-ad-row';
            const adCell = document.createElement('td');
            adCell.className = 'inline-ad-cell';
            adCell.colSpan = colspan;
            if (ad.type === 'image') {
                adCell.innerHTML = `
                    <a href="${ad.link_url}" target="_blank" rel="noopener sponsored" class="inline-ad-link inline-ad-link--image" data-ad-location="inline" data-ad-type="${ad.type}" data-ad-id="${ad.tracking_id}">
                      <img src="${baseurl || ''}${ad.image_url}" alt="${ad.alt_text}" class="inline-ad-image">
                    </a>`;
            } else if (ad.type === 'email') {
                adCell.innerHTML = `
                    <a href="#" class="inline-ad-link dynamic-mailto-ad"
                       data-email="${ad.email}"
                       data-subject="${ad.subject}"
                       data-body="${ad.body}" data-ad-location="inline" data-ad-type="${ad.type}" data-ad-id="${ad.tracking_id}">
                        ${ad.icon_class ? `<div class="inline-ad-icon"><i class="${ad.icon_class}"></i></div>` : ''}
                        <div class="inline-ad-content">
                             <div class="ad-title">${ad.title}</div>
                             <p class="ad-text">${ad.text}</p>
                        </div>
                        ${ad.cta_text ? `<div class="inline-ad-cta">${ad.cta_text}</div>` : ''}
                    </a>`;
            } else {
                let adHTML = `
                    <a href="${ad.link_url}" target="_blank" rel="noopener sponsored" class="inline-ad-link" data-ad-location="inline" data-ad-type="${ad.type}" data-ad-id="${ad.tracking_id}">`;
                if (ad.icon_class) {
                    adHTML += `<div class="inline-ad-icon"><i class="${ad.icon_class}"></i></div>`;
                }
                adHTML += `<div class="inline-ad-content">
                             <div class="ad-title">${ad.title}</div>
                             <p class="ad-text">${ad.text}</p>
                           </div>`;
                if (ad.cta_text) {
                    adHTML += `<div class="inline-ad-cta">${ad.cta_text}</div>`;
                }
                adHTML += `</a>`;
                adCell.innerHTML = adHTML;
            }
            adRow.appendChild(adCell);
            frag.appendChild(adRow);
        }
        const r = document.createElement('tr');
        r.dataset.songSerial = s.serial;
        r.dataset.driveId = s.driveId;
        const nC = document.createElement('td');
        nC.textContent = s.name;
        r.appendChild(nC);
        const alC = document.createElement('td');
        const alB = document.createElement('button');
        alB.textContent = s.album;
        alB.className = 'album-button';
        alB.dataset.albumName = s.album;
        alB.title = `חפש אלבום: ${s.album}`;
        alC.appendChild(alB);
        r.appendChild(alC);
        const siC = document.createElement('td');
        const siB = document.createElement('button');
        siB.textContent = s.singer;
        siB.className = 'singer-button';
        siB.dataset.singerName = s.singer;
        siB.title = `חפש זמר: ${s.singer}`;
        siC.appendChild(siB);
        r.appendChild(siC);
        const acC = document.createElement('td');
        acC.className = 'actions-cell';
        const grp = document.createElement('div');
        grp.className = 'actions-button-group';
        const dlB = document.createElement('button');
        dlB.className = 'download-button';
        dlB.dataset.songSerial = s.serial;
        dlB.dataset.driveId = s.driveId;
        dlB.title = 'הורדה';
        dlB.innerHTML = '<i class="fas fa-download"></i>';
        const shB = document.createElement('button');
        shB.className = 'share-button';
        shB.dataset.songSerial = s.serial;
        shB.title = 'שיתוף';
        shB.innerHTML = '<i class="fas fa-share-alt"></i>';
        grp.appendChild(dlB);
        grp.appendChild(shB);
        acC.appendChild(grp);
        r.appendChild(acC);
        frag.appendChild(r);
    });
    resultsTableBody.appendChild(frag);
    if (typeof window.initializeDynamicMailtoLinks === 'function') {
        window.initializeDynamicMailtoLinks(resultsTableBody);
    }
    toggleLoadMoreButton();
}
function loadMoreResults() {
    console.log(`Load More: Disp=${displayedResults}, Total=${results.length}`);
    const start = displayedResults, limit = displayedResults + 250, end = Math.min(limit, results.length);
    if (start >= results.length) {
        console.log("No more.");
        if (loadMoreButton) loadMoreButton.style.display = 'none';
        return;
    }
    const newRes = results.slice(start, end);
    console.log(`Loading ${start}-${end} (${newRes.length})`);
    displayResults(newRes, true);
    displayedResults = end;
}
function toggleLoadMoreButton() {
    if (loadMoreButton) {
        loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
    }
}
function handleAutocompleteInput(query) {
    if (!userIsTyping) {
        hideAutocompleteSuggestions();
        return;
    }
    userIsTyping = false;
    if (!suggestionsContainer || !songsDataLoaded) return;
    query = query.trim();
    if (query.length < MIN_QUERY_LENGTH_FOR_AUTOCOMPLETE) {
        hideAutocompleteSuggestions();
        return;
    }
    const lowerQuery = query.toLowerCase();
    let suggestions = [];
    let suggestionPool = [];
    let poolType = '';
    switch(activeFilter) {
        case 'singer':
            suggestionPool = uniqueArtistNames;
            poolType = 'artist';
            break;
        case 'name':
            suggestionPool = uniqueSongTitles;
            poolType = 'song';
            break;
        case 'album':
            suggestionPool = uniqueAlbumNames;
            poolType = 'album';
            break;
        case 'all':
        case 'serial':
        default:
            suggestions = suggestions.concat(
                uniqueArtistNames
                    .filter(name => name.toLowerCase().startsWith(lowerQuery))
                    .map(name => ({ type: 'artist', value: name }))
            );
            if (suggestions.length < MAX_AUTOCOMPLETE_SUGGESTIONS) {
                suggestions = suggestions.concat(
                    uniqueSongTitles
                        .filter(name => name.toLowerCase().startsWith(lowerQuery) && !suggestions.some(s => s.value === name))
                        .map(name => ({ type: 'song', value: name }))
                );
            }
             if (suggestions.length < MAX_AUTOCOMPLETE_SUGGESTIONS) {
                suggestions = suggestions.concat(
                    uniqueAlbumNames
                        .filter(name => name.toLowerCase().startsWith(lowerQuery) && !suggestions.some(s => s.value === name))
                        .map(name => ({ type: 'album', value: name }))
                );
            }
            break;
    }
    if (suggestionPool.length > 0) {
        suggestions = suggestions.concat(
            suggestionPool
                .filter(name => name.toLowerCase().startsWith(lowerQuery))
                .map(name => ({ type: poolType, value: name }))
        );
        if (suggestions.length < MAX_AUTOCOMPLETE_SUGGESTIONS) {
             suggestions = suggestions.concat(
                suggestionPool
                    .filter(name => name.toLowerCase().includes(lowerQuery) && !suggestions.some(s => s.value === name))
                    .map(name => ({ type: poolType, value: name }))
            );
        }
    }
    const uniqueSuggestions = Array.from(new Map(suggestions.map(item => [item.value, item])).values());
    const limitedSuggestions = uniqueSuggestions.slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS);
    renderAutocompleteSuggestions(limitedSuggestions, lowerQuery);
}
function renderAutocompleteSuggestions(suggestions, lowerQuery) {
    if (!suggestionsContainer || !searchForm) return;
    if (suggestions.length === 0) {
        hideAutocompleteSuggestions();
        return;
    }
    suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.classList.add('autocomplete-suggestion-item');
        item.setAttribute('role', 'option');
        item.dataset.suggestionValue = suggestion.value;
        const index = suggestion.value.toLowerCase().indexOf(lowerQuery);
        let highlightedText = suggestion.value;
        if (index !== -1) {
            const before = suggestion.value.substring(0, index);
            const match = suggestion.value.substring(index, index + lowerQuery.length);
            const after = suggestion.value.substring(index + lowerQuery.length);
            highlightedText = `${before}<strong>${match}</strong>${after}`;
        }
        item.innerHTML = highlightedText;
        fragment.appendChild(item);
    });
    suggestionsContainer.appendChild(fragment);
    suggestionsContainer.style.display = 'block';
    searchForm.classList.add('search-bar--suggestions-open');
}
function renderHistorySuggestions() {
    if (!suggestionsContainer || !searchForm) return;
    const history = getSearchHistory();
    if (history.length === 0) {
        hideAutocompleteSuggestions();
        return;
    }
    suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    history.forEach(query => {
        const item = document.createElement('div');
        item.classList.add('autocomplete-suggestion-item', 'history-item');
        item.setAttribute('role', 'option');
        item.dataset.suggestionValue = query;
        const sanitizedQuery = query.replace(/</g, "<").replace(/>/g, ">");
        item.innerHTML = `<i class="fas fa-history"></i><span>${sanitizedQuery}</span>`;
        fragment.appendChild(item);
    });
    const clearButton = document.createElement('div');
    clearButton.classList.add('autocomplete-suggestion-item', 'clear-history-button');
    clearButton.setAttribute('role', 'button');
    clearButton.textContent = 'מחק היסטוריה';
    fragment.appendChild(clearButton);
    suggestionsContainer.appendChild(fragment);
    suggestionsContainer.style.display = 'block';
    searchForm.classList.add('search-bar--suggestions-open');
}
function hideAutocompleteSuggestions() {
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.innerHTML = '';
    }
    if (searchForm) {
         searchForm.classList.remove('search-bar--suggestions-open');
    }
}