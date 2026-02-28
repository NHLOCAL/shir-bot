let allSongs = [];
let allArtists = [];
let results = [];
let artistResults = [];
let displayedResults = 0;
let showSinglesOnly = true;
let activeFilter = 'all';
let isLoadingSongs = false;
let songsDataLoaded = false;
let isLoadingArtists = false;
let artistsDataLoaded = false;
let userIsTyping = false;
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const suggestionsContainer = document.getElementById('autocomplete-suggestions');
const ctaContainer = document.getElementById('cta-container');
const ctaFocusSearchBtn = document.getElementById('cta-focus-search-btn');
const MIN_QUERY_LENGTH_FOR_AUTOCOMPLETE = 2;
const MAX_AUTOCOMPLETE_SUGGESTIONS = 7;
const MAX_ARTIST_RESULTS_DISPLAY = 8;
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
function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function highlightMatch(text, lowerQuery) {
    const safeText = String(text || '');
    if (!lowerQuery) return escapeHtml(safeText);
    const index = safeText.toLowerCase().indexOf(lowerQuery);
    if (index === -1) return escapeHtml(safeText);
    const before = escapeHtml(safeText.substring(0, index));
    const match = escapeHtml(safeText.substring(index, index + lowerQuery.length));
    const after = escapeHtml(safeText.substring(index + lowerQuery.length));
    return `${before}<strong>${match}</strong>${after}`;
}
function calculateDiceCoefficient(tokensA, tokensB) {
    if (!tokensA?.length || !tokensB?.length) return 0;
    const intersection = new Set(tokensA.filter(token => tokensB.includes(token)));
    return (2 * intersection.size) / (tokensA.length + tokensB.length);
}
function calculateLevenshteinRatio(source = '', target = '') {
    const sourceLength = source.length;
    const targetLength = target.length;
    if (sourceLength === 0) return targetLength > 0 ? 1 : 0;
    if (targetLength === 0) return sourceLength > 0 ? 1 : 0;
    if (Math.abs(sourceLength - targetLength) > Math.max(sourceLength, targetLength) * 0.6) return 1;
    const matrix = Array.from({ length: sourceLength + 1 }, (_, index) => [index]);
    for (let column = 1; column <= targetLength; column++) matrix[0][column] = column;
    for (let row = 1; row <= sourceLength; row++) {
        for (let column = 1; column <= targetLength; column++) {
            matrix[row][column] = Math.min(
                matrix[row - 1][column] + 1,
                matrix[row][column - 1] + 1,
                matrix[row - 1][column - 1] + (source[row - 1] === target[column - 1] ? 0 : 1)
            );
        }
    }
    const maxLength = Math.max(sourceLength, targetLength);
    return maxLength === 0 ? 0 : matrix[sourceLength][targetLength] / maxLength;
}
function calculateTextSearchScore(queryLower, queryTokens, valueLower, allowContainsMatch = true) {
    let score = 0;
    if (!valueLower) return score;
    if (valueLower.startsWith(queryLower) || (allowContainsMatch && valueLower.includes(queryLower))) {
        return 1;
    }
    const valueTokens = valueLower.split(/\s+/).filter(Boolean);
    const diceScore = calculateDiceCoefficient(queryTokens, valueTokens);
    if (diceScore >= 0.55) score = Math.max(score, diceScore);
    if (score < 0.55) {
        const levenshtein = calculateLevenshteinRatio(queryLower, valueLower);
        if (levenshtein <= 0.45) score = Math.max(score, 1 - levenshtein);
    }
    return score;
}
function getArtistResultElements() {
    return {
        container: document.getElementById('artistResultsContainer'),
        list: document.getElementById('artistResultsList'),
        count: document.getElementById('artistResultsCount')
    };
}
function hideArtistResults() {
    const { container, list, count } = getArtistResultElements();
    if (container) container.style.display = 'none';
    if (list) list.innerHTML = '';
    if (count) count.textContent = '';
}
function displayArtistResults(artistsToDisplay, query = '') {
    const { container, list, count } = getArtistResultElements();
    if (!container || !list) return;
    if (!artistsToDisplay.length) {
        hideArtistResults();
        return;
    }
    const lowerQuery = query.toLowerCase();
    const fragment = document.createDocumentFragment();
    artistsToDisplay.forEach(artist => {
        const link = document.createElement('a');
        link.className = 'artist-result-item';
        link.href = artist.url;
        link.title = `מעבר לדף האמן: ${artist.name}`;
        link.innerHTML = `
            <span class="artist-result-icon" aria-hidden="true"><i class="fas fa-microphone-alt"></i></span>
            <span class="artist-result-name">${highlightMatch(artist.name, lowerQuery)}</span>
            <span class="artist-result-cta">לדף האמן</span>
        `;
        fragment.appendChild(link);
    });
    list.innerHTML = '';
    list.appendChild(fragment);
    if (count) {
        count.textContent = artistsToDisplay.length === 1 ? 'אמן תואם אחד' : `${artistsToDisplay.length} אמנים תואמים`;
    }
    container.style.display = 'block';
}
function loadArtistsData() {
    if (artistsDataLoaded || isLoadingArtists) {
        return artistsDataLoaded ? Promise.resolve(allArtists) : window.artistsDataPromise;
    }
    isLoadingArtists = true;
    const artistsUrl = `${baseurl || ''}/artists/`;
    window.artistsDataPromise = fetch(artistsUrl)
        .then(response => {
            if (!response.ok) throw new Error(`Failed to load artists list: ${response.status}`);
            return response.text();
        })
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const artistAnchors = Array.from(doc.querySelectorAll('.artists-list ul li a'));
            const artistMap = new Map();
            artistAnchors.forEach(anchor => {
                const name = anchor.textContent ? anchor.textContent.trim() : '';
                const url = anchor.getAttribute('href') ? anchor.getAttribute('href').trim() : '';
                if (!name || !url) return;
                const key = name.toLowerCase();
                if (!artistMap.has(key)) {
                    artistMap.set(key, { name, url });
                }
            });
            allArtists = Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'he'));
            artistsDataLoaded = true;
            isLoadingArtists = false;
            document.dispatchEvent(new CustomEvent('artistsDataReady', { detail: { allArtists } }));
            return allArtists;
        })
        .catch(error => {
            console.error('Failed to load artist pages list:', error);
            allArtists = [];
            artistsDataLoaded = true;
            isLoadingArtists = false;
            document.dispatchEvent(new CustomEvent('artistsDataError', { detail: error }));
            return allArtists;
        });
    return window.artistsDataPromise;
}
function toggleSearchCtaButton(show) {
    const currentCtaContainer = document.getElementById('cta-container') || ctaContainer;
    if (!currentCtaContainer) return;
    currentCtaContainer.style.display = show ? 'block' : 'none';
}
function showHomepageView() {
    const homepageContent = document.getElementById('homepage-content');
    const searchResultsArea = document.getElementById('search-results-area');
    const searchResultsTitle = document.getElementById('search-results-title');
    if (homepageContent) homepageContent.style.display = 'block';
    if (searchResultsArea) searchResultsArea.style.display = 'none';
    if (searchResultsTitle) searchResultsTitle.style.display = 'none';
    hideArtistResults();
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
    const isSearchPage = window.location.pathname.startsWith((baseurl || '') + '/search/');
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    const filter = urlParams.get('filter') || 'all';
    const resetFilterTo = urlParams.get('resetFilterTo');
    const resultsTable = document.getElementById('resultsTable');
    const searchResultsTitle = document.getElementById('search-results-title');
    if (!query && !isSearchPage) {
        return;
    }
    if (!query && isSearchPage) {
        if (searchInput) searchInput.value = '';
        if (resultsTable) resultsTable.style.display = 'none';
        if (searchResultsTitle) searchResultsTitle.style.display = 'none';
        hideArtistResults();
        toggleSearchCtaButton(true);
        return;
    }
    toggleSearchCtaButton(false);
    if(resultsTable) resultsTable.style.display = 'block';
    showSearchResultsView();
    if (searchInput) searchInput.value = query;
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
    if (!artistsDataLoaded || !songsDataLoaded) {
        displayLoadingMessage(colspan, "טוען נתונים...");
    }
    if (!artistsDataLoaded) {
        await (window.artistsDataPromise || loadArtistsData());
    }
    if (!songsDataLoaded) {
        await window.songsDataPromise;
    }
    displayLoadingMessage(colspan);
    performSearch(query, searchBy);
}
function performSearch(query, searchBy) {
    const shouldIncludeArtists = searchBy === 'all' || searchBy === 'singer';
    artistResults = shouldIncludeArtists
        ? filterArtists(allArtists, query).slice(0, MAX_ARTIST_RESULTS_DISPLAY)
        : [];
    displayArtistResults(artistResults, query);
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
    hideArtistResults();
    toggleSearchCtaButton(false);
    if (!resultsTableBody) return;
    resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;"><div class="loading-container"><img src="${baseurl || ''}/assets/images/loading.gif" alt="טוען..." class="loading-image"><p class="loading-text">${text}</p></div></td></tr>`;
    if (resultsTableThead) resultsTableThead.style.display = "";
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
        const artistContainer = document.getElementById('artistResultsContainer');
        const scrollTarget = artistResults.length > 0 && artistContainer ? artistContainer : resultsTable;
        if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (resultsToDisplay.length === 0 && !append) {
        const hasArtistMatches = artistResults.length > 0;
        const noResultsMessage = hasArtistMatches
            ? 'לא נמצאו שירים עבור החיפוש. נמצאו אמנים תואמים למעלה.'
            : 'לא נמצאו תוצאות.';
        resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center;">${noResultsMessage}</td></tr>`;
        if (resultsTableThead) resultsTableThead.style.display = "none";
        toggleLoadMoreButton();
        toggleSearchCtaButton(!hasArtistMatches);
        return;
    }
    toggleSearchCtaButton(false);
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
    if (ctaFocusSearchBtn) {
        ctaFocusSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (searchInput && searchForm) {
                searchInput.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                searchForm.classList.add('highlight-animation');
                setTimeout(() => {
                    searchForm.classList.remove('highlight-animation');
                }, 1500);
            }
        });
    }
    if (searchForm) {
        searchForm.addEventListener('submit', hideAutocompleteSuggestions);
    }
    const loadMoreButton = document.getElementById('loadMoreButton');
    if (loadMoreButton) {
        loadMoreButton.classList.add('btn', 'btn-secondary');
    }
    Promise.allSettled([loadAllSongsData(), loadArtistsData()]).then(() => {
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
    const qL = query.toLowerCase();
    const qT = qL.split(/\s+/).filter(Boolean);
    const fMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' };
    return songsToFilter.map(s => {
        let best = 0;
        const keys = searchBy === 'all' ? ['serial', 'name', 'album', 'singer'] : (fMap[searchBy] ? [fMap[searchBy]] : []);
        for (const k of keys) {
            const sv = s[k] ? String(s[k]) : '';
            if (!sv) continue;
            const lv = sv.toLowerCase();
            const current = calculateTextSearchScore(qL, qT, lv, k !== 'serial');
            best = Math.max(best, current);
        }
        return { ...s, _score: best };
    }).filter(s => s._score > 0).sort((a, b) => b._score - a._score || (parseInt(a.serial, 10) || 0) - (parseInt(b.serial, 10) || 0));
}
function filterArtists(artistsToFilter, query) {
    if (!query || !artistsToFilter?.length) return [];
    const qL = query.toLowerCase();
    const qT = qL.split(/\s+/).filter(Boolean);
    return artistsToFilter.map(artist => {
        const valueLower = artist.name.toLowerCase();
        return { ...artist, _score: calculateTextSearchScore(qL, qT, valueLower, true) };
    }).filter(artist => artist._score > 0)
      .sort((a, b) => b._score - a._score || a.name.localeCompare(b.name, 'he'));
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
