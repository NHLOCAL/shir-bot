function cleanUtmParamsFromUrl() {
    const queryParams = new URLSearchParams(window.location.search);
    const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    let hasUtmParams = false;
    utmParams.forEach(param => {
        if (queryParams.has(param)) {
            hasUtmParams = true;
            queryParams.delete(param);
        }
    });
    if (hasUtmParams) {
        try {
            const newUrl = window.location.pathname + (queryParams.toString() ? '?' + queryParams.toString() : '') + window.location.hash;
            window.history.replaceState(null, '', newUrl);
        } catch (e) {
            console.error("Could not update URL to remove UTM parameters.", e);
        }
    }
}
window.addEventListener('load', cleanUtmParamsFromUrl);
var baseurl = baseurl || '';
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalOkButton = document.getElementById('modalOkButton');
const nextObject = document.getElementById("nextObject");
function setCookie(name, value, daysToExpire) {
    var expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    var expires = "expires=" + expirationDate.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}
function showMessage(message) {
    if (!modalOverlay || !modalMessage || !modalOkButton) return;
    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex';
    modalOkButton.addEventListener('click', hideMessage);
    document.addEventListener('click', handleOverlayClick);
    document.addEventListener('keydown', handleEnterKey);
}
function hideMessage() {
    if (!modalOverlay) return;
    modalOverlay.style.display = 'none';
    modalOkButton.removeEventListener('click', hideMessage);
    document.removeEventListener('click', handleOverlayClick);
    document.removeEventListener('keydown', handleEnterKey);
}
function handleOverlayClick(event) {
    if (event.target === modalOverlay) {
        hideMessage();
    }
}
function handleEnterKey(event) {
    if (event.key === 'Enter' && modalOverlay && modalOverlay.style.display === 'flex') {
        hideMessage();
    }
}
function copyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        console.log('Text copied to clipboard');
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    } finally {
        document.body.removeChild(textArea);
    }
}
function initializeDynamicMailtoLinks(scope) {
    const searchScope = scope || document;
    searchScope.querySelectorAll('.feedback-mail-link, .email-link, .dynamic-mailto-ad').forEach(function(link) {
        if (link.dataset.mailtoInitialized) return;
        var isWindows = navigator.userAgent.indexOf('Windows') !== -1;
        var email = link.getAttribute('data-email') || 'mesader.singelim@gmail.com';
        var subject = link.getAttribute('data-subject') || '';
        var body = link.getAttribute('data-body') || '';
        if (isWindows) {
            var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email);
            if(subject) gmailUrl += '&su=' + encodeURIComponent(subject);
            if(body) gmailUrl += '&body=' + encodeURIComponent(body);
            link.setAttribute('href', gmailUrl);
            link.setAttribute('target', '_blank');
        } else {
            var mailto = 'mailto:' + email;
            var params = [];
            if(subject) params.push('subject=' + encodeURIComponent(subject));
            if(body) params.push('body=' + encodeURIComponent(body));
            if(params.length > 0) mailto += '?' + params.join('&');
            link.setAttribute('href', mailto);
            link.removeAttribute('target');
        }
        link.dataset.mailtoInitialized = 'true';
    });
}
window.initializeDynamicMailtoLinks = initializeDynamicMailtoLinks;
document.addEventListener("DOMContentLoaded", function() {
    if (nextObject) {
        nextObject.addEventListener("click", function(event) {
            event.preventDefault();
            window.location.href = baseurl + "/";
        });
    }
    document.body.addEventListener('click', function(event) {
        if (event.target.tagName === 'A' && event.target.hostname !== window.location.hostname) {
             gtag('event', 'click', {
               'event_category': 'Outbound Link',
               'event_label': event.target.href,
               'transport_type': 'beacon'
             });
        }
    });
     const searchFormGlobal = document.querySelector('#searchForm');
     if (searchFormGlobal) {
        searchFormGlobal.addEventListener('submit', function(event) {
            const searchInputGlobal = document.querySelector('#searchInput');
            if (searchInputGlobal) {
                 const searchQuery = searchInputGlobal.value;
                 gtag('event', 'search', {
                    'event_category': 'Search',
                    'event_label': searchQuery
                 });
            }
        });
     }
    initializeDynamicMailtoLinks();
});