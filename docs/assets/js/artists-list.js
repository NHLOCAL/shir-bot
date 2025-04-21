// assets/js/artists-list.js

// --- Dependencies ---
// Relies on the global 'baseurl' variable.

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm'); // Assuming the standard header search form is present

    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent default form submission

            const searchInput = document.getElementById('searchInput');
            const searchInputVal = searchInput ? searchInput.value.trim() : '';
            // Find the currently active filter button to get the searchBy value
            const activeFilterButton = document.querySelector('.filter-button.active');
            const searchBy = activeFilterButton ? activeFilterButton.dataset.filter : 'all'; // Default to 'all' if none active

            if (searchInputVal) {
                // Construct the redirect URL for the homepage with search parameters
                const redirectUrl = `${baseurl || ''}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${encodeURIComponent(searchBy)}`;
                console.log(`Redirecting from artists list to: ${redirectUrl}`);
                window.location.href = redirectUrl; // Redirect to the main search page
            } else {
                 // Optionally handle empty search - maybe just focus input?
                 searchInput?.focus();
            }
        });
    } else {
        console.warn("Search form not found on artists list page.");
    }

    // Add specific GA event for viewing the artists list?
    // gtag('event', 'page_view', {
    //    'page_title': document.title,
    //    'page_path': window.location.pathname + window.location.search,
    //    'content_group': 'Artist List' // Example category
    // });
});