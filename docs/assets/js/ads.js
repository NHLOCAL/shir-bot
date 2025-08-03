var baseurl = baseurl || '';
let footerAdInterval;
let currentFooterIndex = 0;
function initializeImpressionTracking() {
    const adElements = document.querySelectorAll('a[data-ad-id]');
    if (adElements.length === 0) {
        return;
    }
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
    };
    const impressionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const adElement = entry.target;
                if (adElement.dataset.impressionTracked) {
                    return;
                }
                adElement.dataset.impressionTracked = 'true';
                const location = adElement.dataset.adLocation;
                const type = adElement.dataset.adType;
                const id = adElement.dataset.adId;
                if (location && type && id) {
                    const eventLabel = `${location} - ${type} - ${id}`;
                    console.log(`Ad Impression Tracked: ${eventLabel}`);
                    if (typeof gtag === 'function') {
                        gtag('event', 'ad_impression', {
                            'event_category': 'Ads',
                            'event_label': eventLabel,
                            'ad_location': location,
                            'ad_type': type,
                            'ad_id': id,
                            'non_interaction': true
                        });
                    } else {
                        console.warn('gtag function not found for impression tracking.');
                    }
                }
                observer.unobserve(adElement);
            }
        });
    }, observerOptions);
    adElements.forEach(ad => {
        impressionObserver.observe(ad);
    });
    console.log(`Impression Tracking: Observing ${adElements.length} ad elements.`);
}
function initializeAdSystem() {
    document.body.addEventListener('click', function(event) {
        const adLink = event.target.closest('a[data-ad-id]');
        if (!adLink) return;
        const location = adLink.dataset.adLocation;
        const type = adLink.dataset.adType;
        const id = adLink.dataset.adId;
        if (location && type && id) {
            const eventLabel = `${location} - ${type} - ${id}`;
            console.log(`Ad Click Tracked: ${eventLabel}`);
            if (typeof gtag === 'function') {
                gtag('event', 'ad_click', {
                    'event_category': 'Ads',
                    'event_label': eventLabel,
                    'ad_location': location,
                    'ad_type': type,
                    'ad_id': id
                });
            } else {
                console.warn('gtag function not found for ad tracking.');
            }
        }
    });
    const footerAdContainer = document.getElementById("footer-ad-container");
    if (footerAdContainer && typeof footerAdsConfig !== 'undefined' && footerAdsConfig.enabled && footerAdsConfig.ads_list && footerAdsConfig.ads_list.length > 0) {
        const ads = footerAdsConfig.ads_list;
        const delay = footerAdsConfig.rotation_delay_ms || 5000;
        function updateFooterContent() {
            if (ads.length === 0) return;
            const ad = ads[currentFooterIndex];
            footerAdContainer.innerHTML = `
                ${ad.text}
                <a href="${ad.link_url}"
                   target="_blank" rel="noopener sponsored"
                   data-ad-location="footer"
                   data-ad-type="${ad.type}"
                   data-ad-id="${ad.tracking_id}">
                   ${ad.cta_text}
                </a>`;
            currentFooterIndex = (currentFooterIndex + 1) % ads.length;
        }
        function startFooterAutoChange() {
            clearInterval(footerAdInterval);
            footerAdInterval = setInterval(updateFooterContent, delay);
        }
        function pauseFooterAdRotation() {
            clearInterval(footerAdInterval);
        }
        function resumeFooterAdRotation() {
            startFooterAutoChange();
        }
        updateFooterContent();
        startFooterAutoChange();
        footerAdContainer.addEventListener('mouseenter', pauseFooterAdRotation);
        footerAdContainer.addEventListener('mouseleave', resumeFooterAdRotation);
    }
}
function initializeSidebarAds() {
    const sidebars = document.querySelectorAll('.ad-sidebar');
    if (sidebars.length === 0) return;

    const MOUSELEAVE_FADEOUT_DELAY_MS = 3000;
    const INITIAL_AD_APPEARANCE_DELAY_MS = 2500;
    const INITIAL_FADEOUT_DELAY_MS = 10000;

    const initialFadeTimers = new Map();
    const mouseleaveTimers = new Map();

    const fadeOutAd = (sidebar) => {
        sidebar.classList.remove('is-visible');
        sidebar.classList.add('is-faded');
    };

    sidebars.forEach(sidebar => {
        sidebar.addEventListener('mouseenter', () => {
            if (mouseleaveTimers.has(sidebar)) {
                clearTimeout(mouseleaveTimers.get(sidebar));
                mouseleaveTimers.delete(sidebar);
            }
            sidebar.classList.add('is-visible');
            sidebar.classList.remove('is-faded');
            if (initialFadeTimers.has(sidebar)) {
                clearTimeout(initialFadeTimers.get(sidebar));
                initialFadeTimers.delete(sidebar);
            }
        });

        sidebar.addEventListener('mouseleave', () => {
            const timerId = setTimeout(() => {
                fadeOutAd(sidebar);
                mouseleaveTimers.delete(sidebar);
            }, MOUSELEAVE_FADEOUT_DELAY_MS);
            mouseleaveTimers.set(sidebar, timerId);
        });
    });

    const animationPlayed = sessionStorage.getItem('shirBotAdAnimationPlayed');
    if (animationPlayed) {
        sidebars.forEach(sidebar => {
            sidebar.classList.add('no-transition');
            sidebar.classList.add('is-faded');
            sidebar.offsetHeight; // Force reflow
            sidebar.classList.remove('no-transition');
        });
    } else {
        sessionStorage.setItem('shirBotAdAnimationPlayed', 'true');
        setTimeout(() => {
            sidebars.forEach(sidebar => {
                sidebar.classList.add('is-visible');
                const timerId = setTimeout(() => {
                    fadeOutAd(sidebar);
                    initialFadeTimers.delete(sidebar);
                }, INITIAL_FADEOUT_DELAY_MS);
                initialFadeTimers.set(sidebar, timerId);
            });
        }, INITIAL_AD_APPEARANCE_DELAY_MS);
    }
}
const helpOverlay = document.querySelector(".help-overlay");
let currentStep = 1;
function showStep(stepChange) {
    if (!helpOverlay) return;
	currentStep += stepChange;
	const modalSteps = helpOverlay.querySelectorAll('.help-modal');
    if (!modalSteps || modalSteps.length === 0) return;
	if (currentStep < 1) currentStep = 1;
	else if (currentStep > modalSteps.length) currentStep = modalSteps.length;
	modalSteps.forEach(step => step.style.display = 'none');
	if (modalSteps[currentStep - 1]) modalSteps[currentStep - 1].style.display = 'block';
}
function openHelp() {
    if (helpOverlay) {
        helpOverlay.style.display = "flex";
        currentStep = 1;
        showStep(0);
    } else {
        console.warn("Help overlay element not found.");
    }
}
function closeHelp() {
	if (helpOverlay) helpOverlay.style.display = 'none';
}
document.addEventListener("DOMContentLoaded", function() {
    initializeAdSystem();
    initializeSidebarAds();
    initializeImpressionTracking();
    document.body.addEventListener('click', function(event){
        if(event.target && event.target.id === 'helpButton' && typeof openHelp === 'function'){
             openHelp();
        }
        if (event.target && event.target.classList.contains('close-help-button') && typeof closeHelp === 'function') {
             closeHelp();
        }
    });
     if(helpOverlay) {
         helpOverlay.addEventListener('click', function(event){
             if(event.target === helpOverlay && typeof closeHelp === 'function'){
                 closeHelp();
             }
         });
         const modalSteps = helpOverlay.querySelectorAll('.help-modal');
         if (modalSteps && modalSteps.length > 0) {
             modalSteps.forEach((step, index) => {
                 step.style.display = index === 0 ? 'block' : 'none';
             });
         }
     }
});