// assets/js/artists-list.js

// --- Dependencies ---
// Relies on the global 'baseurl' variable.

document.addEventListener('DOMContentLoaded', function() {
    const searchForm = document.getElementById('searchForm'); // Assuming the standard header search form is present

    if (searchForm) {
        searchForm.addEventListener('submit', function(event) {
            event.preventDefault(); // Prevent default submission on this page

            const searchInput = document.getElementById('searchInput');
            const searchInputVal = searchInput ? searchInput.value.trim() : '';
            const activeFilter = document.querySelector('.filter-button.active')?.dataset.filter || 'all';


            if (searchInputVal) {
                // Construct the redirect URL with search parameters
                const redirectUrl = `${baseurl}/?search=${encodeURIComponent(searchInputVal)}&searchBy=${activeFilter}`;
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