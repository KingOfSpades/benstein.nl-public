document.addEventListener('DOMContentLoaded', function() {
    const extensions = ['md', 'tf', 'py'];
    const extensionElement = document.getElementById('file-extension');
    
    function updateExtension() {
        const newExt = extensions[Math.floor(Math.random() * extensions.length)];
        extensionElement.textContent = newExt;
    }

    // Update on page load
    updateExtension();

    // Update on visibility change
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            updateExtension();
        }
    });
}); 