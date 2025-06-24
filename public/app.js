// Create new file for client-side JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // Page content handling
  function showPage(pageId) {
    const pageContent = document.getElementById('pageContent');
    const pages = document.querySelectorAll('.page');
    
    pageContent.style.display = 'block';
    
    pages.forEach(page => page.style.display = 'none');
    
    const selectedPage = document.getElementById(pageId);
    if (selectedPage) {
      selectedPage.style.display = 'block';
      
      const headerElement = document.getElementById(`${pageId}-header`);
      if (headerElement) {
        let headerText = '';
        switch(pageId) {
          case 'about':
            headerText = 'About ParsePro';
            break;
          case 'how-it-works':
            headerText = 'How It Works';
            break;
          case 'contact':
            headerText = 'Contact Us';
            break;
        }
        setAnimatedHeader(headerElement, headerText);
      }
    }
  }

  // Add click handler to close panel when clicking outside
  document.addEventListener('click', e => {
    const pageContent = document.getElementById('pageContent');
    const footer = document.querySelector('.footer');
    
    if (!pageContent.contains(e.target) && !footer.contains(e.target)) {
      pageContent.style.display = 'none';
      document.querySelectorAll('#pageContent .page').forEach(p => p.style.display = 'none');
    }
  });

  // Prevent clicks inside the content from closing it
  document.getElementById('pageContent').addEventListener('click', e => {
    e.stopPropagation();
  });

  // Make showPage function globally available
  window.showPage = showPage;
}); 