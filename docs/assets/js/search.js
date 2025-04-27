// File: assets/js/search.js

let allSongs = []; // יישאר ריק עד לטעינה
let results = [];
let displayedResults = 0;
let showSinglesOnly = true;
let activeFilter = 'all';

// משתני תור ההורדות (iframe) נשארים
const downloadQueue = [];
let isProcessingQueue = false;
const INTER_DOWNLOAD_DELAY_MS = 300;
const BUTTON_RESTORE_DELAY_MS = 3000;
const IFRAME_REMOVE_DELAY_MS = 5000;

// מצב טעינת נתונים
let isLoadingSongs = false;
let songsDataLoaded = false; // דגל לציון אם הנתונים נטענו בהצלחה

// רפרנסים לאלמנטים (נשארים)
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

// --- פונקציה לטעינת נתוני השירים ---
function loadAllSongsData() {
    // מניעת טעינה כפולה
    if (songsDataLoaded || isLoadingSongs) {
        // אם כבר נטען, החזר הבטחה שכבר הסתיימה
        if (songsDataLoaded) return Promise.resolve(allSongs);
        // אם בטעינה, החזר את ההבטחה הקיימת (מ-default.html)
        return window.songsDataPromise;
    }

    isLoadingSongs = true;
    console.log("Search.js: Starting to load all_songs.json...");
    // הצג הודעת טעינת נתונים ראשונית (אופציונלי)
    // displayDataLoadingMessage(); // אפשר ליצור פונקציה ייעודית

    // שמירת ההבטחה במשתנה גלובלי כדי שסקריפטים אחרים יוכלו להמתין לה
    window.songsDataPromise = fetch(`${baseurl || ''}/assets/data/all_songs.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data)) {
                throw new Error("Loaded data is not a valid array.");
            }
            allSongs = data;
            songsDataLoaded = true; // סמן שהנתונים נטענו
            isLoadingSongs = false;
            console.log(`Search.js: Successfully loaded ${allSongs.length} songs.`);
            // הסתר הודעת טעינת נתונים ראשונית (אם הוצגה)
            // hideDataLoadingMessage();

            // הפעל אירוע מותאם אישית כדי שסקריפטים אחרים ידעו שהנתונים מוכנים
            document.dispatchEvent(new CustomEvent('songsDataReady', { detail: allSongs }));

            return allSongs; // החזר את הנתונים לשרשור then
        })
        .catch(error => {
            isLoadingSongs = false;
            songsDataLoaded = false; // סמן שהטעינה נכשלה
            console.error('Search.js: Failed to load or parse all_songs.json:', error);
            // הצג שגיאה למשתמש באזור התוצאות
            displayDataLoadError();
             // הפעל אירוע שגיאה
             document.dispatchEvent(new CustomEvent('songsDataError', { detail: error }));
            throw error; // זרוק את השגיאה הלאה כדי ש-catch חיצוני יתפוס אותה
        });

    return window.songsDataPromise;
}

function displayDataLoadError() {
     if (resultsTableBody) {
         const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;
         resultsTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; color: red;">שגיאה בטעינת מאגר השירים. נסה לרענן את הדף.</td></tr>`;
         if (resultsTableThead) resultsTableThead.style.display = "none";
         if (loadMoreButton) loadMoreButton.style.display = 'none';
         // ודא שאזור התוצאות גלוי אם אנו בדף הבית
         const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
         if(isHomepage) {
            showSearchResultsViewInternal();
         }
     }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const urlParams = new URLSearchParams(window.location.search);
    const searchValue = urlParams.get('search');
    const searchByParam = urlParams.get('searchBy') || 'all';

    console.log("Search.js: DOMContentLoaded");

    // התחל את טעינת הנתונים מיד
    loadAllSongsData()
        .then(() => {
            console.log("Search.js: Song data loaded successfully after DOMContentLoaded.");
            // רק אחרי שהנתונים נטענו בהצלחה:
            if (isHomepage && searchValue) {
                console.log(`Search.js: Processing URL search params: search=${searchValue}, searchBy=${searchByParam}`);
                if (searchInput) searchInput.value = decodeURIComponent(searchValue);
                handleFilterClick(searchByParam, false); // עדכן כפתורים
                searchSongs(searchValue.toLowerCase(), searchByParam); // בצע חיפוש ראשוני
                 setTimeout(clearUrlParams, 150); // נקה פרמטרים
            } else if (isHomepage) {
                console.log("Search.js: Homepage loaded without search params. Data ready.");
                // הנתונים מוכנים, אפשר לאפשר ל-homepage.js להציג תוכן
                // (homepage.js יאזין לאירוע songsDataReady)
                 handleFilterClick('all', false); // הגדר פילטר ברירת מחדל
            } else {
                 // דפים אחרים (אמן וכו') - הנתונים מוכנים לשימוש אם יהיה צורך
                 console.log("Search.js: Non-homepage loaded. Data ready.");
                 // אם יש תוכן שדורש את הנתונים האלו בדפים שאינם דף הבית, טפל בו כאן
                 // או שהוא יטופל על ידי סקריפט אחר המאזין ל-'songsDataReady'
            }
        })
        .catch(error => {
            console.error("Search.js: Initial data load failed in DOMContentLoaded.", error);
            // הודעת שגיאה כבר אמורה להיות מוצגת על ידי displayDataLoadError
        });


    // חיבור מאזינים (נשארים כמעט זהים)
    if (searchInput) {
        searchInput.addEventListener("keypress", function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitForm();
            }
        });
        // Disable input until data is loaded? Optional.
        // searchInput.disabled = true; // Enable in .then() of loadAllSongsData
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
            handleFilterClick(this.dataset.filter, isCurrentlyHomepage);
        });
    });

    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMoreResults);
    }

});

// --- עדכון submitForm ---
async function submitForm() {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    const searchTerm = searchInput ? searchInput.value.trim() : '';
    const searchTermLower = searchTerm.toLowerCase();
    const currentActiveFilter = activeFilter;

    if (!isHomepage) {
        // Redirect logic remains the same
        if (searchTerm) {
            const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(currentActiveFilter)}`;
            window.location.href = redirectUrl;
        } else {
            searchInput?.focus();
        }
    } else {
        // --- שינוי: ודא שהנתונים נטענו לפני החיפוש ---
        if (!songsDataLoaded) {
            if (isLoadingSongs) {
                console.log("SubmitForm: Data is still loading, waiting...");
                // אפשר להציג הודעה או פשוט לחכות
                 if(loadingMessage && progressText) {
                    loadingMessage.style.display = 'flex';
                    progressText.textContent = 'טוען נתונים, מחפש בקרוב...';
                 }
                try {
                    await window.songsDataPromise; // המתן לסיום הטעינה
                    console.log("SubmitForm: Data finished loading, proceeding with search.");
                     if(loadingMessage && progressText && progressText.textContent.includes('טוען נתונים')) {
                         // אם ההודעה עדיין מציגה טעינת נתונים, נקה אותה לפני הצגת "מחפש"
                        loadingMessage.style.display = 'none';
                     }
                    searchSongs(searchTermLower, currentActiveFilter); // בצע חיפוש
                     setTimeout(clearUrlParams, 100);
                } catch (error) {
                    console.error("SubmitForm: Error occurred while waiting for data load.", error);
                    // שגיאה כבר טופלה והוצגה, אין צורך בפעולה נוספת
                }
            } else {
                // הטעינה נכשלה קודם, הודעת שגיאה כבר מוצגת
                console.error("SubmitForm: Cannot search, data loading previously failed.");
                 if(typeof showMessage === 'function') showMessage('לא ניתן לבצע חיפוש, טעינת נתוני השירים נכשלה.');
            }
        } else {
            // הנתונים כבר טעונים, בצע חיפוש כרגיל
            searchSongs(searchTermLower, currentActiveFilter);
            setTimeout(clearUrlParams, 100);
        }
        // ----------------------------------------------
    }
}

// --- עדכון searchSongs ---
async function searchSongs(query, searchBy) {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');

    // הצג את אזור התוצאות (חיוני בדף הבית)
    if (isHomepage) {
        showSearchResultsViewInternal();
    }

    const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4;

    // --- שינוי: בדיקת טעינת נתונים ---
    if (!songsDataLoaded) {
         if (isLoadingSongs) {
            // אם נגיע לכאן (למשל מחיפוש עם פרמטרים ב-URL), נמתין
            console.log("SearchSongs: Called while data loading, awaiting completion...");
            displayLoadingMessage(colspan, "טוען נתונים..."); // הודעה שונה
            try {
                await window.songsDataPromise;
                console.log("SearchSongs: Data loaded, proceeding.");
                 // המשך לחיפוש אחרי שהנתונים זמינים
            } catch (error) {
                 console.error("SearchSongs: Error awaiting data load.", error);
                 // שגיאה כבר טופלה והוצגה
                 return; // עצור את הפונקציה
            }
        } else {
             // הטעינה נכשלה קודם
             console.error("SearchSongs: Cannot perform search, data failed to load.");
              // הודעת שגיאה כבר מוצגת ב-displayDataLoadError
             return; // עצור את הפונקציה
        }
    }
    // --- סוף בדיקת טעינת נתונים ---


    // טיפול במקרה של שאילתה ריקה (נשאר)
    if (!query && searchBy === 'all') {
        displayResults([]);
        if (resultsTableThead) resultsTableThead.style.display = "none";
        if(loadMoreButton) loadMoreButton.style.display = 'none';
        return;
    }

    // הצג הודעת "מחפש..." (חשוב לעשות זאת *אחרי* ההמתנה לנתונים)
    displayLoadingMessage(colspan);

    // הנתונים קיימים ב-allSongs, בצע חיפוש
    performSearch(query, searchBy);
}

// --- פונקצית הצגת הודעת טעינה (עם טקסט אופציונלי) ---
function displayLoadingMessage(colspan = 4, text = 'מחפש...') {
    if (!resultsTableBody) return;
    showSearchResultsViewInternal(); // ודא שהאזור גלוי

    resultsTableBody.innerHTML = ''; // נקה תוצאות קודמות

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
    loadingTextElem.textContent = text; // השתמש בטקסט שהועבר
    loadingTextElem.classList.add('loading-text');
    loadingContainer.appendChild(loadingImage);
    loadingContainer.appendChild(loadingTextElem);
    loadingCell.appendChild(loadingContainer);
    loadingRow.appendChild(loadingCell);

    resultsTableBody.appendChild(loadingRow);

    if (resultsTableThead) resultsTableThead.style.display = "none";
    if (loadMoreButton) loadMoreButton.style.display = 'none';
}


// --- שאר הפונקציות נשארות כמעט זהות ---
// handleFilterClick, performSearch, filterSongs, displayResults,
// loadMoreResults, toggleLoadMoreButton,
// updateDownloadLoadingMessage, restoreDownloadButton, processDownloadQueue,
// downloadSongWithDriveId
// clearUrlParams, showSearchResultsViewInternal, showHomepageViewInternal

// --- (יש לכלול כאן את כל הפונקציות שנשארו זהות מהגרסה הקודמת של search.js) ---
// ... (כל הפונקציות האחרות מ-search.js שהיו תקינות נשארות כאן) ...

// לדוגמה, הפונקציות של ההורדה באמצעות iframe:
function updateDownloadLoadingMessage() {
    if (!loadingMessage || !progressText) return;
    const buttonsInProgress = document.querySelectorAll('button.download-button.download-in-progress, button.download-button-new.download-in-progress').length;
    const itemsInQueue = downloadQueue.length;
    if (buttonsInProgress > 0 || itemsInQueue > 0) {
        let message = "";
        if (buttonsInProgress > 0) message += `מוריד ${buttonsInProgress} שירים... `;
        if (itemsInQueue > 0) message += `(${itemsInQueue} ממתינים בתור)`;
        progressText.innerText = message.trim();
        if (!loadingMessage.classList.contains('show')) {
            loadingMessage.style.display = 'flex';
            loadingMessage.classList.add('show');
        }
        const progressBarContainer = loadingMessage.querySelector('.progress-bar');
        if (progressBarContainer) progressBarContainer.style.display = 'none';
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
    const button = document.querySelector(`button.download-button[data-song-serial="${songSerial}"], button.download-button-new[data-song-serial="${songSerial}"]`);
    if (button && button.classList.contains('download-in-progress')) {
        const originalIconHTML = button.dataset.originalIcon || '<i class="fas fa-download"></i>';
        button.innerHTML = originalIconHTML;
        button.disabled = false;
        button.classList.remove('download-in-progress');
        delete button.dataset.originalIcon;
        console.log(`Download Handler: Button restored for serial: ${songSerial}`);
        updateDownloadLoadingMessage();
    }
}
function processDownloadQueue() { /* ... קוד זהה ... */
    if (downloadQueue.length === 0) { isProcessingQueue = false; console.log("Download Handler: Queue empty."); updateDownloadLoadingMessage(); return; }
    isProcessingQueue = true;
    const item = downloadQueue.shift();
    console.log(`Download Handler: Processing ${item.songSerial}. Queue: ${downloadQueue.length}`); updateDownloadLoadingMessage();
    try {
        const iframe = document.createElement('iframe'); iframe.style.display = 'none'; iframe.src = `https://drive.google.com/uc?export=download&id=${item.driveId}`; document.body.appendChild(iframe); console.log(`Download Handler: iframe created for ${item.driveId}`);
        setTimeout(() => { restoreDownloadButton(item.songSerial); }, BUTTON_RESTORE_DELAY_MS);
        setTimeout(() => { try { iframe.remove(); console.log(`Download Handler: iframe removed for ${item.driveId}`); } catch (removeError) { console.warn(`iframe remove error: ${removeError}`); } }, IFRAME_REMOVE_DELAY_MS);
        setTimeout(processDownloadQueue, INTER_DOWNLOAD_DELAY_MS);
    } catch (error) { console.error(`iframe error ${item.songSerial}:`, error); restoreDownloadButton(item.songSerial); if (typeof showMessage === 'function') showMessage(`שגיאה בהכנת הורדה ${item.songSerial}.`); setTimeout(processDownloadQueue, 50); }
}
window.downloadSongWithDriveId = function(buttonElement) { /* ... קוד זהה ... */
    if (!buttonElement) { console.error("DL Handler: Invalid button."); return; }
    const songSerial = buttonElement.dataset.songSerial; const driveId = buttonElement.dataset.driveId;
    if (!songSerial || !driveId) { console.error(`DL Handler: Missing data. Serial: ${songSerial}, DriveID: ${driveId}`); if(typeof showMessage === 'function') showMessage('שגיאה: חסר מידע להורדה.'); if (buttonElement.classList.contains('download-in-progress')) { restoreDownloadButton(songSerial || 'unknown'); } return; }
    if (buttonElement.disabled || buttonElement.classList.contains('download-in-progress')) { console.warn(`DL Handler: Already in progress: ${songSerial}`); return; }
    if (downloadQueue.some(item => item.songSerial === songSerial)) { console.warn(`DL Handler: Already in queue: ${songSerial}`); if(typeof showMessage === 'function') showMessage(`${songSerial} כבר בתור להורדה.`); return; }
    buttonElement.disabled = true; buttonElement.classList.add('download-in-progress'); buttonElement.dataset.originalIcon = buttonElement.innerHTML; buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    downloadQueue.push({ songSerial: songSerial, driveId: driveId });
    console.log(`DL Handler: Added ${songSerial}. Queue: ${downloadQueue.length}`); updateDownloadLoadingMessage();
    if (!isProcessingQueue) { console.log("DL Handler: Starting queue."); processDownloadQueue(); }
}

// פונקציות נוספות שנשארו זהות:
function clearUrlParams() { /* ... קוד זהה ... */ try { const cleanUrl = window.location.origin + (baseurl || '') + '/'; if (window.location.href !== cleanUrl) { window.history.replaceState({}, document.title, cleanUrl); console.log("URL params cleared."); } } catch (e) { console.error("Error clearing URL params:", e); } }
function showSearchResultsViewInternal() { /* ... קוד זהה ... */ if (homepageContent) homepageContent.style.display = 'none'; if (searchResultsArea) searchResultsArea.style.display = 'block'; if (resultsTable && resultsTable.style.display === 'none') { resultsTable.style.display = ''; } }
function showHomepageViewInternal() { /* ... קוד זהה ... */ if (homepageContent) homepageContent.style.display = 'block'; if (searchResultsArea) searchResultsArea.style.display = 'none'; }
function handleFilterClick(filter, doSearch = false) { /* ... קוד זהה ... */ if (!filter) return; activeFilter = filter; filterButtons.forEach(btn => btn.classList.remove('active')); const activeButton = document.querySelector(`.filter-button[data-filter="${filter}"]`); if (activeButton) activeButton.classList.add('active'); if (doSearch) { const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : ''; searchSongs(searchTerm, activeFilter); setTimeout(clearUrlParams, 100); } }
function performSearch(query, searchBy) { /* ... קוד זהה ... */ let baseSongsToFilter = allSongs; results = filterSongs(baseSongsToFilter, query, searchBy); displayedResults = 0; const initialResultsToShow = results.slice(0, 250); displayedResults = initialResultsToShow.length; displayResults(initialResultsToShow, false); }
function filterSongs(songsToFilter, query, searchBy) { /* ... קוד זהה ... */
    // ... (אותה לוגיקה של חישוב רלוונטיות ומיון) ...
    if (!query) { if (searchBy === 'all') return []; const keyMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' }; const key = keyMap[searchBy]; if (!key) return false; return songsToFilter.filter(song => { const value = song[key]; return value != null && String(value).trim() !== ''; }); }
    const calcDice = (t1, t2) => { if (!t1?.length || !t2?.length) return 0; const i = new Set(t1.filter(t => t2.includes(t))); return (2 * i.size) / (t1.length + t2.length); };
    const calcLev = (s1 = '', s2 = '') => { /* ... Levenshtein logic ... */ const l1=s1.length, l2=s2.length; if(l1==0)return l2>0?1:0; if(l2==0)return l1>0?1:0; if(Math.abs(l1-l2)>Math.max(l1,l2)*0.6)return 1; const m=Array.from({length:l1+1},(_,i)=>[i]); for(let j=1;j<=l2;j++)m[0][j]=j; for(let i=1;i<=l1;i++)for(let j=1;j<=l2;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(s1[i-1]===s2[j-1]?0:1)); const maxL=Math.max(l1,l2); return maxL===0?0:m[l1][l2]/maxL; };
    const qL = query.toLowerCase(), qT = qL.split(/\s+/).filter(Boolean), fT = 0.55, lT = 0.45;
    const fMap = { name: 'name', album: 'album', singer: 'singer', serial: 'serial' };
    const scored = songsToFilter.map(s => { s._score = 0; let best = 0; const keys = searchBy === 'all' ? ['serial', 'name', 'album', 'singer'] : (fMap[searchBy] ? [fMap[searchBy]] : []);
        for (const k of keys) { const v = s[k], sv = v==null?'':String(v); if (!sv) continue; const lv = sv.toLowerCase(); let current = 0; const exact = (k==='serial'&&lv.startsWith(qL))||(k!=='serial'&&lv.includes(qL))||(searchBy==='all'&&lv.includes(qL));
            if(exact) current=1.0; else { const vT=lv.split(/\s+/).filter(Boolean), dice=calcDice(qT,vT); if(dice>=fT)current=Math.max(current,dice); if(current<fT&&Math.abs(qL.length-lv.length)<=Math.max(qL.length,lv.length)*0.5){ const lev=calcLev(qL,lv); if(lev<=lT)current=Math.max(current,(1-lev)); } } best=Math.max(best,current); } s._score=best; return s; }).filter(s=>s._score>0);
    if (searchBy === 'serial') { const tS=parseInt(qL,10); if(!isNaN(tS))return scored.sort((a,b)=>{ const sA=parseInt(a.serial,10)||0,sB=parseInt(b.serial,10)||0; const isA=sA===tS,isB=sB===tS; if(isA&&!isB)return -1; if(!isA&&isB)return 1; if(isA&&isB)return 0; if(a._score!==b._score)return b._score-a._score; const dA=Math.abs(sA-tS),dB=Math.abs(sB-tS); return dA!==dB?dA-dB:sA-sB; }); }
    return scored.sort((a,b)=>{ if(a._score!==b._score)return b._score-a._score; const sA=parseInt(a.serial,10)||0,sB=parseInt(b.serial,10)||0; return sA-sB; });
}
function displayResults(resultsToDisplay, append = false) { /* ... קוד זהה להצגת שורות עם data-drive-id ... */
    if (!resultsTableBody) return; showSearchResultsViewInternal(); const colspan = resultsTableThead ? resultsTableThead.rows[0].cells.length : 4; if (!append) resultsTableBody.innerHTML = '';
    if (resultsToDisplay.length === 0 && !append) { const nr = document.createElement('tr'), nc = document.createElement('td'); nc.setAttribute('colspan', colspan); nc.textContent = 'לא נמצאו תוצאות.'; nc.style.textAlign = 'center'; nr.appendChild(nc); resultsTableBody.appendChild(nr); if (resultsTableThead) resultsTableThead.style.display = "none"; toggleLoadMoreButton(); return; }
    if (resultsToDisplay.length > 0 && resultsTableThead && (resultsTableThead.style.display === "none" || !resultsTableThead.style.display)) { resultsTableThead.style.display = ""; }
    const frag = document.createDocumentFragment(); resultsToDisplay.forEach(s => { const r = document.createElement('tr'); r.dataset.songSerial = s.serial; r.dataset.driveId = s.driveId;
        const nC=document.createElement('td'); nC.textContent=s.name; r.appendChild(nC);
        const alC=document.createElement('td'); const alB=document.createElement('button'); alB.textContent=s.album; alB.className='album-button'; alB.dataset.albumName=s.album; alB.title=`חפש אלבום: ${s.album}`; alC.appendChild(alB); r.appendChild(alC);
        const siC=document.createElement('td'); const siB=document.createElement('button'); siB.textContent=s.singer; siB.className='singer-button'; siB.dataset.singerName=s.singer; siB.title=`חפש זמר: ${s.singer}`; siC.appendChild(siB); r.appendChild(siC);
        const acC=document.createElement('td'); acC.className='actions-cell'; const grp=document.createElement('div'); grp.className='actions-button-group';
        const dlB=document.createElement('button'); dlB.className='download-button'; dlB.dataset.songSerial=s.serial; dlB.dataset.driveId=s.driveId; dlB.title='הורדה'; dlB.innerHTML='<i class="fas fa-download"></i>';
        const shB=document.createElement('button'); shB.className='share-button'; shB.dataset.songSerial=s.serial; shB.title='שיתוף'; shB.innerHTML='<i class="fas fa-share-alt"></i>';
        grp.appendChild(dlB); grp.appendChild(shB); acC.appendChild(grp); r.appendChild(acC); frag.appendChild(r); });
    resultsTableBody.appendChild(frag); toggleLoadMoreButton();
}
function loadMoreResults() { /* ... קוד זהה ... */ console.log(`Load More: Displayed=${displayedResults}, Total=${results.length}`); const start = displayedResults; const limit = displayedResults + 250; const end = Math.min(limit, results.length); if (start >= results.length) { console.log("No more results."); if (loadMoreButton) loadMoreButton.style.display = 'none'; return; } const newResults = results.slice(start, end); console.log(`Loading ${start} to ${end} (${newResults.length} new)`); displayResults(newResults, true); displayedResults = end; console.log(`Load More Finished. New displayed=${displayedResults}`); }
function toggleLoadMoreButton() { /* ... קוד זהה ... */ if (loadMoreButton) { loadMoreButton.style.display = results.length > displayedResults ? 'block' : 'none'; } }