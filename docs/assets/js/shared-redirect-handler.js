const downloadQueue = [];
let isProcessingQueue = false;
const INTER_DOWNLOAD_DELAY_MS = 1000;
const BUTTON_RESTORE_DELAY_MS = 10000;
const IFRAME_REMOVE_DELAY_MS = 10000;
function updateDownloadLoadingMessage() {
    const loadingMessage = document.getElementById('loadingMessage');
    const progressText = document.getElementById('progressText');
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
    } else {
        if (loadingMessage.classList.contains('show')) {
            setTimeout(() => {
                const stillActive = document.querySelectorAll('button.download-button.download-in-progress, button.download-button-new.download-in-progress').length > 0;
                if (!stillActive && downloadQueue.length === 0) {
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
        updateDownloadLoadingMessage();
    }
}
function processDownloadQueue() {
    if (downloadQueue.length === 0) {
        isProcessingQueue = false;
        updateDownloadLoadingMessage();
        return;
    }
    isProcessingQueue = true;
    const item = downloadQueue.shift();
    try {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `https://drive.google.com/uc?export=download&id=${item.driveId}`;
        document.body.appendChild(iframe);
        setTimeout(() => {
            restoreDownloadButton(item.songSerial);
        }, BUTTON_RESTORE_DELAY_MS);
        setTimeout(() => {
            try {
                iframe.remove();
            } catch (removeError) {
                console.warn(`Iframe remove error for driveId: ${item.driveId}`, removeError);
            }
        }, IFRAME_REMOVE_DELAY_MS);
        setTimeout(processDownloadQueue, INTER_DOWNLOAD_DELAY_MS);
    } catch (error) {
        console.error(`Error creating iframe for serial ${item.songSerial}:`, error);
        restoreDownloadButton(item.songSerial);
        if (typeof showMessage === 'function') {
            showMessage(`שגיאה בהכנת ההורדה לשיר ${item.songSerial}.`);
        }
        setTimeout(processDownloadQueue, 50);
    }
}
window.downloadSongWithDriveId = function(buttonElement) {
    if (!buttonElement) return;
    const songSerial = buttonElement.dataset.songSerial;
    const driveId = buttonElement.dataset.driveId;
    if (!songSerial || !driveId) {
        if (typeof showMessage === 'function') showMessage('שגיאה: חסר מידע להורדה.');
        return;
    }
    if (buttonElement.disabled || buttonElement.classList.contains('download-in-progress')) {
        return;
    }
    buttonElement.disabled = true;
    buttonElement.classList.add('download-in-progress');
    buttonElement.dataset.originalIcon = buttonElement.innerHTML;
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    downloadQueue.push({ songSerial: songSerial, driveId: driveId });
    updateDownloadLoadingMessage();
    if (!isProcessingQueue) {
        processDownloadQueue();
    }
};
function handleHeaderSearchRedirect(event) {
    const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
    if (isHomepage) {
        event.preventDefault();
        return;
    }
    event.preventDefault();
    const searchForm = event.currentTarget;
    const searchInput = searchForm.querySelector('#searchInput');
    const searchInputVal = searchInput ? searchInput.value.trim() : '';
    let searchBy = 'all';
    const activeFilterButton = document.querySelector('.filter-button.active');
    if (activeFilterButton && activeFilterButton.dataset.filter) {
        searchBy = activeFilterButton.dataset.filter;
    }
    if (searchInputVal) {
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
        window.location.href = redirectUrl;
    } else {
        searchInput?.focus();
    }
}
function handleTableClickActions(event) {
    const target = event.target;
    const button = target.closest('button');
    if (!button || !button.closest('tbody.songs-list')) return;
    const row = button.closest('tr');
    const songSerial = button.dataset.songSerial || (row ? row.dataset.songSerial : null);
    const driveId = button.dataset.driveId || (row ? row.dataset.driveId : null);
    const isDownloadButton = button.classList.contains('download-button') || button.classList.contains('download-button-new');
    if (isDownloadButton && songSerial && driveId) {
         event.preventDefault();
         event.stopPropagation();
         if (typeof window.downloadSongWithDriveId === 'function') {
             window.downloadSongWithDriveId(button);
         } else {
             console.error("Shared Handler: downloadSongWithDriveId function is not defined.");
             if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
         }
         return;
    }
    if (button.classList.contains('share-button') && songSerial) {
        event.preventDefault();
        event.stopPropagation();
        const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;
        if (typeof copyToClipboard === 'function') {
            const success = copyToClipboard(shareLink);
            if (success) {
                const originalIconHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check" style="color: green;"></i>';
                button.classList.add('copied');
                button.disabled = true;
                setTimeout(() => {
                    if (button) {
                         button.innerHTML = originalIconHTML;
                         button.classList.remove('copied');
                         button.disabled = false;
                    }
                }, 1500);
            } else {
                 if (typeof showMessage === 'function') showMessage("שגיאה בהעתקת הקישור.");
            }
        } else {
             if (typeof showMessage === 'function') showMessage("שגיאה: לא ניתן להעתיק קישור.");
        }
        return;
    }
    if (button.classList.contains('album-button') || button.classList.contains('singer-button')) {
        event.preventDefault();
        event.stopPropagation();
        const searchTerm = button.dataset.albumName || button.dataset.singerName || button.textContent.trim();
        const searchType = button.classList.contains('album-button') ? 'album' : 'singer';
        const isHomepage = window.location.pathname === (baseurl || '') + '/' || window.location.pathname === (baseurl || '') + '/index.html' || window.location.pathname === (baseurl || '');
        if (searchTerm) {
            if (isHomepage && typeof searchSongs === 'function' && typeof handleFilterClick === 'function' && document.getElementById('searchInput')) {
                const searchInputGlobal = document.getElementById('searchInput');
                searchInputGlobal.value = searchTerm;
                handleFilterClick(searchType, false);
                searchSongs(searchTerm.toLowerCase(), searchType);
                 window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
                window.location.href = redirectUrl;
            }
        }
        return;
    }
}
function initializeSharedRedirects() {
    console.log("Shared Handler: Initializing shared handlers...");
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.removeEventListener('submit', handleHeaderSearchRedirect);
        searchForm.addEventListener('submit', handleHeaderSearchRedirect);
    }
    document.body.removeEventListener('click', handleTableClickActions);
    document.body.addEventListener('click', handleTableClickActions);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharedRedirects);
} else {
    initializeSharedRedirects();
}