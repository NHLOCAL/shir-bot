function handleHeaderSearchRedirect(event) {
    event.preventDefault();
    const searchForm = event.currentTarget;
    const searchInput = searchForm.querySelector('#searchInput');
    const searchInputVal = searchInput ? searchInput.value.trim() : '';
    const activeFilterButton = searchForm.querySelector('.filter-button.active');
    const searchBy = activeFilterButton ? activeFilterButton.dataset.filter : 'all';

    if (searchInputVal) {
        const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
        console.log(`Shared Handler: Redirecting from secondary page (header search) to: ${redirectUrl}`);
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



    if (button.classList.contains('download-button') && songSerial) {
         event.preventDefault();
         event.stopPropagation();
         console.log(`Shared Handler: Download button clicked for serial ${songSerial}`);
         if (typeof window.downloadSong === 'function') {

             if (typeof window.downloadSongWrapper === 'function') {
                 window.downloadSongWrapper(button);
             } else {

                 button.disabled = true;
                 const originalIcon = button.innerHTML;
                 button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                 window.downloadSong(songSerial)
                    .catch(err => console.error("Shared handler download failed:", err))
                    .finally(() => {
                         setTimeout(() => {
                             if(button) {
                                 button.disabled = false;
                                 button.innerHTML = originalIcon;
                             }
                         }, 2000);
                     });
             }
         } else {
             console.error("Shared Handler: downloadSong function is not defined globally.");

             if (typeof showMessage === 'function') showMessage("שגיאה: פונקציית ההורדה אינה זמינה.");
         }
         return;
    }


    if (button.classList.contains('share-button') && songSerial) {
        event.preventDefault();
        event.stopPropagation();
        console.log(`Shared Handler: Share button clicked for serial ${songSerial}`);
        const shareLink = `${window.location.origin}${baseurl || ''}/?search=${encodeURIComponent(songSerial)}&searchBy=serial`;

        if (typeof copyToClipboard === 'function') {
            const success = copyToClipboard(shareLink); // Perform copy and check success

            if (success) {
                // --- Visual Feedback Logic ---
                const originalIconHTML = button.innerHTML; // Store original icon (e.g., <i class="fas fa-share-alt"></i>)
                button.innerHTML = '<i class="fas fa-check" style="color: green;"></i>'; // Change to checkmark
                button.classList.add('copied'); // Add class for state/styling
                button.disabled = true; // Temporarily disable

                // Revert after a delay
                setTimeout(() => {
                    if (button) { // Check if button still exists
                         button.innerHTML = originalIconHTML; // Restore original icon
                         button.classList.remove('copied'); // Remove class
                         button.disabled = false; // Re-enable
                    }
                }, 1500); // 1.5 seconds delay
                // --- End Visual Feedback Logic ---
            } else {
                 console.warn("Shared Handler: copyToClipboard function failed.");
                 // Optional: Show error message if copy failed
                 if (typeof showMessage === 'function') showMessage("שגיאה בהעתקת הקישור.");
            }
        } else {
             console.warn("Shared Handler: copyToClipboard function not found.");
             // Optional: Show error message if copy function is missing
             if (typeof showMessage === 'function') showMessage("שגיאה: לא ניתן להעתיק קישור.");
        }
        return;
    }


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
        return;
    }


}




function initializeSharedRedirects() {
    console.log("Shared Handler: Initializing shared search redirect handlers...");


    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.removeEventListener('submit', handleHeaderSearchRedirect);
        searchForm.addEventListener('submit', handleHeaderSearchRedirect);
        console.log("Shared Handler: Attached header search redirect listener.");
    }




    document.body.removeEventListener('click', handleTableClickActions);
    document.body.addEventListener('click', handleTableClickActions);
    console.log("Shared Handler: Attached global table click actions listener to document body.");

}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSharedRedirects);
} else {
    initializeSharedRedirects();
}
