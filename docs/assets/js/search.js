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
const suggestionsContainer = document.getElementById('autocomplete-suggestions');
const MIN_QUERY_LENGTH_FOR_AUTOCOMPLETE = 2;
const MAX_AUTOCOMPLETE_SUGGESTIONS = 7;
const SEARCH_HISTORY_KEY = 'shirBotSearchHistory';
const MAX_HISTORY_ITEMS = 5;
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
function showHomepageView() {
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');
    const searchResultsTitle = document.getElementById('search-results-title');
    if (homepageContent) homepageContent.style.display = 'block';
    if (searchResultsArea) searchResultsArea.style.display = 'none';
    if (searchResultsTitle) searchResultsTitle.style.display = 'none';
}
function showSearchResultsView() {
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');
    if (homepageContent) homepageContent.style.display = 'none';
    if (searchResultsArea) searchResultsArea.style.display = 'block';
}
function getSearchHistory() {
    try {
        const history = localStorage.getItem(SEARCH_HISTORY_KEY);
        return history ? JSON.parse(history) : [];
    } catch (e) { console.error("Failed to get search history:", e); return []; }
}
function saveSearchToHistory(query) {
    if (!query) return;
    let history = getSearchHistory();
    history = history.filter(item => item.toLowerCase() !== query.toLowerCase());
    history.unshift(query);
    if (history.length > MAX_HISTORY_ITEMS) { history.length = MAX_HISTORY_ITEMS; }
    try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history)); }
    catch (e) { console.error("Failed to save search history:", e); }
}
function clearSearchHistory() {
    try {
        localStorage.removeItem(SEARCH_HISTORY_KEY);
        hideAutocompleteSuggestions();
        console.log("Search history cleared.");
    } catch (e) { console.error("Failed to clear search history:", e); }
}
function prepareAutocompleteData(songs) {
    const artistSet = new Set(), songSet = new Set(), albumSet = new Set();
    songs.forEach(song => {
        if (song.singer) artistSet.add(song.singer.trim());
        if (song.name) songSet.add(song.name.trim());
        if (song.album) albumSet.add(song.album.trim());
    });
    uniqueArtistNames = Array.from(artistSet).sort((a, b) => a.localeCompare(b, 'he'));
    uniqueSongTitles = Array.from(songSet).sort((a, b) => a.localeCompare(b, 'he'));
    uniqueAlbumNames = Array.from(albumSet).sort((a, b) => a.localeCompare(b, 'he'));
}
function loadAllSongsData() {
    if (songsDataLoaded || isLoadingSongs) {
        return songsDataLoaded ? Promise.resolve(allSongs) : window.songsDataPromise;
    }
    isLoadingSongs = true;
    const allSongsUrl = `${baseurl || ''}/assets/data/all_songs.json`;
    const newSongsUrl = `${baseurl || ''}/assets/data/new_songs.json`;
    window.songsDataPromise = Promise.all([
        fetch(allSongsUrl).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(newSongsUrl).then(r => r.ok ? r.json() : []).catch(() => [])
    ])
    .then(([allSongsData, newSongsData]) => {
        const songsMap = new Map();
        [...newSongsData, ...allSongsData].forEach(song => {
            if (song && song.serial && !songsMap.has(song.serial)) {
                songsMap.set(song.serial, song);
            }
        });
        allSongs = Array.from(songsMap.values());
        songsDataLoaded = true;
        isLoadingSongs = false;
        prepareAutocompleteData(allSongs);
        document.dispatchEvent(new CustomEvent('songsDataReady', { detail: { allSongs } }));
        return allSongs;
    })
    .catch(error => {
        isLoadingSongs = false;
        songsDataLoaded = false;
        displayDataLoadError();
        document.dispatchEvent(new CustomEvent('songsDataError', { detail: error }));
        throw error;
    });
    return window.songsDataPromise;
}
function displayDataLoadError() {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    const resultsTableThead = document.querySelector("#resultsTable thead");
    if (resultsTableBody) {
        const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
        resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: red;">שגיאה בטעינת מאגר השירים. נסה לרענן את הדף.</td></tr>`;
        if (resultsTableThead) resultsTableThead.style.display = "none";
    }
}
window.executeSearchFromState = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const filter = urlParams.get('filter') || 'all';
    const resetFilterTo = urlParams.get('resetFilterTo');
    if (!query) {
        showHomepageView();
        if (searchInput) searchInput.value = '';
        return;
    }
    showSearchResultsView();
    if (searchInput) searchInput.value = query;
    const searchResultsTitle = document.getElementById('search-results-title');
    if (searchResultsTitle) {
        searchResultsTitle.textContent = `תוצאות חיפוש עבור: "${query}"`;
        searchResultsTitle.style.display = 'block';
    }
    handleFilterClick(filter, false);
    await searchSongs(query, filter);
    if (resetFilterTo === 'all') {
        handleFilterClick('all', false);
    }
}
async function searchSongs(query, searchBy) {
    saveSearchToHistory(query);
    const resultsTableThead = document.querySelector("#resultsTable thead");
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!songsDataLoaded) {
        displayLoadingMessage(colspan, "טוען נתונים...");
        await window.songsDataPromise;
    }
    displayLoadingMessage(colspan);
    performSearch(query, searchBy);
}
function performSearch(query, searchBy) {
    results = filterSongs(allSongs, query, searchBy);
    displayedResults = 0;
    const initialResultsToShow = results.slice(0, 250);
    displayedResults = initialResultsToShow.length;
    displayResults(initialResultsToShow, false);
}
function displayLoadingMessage(colspan = 4, text = 'מחפש...') {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    const resultsTableThead = document.querySelector("#resultsTable thead");
    const loadMoreButton = document.getElementById('loadMoreButton');
    if (!resultsTableBody) return;
    resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;"><div class="loading-container"><img src="${baseurl || ''}/assets/images/loading.gif" alt="טוען..." class="loading-image"><p class="loading-text">${text}</p></div></td></tr>`;
    if (resultsTableThead) resultsTableThead.style.display = "none";
    if (loadMoreButton) loadMoreButton.style.display = 'none';
}
function displayResults(resultsToDisplay, append = false) {
    const resultsTableBody = document.querySelector('#resultsTable tbody.songs-list');
    const resultsTableThead = document.querySelector("#resultsTable thead");
    const resultsTable = document.getElementById('resultsTable');
    if (!resultsTableBody) return;
    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
    if (!append) {
        resultsTableBody.innerHTML = '';
        if (resultsTable) resultsTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (resultsToDisplay.length === 0 && !append) {
        resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">לא נמצאו תוצאות.</td></tr>`;
        if (resultsTableThead) resultsTableThead.style.display = "none";
        toggleLoadMoreButton();
        return;
    }
    if (resultsTableThead) resultsTableThead.style.display = "";
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
                adCell.innerHTML = `<a href="${ad.link_url}" target="_blank" rel="noopener sponsored" class="inline-ad-link inline-ad-link--image" data-ad-location="inline" data-ad-type="${ad.type}" data-ad-id="${ad.tracking_id}"><img src="${baseurl || ''}${ad.image_url}" alt="${ad.alt_text}" class="inline-ad-image"></a>`;
            } else {
                let adHTML = `<a href="${ad.link_url}" target="_blank" rel="noopener sponsored" class="inline-ad-link" data-ad-location="inline" data-ad-type="${ad.type}" data-ad-id="${ad.tracking_id}">`;
                if (ad.icon_class) adHTML += `<div class="inline-ad-icon"><i class="${ad.icon_class}"></i></div>`;
                adHTML += `<div class="inline-ad-content"><div class="ad-title">${ad.title}</div><p class="ad-text">${ad.text}</p></div>`;
                if (ad.cta_text) adHTML += `<div class="inline-ad-cta">${ad.cta_text}</div>`;
                adHTML += `</a>`;
                adCell.innerHTML = adHTML;
            }
            adRow.appendChild(adCell);
            frag.appendChild(adRow);
        }
        const r = document.createElement('tr');
        r.dataset.songSerial = s.serial; r.dataset.driveId = s.driveId;
        const nC = document.createElement('td'); nC.textContent = s.name; r.appendChild(nC);
        const alC = document.createElement('td');
        const alB = document.createElement('button'); alB.textContent = s.album; alB.className = 'btn btn-text'; alB.dataset.albumName = s.album; alB.title = `חפש אלבום: ${s.album}`; alC.appendChild(alB); r.appendChild(alC);
        const siC = document.createElement('td');
        const siB = document.createElement('button'); siB.textContent = s.singer; siB.className = 'btn btn-text'; siB.dataset.singerName = s.singer; siB.title = `חפש זמר: ${s.singer}`; siC.appendChild(siB); r.appendChild(siC);
        const acC = document.createElement('td'); acC.className = 'actions-cell';
        acC.innerHTML = `<div class="actions-button-group"><button class="download-button" data-song-serial="${s.serial}" data-drive-id="${s.driveId}" title="הורדה"><i class="fas fa-download"></i></button><button class="share-button" data-song-serial="${s.serial}" title="שיתוף"><i class="fas fa-share-alt"></i></button></div>`;
        r.appendChild(acC);
        frag.appendChild(r);
    });
    resultsTableBody.appendChild(frag);
    toggleLoadMoreButton();
}
const debouncedHandleAutocomplete = debounce(handleAutocompleteInput, 250);
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', event => {
        const filterButton = event.target.closest('.filter-button');
        if (filterButton) {
            handleFilterClick(filterButton.dataset.filter, true);
            return;
        }
        const loadMoreBtn = event.target.closest('#loadMoreButton');
        if (loadMoreBtn) {
            loadMoreResults();
            return;
        }
    });
    if (searchForm) {
        searchForm.addEventListener('submit', hideAutocompleteSuggestions);
    }
    const loadMoreButton = document.getElementById('loadMoreButton');
    if (loadMoreButton) {
        loadMoreButton.classList.add('btn', 'btn-secondary');
    }
    loadAllSongsData().then(() => {
        executeSearchFromState();
    });
    if (searchInput) {
        searchInput.addEventListener('input', () => {
             userIsTyping = true;
             const query = searchInput.value.trim();
             if (query.length === 0) renderHistorySuggestions();
             else debouncedHandleAutocomplete(query);
        });
        searchInput.addEventListener('click', () => { if (searchInput.value.trim().length === 0) renderHistorySuggestions(); });
        searchInput.addEventListener('blur', () => { setTimeout(hideAutocompleteSuggestions, 150); });
    }
    window.addEventListener('popstate', (event) => {
        executeSearchFromState();
    });
    if (suggestionsContainer) {
        suggestionsContainer.addEventListener('mousedown', (event) => {
            const item = event.target.closest('.autocomplete-suggestion-item');
            if (!item) return;
            event.preventDefault();
            if (item.classList.contains('clear-history-button')) {
                clearSearchHistory();
            } else {
                if (searchInput) searchInput.value = item.dataset.suggestionValue;
                if (searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
    }
});
function handleFilterClick(filter, triggeredByUserClick = false) {
    if (!filter) return;
    activeFilter = filter;
    document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
    const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`);
    if (activeButton) activeButton.classList.add('active');
    if (triggeredByUserClick) {
        if (searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
}
function filterSongs(songsToFilter, query, searchBy) {
    if (!query) return [];
    const calcDice = (t1, t2) => {
        if (!t1?.length || !t2?.length) return 0;
        const i = new Set(t1.filter(t => t2.includes(t)));
        return (2 * i.size) / (t1.length + t2.length);
    };
    const calcLev = (s1 = '', s2 = '') => {
        const l1 = s1.length, l2 = s2.length;
        if (l1 == 0) return l2 > 0 ? 1 : 0; if (l2 == 0) return l1 > 0 ? 1 : 0;
        if (Math.abs(l1 - l2) > Math.max(l1, l2) * 0.6) return 1;
        const m = Array.from({ length: l1 + 1 }, (_, i) => [i]);
        for (let j = 1; j <= l2; j++) m[0][j] = j;
        for (let i = 1; i <= l1; i++) for (let j = 1; j <= l2; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1));
        const maxL = Math.max(l1, l2);
        return maxL === 0 ? 0 : m[l1][l2] / maxL;
    };
    const qL = query.toLowerCase(), qT = qL.split(/\s+/).filter(Boolean), fT = 0.55, lT = 0.45;
    const fMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' };
    return songsToFilter.map(s => {
        let best = 0;
        const keys = searchBy === 'all' ? ['serial', 'name', 'album', 'singer'] : (fMap[searchBy] ? [fMap[searchBy]] : []);
        for (const k of keys) {
            const sv = s[k] ? String(s[k]) : ''; if (!sv) continue;
            const lv = sv.toLowerCase();
            let current = 0;
            if ((k === 'serial' && lv.startsWith(qL)) || (k !== 'serial' && lv.includes(qL))) current = 1.0;
            else {
                const vT = lv.split(/\s+/).filter(Boolean), dice = calcDice(qT, vT);
                if (dice >= fT) current = Math.max(current, dice);
                if (current < fT) { const lev = calcLev(qL, lv); if (lev <= lT) current = Math.max(current, (1 - lev)); }
            }
            best = Math.max(best, current);
        }
        s._score = best; return s;
    }).filter(s => s._score > 0).sort((a, b) => b._score - a._score || (parseInt(a.serial, 10) || 0) - (parseInt(b.serial, 10) || 0));
}
function loadMoreResults() {
    const start = displayedResults;
    const end = Math.min(start + 250, results.length);
    if (start >= results.length) return;
    const newRes = results.slice(start, end);
    displayResults(newRes, true);
    displayedResults = end;
}
function toggleLoadMoreButton() {
    const loadMoreButton = document.getElementById('loadMoreButton');
    if (loadMoreButton) {
        loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none';
    }
}
function handleAutocompleteInput(query) {
    if (!userIsTyping) { hideAutocompleteSuggestions(); return; }
    userIsTyping = false;
    if (!suggestionsContainer || !songsDataLoaded || query.trim().length < MIN_QUERY_LENGTH_FOR_AUTOCOMPLETE) { hideAutocompleteSuggestions(); return; }
    const lowerQuery = query.toLowerCase();
    let suggestions = [];
    const poolMap = { singer: uniqueArtistNames, name: uniqueSongTitles, album: uniqueAlbumNames };
    const pools = activeFilter === 'all' ? [uniqueArtistNames, uniqueSongTitles, uniqueAlbumNames] : [poolMap[activeFilter] || []];
    for (const pool of pools) {
        if (suggestions.length >= MAX_AUTOCOMPLETE_SUGGESTIONS) break;
        for (const item of pool) {
            if (item.toLowerCase().startsWith(lowerQuery) && !suggestions.find(s => s.value === item)) {
                suggestions.push({ value: item });
            }
        }
    }
    renderAutocompleteSuggestions(suggestions.slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS), lowerQuery);
}
function renderAutocompleteSuggestions(suggestions, lowerQuery) {
    if (!suggestionsContainer || !searchForm) return;
    if (suggestions.length === 0) { hideAutocompleteSuggestions(); return; }
    suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'autocomplete-suggestion-item';
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
    if (history.length === 0) { hideAutocompleteSuggestions(); return; }
    suggestionsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    history.forEach(query => {
        const item = document.createElement('div');
        item.className = 'autocomplete-suggestion-item history-item';
        item.setAttribute('role', 'option');
        item.dataset.suggestionValue = query;
        item.innerHTML = `<i class="fas fa-history"></i><span>${query.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`;
        fragment.appendChild(item);
    });
    const clearButton = document.createElement('div');
    clearButton.className = 'autocomplete-suggestion-item clear-history-button';
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