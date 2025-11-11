let allSongs = [];
let results = [];
let displayedResults = 0;
let showSinglesOnly = true;
let activeFilter = 'all';
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
const searchResultsTitle = document.getElementById('search-results-title');
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
    }
     hideAutocompleteSuggestions();
}
const debouncedHandleAutocomplete = debounce(handleAutocompleteInput, 250);
document.addEventListener('DOMContentLoaded', () => {
    // This logic now only runs on pages that have the search results components.
    if (!document.getElementById('search-results-area')) {
        return;
    }

    loadAllSongsData().then(({ allSongs, newSongs }) => {
        console.log("Search.js: Song data ready on search page.");
        prepareAutocompleteData(allSongs);
        
        const urlParams = new URLSearchParams(window.location.search);
        const searchValue = urlParams.get('q');
        const searchByParam = urlParams.get('filter') || 'all';

        handleFilterClick(searchByParam, false);
        if (searchInput) {
            searchInput.value = searchValue || '';
        }

        if (searchValue) {
            console.log(`Search.js: Processing search from URL: q=${searchValue}, filter=${searchByParam}`);
            searchSongs(searchValue, searchByParam);
            if (searchResultsTitle) {
                searchResultsTitle.textContent = `תוצאות חיפוש עבור: "${searchValue}"`;
                searchResultsTitle.style.display = 'block';
            }
        } else {
             console.log("Search.js: Search page loaded without a query.");
             displayInitialSearchMessage();
        }

    }).catch(error => {
        console.error("Search.js: Initial data load failed on search page.", error);
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
                const searchForm = document.getElementById('searchForm');
                if(searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
        searchInput.addEventListener('blur', () => {
            setTimeout(hideAutocompleteSuggestions, 150);
        });
    }

    // This listener is now on shared-redirect-handler.js
    // if (searchForm) { ... }

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
            event.preventDefault(); // Prevent blur
            if (suggestionItem.classList.contains('clear-history-button')) {
                clearSearchHistory();
                return;
            }
            if (searchInput) {
                const suggestionText = suggestionItem.dataset.suggestionValue;
                if (suggestionText) {
                    searchInput.value = suggestionText;
                    hideAutocompleteSuggestions();
                    searchInput.focus();
                    const searchForm = document.getElementById('searchForm');
                    if(searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }
        });
    }
});
async function searchSongs(query, searchBy) {
    saveSearchToHistory(query);
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!songsDataLoaded) {
        if (isLoadingSongs) {
            displayLoadingMessage(colspan, "טוען נתונים...");
            await window.songsDataPromise;
        } else {
            console.error("SearchSongs: Cannot search, data failed to load.");
            return;
        }
    }
    displayLoadingMessage(colspan);
    performSearch(query, searchBy);
}
function displayInitialSearchMessage() {
    if (!resultsTableBody) return;
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">השתמשו בתיבת החיפוש למעלה כדי למצוא שירים.</td></tr>`;
    if (resultsTableThead) resultsTableThead.style.display = "none";
}
function displayLoadingMessage(colspan = 4, text = 'מחפש...') {
    if (!resultsTableBody) return;
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
function handleFilterClick(filter, triggeredByUserClick = false) {
    if (!filter) return;
    activeFilter = filter;
    filterButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`);
    if (activeButton) activeButton.classList.add('active');
    
    if (triggeredByUserClick) {
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        if (searchTerm) {
             const searchForm = document.getElementById('searchForm');
             if(searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    }
}
function performSearch(query, searchBy) {
    results = filterSongs(allSongs, query, searchBy);
    displayedResults = 0;
    const initialResultsToShow = results.slice(0, 250);
    displayedResults = initialResultsToShow.length;
    displayResults(initialResultsToShow, false);
}
function filterSongs(songsToFilter, query, searchBy) {
    if (!query) {
        return [];
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
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!append) {
        if (resultsTable) {
            resultsTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
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