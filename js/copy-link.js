// A relative target keeps links valid on GitHub Pages and local previews.
document.addEventListener('click', async (event) => {
  const button = event.target.closest?.('button[data-copy-link]');
  if (!button) return;

  const url = new URL(button.dataset.copyLink, location.href).href;
  const status = button.nextElementSibling;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt('Copy this link:', url);
    return;
  }

  status.textContent = 'Link copied.';
});
