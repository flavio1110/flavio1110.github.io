const copyButtons = document.querySelectorAll<HTMLButtonElement>('.share-copy');

copyButtons.forEach(button => {
    const url = button.dataset.shareUrl;
    if (!url) return;

    if (!navigator.clipboard) {
        /// Clipboard API is only supported in secure contexts (HTTPS)
        console.warn('Clipboard API not supported, copy button will not work.');
        return;
    }

    const originalLabel = button.getAttribute('aria-label') || 'Copy link';

    button.addEventListener('click', () => {
        navigator.clipboard.writeText(url)
            .then(() => {
                button.classList.add('copied');
                button.setAttribute('aria-label', 'Copied!');

                setTimeout(() => {
                    button.classList.remove('copied');
                    button.setAttribute('aria-label', originalLabel);
                }, 1500);
            })
            .catch(err => {
                console.error('Failed to copy link', err);
            });
    });
});
