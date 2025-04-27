// File: assets/js/shared-redirect-handler.js

// --- פונקציית הטיפול בחיפוש מהכותרת נשארת זהה ---
function handleHeaderSearchRedirect(event) {
    event.preventDefault();
    const searchForm = event.currentTarget;
    const searchInput = searchForm.querySelector('#searchInput');
    const searchInputVal = searchInput ? searchInput.value.trim() : '';

    // --- שינוי קטן: קבלת הפילטר מהכפתור הפעיל ישירות מה-DOM ---
    // במקום להסתמך על משתנה activeFilter שאולי לא קיים בהקשר הזה
    let searchBy = 'all'; // Default
    const activeFilterButton = document.querySelector('.filter-button.active'); // Find active button globally
    if (activeFilterButton && activeFilterButton.dataset.filter) {
        searchBy = activeFilterButton.dataset.filter;
    }
    // ----------------------------------------------------------

    if (searchInputVal) {
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
        console.log(`Shared Handler: Redirecting from secondary page (header search) to: ${redirectUrl}`);
        window.location.href = redirectUrl;
    } else {
        searchInput?.focus(); // Focus if empty
    }
}

// --- עדכון מטפל הקליקים הגלובלי בטבלאות ---
function handleTableClickActions(event) {
    const target = event.target;
    // Find the closest button element that was clicked
    const button = target.closest('button');

    // Ignore clicks that are not on buttons or not within a song list table body
    if (!button || !button.closest('tbody.songs-list')) return;

    const row = button.closest('tr');
    // --- שינוי: קבלת driveId ישירות מהכפתור או מהשורה ---
    const songSerial = button.dataset.songSerial || (row ? row.dataset.songSerial : null);
    const driveId = button.dataset.driveId || (row ? row.dataset.driveId : null); // <-- הוספה
    // ---------------------------------------------------

    // --- שינוי: בדיקה אם הכפתור הוא כפתור הורדה (מחפשים download-button או download-button-new) ---
    const isDownloadButton = button.classList.contains('download-button') || button.classList.contains('download-button-new');

    if (isDownloadButton && songSerial && driveId) {
         event.preventDefault();
         event.stopPropagation();
         console.log(`Shared Handler: Download button clicked for serial ${songSerial} with DriveID ${driveId}`);

         // --- שינוי: קריאה לפונקציית ההורדה הגלובלית החדשה ---
         if (typeof window.downloadSongWithDriveId === 'function') {
             window.downloadSongWithDriveId(button); // Pass the button element itself
         } else {
             console.error("Shared Handler: downloadSongWithDriveId function is not defined globally.");
             if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
             // Restore button if needed (optional)
             if (button.classList.contains('download-in-progress')) {
                 button.innerHTML = button.dataset.originalIcon || '<i class="fas fa-download"></i>';
                 button.disabled = false;
                 button.classList.remove('download-in-progress');
                 delete button.dataset.originalIcon;
             }
         }
         // -------------------------------------------------------
         return; // Handled download click
    }
    // --- סוף שינוי בהורדה ---


    // --- לוגיקת שיתוף נשארת זהה ---
    if (button.classList.contains('share-button') && songSerial) {
        event.preventDefault();
        event.stopPropagation();
        console.log(`Shared Handler: Share button clicked for serial ${songSerial}`);
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
                 console.warn("Shared Handler: copyToClipboard function failed.");
                 if (typeof showMessage === 'function') showMessage("שגיאה בהעתקת הקישור.");
            }
        } else {
             console.warn("Shared Handler: copyToClipboard function not found.");
             if (typeof showMessage === 'function') showMessage("שגיאה: לא ניתן להעתיק קישור.");
        }
        return; // Handled share click
    }


    // --- לוגיקת הפניה מחדש מאלבום/זמר נשארת זהה ---
    if (button.classList.contains('album-button') || button.classList.contains('singer-button')) {
        event.preventDefault();
        event.stopPropagation();

        const searchTerm = button.dataset.albumName || button.dataset.singerName || button.textContent.trim();
        const searchType = button.classList.contains('album-button') ? 'album' : 'singer';

        if (searchTerm) {
            const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchTerm)}&searchBy=${encodeURIComponent(searchType)}`;
            console.log(`Shared Handler: Redirecting from secondary page (table button ${searchType}) to: ${redirectUrl}`);
            window.location.href = redirectUrl;
        }
        return; // Handled album/singer click
    }

    // Log unhandled button clicks within tables if needed
    // console.log("Shared Handler: Unhandled button click inside table:", button);
}


// --- פונקציית האתחול נשארת זהה ---
function initializeSharedRedirects() {
    console.log("Shared Handler: Initializing shared handlers...");

    // Attach listener for header search form redirection
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        // Remove first to prevent duplicates if this runs multiple times
        searchForm.removeEventListener('submit', handleHeaderSearchRedirect);
        searchForm.addEventListener('submit', handleHeaderSearchRedirect);
        console.log("Shared Handler: Attached header search redirect listener.");
    } else {
        console.warn("Shared Handler: Header search form not found.");
    }

    // Attach global listener for table actions (download, share, album/singer click)
    // Remove first to prevent duplicates
    document.body.removeEventListener('click', handleTableClickActions);
    document.body.addEventListener('click', handleTableClickActions);
    console.log("Shared Handler: Attached global table click actions listener to document body.");

}

// --- אתחול המאזינים בעת טעינת ה-DOM ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharedRedirects);
} else {
    // If DOM already loaded, run immediately
    initializeSharedRedirects();
}